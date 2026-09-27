/**
 * The course's in-browser training loop for character-level GPT models on TinyShakespeare
 * (Chapters 11–12). Each instance owns one model and optimiser; widgets read its reactive state.
 *
 * Features, as introduced in Chapter 12: random-window batches (optionally from a subset of the
 * training text), gradient accumulation, warm-up + cosine learning-rate schedule, gradient clipping
 * with the norm recorded, periodic evaluation on the whole validation split, throughput and model
 * FLOPs utilisation, checkpoints in IndexedDB, and export to safetensors.
 */
import { CharVocab } from '@lm/core/tokenise';
import { Gpt, GpuAdamW, GpuIds, GpuMuon, GpuSGD, clipGradNorm, matmulInto, noGradGpu, scope, tokenLosses, type GptConfig, type GpuContext, type GpuTensor } from '@lm/core/gpu';
import { decodeSafetensors, encodeSafetensors, mulberry32, sampleIndex, type NamedTensor } from '@lm/core';
import { loadCorpus } from '$lib/data/corpus';
import { getGpu } from '$lib/gpu/compute';
import { all, del, get, put } from '$lib/lab/db';

export interface TrainConfig {
  model: Omit<GptConfig, 'V'>;
  batch: number;
  /** Micro-batches per optimiser step (gradient accumulation); the effective batch is batch × accum. */
  accum: number;
  steps: number;
  lr: number;
  warmup: number;
  /** Final learning rate as a fraction of the peak (cosine decay). */
  minLrRatio: number;
  weightDecay: number;
  clip: number;
  evalEvery: number;
  /** Train on only the first this-many characters (0 = all), to study overfitting. */
  trainChars: number;
  seed: number;
  /** Chapter 13: which optimiser. Muon updates the blocks' matrices; AdamW handles the rest. */
  optimiser?: 'adamw' | 'adam' | 'sgd' | 'muon';
  /** Peak learning rate for Muon's matrices (the other parameters use `lr`). */
  muonLr?: number;
}

/** The optimisers the trainer can drive, behind one small interface. */
interface Optimiser {
  step(): void;
  zeroGrad(): void;
  dispose(): void;
  setLr(lr: number, ratio: number): void;
}

export const DEFAULT_TRAIN: TrainConfig = {
  model: { T: 128, C: 128, layers: 2, heads: 4 },
  batch: 32,
  accum: 1,
  steps: 3000,
  lr: 3e-3,
  warmup: 100,
  minLrRatio: 0.1,
  weightDecay: 0.1,
  clip: 1,
  evalEvery: 500,
  trainChars: 0,
  seed: 1,
};

export interface HistoryPoint {
  step: number;
  train: number;
  val: number;
  lr: number;
}

interface Checkpoint {
  name: string;
  savedAt: number;
  cfg: TrainConfig;
  step: number;
  history: HistoryPoint[];
  weights: [string, NamedTensor][];
  opt: { t: number; m: Float32Array[]; v: Float32Array[] };
}

let data: Promise<{ vocab: CharVocab; train: Int32Array; val: Int32Array }> | undefined;
function loadData() {
  data ??= loadCorpus('shakespeare').then((text) => {
    const vocab = CharVocab.fromText(text);
    const ids = Int32Array.from(vocab.encode(text));
    const split = Math.floor(ids.length * 0.9);
    return { vocab, train: ids.subarray(0, split), val: ids.subarray(split) };
  });
  return data;
}

let peak: Promise<number> | undefined;
/** The best matmul throughput on this GPU (FLOP/s), measured once: the yardstick for utilisation. */
function measurePeak(gpu: GpuContext): Promise<number> {
  peak ??= (async () => {
    const n = 1024;
    const a = gpu.alloc(n * n * 4), b = gpu.alloc(n * n * 4), c = gpu.alloc(n * n * 4);
    const run = () => matmulInto(gpu, a, b, c, { M: n, N: n, K: n });
    run();
    await gpu.sync();
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) run();
    await gpu.sync();
    const secs = (performance.now() - t0) / 20 / 1000;
    [a, b, c].forEach((x) => gpu.release(x));
    return (2 * n ** 3) / secs;
  })();
  return peak;
}

