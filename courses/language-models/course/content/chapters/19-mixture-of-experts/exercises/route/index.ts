import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch19/route',
  title: 'Route a token',
  starter,
  solution,
  tests,
  hints: [
    'Softmax the router scores into probabilities, then pick the k largest (ties to the lower index).',
    'Divide the chosen probabilities by their sum so the k gates add up to 1 — the other experts get nothing.',
  ],
  provides: { route: 'moe.route' },
} satisfies ExerciseSpec;
