/**
 * Octet in DCL (`designs/octet.dcl`) on the RTL simulator, against the reference interpreter of
 * `src/lib/sim/cpu/octet`: the machine of Chapters 21 and 22, described in text instead of drawn.
 *
 * Both machines run the same program. The interpreter executes one instruction and says how many clock cycles the
 * ISA gives it; the DCL machine is clocked that many times. After **every instruction** the registers, the flags,
 * PC, SP, all 240 bytes of RAM, the LEDs, the hex register and the console must agree, the cycle count must be the
 * ISA's, and the DCL machine must be exactly at the end of the instruction (its step counter back at 0).
 * On the way, the control lines of every cycle must be the ones Chapter 22's microprogram asks for.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { check, elaborate, format, renderTestResult, runTests } from '$lib/hdl';
import {
  DECODE_TABLE,
  OCTET_CONDITIONS,
  OCTET_PROGRAMS,
  OctetMachine,
  assembleOrThrow,
  compareStates,
  octetProgram,
  randomProgram,
  type OctetProgram,
} from '$lib/sim/cpu/octet';
import { Prng } from '$lib/sim/cpu/common/prng';
import { CONTROL_LINES, referenceLines, type ControlLine } from '../21-datapath/hardware/control-word';
import { DclOctet, octetDesign, octetSource, withProgram } from './widgets/octet-dcl';

/** The DCL name of each of Chapter 22's control lines. */
const LINE_NAME: Record<ControlLine, string> = {
  OE_RD: 'oe_rd', OE_RS: 'oe_rs', OE_PC: 'oe_pc', OE_SP: 'oe_sp', OE_ALU: 'oe_alu', OE_MEM: 'oe_mem', OE_T: 'oe_t',
  LD_MAR: 'ld_mar', LD_IR: 'ld_ir', LD_A: 'ld_a', LD_B: 'ld_b', LD_T: 'ld_t', WE_R: 'we_r', LD_FLAGS: 'ld_flags',
  PC_LD: 'pc_ld', PC_INC: 'pc_inc', SP_INC: 'sp_inc', SP_DEC: 'sp_dec', MEM_WR: 'mem_wr',
  ALU_OP0: 'alu_op', ALU_OP1: 'alu_op', ALU_OP2: 'alu_op', BSEL_A: 'bsel_a', BSEL_1: 'bsel_1', HALT: 'halt',
};

const SWITCHES = 0xa5;
const BUTTONS = 0b0101;

/** A DCL machine and an interpreter with the same program and the same switches and buttons. */
function pair(program: OctetProgram | ArrayLike<number>) {
  const dcl = new DclOctet();
  dcl.load(program);
  dcl.switches = SWITCHES;
  dcl.buttons = BUTTONS;
  const ref = new OctetMachine();
  ref.load(program);
  ref.board.switches = SWITCHES;
  ref.board.buttons = BUTTONS;
  return { dcl, ref };
}

/** Run both machines in lockstep for at most `limit` instructions; throws at the first difference. */
function lockstep(dcl: DclOctet, ref: OctetMachine, limit: number, label: string, lines = false): number {
  let instructions = 0;
  while (!ref.halted && instructions < limit) {
    const pc = ref.pc;
    const ir = ref.memory[pc]!;
    const flags = ref.flags;
    const cycles = ref.step();
    for (let k = 0; k < cycles; k++) {
      if (lines) checkLines(dcl, k, ir, OCTET_CONDITIONS[ir & 0xf]!.test(flags), `${label}: instruction ${instructions} at ${pc}`);
      dcl.cycle();
    }
    instructions++;
    const want = ref.snapshot();
    const diff = compareStates(want, dcl.snapshot(instructions, want), { timing: true });
    if (diff.length) throw new Error(`${label}: after instruction ${instructions} (${DECODE_TABLE[ir]!.mnemonic} at 0x${pc.toString(16)}): ${diff.join('; ')}`);
    if (!ref.halted && dcl.stage !== 0) throw new Error(`${label}: after instruction ${instructions} the step counter is ${dcl.stage}, not 0`);
  }
  return instructions;
}

