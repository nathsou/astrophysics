/**
 * The bits of an Octet instruction and what they mean: the logic behind the "flip the bits" figure. The instruction set
 * is `spec.ts`; this module only reads it, to say which bit of a first byte is opcode, register field, sub-operation
 * (or condition) or ignored, and to move between a byte and its assembly text.
 */
import { DECODE_TABLE, disassembleAt, encodeFirstByte, instructionByMnemonic, registerBits, type OctetInstruction } from '$lib/sim/cpu/octet';

export type FieldKind = 'op' | 'dd' | 'ss' | 'fixed' | 'cond' | 'ignored';

export interface BitCell {
  /** Bit number in the byte, 7 = most significant. */
  bit: number;
  value: 0 | 1;
  kind: FieldKind;
}

/** The eight bits of a first byte, most significant first, each with its role for the instruction it makes. */
export function cellsOf(first: number): BitCell[] {
  const spec = DECODE_TABLE[first & 0xff]!;
  const regs = registerBits(spec);
  const out: BitCell[] = [];
  for (let bit = 7; bit >= 0; bit--) {
    let kind: FieldKind;
    if (bit >= 4) kind = 'op';
    else {
      const m = 1 << bit;
      if (regs & m) kind = bit >= 2 ? 'dd' : 'ss';
      else if (spec.ignored & m) kind = 'ignored';
      else kind = spec.group === 'jump' ? 'cond' : 'fixed';
    }
    out.push({ bit, value: ((first >> bit) & 1) as 0 | 1, kind });
  }
  return out;
}

export interface Explained {
  spec: OctetInstruction;
  first: number;
  /** The second byte, if the instruction has one. */
  second?: number;
  /** Assembly text, as the disassembler writes it. */
  text: string;
  bytes: number[];
  /** Register numbers the instruction names, if any. */
  d?: number;
  s?: number;
  /** True if an ignored bit is 1: the assembler would write 0 there, the hardware does not care. */
  nonCanonical: boolean;
  cycles: number;
}

export function explain(first: number, second = 0): Explained {
  const f = first & 0xff;
  const spec = DECODE_TABLE[f]!;
  const regs = registerBits(spec);
  const two = spec.bytes === 2;
  const bytes = two ? [f, second & 0xff] : [f];
  const d = regs & 0xc ? (f >> 2) & 3 : undefined;
  const s = regs & 0x3 ? f & 3 : undefined;
  return {
    spec,
    first: f,
    second: two ? second & 0xff : undefined,
    text: disassembleAt(two ? bytes : [f, 0], 0, { ioNames: true }).text,
    bytes,
    d,
    s,
    nonCanonical: (f & spec.ignored) !== 0,
    cycles: spec.cycles,
  };
}

/** Change the instruction of a first byte to `mnemonic`, keeping the register fields where the new instruction has them. */
export function withMnemonic(first: number, mnemonic: string): number {
  const spec = instructionByMnemonic(mnemonic);
  if (!spec) throw new Error(`no instruction ${mnemonic}`);
  return encodeFirstByte(spec, (first >> 2) & 3, first & 3);
}

/** The mnemonics a picker offers: every instruction once (the jumps as their sixteen conditions). */
export function mnemonics(): { group: string; items: string[] }[] {
  const seen = new Map<string, string[]>();
  for (let i = 0; i < 256; i++) {
    const spec = DECODE_TABLE[i]!;
    const list = seen.get(spec.group) ?? [];
    if (!list.includes(spec.mnemonic)) list.push(spec.mnemonic);
    seen.set(spec.group, list);
  }
  const order = ['system', 'move', 'memory', 'stack', 'alu', 'unary', 'jump'];
  const names: Record<string, string> = { system: 'System', move: 'Moves', memory: 'Loads and stores', stack: 'Stack', alu: 'Arithmetic and logic', unary: 'One register', jump: 'Jumps' };
  return order.map((g) => ({ group: names[g]!, items: seen.get(g) ?? [] }));
}
