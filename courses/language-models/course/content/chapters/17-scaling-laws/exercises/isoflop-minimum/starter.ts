/**
 * Runs at one compute budget: model sizes and their final losses. Fit loss = a·x² + b·x + c with
 * x = ln(size), by least squares, and return the size at the parabola's minimum and the loss there.
 */
export function isoflopMinimum(sizes: number[], losses: number[]): { size: number; loss: number } {
  // TODO
  return { size: NaN, loss: NaN };
}
