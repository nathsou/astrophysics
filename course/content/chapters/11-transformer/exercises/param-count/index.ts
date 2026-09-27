import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch11/param-count',
  title: 'Counting parameters',
  starter,
  solution,
  tests,
  hints: [
    'Per block: attention has four C × C matrices; the MLP has C × rC and rC × C; each of the two LayerNorms has a gain and a bias of length C.',
    'With biases: attention adds 4C (one per projection output), the MLP adds rC + C. Don’t forget the final LayerNorm (2C), and that a tied output layer adds nothing.',
  ],
} satisfies ExerciseSpec;