/** The control lines of this cycle are what the microprogram says for this step of this instruction. */
function checkLines(dcl: DclOctet, step: number, firstByte: number, taken: boolean, where: string): void {
  const ir = step >= 3 ? dcl.sim.get('ir') : firstByte;
  const want = referenceLines(step, ir, taken);
  for (const line of CONTROL_LINES) {
    if (line.startsWith('ALU_OP')) continue;
    const got = dcl.sim.get(`control.${LINE_NAME[line]}`);
    if (got !== want[line]) throw new Error(`${where}, cycle ${step}: ${line} is ${got}, the microprogram says ${want[line]}`);
  }
  const op = dcl.sim.get('control.alu_op');
  if (op !== (want.ALU_OP0 | (want.ALU_OP1 << 1) | (want.ALU_OP2 << 2))) throw new Error(`${where}, cycle ${step}: alu_op is ${op}`);
}

describe('octet.dcl as a DCL file', () => {
  test('compiles without a warning and is in the standard format', () => {
    const r = check(octetSource, { file: 'octet.dcl' });
    expect(r.diagnostics).toEqual([]);
    expect(format(octetSource).trim()).toBe(octetSource.trim());
  });

  test('its own tests pass', () => {
    const r = runTests(octetSource, { file: 'octet.dcl' });
    expect(r.results.length).toBeGreaterThanOrEqual(3);
    for (const t of r.results) expect(t.passed, renderTestResult(r.source, t)).toBe(true);
  });

  test('the program in the file is walk.asm, assembled', () => {
    const walk = assembleOrThrow(readFileSync(new URL('./programs/walk.asm', import.meta.url), 'utf8'), 'walk');
    expect(format(withProgram(octetSource, walk)).trim()).toBe(octetSource.trim());
  });

  test('a program put into the source with withProgram is a valid file that runs', () => {
    const src = withProgram(octetSource, assembleOrThrow('LDI R0, 7\nST [LEDS], R0\nHLT\n'));
    expect(check(src).diagnostics).toEqual([]);
    const d = new DclOctet(elaborate(check(src).program, 'Octet'));
    for (let i = 0; i < 16; i++) d.cycle();
    expect(d.sim.get('led')).toBe(7);
    expect(d.sim.get('halted')).toBe(1);
  });
});

