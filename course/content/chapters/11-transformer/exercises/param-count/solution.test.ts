import { expect, test } from '@lm/test';
import { countParams } from './solution.ts';

test('GPT-2 small has 124,439,808 parameters', () => {
  expect(countParams({ L: 12, C: 768, V: 50257, T: 1024, r: 4, bias: true, tied: true })).toBe(124_439_808);
});

test('GPT-2 medium has 354,823,168', () => {
  expect(countParams({ L: 24, C: 1024, V: 50257, T: 1024, r: 4, bias: true, tied: true })).toBe(354_823_168);
});

test('this chapter’s browser model (no biases, tied)', () => {
  // 65·128 + 128·128 + 2·(4·128² + 8·128² + 4·128) + 2·128 (the final LayerNorm)
  expect(countParams({ L: 2, C: 128, V: 65, T: 128, r: 4, bias: false, tied: true })).toBe(419_200);
});

test('untying the output layer adds V·C (and V biases)', () => {
  const tied = countParams({ L: 2, C: 64, V: 100, T: 32, r: 4, bias: true, tied: true });
  expect(countParams({ L: 2, C: 64, V: 100, T: 32, r: 4, bias: true, tied: false }) - tied).toBe(100 * 64 + 100);
});
