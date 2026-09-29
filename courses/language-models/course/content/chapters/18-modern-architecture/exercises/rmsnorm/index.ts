import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch18/rmsnorm',
  title: 'RMSNorm',
  starter,
  solution,
  tests,
  hints: [
    'Compute the root mean square of the vector: <code>rms = √(mean(x²) + ε)</code>.',
    'Divide every element by it and multiply by its gain: <code>out[i] = x[i] / rms · g[i]</code>. Unlike LayerNorm, nothing is subtracted and there is no bias.',
  ],
} satisfies ExerciseSpec;
