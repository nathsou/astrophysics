import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch02/add-k',
  title: 'Add-k smoothing',
  starter,
  solution,
  tests,
  hints: ['Compute the total count once, then map every count through <code>(c + k) / (total + k·V)</code>.'],
} satisfies ExerciseSpec;
