import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch07/init',
  title: 'Scaled initialisation',
  starter,
  solution,
  tests,
  hints: ['<code>Tensor.randn([fanIn, fanOut], { rng, std: gain / Math.sqrt(fanIn), requiresGrad: true })</code>. A uniform prediction assigns probability 1/V to the right answer.'],
} satisfies ExerciseSpec;
