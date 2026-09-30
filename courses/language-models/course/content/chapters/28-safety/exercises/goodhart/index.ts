import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch28/goodhart',
  title: 'Optimise a proxy',
  starter,
  solution,
  tests,
  hints: [
    'Sort the candidate indices by proxy value, highest first, and take the first k.',
    'Return the mean of the true values of those k candidates.',
  ],
  provides: { selectByProxy: 'safety.select' },
} satisfies ExerciseSpec;
