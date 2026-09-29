import { describe, expect, test } from 'vitest';
import { flatten } from '../sim/netlist/flatten';
import { connect } from '../sim/netlist/connect';
import type { Circuit } from '../sim/netlist/types';
import { createStubEngine } from './stub';
import { resolveTraces } from './traces';
import { logicAttr, voltageColour, voltageRange } from './colour';

const halfAdder: Circuit = {
  version: 1,
  engine: 'digital',
  components: [
    { id: 'A', type: 'toggle', x: 0, y: 0 },
    { id: 'B', type: 'toggle', x: 0, y: 2 },
    { id: 'X1', type: 'xor', x: 6, y: 0 },
    { id: 'S', type: 'indicator', x: 14, y: 1 },
  ],
  wires: [
    { points: [[3, 0], [6, 0]] },
    { points: [[3, 2], [6, 2]] },
    { points: [[12, 1], [14, 1]] },
  ],
};

const ring: Circuit = {
  version: 1,
  engine: 'digital',
  components: [
    { id: 'U1', type: 'not', x: 0, y: 0 },
    { id: 'U2', type: 'not', x: 7, y: 0 },
    { id: 'U3', type: 'not', x: 14, y: 0 },
  ],
  wires: [
    { points: [[5, 0], [7, 0]] },
    { points: [[12, 0], [14, 0]] },
    { points: [[19, 0], [20, 0], [20, 3], [-1, 3], [-1, 0], [0, 0]] },
  ],
};

describe('stub engine', () => {
  test('evaluates gates after a delay', () => {
    const flat = flatten(halfAdder);
    const e = createStubEngine(flat);
    const k = connect(halfAdder);
    const s = k.pinNet.get('S.A')!;
    expect(e.logic(s)).toBe(0);
    e.setParam('A', 'on', true);
    expect(e.logic(s)).toBe(0);
    e.advance(2e-9);
    expect(e.logic(s)).toBe(1);
    expect(e.state('S').brightness).toBe(1);
    e.setParam('B', 'on', true);
    e.advance(2e-9);
    expect(e.logic(s)).toBe(0);
  });

  test('a ring of three inverters oscillates with a period of six delays', () => {
    const e = createStubEngine(flatten(ring));
    const k = connect(ring);
    const n = k.pinNet.get('U1.A')!;
    const rec = e.watch([n]);
    e.advance(30e-9);
    const t = rec.times();
    const v = rec.values()[0]!;
    const rises = [...t].filter((_, i) => i > 0 && v[i] === 1 && v[i - 1] === 0);
    expect(rises.length).toBeGreaterThanOrEqual(3);
    expect(rises[2]! - rises[1]!).toBeCloseTo(6e-9, 12);
    rec.trim(10e-9);
    expect(rec.times()[0]!).toBeGreaterThan(15e-9);
  });

  test('analog stub mirrors switch parameters', () => {
    const c: Circuit = { version: 1, engine: 'analog', components: [{ id: 'S1', type: 'switch', x: 0, y: 0 }], wires: [] };
    const e = createStubEngine(flatten(c), { kind: 'analog' });
    expect(e.state('S1').closed).toBe(false);
    e.setParam('S1', 'closed', true);
    expect(e.state('S1').closed).toBe(true);
    expect(e.voltage(0)).toBe(0);
  });
});

describe('traces and colours', () => {
  test('trace names resolve to nets', () => {
    const k = connect(halfAdder);
    const { traces, missing } = resolveTraces('A, B, S, X1.Y, nope', halfAdder, k);
    expect(traces.map((t) => t.name)).toEqual(['A', 'B', 'S', 'X1.Y']);
    expect(traces[2]!.net).toBe(traces[3]!.net);
    expect(missing).toEqual(['nope']);
  });
  test('logic attributes and the voltage scale', () => {
    expect([0, 1, 2, 3].map(logicAttr)).toEqual(['0', '1', 'x', 'z']);
    expect(voltageColour(0, 9)).toBe('var(--_v0)');
    expect(voltageColour(9, 9)).toBe('var(--_vp)');
    expect(voltageColour(-20, 9)).toBe('var(--_vn)');
    expect(voltageColour(4.5, 9)).toBe('color-mix(in oklab, var(--_vp) 50%, var(--_v0))');
    expect(voltageColour(NaN, 9)).toBe('var(--_z)');
    expect(voltageRange({ version: 1, components: [{ id: 'B', type: 'battery', x: 0, y: 0, params: { voltage: 12 } }], wires: [] })).toBe(12);
    expect(voltageRange({ version: 1, components: [], wires: [] })).toBe(5);
  });
});
