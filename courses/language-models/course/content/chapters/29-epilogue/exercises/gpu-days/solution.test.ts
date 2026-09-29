import { expect, test } from '@lm/test';
import { gpuDays } from './solution.ts';

test('CourseGPT on an RTX 4060 Ti: about two hours', () => {
  // 29.6 M parameters, 1.05 B tokens, ≈ 44 TFLOP/s bf16 peak at 59% utilisation (Chapter 14).
  const days = gpuDays(29.6e6, 1.05e9, 44e12, 0.59);
  expect(days * 24).toBeGreaterThan(1.5);
  expect(days * 24).toBeLessThan(2.5);
});

test('scales linearly in parameters and tokens', () => {
  expect(gpuDays(2e9, 1e12, 1e15, 0.4)).toBeCloseTo(4 * gpuDays(1e9, 0.5e12, 1e15, 0.4), 6);
});
