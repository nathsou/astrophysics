import { expect, test } from '@lm/test';
import { memoryPerGpu } from './solution.ts';

const total = (r: { weights: number; grads: number; optimiser: number }) => r.weights + r.grads + r.optimiser;

test('16 bytes per parameter with no sharding', () => {
  expect(total(memoryPerGpu(7e9, { dp: 8, tp: 1, pp: 1, zero: 0 }))).toBe(112e9);
});

test('ZeRO stages shard more and more', () => {
  const s = (zero: 0 | 1 | 2 | 3) => memoryPerGpu(1e9, { dp: 4, tp: 1, pp: 1, zero });
  expect(s(1)).toEqual({ weights: 2e9, grads: 2e9, optimiser: 3e9 });
  expect(s(2)).toEqual({ weights: 2e9, grads: 0.5e9, optimiser: 3e9 });
  expect(total(s(3))).toBe(4e9);
});

test('tensor and pipeline parallelism divide everything', () => {
  expect(total(memoryPerGpu(70e9, { dp: 1, tp: 8, pp: 4, zero: 0 }))).toBe(35e9);
});
