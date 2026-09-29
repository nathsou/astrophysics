import { describe, expect, test } from 'vitest';
import { buildWireGraph, dotSpeed, solveEdgeCurrents, type PinRef } from './currents';
import type { Wire } from '../sim/netlist/types';

/** Current along the section that contains grid point (x, y) strictly inside or as its start. */
function currentAt(graph: ReturnType<typeof buildWireGraph>, cur: Float64Array, from: [number, number], to: [number, number]): number {
  const i = graph.edges.findIndex((e) => {
    const a = e.points[0]!;
    const b = e.points[e.points.length - 1]!;
    return (a[0] === from[0] && a[1] === from[1] && b[0] === to[0] && b[1] === to[1]) || (a[0] === to[0] && a[1] === to[1] && b[0] === from[0] && b[1] === from[1]);
  });
  if (i < 0) throw new Error(`no section ${from} → ${to}`);
  const e = graph.edges[i]!;
  const forward = e.points[0]![0] === from[0] && e.points[0]![1] === from[1];
  return forward ? cur[i]! : -cur[i]!;
}

describe('wire currents', () => {
  test('a single wire carries the current from one pin to the other', () => {
    // A battery's + pin at (0,0) pushes 2 mA into the wire (current into the pin is −2 mA);
    // a resistor's pin at (10,0) draws it (current into the pin is +2 mA).
    const wires: Wire[] = [{ points: [[0, 0], [5, 0], [5, 3], [10, 3]] }];
    const pins: PinRef[] = [
      { key: 'B.+', x: 0, y: 0, net: 0 },
      { key: 'R.1', x: 10, y: 3, net: 0 },
    ];
    const g = buildWireGraph(wires, [0], pins);
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]!.points).toEqual([[0, 0], [5, 0], [5, 3], [10, 3]]);
    const cur = solveEdgeCurrents(g, g.pins.map((p) => (p.key === 'B.+' ? -0.002 : 0.002)));
    expect(currentAt(g, cur, [0, 0], [10, 3])).toBeCloseTo(0.002);
  });

  test('a T-junction splits the current (Kirchhoff)', () => {
    // Source at (0,0) supplies 3 A; loads at (10,0) take 1 A and (5,5) take 2 A.
    const wires: Wire[] = [{ points: [[0, 0], [10, 0]] }, { points: [[5, 0], [5, 5]] }];
    const pins: PinRef[] = [
      { key: 'S.p', x: 0, y: 0, net: 0 },
      { key: 'L1.p', x: 10, y: 0, net: 0 },
      { key: 'L2.p', x: 5, y: 5, net: 0 },
    ];
    const g = buildWireGraph(wires, [0, 0], pins);
    expect(g.edges).toHaveLength(3);
    const into: Record<string, number> = { 'S.p': -3, 'L1.p': 1, 'L2.p': 2 };
    const cur = solveEdgeCurrents(g, g.pins.map((p) => into[p.key]!));
    expect(currentAt(g, cur, [0, 0], [5, 0])).toBeCloseTo(3);
    expect(currentAt(g, cur, [5, 0], [10, 0])).toBeCloseTo(1);
    expect(currentAt(g, cur, [5, 0], [5, 5])).toBeCloseTo(2);
  });

  test('a pin in the middle of a wire splits it', () => {
    const wires: Wire[] = [{ points: [[0, 0], [8, 0]] }];
    const pins: PinRef[] = [
      { key: 'A.p', x: 0, y: 0, net: 0 },
      { key: 'M.p', x: 4, y: 0, net: 0 },
      { key: 'B.p', x: 8, y: 0, net: 0 },
    ];
    const g = buildWireGraph(wires, [0], pins);
    const into: Record<string, number> = { 'A.p': -1, 'M.p': 0.25, 'B.p': 0.75 };
    const cur = solveEdgeCurrents(g, g.pins.map((p) => into[p.key]!));
    expect(currentAt(g, cur, [0, 0], [4, 0])).toBeCloseTo(1);
    expect(currentAt(g, cur, [4, 0], [8, 0])).toBeCloseTo(0.75);
  });

  test('a loop still satisfies Kirchhoff at every node', () => {
    // A square ring with a source at one corner and a load at the opposite one.
    const wires: Wire[] = [{ points: [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]] }];
    const pins: PinRef[] = [
      { key: 'S.p', x: 0, y: 0, net: 0 },
      { key: 'L.p', x: 4, y: 4, net: 0 },
    ];
    const g = buildWireGraph(wires, [0], pins);
    const cur = solveEdgeCurrents(g, g.pins.map((p) => (p.key === 'S.p' ? -1 : 1)));
    // Net flow out of the source node equals what the source supplies.
    const out = (node: number) => g.edges.reduce((s, e, i) => s + (e.a === node ? cur[i]! : 0) - (e.b === node ? cur[i]! : 0), 0);
    const src = g.pins.find((p) => p.key === 'S.p')!.node;
    const load = g.pins.find((p) => p.key === 'L.p')!.node;
    expect(out(src)).toBeCloseTo(1);
    expect(out(load)).toBeCloseTo(-1);
    // Deterministic.
    expect([...solveEdgeCurrents(g, [-1, 1])]).toEqual([...solveEdgeCurrents(g, [-1, 1])]);
  });

  test('imbalance flows to a preferred root (a ground symbol)', () => {
    const wires: Wire[] = [{ points: [[0, 0], [6, 0]] }];
    const pins: PinRef[] = [
      { key: 'R.2', x: 0, y: 0, net: 0 },
      { key: 'GND1.g', x: 6, y: 0, net: 0 },
    ];
    const g = buildWireGraph(wires, [0], pins, new Set(['GND1.g']));
    const cur = solveEdgeCurrents(g, g.pins.map((p) => (p.key === 'R.2' ? -0.5 : 0)));
    expect(currentAt(g, cur, [0, 0], [6, 0])).toBeCloseTo(0.5);
  });

  test('separate nets are separate trees', () => {
    const wires: Wire[] = [{ points: [[0, 0], [4, 0]] }, { points: [[0, 2], [4, 2]] }];
    const pins: PinRef[] = [
      { key: 'A.1', x: 0, y: 0, net: 0 },
      { key: 'B.1', x: 4, y: 0, net: 0 },
      { key: 'A.2', x: 0, y: 2, net: 1 },
      { key: 'B.2', x: 4, y: 2, net: 1 },
    ];
    const g = buildWireGraph(wires, [0, 1], pins);
    const into: Record<string, number> = { 'A.1': -1, 'B.1': 1, 'A.2': 2, 'B.2': -2 };
    const cur = solveEdgeCurrents(g, g.pins.map((p) => into[p.key]!));
    expect(currentAt(g, cur, [0, 0], [4, 0])).toBeCloseTo(1);
    expect(currentAt(g, cur, [0, 2], [4, 2])).toBeCloseTo(-2);
  });

  test('dot speed is log-compressed and signed', () => {
    expect(dotSpeed(0)).toBe(0);
    expect(dotSpeed(1e-9)).toBe(0);
    expect(dotSpeed(1e-6)).toBeGreaterThan(0);
    expect(dotSpeed(1)).toBeGreaterThan(dotSpeed(1e-3));
    expect(dotSpeed(-1)).toBe(-dotSpeed(1));
    expect(dotSpeed(1e3)).toBe(dotSpeed(1e4));
  });
});
