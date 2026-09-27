import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch01/utf8-decode',
  title: 'Implement utf8Decode (harder)',
  starter,
  solution,
  tests,
  hints: [
    'Classify the lead byte: <code>C2–DF</code> starts 2 bytes, <code>E0–EF</code> starts 3, <code>F0–F4</code> starts 4. Anything else (<code>80–C1</code>, <code>F5–FF</code>) is invalid by itself.',
    'Accumulate the payload with <code>cp = (cp &lt;&lt; 6) | (b &amp; 0x3F)</code> while each following byte is in <code>80–BF</code>.',
    'Overlong forms, surrogates and values above U+10FFFF can be caught from the <em>second</em> byte alone: after <code>E0</code> it must be ≥ <code>A0</code>; after <code>ED</code> ≤ <code>9F</code>; after <code>F0</code> ≥ <code>90</code>; after <code>F4</code> ≤ <code>8F</code>.',
    'On an invalid byte, emit one U+FFFD for everything consumed so far and restart decoding <em>at</em> the offending byte, not after it.',
  ],
  provides: { utf8Decode: 'text.utf8Decode' },
} satisfies ExerciseSpec;
