/**
 * One SGD step for the neural bigram model — by hand, no autograd.
 *
 * W is a V×V row-major matrix; row x holds the logits for the character that follows x.
 * For a batch of (xs[b], ys[b]) pairs:
 *   loss = mean_b −log softmax(W[xs[b]])[ys[b]]  +  λ · mean(W²)
 * The data term's gradient only touches rows that appear in the batch: for each example,
 *   ∂/∂W[xs[b]] += (softmax(W[xs[b]]) − onehot(ys[b])) / B
 * and the L2 term adds 2λ·W / (V·V) to every entry.
 *
 * Update W in place (W ← W − lr · grad) and return the mean data loss (without the L2 term).
 */
export function bigramStep(W: Float32Array, V: number, xs: Int32Array, ys: Int32Array, lr: number, lambda: number): number {
  const B = xs.length;
  const grad = new Float32Array(V * V);
  let loss = 0;
  // TODO: accumulate the loss and the gradient example by example, add the L2 gradient, update W.
  return loss / B;
}
