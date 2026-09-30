/**
 * Does an edited microprogram still make the machine agree with the interpreter? A persistent gate-level
 * microcoded Octet (at the fast `blocks` level) whose two ROMs are rewritten with `setParam`, exactly as the
 * editor does while the machine runs, and a handful of random programs to check it with.
 */
import { DECODE_TABLE, OctetMachine, assembleOrThrow, compareStates, randomProgram, type OctetProgram } from '$lib/sim/cpu/octet';
import { romContents, ZERO_FIELDS, aluCode } from '../../21-datapath/hardware/control-word';
import { buildCpu, GateCpu } from '../hardware/cpu';
import { Microprogram } from './microprogram';

export interface Verdict {
  ok: boolean;
  /** Programs that agreed, out of `total`. */
  passed: number;
  total: number;
  /** What went wrong first, in words. */
  failure?: string;
}

const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

export class Verifier {
  readonly cpu = buildCpu({ control: 'microcoded', level: 'blocks', memory: 'external' });
  readonly gate: GateCpu;

  constructor() {
    this.gate = new GateCpu(this.cpu);
  }

  /** Write a microprogram into the ROMs. Returns the problem if it does not fit. */
  load(mp: Microprogram): string | undefined {
    let words: number[];
    try {
      words = mp.words();
    } catch (e) {
      return (e as Error).message;
    }
    this.gate.rig.engine.setParam(this.cpu.rom!, 'contents', romContents(words));
    this.gate.rig.engine.setParam(this.cpu.dispatch!, 'contents', romContents(mp.dispatch()));
    return undefined;
  }

  private start(program: OctetProgram | ArrayLike<number>): OctetMachine {
    const ref = new OctetMachine();
    for (const m of [this.gate.memory!, ref]) m.load(program);
    this.gate.reset();
    return ref;
  }

  /** Run the interpreter and the circuit in step; the first difference in words, or undefined. */
  lockstep(program: OctetProgram | ArrayLike<number>, maxInstructions = 400): string | undefined {
    const ref = this.start(program);
    const g = this.gate;
    for (let i = 0; i < maxInstructions && !ref.halted; i++) {
      const pc = ref.pc;
      const first = ref.memory[pc]!;
      const cycles = ref.step();
      for (let k = 0; k < cycles; k++) g.cycle();
      const diff = compareStates(ref.snapshot(), g.state());
      if (diff.length) return `after ${DECODE_TABLE[first]!.mnemonic} (byte 0x${hex(first)}) at address 0x${hex(pc)}: ${diff[0]}`;
    }
    return undefined;
  }

  /** The circuit against the interpreter on random programs. */
  regression(count = 10): Verdict {
    let passed = 0;
    let failure: string | undefined;
    for (let seed = 1; seed <= count; seed++) {
      const { program } = randomProgram(seed * 101, { length: 25 });
      const f = this.lockstep(program);
      if (f === undefined) passed++;
      else failure ??= `Random program ${seed}, ${f}.`;
    }
    return { ok: passed === count, passed, total: count, failure };
  }

  /** Assemble and run a program on the circuit alone, until HLT or `max` cycles. */
  run(source: string, max = 2000): { regs: number[]; flags: { z: boolean; c: boolean; n: boolean; v: boolean }; halted: boolean; cycles: number } {
    this.gate.memory!.load(assembleOrThrow(source));
    this.gate.reset();
    this.gate.run(max);
    return { regs: [0, 1, 2, 3].map((i) => this.gate.r(i)), flags: this.gate.flags(), halted: this.gate.halted, cycles: this.gate.cycles };
  }
}

// ── The exercise: give Octet a DEC instruction, in microcode alone ─────────────────────────────

/** DEC Rd is byte 0000 dd00: `0x04`, `0x08`, `0x0C` (DEC R0 would be 0x00, which is HLT). */
export const DEC_BYTES = [0x04, 0x08, 0x0c];

/** What DEC Rd does: Rd − 1, with the flags of SUB Rd, 1. */
export function decModel(a: number): { r: number; z: boolean; c: boolean; n: boolean; v: boolean } {
  const r = (a - 1) & 255;
  return { r, z: r === 0, c: a === 0, n: (r & 128) !== 0, v: a === 0x80 };
}

/** The reference solution: a two-step routine, borrowing three of the aliases of HLT. */
export function addDec(mp: Microprogram): void {
  const i = mp.addRoutine('DEC', 'DEC');
  mp.setField(i, 0, 'drive', 1); // Rd → bus
  mp.setField(i, 0, 'ldA', 1);
  mp.setField(i, 0, 'end', 0);
  mp.addStep(i);
  mp.setField(i, 1, 'drive', 5); // ALU → bus
  mp.setField(i, 1, 'weR', 1);
  mp.setField(i, 1, 'ldFlags', 1);
  mp.setField(i, 1, 'aluOp', aluCode('SUB'));
  mp.setField(i, 1, 'bsel1', 1);
  mp.setField(i, 1, 'end', 1);
  for (const b of DEC_BYTES) mp.assign(b, 'DEC');
}

export interface DecResult {
  ok: boolean;
  failures: string[];
  tried: number;
}

export function checkDec(v: Verifier): DecResult {
  const failures: string[] = [];
  let tried = 0;
  for (const [k, byte] of DEC_BYTES.entries()) {
    const reg = k + 1;
    for (const x of [5, 0, 1, 0x80, 0x7f, 0xff]) {
      tried++;
      const m = decModel(x);
      const r = v.run(`LDI R${reg}, ${x}\n.byte 0x${hex(byte)}\nHLT\n`);
      const got = r.regs[reg]!;
      const wrong: string[] = [];
      if (!r.halted) wrong.push('did not stop');
      if (got !== m.r) wrong.push(`R${reg} = ${got} (should be ${m.r})`);
      const f = r.flags;
      if (f.z !== m.z || f.c !== m.c || f.n !== m.n || f.v !== m.v) wrong.push(`flags ZCNV = ${+f.z}${+f.c}${+f.n}${+f.v} (should be ${+m.z}${+m.c}${+m.n}${+m.v})`);
      if (r.cycles !== 5 + 5 + 3) wrong.push(`${r.cycles} cycles (should be 13: 5 for the load, 5 for DEC, and the machine stops 3 cycles into HLT)`);
      if (wrong.length) failures.push(`DEC R${reg} with R${reg} = ${x}: ${wrong.join('; ')}`);
    }
  }
  return { ok: failures.length === 0, failures, tried };
}

void ZERO_FIELDS;
