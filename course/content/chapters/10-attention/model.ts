/**
 * Chapter 10's models, on the GPU backend.
 *
 * AttentionLM — an attention-only language model: token and position embeddings, then L layers of
 *   x ← x + MultiHeadAttention(x), then a linear read-out. (Chapter 11 adds the MLP blocks and
 *   normalisation that make this a Transformer.)
 *
 * Recall models — for the associative-recall task: a 2-layer attention model and an LSTM, both
 *   predicting only at the last position.
 */
import { GpuIds, GpuTensor, crossEntropy, embedding, lstmCell, multiHeadAttention, sliceRows, type GpuContext } from '@lm/core/gpu';
import { Tensor } from '@lm/core/tensor';
import type { Rng } from '@lm/core';

export interface AttentionConfig {
  V: number;
  T: number;
  C: number;
  heads: number;
  layers: number;
}

export class AttentionModel {
  readonly cfg: AttentionConfig;
  readonly params: GpuTensor[];
  private readonly gpu: GpuContext;
  private positions = new Map<number, GpuIds>();

  constructor(gpu: GpuContext, cfg: AttentionConfig, rng: Rng) {
    this.gpu = gpu;
    this.cfg = cfg;
    const { V, T, C, layers } = cfg;
    const t = (shape: number[], std: number) => GpuTensor.from(gpu, Tensor.randn(shape, { rng, std }), undefined, { requiresGrad: true });
    this.params = [t([V, C], 0.5), t([T, C], 0.1)];
    for (let l = 0; l < layers; l++) {
      // Q, K, V ~ 1/√C; the output projection smaller, so each layer starts as a small update.
      for (let k = 0; k < 4; k++) this.params.push(t([C, C], (k === 3 ? 0.5 / Math.sqrt(layers) : 1) / Math.sqrt(C)));
    }
    this.params.push(t([C, V], 0.1 / Math.sqrt(C)), GpuTensor.from(gpu, Tensor.zeros([V]), undefined, { requiresGrad: true }));
  }

  get numParameters(): number {
    return this.params.reduce((a, p) => a + p.size, 0);
  }

  private pos(B: number): GpuIds {
    let p = this.positions.get(B);
    if (!p) {
      p = new GpuIds(this.gpu, Uint32Array.from({ length: B * this.cfg.T }, (_, i) => i % this.cfg.T));
      this.positions.set(B, p);
    }
    return p;
  }

  /** Hidden states (B·T, C) after every layer, and each layer's attention probabilities (B, h, T, T). */
  hidden(x: GpuIds, B: number): { h: GpuTensor; probs: GpuTensor[] } {
    const { T, C, heads, layers } = this.cfg;
    const [tok, pos] = this.params as [GpuTensor, GpuTensor];
    let h = embedding(tok, x).add(embedding(pos, this.pos(B))).reshape(B, T, C);
    const probs: GpuTensor[] = [];
    for (let l = 0; l < layers; l++) {
      const [q, k, v, o] = this.params.slice(2 + 4 * l, 6 + 4 * l) as [GpuTensor, GpuTensor, GpuTensor, GpuTensor];
      const a = multiHeadAttention(h, { q, k, v, o }, heads);
      h = h.add(a.y); // residual: each layer adds to what came before
      probs.push(a.probs);
    }
    return { h: h.reshape(B * T, C), probs };
  }

  /** Logits for rows (B·T, C) of hidden states. */
  readout(h: GpuTensor): GpuTensor {
    return h.matmul(this.params.at(-2)!).add(this.params.at(-1)!);
  }

  /** Mean cross-entropy over every position (language modelling). */
  loss(x: GpuIds, y: GpuIds, B: number): GpuTensor {
    return crossEntropy(this.readout(this.hidden(x, B).h), y);
  }

  dispose(): void {
    this.params.forEach((p) => p.dispose());
    this.positions.forEach((p) => p.dispose());
  }
}

/** An LSTM that reads a whole sequence and predicts from its final state (for the recall task). */
export class RecallLstm {
  readonly params: GpuTensor[];
  private readonly gpu: GpuContext;
  readonly H: number;

  constructor(gpu: GpuContext, V: number, H: number, rng: Rng) {
    this.gpu = gpu;
    this.H = H;
    const k = 1 / Math.sqrt(H);
    const t = (x: Tensor) => GpuTensor.from(gpu, x, undefined, { requiresGrad: true });
    this.params = [t(Tensor.randn([V, 4 * H], { rng, std: 0.5 })), t(Tensor.rand([H, 4 * H], { rng, lo: -k, hi: k })), t(Tensor.randn([H, V], { rng, std: 0.1 * k }))];
  }

  /** Logits (B, V) for the token after each sequence; `xs[t]` holds step t's B ids. */
  logits(xs: GpuIds[]): GpuTensor {
    const B = xs[0]!.length;
    const [Wx, U, Wy] = this.params as [GpuTensor, GpuTensor, GpuTensor];
    let h = GpuTensor.zeros(this.gpu, [B, this.H]), c = GpuTensor.zeros(this.gpu, [B, this.H]);
    for (const x of xs) {
      const s = lstmCell(embedding(Wx, x).add(h.matmul(U)), c);
      h = sliceRows(s, 0, B);
      c = sliceRows(s, B, B);
    }
    return h.matmul(Wy);
  }

  dispose(): void {
    this.params.forEach((p) => p.dispose());
  }
}
