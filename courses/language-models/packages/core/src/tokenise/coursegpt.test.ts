/// <reference types="node" />
/**
 * Chapter 14 parity: CourseGPT's tokeniser, loaded in TypeScript from the file the site ships, encodes
 * TinyStories exactly as the Python tokeniser that prepared the training data
 * (fixture: `uv run lmc ch14 fixtures`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BpeTokeniser, type BpeSpec } from './bpe.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const spec = JSON.parse(readFileSync(root('course/static/data/coursegpt/tokeniser.json'), 'utf8')) as BpeSpec;
const fixture = JSON.parse(readFileSync(root('training/fixtures/coursegpt_tokens.json'), 'utf8')) as { texts: string[]; ids: number[][] };

describe('CourseGPT tokeniser parity with Python', () => {
  const tok = new BpeTokeniser(spec);

  it('has 8,192 tokens, the last of them <|endoftext|>', () => {
    expect(tok.vocabSize).toBe(8192);
    expect(tok.special.get('<|endoftext|>')).toBe(8191);
  });

  it('encodes every sample text to the same ids', () => {
    fixture.texts.forEach((text, i) => expect(tok.encode(text), text.slice(0, 40)).toEqual(fixture.ids[i]));
  });

  it('decodes back to the original text', () => {
    for (const text of fixture.texts) expect(tok.decode(tok.encode(text))).toBe(text);
  });
});
