import { Tensor, nn, cat } from '@lm/core/tensor';

/** Parameters of the character RNN (the model in this chapter's trainer). */
export interface RnnParams {
  E: Tensor; //  (V, D) character embeddings
  W: Tensor; //  (D, H) input weights
  b: Tensor; //  (H)    bias
  U: Tensor; //  (H, H) recurrent weights
  Wy: Tensor; // (H, V) output weights
  by: Tensor; // (V)    output bias
}

/**
 * Run an Elman RNN over a batch of sequences.
 *   h_t = tanh(E[x_t] W + b + h_{t−1} U),   logits_t = h_t Wy + by
 * `ids` is B sequences of equal length T. Return the logits for every step, stacked time-major
 * (step 0's B rows, then step 1's, …) as a (T·B, V) tensor, and the final state h_T (B, H).
 */
export function rnnForward(p: RnnParams, ids: number[][], h0: Tensor): { logits: Tensor; h: Tensor } {
  let h = h0;
  const hs: Tensor[] = [];
  // TODO
  return { logits: Tensor.zeros([0, p.Wy.shape[1]!]), h };
}
