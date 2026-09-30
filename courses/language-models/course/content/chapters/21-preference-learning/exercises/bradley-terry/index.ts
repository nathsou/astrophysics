import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch21/bradley-terry',
  title: 'The Bradley–Terry model',
  starter,
  solution,
  tests,
  hints: [
    'The probability that A is preferred to B is σ(r_A − r_B) = 1 / (1 + e^−(r_A − r_B)). Only the difference of rewards matters.',
    'The loss for one comparison is −log σ(r_chosen − r_rejected). For large negative differences compute it stably as log(1 + e^−d): use d ≥ 0 ? log1p(exp(−d)) : −d + log1p(exp(d)).',
  ],
  provides: { preferProbability: 'pref.prob' },
} satisfies ExerciseSpec;
