import { expect, test } from 'vitest';
import { rng } from '../../hep/random/index.ts';
import { classicalDeflections, firstMagnet, probUp, projections, secondMagnet } from './spin.ts';

test('spin-½ probabilities: cos²(θ/2)', () => {
  expect(probUp(0)).toBe(1);
  expect(probUp(Math.PI)).toBeCloseTo(0, 12);
  expect(probUp(Math.PI / 2)).toBeCloseTo(0.5, 12);
  expect(probUp(Math.PI / 3)).toBeCloseTo(0.75, 12);
});
test('2s + 1 beams', () => {
  expect(projections(1)).toEqual([-0.5, 0.5]);
  expect(projections(2)).toEqual([-1, 0, 1]);
  expect(projections(3).length).toBe(4);
  const c = firstMagnet(rng(1), 30000, 2);
  expect(c.length).toBe(3);
  for (const k of c) expect(Math.abs(k / 30000 - 1 / 3)).toBeLessThan(0.01);
});
test('second magnet follows cos²(θ/2); perpendicular gives half and half', () => {
  const a = secondMagnet(rng(2), 100000, Math.PI / 2);
  expect(Math.abs(a.up / 100000 - 0.5)).toBeLessThan(0.006);
  const b = secondMagnet(rng(3), 100000, Math.PI / 3);
  expect(Math.abs(b.up / 100000 - 0.75)).toBeLessThan(0.006);
  expect(b.up + b.down).toBe(100000);
});
test('classical moments would fill the whole range', () => {
  const d = classicalDeflections(rng(4), 10000);
  expect(Math.min(...d)).toBeLessThan(-0.99);
  expect(Math.max(...d)).toBeGreaterThan(0.99);
});
