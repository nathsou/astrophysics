import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch17/isoflop-minimum',
  title: 'The bottom of an IsoFLOP curve',
  starter,
  solution,
  tests,
  hints: [
    'Work with x = ln N. Least squares for y = a x² + b x + c means solving the 3 × 3 normal equations built from the sums Σx⁴, Σx³, Σx², Σx, n and Σx²y, Σxy, Σy.',
    'The vertex of the parabola is at x = −b / (2a), so the optimal size is exp(−b / 2a) and the loss there is c − b² / (4a). If a ≤ 0 the curve has no minimum: return NaN for both.',
  ],
} satisfies ExerciseSpec;
