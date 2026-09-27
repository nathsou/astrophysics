import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch09/lstm-cell',
  title: 'The LSTM cell',
  starter,
  solution,
  tests,
  hints: [
    '<code>z.slice(1, 0, H).sigmoid()</code> is the input gate; the forget and output gates are the next two blocks of H columns, and the candidate g uses <code>tanh</code>.',
    'c′ = f ⊙ c + i ⊙ g, then h′ = o ⊙ tanh(c′). Every operation here is a Tensor method, so autograd handles the backward pass.',
  ],
} satisfies ExerciseSpec;
