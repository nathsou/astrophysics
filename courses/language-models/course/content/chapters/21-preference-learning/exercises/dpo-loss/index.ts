import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch21/dpo-loss',
  title: 'The DPO loss',
  starter,
  solution,
  tests,
  hints: [
    'The implicit reward of a response is β · (log π(y) − log π_ref(y)): how much more likely the policy makes it than the reference does.',
    'The loss is −log σ(margin) with margin = β·[(log π(y_c) − log π_ref(y_c)) − (log π(y_r) − log π_ref(y_r))]. Its gradient weight σ(−margin) is largest when the policy still prefers the rejected response.',
  ],
} satisfies ExerciseSpec;
