/**
 * Estimate ∇f(x) by central differences: ∂f/∂x_i ≈ (f(x + ε e_i) − f(x − ε e_i)) / 2ε.
 * This is slow (two evaluations of f per parameter) but simple — the standard way to *check* a
 * hand-derived or automatic gradient.
 */
export function numericalGradient(f: (x: number[]) => number, x: number[], eps = 1e-5): number[] {
  // TODO
  return x.map(() => 0);
}
