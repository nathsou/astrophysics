import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch16/kv-attention',
  title: 'Attention with a KV cache',
  starter,
  solution,
  tests,
  hints: [
    'Push the new key and value onto the cache first: the new token attends to itself as well as to everything before it.',
    'Then compute one score per cached key, <code>q·kⱼ/√d</code>, take a numerically stable softmax (subtract the maximum), and return the probability-weighted sum of the cached values.',
  ],
} satisfies ExerciseSpec;
