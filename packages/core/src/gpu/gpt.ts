/**
 * A GPT-style Transformer on the GPU backend (Chapter 11). Pre-norm blocks:
 *
 *   x ← x + Attention(LN₁(x))
 *   x ← x + W₂ · GELU(W₁ · LN₂(x))
 *
 * with learned position embeddings, a final LayerNorm, and an output layer tied to the token
 * embedding. `mlp: false` and `norm: false` switch parts off for the chapter's ablations.
 * Parameters are named, so checkpoints can be saved and loaded (Chapters 12 and 16).
 */
import { GpuIds, crossEntropy, embedding } from './nn.ts';
import { GpuTensor } from './tensor.ts';
import type { GpuContext } from './context.ts';
import { multiHeadAttention } from './attention.ts';
import { dropout, gelu, layerNorm, matmulT } from './layers.ts';
import { Tensor } from '../tensor/tensor.ts';
import type { Rng } from '../util/random.ts';

export interface GptConfig {
  /** Vocabulary size. */
  V: number;
  /** Context length. */
  T: number;
  /** Width of the residual stream. */
  C: number;
  /** Number of blocks. */
  layers: number;
  heads: number;
  /** MLP hidden width as a multiple of C (4 in GPT-2). */
  mlpRatio?: number;
  dropout?: number;
  mlp?: boolean;
  norm?: boolean;
}

export class Gpt {
  readonly cfg: Required<GptConfig>;
  /** Parameters by name, in a stable order. */
  readonly named: Map<string, GpuTensor>;
  private readonly gpu: GpuContext;
  private positions = new Map<number, GpuIds>();
  private seed = 1;

  constructor(gpu: GpuContext, cfg: GptConfig, rng: Rng) {
    this.gpu = gpu;
    this.cfg = { mlpRatio: 4, dropout: 0, mlp: true, norm: true, ...cfg };
    const { V, T, C, layers, mlpRatio, mlp, norm } = this.cfg;
    const std = 0.02, residual = 0.02 / Math.sqrt(2 * layers); // GPT-2: shrink projections into the residual stream
    const named = new Map<string, GpuTensor>();
    const add = (name: string, t: Tensor) => named.set(name, GpuTensor.from(gpu, t, undefined, { requiresGrad: true }));
    const normal = (shape: number[], s: number) => Tensor.randn(shape, { rng, std: s });
    add('tok', normal([V, C], std));
    add('pos', normal([T, C], std));
    for (let l = 0; l < layers; l++) {
      if (norm) {
        add(`h${l}.ln1.g`, Tensor.ones([C]));
        add(`h${l}.ln1.b`, Tensor.zeros([C]));
      }
      for (const w of ['q', 'k', 'v']) add(`h${l}.attn.${w}`, normal([C, C], std));
      add(`h${l}.attn.o`, normal([C, C], residual));
      if (mlp) {
        if (norm) {
          add(`h${l}.ln2.g`, Tensor.ones([C]));
          add(`h${l}.ln2.b`, Tensor.zeros([C]));
        }
        add(`h${l}.mlp.fc`, normal([C, mlpRatio * C], std));
        add(`h${l}.mlp.proj`, normal([mlpRatio * C, C], residual));
      }
    }
    if (norm) {
      add('lnf.g', Tensor.ones([C]));
      add('lnf.b', Tensor.zeros([C]));
    }
    this.named = named;
  }

  get params(): GpuTensor[] {
    return [...this.named.values()];
  }

  /** Parameters that should not be weight-decayed: biases, norm gains and position embeddings. */
  get noDecay(): GpuTensor[] {
    return [...this.named].filter(([n]) => n.includes('.ln') || n.startsWith('ln') || n === 'pos').map(([, p]) => p);
  }

  get numParameters(): number {
    return this.params.reduce((a, p) => a + p.size, 0);
  }

  private p(name: string): GpuTensor {
    const t = this.named.get(name);
    if (!t) throw new Error(`no parameter ${name}`);
    return t;
  }

  private pos(B: number, T: number): GpuIds {
    const key = B * 100_000 + T;
    let p = this.positions.get(key);
    if (!p) {
      p = new GpuIds(this.gpu, Uint32Array.from({ length: B * T }, (_, i) => i % T));
      this.positions.set(key, p);
    }
    return p;
  }

  /**
   * Hidden states (B·T, C) for ids (B·T, row-major), after the final LayerNorm. `train` enables
   * dropout. Also returns every layer's attention probabilities, for inspection.
   */
  hidden(ids: GpuIds, B: number, T: number, train = false): { h: GpuTensor; probs: GpuTensor[] } {
    const { C, layers, heads, mlp, norm } = this.cfg;
    const drop = (t: GpuTensor) => (train && this.cfg.dropout > 0 ? dropout(t, this.cfg.dropout, this.seed++ * 2654435761) : t);
    const ln = (x: GpuTensor, name: string) => (norm ? layerNorm(x, this.p(`${name}.g`), this.p(`${name}.b`)) : x);
    let x = drop(embedding(this.p('tok'), ids).add(embedding(this.p('pos'), this.pos(B, T)))).reshape(B, T, C);
    const probs: GpuTensor[] = [];
    for (let l = 0; l < layers; l++) {
      const w = { q: this.p(`h${l}.attn.q`), k: this.p(`h${l}.attn.k`), v: this.p(`h${l}.attn.v`), o: this.p(`h${l}.attn.o`) };
      const a = multiHeadAttention(ln(x, `h${l}.ln1`), w, heads);
      probs.push(a.probs);
      x = x.add(drop(a.y));
      if (mlp) x = x.add(drop(gelu(ln(x, `h${l}.ln2`).matmul(this.p(`h${l}.mlp.fc`))).matmul(this.p(`h${l}.mlp.proj`))));
    }
    return { h: ln(x, 'lnf').reshape(B * T, C), probs };
  }

  /** Next-token logits (rows, V) from hidden states, through the tied embedding matrix. */
  logits(h: GpuTensor): GpuTensor {
    return matmulT(h, this.p('tok'));
  }

  /** Mean cross-entropy of predicting `targets` (B·T) from `ids` (B·T). */
  loss(ids: GpuIds, targets: GpuIds, B: number, T: number, train = false): GpuTensor {
    return crossEntropy(this.logits(this.hidden(ids, B, T, train).h), targets);
  }

  /** Copy all parameters to the CPU (for saving, or for CPU-side inspection). */
  async state(): Promise<Map<string, { shape: number[]; data: Float32Array }>> {
    const out = new Map<string, { shape: number[]; data: Float32Array }>();
    for (const [n, p] of this.named) out.set(n, { shape: p.shape, data: await p.read() });
    return out;
  }

  /** Overwrite parameters from a state map (shapes must match). */
  load(state: Map<string, { shape: number[]; data: Float32Array }>): void {
    for (const [n, p] of this.named) {
      const s = state.get(n);
      if (!s) throw new Error(`checkpoint has no ${n}`);
      p.write(s.data);
    }
  }

  dispose(): void {
    this.params.forEach((p) => p.dispose());
    this.positions.forEach((p) => p.dispose());
  }
}
