import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch15/truncation',
  title: 'Top-k, top-p and min-p',
  starter,
  solution,
  tests,
  hints: [
    'Sort the indices by decreasing probability once: <code>[...p.keys()].sort((a, b) => p[b] − p[a] || a − b)</code>. Top-k keeps everything at least as probable as the k-th of them (so ties are kept).',
    'Top-p walks down that order adding probabilities, and stops <em>before</em> a token once the mass already kept has reached p. Min-p needs no sorting: keep <code>p[i] ≥ ratio · max(p)</code>. All three finish by dividing the survivors by their total.',
  ],
  provides: { topK: 'sample.topK', topP: 'sample.topP', minP: 'sample.minP' },
} satisfies ExerciseSpec;
