import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch05/bigram-step',
  title: 'Train the bigram model by hand',
  starter,
  solution,
  tests,
  hints: [
    'For each example, find its row <code>xs[b] · V</code>, compute the stable softmax of those V logits, add <code>log Σ exp − z_target</code> to the loss, and add <code>(p − onehot)/B</code> into the same row of <code>grad</code>.',
    'Several examples can share a row — that is why the gradient is <em>accumulated</em> with <code>+=</code>.',
    'The L2 term <code>λ·mean(W²)</code> has gradient <code>2λW / (V·V)</code>. Add it to every entry when you update.',
  ],
  provides: { bigramStep: 'bigram.step' },
} satisfies ExerciseSpec;
