/**
 * Plain gradient descent: x ← x − η · ∇f(x), repeated `steps` times.
 * Return the whole trajectory, starting with x0 (so steps + 1 points).
 */
export function gradientDescent(grad: (x: number[]) => number[], x0: number[], lr: number, steps: number): number[][] {
  const path = [x0];
  // TODO
  return path;
}
