import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch07/mlp-forward',
  title: 'The MLP forward pass',
  starter,
  solution,
  tests,
  hints: [
    'Concatenating n embeddings of size d is the same as reshaping the (B, n, d) lookup to (B, n·d) — a free view.',
    'Then <code>.matmul(p.W1).add(p.b1).tanh()</code>, and the same pattern (without tanh) for the output layer. Broadcasting adds the bias to every row.',
  ],
} satisfies ExerciseSpec;
