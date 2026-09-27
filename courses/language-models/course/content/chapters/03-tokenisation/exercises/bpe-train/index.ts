import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch03/bpe-train',
  title: 'Train BPE',
  starter,
  solution,
  tests,
  hints: [
    'Reuse your <code>countPairs</code> and <code>mergePair</code> logic inside a loop that runs <code>numMerges</code> times.',
    'For tie-breaking, a numeric key <code>a · 65536 + b</code> sorts exactly by first id, then second id — so “smallest key” is the rule.',
    'This naïve version recounts every pair on every merge: O(merges × text length). Chapter 3’s library version updates counts incrementally — compare the speeds on TinyShakespeare.',
  ],
} satisfies ExerciseSpec;
