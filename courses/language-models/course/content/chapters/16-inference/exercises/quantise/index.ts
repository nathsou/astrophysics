import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch16/quantise',
  title: 'Quantise to b bits',
  starter,
  solution,
  tests,
  hints: [
    'With b bits a symmetric signed integer reaches <code>qmax = 2^(b−1) − 1</code> (127 for int8, 7 for int4). Each group’s scale is its largest magnitude divided by qmax, so that value maps exactly onto ±qmax.',
    'Quantise with <code>Math.round(w / scale)</code>, clamped to [−qmax, qmax]; dequantise with <code>q · scale</code>. An all-zero group would have scale 0: use 1 instead so nothing divides by zero.',
  ],
  provides: { quantise: 'quant.quantise' },
} satisfies ExerciseSpec;
