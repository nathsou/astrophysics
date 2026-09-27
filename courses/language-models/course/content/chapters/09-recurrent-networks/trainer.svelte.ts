/**
 * Chapter 9's in-browser trainer: a character-level RNN or LSTM on TinyShakespeare, trained on the
 * GPU with truncated backpropagation through time. The batch is B parallel streams through the
 * text; each stream's state is carried (detached) from one chunk of T characters to the next.
 */
import { CharVocab } from '@lm/core/tokenise';
import { GpuAdamW, GpuIds, clipGradNorm, noGradGpu, scope, type GpuContext, type GpuTensor } from '@lm/core/gpu';
import { mulberry32, sampleIndex } from '@lm/core';
import { loadCorpus } from '$lib/data/corpus';
import { getGpu } from '$lib/gpu/compute';
import { CharRnn, type Cell, type CpuRnn, type RnnState } from './model';

export const CONFIG = { H: 256, D: 256, T: 64, B: 64, lr: 3e-3, steps: 2000, clip: 1 };
const EVAL_EVERY = 250;
const EVAL_STREAMS = 128;

/** Reference results (bits/char, full validation split). */
export const BASELINES = { kneserNey: 2.22, mlpGpu: 2.43 };

class RnnTrainer {
  cell = $state<Cell>('lstm');
  status = $state<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  running = $state(false);
  step = $state(0);
  history = $state.raw<{ step: number; train: number; val: number }[]>([]);
  msPerStep = $state(NaN);
  numParameters = $state(0);
  /** Bumped whenever the weights change enough to refresh CPU copies (samples, inspection). */
  version = $state(0);

