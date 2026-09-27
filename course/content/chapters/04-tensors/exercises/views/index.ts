import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch04/views',
  title: 'Views: transpose, slice, contiguity',
  starter,
  solution,
  tests,
  hints: [
    'Return new arrays — copy <code>shape</code> and <code>strides</code> with <code>[...v.shape]</code> before editing.',
    'Slicing from <code>start</code> moves the offset by <code>start · strides[dim]</code>.',
    'For contiguity, compare against the strides a contiguous tensor of this shape would have, skipping dimensions of size 1.',
  ],
} satisfies ExerciseSpec;
