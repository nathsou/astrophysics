import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch14/online-softmax',
  title: 'Attention in one pass (FlashAttention’s trick)',
  starter,
  solution,
  tests,
  hints: [
    'Keep three running quantities: the largest score so far <code>m</code> (start at −∞), the sum <code>l</code> of <code>exp(sᵢ − m)</code>, and the unnormalised output <code>acc = Σ exp(sᵢ − m)·vᵢ</code>.',
    'For each block: compute its scores and their maximum, set <code>mNew = max(m, blockMax)</code>, rescale the old <code>l</code> and <code>acc</code> by <code>exp(m − mNew)</code>, then add the block’s <code>exp(s − mNew)</code> terms. At the end return <code>acc / l</code>.',
  ],
} satisfies ExerciseSpec;
