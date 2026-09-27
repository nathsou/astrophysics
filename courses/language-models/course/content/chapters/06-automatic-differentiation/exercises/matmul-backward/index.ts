import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch06/matmul-backward',
  title: 'The backward pass of matmul',
  starter,
  solution,
  tests,
  hints: [
    'Check shapes first: dA must be m×k like A. The only way to get m×k from dC (m×n) and B (k×n) is dC · Bᵀ.',
    'You can compute both in one pass over (i, p): the inner loop over j gives dA[i][p] and adds A[i][p]·dC[i][·] into row p of dB.',
  ],
} satisfies ExerciseSpec;
