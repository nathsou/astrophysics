import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch05/gradient-descent',
  title: 'Gradient descent',
  starter,
  solution,
  tests,
  hints: ['Create a <em>new</em> array each step with <code>x.map((xi, i) => xi − lr · g[i])</code>, so the stored path is not mutated later.'],
} satisfies ExerciseSpec;
