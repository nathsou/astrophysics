import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch01/entropy',
  title: 'Implement entropy',
  starter,
  solution,
  tests,
  hints: [
    'Normalise first: <code>p = count / total</code>. Guard against <code>total === 0</code>.',
    '<code>0 · log 0</code> is <code>NaN</code> in floating point, but its limit is 0 — skip zero counts.',
    'JavaScript has <code>Math.log2</code> but not an arbitrary base; use <code>Math.log(x) / Math.log(base)</code>.',
  ],
  provides: { entropy: 'text.entropy' },
} satisfies ExerciseSpec;
