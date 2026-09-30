import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch26/logit-lens',
  title: 'The logit lens',
  starter,
  solution,
  tests,
  hints: [
    'Layer normalisation: subtract the mean, divide by √(variance + ε), then multiply by γ and add β, element by element.',
    'The logit for token t is the dot product of the normalised vector with row t of the embedding matrix (the output layer shares the input embedding).',
  ],
} satisfies ExerciseSpec;
