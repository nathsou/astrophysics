import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch16/prompt-lookup',
  title: 'Drafting from the context (prompt lookup)',
  starter,
  solution,
  tests,
  hints: [
    'Take the last n tokens as the pattern, then scan backwards from the position just before them, looking for an earlier place where the same n tokens occur.',
    'At the most recent match, the draft is the (up to) k tokens that followed it in the context. With no match, return an empty draft — the caller then decodes normally.',
  ],
  provides: { promptLookup: 'spec.promptLookup' },
} satisfies ExerciseSpec;
