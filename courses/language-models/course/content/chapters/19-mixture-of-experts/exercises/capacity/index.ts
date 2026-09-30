import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch19/capacity',
  title: 'Expert capacity',
  starter,
  solution,
  tests,
  hints: [
    'Each expert can take at most ⌊capacity⌋ tokens, with capacity = factor · tokens / experts (at least 1). Process tokens in order.',
    'A token whose expert is already full is dropped: record −1 for it. It still passes through the layer unchanged, thanks to the residual connection.',
  ],
} satisfies ExerciseSpec;
