import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch02/cross-entropy',
  title: 'Measure cross-entropy',
  starter,
  solution,
  tests,
  hints: [
    'Loop <code>t</code> from <code>contextLength</code> to <code>ids.length − 1</code>; the context is <code>ids.slice(t − contextLength, t)</code>.',
    'Use <code>Math.log2</code> and remember the minus sign: surprisal is positive.',
    'Return early with <code>Infinity</code> as soon as a probability is 0 — <code>Math.log2(0)</code> is <code>-Infinity</code>, which works too, but be explicit.',
  ],
  provides: { crossEntropyBits: 'lm.crossEntropyBits' },
} satisfies ExerciseSpec;
