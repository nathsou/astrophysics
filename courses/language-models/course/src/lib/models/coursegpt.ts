/**
 * CourseGPT in the browser (Chapter 14 onwards): its BPE tokeniser, shipped with the site, and its weights,
 * a bfloat16 safetensors file fetched from the release assets at build time (scripts/weights.mjs).
 * Both are loaded once per page and shared by every widget.
 */
import { base } from '$app/paths';
import { decodeSafetensors, mulberry32 } from '@lm/core';
import { BpeTokeniser, type BpeSpec } from '@lm/core/tokenise';
import { Gpt, GptRunner, GpuIds, noGradGpu, scope, sliceRows } from '@lm/core/gpu';
import { getGpu } from '$lib/gpu/compute';

export const EOT = '<|endoftext|>';

let tokeniser: Promise<BpeTokeniser> | undefined;

export function courseTokeniser(): Promise<BpeTokeniser> {
  tokeniser ??= fetch(`${base}/data/coursegpt/tokeniser.json`).then(async (r) => {
    if (!r.ok) throw new Error(`Could not load CourseGPT’s tokeniser (${r.status})`);
    return new BpeTokeniser((await r.json()) as BpeSpec);
  });
  return tokeniser;
}

export interface CourseGptConfig {
  vocab: number;
  context: number;
  width: number;
  layers: number;
  heads: number;
}

export interface CourseGpt {
  model: Gpt;
  tok: BpeTokeniser;
  cfg: CourseGptConfig;
  /** Training step the weights were exported at. */
  step: number;
  eot: number;
}

const loaded = new Map<string, Promise<CourseGpt>>();

/**
 * Download and build CourseGPT on the GPU. `onprogress` receives the fraction downloaded. Rejects if
 * WebGPU is unavailable or the weights are not part of this build.
 */
export function loadCourseGpt(onprogress?: (fraction: number) => void): Promise<CourseGpt> {
  return loadWeights('coursegpt', onprogress);
}

/** The small draft model of Chapter 16 (same tokeniser), for speculative decoding. */
export function loadDraftModel(onprogress?: (fraction: number) => void): Promise<CourseGpt> {
  return loadWeights('coursegpt-draft', onprogress);
}

function loadWeights(name: string, onprogress?: (fraction: number) => void): Promise<CourseGpt> {
  let p = loaded.get(name);
  if (!p) {
    p = (async () => {
      const gpu = await getGpu();
      if (!gpu) throw new Error('CourseGPT needs WebGPU, which this browser does not provide.');
      const [tok, bytes] = await Promise.all([courseTokeniser(), download(`${base}/weights/${name}.safetensors`, onprogress)]);
      const { tensors, metadata } = decodeSafetensors(bytes);
      const cfg = JSON.parse(metadata.config ?? '{}') as CourseGptConfig;
      const model = new Gpt(gpu, { V: cfg.vocab, T: cfg.context, C: cfg.width, layers: cfg.layers, heads: cfg.heads }, mulberry32(0));
      model.load(tensors);
      return { model, tok, cfg, step: Number(metadata.step ?? 0), eot: tok.special.get(EOT)! };
    })();
    p.catch(() => loaded.delete(name)); // allow a retry
    loaded.set(name, p);
  }
  return p;
}

const runners = new Map<string, Promise<GptRunner>>();

/** A KV-cached runner for a loaded model, with float32 or int8 weights (built once, then shared). */
export function runnerFor(m: CourseGpt, opts: { int8?: boolean } = {}): Promise<GptRunner> {
  const key = `${m.cfg.layers}x${m.cfg.width}:${opts.int8 ? 'int8' : 'f32'}`;
  let r = runners.get(key);
  if (!r) {
    r = GptRunner.create(m.model, opts);
    runners.set(key, r);
  }
  return r;
}

async function download(url: string, onprogress?: (fraction: number) => void): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status === 404 ? 'CourseGPT’s weights are not included in this build of the course.' : `Could not download CourseGPT (${r.status})`);
  const total = Number(r.headers.get('Content-Length') ?? 0);
  if (!r.body || !total) return new Uint8Array(await r.arrayBuffer());
  const out = new Uint8Array(total);
  const reader = r.body.getReader();
  let done = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    out.set(value, done);
    done += value.length;
    onprogress?.(done / total);
  }
  return out;
}

/**
 * Next-token logits after `ids` (the last `context` of them). The whole window is recomputed at every
 * call; Chapter 16's KV cache avoids that.
 */
export async function nextLogits(m: CourseGpt, ids: number[]): Promise<Float32Array> {
  const window = ids.slice(-m.cfg.context);
  const T = window.length;
  const X = new GpuIds((await getGpu())!, Uint32Array.from(window)); // the context the model was built on
  const logits = noGradGpu(() => scope(() => m.model.logits(sliceRows(m.model.hidden(X, 1, T).h, T - 1, 1))));
  const out = await logits.read();
  logits.dispose();
  X.dispose();
  return out;
}

/** Softmax with temperature, in float64 for accuracy. */
export function softmax(logits: ArrayLike<number>, temperature = 1): Float64Array {
  const t = Math.max(temperature, 1e-4);
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i]! / t);
  const p = new Float64Array(logits.length);
  let s = 0;
  for (let i = 0; i < logits.length; i++) s += p[i] = Math.exp(logits[i]! / t - max);
  for (let i = 0; i < p.length; i++) p[i]! /= s;
  return p;
}
