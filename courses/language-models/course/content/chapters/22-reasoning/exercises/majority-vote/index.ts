import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch22/majority-vote',
  title: 'Vote, and pass@k',
  starter,
  solution,
  tests,
  hints: [
    'Count each non-null answer; the winner is the most common, and among equally common answers the one seen first.',
    'pass@k from n samples with c correct is 1 − C(n − c, k) / C(n, k). Compute the ratio as a product of (n − c − i) / (n − i) for i < k, to avoid huge binomials.',
  ],
  provides: { majorityVote: 'reason.vote' },
} satisfies ExerciseSpec;
