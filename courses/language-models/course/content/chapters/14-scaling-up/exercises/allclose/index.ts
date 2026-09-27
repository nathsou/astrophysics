import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch14/allclose',
  title: 'Compare two implementations',
  starter,
  solution,
  tests,
  hints: [
    'An element passes when <code>|a − e| ≤ atol + rtol·|e|</code>. The absolute tolerance matters for values near zero, the relative one for large values.',
    'Track three things in one loop: the largest <code>|a − e|</code>, the largest <code>|a − e| / |e|</code> (skip <code>e = 0</code>), and the index where <code>|a − e| − (atol + rtol·|e|)</code> is largest. A NaN on either side makes the comparison fail.',
  ],
} satisfies ExerciseSpec;
