import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch07/layer-norm',
  title: 'Layer normalisation',
  starter,
  solution,
  tests,
  hints: ['Two passes per row: first the mean, then the variance of <code>x − mean</code>. The <code>eps</code> inside the square root is what saves the constant-row case.'],
} satisfies ExerciseSpec;
