import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch26/sae',
  title: 'A top-k sparse autoencoder',
  optional: true,
  starter,
  solution,
  tests,
  hints: [
    'Pre-activations: ReLU((x − b_dec) · W_enc + b_enc), one per feature. Keep the k largest, zero the rest (ties to the lower index).',
    'The reconstruction is the sum of the kept features’ activations times their decoder rows, plus b_dec.',
  ],
  provides: { topkSae: 'interp.sae' },
} satisfies ExerciseSpec;
