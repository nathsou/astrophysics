import { describe, expect, test } from 'vitest';
import { OctetMachine, assembleOrThrow, compareStates, randomProgram } from '$lib/sim/cpu/octet';
import { Hw } from '../21-datapath/hardware/hw';
import { addDatapath } from '../21-datapath/hardware/datapath';
import { built, Rig } from '../21-datapath/hardware/rig';
import { buildCpu, GateCpu, type ControlKind } from './hardware/cpu';

/**
 * Structure and timing of the gate-level machine: the control units add a few hundred gates (or a ROM), the machine runs
 * correctly with a clock whose half period is only 40 ns (a 12.5 MHz clock, with 1 ns gates) and stops working when
 * the half period is shorter than the bus window, and a machine with its own RAM (as the widgets have) runs a program to
 * the same end as the interpreter.
 */
const GATES = ['not', 'nand', 'nor', 'and', 'or', 'xor', 'xnor', 'buffer'];
const gates = (r: Rig) => r.flat.elements.filter((e) => GATES.includes(e.type)).length;

describe('size', () => {
  const dp = (() => {
    const hw = new Hw('dp', 'parts');
    addDatapath(hw, { memory: 'ram', declareInputs: true });
    return new Rig(built(hw));
  })();
  test('the hardwired control unit adds about 400 gates to the datapath’s 3,100, the microcoded one about 300 and two ROMs', () => {
    const h = new Rig(buildCpu({ control: 'hardwired', level: 'parts', memory: 'ram' }));
    const m = new Rig(buildCpu({ control: 'microcoded', level: 'parts', memory: 'ram' }));
    expect(gates(dp)).toBeGreaterThan(3000);
    expect(gates(h) - gates(dp)).toBeGreaterThan(300);
    expect(gates(h) - gates(dp)).toBeLessThan(500);
    expect(gates(m) - gates(dp)).toBeGreaterThan(200);
    expect(gates(m) - gates(dp)).toBeLessThan(400);
    expect(m.flat.elements.filter((e) => e.type === 'rom')).toHaveLength(2);
    expect(h.flat.elements.filter((e) => e.type === 'rom')).toHaveLength(0);
  });
});

describe('timing', () => {
  const run = (control: ControlKind, halfNs: number) => {
    const g = new GateCpu(buildCpu({ control, level: 'parts', memory: 'external' }), { half: halfNs * 1e-9 });
    for (let seed = 1; seed <= 3; seed++) {
      const { program } = randomProgram(seed * 31, { length: 30 });
      const ref = new OctetMachine().load(program);
      g.memory!.load(program);
      g.reset();
      for (let n = 0; n < 300 && !ref.halted; n++) {
        const c = ref.step();
        for (let k = 0; k < c; k++) g.cycle();
        if (compareStates(ref.snapshot(), g.state()).length || g.problems().length) return false;
      }
    }
    return true;
  };
  test.each(['hardwired', 'microcoded'] as const)('the %s machine works with a 40 ns half period', (control) => {
    expect(run(control, 40)).toBe(true);
  });
  test('and cannot work when the half period is shorter than the bus window opens (12 ns)', () => {
    expect(run('hardwired', 8)).toBe(false);
  });
});

describe('a machine with its own RAM', () => {
  test.each(['hardwired', 'microcoded'] as const)('%s: the sum program leaves 15 in R0 and at 0x80, in 110 cycles', (control) => {
    const g = new GateCpu(buildCpu({ control, level: 'blocks', memory: 'ram' }));
    const src = 'LDI R0, 0\nLDI R1, 5\nLDI R2, 1\nloop:\n  ADD R0, R1\n  SUB R1, R2\n  JNZ loop\nST [0x80], R0\nHLT\n';
    const p = assembleOrThrow(src);
    for (let a = 0; a < 0xf0; a++) g.rig.poke(a, p.image[a] ?? 0);
    g.reset();
    const ref = new OctetMachine().load(p);
    ref.run();
    g.run(1000);
    expect(g.halted).toBe(true);
    expect(g.r(0)).toBe(15);
    expect(g.rig.peek(0x80)).toBe(15);
    // The machine stops as the HLT is about to run its last cycle.
    expect(g.cycles).toBe(ref.cycles - 1);
    expect(ref.cycles).toBe(110);
  });
});
