import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch27/zero-memory',
  title: 'Memory per GPU',
  starter,
  solution,
  tests,
  hints: [
    'Mixed-precision Adam keeps, per parameter: 2 bytes of bf16 weights, 2 of bf16 gradients, and 12 of optimiser state (a float32 master copy and two float32 moments).',
    'Stage 1 divides the optimiser state by the number of data-parallel GPUs; stage 2 also the gradients; stage 3 also the weights. Tensor and pipeline parallelism divide everything by their degree.',
  ],
  provides: { memoryPerGpu: 'eff.memory' },
} satisfies ExerciseSpec;
