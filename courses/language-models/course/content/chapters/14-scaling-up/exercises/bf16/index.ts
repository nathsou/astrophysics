import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch14/bf16',
  title: 'Round to bfloat16',
  optional: true,
  starter,
  solution,
  tests,
  hints: [
    'Write the number into a <code>Float32Array</code> of length 1 and read the same buffer through a <code>Uint32Array</code> to get its bits. bfloat16 is the top 16 of them.',
    'Round to nearest, ties to even: add <code>0x7FFF + ((bits >>> 16) & 1)</code> before shifting right by 16. A carry out of the mantissa correctly bumps the exponent (and rounds huge values up to infinity). Handle NaN separately, because rounding could turn it into infinity.',
  ],
  provides: { toBf16: 'precision.toBf16' },
} satisfies ExerciseSpec;
