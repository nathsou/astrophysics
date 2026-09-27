import { expect, gpuTest } from '@lm/test';
import { mulberry32 } from '@lm/core';
import { Tensor } from '@lm/core/tensor';
import { matmul, tiledKernel } from './solution.ts';

const check = async (gpu: Parameters<typeof matmul>[0], M: number, K: number, N: number) => {
  const rng = mulberry32(M * 1000 + K * 10 + N);
  const A = Tensor.randn([M, K], { rng }), B = Tensor.randn([K, N], { rng });
  const want = A.matmul(B).toFloat32Array();
  const got = await matmul(gpu, A.toFloat32Array(), B.toFloat32Array(), M, K, N);
  for (let i = 0; i < want.length; i++) {
    if (Math.abs(got[i]! - want[i]!) > 1e-3 * Math.max(1, Math.abs(want[i]!))) throw new Error(`C[${Math.floor(i / N)}][${i % N}]: expected ${want[i]}, got ${got[i]}`);
  }
};

gpuTest('uses workgroup memory and barriers', () => {
  expect(tiledKernel).toContain('workgroupBarrier');
  expect(tiledKernel).toContain('As[');
});

gpuTest('exactly one tile (16 × 16 × 16)', (gpu) => check(gpu, 16, 16, 16));
gpuTest('several tiles (64 × 48 × 32)', (gpu) => check(gpu, 64, 48, 32));
gpuTest('ragged edges (17 × 33 × 5)', (gpu) => check(gpu, 17, 33, 5));
gpuTest('a single row times a matrix (1 × 100 × 70)', (gpu) => check(gpu, 1, 100, 70));
