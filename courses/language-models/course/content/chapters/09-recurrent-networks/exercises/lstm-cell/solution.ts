import { Tensor } from '@lm/core/tensor';

/**
 * One LSTM step. `z` holds the pre-activations of the four gates side by side — columns
 * [0, H) input gate i, [H, 2H) forget gate f, [2H, 3H) output gate o, [3H, 4H) candidate g — for
 * each of B rows. `c` is the previous cell state (B, H).
 *   i, f, o = σ(·),  g = tanh(·),  c′ = f ⊙ c + i ⊙ g,  h′ = o ⊙ tanh(c′)
 */
export function lstmStep(z: Tensor, c: Tensor): { h: Tensor; c: Tensor } {
  const H = c.shape[1]!;
  const i = z.slice(1, 0, H).sigmoid();
  const f = z.slice(1, H, 2 * H).sigmoid();
  const o = z.slice(1, 2 * H, 3 * H).sigmoid();
  const g = z.slice(1, 3 * H, 4 * H).tanh();
  const cNext = f.mul(c).add(i.mul(g)); // additive update: the gradient path through c is just ⊙ f
  return { h: o.mul(cNext.tanh()), c: cNext };
}
