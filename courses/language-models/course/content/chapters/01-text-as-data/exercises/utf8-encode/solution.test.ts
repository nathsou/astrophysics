import { expect, test } from '@lm/test';
import { utf8Encode } from './solution.ts';

const reference = (s: string) => new TextEncoder().encode(s);

test('returns a Uint8Array', () => {
  expect(utf8Encode('a')).toBeInstanceOf(Uint8Array);
});

test('ASCII is one byte per character', () => {
  expect(utf8Encode('Hi!')).toEqual(new Uint8Array([0x48, 0x69, 0x21]));
});

test('é (U+00E9) takes two bytes', () => {
  expect(utf8Encode('é')).toEqual(new Uint8Array([0xc3, 0xa9]));
});

test('€ (U+20AC) takes three bytes', () => {
  expect(utf8Encode('€')).toEqual(new Uint8Array([0xe2, 0x82, 0xac]));
});

test('😀 (U+1F600) takes four bytes', () => {
  expect(utf8Encode('😀')).toEqual(new Uint8Array([0xf0, 0x9f, 0x98, 0x80]));
});

test('range boundaries match TextEncoder', () => {
  for (const cp of [0x7f, 0x80, 0x7ff, 0x800, 0xfffd, 0xffff, 0x10000, 0x10ffff]) {
    const s = String.fromCodePoint(cp);
    expect(utf8Encode(s)).toEqual(reference(s));
  }
});

test('mixed text matches TextEncoder', () => {
  const s = 'Naïve café — 日本語 🙂👍🏽 𝔘𝔫𝔦𝔠𝔬𝔡𝔢\n';
  expect(utf8Encode(s)).toEqual(reference(s));
});

test('a lone surrogate becomes U+FFFD (EF BF BD)', () => {
  expect(utf8Encode('a\ud800b')).toEqual(new Uint8Array([0x61, 0xef, 0xbf, 0xbd, 0x62]));
});
