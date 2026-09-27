/**
 * The Chapter 7 MLP language model (Bengio et al., 2003), trained in the browser with the course
 * library. One shared instance per page: the controls, loss chart, diagnostics, embedding
 * projector and sampler are separate widgets that all read from it.
 */
import { CharVocab } from '@lm/core/tokenise';
import { Tensor, nn, noGrad } from '@lm/core/tensor';
import { mulberry32, sampleIndex } from '@lm/core';
import { loadCorpus } from '$lib/data/corpus';

export type Init = 'kaiming' | 'naive';
export type Act = 'tanh' | 'relu' | 'none';

export interface MlpConfig {
  /** Context length (characters). */
  n: number;
  /** Embedding size. */
  d: number;
  /** Hidden units. */
  h: number;
  init: Init;
  act: Act;
  /** LayerNorm on the hidden pre-activations. */
  norm: boolean;
  lr: number;
  batch: number;
}

export const DEFAULT_CONFIG: MlpConfig = { n: 8, d: 16, h: 128, init: 'kaiming', act: 'tanh', norm: false, lr: 0.1, batch: 64 };
const VAL_EXAMPLES = 5000;
const MAX_STEPS = 30_000;

export interface Snapshot {
  step: number;
  preact: Float32Array;
  act: Float32Array;
  /** Fraction of tanh units beyond ±0.97 (or of ReLUs at exactly 0). */
  saturated: number;
  embedding: Float32Array;
}

class MlpTrainer {
  config = $state<MlpConfig>({ ...DEFAULT_CONFIG });
  ready = $state(false);
  running = $state(false);
  step = $state(0);
  // Replaced wholesale on every update, so raw (non-deep) state avoids proxying overhead.
  history = $state.raw<{ step: number; train: number; val: number }[]>([]);
  ratios = $state.raw<{ step: number; C: number; W1: number; W2: number }[]>([]);
  snapshot = $state.raw<Snapshot | null>(null);
  initialLoss = $state(NaN);
  diverged = $state(false);

  vocab!: CharVocab;
  private train!: Int32Array;
  private val!: Int32Array;
  private C!: Tensor;
  private W1!: Tensor;
  private b1!: Tensor;
  private W2!: Tensor;
  private b2!: Tensor;
  private ln: nn.LayerNorm | null = null;
  private opt!: nn.SGD;
  private rng = mulberry32(1);
  private ema = NaN;
  private loading: Promise<void> | null = null;

  get V(): number {
    return this.vocab?.vocabSize ?? 65;
  }

  load(): Promise<void> {
    this.loading ??= loadCorpus('shakespeare').then((text) => {
      this.vocab = CharVocab.fromText(text);
      const ids = Int32Array.from(this.vocab.encode(text));
      const split = Math.floor(ids.length * 0.9);
      this.train = ids.subarray(0, split);
      this.val = ids.subarray(split);
      this.build();
      this.ready = true;
    });
    return this.loading;
  }

  params(): Tensor[] {
    return [this.C, this.W1, this.b1, ...(this.ln?.parameters() ?? []), this.W2, this.b2];
  }

  get numParameters(): number {
    return this.params().reduce((a, p) => a + p.size, 0);
  }

  /** (Re)initialise the model from the current config. */
  build(): void {
    const { n, d, h, init, act } = this.config;
    const V = this.V;
    this.rng = mulberry32(1);
    const rng = this.rng;
    const gain = act === 'tanh' ? 5 / 3 : act === 'relu' ? Math.SQRT2 : 1;
    this.C = Tensor.randn([V, d], { rng, requiresGrad: true });
    this.W1 = Tensor.randn([n * d, h], { rng, std: init === 'kaiming' ? gain / Math.sqrt(n * d) : 1, requiresGrad: true });
    this.b1 = Tensor.zeros([h], { requiresGrad: true });
    this.ln = this.config.norm ? new nn.LayerNorm(h) : null;
    // A small output layer makes the initial predictions nearly uniform (loss ≈ ln V).
    this.W2 = Tensor.randn([h, V], { rng, std: init === 'kaiming' ? 0.1 / Math.sqrt(h) : 1, requiresGrad: true });
    this.b2 = Tensor.zeros([V], { requiresGrad: true });
    this.opt = new nn.SGD(this.params(), { lr: this.config.lr });
    this.step = 0;
    this.ema = NaN;
    this.history = [];
    this.ratios = [];
    this.diverged = false;
    const v = this.evaluate();
    this.initialLoss = v;
    this.history = [{ step: 0, train: v, val: v }];
    this.takeSnapshot(this.batch().X);
  }

  /** Random training batch of contexts X (B·n ids) and targets Y. */
  private batch(B = this.config.batch): { X: Int32Array; Y: Int32Array } {
    const n = this.config.n;
    const X = new Int32Array(B * n), Y = new Int32Array(B);
    for (let b = 0; b < B; b++) {
      const i = n + Math.floor(this.rng() * (this.train.length - n));
      for (let k = 0; k < n; k++) X[b * n + k] = this.train[i - n + k]!;
      Y[b] = this.train[i]!;
    }
    return { X, Y };
  }

