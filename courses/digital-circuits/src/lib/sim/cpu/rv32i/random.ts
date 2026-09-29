/**
 * Random RV32I programs for differential testing: the DCL core (or any other implementation) and the
 * reference interpreter run the same random program, and their final states must agree
 * (`compareStates`).
 *
 * The programs are random but safe, so that any disagreement is a bug rather than chaos:
 *
 * - branches and jumps only go forward, to instruction boundaries, so every program ends at its
 *   `ebreak`; `jalr` targets are always loaded into a temporary just before, from a label;
 * - loads and stores use one of the address temporaries t3–t6 (x28–x31), loaded just before with an
 *   address inside a data window (default 0x1000–0x10FF) and an offset that keeps the access
 *   inside the window and naturally aligned; nothing jumps between the two;
 * - the stack pointer is set once and only changed by balanced push/pop blocks, which nothing
 *   jumps into; calls go to straight-line subroutines after the `ebreak`, which never write ra or sp;
 * - all the instructions except `ecall` appear, and `lui`/`auipc`/`li`
 *   values are biased to the edge cases (0, ±1, 0x7FF/0x800, 0x7FFFFFFF, 0x80000000, …).
 *
 * The generator writes assembly source (so it also exercises the assembler), then assembles it.
 */
import { Prng } from '../common/prng';
import { assembleOrThrow, type Rv32Program } from './assembler';

export { compareStates } from './machine';

export interface Rv32RandomOptions {
  /** Units of code in the main body (an instruction or a short safe sequence); default 40. */
  length?: number;
  /** Loads and stores stay in [start, end); default [0x1000, 0x1100). Code must end below it. */
  dataWindow?: [number, number];
  /** Forward branches, `jal` and `jalr` (default true). */
  jumps?: boolean;
  /** Balanced stack blocks (default true). */
  stack?: boolean;
  /** Calls to subroutines (default true). */
  calls?: boolean;
  /** Loads and stores (default true). */
  memory?: boolean;
  /** Reads and writes of the I/O registers (default false). */
  io?: boolean;
}

export interface Rv32RandomProgram {
  seed: number;
  source: string;
  program: Rv32Program;
}

const R_OPS = ['add', 'sub', 'sll', 'slt', 'sltu', 'xor', 'srl', 'sra', 'or', 'and'];
const I_OPS = ['addi', 'slti', 'sltiu', 'xori', 'ori', 'andi'];
const SHIFT_OPS = ['slli', 'srli', 'srai'];
const BRANCHES = ['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu', 'bgt', 'ble', 'bgtu', 'bleu'];
const BRANCH_Z = ['beqz', 'bnez', 'blez', 'bgez', 'bltz', 'bgtz'];
const LOADS: [string, number][] = [['lb', 1], ['lh', 2], ['lw', 4], ['lbu', 1], ['lhu', 2]];
const STORES: [string, number][] = [['sb', 1], ['sh', 2], ['sw', 4]];

/** Address temporaries: never a destination of arithmetic in the main body, reloaded before every use. */
const TEMPS = ['t3', 't4', 't5', 't6'];

const EDGE_VALUES = [0, 1, -1, 2, 0x7ff, 0x800, -0x800, -0x801, 0xfff, 0x1000, 0x7fffffff, 0x80000000, 0xffffffff, 0x55555555, 0xaaaaaaaa, 0x12345678];

const hex = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase();

const IO_STORES: [string, number, string][] = [
  ['sw', 4, 'LEDS'], ['sb', 1, 'LEDS'], ['sh', 2, 'HEX'], ['sw', 4, 'HEX'], ['sb', 1, 'MATRIX'], ['sb', 1, 'MATRIX + 5'], ['sw', 4, 'MATRIX'],
  ['sw', 4, 'MATRIX + 4'], ['sb', 1, 'CONSOLE'], ['sw', 4, 'PWM'], ['sw', 4, 'DAC'], ['sw', 4, 'RANDOM'], ['sh', 2, 'LEDS'],
];
const IO_LOADS: [string, string][] = [
  ['lw', 'SWITCHES'], ['lbu', 'SWITCHES'], ['lw', 'BUTTONS'], ['lw', 'RANDOM'], ['lbu', 'ADC'], ['lw', 'LEDS'], ['lhu', 'HEX'],
  ['lbu', 'MATRIX + 1'], ['lw', 'MATRIX + 4'], ['lw', 'TIMER'], ['lw', 'TIMER_HI'], ['lw', 'PWM'], ['lb', 'CONSOLE'],
];

