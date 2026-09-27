import { expect, gpuTest } from '@lm/test';
import { mulberry32 } from '@lm/core';
import { gpuSum } from './solution.ts';

gpuTest('a single element', async (gpu) => {
  expect(await gpuSum(gpu, Float32Array.of(42))).toBe(42);
});

gpuTest('fewer elements than threads', async (gpu) => {
  expect(await gpuSum(gpu, Float32Array.from({ length: 100 }, (_, i) => i + 1))).toBe(5050);
});

gpuTest('just over one element per thread (257)', async (gpu) => {
  expect(await gpuSum(gpu, new Float32Array(257).fill(1))).toBe(257);
});

gpuTest('100,000 random values, to float32 accuracy', async (gpu) => {
  const rng = mulberry32(5);
  const x = Float32Array.from({ length: 100_000 }, () => rng() - 0.5);
  let exact = 0;
  for (const v of x) exact += v;
  expect(Math.abs((await gpuSum(gpu, x)) - exact)).toBeLessThan(1e-2);
});
