import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch10/previous-token',
  title: 'Build a previous-token head by hand',
  starter,
  solution,
  tests,
  hints: [
    'Let the query at position i be β × onehot(i). For key j to score highly exactly when j = i − 1, its key must be onehot(j + 1): Wk shifts the position one-hot by one.',
    'Wq and Wk read only the position part of the input (rows V … V + T − 1); Wv reads only the token part (rows 0 … V − 1) and copies it.',
  ],
} satisfies ExerciseSpec;