export class GptTrainer {
  cfg = $state.raw<TrainConfig>(DEFAULT_TRAIN);
  status = $state<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  running = $state(false);
  step = $state(0);
  history = $state.raw<HistoryPoint[]>([]);
  gradNorms = $state.raw<{ step: number; norm: number }[]>([]);
  msPerStep = $state(NaN);
  tokensPerSec = $state(NaN);
  /** Achieved FLOP/s as a fraction of this GPU's best matmul speed. */
  utilisation = $state(NaN);
  numParameters = $state(0);
  /** Bumped when weights change (for widgets that read them). */
  version = $state(0);

  vocab!: CharVocab;
  gpu!: GpuContext;
  model: Gpt | null = null;
  val!: Int32Array;
  private trainIds!: Int32Array;
  private opt: Optimiser | null = null;
  private adam: GpuAdamW | null = null;
  private X: GpuIds | null = null;
  private Y: GpuIds | null = null;
  private rng = mulberry32(1);
  private generation = 0;
  private ema = NaN;
  private peakFlops = NaN;

  constructor(cfg: TrainConfig = DEFAULT_TRAIN) {
    this.cfg = cfg;
  }

  async load(): Promise<void> {
    if (this.status !== 'idle') return;
    this.status = 'loading';
    const [gpu, d] = await Promise.all([getGpu(), loadData()]);
    if (!gpu) {
      this.status = 'unsupported';
      return;
    }
    this.gpu = gpu;
    this.vocab = d.vocab;
    this.trainIds = d.train;
    this.val = d.val;
    this.peakFlops = await measurePeak(gpu);
    await this.build();
    this.status = 'ready';
  }

  /** Change the configuration (restarts training). */
  async configure(patch: Partial<Omit<TrainConfig, 'model'>> & { model?: Partial<TrainConfig['model']> }): Promise<void> {
    this.running = false;
    this.cfg = { ...this.cfg, ...patch, model: { ...this.cfg.model, ...patch.model } };
    if (this.status === 'ready') await this.build();
  }

  private get train(): Int32Array {
    const n = this.cfg.trainChars;
    return n > 0 ? this.trainIds.subarray(0, Math.min(n, this.trainIds.length)) : this.trainIds;
  }

  async build(): Promise<void> {
    this.generation++;
    this.model?.dispose();
    this.opt?.dispose();
    this.X?.dispose();
    this.Y?.dispose();
    const { model: m, batch, lr, weightDecay, seed } = this.cfg;
    this.rng = mulberry32(seed);
    this.model = new Gpt(this.gpu, { ...m, V: this.vocab.vocabSize }, this.rng);
    this.opt = this.makeOptimiser();
    this.X = new GpuIds(this.gpu, new Uint32Array(batch * m.T));
    this.Y = new GpuIds(this.gpu, new Uint32Array(batch * m.T));
    this.numParameters = this.model.numParameters;
    this.step = 0;
    this.ema = NaN;
    this.msPerStep = NaN;
    this.tokensPerSec = NaN;
    this.utilisation = NaN;
    this.gradNorms = [];
    this.version++;
    const v = await this.evaluate();
    this.history = [{ step: 0, train: v, val: v, lr: 0 }];
  }

