import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch04/strides',
  title: 'Strides and offsets',
  starter,
  solution,
  tests,
  hints: ['Walk the shape from right to left, keeping a running product that starts at 1.'],
} satisfies ExerciseSpec;