  vocab!: CharVocab;
  val!: Int32Array;
  private gpu!: GpuContext;
  private train!: Int32Array;
  private model: CharRnn | null = null;
  private opt: GpuAdamW | null = null;
  private state: RnnState | null = null;
  private xs: GpuIds[] = [];
  private ys: GpuIds | null = null;
  private offset = 0;
  private generation = 0;
  private ema = NaN;
  private cpu: { version: number; rnn: Promise<CpuRnn> } | null = null;

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
    const { T, B } = CONFIG;
    this.xs = Array.from({ length: T }, () => new GpuIds(gpu, new Uint32Array(B)));
    this.ys = new GpuIds(gpu, new Uint32Array(T * B));
    await this.build();
    this.status = 'ready';
  }

  async setCell(cell: Cell): Promise<void> {
    this.running = false;
    this.cell = cell;
    if (this.status === 'ready') await this.build();
  }

  async build(): Promise<void> {
    this.generation++;
    this.model?.dispose();
    this.opt?.dispose();
    this.disposeState();
    this.model = new CharRnn(this.gpu, { cell: this.cell, V: this.vocab.vocabSize, H: CONFIG.H, D: CONFIG.D, rng: mulberry32(1) });
    this.opt = new GpuAdamW(this.model.params, { lr: CONFIG.lr });
    this.state = this.model.zeroState(CONFIG.B);
    this.numParameters = this.model.numParameters;
    this.offset = 0;
    this.step = 0;
    this.ema = NaN;
    this.msPerStep = NaN;
    this.cpu = null;
    this.version++;
    const v = await this.evaluate();
    this.history = [{ step: 0, train: v, val: v }];
  }

  private disposeState(): void {
    this.state?.h.dispose();
    this.state?.c?.dispose();
    this.state = null;
  }

  /** Start of stream b in a text split into `streams` equal parts. */
  private streamLength(src: Int32Array, streams: number): number {
    return Math.floor((src.length - 1) / streams);
  }

  private loadChunk(src: Int32Array, streams: number, offset: number, xs: GpuIds[], ys: GpuIds): void {
    const L = this.streamLength(src, streams);
    const T = xs.length;
    const tgt = new Uint32Array(T * streams);
    const x = new Uint32Array(streams);
    for (let t = 0; t < T; t++) {
      for (let b = 0; b < streams; b++) {
        x[b] = src[b * L + offset + t]!;
        tgt[t * streams + b] = src[b * L + offset + t + 1]!;
      }
      xs[t]!.write(x);
    }
    ys.write(tgt);
  }

  /** Mean cross-entropy (bits/char) over the whole validation split, carrying state across chunks. */
  private async evaluate(): Promise<number> {
    const model = this.model!;
    const S = EVAL_STREAMS, T = CONFIG.T;
    const L = this.streamLength(this.val, S);
    const xs = Array.from({ length: T }, () => new GpuIds(this.gpu, new Uint32Array(S)));
    const ys = new GpuIds(this.gpu, new Uint32Array(T * S));
    let state = model.zeroState(S);
    let sum = 0, n = 0;
    for (let off = 0; off + T < L; off += T) {
      this.loadChunk(this.val, S, off, xs, ys);
      const r = noGradGpu(() => scope(() => {
        const out = model.forward(xs, ys, state);
        return { loss: out.loss, h: out.state.h.detach(), c: out.state.c?.detach() ?? null };
      }));
      state.h.dispose();
      state.c?.dispose();
      state = { h: r.h, c: r.c };
      sum += (await r.loss.item()) * T * S;
      n += T * S;
      r.loss.dispose();
    }
    state.h.dispose();
    state.c?.dispose();
    xs.forEach((x) => x.dispose());
    ys.dispose();
    return sum / n;
  }

  private trainStep(): GpuTensor {
    const { T, B, lr, steps, clip } = CONFIG;
    const model = this.model!, opt = this.opt!;
    if (this.offset + T + 1 > this.streamLength(this.train, B)) {
      this.offset = 0;
      this.disposeState();
      this.state = model.zeroState(B);
    }
    this.loadChunk(this.train, B, this.offset, this.xs, this.ys!);
    this.offset += T;
    opt.lr = lr * 0.5 * (1 + Math.cos((Math.PI * this.step) / steps));
    const r = scope(() => {
      const out = model.forward(this.xs, this.ys!, this.state!);
      out.loss.backward();
      const norm = clipGradNorm(model.params, clip);
      opt.step();
      opt.zeroGrad();
      return { loss: out.loss, norm, h: out.state.h.detach(), c: out.state.c?.detach() ?? null };
    });
    this.disposeState();
    this.state = { h: r.h, c: r.c };
    r.norm.dispose();
    this.step++;
    return r.loss;
  }

  async start(): Promise<void> {
    if (this.running || this.status !== 'ready' || this.step >= CONFIG.steps) return;
    this.running = true;
    const gen = this.generation;
    let perFrame = 1;
    while (this.running && gen === this.generation && this.step < CONFIG.steps) {
      const t0 = performance.now();
      let last: GpuTensor | null = null;
      const k = Math.min(perFrame, CONFIG.steps - this.step);
      for (let s = 0; s < k; s++) {
        last?.dispose();
        last = this.trainStep();
      }
      const l = await last!.item();
      last!.dispose();
      if (gen !== this.generation) return;
      const dt = performance.now() - t0;
      this.msPerStep = Number.isFinite(this.msPerStep) ? 0.8 * this.msPerStep + 0.2 * (dt / k) : dt / k;
      perFrame = Math.max(1, Math.min(20, Math.round((perFrame * 40) / Math.max(dt, 1))));
      this.ema = Number.isFinite(this.ema) ? 0.9 * this.ema + 0.1 * l : l;
      this.version++;
      if (Math.floor(this.step / EVAL_EVERY) > Math.floor((this.step - k) / EVAL_EVERY) || this.step >= CONFIG.steps) {
        this.history = [...this.history, { step: this.step, train: this.ema, val: await this.evaluate() }];
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.running = false;
  }

  pause(): void {
    this.running = false;
  }

  /** A CPU copy of the current weights (cached until training changes them). */
  cpuModel(): Promise<CpuRnn> {
    if (!this.cpu || this.cpu.version !== this.version) this.cpu = { version: this.version, rnn: this.model!.toCpu() };
    return this.cpu.rnn;
  }

  async sample(prompt: string, length: number, temperature = 0.8, seed = Date.now()): Promise<string> {
    const rnn = await this.cpuModel();
    const rng = mulberry32(seed & 0xffffffff);
    const h = new Float32Array(rnn.H), c = new Float32Array(rnn.H);
    const ids = this.vocab.encode([...prompt].filter((ch) => this.vocab.chars.includes(ch)).join('') || '\n');
    let logits: Float32Array = new Float32Array(rnn.V);
    for (const id of ids) logits = rnn.step(id, h, c);
    let out = '';
    for (let i = 0; i < length; i++) {
      const z = logits.map((v) => v / Math.max(temperature, 1e-3));
      const m = Math.max(...z);
      const p = z.map((v) => Math.exp(v - m));
      const s = p.reduce((a, b) => a + b, 0);
      const id = sampleIndex(p.map((v) => v / s), rng());
      out += this.vocab.chars[id];
      logits = rnn.step(id, h, c);
    }
    return out;
  }
}

export const rnn = new RnnTrainer();
