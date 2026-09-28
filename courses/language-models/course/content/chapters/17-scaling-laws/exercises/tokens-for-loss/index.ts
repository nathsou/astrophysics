import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch17/tokens-for-loss',
  title: 'How much data does a small model need?',
  starter,
  solution,
  tests,
  hints: [
    'Rearrange L = E + A/N^α + B/D^β for D: B/D^β = L − E − A/N^α, so D = (B / (L − E − A/N^α))^(1/β).',
    'If L − E − A/N^α ≤ 0, no amount of data is enough: the model is too small for that loss, even trained forever. Return Infinity.',
  ],
  provides: { tokensForLoss: 'scaling.tokensForLoss' },
} satisfies ExerciseSpec;
