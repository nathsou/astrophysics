import { expect, test } from '@lm/test';
import { BpeTokeniser } from '@lm/core/tokenise';
import { encode, decode } from './solution.ts';

const a = 97, b = 98, c = 99;

test('with no merges, tokens are bytes', () => {
  expect(encode('hé', [])).toEqual([104, 0xc3, 0xa9]);
});

test('applies merges', () => {
  expect(encode('abab', [[a, b]])).toEqual([256, 256]);
  expect(encode('abab', [[a, b], [256, 256]])).toEqual([257]);
});

test('respects merge rank, not position', () => {
  // (b, c) was learned first, so "abc" → [a, bc] even though (a, b) comes first in the text.
  expect(encode('abc', [[b, c], [a, b]])).toEqual([a, 256]);
});

test('decodes, including multi-byte characters split across tokens', () => {
  const merges: [number, number][] = [[0xc3, 0xa9]];
  expect(decode(encode('café', merges), merges)).toBe('café');
  expect(decode([0xe6, 0x97, 0xa5], [])).toBe('日');
});

test('matches the library on a trained tokeniser', () => {
  const text = 'the theatre, the theme, the thesis; there, then, thence';
  const tok = BpeTokeniser.train(text, 20, { pattern: '[\\s\\S]+' });
  expect(encode(text, tok.merges)).toEqual(tok.encode(text));
  expect(decode(tok.encode(text), tok.merges)).toBe(text);
});
