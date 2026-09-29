import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch23/constrained',
  title: 'Could this still match?',
  starter,
  solution,
  tests,
  hints: [
    'Walk the pattern with a position in the string. A literal must match character by character — but if the string ends partway through a literal, that is fine: it is a prefix.',
    'For a class, consume as many characters of the class as you can (up to max). If the string ends inside the class run, it is a prefix. Otherwise the run must be at least min long, then continue with the next part.',
  ],
  provides: { isPrefix: 'tool.prefix' },
} satisfies ExerciseSpec;
