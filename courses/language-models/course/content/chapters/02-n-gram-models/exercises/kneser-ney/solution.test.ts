import { expect, test } from '@lm/test';
import { kneserNeyBigram } from './solution.ts';

// a b a c a b  (a=0, b=1, c=2). Bigrams: ab×2, ba, ac, ca.
// P_cont: a is preceded by {b, c} → 2/4; b by {a} → 1/4; c by {a} → 1/4.
const p = kneserNeyBigram([0, 1, 0, 2, 0, 1], 4, 0.5);

test('discounts seen bigrams and interpolates with continuation counts', () => {
  expect(p(0, 1)).toBeCloseTo(1.5 / 3 + (0.5 * 2) / 3 * 0.25, 12); // 0.58333
  expect(p(0, 2)).toBeCloseTo(0.5 / 3 + (1 / 3) * 0.25, 12); // 0.25
});

test('gives unseen continuations mass in proportion to P_cont', () => {
  expect(p(0, 0)).toBeCloseTo((1 / 3) * 0.5, 12);
  expect(p(1, 2)).toBeCloseTo(0.5 * 0.25, 12);
});

test('distributions sum to 1 for seen contexts', () => {
  for (const v of [0, 1, 2]) {
    let s = 0;
    for (let w = 0; w < 4; w++) s += p(v, w);
    expect(s).toBeCloseTo(1, 12);
  }
});

test('an unseen context falls back to P_cont', () => {
  expect(p(3, 0)).toBeCloseTo(0.5, 12);
  expect(p(3, 3)).toBe(0);
});
