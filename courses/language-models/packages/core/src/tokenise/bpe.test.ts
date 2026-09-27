import { describe, expect, it } from 'vitest';
import { BpeTokeniser, BpeTrainer, COURSE_PATTERN, GPT2_PATTERN, pretokenise, applyMerges } from './bpe.ts';
import { mulberry32 } from '../util/random.ts';

describe('pre-tokenisation', () => {
  it('splits words with their leading space, punctuation and contractions', () => {
    expect(pretokenise("Hello world, it's 2025!", GPT2_PATTERN)).toEqual(['Hello', ' world', ',', ' it', "'s", ' 2025', '!']);
  });
  it('groups digits in threes with the course pattern', () => {
    expect(pretokenise('Year 1234567', COURSE_PATTERN)).toEqual(['Year', ' 123', '456', '7']);
  });
  it('keeps runs of spaces before a word separate from the word', () => {
    expect(pretokenise('a   b', GPT2_PATTERN)).toEqual(['a', '  ', ' b']);
  });
});

describe('BPE training', () => {
  it('reproduces the textbook example (aaabdaaabac)', () => {
    const t = new BpeTrainer('aaabdaaabac');
    const steps = [t.step(), t.step(), t.step()];
    const a = 97, b = 98;
    expect(steps[0]!.pair).toEqual([a, a]); // 4 overlapping occurrences
    expect(steps[1]!.pair).toEqual([a, b]); // tie with (256, a) broken by the smaller first id
    expect(steps[2]!.pair).toEqual([256, 257]);
    expect(t.totalTokens).toBe(5); // Z Y d Z Y a c → [258, d, 258, a, c]
  });

  it('total token count matches encoding the training text', () => {
    const text = 'the cat sat on the mat. the cat ate the rat. '.repeat(20) + 'Überraschung! 🙂🙂';
    const t = new BpeTrainer(text);
    for (let i = 0; i < 40; i++) t.step();
    const tok = t.tokeniser();
    expect(tok.encode(text).length).toBe(t.totalTokens);
  });

  it('a merge reduces the token count by exactly its pair count', () => {
    const t = new BpeTrainer('abababab cdcd abab');
    const before = t.totalTokens;
    const s = t.step()!;
    expect(before - t.totalTokens).toBe(s.count);
  });
});

describe('BpeTokeniser', () => {
  const corpus = 'To be, or not to be, that is the question: whether ’tis nobler in the mind to suffer. '.repeat(10);
  const tok = BpeTokeniser.train(corpus, 60, { special: ['<|endoftext|>'] });

  it('round-trips arbitrary Unicode text', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 100; t++) {
      let s = '';
      for (let k = 0; k < 30; k++) {
        let cp = Math.floor(rng() * 0x10ffff);
        if (cp >= 0xd800 && cp <= 0xdfff) cp = 0x61;
        s += rng() < 0.6 ? 'the '[k % 4] : String.fromCodePoint(cp);
      }
      expect(tok.decode(tok.encode(s))).toBe(s);
    }
  });

  it('compresses text it was trained on', () => {
    expect(tok.encode(corpus).length).toBeLessThan(corpus.length / 3);
  });

  it('only emits special tokens when allowed', () => {
    const eot = tok.special.get('<|endoftext|>')!;
    expect(tok.encode('hi<|endoftext|>there')).not.toContain(eot);
    expect(tok.encode('hi<|endoftext|>there', { allowSpecial: true })).toContain(eot);
    expect(tok.decode(tok.encode('a<|endoftext|>b', { allowSpecial: true }))).toBe('a<|endoftext|>b');
  });

  it('serialises and reloads identically', () => {
    const again = new BpeTokeniser(JSON.parse(JSON.stringify(tok.toJSON())));
    expect(again.encode(corpus)).toEqual(tok.encode(corpus));
  });

  it('applies merges by rank, not left to right', () => {
    // ranks: (b,c) first, then (a,b). "abc" must become [a, bc], not [ab, c].
    const ranks = new Map([[98 * 2 ** 20 + 99, 0], [97 * 2 ** 20 + 98, 1]]);
    expect(applyMerges([97, 98, 99], ranks)).toEqual([97, 256]);
  });
});
