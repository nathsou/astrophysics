import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch28/wrap-untrusted',
  title: 'Mark untrusted text',
  starter,
  solution,
  tests,
  hints: [
    'An attacker can write the closing tag themselves. Replace every “<” and “>” in the untrusted text with “‹” and “›” so no tag can appear inside.',
    'Then prefix every line with “^ ” (datamarking), and put the result between the opening and closing tags, each on its own line.',
  ],
  provides: { wrapUntrusted: 'safety.wrap' },
} satisfies ExerciseSpec;
