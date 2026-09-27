import { Tensor } from '@lm/core/tensor';

/**
 * How much does the state k steps back influence the final state? Run the tanh RNN
 *   h_t = tanh(x_t + h_{t−1} U)            (inputs x_t are given, already projected: (1, H) each)
 * from h_0 = 0 over all T = xs.length steps. Return ‖∂(v · h_T) / ∂h_{T−k}‖, the length of the
 * gradient of the scalar v · h_T with respect to the state k steps before the end.
 *
 * Use autograd: make the state at step T − k a leaf that requires gradients.
 */
export function influence(U: Tensor, xs: Tensor[], v: Tensor, k: number): number {
  const T = xs.length;
  let h = Tensor.zeros([1, U.shape[0]!]);
  let leaf: Tensor | null = null;
  // TODO
  return 0;
}
