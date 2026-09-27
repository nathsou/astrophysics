/**
 * The Chapter 9 character-level recurrent network, on the GPU backend from Chapter 8.
 *
 *   e_t = E[x_t]                                  embedding (V × D)
 *   z_t = e_t W + b + h_{t−1} U                   gate pre-activations (G = H for an RNN, 4H for an LSTM)
 *   RNN:  h_t = tanh(z_t)
 *   LSTM: (h_t, c_t) = lstmCell(z_t, c_{t−1})      the fused kernel in @lm/core/gpu
 *   logits_t = h_t W_y + b_y
 *
 * Because x_t is a single character, e_t W + b is one row of the (V × G) table P = E W + b. The
 * model computes P once per training step and gathers its rows, which is cheaper than T small
 * matmuls and trains exactly like the factorised form.
 */
import { GpuIds, GpuTensor, concatRows, crossEntropy, embedding, lstmCell, sliceRows, type GpuContext } from '@lm/core/gpu';
import { Tensor } from '@lm/core/tensor';
import type { Rng } from '@lm/core';

export type Cell = 'rnn' | 'lstm';

export interface RnnState {
  h: GpuTensor;
  c: GpuTensor | null;
}

export class CharRnn {
  readonly cell: Cell;
  readonly V: number;
  readonly H: number;
  readonly D: number;
  readonly params: GpuTensor[];
  private readonly gpu: GpuContext;

  constructor(gpu: GpuContext, opts: { cell: Cell; V: number; H: number; D: number; rng: Rng }) {
    const { cell, V, H, D, rng } = opts;
    this.gpu = gpu;
    this.cell = cell;
    this.V = V;
    this.H = H;
    this.D = D;
    const G = cell === 'lstm' ? 4 * H : H;
    const k = 1 / Math.sqrt(H); // PyTorch's default range for recurrent weights
    const init = [
      Tensor.randn([V, D], { rng }),
      Tensor.rand([D, G], { rng, lo: -k, hi: k }),
      Tensor.rand([G], { rng, lo: -k, hi: k }),
      Tensor.rand([H, G], { rng, lo: -k, hi: k }),
      Tensor.randn([H, V], { rng, std: 0.1 / Math.sqrt(H) }),
      Tensor.zeros([V]),
    ];
    this.params = init.map((t) => GpuTensor.from(gpu, t, undefined, { requiresGrad: true }));
  }

  get numParameters(): number {
    return this.params.reduce((a, p) => a + p.size, 0);
  }

  zeroState(B: number): RnnState {
    return { h: GpuTensor.zeros(this.gpu, [B, this.H]), c: this.cell === 'lstm' ? GpuTensor.zeros(this.gpu, [B, this.H]) : null };
  }

  /**
   * Unroll over T steps from `state`. `xs[t]` holds the B input ids at step t; `ys` the T·B targets,
   * time-major. Returns the mean cross-entropy and the final state (still attached to the graph).
   */
  forward(xs: GpuIds[], ys: GpuIds, state: RnnState): { loss: GpuTensor; state: RnnState } {
    const [E, W, b, U, Wy, by] = this.params as [GpuTensor, GpuTensor, GpuTensor, GpuTensor, GpuTensor, GpuTensor];
    const B = xs[0]!.length;
    const P = E.matmul(W).add(b);
    let { h, c } = state;
    const outs: GpuTensor[] = [];
    for (const x of xs) {
      const z = embedding(P, x).add(h.matmul(U));
      if (this.cell === 'lstm') {
        const s = lstmCell(z, c!);
        h = sliceRows(s, 0, B);
        c = sliceRows(s, B, B);
      } else {
        h = z.tanh();
      }
      outs.push(h);
    }
    return { loss: crossEntropy(concatRows(outs).matmul(Wy).add(by), ys), state: { h, c } };
  }

  /** Copy the weights to the CPU, for sampling and inspection one character at a time. */
  async toCpu(): Promise<CpuRnn> {
    const [E, W, b, U, Wy, by] = await Promise.all(this.params.map((p) => p.read()));
    return new CpuRnn(this.cell, this.V, this.H, this.D, E!, W!, b!, U!, Wy!, by!);
  }

  dispose(): void {
    for (const p of this.params) p.dispose();
  }
}

/** The same network evaluated with plain loops on the CPU — fast enough for one sequence at a time. */
export class CpuRnn {
  readonly cell: Cell;
  readonly V: number;
  readonly H: number;
  readonly D: number;
  private readonly P: Float32Array;
  private readonly U: Float32Array;
  private readonly Wy: Float32Array;
  private readonly by: Float32Array;

  constructor(cell: Cell, V: number, H: number, D: number, E: Float32Array, W: Float32Array, b: Float32Array, U: Float32Array, Wy: Float32Array, by: Float32Array) {
    this.cell = cell;
    this.V = V;
    this.H = H;
    this.D = D;
    this.U = U;
    this.Wy = Wy;
    this.by = by;
    const G = this.G;
    this.P = new Float32Array(V * G);
    for (let v = 0; v < V; v++) {
      for (let j = 0; j < G; j++) {
        let s = b[j]!;
        for (let d = 0; d < D; d++) s += E[v * D + d]! * W[d * G + j]!;
        this.P[v * G + j] = s;
      }
    }
  }

  get G(): number {
    return this.cell === 'lstm' ? 4 * this.H : this.H;
  }

  /** Advance the state by one character (in place) and return the next-character logits. */
  step(x: number, h: Float32Array, c: Float32Array): Float32Array {
    const { H, G, V } = this;
    const z = this.P.slice(x * G, (x + 1) * G);
    for (let i = 0; i < H; i++) {
      const hi = h[i]!;
      if (hi === 0) continue;
      for (let j = 0; j < G; j++) z[j]! += hi * this.U[i * G + j]!;
    }
    const sig = (v: number) => 1 / (1 + Math.exp(-v));
    for (let j = 0; j < H; j++) {
      if (this.cell === 'lstm') {
        const ig = sig(z[j]!), fg = sig(z[H + j]!), og = sig(z[2 * H + j]!), gg = Math.tanh(z[3 * H + j]!);
        c[j] = fg * c[j]! + ig * gg;
        h[j] = og * Math.tanh(c[j]!);
      } else {
        h[j] = Math.tanh(z[j]!);
      }
    }
    const logits = Float32Array.from(this.by);
    for (let i = 0; i < H; i++) {
      const hi = h[i]!;
      for (let v = 0; v < V; v++) logits[v]! += hi * this.Wy[i * V + v]!;
    }
    return logits;
  }

  /** Run over a sequence, recording every hidden state (and cell state for an LSTM): (T × H) each. */
  trace(ids: ArrayLike<number>): { h: Float32Array; c: Float32Array | null; logits: Float32Array[] } {
    const { H } = this;
    const h = new Float32Array(H), c = new Float32Array(H);
    const hs = new Float32Array(ids.length * H);
    const cs = this.cell === 'lstm' ? new Float32Array(ids.length * H) : null;
    const logits: Float32Array[] = [];
    for (let t = 0; t < ids.length; t++) {
      logits.push(this.step(ids[t]!, h, c));
      hs.set(h, t * H);
      cs?.set(c, t * H);
    }
    return { h: hs, c: cs, logits };
  }
}
