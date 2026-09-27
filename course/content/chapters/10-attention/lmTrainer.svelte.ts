/**
 * An attention-only character language model trained in the browser, plus the attention maps of its
 * heads on a passage of validation text.
 */
import { CharVocab } from '@lm/core/tokenise';
import { GpuAdamW, GpuIds, clipGradNorm, noGradGpu, scope, type GpuContext, type GpuTensor } from '@lm/core/gpu';
import { mulberry32 } from '@lm/core';
import { loadCorpus } from '$lib/data/corpus';
import { getGpu } from '$lib/gpu/compute';
import { AttentionModel } from './model';

export const LM = { T: 128, C: 128, heads: 4, B: 32, lr: 3e-3, warmup: 100, steps: 3000 };
const EVAL_EVERY = 500;
/** A passage used to show attention maps (from the validation split). */
const MAP_START = 5_210;

class AttentionLmTrainer {
  layers = $state(2);
  status = $state<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  running = $state(false);
  step = $state(0);
  history = $state.raw<{ step: number; train: number; val: number }[]>([]);
  msPerStep = $state(NaN);
  numParameters = $state(0);
  maps = $state.raw<{ step: number; text: string; probs: Float32Array[]; layers: number } | null>(null);

  vocab!: CharVocab;
  private gpu!: GpuContext;
  private train!: Int32Array;
  private val!: Int32Array;
  private model: AttentionModel | null = null;
  private opt: GpuAdamW | null = null;
  private X: GpuIds | null = null;
  private Y: GpuIds | null = null;
  private rng = mulberry32(1);
  private generation = 0;
  private ema = NaN;

  async load(): Promise<void> {
    if (this.status !== 'idle') return;
    this.status = 'loading';
    const [gpu, text] = await Promise.all([getGpu(), loadCorpus('shakespeare')]);
    if (!gpu) {
      this.status = 'unsupported';
      return;
    }
    this.gpu = gpu;
    this.vocab = CharVocab.fromText(text);
    const ids = Int32Array.from(this.vocab.encode(text));
    const split = Math.floor(ids.length * 0.9);
    this.train = ids.subarray(0, split);
    this.val = ids.subarray(split);
    this.X = new GpuIds(gpu, new Uint32Array(LM.B * LM.T));
    this.Y = new GpuIds(gpu, new Uint32Array(LM.B * LM.T));
    await this.build();
    this.status = 'ready';
  }

  async setLayers(layers: number): Promise<void> {
    this.running = false;
    this.layers = layers;
    if (this.status === 'ready') await this.build();
  }

  async build(): Promise<void> {
    this.generation++;
    this.model?.dispose();
    this.opt?.dispose();
    this.rng = mulberry32(1);
    this.model = new AttentionModel(this.gpu, { V: this.vocab.vocabSize, T: LM.T, C: LM.C, heads: LM.heads, layers: this.layers }, this.rng);
    this.opt = new GpuAdamW(this.model.params, { lr: LM.lr });
    this.numParameters = this.model.numParameters;
    this.step = 0;
    this.ema = NaN;
    this.msPerStep = NaN;
    this.maps = null;
    const v = await this.evaluate();
    this.history = [{ step: 0, train: v, val: v }];
  }

  private fill(src: Int32Array, starts: number[], X: GpuIds, Y: GpuIds): void {
    const T = LM.T;
    const xs = new Uint32Array(starts.length * T), ys = new Uint32Array(starts.length * T);
    starts.forEach((s, b) => {
      for (let t = 0; t < T; t++) {
        xs[b * T + t] = src[s + t]!;
        ys[b * T + t] = src[s + t + 1]!;
      }
    });
    X.write(xs);
    Y.write(ys);
  }

  /** Mean cross-entropy (nats) over the validation split, in non-overlapping windows of T. */
  private async evaluate(): Promise<number> {
    const B = 64, T = LM.T, model = this.model!;
    const X = new GpuIds(this.gpu, new Uint32Array(B * T)), Y = new GpuIds(this.gpu, new Uint32Array(B * T));
    let sum = 0, n = 0;
    for (let s0 = 0; s0 + B * T + 1 <= this.val.length; s0 += B * T) {
      this.fill(this.val, Array.from({ length: B }, (_, b) => s0 + b * T), X, Y);
      const l = noGradGpu(() => scope(() => model.loss(X, Y, B)));
      sum += (await l.item()) * B * T;
      n += B * T;
      l.dispose();
    }
    X.dispose();
    Y.dispose();
    return sum / n;
  }

  private trainStep(): GpuTensor {
    const { B, T, lr, warmup, steps } = LM;
    const model = this.model!, opt = this.opt!;
    this.fill(this.train, Array.from({ length: B }, () => Math.floor(this.rng() * (this.train.length - T - 1))), this.X!, this.Y!);
    opt.lr = lr * Math.min(1, (this.step + 1) / warmup) * 0.5 * (1 + Math.cos((Math.PI * this.step) / steps));
    const loss = scope(() => {
      const l = model.loss(this.X!, this.Y!, B);
      l.backward();
      clipGradNorm(model.params, 1).dispose();
      opt.step();
      opt.zeroGrad();
      return l;
    });
    this.step++;
    return loss;
  }

  async start(): Promise<void> {
    if (this.running || this.status !== 'ready' || this.step >= LM.steps) return;
    this.running = true;
    const gen = this.generation;
    let perFrame = 2;
    while (this.running && gen === this.generation && this.step < LM.steps) {
      const t0 = performance.now();
      let last: GpuTensor | null = null;
      const k = Math.min(perFrame, LM.steps - this.step);
      for (let s = 0; s < k; s++) {
        last?.dispose();
        last = this.trainStep();
      }
      const l = await last!.item();
      last!.dispose();
      if (gen !== this.generation) return;
      const dt = performance.now() - t0;
      this.msPerStep = Number.isFinite(this.msPerStep) ? 0.8 * this.msPerStep + 0.2 * (dt / k) : dt / k;
      perFrame = Math.max(1, Math.min(30, Math.round((perFrame * 40) / Math.max(dt, 1))));
      this.ema = Number.isFinite(this.ema) ? 0.9 * this.ema + 0.1 * l : l;
      if (Math.floor(this.step / EVAL_EVERY) > Math.floor((this.step - k) / EVAL_EVERY) || this.step >= LM.steps) {
        this.history = [...this.history, { step: this.step, train: this.ema, val: await this.evaluate() }];
        await this.computeMaps();
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.running = false;
  }

  pause(): void {
    this.running = false;
  }

  /** Run the model on one passage and keep every head's attention probabilities. */
  async computeMaps(): Promise<void> {
    if (!this.model) return;
    const T = LM.T, model = this.model;
    const X = new GpuIds(this.gpu, Uint32Array.from(this.val.subarray(MAP_START, MAP_START + T)));
    const probs = noGradGpu(() => scope(() => model.hidden(X, 1).probs));
    const read = await Promise.all(probs.map((p) => p.read()));
    probs.forEach((p) => p.dispose());
    X.dispose();
    // One character more than the window, so the last position's target is known.
    const text = Array.from(this.val.subarray(MAP_START, MAP_START + T + 1), (i) => this.vocab.chars[i]).join('');
    this.maps = { step: this.step, text, probs: read, layers: this.layers };
  }
}

export const attnLm = new AttentionLmTrainer();
