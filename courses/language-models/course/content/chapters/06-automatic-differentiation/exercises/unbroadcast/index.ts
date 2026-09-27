import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch06/unbroadcast',
  title: 'Un-broadcasting gradients',
  starter,
  solution,
  tests,
  hints: [
    'Every element of the incoming gradient belongs to exactly one element of x: the one broadcasting copied into that position. Add it there.',
    'Build strides for <code>shape</code> aligned on the right with <code>gradShape</code>, using stride 0 for leading dimensions and for size-1 dimensions that were stretched. Then walk the gradient with an odometer, as in Chapter 4.',
  ],
} satisfies ExerciseSpec;
