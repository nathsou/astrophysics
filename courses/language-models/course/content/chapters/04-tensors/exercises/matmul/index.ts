import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch04/matmul',
  title: 'Matrix multiplication',
  starter,
  solution,
  tests,
  hints: [
    'Element (i, j) of a row-major m×n matrix is at index <code>i · n + j</code>.',
    'Three nested loops: <code>i</code> over rows of A, <code>p</code> over the shared dimension, <code>j</code> over columns of B. Hoist <code>A[i][p]</code> out of the inner loop.',
  ],
} satisfies ExerciseSpec;
