import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch25/choice-score',
  title: 'Score a multiple-choice item',
  starter,
  solution,
  tests,
  hints: [
    'With `sum`, an option’s score is its total log-probability; with `mean`, the total divided by its number of tokens.',
    'Return the index of the highest score, the first on ties.',
  ],
} satisfies ExerciseSpec;
