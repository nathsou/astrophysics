import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch24/patchify',
  title: 'Cut an image into patches',
  starter,
  solution,
  tests,
  hints: [
    'The image is stored row by row, with the channels of each pixel together: pixel (y, x) channel c is at (y·W + x)·C + c.',
    'Loop over patch rows, then patch columns (raster order); within a patch, over its rows, columns and channels, in that order.',
  ],
  provides: { patchify: 'mm.patchify' },
} satisfies ExerciseSpec;
