import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch18/swiglu',
  title: 'A gated MLP (SwiGLU)',
  starter,
  solution,
  tests,
  hints: [
    'SiLU (also called swish) is <code>z · σ(z) = z / (1 + e^−z)</code>.',
    'Compute <code>a = x·Wg</code> and <code>b = x·W1</code> (vectors of the hidden width), multiply <code>silu(a[j]) · b[j]</code> element by element, then project back with <code>W2</code>. All matrices are stored (inputs, outputs), row-major.',
  ],
} satisfies ExerciseSpec;
