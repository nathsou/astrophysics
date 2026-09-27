import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch03/bpe-encode',
  title: 'Encode and decode with BPE',
  starter,
  solution,
  tests,
  hints: [
    'Build a lookup from <code>"a,b"</code> to the merge index once, before the loop.',
    'Each round: scan all adjacent pairs, find the smallest rank, merge that pair everywhere. When no pair has a rank, you are done.',
    'Decoding: a token’s bytes are its two parents’ bytes concatenated. Build the table in merge order so parents always exist.',
  ],
} satisfies ExerciseSpec;
