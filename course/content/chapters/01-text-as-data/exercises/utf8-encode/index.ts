import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch01/utf8-encode',
  title: 'Implement utf8Encode',
  starter,
  solution,
  tests,
  hints: [
    'Decide the byte count from the code point first: compare against <code>0x80</code>, <code>0x800</code> and <code>0x10000</code>.',
    'The lead byte is the prefix OR-ed with the <em>highest</em> bits: for 3 bytes, <code>0xE0 | (cp &gt;&gt; 12)</code>. Each continuation byte is <code>0x80 | (six bits)</code>, e.g. <code>0x80 | ((cp &gt;&gt; 6) &amp; 0x3F)</code>.',
    'For the last test: code points <code>0xD800–0xDFFF</code> are surrogates, which are not valid on their own. Replace them with <code>0xFFFD</code> before encoding.',
  ],
  provides: { utf8Encode: 'text.utf8Encode' },
} satisfies ExerciseSpec;
