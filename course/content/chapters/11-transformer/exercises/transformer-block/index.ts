import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch11/transformer-block',
  title: 'A pre-norm Transformer block',
  starter,
  solution,
  tests,
  hints: [
    'Two lines of the same shape: <code>x = x.add(attend(nn.layerNorm(x, p.ln1g, p.ln1b)))</code>, then the same with the MLP branch.',
    'The MLP branch is <code>nn.layerNorm(x, p.ln2g, p.ln2b).matmul(p.W1).gelu().matmul(p.W2)</code>.',
  ],
} satisfies ExerciseSpec;
