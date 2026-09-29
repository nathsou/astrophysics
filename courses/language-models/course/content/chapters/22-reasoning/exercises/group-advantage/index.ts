import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch22/group-advantage',
  title: 'Group-relative advantages',
  starter,
  solution,
  tests,
  hints: [
    'Compute the mean and the standard deviation of the group’s rewards (the population standard deviation: divide by n).',
    'A group where every answer earned the same reward gives all-zero advantages — no signal, and no division by zero thanks to ε.',
  ],
} satisfies ExerciseSpec;
