import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch25/intervals',
  title: 'How sure is a score?',
  starter,
  solution,
  tests,
  hints: [
    'The standard error of an accuracy p measured on n items is √(p(1 − p)/n); the 95% interval is p ± 1.96 standard errors.',
    'For two models on the same items, work with the per-item differences: their mean is the difference in accuracy, and their standard error is the standard deviation of the differences divided by √n.',
  ],
  provides: { accuracyInterval: 'eval.interval' },
} satisfies ExerciseSpec;
