import { expect, test } from '@lm/test';
import { EpochSampler } from './solution.ts';

test('an epoch visits every complete window exactly once', () => {
  // n = 100, T = 10: windows need 11 tokens, so starts 0, 10, …, 80 (9 windows).
  const s = new EpochSampler(100, 10, 3);
  const seen = s.next(9).sort((a, b) => a - b);
  expect(seen).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
  expect(s.epoch).toBe(0);
});

test('continues into a reshuffled next epoch', () => {
  const s = new EpochSampler(100, 10, 3);
  const first = s.next(9);
  const second = s.next(9);
  expect(s.epoch).toBe(1);
  expect([...second].sort((a, b) => a - b)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
  expect(second).not.toEqual(first);
});

test('batches can straddle epochs', () => {
  const s = new EpochSampler(100, 10, 5);
  s.next(7);
  expect(s.next(4)).toHaveLength(4);
  expect(s.epoch).toBe(1);
});

test('is reproducible from its seed', () => {
  const a = new EpochSampler(1000, 16, 7).next(20);
  expect(a).toHaveLength(20);
  expect(a).toEqual(new EpochSampler(1000, 16, 7).next(20));
});
