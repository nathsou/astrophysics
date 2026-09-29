import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch21/best-of-n',
  title: 'Best-of-n',
  starter,
  solution,
  tests,
  hints: [
    'Pick the index with the highest reward among the n candidates (the first, on ties).',
    'For the bound, the KL divergence of the best-of-n distribution from the base distribution is at most log n − (n − 1)/n nats.',
  ],
} satisfies ExerciseSpec;
