import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch09/rnn-forward',
  title: 'An RNN forward pass',
  starter,
  solution,
  tests,
  hints: [
    'For each t: <code>const z = nn.embedding(p.E, ids.map((seq) => seq[t]!)).matmul(p.W).add(p.b).add(h.matmul(p.U));</code> then <code>h = z.tanh()</code>.',
    'Collect every h in an array; <code>cat(hs, 0)</code> stacks them time-major into (T·B, H), and one matmul with <code>p.Wy</code> (plus <code>p.by</code>) gives all the logits at once.',
  ],
} satisfies ExerciseSpec;
