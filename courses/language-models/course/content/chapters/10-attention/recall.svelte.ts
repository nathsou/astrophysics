/**
 * Associative recall: a sequence of n key–value pairs, then a query key; predict its value.
 *   e.g.  c 7 f 1 k 3 ? f  →  1
 * Attention can look the key up directly; an LSTM must hold every pair in its fixed-size state.
 * Both models train side by side on fresh random sequences.
 */
import { GpuAdamW, GpuIds, clipGradNorm, crossEntropy, embedding, scope, type GpuContext, type GpuTensor } from '@lm/core/gpu';
import { mulberry32, type Rng } from '@lm/core';
import { getGpu } from '$lib/gpu/compute';
import { AttentionModel, RecallLstm } from './model';

export const KEYS = 'abcdefghijklmnopqrstuvwxyz';
const K = 26, VALUES = 10, QUERY = K + VALUES, V = K + VALUES + 1;
export const RECALL = { B: 128, steps: 1500, evalEvery: 50, lr: 3e-3 };

export function tokenLabel(id: number): string {
  return id < K ? KEYS[id]! : id < K + VALUES ? String(id - K) : '?';
}

/** A batch of B random recall sequences with n pairs each (length 2n + 2) and their answers. */
export function recallBatch(n: number, B: number, rng: Rng): { xs: Uint32Array; ys: Uint32Array } {
  const T = 2 * n + 2;
  const xs = new Uint32Array(B * T), ys = new Uint32Array(B);
  for (let b = 0; b < B; b++) {
    const keys = Array.from({ length: K }, (_, i) => i);
    for (let i = K - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    }
    const vals = keys.slice(0, n).map(() => K + Math.floor(rng() * VALUES));
    for (let i = 0; i < n; i++) {
      xs[b * T + 2 * i] = keys[i]!;
      xs[b * T + 2 * i + 1] = vals[i]!;
    }
    const q = Math.floor(rng() * n);
    xs[b * T + 2 * n] = QUERY;
    xs[b * T + 2 * n + 1] = keys[q]!;
    ys[b] = vals[q]!;
  }
  return { xs, ys };
}

type Racer = 'attention' | 'lstm';

class RecallRace {
  n = $state(16);
  status = $state<'idle' | 'loading' | 'ready' | 'unsupported'>('idle');
  running = $state(false);
  step = $state(0);
  /** Accuracy on a fixed held-out batch, per racer. */
  history = $state.raw<{ step: number; attention: number; lstm: number }[]>([]);
  example = $state.raw<{ tokens: string[]; answer: string; attention: string; lstm: string } | null>(null);

  private gpu!: GpuContext;
  private attn: AttentionModel | null = null;
  private lstm: RecallLstm | null = null;
  private opts: Record<Racer, GpuAdamW> | null = null;
  private rng = mulberry32(1);
  private generation = 0;
  private buffers: { X: GpuIds; XT: GpuIds[]; Y: GpuIds; last: GpuIds } | null = null;
  private test: { xs: Uint32Array; ys: Uint32Array; X: GpuIds; XT: GpuIds[]; Y: GpuIds } | null = null;

  async load(): Promise<void> {
    if (this.status !== 'idle') return;
    this.status = 'loading';
    const gpu = await getGpu();
    if (!gpu) {
      this.status = 'unsupported';
      return;
    }
    this.gpu = gpu;
    this.build();
    this.status = 'ready';
  }

  setN(n: number): void {
    this.running = false;
    this.n = n;
    if (this.status === 'ready') this.build();
  }

  private ids(xs: Uint32Array, B: number): { X: GpuIds; XT: GpuIds[] } {
    const T = 2 * this.n + 2;
    return {
      X: new GpuIds(this.gpu, xs),
      XT: Array.from({ length: T }, (_, t) => new GpuIds(this.gpu, Uint32Array.from({ length: B }, (_, b) => xs[b * T + t]!))),
    };
  }

