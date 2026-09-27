import { expect, test } from '@lm/test';
import { sampleIndex } from './solution.ts';

test('picks the interval containing u', () => {
  const p = [0.2, 0.5, 0.3];
  expect(sampleIndex(p, 0)).toBe(0);
  expect(sampleIndex(p, 0.19)).toBe(0);
  expect(sampleIndex(p, 0.2)).toBe(1);
  expect(sampleIndex(p, 0.69)).toBe(1);
  expect(sampleIndex(p, 0.7)).toBe(2);
});

test('never returns an index with zero probability', () => {
  const p = [0, 0.5, 0, 0.5, 0];
  for (let i = 0; i < 100; i++) expect([1, 3]).toContain(sampleIndex(p, i / 100));
});

test('handles u close to 1 and unnormalised input', () => {
  expect(sampleIndex([0.1, 0.1, 0.1], 0.9999999)).toBe(2);
  expect(sampleIndex([2, 6], 0.5)).toBe(1);
  expect(sampleIndex([1, 1, 1, 0], 0.99999999999)).toBe(2);
});

test('works on typed arrays', () => {
  expect(sampleIndex(new Float64Array([0.25, 0.75]), 0.3)).toBe(1);
});

test('empirical frequencies match the distribution', () => {
  const p = [0.1, 0.6, 0.3];
  const counts = [0, 0, 0];
  for (let i = 0; i < 10000; i++) counts[sampleIndex(p, (i + 0.5) / 10000)]!++;
  expect(counts[0]! / 10000).toBeCloseTo(0.1, 2);
  expect(counts[1]! / 10000).toBeCloseTo(0.6, 2);
});
