import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch20/lora',
  title: 'A LoRA layer',
  starter,
  solution,
  tests,
  hints: [
    'Never form the full matrix A·B: compute u = x·A (just r numbers), then y = x·W + scale · u·B.',
    'Merging is the opposite: W′ = W + scale · A·B, computed once, after which the layer is an ordinary matrix product again.',
  ],
} satisfies ExerciseSpec;
