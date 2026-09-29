/**
 * Assemble and run Octet source for the appendix's mini boxes: the two-pass assembler's listing, a hex
 * dump of what it produced, and the state the reference interpreter is in when it stops.
 */
import { assemble, type OctetProgram } from '$lib/sim/cpu/octet/assembler';
import { OctetMachine } from '$lib/sim/cpu/octet/machine';
import { hex2 } from './card';

export interface ListingRow {
  line: number;
  address?: number;
  bytes: number[];
  source: string;
}

export interface RunSummary {
  reason: 'halted' | 'max-steps';
  steps: number;
  cycles: number;
  r: number[];
  pc: number;
  sp: number;
  flags: { z: boolean; c: boolean; n: boolean; v: boolean };
  leds: number;
  hex: number;
  console: string;
  /** Any of the 64 kibi… bytes of RAM the program changed while running, by address. */
  ram: number[];
}

export interface Assembled {
  ok: boolean;
  program: OctetProgram;
  errors: { line: number; column: number; message: string; severity: 'error' | 'warning' }[];
  /** Bytes emitted. */
  size: number;
  listing: ListingRow[];
}

export function assembleSource(source: string): Assembled {
  const program = assemble(source);
  return {
    ok: program.ok,
    program,
    errors: program.diagnostics.map((d) => ({ line: d.line, column: d.column, message: d.message, severity: d.severity })),
    size: program.size,
    listing: program.listing.map((l) => ({ line: l.line, address: l.address, bytes: l.bytes, source: l.source })),
  };
}

/** Run an assembled program until it halts or `maxSteps` instructions have executed. */
export function runProgram(program: OctetProgram, maxSteps = 200_000): RunSummary {
  const m = new OctetMachine().load(program);
  const result = m.run(maxSteps);
  return {
    reason: result.reason === 'halted' ? 'halted' : 'max-steps',
    steps: m.steps,
    cycles: m.cycles,
    r: [...m.r],
    pc: m.pc,
    sp: m.sp,
    flags: { z: m.z, c: m.c, n: m.n, v: m.v },
    leds: m.board.leds,
    hex: m.board.hex,
    console: String.fromCharCode(...m.board.consoleOutput),
    ram: [...m.memory.slice(0, 240)],
  };
}

/** A hex dump of the emitted bytes, 8 per row, from the lowest to the highest address used. */
export function hexDump(program: OctetProgram): { address: number; bytes: (number | undefined)[] }[] {
  let lo = 255;
  let hi = -1;
  for (let a = 0; a < 256; a++)
    if (program.used[a]) {
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
  if (hi < 0) return [];
  const rows: { address: number; bytes: (number | undefined)[] }[] = [];
  for (let base = lo - (lo % 8); base <= hi; base += 8) {
    rows.push({ address: base, bytes: Array.from({ length: 8 }, (_, k) => (program.used[base + k] ? program.image[base + k] : undefined)) });
  }
  return rows;
}

export const byteHex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
export { hex2 };
