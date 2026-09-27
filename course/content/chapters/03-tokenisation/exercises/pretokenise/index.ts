import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch03/pretokenise',
  title: 'Write the pre-tokenisation regex',
  starter,
  solution,
  tests,
  hints: [
    'Build it as alternatives separated by <code>|</code>. The regex engine tries them left to right at each position, so put contractions first.',
    'Words: <code> ?\\p{L}+</code>. Numbers: <code> ?\\p{N}+</code>. Everything else that is not a space, letter or number: <code> ?[^\\s\\p{L}\\p{N}]+</code>.',
    'For whitespace, <code>\\s+(?!\\S)</code> matches a run of spaces but backs off by one if the next character starts a word; a final <code>\\s+</code> catches the rest.',
  ],
} satisfies ExerciseSpec;
