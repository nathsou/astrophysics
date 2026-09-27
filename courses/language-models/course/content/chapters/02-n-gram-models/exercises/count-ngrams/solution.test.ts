import { expect, test } from '@lm/test';
import { NGramCounter } from './solution.ts';

// "a b a b a c" as ids: a=0, b=1, c=2
const ids = [0, 1, 0, 1, 0, 2];

test('counts unigrams', () => {
  const c = new NGramCounter(ids, 1);
  expect(c.count([0])).toBe(3);
  expect(c.count([2])).toBe(1);
});

test('counts bigrams', () => {
  const c = new NGramCounter(ids, 2);
  expect(c.count([0, 1])).toBe(2);
  expect(c.count([1, 0])).toBe(2);
  expect(c.count([0, 2])).toBe(1);
  expect(c.count([2, 0])).toBe(0);
});

test('bigram MLE is a relative frequency', () => {
  const c = new NGramCounter(ids, 2);
  expect(c.prob([0], 1)).toBeCloseTo(2 / 3, 10);
  expect(c.prob([0], 2)).toBeCloseTo(1 / 3, 10);
  expect(c.prob([0], 0)).toBe(0);
});

test('uses only the last n − 1 tokens of the context', () => {
  const c = new NGramCounter(ids, 2);
  expect(c.prob([2, 2, 2, 0], 1)).toBeCloseTo(2 / 3, 10);
});

test('unigram probabilities ignore the context', () => {
  const c = new NGramCounter(ids, 1);
  expect(c.prob([1, 1], 0)).toBeCloseTo(3 / 6, 10);
});

test('an unseen context gives 0', () => {
  const c = new NGramCounter(ids, 3);
  expect(c.prob([2, 2], 0)).toBe(0);
});

test('every seen context gives a distribution that sums to 1', () => {
  const long = Array.from({ length: 500 }, (_, i) => (i * i + 3 * i) % 5);
  const c = new NGramCounter(long, 3);
  for (const key of c.contexts.keys()) {
    const h = key.split(',').map(Number);
    let s = 0;
    for (let w = 0; w < 5; w++) s += c.prob(h, w);
    expect(s).toBeCloseTo(1, 10);
  }
});
