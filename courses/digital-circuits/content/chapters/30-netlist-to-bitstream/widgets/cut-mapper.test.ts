import { describe, expect, test } from 'vitest';
import { PRESETS, allCuts, buildGraph, coverAgrees, cone, map, ttHex } from './cut-mapper';

describe('from gates to lookup tables (Figure 30.3)', () => {
  const shape = (id: string, balance: boolean) => {
    const g = buildGraph(id, balance);
    return { ands: g.aig.andCount(g.roots), depth: g.aig.depth(g.roots), k: [2, 3, 4].map((k) => [map(g, k).luts, map(g, k).depth]) };
  };

  test('wrapped = en·v0·v1·v2·v3 as a chain: 4 AND nodes, 4 deep; balanced, 3 deep; two LUTs for K = 3 or 4', () => {
    expect(shape('wrapped', false)).toEqual({ ands: 4, depth: 4, k: [[4, 4], [2, 2], [2, 2]] });
    expect(shape('wrapped', true)).toEqual({ ands: 4, depth: 3, k: [[4, 3], [2, 2], [2, 2]] });
  });

  test('eight ANDed inputs: a chain is 7 deep and maps to three LUT4s three deep; balanced it is 3 deep and maps to three LUT4s two deep', () => {
    expect(shape('and8', false)).toEqual({ ands: 7, depth: 7, k: [[7, 7], [4, 4], [3, 3]] });
    expect(shape('and8', true)).toEqual({ ands: 7, depth: 3, k: [[7, 3], [5, 3], [3, 2]] });
  });

  test('parity of eight bits (a tree): 21 AND nodes; seven LUT2s, five LUT3s, three LUT4s', () => {
    expect(shape('parity8', true)).toEqual({ ands: 21, depth: 6, k: [[7, 3], [5, 3], [3, 2]] });
  });

  test('the carry of four full adders: 13 AND nodes seven deep; four LUT3s four deep, or three LUT4s three deep', () => {
    expect(shape('carry4', false)).toEqual({ ands: 13, depth: 7, k: [[13, 7], [4, 4], [3, 3]] });
  });

  test('the 4-way multiplexer: nine nodes, three LUTs two deep from K = 3', () => {
    expect(shape('mux4', false).k).toEqual([[9, 4], [3, 2], [3, 2]]);
  });

  test('bigger LUTs never need more levels or more LUTs (every preset, balanced or not)', () => {
    for (const p of PRESETS) {
      for (const bal of [false, true]) {
        const g = buildGraph(p.id, bal);
        const [a, b, c] = [2, 3, 4].map((k) => map(g, k));
        expect(b!.depth).toBeLessThanOrEqual(a!.depth);
        expect(c!.depth).toBeLessThanOrEqual(b!.depth);
        expect(c!.luts).toBeLessThanOrEqual(a!.luts);
      }
    }
  });

  test('the mapper’s depth is the optimal label of the deepest output, and every cover computes the function', () => {
    for (const p of PRESETS) {
      for (const bal of [false, true]) {
        for (const k of [2, 3, 4]) {
          const m = map(buildGraph(p.id, bal), k);
          const root = m.graph.roots[0]! >> 1;
          expect(m.depth).toBe(m.nodes.find((n) => n.node === root)!.label);
          expect(coverAgrees(m), `${p.id} balance=${bal} K=${k}`).toBe(true);
        }
      }
    }
  });

  test('balancing never makes a graph deeper', () => {
    for (const p of PRESETS) {
      const a = buildGraph(p.id, false);
      const b = buildGraph(p.id, true);
      expect(b.aig.depth(b.roots)).toBeLessThanOrEqual(a.aig.depth(a.roots));
    }
  });

  test('cuts of the top node of the AND chain: the mapper picks one of them, and its table is that of the cone', () => {
    const g = buildGraph('wrapped', false);
    const top = g.roots[0]! >> 1;
    const cuts = allCuts(g.aig, top, 4);
    expect(cuts.length).toBeGreaterThan(1);
    expect(cuts.every((c) => c.leaves.length <= 4)).toBe(true);
    const m = map(g, 4);
    const lut = m.mapped.luts[m.mapped.lutOf[top]!]!;
    const same = cuts.find((c) => c.leaves.join() === lut.leaves.join())!;
    expect(same.tt).toBe(lut.tt);
    expect(cone(g.aig, top, lut.leaves).length).toBeGreaterThan(0);
  });

  test('a truth table over three leaves is written with two hex digits', () => {
    expect(ttHex(0x80, 3)).toBe('80');
    expect(ttHex(0x6, 2)).toBe('6');
    expect(ttHex(0x6666, 4)).toBe('6666');
  });
});