  /** Forward pass. Returns logits and the hidden pre-activation / activation tensors. */
  forward(X: Int32Array, B: number): { logits: Tensor; pre: Tensor; act: Tensor } {
    const { n, d } = this.config;
    const e = nn.embedding(this.C, X, [B, n]).reshape(B, n * d);
    let pre = e.matmul(this.W1).add(this.b1);
    if (this.ln) pre = this.ln.forward(pre);
    const act = this.config.act === 'tanh' ? pre.tanh() : this.config.act === 'relu' ? pre.relu() : pre;
    return { logits: act.matmul(this.W2).add(this.b2), pre, act };
  }

  /** Mean validation cross-entropy (nats) over a fixed slice of the validation set. */
  evaluate(): number {
    const n = this.config.n;
    const N = Math.min(VAL_EXAMPLES, this.val.length - n);
    const X = new Int32Array(N * n), Y = new Int32Array(N);
    for (let b = 0; b < N; b++) {
      for (let k = 0; k < n; k++) X[b * n + k] = this.val[b + k]!;
      Y[b] = this.val[b + n]!;
    }
    return noGrad(() => nn.crossEntropy(this.forward(X, N).logits, Y).item());
  }

  private takeSnapshot(X: Int32Array): void {
    const B = X.length / this.config.n;
    const { pre, act } = noGrad(() => this.forward(X, B));
    const a = act.toFloat32Array();
    let sat = 0;
    for (const x of a) if (this.config.act === 'tanh' ? Math.abs(x) > 0.97 : this.config.act === 'relu' ? x === 0 : false) sat++;
    this.snapshot = { step: this.step, preact: pre.toFloat32Array(), act: a, saturated: sat / a.length, embedding: this.C.toFloat32Array() };
  }

  /** log10 of lr·std(grad)/std(param): how big each update is relative to the parameter. */
  private updateRatio(p: Tensor): number {
    const std = (xs: Float32Array) => {
      let m = 0;
      for (const x of xs) m += x / xs.length;
      let v = 0;
      for (const x of xs) v += (x - m) ** 2 / xs.length;
      return Math.sqrt(v);
    };
    return Math.log10((this.config.lr * std(p.grad!.toFloat32Array())) / (std(p.toFloat32Array()) || 1e-12) || 1e-12);
  }

  /** Train for about `budgetMs` milliseconds. */
  trainFor(budgetMs: number): void {
    if (!this.ready || this.diverged) return;
    const t0 = performance.now();
    this.opt.lr = this.config.lr;
    while (performance.now() - t0 < budgetMs && this.step < MAX_STEPS) {
      const { X, Y } = this.batch();
      this.opt.zeroGrad();
      const loss = nn.crossEntropy(this.forward(X, this.config.batch).logits, Y);
      loss.backward();
      const l = loss.item();
      if (!Number.isFinite(l)) {
        this.diverged = true;
        this.running = false;
        return;
      }
      if (this.step % 50 === 0) this.ratios = [...this.ratios, { step: this.step, C: this.updateRatio(this.C), W1: this.updateRatio(this.W1), W2: this.updateRatio(this.W2) }];
      this.opt.step();
      this.ema = Number.isFinite(this.ema) ? 0.98 * this.ema + 0.02 * l : l;
      this.step++;
      if (this.step % 250 === 0) {
        this.history = [...this.history, { step: this.step, train: this.ema, val: this.evaluate() }];
        this.takeSnapshot(X);
      }
    }
    if (this.step >= MAX_STEPS) this.running = false;
  }

  start(): void {
    if (this.running || !this.ready) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.trainFor(14);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  pause(): void {
    this.running = false;
  }

  /** Change the configuration and rebuild the model (training restarts). */
  reconfigure(patch: Partial<MlpConfig>): void {
    this.running = false;
    this.config = { ...this.config, ...patch };
    if (this.ready) this.build();
  }

  /** Generate text by sampling one character at a time. */
  sample(prompt: string, length: number, temperature: number, seed = Date.now()): string {
    const n = this.config.n;
    const rng = mulberry32(seed & 0xffffffff);
    const known = [...prompt].filter((c) => this.vocab.chars.includes(c));
    const pad = this.vocab.encode(' ')[0]!;
    const seq = [...Array(Math.max(0, n - known.length)).fill(pad), ...this.vocab.encode(known.join(''))];
    let out = '';
    noGrad(() => {
      for (let i = 0; i < length; i++) {
        const X = Int32Array.from(seq.slice(-n));
        const z = this.forward(X, 1).logits.div(Math.max(temperature, 1e-3)).softmax(-1).toFloat32Array();
        const id = sampleIndex(z, rng());
        seq.push(id);
        out += this.vocab.chars[id];
      }
    });
    return out;
  }
}

export const mlp = new MlpTrainer();

/** Reference points from Chapter 2 (bits per character on the validation split). */
export const BASELINES = { bigram: 3.57, kneserNey: 2.22 };
