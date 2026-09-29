import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch18/gqa',
  title: 'Grouped-query attention',
  starter,
  solution,
  tests,
  hints: [
    'With <code>h</code> query heads and <code>g</code> key/value heads, query head <code>i</code> uses key/value head <code>floor(i / (h / g))</code>: consecutive query heads share.',
    'For each query head, compute causal attention of its query (at the last position) over its shared head’s keys, softmax, and weight the shared values. Only <code>g</code> heads of keys and values need to be stored.',
  ],
} satisfies ExerciseSpec;
