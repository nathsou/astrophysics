/// <reference types="node" />
/**
 * Chapter 15 parity: the samplers' prepared distributions match PyTorch's (training/lmcourse/sampling.py)
 * for the same logits, history and settings (fixture: `uv run lmc ch15 fixtures`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepare, type SamplerSettings } from './sample.ts';

interface Fixture {
  logits: number[][];
  history: number[][];
  cases: { settings: { temperature: number; top_k: number; top_p: number; min_p: number; repetition_penalty: number }; probs: number[][] }[];
}
const fx: Fixture = JSON.parse(readFileSync(new URL('../../../../training/fixtures/ch15_sampling.json', import.meta.url), 'utf8'));

describe('sampler parity with PyTorch', () => {
  for (const c of fx.cases) {
    const s: SamplerSettings = { temperature: c.settings.temperature, topK: c.settings.top_k, topP: c.settings.top_p, minP: c.settings.min_p, repetitionPenalty: c.settings.repetition_penalty };
    it(JSON.stringify(s), () => {
      fx.logits.forEach((z, row) => {
        const got = prepare(z, fx.history[row]!, s);
        c.probs[row]!.forEach((want, i) => expect(got[i]!).toBeCloseTo(want, 10));
      });
    });
  }
});
