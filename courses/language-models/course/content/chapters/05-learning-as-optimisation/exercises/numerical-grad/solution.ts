export function numericalGradient(f: (x: number[]) => number, x: number[], eps = 1e-5): number[] {
  return x.map((_, i) => {
    const up = [...x], down = [...x];
    up[i]! += eps;
    down[i]! -= eps;
    return (f(up) - f(down)) / (2 * eps);
  });
}
