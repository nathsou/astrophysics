import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch18/rope',
  title: 'Rotary position embedding',
  starter,
  solution,
  tests,
  hints: [
    'Pair coordinate i with coordinate i + d/2 (the “rotate half” layout). Pair i turns by the angle <code>pos · base^(−2i/d)</code>.',
    'For each pair: <code>x₁′ = x₁ cos θ − x₂ sin θ</code>, <code>x₂′ = x₁ sin θ + x₂ cos θ</code>. Position 0 leaves the vector unchanged.',
  ],
  provides: { rope: 'arch.rope' },
} satisfies ExerciseSpec;
