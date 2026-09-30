/**
 * Random Octet programs for differential testing: a gate-level (bench or DCL) Octet and the
 * reference interpreter run the same random program, and their final states must agree
 * (`compareStates`).
 *
 * The programs are random but safe, so that any disagreement is a bug rather than chaos:
 *
 * - jumps only go forward, to instruction boundaries, so every program terminates (at its HLT);
 * - loads and stores stay in a data window (default 0xC0–0xDF), which starts with random bytes;
 *   register-indirect accesses are always preceded by an LDI of an address in the window, and
 *   nothing jumps between the two;
 * - PUSH and POP come in balanced blocks that nothing jumps into, and CALLs go to straight-line
 *   subroutines after the HLT, so the stack stays within 0xE0–0xEF;
 * - only canonical encodings are produced (the assembler writes 0 in ignored bits).
 *
 * The generator writes assembly source (so it also exercises the assembler), then assembles it.
 */
import { Prng } from '../common/prng';
import { assembleOrThrow, type OctetProgram } from './assembler';
import { OCTET_CONDITIONS } from './spec';

export { compareStates } from './machine';

export interface OctetRandomOptions {
  /** Units of code in the main body (an instruction or a short safe sequence); default 40. */
  length?: number;
  /** Loads and stores stay in [start, end); default [0xC0, 0xE0). Code must end below it. */
  dataWindow?: [number, number];
  /** Forward conditional and unconditional jumps (default true). */
  jumps?: boolean;
  /** Balanced PUSH/POP blocks (default true). */
  stack?: boolean;
  /** CALLs to subroutines (default true). */
  calls?: boolean;
  /** Reads and writes of the I/O registers (default false). */
  io?: boolean;
}

export interface OctetRandomProgram {
  seed: number;
  source: string;
  program: OctetProgram;
}

const ALU = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'CMP'];
const UNARY = ['SHL', 'SHR', 'NOT', 'INC'];
const JUMPS = OCTET_CONDITIONS.map((c) => c.mnemonic);
const IO_WRITES = ['LEDS', 'HEX', 'MATRIX', 'MATRIX + 3', 'MATRIX + 7', 'CONSOLE', 'PWM', 'DAC', 'RANDOM'];
const IO_READS = ['SWITCHES', 'BUTTONS', 'RANDOM', 'ADC', 'LEDS', 'HEX', 'MATRIX + 1'];

const hex = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');

/** Generate a random, safe Octet program from a seed. */
export function randomProgram(seed: number, options: OctetRandomOptions = {}): OctetRandomProgram {
  const rng = new Prng(seed);
  const length = options.length ?? 40;
  const [wlo, whi] = options.dataWindow ?? [0xc0, 0xe0];
  const jumps = options.jumps ?? true;
  const stack = options.stack ?? true;
  const calls = options.calls ?? true;
  const io = options.io ?? false;

  const reg = () => `R${rng.int(0, 3)}`;
  const imm = () => hex(rng.int(0, 255));
  const waddr = () => hex(rng.int(wlo, whi - 1));

  /** A simple unit: straight-line, no stack, no jumps. Returns [lines, bytes]. */
  const simple = (): [string[], number] => {
    const kind = rng.weighted({ mov: 2, ldi: 2, alu: 6, unary: 3, ld: 2, st: 2, ldr: 1, str: 1, io: io ? 2 : 0 });
    switch (kind) {
      case 'mov':
        return [[`MOV ${reg()}, ${reg()}`], 1];
      case 'ldi':
        return [[`LDI ${reg()}, ${imm()}`], 2];
      case 'alu':
        return [[`${rng.pick(ALU)} ${reg()}, ${reg()}`], 1];
      case 'unary':
        return [[`${rng.pick(UNARY)} ${reg()}`], 1];
      case 'ld':
        return [[`LD ${reg()}, [${waddr()}]`], 2];
      case 'st':
        return [[`ST [${waddr()}], ${reg()}`], 2];
      case 'ldr': {
        const p = reg();
        return [[`LDI ${p}, ${waddr()}`, `LDR ${reg()}, [${p}]`], 3];
      }
      case 'str': {
        const p = reg();
        return [[`LDI ${p}, ${waddr()}`, `STR [${p}], ${reg()}`], 3];
      }
      default:
        return rng.chance(0.5)
          ? [[`ST [${rng.pick(IO_WRITES)}], ${reg()}`], 2]
          : [[`LD ${reg()}, [${rng.pick(IO_READS)}]`], 2];
    }
  };

  // Subroutines (placed after the HLT).
  const subs: string[][] = [];
  if (calls) {
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const body: string[] = [];
      for (let j = rng.int(1, 4); j > 0; j--) body.push(...simple()[0]);
      subs.push([`S${k}:`, ...body, 'RET']);
    }
  }
  const subBytes = subs.reduce((s, sub) => s + sub.length * 3, 0); // an upper bound

  // Initialise the registers, then the body.
  const units: string[][] = [];
  let bytes = 8;
  const budget = wlo - subBytes - 4;
  for (let r = 0; r < 4; r++) units.push([`LDI R${r}, ${imm()}`]);
  const kinds = { simple: 10, jump: jumps ? 2 : 0, stack: stack ? 1 : 0, call: calls ? 1 : 0 };
  while (units.length < length + 4) {
    const kind = rng.weighted(kinds);
    let lines: string[];
    let size: number;
    if (kind === 'jump') {
      // The target is filled in once we know how many units there are.
      lines = [`${rng.pick(JUMPS)} @`];
      size = 2;
    } else if (kind === 'stack') {
      lines = [`PUSH ${reg()}`];
      size = 2;
      for (let j = rng.int(0, 3); j > 0; j--) {
        const [l, b] = simple();
        lines.push(...l);
        size += b;
      }
      lines.push(`POP ${reg()}`);
    } else if (kind === 'call') {
      lines = [`CALL S${rng.int(0, subs.length - 1)}`];
      size = 2;
    } else [lines, size] = simple();
    if (bytes + size > budget) break;
    units.push(lines);
    bytes += size;
  }

  const n = units.length;
  const out: string[] = [`; random Octet program, seed ${seed}`];
  units.forEach((lines, i) => {
    out.push(`L${i}:`);
    for (const line of lines) {
      out.push('        ' + (line.endsWith('@') ? line.replace('@', `L${rng.int(i + 1, n)}`) : line));
    }
  });
  out.push(`L${n}:`, '        HLT');
  for (const sub of subs) out.push(...sub.map((l) => (l.endsWith(':') ? l : '        ' + l)));
  out.push(`        .org ${hex(wlo)}`);
  const data: string[] = [];
  for (let a = wlo; a < whi; a++) data.push(imm());
  for (let k = 0; k < data.length; k += 8) out.push(`        .byte ${data.slice(k, k + 8).join(', ')}`);
  const source = out.join('\n') + '\n';
  return { seed, source, program: assembleOrThrow(source, `random-${seed}`) };
}
