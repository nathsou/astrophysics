import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch19/balance-loss',
  title: 'The load-balancing loss',
  starter,
  solution,
  tests,
  hints: [
    'fₑ is the share of all routing slots (tokens × k) that went to expert e; Pₑ is the average, over tokens, of the router probability for e.',
    'Return E · Σₑ fₑ · Pₑ. With perfectly uniform routing every fₑ = Pₑ = 1/E and the loss is exactly 1.',
  ],
} satisfies ExerciseSpec;
