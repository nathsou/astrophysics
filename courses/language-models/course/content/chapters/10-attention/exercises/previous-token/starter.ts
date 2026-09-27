import { Tensor } from '@lm/core/tensor';

/**
 * Hand-build an attention head that copies the PREVIOUS token.
 *
 * Each position's input vector (length V + T) is [onehot(token) ; onehot(position)]: the first V
 * entries say which token is there, the last T say where. Choose Wq, Wk (V + T, T) and Wv (V + T, V)
 * so that with q = x Wq, k = x Wk, v = x Wv and causal attention (see the previous exercise), the
 * output at every position i ≥ 1 is (almost exactly) onehot(token at i − 1).
 *
 * Use a large scale β in the queries so the softmax is nearly a hard choice.
 */
export function previousTokenHead(V: number, T: number, beta = 20): { Wq: Tensor; Wk: Tensor; Wv: Tensor } {
  const Wq = Tensor.zeros([V + T, T]);
  const Wk = Tensor.zeros([V + T, T]);
  const Wv = Tensor.zeros([V + T, V]);
  // TODO: fill them in with Wq.set(value, row, col) etc.
  return { Wq, Wk, Wv };
}
