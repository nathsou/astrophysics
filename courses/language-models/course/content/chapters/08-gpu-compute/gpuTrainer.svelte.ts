/**
 * The Chapter 7 MLP again, now trained on the GPU with the chapter's backend: same architecture,
 * same data, SGD with momentum and a cosine learning-rate schedule. Also times the CPU library on
 * the same configuration, for an honest speed-up figure.
 */
import { CharVocab } from '@lm/core/tokenise';
import { Tensor, nn, noGrad } from '@lm/core/tensor';
import { GpuIds, GpuSGD, GpuTensor, crossEntropy, embedding, noGradGpu, scope, type GpuContext } from '@lm/core/gpu';
import { mulberry32, sampleIndex } from '@lm/core';
import { loadCorpus } from '$lib/data/corpus';
import { getGpu } from '$lib/gpu/compute';

export type Preset = 'small' | 'large';
export const PRESETS: Record<Preset, { n: number; d: number; h: number; batch: number; lr: number; label: string }> = {
  small: { n: 8, d: 16, h: 128, batch: 64, lr: 0.05, label: 'Chapter 7 size' },
  large: { n: 8, d: 24, h: 1024, batch: 1024, lr: 0.1, label: '170× the compute' },
};
export const STEPS = 20_000;
/** Validation runs over the whole split (as Chapter 2’s numbers do), in chunks of this many examples. */
const VAL_CHUNK = 16_384;
const EVAL_EVERY = 1000;

class GpuMlpTrainer {
  preset = $state<Preset>('large');
  status = $state<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  running = $state(false);
  step = $state(0);
  history = $state.raw<{ step: number; train: number; val: number }[]>([]);
  gpuMsPerStep = $state(NaN);
  cpuMsPerStep = $state(NaN);
  elapsed = $state(0);
  numParameters = $state(0);

  private gpu!: GpuContext;
  private vocab!: CharVocab;
  private train!: Int32Array;
  private val!: Int32Array;
  private params: GpuTensor[] = [];
  private opt: GpuSGD | null = null;
  private X: GpuIds | null = null;
  private Y: GpuIds | null = null;
  private valChunks: { X: GpuIds; Y: GpuIds }[] = [];
  private rng = mulberry32(1);
  private ema = NaN;
  private generation = 0;

