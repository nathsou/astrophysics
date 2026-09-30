import { expect, test } from '@lm/test';
import { loraForward, merge } from './solution.ts';

const n = 3, m = 2, r = 1;
const W = Float32Array.of(1, 0, 0, 1, 1, 1);
const x = Float32Array.of(1, 2, 3);

test('with B = 0 the layer is unchanged', () => {
  expect(Array.from(loraForward(x, W, Float32Array.of(1, 1, 1), new Float32Array(2), n, m, r, 1))).toEqual([4, 5]);
});

test('adds the scaled low-rank path', () => {
  // x·A = 1·1 + 2·0 + 3·(−1) = −2;  (α/r)·(−2)·[1, 2] with α = 2 → [−4, −8].
  const y = loraForward(x, W, Float32Array.of(1, 0, -1), Float32Array.of(1, 2), n, m, r, 2);
  expect(Array.from(y)).toEqual([0, -3]);
});

test('merging gives the same outputs as the two-path layer', () => {
  const A = Float32Array.of(0.5, -1, 2), B = Float32Array.of(0.3, -0.7), merged = merge(W, A, B, n, m, r, 4);
  const plain = loraForward(x, merged, new Float32Array(3), new Float32Array(2), n, m, r, 4);
  const lora = loraForward(x, W, A, B, n, m, r, 4);
  plain.forEach((v, i) => expect(v).toBeCloseTo(lora[i]!, 5));
});
