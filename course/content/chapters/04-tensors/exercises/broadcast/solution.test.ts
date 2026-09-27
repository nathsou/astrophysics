import { expect, test } from '@lm/test';
import { broadcastShapes } from './solution.ts';

test('equal shapes', () => expect(broadcastShapes([2, 3], [2, 3])).toEqual([2, 3]));
test('a bias vector', () => expect(broadcastShapes([4, 5, 8], [8])).toEqual([4, 5, 8]));
test('both sides stretch', () => expect(broadcastShapes([3, 1], [1, 4])).toEqual([3, 4]));
test('different ranks', () => expect(broadcastShapes([3, 1, 4], [2, 4])).toEqual([3, 2, 4]));
test('a scalar', () => expect(broadcastShapes([], [2, 2])).toEqual([2, 2]));
test('zero-size dimensions stretch too', () => expect(broadcastShapes([0, 1], [1, 5])).toEqual([0, 5]));
test('incompatible shapes throw', () => {
  expect(() => broadcastShapes([3, 4], [3])).toThrow();
  expect(() => broadcastShapes([2, 3], [3, 2])).toThrow();
});
