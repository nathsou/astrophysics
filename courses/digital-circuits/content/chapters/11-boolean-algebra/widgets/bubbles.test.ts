import { describe, expect, test } from 'vitest';
import { PRESETS, cancelDoubles, compare, dragTarget, evalNet, exprOf, gateName, layoutNet, pushThrough, toggleBubble, type Net } from './bubbles';

const preset = (id: string): Net => PRESETS.find((p) => p.id === id)!.net;

describe('bubble pushing', () => {
  test('NAND becomes an OR of inverted inputs and computes the same function', () => {
    const before = preset('nand');
    expect(exprOf(before)).toBe('¬(A·B)');
    const r = pushThrough(before, 'g1');
    expect(exprOf(r.net)).toBe('¬A + ¬B');
    expect(r.net.gates[0]!.kind).toBe('or');
    expect(gateName(r.net.gates[0]!)).toBe('NAND');
    expect(compare(before, r.net).same).toBe(true);
  });

  test('pushing twice returns to the start', () => {
    const before = preset('nor');
    const twice = pushThrough(pushThrough(before, 'g1').net, 'g1').net;
    expect(twice).toEqual(before);
  });

  test('NAND–NAND becomes AND–OR by pushing the last gate: the bubbles cancel', () => {
    const r = pushThrough(preset('nandnand'), 'g3');
    expect(r.cancelled).toHaveLength(2);
    expect(r.net.gates.map((g) => [g.kind, g.outInv, g.ins.some((p) => p.inv)])).toEqual([
      ['and', false, false],
      ['and', false, false],
      ['or', false, false],
    ]);
    expect(exprOf(r.net)).toBe('A·B + C·D');
    expect(compare(preset('nandnand'), r.net).same).toBe(true);
  });

  test('NOR–NOR becomes OR–AND', () => {
    const r = pushThrough(preset('norrnor'), 'g3');
    expect(exprOf(r.net)).toBe('(A + B)·(C + D)');
  });

  test('AND-OR-INVERT takes two moves', () => {
    const start = preset('aoi');
    expect(exprOf(start)).toBe('¬(A·B + C)');
    const one = pushThrough(start, 'g2').net;
    expect(exprOf(one)).toBe('¬(A·B)·¬C');
    const two = pushThrough(one, 'g1').net;
    expect(exprOf(two)).toBe('(¬A + ¬B)·¬C');
    expect(compare(start, two).same).toBe(true);
  });

  test('any sequence of pushes keeps the function', () => {
    for (const p of PRESETS) {
      let net = p.net;
      for (let i = 0; i < 40; i++) {
        const g = net.gates[(i * 7 + 3) % net.gates.length]!;
        net = pushThrough(net, g.id).net;
        expect(compare(p.net, net).same, `${p.id} after ${i + 1} pushes`).toBe(true);
      }
    }
  });

  test('a single bubble changes the function, and the comparison finds a counterexample', () => {
    const r = toggleBubble(preset('nand'), 'g1', 0);
    const c = compare(preset('nand'), r.net);
    expect(c.same).toBe(false);
    expect(c.differing).toBeGreaterThan(0);
    expect(c.counterexample).toBeDefined();
    expect(evalNet(r.net, c.counterexample!.env)).toBe(c.counterexample!.now);
  });

  test('cancelDoubles only cancels a wire whose every reader has a bubble', () => {
    const net: Net = {
      vars: ['A', 'B', 'C'],
      root: 'g3',
      gates: [
        { id: 'g1', kind: 'and', outInv: true, ins: [{ src: 'A', inv: false }, { src: 'B', inv: false }] },
        { id: 'g2', kind: 'or', outInv: false, ins: [{ src: 'g1', inv: true }, { src: 'C', inv: false }] },
        { id: 'g3', kind: 'or', outInv: false, ins: [{ src: 'g1', inv: false }, { src: 'g2', inv: false }] },
      ],
    };
    expect(cancelDoubles(net).cancelled).toEqual([]);
  });

  test('dragging: output bubble back goes through its gate, forward through the next', () => {
    const net = preset('nandnand');
    expect(dragTarget(net, 'g1', 'out', 'back')).toEqual({ gate: 'g1' });
    expect(dragTarget(net, 'g1', 'out', 'forward')).toEqual({ gate: 'g3' });
    expect(dragTarget(net, 'g3', 'out', 'forward')).toHaveProperty('why');
    expect(dragTarget(net, 'g3', 0, 'forward')).toEqual({ gate: 'g3' });
    expect(dragTarget(net, 'g3', 0, 'back')).toEqual({ gate: 'g1' });
    expect(dragTarget(net, 'g1', 0, 'back')).toHaveProperty('why');
  });

  test('the layout gives every gate an input pin per input', () => {
    for (const p of PRESETS) {
      const geom = layoutNet(p.net);
      for (const g of p.net.gates) expect(geom.gates.find((x) => x.id === g.id)!.pins).toHaveLength(g.ins.length);
      expect(geom.width).toBeGreaterThan(0);
    }
  });
});
