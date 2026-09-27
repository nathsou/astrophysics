import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch12/epoch-sampler',
  title: 'An epoch sampler',
  starter,
  solution,
  tests,
  hints: [
    'In the constructor, list every window start (0, T, 2T, …) that fits, and shuffle them with Fisher–Yates using <code>this.rng</code>.',
    'In <code>next()</code>, take the next B starts; when the list runs out, increment the epoch, reshuffle and start again from the beginning.',
  ],
} satisfies ExerciseSpec;
