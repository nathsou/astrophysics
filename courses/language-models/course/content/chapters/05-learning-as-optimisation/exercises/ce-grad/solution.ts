export function softmaxCrossEntropy(logits: number[], target: number): { loss: number; grad: number[] } {
  const m = Math.max(...logits);
  const e = logits.map((z) => Math.exp(z - m));
  const s = e.reduce((a, b) => a + b, 0);
  const p = e.map((x) => x / s);
  // −log p[target] = log Σ exp(z) − z_target, computed without forming p[target] (which may underflow).
  const loss = Math.log(s) + m - logits[target]!;
  return { loss, grad: p.map((pi, j) => pi - (j === target ? 1 : 0)) };
}
