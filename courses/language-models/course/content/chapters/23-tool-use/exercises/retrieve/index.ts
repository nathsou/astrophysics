import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch23/retrieve',
  title: 'Retrieve the nearest documents',
  starter,
  solution,
  tests,
  hints: [
    'Cosine similarity is the dot product divided by the product of the norms. Treat a zero vector as having similarity 0 with everything.',
    'Compute every document’s score, then sort indices by score, descending (lower index first on ties), and keep k.',
  ],
  provides: { topK: 'tool.topk' },
} satisfies ExerciseSpec;
