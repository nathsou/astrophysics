/**
 * One Adam step on a single weight, with weight decay done two ways.
 *  - 'l2':    add wd·w to the gradient (so the decay passes through Adam's normalisation)
 *  - 'adamw': decoupled — take the Adam step on the raw gradient, then w ← w − lr·wd·w
 * `state` holds this weight's moments and step count (updated in place). Return the new weight.
 */
export function step(w: number, g: number, state: { m: number; v: number; t: number }, lr: number, wd: number, mode: 'l2' | 'adamw', b1 = 0.9, b2 = 0.999, eps = 1e-8): number {
  // TODO
  return w;
}
