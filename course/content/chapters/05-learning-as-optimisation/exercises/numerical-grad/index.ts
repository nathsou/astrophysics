import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch05/numerical-grad',
  title: 'Numerical gradients',
  starter,
  solution,
  tests,
  hints: ['Copy <code>x</code> twice for each coordinate, nudge one copy up and one down by ε, and divide the difference in <code>f</code> by 2ε.'],
} satisfies ExerciseSpec;
