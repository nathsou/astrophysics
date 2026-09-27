export function gradientDescent(grad: (x: number[]) => number[], x0: number[], lr: number, steps: number): number[][] {
  const path = [x0];
  let x = x0;
  for (let t = 0; t < steps; t++) {
    const g = grad(x);
    x = x.map((xi, i) => xi - lr * g[i]!);
    path.push(x);
  }
  return path;
}
