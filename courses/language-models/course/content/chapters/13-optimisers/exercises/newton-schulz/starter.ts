import { Tensor } from '@lm/core/tensor';

/**
 * Muon's orthogonalisation: approximately replace a matrix G = U S Vᵀ by U Vᵀ (all singular values
 * set to 1) using only matrix products — the quintic Newton–Schulz iteration of Jordan et al.:
 *   X ← G / ‖G‖_F;   repeat:  A = X Xᵀ,  B = b·A + c·A²,  X ← a·X + B X
 * with (a, b, c) = (3.4445, −4.7750, 2.0315).
 */
export function newtonSchulz(G: Tensor, steps = 5): Tensor {
  const [a, b, c] = [3.4445, -4.775, 2.0315];
  // TODO
  return G;
}