  get cfg() {
    return PRESETS[this.preset];
  }

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
    await this.build();
    this.status = 'ready';
  }

  async setPreset(p: Preset): Promise<void> {
    this.running = false;
    this.preset = p;
    if (this.status === 'ready') await this.build();
  }

  /** (Re)initialise parameters on the GPU, exactly as Chapter 7 does (scaled init for tanh). */
  async build(): Promise<void> {
    this.generation++;
    for (const p of this.params) p.dispose();
    this.opt?.dispose();
    for (const b of [this.X, this.Y, ...this.valChunks.flatMap((c) => [c.X, c.Y])]) b?.dispose();
    const { n, d, h, batch, lr } = this.cfg;
    const V = this.vocab.vocabSize;
    const rng = (this.rng = mulberry32(1));
    const cpu = [
      Tensor.randn([V, d], { rng }),
      Tensor.randn([n * d, h], { rng, std: 5 / 3 / Math.sqrt(n * d) }),
      Tensor.zeros([h]),
      Tensor.randn([h, V], { rng, std: 0.1 / Math.sqrt(h) }),
      Tensor.zeros([V]),
    ];
    this.params = cpu.map((t) => GpuTensor.from(this.gpu, t, undefined, { requiresGrad: true }));
    this.numParameters = this.params.reduce((a, p) => a + p.size, 0);
    this.opt = new GpuSGD(this.params, { lr, momentum: 0.9 });
    this.X = new GpuIds(this.gpu, new Uint32Array(batch * n));
    this.Y = new GpuIds(this.gpu, new Uint32Array(batch));
    this.valChunks = [];
    const total = this.val.length - n;
    for (let start = 0; start < total; start += VAL_CHUNK) {
      const N = Math.min(VAL_CHUNK, total - start);
      const vx = new Uint32Array(N * n), vy = new Uint32Array(N);
      for (let b = 0; b < N; b++) {
        for (let k = 0; k < n; k++) vx[b * n + k] = this.val[start + b + k]!;
        vy[b] = this.val[start + b + n]!;
      }
      this.valChunks.push({ X: new GpuIds(this.gpu, vx), Y: new GpuIds(this.gpu, vy) });
    }
    this.step = 0;
    this.elapsed = 0;
    this.ema = NaN;
    this.gpuMsPerStep = NaN;
    const v = await this.evaluate();
    this.history = [{ step: 0, train: v, val: v }];
    // The CPU timing blocks the page for up to a second at the large size, so let the UI paint first.
    this.cpuMsPerStep = NaN;
    const gen = this.generation;
    setTimeout(() => {
      if (gen === this.generation) this.cpuMsPerStep = this.timeCpu(cpu);
    }, 300);
  }

  private forward(X: GpuIds, Y: GpuIds, B: number): GpuTensor {
    const { n, d } = this.cfg;
    const [C, W1, b1, W2, b2] = this.params as [GpuTensor, GpuTensor, GpuTensor, GpuTensor, GpuTensor];
    return crossEntropy(embedding(C, X).reshape(B, n * d).matmul(W1).add(b1).tanh().matmul(W2).add(b2), Y);
  }

  /** Mean cross-entropy (nats) over the full validation split. */
  private async evaluate(): Promise<number> {
    let sum = 0, count = 0;
    for (const { X, Y } of this.valChunks) {
      const loss = noGradGpu(() => scope(() => this.forward(X, Y, Y.length)));
      sum += (await loss.item()) * Y.length;
      count += Y.length;
      loss.dispose();
    }
    return sum / count;
  }

  /** Milliseconds per training step for the CPU library at this configuration (3 steps). */
  private timeCpu(init: Tensor[]): number {
    const { n, d, batch } = this.cfg;
    const p = init.map((t) => new Tensor(t.toFloat32Array(), t.shape, undefined, 0, true));
    const [C, W1, b1, W2, b2] = p as [Tensor, Tensor, Tensor, Tensor, Tensor];
    const opt = new nn.SGD(p, { lr: 0 });
    const steps = batch >= 1024 ? 1 : 3;
    const t0 = performance.now();
    for (let s = 0; s < steps; s++) {
      const { X, Y } = this.sampleBatch(mulberry32(s));
      const loss = nn.crossEntropy(nn.embedding(C, X).reshape(batch, n * d).matmul(W1).add(b1).tanh().matmul(W2).add(b2), Y);
      loss.backward();
      opt.step();
      opt.zeroGrad();
    }
    return (performance.now() - t0) / steps;
  }

  private sampleBatch(rng = this.rng): { X: Uint32Array; Y: Uint32Array } {
    const { n, batch } = this.cfg;
    const X = new Uint32Array(batch * n), Y = new Uint32Array(batch);
    for (let b = 0; b < batch; b++) {
      const i = n + Math.floor(rng() * (this.train.length - n));
      for (let k = 0; k < n; k++) X[b * n + k] = this.train[i - n + k]!;
      Y[b] = this.train[i]!;
    }
    return { X, Y };
  }

  async start(): Promise<void> {
    if (this.running || this.status !== 'ready' || this.step >= STEPS) return;
    this.running = true;
    const gen = this.generation;
    let perFrame = 4;
    while (this.running && gen === this.generation && this.step < STEPS) {
      const t0 = performance.now();
      let last: GpuTensor | null = null;
      const k = Math.min(perFrame, STEPS - this.step);
      for (let s = 0; s < k; s++) {
        const { X, Y } = this.sampleBatch();
        this.X!.write(X);
        this.Y!.write(Y);
        this.opt!.lr = this.cfg.lr * 0.5 * (1 + Math.cos((Math.PI * this.step) / STEPS));
        last?.dispose();
        last = scope(() => {
          const loss = this.forward(this.X!, this.Y!, this.cfg.batch);
          loss.backward();
          this.opt!.step();
          this.opt!.zeroGrad();
          return loss;
        });
        this.step++;
      }
      const l = await last!.item(); // waits for the GPU to finish this frame's steps
      last!.dispose();
      if (gen !== this.generation) return;
      const dt = performance.now() - t0;
      this.elapsed += dt / 1000;
      this.gpuMsPerStep = Number.isFinite(this.gpuMsPerStep) ? 0.8 * this.gpuMsPerStep + 0.2 * (dt / k) : dt / k;
      perFrame = Math.max(1, Math.min(200, Math.round((perFrame * 30) / Math.max(dt, 1))));
      this.ema = Number.isFinite(this.ema) ? 0.9 * this.ema + 0.1 * l : l;
      if (Math.floor(this.step / EVAL_EVERY) > Math.floor((this.step - k) / EVAL_EVERY) || this.step >= STEPS) {
        this.history = [...this.history, { step: this.step, train: this.ema, val: await this.evaluate() }];
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.running = false;
  }

  pause(): void {
    this.running = false;
  }

  /** Copy the weights back and sample on the CPU (one character at a time needs no GPU). */
  async sample(prompt: string, length: number, temperature = 0.8, seed = Date.now()): Promise<string> {
    const { n, d } = this.cfg;
    const [C, W1, b1, W2, b2] = await Promise.all(this.params.map(async (p) => new Tensor(await p.read(), p.shape)));
    const rng = mulberry32(seed & 0xffffffff);
    const pad = this.vocab.encode(' ')[0]!;
    const known = [...prompt].filter((c) => this.vocab.chars.includes(c)).join('');
    const seq = [...Array(Math.max(0, n - known.length)).fill(pad), ...this.vocab.encode(known)];
    let out = '';
    noGrad(() => {
      for (let i = 0; i < length; i++) {
        const e = nn.embedding(C!, seq.slice(-n)).reshape(1, n * d);
        const z = e.matmul(W1!).add(b1!).tanh().matmul(W2!).add(b2!).div(Math.max(temperature, 1e-3)).softmax(-1).toFloat32Array();
        const id = sampleIndex(z, rng());
        seq.push(id);
        out += this.vocab.chars[id];
      }
    });
    return out;
  }
}

export const gpuMlp = new GpuMlpTrainer();
