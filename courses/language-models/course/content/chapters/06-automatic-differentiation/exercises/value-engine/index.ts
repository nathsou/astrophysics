import type { ExerciseSpec } from '$lib/content/types';
import starter from './starter.ts?raw';
import solution from './solution.ts?raw';
import tests from './solution.test.ts?raw';

export default {
  id: 'ch06/value-engine',
  title: 'Two local derivatives in a working autograd engine',
  starter,
  solution,
  tests,
  hints: [
    'Each <code>backwardFn</code> follows the pattern in <code>add</code>: <code>parent.grad += (local derivative) × out.grad</code>. Use <code>+=</code>, never <code>=</code> — a value can feed several nodes.',
    'Traversal, addition and unary operations are supplied. Fill in only <code>mul</code> and <code>tanh</code>; then try a value used twice in the same expression.',
    'Seed <code>this.grad = 1</code> (dL/dL), then walk the order backwards calling <code>backwardFn</code>.',
  ],
} satisfies ExerciseSpec;
