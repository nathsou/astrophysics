/**
 * The browser GPT against PyTorch (training/lmcourse/model.py): the same weights must give the same
 * logits and loss. Fixture written by `python -m lmcourse.gpt_fixture`.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../util/random.ts';
import { Gpt } from './gpt.ts';
import { GpuIds } from './nn.ts';
import { noGradGpu, scope } from './tensor.ts';
import { nodeGpu } from './node.ts';

interface Fixture {
  config: { vocab: number; context: number; width: number; layers: number; heads: number };
  weights: Record<string, { shape: number[]; data: number[] }>;
  ids: number[];
  targets: number[];
  logits: number[];
  loss: number;
}
const fx: Fixture = JSON.parse(readFileSync(new URL('../../../../training/fixtures/gpt_parity.json', import.meta.url), 'utf8'));

describe('GPT parity with PyTorch', () => {
  it('computes the same logits and loss from the same weights', async (t) => {
    const gpu = await nodeGpu();
    if (!gpu) return t.skip();
    const { vocab: V, context: T, width: C, layers, heads } = fx.config;
    const model = new Gpt(gpu, { V, T, C, layers, heads }, mulberry32(0));
    const names = [...model.named.keys()].sort();
    expect(names).toEqual(Object.keys(fx.weights).sort());
    model.load(new Map(Object.entries(fx.weights).map(([k, v]) => [k, { shape: v.shape, data: Float32Array.from(v.data) }])));
    const B = fx.ids.length / T;
    const ids = new GpuIds(gpu, fx.ids), targets = new GpuIds(gpu, fx.targets);
    const { logits, loss } = noGradGpu(() => scope(() => {
      const h = model.hidden(ids, B, T).h;
      return { logits: model.logits(h), loss: model.loss(ids, targets, B, T) };
    }));
    const got = await logits.read();
    let worst = 0;
    for (let i = 0; i < got.length; i++) worst = Math.max(worst, Math.abs(got[i]! - fx.logits[i]!));
    expect(worst).toBeLessThan(1e-4);
    expect(await loss.item()).toBeCloseTo(fx.loss, 5);
  });
});
