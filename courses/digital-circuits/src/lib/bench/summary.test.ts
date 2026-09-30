import { describe, expect, it } from 'vitest';
import { describeOutputs } from './summary';
import { connect } from '../sim/netlist/connect';
import '../sim/netlist/catalog';
import type { Circuit } from '../sim/netlist/types';
import type { Engine } from '../sim/engine';

const circuit: Circuit = {
  version: 1,
  components: [
    { id: 'A', type: 'toggle', x: 0, y: 0 },
    { id: 'S', type: 'indicator', x: 6, y: 0, label: 'Sum' },
    { id: 'P', type: 'probe', x: 6, y: 4 },
    { id: 'L', type: 'lamp', x: 0, y: 8 },
    { id: 'H', type: 'hex-display', x: 12, y: 0 },
  ],
  wires: [{ points: [[3, 0], [6, 0]] }],
};

const engine = {
  netlist: { netCount: 10, netNames: [], elements: [] },
  logic: (n: number) => (n === 0 ? 1 : 3),
  voltage: () => 0,
  current: () => 0,
  state: (id: string) => (id === 'L' ? { brightness: 0.4 } : id === 'H' ? { value: 11 } : {}),
} as unknown as Engine;

describe('describeOutputs', () => {
  it('names each output by label or id and skips inputs', () => {
    const conn = connect(circuit);
    const text = describeOutputs(circuit, conn, engine);
    expect(text).toContain('Sum: on');
    expect(text).toContain('P: Z');
    expect(text).toContain('L: dim');
    expect(text).toContain('H: B');
    expect(text).not.toContain('A:');
  });
});

describe('meters read what they display', () => {
  const meters: Circuit = {
    version: 1,
    components: [
      { id: 'V1', type: 'voltmeter', x: 0, y: 0 },
      { id: 'A1', type: 'ammeter', x: 0, y: 8 },
    ],
    wires: [],
  };
  // The solver's leakage: picoamps and picovolts on an open circuit.
  const leaky = (state: (id: string) => Record<string, number>) =>
    ({
      netlist: { netCount: 4, netNames: [], elements: [] },
      logic: () => 0,
      voltage: (n: number) => (n === 0 ? 1e-10 : 0),
      current: () => 3.9e-12,
      state,
    }) as unknown as Engine;
  const conn = connect(meters);
  const say = (e: Engine) => describeOutputs(meters, conn, e);

  it('says zero, not picoamps, below the meters\' floors (1 nA, 1 µV) when the engine gives the displayed value', () => {
    const text = say(leaky(() => ({ value: 0 })));
    expect(text).toBe('V1: 0.00\u00a0V. A1: 0.00\u00a0A');
    expect(text).not.toMatch(/pA|pV|nV/);
  });
  it('applies the same floors itself when the engine has no meter state', () => {
    const text = say(leaky(() => ({})));
    expect(text).not.toMatch(/pA|pV|nV/);
    expect(text).toContain('A1: 0.00\u00a0A');
  });
  it('still reads real values, including one exactly at the floor', () => {
    expect(say(leaky((id) => ({ value: id === 'V1' ? 3.3 : 1e-9 })))).toBe('V1: 3.30\u00a0V. A1: 1.00\u00a0nA');
    const noState = { ...leaky(() => ({})), current: () => 2.5e-3 } as unknown as Engine;
    expect(say(noState)).toContain('A1: 2.50\u00a0mA');
  });
});