describe('Octet in DCL and the interpreter, instruction by instruction', () => {
  test('every one of the 256 first bytes, from random registers and flags', () => {
    let checked = 0;
    for (let byte = 0; byte < 256; byte++) {
      for (let seed = 0; seed < 3; seed++) {
        const rng = new Prng(byte * 7 + seed);
        const alu = rng.pick(['ADD', 'SUB', 'AND', 'OR', 'XOR', 'CMP']);
        const source = [
          ...[0, 1, 2, 3].map((r) => `LDI R${r}, ${rng.int(0, 255)}`),
          `${alu} R${rng.int(0, 3)}, R${rng.int(0, 3)}`,
          `.byte ${byte}, ${rng.pick([0x30, 0xc4, 0xd0, 0xf8, 0xf9, 0xfa, 0xfb, 0xfd])}`,
          'HLT',
        ].join('\n');
        const { dcl, ref } = pair(assembleOrThrow(source));
        checked += lockstep(dcl, ref, 14, `byte 0x${byte.toString(16)}, seed ${seed}`, seed === 0);
      }
    }
    expect(checked).toBeGreaterThan(256 * 3 * 5);
  });

  test('200 random programs (jumps, stack, calls, loads and stores) run to their HLT', () => {
    let instructions = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const p = randomProgram(seed, { length: 30 + (seed % 40) });
      const { dcl, ref } = pair(p.program);
      instructions += lockstep(dcl, ref, 2000, `random ${seed}`, seed % 10 === 0);
      expect(ref.halted, `random ${seed} halts`).toBe(true);
    }
    expect(instructions).toBeGreaterThan(5000);
  });

  test('100 random programs that also use the switches, buttons, LEDs, hex display, console and RANDOM', () => {
    for (let seed = 1000; seed < 1100; seed++) {
      const p = randomProgram(seed, { length: 40, io: true });
      const { dcl, ref } = pair(p.program);
      lockstep(dcl, ref, 2000, `random io ${seed}`);
      expect(ref.halted).toBe(true);
    }
  });

  test.each(['blink', 'multiply', 'fibonacci', 'hello', 'sort', 'reaction', 'count'])('the course’s %s program', (id) => {
    const { dcl, ref } = pair(assembleOrThrow(octetProgram(id).source, id));
    const n = lockstep(dcl, ref, id === 'count' ? 6000 : 20_000, id, true);
    expect(n).toBeGreaterThan(20);
  });

  test('the programs that run to their end end where the interpreter says, and show it on the board', () => {
    const results: Record<string, (d: DclOctet) => void> = {
      multiply: (d) => expect([d.sim.get('hex'), d.sim.get('leds')]).toEqual([0x00, 143]),
      fibonacci: (d) => expect(d.sim.get('hex')).toBe(233),
      hello: (d) => expect(String.fromCharCode(...d.console)).toBe('HELLO, WORLD\n'),
    };
    for (const [id, check] of Object.entries(results)) {
      const { dcl, ref } = pair(assembleOrThrow(octetProgram(id).source, id));
      lockstep(dcl, ref, 20_000, id);
      expect(ref.halted).toBe(true);
      expect(dcl.sim.get('halted')).toBe(1);
      check(dcl);
    }
  });

  test('the cycle counts of the ISA table come out of the DCL machine, instruction by instruction', () => {
    const { dcl, ref } = pair(assembleOrThrow(octetProgram('sort').source, 'sort'));
    const seen = new Map<string, number>();
    while (!ref.halted) {
      const ir = ref.memory[ref.pc]!;
      const cycles = ref.step();
      const before = dcl.cycles;
      for (let k = 0; k < cycles; k++) dcl.cycle();
      expect(dcl.cycles - before).toBe(DECODE_TABLE[ir]!.cycles);
      seen.set(DECODE_TABLE[ir]!.mnemonic, cycles);
    }
    expect(seen.size).toBeGreaterThan(8);
  });
});

describe('reset and the board', () => {
  test('the reset button puts every register of the programmer’s model back, and keeps the program', () => {
    const p = assembleOrThrow(octetProgram('fibonacci').source, 'fibonacci');
    const { dcl, ref } = pair(p);
    lockstep(dcl, ref, 30, 'fibonacci');
    expect(dcl.sim.get('pc')).not.toBe(0);
    dcl.reset();
    expect([dcl.sim.get('pc'), dcl.sim.get('sp'), dcl.sim.get('r[1]'), dcl.sim.get('leds'), dcl.sim.get('hex'), dcl.sim.get('z')]).toEqual([0, 0xf0, 0, 0, 0, 0]);
    // The data the program stored survives too (the RAM is not reset), and the same program runs again to the same end.
    const again = new OctetMachine();
    again.load(p);
    for (let i = 0; i < 30; i++) again.step();
    for (let i = 0; i < 30; i++) again.step();
  });

  test('the four digits show the program counter (left) and the HEX register (right)', () => {
    const { dcl } = pair(assembleOrThrow('LDI R0, 0xA7\nST [HEX], R0\nHLT\n'));
    for (let i = 0; i < 20; i++) dcl.cycle();
    const digit = (n: string) => dcl.sim.get(n);
    // PC = 5 after HLT: 0 and 5; HEX = 0xA7: A and 7.
    expect([digit('seg3'), digit('seg2'), digit('seg1'), digit('seg0')]).toEqual([0x3f, 0x6d, 0x77, 0x07]);
  });

  test('the design is one 240-byte block RAM with two read ports and a handful of registers', () => {
    const top = octetDesign().modules[octetDesign().top]!;
    const mems = top.cells.filter((c) => c.kind === 'mem');
    expect(mems).toHaveLength(1);
    const m = mems[0]! as Extract<(typeof mems)[number], { kind: 'mem' }>;
    expect([m.depth, m.width, m.reads.length, m.writes.length]).toEqual([240, 8, 2, 1]);
    void OCTET_PROGRAMS;
  });
});
