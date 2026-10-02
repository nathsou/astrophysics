import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch02/kneser-ney',
  title: 'Kneser–Ney for bigrams (harder)',
  optional: true,
  starter,
  solution,
  tests,
  hints: [
    'Count bigrams in a <code>Map</code> keyed by <code>v·V + w</code>. Every entry is one distinct bigram <em>type</em>.',
    'One pass over the map gives you everything else: add <code>c</code> to <code>c(v •)</code>, and add 1 to both <code>N₁₊(v •)</code> and <code>N₁₊(• w)</code>. <code>N₁₊(• •)</code> is the map’s size.',
    'Check your arithmetic on the test corpus by hand: the three probabilities after <code>a</code> must sum to 1.',
  ],
} satisfies ExerciseSpec;