/** Generate a random, safe RV32I program from a seed. */
export function randomProgram(seed: number, options: Rv32RandomOptions = {}): Rv32RandomProgram {
  const rng = new Prng(seed);
  const length = options.length ?? 40;
  const [wlo, whi] = options.dataWindow ?? [0x1000, 0x1100];
  const jumps = options.jumps ?? true;
  const stack = options.stack ?? true;
  const calls = options.calls ?? true;
  const memory = options.memory ?? true;
  const io = options.io ?? false;
  if (wlo % 4 !== 0 || whi % 4 !== 0 || whi - wlo < 16) throw new RangeError('the data window must be word aligned and at least 16 bytes');

  const anyReg = () => `x${rng.int(0, 31)}`;
  /** Registers that may be overwritten in the main body: not sp, not the address temporaries. */
  const dst = () => {
    const n = rng.int(0, 27);
    return `x${n === 2 ? 0 : n}`;
  };
  /** In subroutines: also not ra. */
  let subMode = false;
  const rd = () => {
    if (!subMode) return dst();
    const n = rng.int(0, 27);
    return `x${n === 1 || n === 2 ? 0 : n}`;
  };
  const edge = () => (rng.chance(0.4) ? EDGE_VALUES[rng.int(0, EDGE_VALUES.length - 1)]! : rng.u32());
  const imm12 = () => (rng.chance(0.3) ? rng.pick([0, 1, -1, 2047, -2048, 255, 0x7f, -256]) : rng.int(-2048, 2047));

  /** A straight-line unit: no branches, no stack changes. */
  const simple = (): string[] => {
    const kind = rng.weighted({
      r: 6, i: 5, shift: 3, lui: 1, auipc: 1, li: 2, pseudo: 3, nop: 0.3, fence: 0.3,
      load: memory ? 3 : 0, store: memory ? 3 : 0, io: io ? 2 : 0,
    });
    switch (kind) {
      case 'r':
        return [`${rng.pick(R_OPS)} ${rd()}, ${anyReg()}, ${anyReg()}`];
      case 'i':
        return [`${rng.pick(I_OPS)} ${rd()}, ${anyReg()}, ${imm12()}`];
      case 'shift':
        return [`${rng.pick(SHIFT_OPS)} ${rd()}, ${anyReg()}, ${rng.int(0, 31)}`];
      case 'lui':
        return [`lui ${rd()}, ${hex(rng.chance(0.3) ? rng.pick([0, 1, 0x7ffff, 0x80000, 0xfffff]) : rng.int(0, 0xfffff))}`];
      case 'auipc':
        return [`auipc ${rd()}, ${hex(rng.int(0, 0xfffff))}`];
      case 'li':
        return [`li ${rd()}, ${edge() | 0}`];
      case 'pseudo': {
        const r = rng.pick(['mv', 'not', 'neg', 'seqz', 'snez', 'sltz', 'sgtz']);
        return [`${r} ${rd()}, ${anyReg()}`];
      }
      case 'nop':
        return ['nop'];
      case 'fence':
        return [rng.pick(['fence', 'fence rw, rw', 'fence r, w', 'fence iorw, 0'])];
      case 'load':
      case 'store': {
        const [m, w] = kind === 'load' ? rng.pick(LOADS) : rng.pick(STORES);
        const t = rng.pick(TEMPS);
        const base = wlo + 4 * rng.int(0, (whi - wlo) / 4 - 1);
        // Offset range keeping [base + off, base + off + w) inside the window, aligned to w.
        const lo = Math.ceil((wlo - base) / w);
        const hi = Math.floor((whi - base - w) / w);
        const off = rng.int(lo, hi) * w;
        return kind === 'load' ? [`li ${t}, ${hex(base)}`, `${m} ${rd()}, ${off}(${t})`] : [`li ${t}, ${hex(base)}`, `${m} ${anyReg()}, ${off}(${t})`];
      }
      default: {
        if (rng.chance(0.5)) {
          const [m, , name] = rng.pick(IO_STORES);
          return [`${m} ${anyReg()}, ${name}(zero)`];
        }
        const [m, name] = rng.pick(IO_LOADS);
        return [`${m} ${rd()}, ${name}(zero)`];
      }
    }
  };

  // Subroutines (placed after the ebreak).
  const subs: string[][] = [];
  if (calls) {
    subMode = true;
    for (let k = rng.int(1, 3); k > 0; k--) {
      const body: string[] = [];
      for (let j = rng.int(1, 4); j > 0; j--) body.push(...simple());
      subs.push([`sub${subs.length}:`, ...body, 'ret']);
    }
    subMode = false;
  }
  const subBytes = subs.reduce((s, sub) => s + (sub.length - 1) * 8, 0); // an upper bound (every pseudo may be 2 words)

  // The body: initialise some registers, then units.
  const units: string[][] = [];
  let bytes = 8 * 4;
  const budget = wlo - subBytes - 16;
  units.push(['li sp, 0x2000']);
  for (let r = 5; r < 13; r++) units.push([`li x${r}, ${edge() | 0}`]);
  const kinds = { simple: 10, branch: jumps ? 2 : 0, jump: jumps ? 1 : 0, stack: stack ? 1 : 0, call: calls ? 1 : 0 };
  while (units.length < length + 9) {
    const kind = rng.weighted(kinds);
    let lines: string[];
    if (kind === 'branch') {
      lines = rng.chance(0.75) ? [`${rng.pick(BRANCHES)} ${anyReg()}, ${anyReg()}, @`] : [`${rng.pick(BRANCH_Z)} ${anyReg()}, @`];
    } else if (kind === 'jump') {
      const t = rng.pick(TEMPS);
      lines = rng.pick([
        [`j @`],
        [`jal ${dst()}, @`],
        [`la ${t}, @`, `jalr ${dst()}, 0(${t})`],
        [`la ${t}, @`, `jalr x0, 1(${t})`], // the lowest bit of the target is cleared
      ]);
    } else if (kind === 'stack') {
      const n = rng.int(1, 3);
      const regs = Array.from({ length: n }, anyReg);
      lines = [`addi sp, sp, ${-4 * n}`, ...regs.map((r, i) => `sw ${r}, ${4 * i}(sp)`)];
      for (let j = rng.int(0, 3); j > 0; j--) lines.push(...simple());
      lines.push(...regs.map((_, i) => `lw ${dst()}, ${4 * i}(sp)`), `addi sp, sp, ${4 * n}`);
    } else if (kind === 'call') {
      lines = [rng.pick([`call sub${rng.int(0, subs.length - 1)}`, `jal ra, sub${rng.int(0, subs.length - 1)}`])];
    } else lines = simple();
    const size = 4 * lines.length + 8; // every la/li/call may take two words
    if (bytes + size > budget) break;
    units.push(lines);
    bytes += size;
  }

  const n = units.length;
  const out: string[] = [`# random RV32I program, seed ${seed}`];
  units.forEach((lines, i) => {
    out.push(`L${i}:`);
    for (const line of lines) out.push('        ' + (line.includes('@') ? line.replace('@', `L${rng.int(i + 1, n)}`) : line));
  });
  out.push(`L${n}:`, '        ebreak');
  for (const sub of subs) out.push(...sub.map((l) => (l.endsWith(':') ? l : '        ' + l)));
  out.push(`        .org ${hex(wlo)}`);
  for (let a = wlo; a < whi; a += 16) {
    const words = Array.from({ length: Math.min(4, (whi - a) / 4) }, () => hex(rng.u32()));
    out.push(`        .word ${words.join(', ')}`);
  }
  const source = out.join('\n') + '\n';
  return { seed, source, program: assembleOrThrow(source, `random-${seed}`) };
}

