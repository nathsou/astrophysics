/**
 * The RV32I disassembler: words back to assembly text that the assembler accepts and that assembles
 * to the same word. Words that are not valid RV32I instructions are shown as `.word`.
 *
 * By default it prints ABI register names and the standard pseudo-instructions (`li`, `mv`, `ret`,
 * `beqz`, `j`, …); both can be turned off. Branch and jump operands are absolute addresses (or
 * label names when the caller gives labels), so the text reassembles at the same address.
 */
import { RV32_IO } from './board';
import { FENCE_WORD, NOP_WORD, decode, registerName, type Rv32Instruction } from './spec';

export interface Rv32DisassembleOptions {
  /** Names for addresses (labels), used for branch and jump targets. */
  labels?: Map<number, string[]> | Record<string, number>;
  /** Use the pseudo-instructions `li`, `mv`, `ret`, `j`, … (default true). */
  pseudo?: boolean;
  /** ABI register names (`a0`) instead of `x10` (default true). */
  abi?: boolean;
  /** Show I/O addresses by name, e.g. `sw a0, LEDS(zero)` (default true). */
  ioNames?: boolean;
}

export interface DisassembledWord {
  address: number;
  word: number;
  /** Assembly text, e.g. `addi a0, a1, -4`. */
  text: string;
  /** The instruction (undefined for `.word`). */
  spec?: Rv32Instruction;
  /** For branches and jal: the target address. */
  target?: number;
}

const hex8 = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(8, '0');
const hexAddr = (n: number) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(4, '0');

function labelMap(labels: Rv32DisassembleOptions['labels']): Map<number, string> {
  const out = new Map<number, string>();
  if (!labels) return out;
  if (labels instanceof Map) {
    for (const [addr, names] of labels) if (names[0]) out.set(addr >>> 0, names[0]);
  } else {
    for (const [name, addr] of Object.entries(labels)) if (!out.has(addr >>> 0)) out.set(addr >>> 0, name);
  }
  return out;
}

const IO_READ_NAMES = new Map<number, string>();
const IO_WRITE_NAMES = new Map<number, string>();
for (let r = 1; r < 8; r++) {
  IO_READ_NAMES.set(RV32_IO.MATRIX + r, `MATRIX + ${r}`);
  IO_WRITE_NAMES.set(RV32_IO.MATRIX + r, `MATRIX + ${r}`);
}
for (const [name, addr] of Object.entries(RV32_IO)) {
  if (name !== 'DAC') IO_READ_NAMES.set(addr, name);
  if (name !== 'ADC') IO_WRITE_NAMES.set(addr, name);
}

const PRED_SUCC = 'iorw';
function fenceSet(bits: number): string {
  let s = '';
  for (let i = 0; i < 4; i++) if (bits & (8 >> i)) s += PRED_SUCC[i];
  return s;
}

