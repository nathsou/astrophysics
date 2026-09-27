import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch07/pca',
  title: 'PCA for the embedding projector',
  starter,
  solution,
  tests,
  hints: [
    'After centring, <code>cov[i][j] = Σ_r x[r][i]·x[r][j] / rows</code>.',
    'Power iteration: multiply by the covariance, normalise, repeat ~200 times. The norm before normalising converges to the eigenvalue λ.',
    'Deflation <code>Σ ← Σ − λvvᵀ</code> removes the first component so the same loop finds the second.',
  ],
  provides: { pcaTop2: 'pca.top2' },
} satisfies ExerciseSpec;
