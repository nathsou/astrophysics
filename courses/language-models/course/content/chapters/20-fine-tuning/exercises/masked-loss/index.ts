import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch20/masked-loss',
  title: 'Loss on the response only',
  starter,
  solution,
  tests,
  hints: [
    'Average −log p(target) over the positions whose mask is true, and ignore the others completely — they add neither to the sum nor to the count.',
    'Use a stable log-softmax: subtract the row maximum before exponentiating.',
  ],
} satisfies ExerciseSpec;
