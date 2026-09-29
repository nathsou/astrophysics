import { describe, expect, test } from 'vitest';
import { componentTransform, G, placeLabel, polylineMidpoint, roundedPath, simplify, transformBox, uprightAt } from './geometry';

describe('transforms', () => {
  test('component transform: translate, rotate, flip', () => {
    expect(componentTransform({ x: 2, y: 3 })).toBe(`translate(${2 * G} ${3 * G})`);
    expect(componentTransform({ x: 0, y: 0, rot: 90, flip: true })).toBe('translate(0 0) rotate(90) scale(-1 1)');
  });
  test('boxes follow the rotation', () => {
    expect(transformBox({ x0: 0, y0: -1, x1: 4, y1: 1 }, { x: 10, y: 10, rot: 90 })).toEqual({ x0: 9, y0: 10, x1: 11, y1: 14 });
    expect(transformBox({ x0: 0, y0: -1, x1: 4, y1: 1 }, { x: 10, y: 10, flip: true })).toEqual({ x0: 6, y0: 9, x1: 10, y1: 11 });
  });
  test('upright text undoes rotation and flip', () => {
    expect(uprightAt(5, 5, 0, false)).toBeUndefined();
    expect(uprightAt(5, 5, 90, false)).toBe('translate(5 5) rotate(-90) translate(-5 -5)');
  });
});

describe('wire paths', () => {
  test('simplify merges collinear points and duplicates', () => {
    expect(
      simplify([
        [0, 0],
        [2, 0],
        [2, 0],
        [4, 0],
        [4, 3],
      ]),
    ).toEqual([
      [0, 0],
      [4, 0],
      [4, 3],
    ]);
  });
  test('rounded corners start and end on the points', () => {
    const d = roundedPath(
      [
        [0, 0],
        [2, 0],
        [2, 2],
      ],
      3,
    );
    expect(d.startsWith('M0 0')).toBe(true);
    expect(d.endsWith(`L${2 * G} ${2 * G}`)).toBe(true);
    expect(d).toContain(`Q${2 * G} 0`);
  });
  test('midpoint and direction', () => {
    expect(
      polylineMidpoint([
        [0, 0],
        [4, 0],
        [4, 4],
      ]),
    ).toEqual({ x: 4, y: 0, angle: 0 });
    expect(
      polylineMidpoint([
        [0, 4],
        [0, 0],
      ]),
    ).toEqual({ x: 0, y: 2, angle: -90 });
  });
});

describe('label placement', () => {
  const part = { x0: 0, y0: -12, x1: 48, y1: 12 };
  test('above a horizontal part when free', () => {
    const l = placeLabel(part, 30, 12, [], []);
    expect(l.box.y1).toBeLessThanOrEqual(part.y0);
    expect((l.box.x0 + l.box.x1) / 2).toBe(24);
  });
  test('moves below when something is above', () => {
    const l = placeLabel(part, 30, 12, [{ x0: 0, y0: -40, x1: 48, y1: -14 }], []);
    expect(l.box.y0).toBeGreaterThanOrEqual(part.y1);
  });
  test('beside an upright part, avoiding a wire', () => {
    const upright = { x0: -12, y0: 0, x1: 12, y1: 48 };
    const l = placeLabel(upright, 30, 12, [], [
      [
        [12, 24],
        [100, 24],
      ],
    ]);
    expect(l.box.x0).toBeGreaterThan(12);
    expect(l.box.y1 < 24 || l.box.y0 > 24).toBe(true);
  });
  test('blocks put their label above even when taller than wide', () => {
    const block = { x0: 0, y0: -12, x1: 72, y1: 120 };
    const tall = { x0: 0, y0: -12, x1: 40, y1: 120 };
    expect(placeLabel(tall, 20, 12, [], [], 3, true).box.y1).toBeLessThanOrEqual(tall.y0);
    expect(placeLabel(tall, 20, 12, [], []).box.x0).toBeGreaterThan(tall.x1);
    expect(placeLabel(block, 20, 12, [], [], 3, true).box.y1).toBeLessThanOrEqual(block.y0);
  });
});
