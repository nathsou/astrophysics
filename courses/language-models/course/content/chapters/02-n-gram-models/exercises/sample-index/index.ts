import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch02/sample-index',
  title: 'Sample from a distribution',
  starter,
  solution,
  tests,
  hints: [
    'Imagine laying the probabilities end to end on the interval [0, 1). <code>u</code> lands in exactly one segment.',
    'Accumulate a running sum; return the first <code>i</code> for which <code>u · total &lt; sum</code>.',
    'If the loop finishes without returning (round-off), return the last index whose probability is non-zero.',
  ],
  provides: { sampleIndex: 'lm.sampleIndex' },
} satisfies ExerciseSpec;
