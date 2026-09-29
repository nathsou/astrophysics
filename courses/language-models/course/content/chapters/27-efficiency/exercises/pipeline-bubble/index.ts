import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch27/pipeline-bubble',
  title: 'The pipeline bubble',
  starter,
  solution,
  tests,
  hints: [
    'With p stages and m micro-batches, a GPipe schedule takes m + p − 1 time slots for the forward pass (and as many for the backward).',
    'Each stage is busy for m of those slots, so the idle fraction is (p − 1) / (m + p − 1).',
  ],
  provides: { bubble: 'eff.bubble' },
} satisfies ExerciseSpec;
