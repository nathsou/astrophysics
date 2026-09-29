/**
 * The Octet disassembler: bytes back to assembly text that the assembler accepts and that assembles
 * to the same bytes. A first byte whose ignored bits are not zero (not canonical) is shown as
 * `.byte`, since no mnemonic would reproduce it.
 */
import { DECODE_TABLE, OCTET_IO, isCanonical, type OctetInstruction } from './spec';

export interface DisassembledInstruction {
  address: number;
  bytes: number[];
  /** Assembly text, e.g. `LDI R0, 0x2A`. */
  text: string;
  /** The instruction (undefined for `.byte`). */
  spec?: OctetInstruction;
  /** For jumps and calls: the target address. */
  target?: number;
}

export interface DisassembleOptions {
  /** Names for addresses (labels), used for jump targets and memory operands. */
  labels?: Map<number, string[]> | Record<string, number>;
  /** Show I/O addresses by name, e.g. `[LEDS]` (default true). */
  ioNames?: boolean;
}

const h2 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(2, '0');

function labelMap(labels: DisassembleOptions['labels']): Map<number, string> {
  const out = new Map<number, string>();
  if (!labels) return out;
  if (labels instanceof Map) {
    for (const [addr, names] of labels) if (names[0]) out.set(addr, names[0]);
  } else {
    for (const [name, addr] of Object.entries(labels)) if (!out.has(addr)) out.set(addr, name);
  }
  return out;
}

const IO_READ_NAMES = new Map<number, string>();
const IO_WRITE_NAMES = new Map<number, string>();
for (let r = 0; r < 8; r++) {
  const n = r === 0 ? 'MATRIX' : `MATRIX+${r}`;
  IO_READ_NAMES.set(0xf0 + r, n);
  IO_WRITE_NAMES.set(0xf0 + r, n);
}
for (const [name, addr] of Object.entries(OCTET_IO)) {
  if (name === 'MATRIX') continue;
  if (name !== 'DAC') IO_READ_NAMES.set(addr, name);
  if (name !== 'ADC') IO_WRITE_NAMES.set(addr, name);
}

/** Disassemble the instruction at `address` (the operand byte wraps around at 0xFF). */
export function disassembleAt(
  memory: ArrayLike<number>,
  address: number,
  options: DisassembleOptions = {},
  names: Map<number, string> = labelMap(options.labels),
): DisassembledInstruction {
  const a = address & 0xff;
  const first = memory[a]! & 0xff;
  const spec = DECODE_TABLE[first]!;
  if (!isCanonical(first)) return { address: a, bytes: [first], text: `.byte ${h2(first)}` };
  const second = memory[(a + 1) & 0xff]! & 0xff;
  const bytes = spec.bytes === 2 ? [first, second] : [first];
  if (first === 0x10) return { address: a, bytes, text: 'NOP', spec };
  const d = (first >> 2) & 3;
  const s = first & 3;
  const io = options.ioNames !== false;
  const addrName = (v: number, write: boolean) =>
    names.get(v) ?? (io ? (write ? IO_WRITE_NAMES : IO_READ_NAMES).get(v) : undefined) ?? h2(v);
  const ops = spec.operands.map((o) => {
    switch (o) {
      case 'rd':
        return `R${d}`;
      case 'rs':
        return `R${s}`;
      case '[rd]':
        return `[R${d}]`;
      case '[rs]':
        return `[R${s}]`;
      case 'imm':
        return h2(second);
      case '[addr]':
        return `[${addrName(second, spec.mnemonic === 'ST')}]`;
      case 'addr':
        return names.get(second) ?? h2(second);
    }
  });
  const text = ops.length ? `${spec.mnemonic} ${ops.join(', ')}` : spec.mnemonic;
  const target = spec.operands.includes('addr') ? second : undefined;
  return { address: a, bytes, text, spec, target };
}

/**
 * Disassemble `[start, end)` by linear sweep. With `isInstruction`, bytes that are not instruction
 * starts (data) are shown as `.byte`.
 */
export function disassemble(
  memory: ArrayLike<number>,
  start = 0,
  end = memory.length,
  options: DisassembleOptions & { isInstruction?: (address: number) => boolean } = {},
): DisassembledInstruction[] {
  const names = labelMap(options.labels);
  const out: DisassembledInstruction[] = [];
  let a = start;
  while (a < end) {
    if (options.isInstruction && !options.isInstruction(a)) {
      const b = memory[a]! & 0xff;
      out.push({ address: a, bytes: [b], text: `.byte ${h2(b)}` });
      a++;
      continue;
    }
    const ins = disassembleAt(memory, a, options, names);
    if (a + ins.bytes.length > end) {
      // A two-byte instruction cut off by the end of the range: show its first byte as data.
      out.push({ address: a, bytes: [ins.bytes[0]!], text: `.byte ${h2(ins.bytes[0]!)}` });
      a++;
      continue;
    }
    out.push(ins);
    a += ins.bytes.length;
  }
  return out;
}

/**
 * Turn memory back into assembly source that reassembles to the same bytes: a `.org`, then one line
 * per instruction, with labels where `options.labels` names an address.
 */
export function toSource(
  memory: ArrayLike<number>,
  start = 0,
  end = memory.length,
  options: DisassembleOptions & { isInstruction?: (address: number) => boolean } = {},
): string {
  const names = labelMap(options.labels);
  const lines = [`        .org ${h2(start)}`];
  for (const ins of disassemble(memory, start, end, options)) {
    const label = names.get(ins.address);
    const hexBytes = ins.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    lines.push((label ? `${label}: ` : '').padEnd(8) + ins.text.padEnd(24) + `; ${h2(ins.address)}: ${hexBytes}`);
  }
  return lines.join('\n') + '\n';
}
