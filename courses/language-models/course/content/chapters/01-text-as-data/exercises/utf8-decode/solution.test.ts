import { expect, test } from '@lm/test';
import { utf8Decode } from './solution.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: number[]) => new TextDecoder().decode(new Uint8Array(b));

test('decodes ASCII', () => {
  expect(utf8Decode(enc('hello'))).toBe('hello');
});

test('decodes 2-, 3- and 4-byte characters', () => {
  expect(utf8Decode(enc('é€😀'))).toBe('é€😀');
});

test('round-trips mixed text', () => {
  const s = 'Naïve café — 日本語 🙂👍🏽 𝔘𝔫𝔦𝔠𝔬𝔡𝔢';
  expect(utf8Decode(enc(s))).toBe(s);
});

test('a stray continuation byte becomes U+FFFD', () => {
  expect(utf8Decode(new Uint8Array([0x41, 0x80, 0x42]))).toBe('A�B');
});

test('a truncated sequence becomes a single U+FFFD', () => {
  expect(utf8Decode(new Uint8Array([0xe2, 0x82]))).toBe(dec([0xe2, 0x82]));
});

test('overlong encodings are rejected', () => {
  expect(utf8Decode(new Uint8Array([0xc0, 0xaf]))).toBe(dec([0xc0, 0xaf]));
  expect(utf8Decode(new Uint8Array([0xe0, 0x80, 0xaf]))).toBe(dec([0xe0, 0x80, 0xaf]));
});

test('encoded surrogates and values above U+10FFFF are rejected', () => {
  expect(utf8Decode(new Uint8Array([0xed, 0xa0, 0x80]))).toBe(dec([0xed, 0xa0, 0x80]));
  expect(utf8Decode(new Uint8Array([0xf4, 0x90, 0x80, 0x80]))).toBe(dec([0xf4, 0x90, 0x80, 0x80]));
});

test('decoding resumes correctly after an error', () => {
  expect(utf8Decode(new Uint8Array([0xf0, 0x9f, 0x99, 0x41]))).toBe(dec([0xf0, 0x9f, 0x99, 0x41]));
});
