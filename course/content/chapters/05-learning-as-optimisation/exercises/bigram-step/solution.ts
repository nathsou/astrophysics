export function bigramStep(W: Float32Array, V: number, xs: Int32Array, ys: Int32Array, lr: number, lambda: number): number {
  const B = xs.length;
  const grad = new Float32Array(V * V);
  let loss = 0;
  for (let b = 0; b < B; b++) {
    const row = xs[b]! * V;
    let m = -Infinity;
    for (let j = 0; j < V; j++) m = Math.max(m, W[row + j]!);
    let s = 0;
    for (let j = 0; j < V; j++) s += Math.exp(W[row + j]! - m);
    loss += Math.log(s) + m - W[row + ys[b]!]!;
    for (let j = 0; j < V; j++) {
      const p = Math.exp(W[row + j]! - m) / s;
      grad[row + j]! += (p - (j === ys[b] ? 1 : 0)) / B;
    }
  }
  const l2 = (2 * lambda) / (V * V);
  for (let i = 0; i < W.length; i++) W[i]! -= lr * (grad[i]! + l2 * W[i]!);
  return loss / B;
}
