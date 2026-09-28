import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch17/allocate',
  title: 'Spend a compute budget',
  starter,
  solution,
  tests,
  hints: [
    'With D = C / (6N), the loss is E + A·N^−α + B·(C/6)^−β·N^β. Set its derivative with respect to N to zero: α·A·N^−α = β·B·(C/6)^−β·N^β.',
    'Solve for N: N^(α+β) = (αA / βB)·(C/6)^β, so N = G·(C/6)^(β/(α+β)) with G = (αA/(βB))^(1/(α+β)). Then D = C / (6N), and the loss follows from the law.',
  ],
  provides: { allocate: 'scaling.allocate' },
} satisfies ExerciseSpec;
