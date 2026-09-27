import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch01/fit-power-law',
  title: 'Fit a power law',
  starter,
  solution,
  tests,
  hints: [
    'Work with <code>u = log x</code> and <code>v = log y</code>: then you are fitting a straight line <code>v = a + m·u</code>.',
    'Least squares gives <code>m = (nΣuv − ΣuΣv) / (nΣu² − (Σu)²)</code> and <code>a = (Σv − mΣu) / n</code>. Then <code>s = −m</code> and <code>C = eᵃ</code>.',
    '<code>R² = 1 − SS_res / SS_tot</code>, both computed in log space.',
  ],
  provides: { fitPowerLaw: 'text.fitPowerLaw' },
} satisfies ExerciseSpec;
