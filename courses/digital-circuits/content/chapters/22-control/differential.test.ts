import { describe, expect, test } from 'vitest';
import {
  DECODE_TABLE,
  OCTET_CONDITIONS,
  OCTET_PROGRAMS,
  OctetMachine,
  assembleOrThrow,
  compareStates,
  randomProgram,
  type OctetProgram,
} from '$lib/sim/cpu/octet';
import { Prng } from '$lib/sim/cpu/common/prng';
import { buildCpu, GateCpu, type ControlKind } from './hardware/cpu';
import { CONTROL_LINES, referenceLines } from '../21-datapath/hardware/control-word';
import type { Level } from '../21-datapath/hardware/hw';

/**
 * The differential test of the gate-level Octet: the circuits of Chapters 21 and 22, running on the digital
 * engine, against the reference interpreter of `src/lib/sim/cpu/octet`.
 *
 * Both machines run the same program. After **every instruction** (the interpreter says how many clock
 * cycles it takes; the circuit is clocked that many times) the registers, the flags, PC, SP, all of memory and
 * the devices must agree, and the circuit must be exactly at the end of the instruction. On the way, every
 * cycle's control lines must equal the microprogram's (`referenceLines`), so that the two control units are
 * also shown to be the same machine, and the engine must have reported nothing worse than a power-up note
 * (no contention, no unsettled loop).
 */

const CONFIGS: { level: Level; control: ControlKind }[] = [
  { level: 'blocks', control: 'hardwired' },
  { level: 'blocks', control: 'microcoded' },
  { level: 'parts', control: 'hardwired' },
  { level: 'parts', control: 'microcoded' },
];

interface RunResult {
  instructions: number;
  cycles: number;
}

/** Load the same program and device inputs into the circuit's memory system and the reference. */
function pair(cpu: GateCpu, program: OctetProgram | ArrayLike<number>) {
  const ref = new OctetMachine();
  for (const m of [cpu.memory!, ref]) {
    m.load(program);
    m.board.switches = 0xa5;
    m.board.buttons = 0b0101;
    m.board.adc = 0x6c;
    m.board.consoleInput.length = 0;
    m.board.type('Q!');
  }
  cpu.reset();
  return ref;
}

/** Run both machines in lockstep, instruction by instruction, checking as described above. */
function lockstep(cpu: GateCpu, ref: OctetMachine, maxInstructions: number, label: string): RunResult {
  let instructions = 0;
  while (!ref.halted && instructions < maxInstructions) {
    const pc = ref.pc;
    const cycles = ref.step();
    const ir = ref.memory[pc]!;
    const conditionTaken = (f: { z: boolean; c: boolean; n: boolean; v: boolean }) => OCTET_CONDITIONS[ir & 0xf]!.test(f);
    for (let k = 0; k < cycles; k++) {
      const flags = cpu.flags();
      const irNow = k >= 3 ? cpu.ir : ir;
      cpu.cycle();
      // The lines that ran in this cycle are what the microprogram says for this step of this instruction.
      const want = referenceLines(k, irNow, conditionTaken(flags));
      const got = cpu.executed;
      const bad = CONTROL_LINES.filter((n) => want[n] !== got[n]);
      if (bad.length) throw new Error(`${label}: instruction ${instructions} at ${pc.toString(16)}, cycle ${k}: lines ${bad.map((n) => `${n}=${got[n]} (want ${want[n]})`).join(', ')}`);
    }
    const diff = compareStates(ref.snapshot(), cpu.state());
    if (diff.length) throw new Error(`${label}: after instruction ${instructions} (${ref.trace.length ? '' : ''}${DECODE_TABLE[ir]!.mnemonic} at 0x${pc.toString(16)}): ${diff.join('; ')}`);
    instructions++;
  }
  const bad = cpu.problems();
  if (bad.length) throw new Error(`${label}: engine messages: ${bad.slice(0, 3).join(' | ')}`);
  return { instructions, cycles: cpu.cycles };
}

describe.each(CONFIGS)('$level $control', ({ level, control }) => {
  const cpu = new GateCpu(buildCpu({ control, level, memory: 'external' }));
  const programs = level === 'blocks' ? 80 : 12;

  test(`agrees with the interpreter after every instruction of ${programs} random programs`, () => {
    let total = 0;
    for (let seed = 1; seed <= programs; seed++) {
      const { program } = randomProgram(seed * 7919 + (control === 'hardwired' ? 1 : 2), { length: level === 'blocks' ? 60 : 30, io: seed % 2 === 0 });
      const ref = pair(cpu, program);
      const r = lockstep(cpu, ref, 2000, `seed ${seed}`);
      expect(ref.halted, `seed ${seed} halts`).toBe(true);
      expect(cpu.halted).toBe(true);
      // The circuit spent exactly the cycles the specification counts.
      expect(cpu.cycles, `seed ${seed} cycles`).toBe(ref.cycles);
      total += r.instructions;
    }
    expect(total).toBeGreaterThan(programs * 20);
  });

  test('every one of the 256 first bytes does what the interpreter does, from random states', () => {
    const rng = new Prng(level === 'blocks' ? 11 : 12);
    const rounds = level === 'blocks' ? 4 : 1;
    for (let round = 0; round < rounds; round++) {
      for (let byte = 0; byte < 256; byte++) {
        // Four loads and an ALU instruction to reach a random state with random flags, then the byte under test.
        const alu = ['ADD R0, R1', 'SUB R2, R3', 'XOR R1, R2', 'AND R3, R0'][rng.int(0, 3)]!;
        const image = assembleOrThrow(
          `LDI R0, ${rng.int(0, 255)}\nLDI R1, ${rng.int(0, 255)}\nLDI R2, ${rng.int(0, 255)}\nLDI R3, ${rng.int(0, 255)}\n${alu}\n.byte ${byte}, ${rng.int(0, 255)}\nHLT\n.org 0x80\n.byte ${rng.int(0, 255)}, ${rng.int(0, 255)}, ${rng.int(0, 255)}, ${rng.int(0, 255)}\n`,
        );
        const ref = pair(cpu, image);
        // The prelude is five instructions; the sixth is the one under test.
        const r = lockstep(cpu, ref, 6, `byte 0x${byte.toString(16)}`);
        expect(r.instructions).toBeGreaterThanOrEqual(6);
      }
    }
  });

  test('the course programs that halt give the same result', () => {
    const ids = level === 'blocks' ? ['multiply', 'fibonacci', 'hello', 'sort'] : ['fibonacci', 'hello'];
    for (const id of ids) {
      const p = OCTET_PROGRAMS.find((x) => x.id === id)!;
      expect(p.halts, id).toBe(true);
      const ref = pair(cpu, assembleOrThrow(p.source, id));
      lockstep(cpu, ref, 100_000, id);
      expect(ref.halted, id).toBe(true);
      expect(cpu.memory!.board.consoleText, id).toBe(ref.board.consoleText);
    }
  });
});
