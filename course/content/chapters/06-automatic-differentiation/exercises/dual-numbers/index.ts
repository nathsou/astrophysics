import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch06/dual-numbers',
  title: 'Forward mode with dual numbers',
  starter,
  solution,
  tests,
  hints: [
    'Every operation returns (f(v), f′(v) · d): the value, and the chain rule applied to the incoming tangent.',
    'To differentiate with respect to x, seed its tangent with 1: <code>new Dual(x, 1)</code>. Constants have tangent 0.',
  ],
} satisfies ExerciseSpec;
