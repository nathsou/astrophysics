import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch12/grad-accumulation',
  title: 'Gradient accumulation',
  starter,
  solution,
  tests,
  hints: [
    'Split the rows into k equal slices with <code>X.slice(0, i * n, (i + 1) * n)</code>. For each, compute that slice’s mean loss, divide it by k, and call <code>backward()</code>.',
    'Gradients add up in <code>W.grad</code> across the calls; a mean of k means, each over n rows, is the mean over all k·n rows.',
  ],
} satisfies ExerciseSpec;
