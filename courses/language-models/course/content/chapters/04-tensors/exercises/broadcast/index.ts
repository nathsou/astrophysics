import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch04/broadcast',
  title: 'Broadcast two shapes',
  starter,
  solution,
  tests,
  hints: [
    'Let <code>n</code> be the longer length. For position <code>i</code> of the result, read <code>a[a.length − n + i]</code>, which is <code>undefined</code> (so treat it as 1) for missing leading dimensions.',
    'Careful with zero-size dimensions: 0 against 1 is fine and gives 0 — <code>Math.max</code> would give the wrong answer there.',
  ],
} satisfies ExerciseSpec;
