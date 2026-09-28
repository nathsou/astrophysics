/**
 * Runs at one compute budget: model sizes and their final losses. Fit loss = a·x² + b·x + c with
 * x = ln(size), by least squares, and return the size at the parabola's minimum and the loss there.
 */
export function isoflopMinimum(sizes: number[], losses: number[]): { size: number; loss: number } {
  const xs = sizes.map(Math.log);
  // Normal equations: [Σx⁴ Σx³ Σx²; Σx³ Σx² Σx; Σx² Σx n] · [a b c] = [Σx²y Σxy Σy].
  const s = (k: number) => xs.reduce((acc, x) => acc + x ** k, 0);
  const t = (k: number) => xs.reduce((acc, x, i) => acc + x ** k * losses[i]!, 0);
  const M = [
    [s(4), s(3), s(2), t(2)],
    [s(3), s(2), s(1), t(1)],
    [s(2), s(1), xs.length, t(0)],
  ];
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    [M[col], M[pivot]] = [M[pivot]!, M[col]!];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r]![col]! / M[col]![col]!;
      for (let k = col; k < 4; k++) M[r]![k]! -= f * M[col]![k]!;
    }
  }
  const [a, b, c] = [0, 1, 2].map((i) => M[i]![3]! / M[i]![i]!) as [number, number, number];
  if (!(a > 0)) return { size: NaN, loss: NaN };
  return { size: Math.exp(-b / (2 * a)), loss: c - (b * b) / (4 * a) };
}
