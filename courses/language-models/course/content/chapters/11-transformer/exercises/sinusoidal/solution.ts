import { Tensor } from '@lm/core/tensor';

/**
 * The sinusoidal position encodings of the original Transformer: a (T, d) matrix with
 *   PE[pos, 2i]     = sin(pos / base^(2i/d))
 *   PE[pos, 2i + 1] = cos(pos / base^(2i/d))
 * for i = 0 … d/2 − 1 (d even).
 */
export function sinusoidal(T: number, d: number, base = 10000): Tensor {
  const data = new Float32Array(T * d);
  for (let pos = 0; pos < T; pos++) {
    for (let i = 0; i < d / 2; i++) {
      const angle = pos / base ** ((2 * i) / d); // wavelengths grow geometrically from 2π to base·2π
      data[pos * d + 2 * i] = Math.sin(angle);
      data[pos * d + 2 * i + 1] = Math.cos(angle);
    }
  }
  return new Tensor(data, [T, d]);
}
