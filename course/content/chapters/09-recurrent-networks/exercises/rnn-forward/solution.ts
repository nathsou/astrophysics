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
  const T = ids[0]!.length;
  for (let t = 0; t < T; t++) {
    const x = nn.embedding(p.E, ids.map((seq) => seq[t]!)); // (B, D): this step's characters
    h = x.matmul(p.W).add(p.b).add(h.matmul(p.U)).tanh(); // the same weights at every step
    hs.push(h);
  }
  return { logits: cat(hs, 0).matmul(p.Wy).add(p.by), h };
}
