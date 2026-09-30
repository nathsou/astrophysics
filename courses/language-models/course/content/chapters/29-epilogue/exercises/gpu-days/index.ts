import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch29/gpu-days',
  title: 'How long on your GPU?',
  starter,
  solution,
  tests,
  hints: [
    'Training compute is about 6 floating-point operations per parameter per token: C = 6ND.',
    'A GPU delivers peak × utilisation operations per second; divide C by that, then by 86,400 seconds per day.',
  ],
  provides: { gpuDays: 'epi.days' },
} satisfies ExerciseSpec;
