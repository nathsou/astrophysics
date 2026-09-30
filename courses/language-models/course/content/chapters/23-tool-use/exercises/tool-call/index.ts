import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch23/tool-call',
  title: 'Run the tool',
  starter,
  solution,
  tests,
  hints: [
    'Find the last `[`. The call is open if there is no `]` after it, and complete if the text ends with `=`.',
    'The expression between `[` and `=` is numbers joined by `+`: split, convert with Number, and add. Return the sum followed by `]`.',
  ],
  provides: { toolStep: 'tool.step' },
} satisfies ExerciseSpec;
