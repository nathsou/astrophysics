import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch05/ce-grad',
  title: 'The softmax cross-entropy gradient',
  starter,
  solution,
  tests,
  hints: [
    'Compute <code>p</code> as in Chapter 4’s stable softmax. The gradient is then just <code>p</code> with 1 subtracted at the target.',
    'For the last test, do not compute <code>−Math.log(p[target])</code>: <code>p[target]</code> underflows to 0. Use <code>log Σ exp(z − m) + m − z[target]</code> instead.',
  ],
} satisfies ExerciseSpec;
