import { describe, expect, test } from 'vitest';
import { autoRoute, crossings, lastAxis, pinAxis, routeL } from './route';
import type { LayoutComp } from './layout';

describe('routeL', () => {
  test('straight when aligned', () => {
    expect(routeL([0, 0], [6, 0])).toEqual([[0, 0], [6, 0]]);
    expect(routeL([2, 0], [2, 8], 'h')).toEqual([[2, 0], [2, 8]]);
    expect(routeL([3, 3], [3, 3])).toEqual([[3, 3]]);
  });
  test('an L along the chosen axis first', () => {
    expect(routeL([0, 0], [6, 4], 'h')).toEqual([[0, 0], [6, 0], [6, 4]]);
    expect(routeL([0, 0], [6, 4], 'v')).toEqual([[0, 0], [0, 4], [6, 4]]);
    expect(routeL([6, 4], [0, 0], 'h')).toEqual([[6, 4], [0, 4], [0, 0]]);
  });
});

describe('autoRoute', () => {
  const block = { x0: 2, y0: -2, x1: 8, y1: 2 };
  test('takes the preferred bend when nothing is in the way', () => {
    expect(autoRoute([0, 0], [10, 6], { first: 'v' })).toEqual([[0, 0], [0, 6], [10, 6]]);
    expect(autoRoute([0, 0], [10, 6])).toEqual([[0, 0], [10, 0], [10, 6]]);
  });
  test('takes the other bend when the preferred one crosses a part', () => {
    // Horizontal first from (0,0) runs through the block; vertical first goes round it.
    const path = autoRoute([0, 0], [10, 6], { first: 'h', obstacles: [block] });
    expect(path).toEqual([[0, 0], [0, 6], [10, 6]]);
    expect(crossings(path, [block])).toBe(0);
  });
  test('pins on the edge of their own part do not count as crossings', () => {
    expect(crossings([[8, 0], [12, 0]], [block])).toBe(0);
    expect(crossings([[0, 0], [12, 0]], [block])).toBe(1);
  });
  test('keeps the preferred bend when both cross', () => {
    const a = { x0: 2, y0: -2, x1: 8, y1: 2 };
    const b = { x0: -2, y0: 2, x1: 2, y1: 8 };
    const path = autoRoute([0, 0], [10, 6], { first: 'h', obstacles: [a, b] });
    expect(path[1]).toEqual([10, 0]);
  });
});

describe('directions', () => {
  const comp = { box: { x0: 0, y0: -1, x1: 4, y1: 1 } } as LayoutComp;
  test('a pin on the side of a part points along x, one at the top along y', () => {
    expect(pinAxis(comp, { x: 4, y: 0 })).toBe('h');
    expect(pinAxis({ box: { x0: 0, y0: 0, x1: 4, y1: 4 } } as LayoutComp, { x: 2, y: 4 })).toBe('v');
  });
  test('last axis of a path', () => {
    expect(lastAxis([[0, 0], [4, 0]])).toBe('h');
    expect(lastAxis([[0, 0], [4, 0], [4, 3]])).toBe('v');
    expect(lastAxis([[0, 0]])).toBe('h');
  });
});
