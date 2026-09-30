/**
 * The RV32I core on the board (`designs/rv32-board.dcl` around `content/designs/rv32i.dcl`) on the RTL simulator, and the
 * same core with its register file in block RAM. Both must do what the reference interpreter does with the same program:
 * the devices see the same writes in the same order.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { check, createRtlSim, elaborate, format } from '$lib/hdl';
import { Prng } from '$lib/sim/cpu/common/prng';
import { Rv32Machine, assembleOrThrow } from '$lib/sim/cpu/rv32i';
import { RV32_ROM_WORDS, programWords, rv32BoardSource, wrapperSource, withRom } from './widgets/rv32-board';

const walk = assembleOrThrow(readFileSync(new URL('./programs/rv32-walk.asm', import.meta.url), 'utf8'), 'rv32-walk');

const design = (source: string) => elaborate(check(source).program, 'Rv32Board');

/** Run the board's design for `cycles` clocks, recording every change of the LEDs and of the hex register. */
function trace(source: string, cycles: number, inputs: { sw?: number; btn?: number } = {}) {
  const sim = createRtlSim(design(source));
  sim.set('sw', inputs.sw ?? 0);
  sim.set('btn', inputs.btn ?? 0);
  const leds: number[] = [];
  const hex: number[] = [];
  let l = 0;
  let h = 0;
  let trap = 0;
  for (let i = 0; i < cycles; i++) {
    sim.tick();
    trap = trap || sim.get('trap');
    if (sim.get('led') !== l) leds.push((l = sim.get('led')));
    if (Number(sim.peek('hex')) !== h) hex.push((h = Number(sim.peek('hex'))));
  }
  return { leds, hex, sim, trap };
}

/** What the interpreter says the devices saw, as changes. */
function reference(source: string, steps: number, board: { switches?: number; buttons?: number } = {}) {
  const m = new Rv32Machine();
  m.load(assembleOrThrow(source, 'ref'));
  m.board.switches = board.switches ?? 0;
  m.board.buttons = board.buttons ?? 0;
  const leds: number[] = [];
  const hex: number[] = [];
  m.board.hooks.onLeds = (v) => leds.push(v);
  m.board.hooks.onHex = (v) => hex.push(v);
  for (let i = 0; i < steps && !m.halted; i++) m.step();
  const dedupe = (a: number[]) => a.filter((v, i) => v !== (i ? a[i - 1] : 0));
  return { leds: dedupe(leds), hex: dedupe(hex) };
}

describe('the wrapper', () => {
  test('is in the standard format and compiles with the core, which loses its `top`', () => {
    expect(format(wrapperSource).trim()).toBe(wrapperSource.trim());
    const r = check(rv32BoardSource(walk));
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.diagnostics.filter((d) => d.severity === 'error' || /Rv32Board|program|digit/.test(d.message))).toEqual([]);
  });

  test('the ROM holds a program as `match` arms, and refuses one that is too long', () => {
    expect(withRom(wrapperSource, [0x13, 0, 0x73])).toContain('0 => 0x00000013');
    expect(withRom(wrapperSource, [0x13, 0, 0x73])).not.toMatch(/^    1 => /m);
    expect(withRom(wrapperSource, [0x13, 0, 0x73])).toContain('2 => 0x00000073');
    expect(() => withRom(wrapperSource, new Array(RV32_ROM_WORDS + 1).fill(1))).toThrow(/64 words/);
    expect(programWords(walk)).toHaveLength(walk.instructions);
  });
});

