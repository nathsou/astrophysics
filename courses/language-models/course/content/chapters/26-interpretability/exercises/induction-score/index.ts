import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch26/induction-score',
  title: 'Find an induction head',
  starter,
  solution,
  tests,
  hints: [
    'In the second copy, position i (from L + 1 to 2L) holds the same token as position i − L. The token that followed that earlier occurrence is at i − L + 1.',
    'Average attn[i][i − L + 1] over the L positions of the second copy.',
  ],
  provides: { inductionScore: 'interp.induction' },
} satisfies ExerciseSpec;
