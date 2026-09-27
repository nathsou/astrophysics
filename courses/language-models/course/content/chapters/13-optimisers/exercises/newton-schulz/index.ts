import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch13/newton-schulz',
  title: 'Orthogonalise a matrix (Muon)',
  starter,
  solution,
  tests,
  hints: [
    'Normalise first: <code>X = G / ‖G‖_F</code>, so every singular value is at most 1.',
    'Each iteration: <code>A = X Xᵀ</code>, <code>B = b·A + c·A·A</code>, <code>X = a·X + B·X</code>. The polynomial pushes every singular value towards 1 while keeping the singular vectors.',
  ],
} satisfies ExerciseSpec;
