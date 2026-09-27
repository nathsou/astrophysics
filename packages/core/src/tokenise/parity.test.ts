/// <reference types="node" />
/**
 * Chapter 3 parity: our BPE trainer matches the Python one merge for merge, and our GPT-2 encoder
 * matches OpenAI's tiktoken token for token (fixture: `uv run lmc ch03 --write-fixture`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BpeTrainer, loadGpt2 } from './bpe.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const fixture = JSON.parse(readFileSync(root('training/fixtures/ch03_bpe.json'), 'utf8')) as {
  merges: [number, number][];
  sample: string;
  sample_ids: number[];
  gpt2: Record<string, number[]>;
};

describe('BPE parity with Python', () => {
  const text = readFileSync(root('course/static/data/tinyshakespeare.txt'), 'utf8');
  const trainer = new BpeTrainer(text);
  while (trainer.merges.length < 1024 && trainer.step()) {
    /* train */
  }

  it('learns the same merges in the same order', () => {
    expect(trainer.merges.slice(0, fixture.merges.length)).toEqual(fixture.merges);
  });

  it('encodes the sample identically', () => {
    expect(trainer.tokeniser(['<|endoftext|>']).encode(fixture.sample)).toEqual(fixture.sample_ids);
  });
});

describe('GPT-2 tokeniser matches tiktoken', () => {
  const { tokeniser, gpt2Id } = loadGpt2(
    readFileSync(root('course/static/data/gpt2/vocab.bpe'), 'utf8'),
    JSON.parse(readFileSync(root('course/static/data/gpt2/encoder.json'), 'utf8')),
  );
  for (const [s, expected] of Object.entries(fixture.gpt2)) {
    it(JSON.stringify(s), () => {
      const ids = tokeniser.encode(s).map((i) => gpt2Id[i]);
      expect(ids).toEqual(expected);
      expect(tokeniser.decode(tokeniser.encode(s))).toBe(s);
    });
  }
});