  private makeOptimiser(): Optimiser {
    const model = this.model!;
    const { lr, weightDecay, optimiser = 'adamw', muonLr = 0.02 } = this.cfg;
    const adamw = (params = model.params, wd = weightDecay) => new GpuAdamW(params, { lr, betas: [0.9, 0.99], weightDecay: wd, noDecay: model.noDecay });
    this.adam = null;
    if (optimiser === 'sgd') {
      const o = new GpuSGD(model.params, { lr, momentum: 0.9 });
      return { step: () => o.step(), zeroGrad: () => o.zeroGrad(), dispose: () => o.dispose(), setLr: (v) => (o.lr = v) };
    }
    if (optimiser === 'muon') {
      const isMatrix = (name: string) => /^h\d+\.(attn|mlp)\./.test(name);
      const matrices = [...model.named].filter(([n]) => isMatrix(n)).map(([, p]) => p);
      const rest = [...model.named].filter(([n]) => !isMatrix(n)).map(([, p]) => p);
      const muon = new GpuMuon(matrices, { lr: muonLr, weightDecay: 0 });
      const a = adamw(rest);
      return {
        step: () => (muon.step(), a.step()),
        zeroGrad: () => (muon.zeroGrad(), a.zeroGrad()),
        dispose: () => (muon.dispose(), a.dispose()),
        setLr: (v, ratio) => ((a.lr = v), (muon.lr = muonLr * ratio)),
      };
    }
    const a = adamw(model.params, optimiser === 'adam' ? 0 : weightDecay);
    this.adam = a;
    return { step: () => a.step(), zeroGrad: () => a.zeroGrad(), dispose: () => a.dispose(), setLr: (v) => (a.lr = v) };
  }

  /** Learning rate at a step: linear warm-up, then cosine decay to minLrRatio × peak. */
  lrAt(step: number): number {
    const { lr, warmup, steps, minLrRatio } = this.cfg;
    if (step < warmup) return (lr * (step + 1)) / warmup;
    const progress = Math.min(1, (step - warmup) / Math.max(1, steps - warmup));
    return lr * (minLrRatio + (1 - minLrRatio) * 0.5 * (1 + Math.cos(Math.PI * progress)));
  }

  /** Training FLOPs per token: 6 per non-embedding parameter, plus the attention scores. */
  get flopsPerToken(): number {
    const { T, C, layers } = this.cfg.model;
    const embedding = this.vocab.vocabSize * C + T * C;
    return 6 * (this.numParameters - embedding) + 6 * layers * T * C;
  }

