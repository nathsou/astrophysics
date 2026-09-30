/**
 * Cycles per instruction: run programs on the reference interpreter and count. Octet takes 2 cycles to fetch and 1 to
 * decode every instruction, then 1–5 to execute it, so its CPI is always between 4 and 8; the average depends on the
 * mix of instructions the program uses. The iron law of processor performance follows:
 *
 *   time = instructions × (cycles per instruction) × (seconds per cycle)
 */
import { DECODE_TABLE, OVERHEAD_CYCLES, OctetMachine, assembleOrThrow, type OctetGroup } from '$lib/sim/cpu/octet';
import { rv32i } from '$lib/sim/cpu';
import { programById } from './programs';

export interface Measurement {
  id: string;
  title: string;
  /** Bytes of code and data. */
  bytes: number;
  instructions: number;
  cycles: number;
  /** cycles / instructions. */
  cpi: number;
  /** Cycles spent fetching and decoding (3 for each instruction) and executing. */
  overhead: number;
  execute: number;
  /** Cycles by instruction group. */
  byGroup: Record<OctetGroup, number>;
  /** Instructions by group. */
  countByGroup: Record<OctetGroup, number>;
}

export const MEASURED = ['sum', 'fibonacci', 'hello', 'print-decimal', 'multiply', 'sort'];

export function measure(id: string, setup?: (m: OctetMachine) => void): Measurement {
  const p = programById(id);
  const program = assembleOrThrow(p.source, id);
  const m = new OctetMachine().load(program);
  setup?.(m);
  const byGroup = { system: 0, move: 0, memory: 0, stack: 0, alu: 0, unary: 0, jump: 0 } as Record<OctetGroup, number>;
  const countByGroup = { ...byGroup };
  let guard = 0;
  while (!m.halted && guard++ < 1_000_000) {
    const spec = DECODE_TABLE[m.peek(m.pc)]!;
    byGroup[spec.group] += spec.cycles;
    countByGroup[spec.group]++;
    m.step();
  }
  return {
    id,
    title: p.title,
    bytes: program.size,
    instructions: m.steps,
    cycles: m.cycles,
    cpi: m.cycles / m.steps,
    overhead: OVERHEAD_CYCLES * m.steps,
    execute: m.cycles - OVERHEAD_CYCLES * m.steps,
    byGroup,
    countByGroup,
  };
}

/** Seconds to run `cycles` clock cycles at `hz`. */
export const seconds = (cycles: number, hz: number) => cycles / hz;

/** Instructions per second at a clock of `hz` with the given CPI. */
export const ips = (hz: number, cpi: number) => hz / cpi;

// ---- The same task on RV32I, the course's other CPU (Chapter 31; the interpreter and the programs are in src/lib/sim/cpu/rv32i).

export interface Rv32Measurement {
  id: string;
  /** Bytes of program and data. */
  bytes: number;
  instructions: number;
  cycles: number;
  cpi: number;
}

export function measureRv32(id: string): Rv32Measurement {
  const source = rv32i.rv32Program(id).source;
  const program = rv32i.assembleOrThrow(source, id);
  const m = new rv32i.Rv32Machine();
  m.load(program);
  m.run(1_000_000);
  return { id, bytes: program.size, instructions: m.steps, cycles: m.cycles, cpi: m.cycles / m.steps };
}
