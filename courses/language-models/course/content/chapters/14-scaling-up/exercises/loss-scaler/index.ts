import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch14/loss-scaler',
  title: 'Dynamic loss scaling',
  starter,
  solution,
  tests,
  hints: [
    'First check every gradient with <code>Number.isFinite</code>. If any is infinite or NaN, the scale was too large: multiply it by <code>backoff</code>, reset the count of good steps, and return false without touching the gradients.',
    'Otherwise divide every gradient by the scale (in place), count the good step, and when the count reaches <code>growthInterval</code>, multiply the scale by <code>growth</code> and reset the count.',
  ],
} satisfies ExerciseSpec;
