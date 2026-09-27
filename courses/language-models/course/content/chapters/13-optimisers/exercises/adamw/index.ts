import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch13/adamw',
  title: 'Weight decay: L2 or decoupled?',
  starter,
  solution,
  tests,
  hints: [
    'L2: add <code>wd · w</code> to the gradient before it enters the moments. AdamW: leave the gradient alone and, after the Adam step, apply <code>w −= lr · wd · w</code>.',
    'The difference: in L2, the decay term is divided by √v̂ along with the gradient, so parameters with large gradients are barely decayed.',
  ],
} satisfies ExerciseSpec;
