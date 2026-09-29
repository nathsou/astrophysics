import { describe, expect, test } from 'vitest';
import type { Circuit } from '../../sim/netlist/types';
import { hitTest, nearestOnSegment } from './hit';
import { layoutOf } from './layout';

const c: Circuit = {
  version: 1,
  components: [
    { id: 'R1', type: 'resistor', x: 0, y: 0 },
    { id: 'R2', type: 'resistor', x: 12, y: 0 },
  ],
  wires: [{ points: [[4, 0], [8, 0], [8, 6]] }],
};
const l = layoutOf(c);

describe('hitTest', () => {
  test('pins first, within a radius', () => {
    expect(hitTest(c, l, 4.3, 0.2)).toMatchObject({ kind: 'pin', comp: 'R1', pin: '2', x: 4, y: 0 });
    expect(hitTest(c, l, 12, 0.5)).toMatchObject({ kind: 'pin', comp: 'R2', pin: '1' });
  });
  test('the body of a part', () => {
    expect(hitTest(c, l, 2, 0)).toEqual({ kind: 'comp', id: 'R1' });
    expect(hitTest(c, l, 2, 0.9)).toEqual({ kind: 'comp', id: 'R1' });
    expect(hitTest(c, l, 2, 3)).toBeUndefined();
  });
  test('wires report the nearest grid point on the segment', () => {
    expect(hitTest(c, l, 6.4, 0.2)).toMatchObject({ kind: 'wire', wire: 0, seg: 0, x: 6, y: 0, onEnd: false });
    expect(hitTest(c, l, 8.2, 3.2)).toMatchObject({ kind: 'wire', seg: 1, x: 8, y: 3 });
    expect(hitTest(c, l, 8, 6.1)).toMatchObject({ kind: 'wire', onEnd: true });
  });
  test('a wire beats the body of a part, and points-only ignores bodies', () => {
    const over: Circuit = { ...c, wires: [{ points: [[1, 0], [3, 0]] }] };
    expect(hitTest(over, layoutOf(over), 2, 0.1)?.kind).toBe('wire');
    expect(hitTest(c, l, 2, 0, { points: true })).toBeUndefined();
  });
  test('the smallest part wins where boxes overlap', () => {
    const stacked: Circuit = { version: 1, components: [{ id: 'U1', type: 'and', x: 0, y: 0 }, { id: 'R1', type: 'resistor', x: 1, y: 1 }], wires: [] };
    expect(hitTest(stacked, layoutOf(stacked), 3, 1.2)).toEqual({ kind: 'comp', id: 'R1' });
  });
  test('nearestOnSegment clamps to the ends', () => {
    expect(nearestOnSegment([10, 0], [0, 0], [4, 0])).toMatchObject({ x: 4, y: 0, d: 6 });
  });
});
