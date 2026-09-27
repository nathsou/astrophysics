import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch13/momentum',
  title: 'Momentum',
  starter,
  solution,
  tests,
  hints: [
    'Keep one velocity array per parameter, created (zeros) in the constructor.',
    'For each element: <code>v[i] = beta * v[i] + g[i]; w[i] -= lr * v[i];</code>',
  ],
} satisfies ExerciseSpec;
