import { expect, test } from '@lm/test';
import { BpeTrainer } from '@lm/core/tokenise';
import { trainBpe } from './solution.ts';

/** The course library's fast trainer, treating the whole text as one chunk. */
function reference(text: string, n: number): [number, number][] {
  const t = new BpeTrainer(text, '[\\s\\S]+');
  while (t.merges.length < n && t.step()) {
    /* train */
  }
  return t.merges;
}

test('the textbook example: aaabdaaabac', () => {
  expect(trainBpe('aaabdaaabac', 3)).toEqual([
    [97, 97],
    [97, 98],
    [256, 257],
  ]);
});

test('merge ids build on earlier merges', () => {
  const m = trainBpe('abababab', 3);
  expect(m[0]).toEqual([97, 98]);
  expect(m[1]).toEqual([256, 256]);
});

test('stops when nothing is left to merge', () => {
  expect(trainBpe('ab', 5)).toEqual([[97, 98]]);
  expect(trainBpe('', 5)).toEqual([]);
});

test('matches the library trainer on real text', () => {
  const text = 'To be, or not to be, that is the question: whether ’tis nobler in the mind to suffer the slings and arrows.';
  expect(trainBpe(text, 25)).toEqual(reference(text, 25));
});

test('works on multi-byte UTF-8', () => {
  const text = 'café café naïve naïve 日本 日本 日本';
  expect(trainBpe(text, 12)).toEqual(reference(text, 12));
});