  build(): void {
    this.generation++;
    this.attn?.dispose();
    this.lstm?.dispose();
    Object.values(this.opts ?? {}).forEach((o) => o.dispose());
    for (const b of [this.buffers, this.test]) b && [b.X, ...b.XT, b.Y].forEach((x) => x.dispose());
    this.buffers?.last.dispose();
    const { B, lr } = RECALL;
    const T = 2 * this.n + 2;
    this.rng = mulberry32(1);
    this.attn = new AttentionModel(this.gpu, { V, T, C: 64, heads: 4, layers: 2 }, this.rng);
    this.lstm = new RecallLstm(this.gpu, V, 128, this.rng);
    this.opts = { attention: new GpuAdamW(this.attn.params, { lr }), lstm: new GpuAdamW(this.lstm.params, { lr }) };
    const blank = new Uint32Array(B * T);
    this.buffers = { ...this.ids(blank, B), Y: new GpuIds(this.gpu, new Uint32Array(B)), last: new GpuIds(this.gpu, Uint32Array.from({ length: B }, (_, b) => b * T + T - 1)) };
    const t = recallBatch(this.n, B, mulberry32(999));
    this.test = { ...t, ...this.ids(t.xs, B), Y: new GpuIds(this.gpu, t.ys) };
    this.step = 0;
    this.history = [{ step: 0, attention: 0.1, lstm: 0.1 }];
    this.example = null;
  }

  private logits(racer: Racer, X: GpuIds, XT: GpuIds[]): GpuTensor {
    if (racer === 'lstm') return this.lstm!.logits(XT);
    const { h } = this.attn!.hidden(X, RECALL.B);
    return this.attn!.readout(embedding(h, this.buffers!.last)); // only the last position predicts
  }

  private async accuracy(racer: Racer): Promise<{ acc: number; preds: Uint32Array }> {
    const test = this.test!;
    const lg = scope(() => this.logits(racer, test.X, test.XT));
    const v = await lg.read();
    lg.dispose();
    const preds = new Uint32Array(RECALL.B);
    let correct = 0;
    for (let b = 0; b < RECALL.B; b++) {
      let best = 0;
      for (let k = 1; k < V; k++) if (v[b * V + k]! > v[b * V + best]!) best = k;
      preds[b] = best;
      if (best === test.ys[b]) correct++;
    }
    return { acc: correct / RECALL.B, preds };
  }

  private trainStep(): void {
    const { B } = RECALL;
    const { xs, ys } = recallBatch(this.n, B, this.rng);
    const bufs = this.buffers!;
    const T = 2 * this.n + 2;
    bufs.X.write(xs);
    bufs.Y.write(ys);
    bufs.XT.forEach((x, t) => x.write(Uint32Array.from({ length: B }, (_, b) => xs[b * T + t]!)));
    for (const racer of ['attention', 'lstm'] as Racer[]) {
      const model = racer === 'lstm' ? this.lstm! : this.attn!;
      scope(() => {
        const loss = crossEntropy(this.logits(racer, bufs.X, bufs.XT), bufs.Y);
        loss.backward();
        clipGradNorm(model.params, 1);
        this.opts![racer].step();
        this.opts![racer].zeroGrad();
      });
    }
    this.step++;
  }

  async start(): Promise<void> {
    if (this.running || this.status !== 'ready' || this.step >= RECALL.steps) return;
    this.running = true;
    const gen = this.generation;
    while (this.running && gen === this.generation && this.step < RECALL.steps) {
      for (let s = 0; s < 10 && this.step < RECALL.steps; s++) this.trainStep();
      if (this.step % RECALL.evalEvery === 0 || this.step >= RECALL.steps) {
        const [a, l] = await Promise.all([this.accuracy('attention'), this.accuracy('lstm')]);
        if (gen !== this.generation) return;
        this.history = [...this.history, { step: this.step, attention: a.acc, lstm: l.acc }];
        const T = 2 * this.n + 2;
        const toks = Array.from(this.test!.xs.subarray(0, T), tokenLabel);
        this.example = { tokens: toks, answer: tokenLabel(this.test!.ys[0]!), attention: tokenLabel(a.preds[0]!), lstm: tokenLabel(l.preds[0]!) };
      } else {
        await this.gpu.sync();
      }
      await new Promise((r) => requestAnimationFrame(r));
    }
    this.running = false;
  }

  pause(): void {
    this.running = false;
  }
}

export const race = new RecallRace();
