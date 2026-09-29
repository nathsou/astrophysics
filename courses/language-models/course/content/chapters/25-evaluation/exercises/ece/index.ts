import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch25/ece',
  title: 'Expected calibration error',
  starter,
  solution,
  tests,
  hints: [
    'Put each prediction in bin ⌊confidence × B⌋ (confidence 1 goes in the last bin).',
    'For each non-empty bin, compare the mean confidence with the fraction correct; weight the absolute gap by the bin’s share of predictions and add up.',
  ],
  provides: { ece: 'eval.ece' },
} satisfies ExerciseSpec;
