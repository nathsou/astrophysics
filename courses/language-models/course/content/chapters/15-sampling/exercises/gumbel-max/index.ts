import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch15/gumbel-max',
  title: 'Sampling without a softmax (the Gumbel-max trick)',
  starter,
  solution,
  tests,
  hints: [
    'Gumbel noise is <code>g = −log(−log(u))</code> for a uniform <code>u</code> in (0, 1). Guard against <code>u = 0</code>, whose logarithm is −∞.',
    'Add independent noise to every logit divided by the temperature, and return the index of the largest sum. No exponentials, no normalisation, no cumulative sums.',
  ],
} satisfies ExerciseSpec;
