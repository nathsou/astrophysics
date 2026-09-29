import { describe, expect, test } from 'vitest';
import type { Circuit } from './types';
import { connect } from './connect';
import { flatten } from './flatten';
import { transformPoint } from './catalog';

const nandGate = (id: string, x: number, y: number) => ({ id, type: 'nand', x, y });

describe('transformPoint', () => {
  test('rotates clockwise on screen (y down)', () => {
    expect(transformPoint({ x: 1, y: 0 }, { x: 0, y: 0, rot: 90 })).toEqual([0, 1]);
    expect(transformPoint({ x: 1, y: 0 }, { x: 0, y: 0, rot: 180 })).toEqual([-1, 0]);
    expect(transformPoint({ x: 1, y: 0 }, { x: 10, y: 5, rot: 270 })).toEqual([10, 4]);
  });
  test('flips before rotating', () => {
    expect(transformPoint({ x: 2, y: 1 }, { x: 0, y: 0, flip: true })).toEqual([-2, 1]);
    expect(transformPoint({ x: 2, y: 0 }, { x: 0, y: 0, flip: true, rot: 90 })).toEqual([0, -2]);
  });
});

describe('connect', () => {
  test('a wire joins the pins at its ends; crossing wires do not connect', () => {
    const c: Circuit = {
      version: 1,
      components: [
        { id: 'S1', type: 'toggle', x: 0, y: 0 },
        { id: 'L1', type: 'indicator', x: 10, y: 0 },
        { id: 'S2', type: 'toggle', x: 0, y: 4 },
        { id: 'L2', type: 'indicator', x: 10, y: 4 },
      ],
      wires: [
        { points: [[3, 0], [10, 0]] },
        { points: [[3, 4], [10, 4]] },
        // A vertical wire crossing both, with no vertex on them.
        { points: [[6, -2], [6, 6]] },
      ],
    };
    const k = connect(c);
    expect(k.pinNet.get('S1.Y')).toBe(k.pinNet.get('L1.A'));
    expect(k.pinNet.get('S2.Y')).toBe(k.pinNet.get('L2.A'));
    expect(k.pinNet.get('S1.Y')).not.toBe(k.pinNet.get('S2.Y'));
    expect(k.wireNet[2]).not.toBe(k.wireNet[0]);
    expect(k.junctions).toEqual([]);
  });

  test('a wire ending on another wire makes a T-junction with a dot', () => {
    const c: Circuit = {
      version: 1,
      components: [
        { id: 'S', type: 'toggle', x: 0, y: 0 },
        { id: 'A', type: 'indicator', x: 10, y: 0 },
        { id: 'B', type: 'indicator', x: 10, y: 4 },
      ],
      wires: [
        { points: [[3, 0], [10, 0]] },
        { points: [[6, 0], [6, 4], [10, 4]] },
      ],
    };
    const k = connect(c);
    expect(k.pinNet.get('B.A')).toBe(k.pinNet.get('S.Y'));
    expect(k.junctions).toEqual([[6, 0]]);
    expect(k.unconnected).toEqual([]);
  });

  test('labels, grounds and equal rails connect without wires', () => {
    const c: Circuit = {
      version: 1,
      components: [
        { id: 'L1', type: 'label', x: 0, y: 0, params: { name: 'CLK' } },
        { id: 'L2', type: 'label', x: 20, y: 20, params: { name: 'CLK' } },
        { id: 'G1', type: 'ground', x: 0, y: 10 },
        { id: 'G2', type: 'ground', x: 30, y: 10 },
        { id: 'V1', type: 'rail', x: 5, y: 5, params: { voltage: 5 } },
        { id: 'V2', type: 'rail', x: 9, y: 9, params: { voltage: 5 } },
        { id: 'V3', type: 'rail', x: 13, y: 13, params: { voltage: 3.3 } },
      ],
      wires: [],
    };
    const k = connect(c);
    expect(k.pinNet.get('L1.n')).toBe(k.pinNet.get('L2.n'));
    expect(k.pinNet.get('G1.g')).toBe(k.pinNet.get('G2.g'));
    expect(k.pinNet.get('V1.v')).toBe(k.pinNet.get('V2.v'));
    expect(k.pinNet.get('V1.v')).not.toBe(k.pinNet.get('V3.v'));
    expect(k.netNames[k.pinNet.get('L1.n')!]).toBe('CLK');
    expect(k.netNames[k.pinNet.get('G1.g')!]).toBe('GND');
  });

  test('unconnected pins are reported', () => {
    const c: Circuit = { version: 1, components: [nandGate('U1', 0, 0)], wires: [] };
    expect(connect(c).unconnected.sort()).toEqual(['U1.A', 'U1.B', 'U1.Y']);
  });
});

