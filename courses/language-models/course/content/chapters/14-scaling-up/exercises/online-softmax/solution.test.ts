import { expect, test } from '@lm/test';
import { attendOnline } from './solution.ts';

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
}

/** Two passes: all the scores, their softmax, then the weighted sum of values. */
function reference(q: Float32Array, K: Float32Array[], V: Float32Array[]): number[] {
  const s = K.map((k) => k.reduce((a, x, j) => a + x * q[j]!, 0) / Math.sqrt(q.length));
  const m = Math.max(...s);
  const e = s.map((x) => Math.exp(x - m));
  const z = e.reduce((a, b) => a + b, 0);
  return Array.from(V[0]!, (_, j) => e.reduce((a, p, i) => a + (p / z) * V[i]![j]!, 0));
}

const r = rand(7);
const vec = (n: number, scale = 1) => Float32Array.from({ length: n }, () => r() * scale);
const q = vec(8), K = Array.from({ length: 13 }, () => vec(8, 2)), V = Array.from({ length: 13 }, () => vec(5));

test('matches two-pass attention', () => {
  const want = reference(q, K, V);
  Array.from(attendOnline(q, K, V, 4)).forEach((x, j) => expect(x).toBeCloseTo(want[j]!, 5));
});

test('gives the same answer for every block size', () => {
  const want = Array.from(attendOnline(q, K, V, K.length));
  for (const b of [1, 2, 3, 5, 100]) Array.from(attendOnline(q, K, V, b)).forEach((x, j) => expect(x).toBeCloseTo(want[j]!, 5));
});

test('stays finite when scores are huge', () => {
  const big = Array.from({ length: 6 }, (_, i) => Float32Array.of(1000 + 20 * i, 0));
  const vals = Array.from({ length: 6 }, (_, i) => Float32Array.of(i));
  const out = attendOnline(Float32Array.of(Math.SQRT2, 0), big, vals, 2)[0]!;
  expect(Number.isFinite(out)).toBe(true);
  expect(out).toBeCloseTo(5, 3); // the last key's score is far larger than the rest
});
