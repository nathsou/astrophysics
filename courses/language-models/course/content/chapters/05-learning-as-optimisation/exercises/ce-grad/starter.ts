/**
 * Softmax cross-entropy for one example, and its gradient with respect to the logits.
 *   p = softmax(logits),  loss = −log p[target],  ∂loss/∂logits = p − onehot(target)
 */
export function softmaxCrossEntropy(logits: number[], target: number): { loss: number; grad: number[] } {
  // TODO: compute p stably (subtract the max), then the loss and gradient.
  return { loss: 0, grad: logits.map(() => 0) };
}
