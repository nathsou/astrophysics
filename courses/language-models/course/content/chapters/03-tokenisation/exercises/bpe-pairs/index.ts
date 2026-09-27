import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch03/bpe-pairs',
  title: 'Count pairs and merge them',
  starter,
  solution,
  tests,
  hints: ['In <code>mergePair</code>, when you find the pair at <code>i</code>, push <code>newId</code> and skip index <code>i + 1</code>.'],
} satisfies ExerciseSpec;
