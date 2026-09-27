import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch10/multi-head',
  title: 'Multi-head attention',
  starter,
  solution,
  tests,
  hints: [
    'Split heads: <code>x.matmul(Wq).reshape(B, T, heads, d).permute(0, 2, 1, 3)</code> gives (B, heads, T, d).',
    'After attention, undo it: <code>.permute(0, 2, 1, 3).reshape(B, T, C)</code>, then multiply by <code>Wo</code>. The mask broadcasts over the batch and head dimensions.',
  ],
} satisfies ExerciseSpec;
