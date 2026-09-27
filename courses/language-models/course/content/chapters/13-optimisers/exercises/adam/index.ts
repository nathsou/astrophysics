import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch13/adam',
  title: 'Adam',
  starter,
  solution,
  tests,
  hints: [
    'Update both moments element-wise: <code>m = b1·m + (1 − b1)·g</code> and <code>v = b2·v + (1 − b2)·g²</code>.',
    'Increment t before correcting: <code>mHat = m / (1 − b1^t)</code>, <code>vHat = v / (1 − b2^t)</code>, then <code>w −= lr · mHat / (√vHat + eps)</code>.',
  ],
} satisfies ExerciseSpec;
