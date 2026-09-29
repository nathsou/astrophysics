import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch24/clip-loss',
  title: 'The contrastive loss',
  starter,
  solution,
  tests,
  hints: [
    'logits[i][j] = (image i · text j) / τ. Row i is a classification of image i over all texts; its correct class is i.',
    'Average the cross-entropy over the rows (image → text) and over the columns (text → image), then average the two. Subtract each row’s maximum before exponentiating.',
  ],
  provides: { clipLoss: 'mm.clip' },
} satisfies ExerciseSpec;
