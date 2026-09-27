import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch11/sinusoidal',
  title: 'Sinusoidal position encodings',
  starter,
  solution,
  tests,
  hints: [
    'For i = 0 … d/2 − 1: the angle is pos / base^(2i/d); column 2i gets its sine and column 2i + 1 its cosine.',
    'Build a Float32Array of T·d numbers and wrap it: <code>new Tensor(data, [T, d])</code>.',
  ],
} satisfies ExerciseSpec;
