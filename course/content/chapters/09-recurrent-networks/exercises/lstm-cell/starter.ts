import { Tensor } from '@lm/core/tensor';

/**
 * One LSTM step. `z` holds the pre-activations of the four gates side by side — columns
 * [0, H) input gate i, [H, 2H) forget gate f, [2H, 3H) output gate o, [3H, 4H) candidate g — for
 * each of B rows. `c` is the previous cell state (B, H).
 *   i, f, o = σ(·),  g = tanh(·),  c′ = f ⊙ c + i ⊙ g,  h′ = o ⊙ tanh(c′)
 */
export function lstmStep(z: Tensor, c: Tensor): { h: Tensor; c: Tensor } {
  const H = c.shape[1]!;
  // TODO
  return { h: c, c };
}
