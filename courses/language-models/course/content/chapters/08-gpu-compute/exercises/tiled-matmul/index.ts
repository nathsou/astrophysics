import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch08/tiled-matmul',
  title: 'Tiled matrix multiplication',
  optional: true,
  starter,
  solution,
  tests,
  hints: [
    'Each thread loads one element of each tile: <code>As[ly * 16 + lx] = getA(i, k0 + lx)</code> and <code>Bs[ly * 16 + lx] = getB(k0 + ly, j)</code>. The helpers return 0 outside the matrix, which pads the edge tiles.',
    'Barrier after loading (so every thread sees the whole tile) and again after using it (so no thread overwrites a tile another is still reading).',
  ],
} satisfies ExerciseSpec;
