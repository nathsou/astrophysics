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
import manifest from '$content/weights.json';

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

/** CourseGPT fine-tuned to follow instructions (Chapter 20: LoRA, rank 16, merged). */
export function loadInstructModel(onprogress?: (fraction: number) => void): Promise<CourseGpt> {
  return loadWeights('coursegpt-instruct', onprogress);
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

/** A small character-level model with its own alphabet (stored in the file's metadata). */
export interface CharModel {
  model: Gpt;
  cfg: CourseGptConfig;
  chars: string;
}

const charModels = new Map<string, Promise<CharModel>>();

/** The calculator-calling model of Chapter 23 (4 × 256, characters). */
export function loadCalculatorModel(onprogress?: (fraction: number) => void): Promise<CharModel> {
  const name = 'calculator';
  let p = charModels.get(name);
  if (!p) {
    p = (async () => {
      const gpu = await getGpu();
      if (!gpu) throw new Error('This model needs WebGPU, which this browser does not provide.');
      const { tensors, metadata } = decodeSafetensors(await download(`${base}/weights/${name}.safetensors`, onprogress));
      const cfg = JSON.parse(metadata.config ?? '{}') as CourseGptConfig;
      const model = new Gpt(gpu, { V: cfg.vocab, T: cfg.context, C: cfg.width, layers: cfg.layers, heads: cfg.heads }, mulberry32(0));
      model.load(tensors);
      return { model, cfg, chars: metadata.chars ?? '' };
    })();
    p.catch(() => charModels.delete(name));
    charModels.set(name, p);
  }
  return p;
}

const runners = new WeakMap<Gpt, Map<string, Promise<GptRunner>>>();

/** A KV-cached runner for a loaded model, with float32 or int8 weights (built once, then shared). */
export function runnerFor(m: { model: Gpt; cfg: CourseGptConfig }, opts: { int8?: boolean } = {}): Promise<GptRunner> {
  // One runner per model and precision (keyed by the model itself: several models share a shape).
  let byModel = runners.get(m.model);
  if (!byModel) runners.set(m.model, (byModel = new Map()));
  const key = opts.int8 ? 'int8' : 'f32';
  let r = byModel.get(key);
  if (!r) {
    r = GptRunner.create(m.model, opts);
    byModel.set(key, r);
  }
  return r;
}

async function download(url: string, onprogress?: (fraction: number) => void): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status === 404 ? 'These weights are not included in this build of the course.' : `Could not download the weights (${r.status})`);
  // Don't size the buffer from Content-Length: it counts the bytes on the wire, and a server that
  // compresses the file (GitHub Pages gzips it) sends fewer than the stream delivers. The manifest
  // records the real size, for the progress bar.
  const name = url.slice(url.lastIndexOf('/') + 1);
  const expected = manifest.files.find((f) => f.name === name)?.bytes ?? Number(r.headers.get('Content-Length') ?? 0);
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = r.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (expected) onprogress?.(Math.min(0.99, received / expected));
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  onprogress?.(1);
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
