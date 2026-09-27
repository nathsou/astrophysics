/// <reference types="node" />
/**
 * Chapter 14 parity: the trained CourseGPT, loaded into the browser's `Gpt` from the safetensors file the
 * site serves, computes the same logits and loss as PyTorch (fixture: `uv run lmc ch14 fixtures`).
 * Skipped when the weights have not been downloaded (`node scripts/weights.mjs`) or there is no GPU.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeSafetensors } from '../util/safetensors.ts';
import { mulberry32 } from '../util/random.ts';
import { Gpt } from './gpt.ts';
import { GpuIds } from './nn.ts';
import { noGradGpu, scope } from './tensor.ts';
import { nodeGpu } from './node.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const weights = root('course/static/weights/coursegpt.safetensors');
const fixture = root('training/fixtures/coursegpt_logits.json');

describe('CourseGPT parity with PyTorch', () => {
  it('computes the same next-token logits and loss', async (t) => {
    const gpu = await nodeGpu();
    if (!gpu || !existsSync(weights) || !existsSync(fixture)) return t.skip();
    const fx = JSON.parse(readFileSync(fixture, 'utf8')) as { ids: number[]; targets: number[]; last_logits: number[]; loss: number };
    const { tensors, metadata } = decodeSafetensors(readFileSync(weights));
    const c = JSON.parse(metadata.config!) as { vocab: number; context: number; width: number; layers: number; heads: number };
    const model = new Gpt(gpu, { V: c.vocab, T: c.context, C: c.width, layers: c.layers, heads: c.heads }, mulberry32(0));
    model.load(tensors);
    const T = fx.ids.length;
    const ids = new GpuIds(gpu, fx.ids), targets = new GpuIds(gpu, fx.targets);
    const { logits, loss } = noGradGpu(() => scope(() => ({
      logits: model.logits(model.hidden(ids, 1, T).h),
      loss: model.loss(ids, targets, 1, T),
    })));
    const all = await logits.read();
    const last = all.subarray((T - 1) * c.vocab);
    let worst = 0;
    for (let i = 0; i < c.vocab; i++) worst = Math.max(worst, Math.abs(last[i]! - fx.last_logits[i]!));
    // float32 on the GPU against float64 in PyTorch, through eight layers: agreement to ~1e-4 is expected.
    expect(worst).toBeLessThan(2e-3);
    expect(await loss.item()).toBeCloseTo(fx.loss, 4);
    model.dispose();
  });
});
