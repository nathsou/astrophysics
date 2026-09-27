import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch16/speculative',
  title: 'Speculative sampling',
  starter,
  solution,
  tests,
  hints: [
    'Walk through the drafts in order. Draft i, token x, is accepted when <code>u · q[i][x] < p[i][x]</code> for a fresh uniform u — that is, with probability min(1, p/q).',
    'At the first rejection, build <code>max(0, p[i][j] − q[i][j])</code> for every j, sample from it (sampleIndex normalises for you) and stop. If nothing was rejected, sample one bonus token from <code>p[drafts.length]</code>.',
  ],
} satisfies ExerciseSpec;
