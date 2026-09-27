import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch10/causal-attention',
  title: 'Causal scaled dot-product attention',
  starter,
  solution,
  tests,
  hints: [
    'Scores: <code>q.matmul(k.transpose(-1, -2)).mul(1 / Math.sqrt(d))</code>, shape (T, T).',
    'The mask is a (T, T) tensor with 0 on and below the diagonal and <code>-Infinity</code> above; add it before the softmax, so masked entries get weight exactly 0.',
  ],
} satisfies ExerciseSpec;
