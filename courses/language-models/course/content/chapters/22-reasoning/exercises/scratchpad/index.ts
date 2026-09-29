import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch22/scratchpad',
  title: 'Write the scratchpad',
  starter,
  solution,
  tests,
  hints: [
    'Pad both numbers to 6 digits and walk the columns from the right (reverse the digit strings).',
    'Each step is `x+y+carry=s`, and the next carry is Math.floor(s / 10). Join the steps with commas, then append `>` and the sum.',
  ],
  provides: { scratchpad: 'reason.scratchpad' },
} satisfies ExerciseSpec;
