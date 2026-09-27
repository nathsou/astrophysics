import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch00/most-likely',
  title: 'Your first exercise: pick a token',
  starter,
  solution,
  tests,
  hints: [
    'Keep the index of the largest probability seen so far while looping over the array.',
    'Use a strict <code>&gt;</code> when comparing, so that among equal probabilities the first one wins.',
  ],
  provides: { mostLikely: 'tour.pick' },
} satisfies ExerciseSpec;
