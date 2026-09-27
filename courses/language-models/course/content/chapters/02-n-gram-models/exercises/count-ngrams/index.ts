import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch02/count-ngrams',
  title: 'Count n-grams and estimate P(next | context)',
  starter,
  solution,
  tests,
  hints: [
    'The window starting at <code>t</code> is <code>ids.slice(t, t + n)</code>; stop when <code>t + n &gt; ids.length</code>.',
    'The context key is the first <code>n − 1</code> ids of each window. Increment it in <code>contexts</code> at the same time as the n-gram.',
    'In <code>prob</code>, take <code>context.slice(context.length − (n − 1))</code> — but watch out: for <code>n = 1</code> that slice is <em>not</em> empty.',
  ],
} satisfies ExerciseSpec;
