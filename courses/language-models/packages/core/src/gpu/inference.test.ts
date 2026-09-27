/**
 * The KV-cached forward pass must give the same logits as running the whole sequence through the model,
 * whether the tokens arrive all at once, one by one, or in chunks; int8 weights must stay close.
 */
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../util/random.ts';
import { Tensor } from '../tensor/tensor.ts';
import { Gpt } from './gpt.ts';
import { GptRunner, quantiseInt8 } from './inference.ts';
import { GpuIds } from './nn.ts';
import { noGradGpu, scope } from './tensor.ts';
import { nodeGpu } from './node.ts';
import type { GpuContext } from './context.ts';

const cfg = { V: 37, T: 16, C: 32, layers: 2, heads: 4 };
const ids = [3, 17, 5, 0, 36, 12, 9, 9, 21, 4, 30];

async function fullLogits(gpu: GpuContext, model: Gpt, seq: number[]): Promise<Float32Array> {
  const x = new GpuIds(gpu, seq);
  const l = noGradGpu(() => scope(() => model.logits(model.hidden(x, 1, seq.length).h)));
  const out = await l.read();
  l.dispose();
  x.dispose();
  return out;
}

async function randomModel(gpu: GpuContext): Promise<Gpt> {
  const model = new Gpt(gpu, cfg, mulberry32(1));
  // Larger-than-initial weights, so every part of the network matters.
  const rng = mulberry32(2);
  const state = await model.state();
  for (const [name, t] of state) state.set(name, { shape: t.shape, data: Tensor.randn(t.shape, { rng, std: name.includes('ln') ? 0.3 : 0.2 }).toFloat32Array().map((v) => (name.endsWith('.g') ? 1 + v : v)) });
  model.load(state);
  return model;
}

describe('KV-cached inference', () => {
  it('matches the full forward pass: prefill, then one token at a time, then a chunk', async (t) => {
    const gpu = await nodeGpu();
    if (!gpu) return t.skip();
    const model = await randomModel(gpu);
    const full = await fullLogits(gpu, model, ids);
    const run = await GptRunner.create(model);
    const cache = run.cache();
    const check = async (logits: Awaited<ReturnType<typeof run.forward>>, positions: number[]) => {
      const got = await logits.read();
      logits.dispose();
      positions.forEach((pos, i) => {
        for (let v = 0; v < cfg.V; v++) expect(got[i * cfg.V + v]!).toBeCloseTo(full[pos * cfg.V + v]!, 4);
      });
    };
    await check(run.forward(cache, ids.slice(0, 4), { all: true }), [0, 1, 2, 3]);
    for (let i = 4; i < 7; i++) await check(run.forward(cache, [ids[i]!]), [i]);
    await check(run.forward(cache, ids.slice(7), { all: true }), [7, 8, 9, 10]);
    expect(cache.length).toBe(ids.length);
    cache.dispose();
  });

  it('rolls back by shortening the cache', async (t) => {
    const gpu = await nodeGpu();
    if (!gpu) return t.skip();
    const model = await randomModel(gpu);
    const run = await GptRunner.create(model);
    const cache = run.cache();
    run.forward(cache, ids.slice(0, 5)).dispose();
    run.forward(cache, [1, 2, 3]).dispose(); // a wrong guess…
    cache.length = 5; // …discarded
    const logits = run.forward(cache, [ids[5]!]);
    const got = await logits.read();
    const full = await fullLogits(gpu, model, ids.slice(0, 6));
    for (let v = 0; v < cfg.V; v++) expect(got[v]!).toBeCloseTo(full[5 * cfg.V + v]!, 4);
  });

  it('int8 weights stay close to float32', async (t) => {
    const gpu = await nodeGpu();
    if (!gpu) return t.skip();
    const model = await randomModel(gpu);
    const full = await fullLogits(gpu, model, ids);
    const run = await GptRunner.create(model, { int8: true });
    expect(run.int8).toBe(true);
    const logits = run.forward(run.cache(), ids, { all: true });
    const got = await logits.read();
    let worst = 0, scale = 0;
    for (let i = 0; i < got.length; i++) {
      worst = Math.max(worst, Math.abs(got[i]! - full[i]!));
      scale = Math.max(scale, Math.abs(full[i]!));
    }
    expect(worst / scale).toBeLessThan(0.05);
    expect(run.weightBytes).toBeLessThan(0.4 * model.numParameters * 4);
  });
});

describe('int8 quantisation', () => {
  it('maps each column’s largest magnitude to ±127 and rounds the rest', () => {
    const w = Float32Array.of(1, -4, 0.5, 2, 0.25, -1); // 2 × 3
    const { q, scale } = quantiseInt8(w, 2, 3, false);
    expect(Array.from(scale)).toEqual([2 / 127, 4 / 127, 1 / 127].map(Math.fround));
    expect(Array.from(q.slice(0, 6))).toEqual([64, -127, 64, 127, 8, -127]);
  });
});
