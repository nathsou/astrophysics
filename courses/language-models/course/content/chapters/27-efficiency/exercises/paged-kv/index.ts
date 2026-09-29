import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch27/paged-kv',
  title: 'Paged KV memory',
  starter,
  solution,
  tests,
  hints: [
    'A sequence of length n needs ⌈n / B⌉ blocks of B tokens; only its last block can be partly empty.',
    'Reserving the maximum length for every sequence wastes max − n slots per sequence; paging wastes at most B − 1.',
  ],
  provides: { kvSlots: 'eff.paged' },
} satisfies ExerciseSpec;
