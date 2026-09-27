import { expect, gpuTest } from '@lm/test';
import { mulberry32 } from '@lm/core';
import { saxpy } from './solution.ts';

const check = async (gpu: Parameters<typeof saxpy>[0], n: number, a: number) => {
  const rng = mulberry32(n);
  const x = Float32Array.from({ length: n }, () => rng() * 2 - 1);
  const y = Float32Array.from({ length: n }, () => rng() * 2 - 1);
  const got = await saxpy(gpu, a, x, y);
  expect(got.length).toBe(n);
  for (let i = 0; i < n; i++) if (Math.abs(got[i]! - (a * x[i]! + y[i]!)) > 1e-5) throw new Error(`element ${i}: expected ${a * x[i]! + y[i]!}, got ${got[i]}`);
};

gpuTest('a few elements', async (gpu) => {
  expect(Array.from(await saxpy(gpu, 2, Float32Array.of(1, 2, 3), Float32Array.of(10, 20, 30)))).toEqual([12, 24, 36]);
});

gpuTest('a length that is not a multiple of the workgroup size', (gpu) => check(gpu, 1000, -0.5));

gpuTest('a million elements (3,907 workgroups)', (gpu) => check(gpu, 1_000_000, 3));