describe('the walking light on the RV32I core', () => {
  test('lights the LEDs in the interpreter’s order and counts its steps on the hex display', () => {
    const want = reference(readFileSync(new URL('./programs/rv32-walk.asm', import.meta.url), 'utf8'), 1500);
    const got = trace(rv32BoardSource(walk), 4000);
    expect(got.leds.slice(0, 30)).toEqual(want.leds.slice(0, 30));
    expect(got.hex.slice(0, 30)).toEqual(want.hex.slice(0, 30));
    expect(got.leds.slice(0, 16)).toEqual([1, 2, 4, 8, 16, 32, 64, 128, 64, 32, 16, 8, 4, 2, 1, 2]);
  });

  test('every instruction takes two clock cycles: one to fetch, one to execute', () => {
    // 5 instructions before the first LED write (li, li, li, jal, sw): the LED lights at the end of the 10th cycle.
    const sim = createRtlSim(design(rv32BoardSource(walk)));
    let first = 0;
    for (let i = 1; i <= 20 && !first; i++) {
      sim.tick();
      if (sim.get('led') !== 0) first = i;
    }
    expect(first).toBe(10);
  });

  test('the switches are read by a load', () => {
    const src = 'lw t0, SWITCHES(zero)\nsw t0, LEDS(zero)\nlw t1, BUTTONS(zero)\nsw t1, HEX(zero)\nebreak\n';
    const p = assembleOrThrow(src, 'io');
    const got = trace(rv32BoardSource(p), 20, { sw: 0xa5, btn: 0b0110 });
    expect(got.leds).toEqual([0xa5]);
    expect(got.hex).toEqual([6]);
    expect(got.trap).toBe(3); // ebreak
  });
});

describe('the register file in block RAM', () => {
  const ops = ['add', 'sub', 'xor', 'or', 'and', 'slt', 'sltu', 'sll', 'srl', 'sra'];
  const opsImm = ['addi', 'xori', 'ori', 'andi', 'slti', 'sltiu'];
  const shiftsImm = ['slli', 'srli', 'srai'];

  /** A dependent chain of arithmetic on x0 to x7, each result shown on the hex display (its low 16 bits). */
  function chain(seed: number): string {
    const rng = new Prng(seed);
    const r = () => `x${rng.int(0, 7)}`;
    const lines = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `lui x${i}, ${rng.int(0, 0xfffff)}`).slice(1);
    for (let i = 0; i < 26; i++) {
      const rd = r();
      const kind = rng.int(0, 2);
      lines.push(kind === 0 ? `${rng.pick(ops)} ${rd}, ${r()}, ${r()}` : kind === 1 ? `${rng.pick(opsImm)} ${rd}, ${r()}, ${rng.int(-2048, 2047)}` : `${rng.pick(shiftsImm)} ${rd}, ${r()}, ${rng.int(0, 31)}`);
      lines.push(`sw ${rd}, HEX(zero)`);
    }
    lines.push('ebreak');
    return lines.join('\n');
  }

  test('has the same effect as the flip-flops, on 25 random chains of dependent instructions, and as the interpreter', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const source = chain(seed);
      const p = assembleOrThrow(source, `chain ${seed}`);
      expect(p.instructions, `chain ${seed}`).toBeLessThanOrEqual(RV32_ROM_WORDS);
      const flops = trace(rv32BoardSource(p), 2 * p.instructions + 4);
      const ram = trace(rv32BoardSource(p, 'block RAM'), 2 * p.instructions + 4);
      const ref = reference(source, 200);
      expect(flops.hex, `chain ${seed}: flip-flops against the interpreter`).toEqual(ref.hex);
      expect(ram.hex, `chain ${seed}: block RAM against the interpreter`).toEqual(ref.hex);
      expect(ram.trap).toBe(3);
    }
  });

  test('the walking light, cycle by cycle, is identical', () => {
    const a = createRtlSim(design(rv32BoardSource(walk)));
    const b = createRtlSim(design(rv32BoardSource(walk, 'block RAM')));
    for (let i = 0; i < 3000; i++) {
      a.tick();
      b.tick();
      for (const n of ['led', 'seg0', 'seg1', 'seg2', 'seg3', 'trap']) if (a.get(n) !== b.get(n)) throw new Error(`${n} differs at cycle ${i + 1}`);
    }
  });
});
