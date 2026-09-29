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
