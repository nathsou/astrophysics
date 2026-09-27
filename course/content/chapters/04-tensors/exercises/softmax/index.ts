import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch04/softmax',
  title: 'A numerically stable softmax',
  starter,
  solution,
  tests,
  hints: [
    'Try the naïve formula first and run the tests: <code>Math.exp(1000)</code> is <code>Infinity</code>, and <code>Infinity / Infinity</code> is <code>NaN</code>.',
    'Subtract each row’s maximum before exponentiating. The largest exponent becomes <code>exp(0) = 1</code>, so nothing overflows, and the result is mathematically identical.',
  ],
} satisfies ExerciseSpec;
