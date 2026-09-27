import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch09/gradient-reach',
  title: 'How far back does the gradient reach?',
  starter,
  solution,
  tests,
  hints: [
    'Run the loop; at step <code>T − k</code>, replace the state with a fresh leaf: <code>h = h.detach().requiresGrad_(); leaf = h;</code>.',
    'After the loop, <code>h.mul(v).sum().backward()</code>, then the answer is the length of <code>leaf.grad</code>: <code>Math.hypot(...leaf.grad!.toFloat32Array())</code>.',
  ],
} satisfies ExerciseSpec;
