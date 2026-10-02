import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch08/reduce',
  title: 'A parallel sum',
  optional: true,
  starter,
  solution,
  tests,
  hints: [
    'Phase 1: <code>for (var i = lid.x; i < p.n; i += 256u) { s += x[i]; }</code> then <code>part[lid.x] = s;</code> and a barrier.',
    'Phase 2: for <code>stride</code> = 128, 64, …, 1: threads with <code>lid.x < stride</code> add <code>part[lid.x + stride]</code> into <code>part[lid.x]</code>; every thread then hits <code>workgroupBarrier()</code> — outside the <code>if</code>.',
  ],
} satisfies ExerciseSpec;