  private fill(src: Int32Array, starts: number[], X: GpuIds, Y: GpuIds): void {
    const T = this.cfg.model.T;
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

  /** Windows of the validation split: non-overlapping, so every token is scored once. */
  private valWindows(): number[] {
    const T = this.cfg.model.T;
    return Array.from({ length: Math.floor((this.val.length - 1) / T) }, (_, i) => i * T);
  }

  /** Mean cross-entropy (nats) over the whole validation split. */
  async evaluate(): Promise<number> {
    const losses = await this.valLosses();
    let s = 0;
    for (const l of losses) s += l;
    return s / losses.length;
  }

  /** Every validation token's loss (nats), in order. */
  async valLosses(): Promise<Float32Array> {
    const T = this.cfg.model.T, B = Math.max(8, Math.floor(4096 / T)), model = this.model!;
    const windows = this.valWindows();
    const out = new Float32Array(windows.length * T);
    const X = new GpuIds(this.gpu, new Uint32Array(B * T)), Y = new GpuIds(this.gpu, new Uint32Array(B * T));
    for (let i = 0; i < windows.length; i += B) {
      const starts = windows.slice(i, i + B);
      while (starts.length < B) starts.push(0); // pad the last batch; padded rows are ignored
      this.fill(this.val, starts, X, Y);
      const l = noGradGpu(() => scope(() => tokenLosses(model.logits(model.hidden(X, B, T).h), Y)));
      const v = await l.read();
      l.dispose();
      out.set(v.subarray(0, Math.min(B, windows.length - i) * T), i * T);
    }
    X.dispose();
    Y.dispose();
    return out;
  }

  private trainStep(): { loss: GpuTensor; norm: GpuTensor } {
    const { batch: B, clip, accum } = this.cfg;
    const T = this.cfg.model.T;
    const model = this.model!, opt = this.opt!;
    const src = this.train;
    const lr = this.lrAt(this.step);
    opt.setLr(lr, lr / this.cfg.lr);
    const out = scope(() => {
      let total: GpuTensor | null = null;
      for (let micro = 0; micro < accum; micro++) {
        this.fill(src, Array.from({ length: B }, () => Math.floor(this.rng() * (src.length - T - 1))), this.X!, this.Y!);
        const l = model.loss(this.X!, this.Y!, B, T, true);
        // Scale so the accumulated gradient is the mean over all micro-batches.
        (accum > 1 ? l.scale(1 / accum) : l).backward();
        total = total ? total.add(l) : l;
      }
      const norm = clipGradNorm(model.params, clip);
      opt.step();
      opt.zeroGrad();
      return { loss: accum > 1 ? total!.scale(1 / accum) : total!, norm };
    });
    this.step++;
    return out;
  }

  async start(): Promise<void> {
    if (this.running || this.status !== 'ready' || this.step >= this.cfg.steps) return;
    this.running = true;
    const gen = this.generation;
    let perFrame = 1;
    while (this.running && gen === this.generation && this.step < this.cfg.steps) {
      const t0 = performance.now();
      let last: { loss: GpuTensor; norm: GpuTensor } | null = null;
      const k = Math.min(perFrame, this.cfg.steps - this.step);
      for (let s = 0; s < k; s++) {
        if (last) {
          last.loss.dispose();
          last.norm.dispose();
        }
        last = this.trainStep();
      }
      const [l, norm] = await Promise.all([last!.loss.item(), last!.norm.item()]);
      last!.loss.dispose();
      last!.norm.dispose();
      if (gen !== this.generation) return;
      const dt = performance.now() - t0;
      const perStep = dt / k;
      this.msPerStep = Number.isFinite(this.msPerStep) ? 0.8 * this.msPerStep + 0.2 * perStep : perStep;
      const tokens = this.cfg.batch * this.cfg.accum * this.cfg.model.T;
      this.tokensPerSec = (tokens * 1000) / this.msPerStep;
      this.utilisation = (this.tokensPerSec * this.flopsPerToken) / this.peakFlops;
      perFrame = Math.max(1, Math.min(20, Math.round((perFrame * 50) / Math.max(dt, 1))));
      this.ema = Number.isFinite(this.ema) ? 0.9 * this.ema + 0.1 * l : l;
      this.gradNorms = [...this.gradNorms, { step: this.step, norm }];
      this.version++;
      const every = this.cfg.evalEvery;
      if (Math.floor(this.step / every) > Math.floor((this.step - k) / every) || this.step >= this.cfg.steps) {
        this.history = [...this.history, { step: this.step, train: this.ema, val: await this.evaluate(), lr: this.lrAt(this.step) }];
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.running = false;
  }

  pause(): void {
    this.running = false;
  }

  // ───────────── checkpoints ─────────────

  /** Save weights, optimiser state and progress to IndexedDB under `name`. */
  async save(name: string): Promise<void> {
    const weights = [...(await this.model!.state())];
    if (!this.adam) throw new Error('checkpoints need the AdamW optimiser');
    const ckpt: Checkpoint = { name, savedAt: Date.now(), cfg: this.cfg, step: this.step, history: this.history, weights, opt: await this.adam.state() };
    await put('checkpoints', name, ckpt);
  }

  /** Restore a checkpoint (rebuilding the model with its configuration) and continue from its step. */
  async restore(name: string): Promise<boolean> {
    const ckpt = await get<Checkpoint>('checkpoints', name);
    if (!ckpt) return false;
    this.running = false;
    this.cfg = ckpt.cfg;
    await this.build();
    this.model!.load(new Map(ckpt.weights));
    this.adam?.load(ckpt.opt);
    this.step = ckpt.step;
    this.history = ckpt.history;
    // The data order after a restore differs from an uninterrupted run (the sampler is reseeded).
    this.rng = mulberry32(ckpt.cfg.seed + ckpt.step);
    this.version++;
    return true;
  }

  static async checkpoints(): Promise<{ name: string; step: number; savedAt: number; val: number }[]> {
    const m = await all<Checkpoint>('checkpoints');
    return [...m.values()].map((c) => ({ name: c.name, step: c.step, savedAt: c.savedAt, val: c.history.at(-1)?.val ?? NaN })).sort((a, b) => b.savedAt - a.savedAt);
  }

  static deleteCheckpoint(name: string): Promise<void> {
    return del('checkpoints', name);
  }

  /** The weights as a safetensors file (loadable with safetensors.torch.load_file). */
  async exportSafetensors(): Promise<Uint8Array> {
    const state = await this.model!.state();
    return encodeSafetensors(state, {
      format: 'lm-course-gpt',
      config: JSON.stringify({ ...this.cfg.model, V: this.vocab.vocabSize }),
      vocab: JSON.stringify(this.vocab.chars),
      step: String(this.step),
    });
  }

  /**
   * Load weights from a safetensors file written by `exportSafetensors` or by the PyTorch lab
   * (`lmc train --export`), rebuilding the model to the shape recorded in the file's metadata.
   */
  async importSafetensors(bytes: Uint8Array): Promise<string> {
    const { tensors, metadata } = decodeSafetensors(bytes);
    if (metadata.format !== 'lm-course-gpt') throw new Error('not a course GPT checkpoint (missing format metadata)');
    const vocab = JSON.parse(metadata.vocab ?? '[]') as string[];
    if (vocab.join('') !== this.vocab.chars.join('')) throw new Error('the file was trained with a different character vocabulary');
    const c = JSON.parse(metadata.config ?? '{}') as Record<string, number | boolean>;
    // PyTorch names (context, width) or the browser's (T, C).
    const model = {
      T: Number(c.T ?? c.context),
      C: Number(c.C ?? c.width),
      layers: Number(c.layers),
      heads: Number(c.heads),
      mlp: c.mlp !== false,
      norm: c.norm !== false,
    };
    await this.configure({ model, steps: Math.max(this.cfg.steps, Number(metadata.step ?? 0)) });
    this.model!.load(tensors);
    this.step = Number(metadata.step ?? 0);
    const v = await this.evaluate();
    this.history = [{ step: this.step, train: v, val: v, lr: 0 }];
    this.version++;
    return `Loaded ${model.layers} layers × width ${model.C} (step ${this.step}): ${(v / Math.LN2).toFixed(3)} bits/char on validation`;
  }

  /** Sample text: runs the full context window on the GPU for each new character (Chapter 16 adds a KV cache). */
  async sample(prompt: string, length: number, temperature = 0.8, seed = Date.now()): Promise<string> {
    const model = this.model!;
    const T = this.cfg.model.T;
    const rng = mulberry32(seed & 0xffffffff);
    const ids = this.vocab.encode([...prompt].filter((c) => this.vocab.chars.includes(c)).join('') || '\n');
    let out = '';
    const X = new GpuIds(this.gpu, new Uint32Array(T));
    for (let i = 0; i < length; i++) {
      const ctx = ids.slice(-T);
      const padded = new Uint32Array(T);
      padded.set(ctx);
      X.write(padded);
      // The window is padded at the end; causal attention means the padding never affects earlier positions.
      const logits = noGradGpu(() => scope(() => model.logits(model.hidden(X, 1, T).h)));
      const all = await logits.read();
      logits.dispose();
      const V = this.vocab.vocabSize, row = ctx.length - 1;
      const z = Array.from(all.subarray(row * V, (row + 1) * V), (v) => v / Math.max(temperature, 1e-3));
      const m = Math.max(...z);
      const p = z.map((v) => Math.exp(v - m));
      const s = p.reduce((a, b) => a + b, 0);
      const id = sampleIndex(p.map((v) => v / s), rng());
      ids.push(id);
      out += this.vocab.chars[id];
    }
    X.dispose();
    return out;
  }
}