/** Disassemble one word located at `address`. */
export function disassembleWord(
  word: number,
  address: number,
  options: Rv32DisassembleOptions = {},
  names: Map<number, string> = labelMap(options.labels),
): DisassembledWord {
  const w = word >>> 0;
  const d = decode(w);
  if (!d) return { address, word: w, text: `.word ${hex8(w)}` };
  const pseudo = options.pseudo !== false;
  const abi = options.abi !== false;
  const r = (n: number) => registerName(n, abi);
  const spec = d.spec;
  const m = spec.mnemonic;
  const target = (offset: number) => (address + offset) >>> 0;
  const targetName = (t: number) => names.get(t) ?? hexAddr(t);
  const mem = (write: boolean) => {
    const io = options.ioNames !== false && d.rs1 === 0 ? (write ? IO_WRITE_NAMES : IO_READ_NAMES).get(d.imm >>> 0) : undefined;
    return `${io ?? d.imm}(${r(d.rs1)})`;
  };
  const done = (text: string, t?: number): DisassembledWord => ({ address, word: w, text, spec, target: t });

  switch (spec.kind) {
    case 'r': {
      if (pseudo) {
        if (m === 'sub' && d.rs1 === 0) return done(`neg ${r(d.rd)}, ${r(d.rs2)}`);
        if (m === 'sltu' && d.rs1 === 0) return done(`snez ${r(d.rd)}, ${r(d.rs2)}`);
        if (m === 'slt' && d.rs2 === 0) return done(`sltz ${r(d.rd)}, ${r(d.rs1)}`);
        if (m === 'slt' && d.rs1 === 0) return done(`sgtz ${r(d.rd)}, ${r(d.rs2)}`);
      }
      return done(`${m} ${r(d.rd)}, ${r(d.rs1)}, ${r(d.rs2)}`);
    }
    case 'i': {
      if (pseudo) {
        if (w === NOP_WORD) return done('nop');
        if (m === 'addi' && d.rs1 === 0 && d.rd !== 0) return done(`li ${r(d.rd)}, ${d.imm}`);
        if (m === 'addi' && d.imm === 0 && d.rd !== 0 && d.rs1 !== 0) return done(`mv ${r(d.rd)}, ${r(d.rs1)}`);
        if (m === 'xori' && d.imm === -1) return done(`not ${r(d.rd)}, ${r(d.rs1)}`);
        if (m === 'sltiu' && d.imm === 1) return done(`seqz ${r(d.rd)}, ${r(d.rs1)}`);
      }
      return done(`${m} ${r(d.rd)}, ${r(d.rs1)}, ${d.imm}`);
    }
    case 'shift':
      return done(`${m} ${r(d.rd)}, ${r(d.rs1)}, ${d.imm}`);
    case 'load':
      return done(`${m} ${r(d.rd)}, ${mem(false)}`);
    case 'store':
      return done(`${m} ${r(d.rs2)}, ${mem(true)}`);
    case 'branch': {
      const t = target(d.imm);
      const tn = targetName(t);
      if (pseudo) {
        if (m === 'beq' && d.rs2 === 0) return done(`beqz ${r(d.rs1)}, ${tn}`, t);
        if (m === 'bne' && d.rs2 === 0) return done(`bnez ${r(d.rs1)}, ${tn}`, t);
        if (m === 'bge' && d.rs2 === 0) return done(`bgez ${r(d.rs1)}, ${tn}`, t);
        if (m === 'bge' && d.rs1 === 0) return done(`blez ${r(d.rs2)}, ${tn}`, t);
        if (m === 'blt' && d.rs2 === 0) return done(`bltz ${r(d.rs1)}, ${tn}`, t);
        if (m === 'blt' && d.rs1 === 0) return done(`bgtz ${r(d.rs2)}, ${tn}`, t);
      }
      return done(`${m} ${r(d.rs1)}, ${r(d.rs2)}, ${tn}`, t);
    }
    case 'lui':
      return done(`${m} ${r(d.rd)}, 0x${((d.imm >>> 12) & 0xfffff).toString(16).toUpperCase()}`);
    case 'jal': {
      const t = target(d.imm);
      const tn = targetName(t);
      if (pseudo && d.rd === 0) return done(`j ${tn}`, t);
      if (pseudo && d.rd === 1) return done(`jal ${tn}`, t);
      return done(`jal ${r(d.rd)}, ${tn}`, t);
    }
    case 'jalr': {
      if (pseudo && d.imm === 0) {
        if (d.rd === 0 && d.rs1 === 1) return done('ret');
        if (d.rd === 0) return done(`jr ${r(d.rs1)}`);
        if (d.rd === 1) return done(`jalr ${r(d.rs1)}`);
      }
      return done(`jalr ${r(d.rd)}, ${d.imm}(${r(d.rs1)})`);
    }
    case 'fence':
      return done(w === FENCE_WORD ? 'fence' : `fence ${fenceSet((d.imm >> 4) & 15) || '0'}, ${fenceSet(d.imm & 15) || '0'}`);
    default:
      return done(m);
  }
}

/** Read the little-endian word at byte address `address` (bytes beyond the end read as 0). */
function wordAt(memory: ArrayLike<number>, address: number): number {
  const b = (i: number) => (address + i < memory.length ? memory[address + i]! & 0xff : 0);
  return (b(0) | (b(1) << 8) | (b(2) << 16) | (b(3) << 24)) >>> 0;
}

/**
 * Disassemble the bytes `[start, end)` of a memory image, four at a time. With `isInstruction`,
 * words that are not instruction starts (data) are shown as `.word`; a tail shorter than a word is
 * shown as `.byte`s.
 */
export function disassemble(
  memory: ArrayLike<number>,
  start = 0,
  end = memory.length,
  options: Rv32DisassembleOptions & { isInstruction?: (address: number) => boolean } = {},
): DisassembledWord[] {
  const names = labelMap(options.labels);
  const out: DisassembledWord[] = [];
  let a = start;
  while (a < end) {
    if (a + 4 > end) {
      const b = memory[a]! & 0xff;
      out.push({ address: a, word: b, text: `.byte 0x${b.toString(16).toUpperCase().padStart(2, '0')}` });
      a++;
      continue;
    }
    const w = wordAt(memory, a);
    if (options.isInstruction && !options.isInstruction(a)) out.push({ address: a, word: w, text: `.word ${hex8(w)}` });
    else out.push(disassembleWord(w, a, options, names));
    a += 4;
  }
  return out;
}

/**
 * Turn memory back into assembly source that reassembles to the same bytes: a `.org`, then one line
 * per word, with labels where `options.labels` names an address.
 */
export function toSource(
  memory: ArrayLike<number>,
  start = 0,
  end = memory.length,
  options: Rv32DisassembleOptions & { isInstruction?: (address: number) => boolean } = {},
): string {
  const names = labelMap(options.labels);
  const lines = [`        .org ${hexAddr(start)}`];
  for (const ins of disassemble(memory, start, end, options)) {
    const label = names.get(ins.address);
    const bytes = ins.text.startsWith('.byte') ? 1 : 4;
    lines.push((label ? `${label}: ` : '').padEnd(10) + ins.text.padEnd(30) + `; ${hexAddr(ins.address)}: ${bytes === 4 ? hex8(ins.word).slice(2) : ins.word.toString(16).toUpperCase().padStart(2, '0')}`);
  }
  return lines.join('\n') + '\n';
}