describe('flatten', () => {
  // XOR from four NANDs, as a subcircuit with ports A, B (in) and Y (out).
  const xor: Circuit = {
    version: 1,
    title: 'XOR',
    components: [
      { id: 'PA', type: 'port', x: 0, y: 0, params: { name: 'A', dir: 'in' } },
      { id: 'PB', type: 'port', x: 0, y: 2, params: { name: 'B', dir: 'in' } },
      { id: 'PY', type: 'port', x: 40, y: 1, params: { name: 'Y', dir: 'out' } },
      nandGate('N1', 10, 0),
      nandGate('N2', 20, -4),
      nandGate('N3', 20, 4),
      nandGate('N4', 30, 0),
    ],
    wires: [
      // A → N1.A, N2.A ; B → N1.B, N3.B
      { points: [[0, 0], [10, 0]] },
      { points: [[5, 0], [5, -4], [20, -4]] },
      { points: [[0, 2], [10, 2]] },
      { points: [[7, 2], [7, 6], [20, 6]] },
      // N1.Y (16,1) → N2.B (20,-2), N3.A (20,4)
      { points: [[16, 1], [18, 1], [18, -2], [20, -2]] },
      { points: [[18, 1], [18, 4], [20, 4]] },
      // N2.Y (26,-3) → N4.A (30,0) ; N3.Y (26,5) → N4.B (30,2)
      { points: [[26, -3], [28, -3], [28, 0], [30, 0]] },
      { points: [[26, 5], [28, 5], [28, 2], [30, 2]] },
      // N4.Y (36,1) → Y
      { points: [[36, 1], [40, 1]] },
    ],
  };

  test('inlines subcircuits with hierarchical ids and shared port nets', () => {
    const top: Circuit = {
      version: 1,
      subcircuits: { xor },
      components: [
        { id: 'SA', type: 'toggle', x: -10, y: 0 },
        { id: 'SB', type: 'toggle', x: -10, y: 2 },
        { id: 'X1', type: 'sub:xor', x: 0, y: 0 },
        { id: 'OUT', type: 'indicator', x: 20, y: 0 },
      ],
      wires: [
        { points: [[-7, 0], [0, 0]] },
        { points: [[-7, 2], [0, 2]] },
        // The block is 6 wide: Y is at (6, 0).
        { points: [[6, 0], [20, 0]] },
      ],
    };
    const flat = flatten(top);
    const ids = flat.elements.map((e) => e.id).sort();
    expect(ids).toEqual(['OUT', 'SA', 'SB', 'X1/N1', 'X1/N2', 'X1/N3', 'X1/N4']);
    const el = (id: string) => flat.elements.find((e) => e.id === id)!;
    expect(el('X1/N1').pins[0]).toBe(el('SA').pins[0]);
    expect(el('X1/N1').pins[1]).toBe(el('SB').pins[0]);
    expect(el('X1/N4').pins[2]).toBe(el('OUT').pins[0]);
    expect(el('X1/N2').pins[1]).toBe(el('X1/N1').pins[2]);
    // Top-level nets keep connect()'s numbering.
    const k = connect(top);
    expect(el('OUT').pins[0]).toBe(k.pinNet.get('OUT.A'));
  });

  test('ground inside a subcircuit is the global ground', () => {
    const sub: Circuit = {
      version: 1,
      components: [
        { id: 'P', type: 'port', x: 0, y: 0, params: { name: 'A' } },
        { id: 'G', type: 'ground', x: 4, y: 0 },
        { id: 'L', type: 'indicator', x: 0, y: 0 },
      ],
      wires: [],
    };
    const top: Circuit = {
      version: 1,
      subcircuits: { s: sub },
      components: [
        { id: 'G0', type: 'ground', x: 50, y: 50 },
        { id: 'U', type: 'sub:s', x: 0, y: 0 },
        { id: 'T', type: 'toggle', x: -3, y: 0 },
      ],
      wires: [],
    };
    const flat = flatten(top);
    expect(flat.ground).toBeDefined();
    expect(flat.elements.find((e) => e.id === 'U/L')!.pins[0]).toBe(flat.elements.find((e) => e.id === 'T')!.pins[0]);
  });
});
