import { Tensor } from '@lm/core/tensor';

/**
 * The sinusoidal position encodings of the original Transformer: a (T, d) matrix with
 *   PE[pos, 2i]     = sin(pos / base^(2i/d))
 *   PE[pos, 2i + 1] = cos(pos / base^(2i/d))
 * for i = 0 … d/2 − 1 (d even).
 */
export function sinusoidal(T: number, d: number, base = 10000): Tensor {
  // TODO
  return Tensor.zeros([T, d]);
}
