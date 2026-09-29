import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { connect } from '../netlist/connect';
import { flatten } from '../netlist/flatten';
import type { Circuit } from '../netlist/types';

/** Circuits drawn on the grid, connected and flattened by the netlist module, then simulated. */
describe('drawn circuits', () => {
  // Battery (− at x = 0, + at x = 4), R1 from + to the middle (x = 8), R2 from the middle to ground (x = 12).
  const divider: Circuit = {
    version: 1,
    components: [
      { id: 'B', type: 'battery', x: 0, y: 0, params: { voltage: 9, resistance: 0.001 } },
      { id: 'R1', type: 'resistor', x: 4, y: 0, params: { resistance: 2000 } },
      { id: 'R2', type: 'resistor', x: 8, y: 0, params: { resistance: 1000 } },
      { id: 'G', type: 'ground', x: 0, y: 4 },
      { id: 'G2', type: 'ground', x: 12, y: 4 },
    ],
    wires: [
      { points: [[0, 0], [0, 4]] },
      { points: [[12, 0], [12, 4]] },
    ],
  };

  test('a divider from connect() and flatten() has the expected voltages', () => {
    const conn = connect(divider);
    const flat = flatten(divider);
    const e = createAnalogEngine(flat);
    // The middle node is where R1 pin 2 and R2 pin 1 meet (x = 8).
    const mid = conn.pinNet.get('R2.1')!;
    expect(mid).toBe(conn.pinNet.get('R1.2'));
    expect(e.voltage(mid)).toBeCloseTo(3, 2);
    expect(e.voltage(conn.pinNet.get('R1.1')!)).toBeCloseTo(9, 2);
    expect(e.current('R1', 0)).toBeCloseTo(3e-3, 5);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });

  test('a subcircuit with a port tied to ground still gives voltages at the merged nets', () => {
    const sub: Circuit = {
      version: 1,
      components: [
        { id: 'P', type: 'port', x: 0, y: 0, params: { name: 'A' } },
        { id: 'G', type: 'ground', x: 0, y: 0 },
      ],
      wires: [],
    };
    const top: Circuit = {
      version: 1,
      subcircuits: { s: sub },
      components: [
        { id: 'V', type: 'rail', x: 0, y: -6, params: { voltage: 5 } },
        { id: 'R', type: 'resistor', x: 0, y: 0, params: { resistance: 1000 } },
        { id: 'U', type: 'sub:s', x: 4, y: 0 },
      ],
      wires: [{ points: [[0, -6], [0, 0]] }],
    };
    const flat = flatten(top);
    const conn = connect(top);
    const e = createAnalogEngine(flat);
    // R's pin 1 is on the rail (5 V); its pin 2 was joined to U's port A, which is grounded inside.
    expect(e.voltage(conn.pinNet.get('R.1')!)).toBeCloseTo(5, 6);
    expect(e.voltage(conn.pinNet.get('R.2')!)).toBeCloseTo(0, 6);
    expect(e.current('R', 0)).toBeCloseTo(5e-3, 6);
  });
});
