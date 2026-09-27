import { describe, expect, it } from 'vitest';
import { codePoints, utf8Encode, utf8Decode, graphemes, words, entropy, fitPowerLaw, countFrequencies, rankFrequencies, vocabularyGrowth } from './index.ts';

const samples = ['', 'hello', 'héllo wörld', '日本語テキスト', '🙂👍🏽', 'é', '👩‍👩‍👧‍👦 family', 'mixed ASCII + ÆØÅ + 中文 + 𝔘𝔫𝔦𝔠𝔬𝔡𝔢'];

describe('unicode', () => {
  it('code points match the iterator protocol', () => {
    for (const s of samples) expect(codePoints(s)).toEqual([...s].map((c) => c.codePointAt(0)));
  });

  it('utf8Encode matches TextEncoder, including lone surrogates', () => {
    const enc = new TextEncoder();
    for (const s of [...samples, 'lone \ud800 surrogate', '\udc00']) expect(utf8Encode(s)).toEqual(enc.encode(s));
  });

  it('round-trips random code points', () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let t = 0; t < 200; t++) {
      let s = '';
      for (let k = 0; k < 20; k++) {
        let cp = Math.floor(rand() * 0x110000);
        if (cp >= 0xd800 && cp <= 0xdfff) cp = 0x41;
        s += String.fromCodePoint(cp);
      }
      expect(utf8Decode(utf8Encode(s))).toBe(s);
    }
  });

  it('decodes malformed input like TextDecoder', () => {
    const dec = new TextDecoder();
    const cases = [[0x80], [0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe2, 0x82], [0x41, 0xe2, 0x41], [0xf0, 0x9f, 0x99]];
    for (const c of cases) expect(utf8Decode(new Uint8Array(c))).toBe(dec.decode(new Uint8Array(c)));
  });

  it('segments graphemes', () => {
    expect(graphemes('é👩‍👩‍👧‍👦!')).toHaveLength(3);
  });
});

describe('stats', () => {
  it('splits words', () => {
    expect(words("To be, or not to be: that's the Question.")).toEqual(['to', 'be', 'or', 'not', 'to', 'be', "that's", 'the', 'question']);
  });

  it('ranks frequencies', () => {
    const r = rankFrequencies(countFrequencies('abracadabra'));
    expect(r[0]).toEqual({ item: 'a', count: 5, rank: 1 });
  });

  it('computes entropy', () => {
    expect(entropy([1, 1])).toBeCloseTo(1);
    expect(entropy([1, 1, 1, 1])).toBeCloseTo(2);
    expect(entropy([5, 0])).toBe(0);
  });

  it('recovers an exact power law', () => {
    const r = Array.from({ length: 100 }, (_, i) => i + 1);
    const f = r.map((x) => 1000 / x ** 1.1);
    const fit = fitPowerLaw(r, f);
    expect(fit.s).toBeCloseTo(1.1, 6);
    expect(fit.C).toBeCloseTo(1000, 3);
    expect(fit.r2).toBeCloseTo(1, 6);
  });

  it('tracks vocabulary growth', () => {
    const g = vocabularyGrowth(['a', 'b', 'a', 'c']);
    expect(g.at(-1)).toEqual({ n: 4, v: 3 });
  });
});
