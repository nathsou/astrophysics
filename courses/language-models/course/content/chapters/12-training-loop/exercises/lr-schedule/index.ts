import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch12/lr-schedule',
  title: 'Warm-up and cosine decay',
  starter,
  solution,
  tests,
  hints: [
    'During warm-up: <code>peak * (step + 1) / warmup</code>.',
    'Afterwards, progress p = (step − warmup) / (total − warmup), clamped to 1, and the rate is <code>peak * (min + (1 − min) * 0.5 * (1 + Math.cos(Math.PI * p)))</code>.',
  ],
} satisfies ExerciseSpec;
