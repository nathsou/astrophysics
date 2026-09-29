import { expect, test } from '@lm/test';
import { gqaAttention } from './solution.ts';

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}
const r = rand(3);
const vec = (n: number) => Float32Array.from({ length: n }, r);

test('one position: each head returns its shared value head', () => {
  const V = Float32Array.of(1, 2, 3, 4); // T = 1, g = 2, d = 2
  const out = gqaAttention(vec(8), vec(4), V, 4, 2, 2);
  expect(Array.from(out)).toEqual([1, 2, 1, 2, 3, 4, 3, 4]);
});

test('with g = h it is ordinary multi-head attention; heads sharing a group see the same keys', () => {
  const h = 4, d = 3, T = 5;
  const q = vec(h * d), K = vec(T * 2 * d), V = vec(T * 2 * d);
  // Expand the 2 shared heads into 4 and compare.
  const K4 = new Float32Array(T * h * d), V4 = new Float32Array(T * h * d);
  for (let t = 0; t < T; t++) for (let i = 0; i < h; i++) for (let c = 0; c < d; c++) {
    K4[(t * h + i) * d + c] = K[(t * 2 + Math.floor(i / 2)) * d + c]!;
    V4[(t * h + i) * d + c] = V[(t * 2 + Math.floor(i / 2)) * d + c]!;
  }
  const a = gqaAttention(q, K, V, h, 2, d), b = gqaAttention(q, K4, V4, h, h, d);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));
});
