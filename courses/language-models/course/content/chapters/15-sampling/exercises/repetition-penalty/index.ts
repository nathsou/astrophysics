import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch15/repetition-penalty',
  title: 'Repetition penalties',
  starter,
  solution,
  tests,
  hints: [
    'CTRL’s penalty looks only at <em>whether</em> a token occurred: loop over the distinct tokens of the history (<code>new Set(history)</code>) and divide a positive logit by θ, multiply a negative one by θ.',
    'The frequency and presence penalties need counts: build a <code>Map</code> from token to occurrences, then subtract <code>frequency · count + presence</code> from each counted token’s logit.',
  ],
  provides: { repetitionPenalty: 'sample.repetitionPenalty' },
} satisfies ExerciseSpec;
