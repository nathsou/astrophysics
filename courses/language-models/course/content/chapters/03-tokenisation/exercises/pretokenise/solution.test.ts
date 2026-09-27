import { expect, test } from '@lm/test';
import { pretokenise } from './solution.ts';

test('words keep their leading space', () => {
  expect(pretokenise('Hello world')).toEqual(['Hello', ' world']);
});

test('punctuation is split off', () => {
  expect(pretokenise('Stop, now!')).toEqual(['Stop', ',', ' now', '!']);
});

test('contractions are separate chunks', () => {
  expect(pretokenise("it's we'll I'd")).toEqual(['it', "'s", ' we', "'ll", ' I', "'d"]);
});

test('numbers are separate from letters', () => {
  expect(pretokenise('abc123 45')).toEqual(['abc', '123', ' 45']);
});

test('whitespace runs give their last space to the next word', () => {
  expect(pretokenise('a   b')).toEqual(['a', '  ', ' b']);
  expect(pretokenise('end  \n')).toEqual(['end', '  \n']);
});

test('works for any script', () => {
  expect(pretokenise('naïve Ελλάδα 東京')).toEqual(['naïve', ' Ελλάδα', ' 東京']);
});

test('pieces always reassemble the original text', () => {
  const s = "Hmm... it's 3:45pm — ready?\n\tYes!  ";
  expect(pretokenise(s).join('')).toBe(s);
});
