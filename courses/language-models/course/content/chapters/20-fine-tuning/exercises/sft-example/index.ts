import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch20/sft-example',
  title: 'An SFT training example',
  starter,
  solution,
  tests,
  hints: [
    'The input is every token but the last; the target at position t is the token at t + 1.',
    'Targets that are still inside the prompt get the ignore value −100; only predictions of response tokens (and the final end-of-text) count. Cut both arrays to the context length.',
  ],
} satisfies ExerciseSpec;
