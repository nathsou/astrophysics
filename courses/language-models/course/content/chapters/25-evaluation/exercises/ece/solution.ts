/**
 * Expected calibration error with B equal-width bins: the average, weighted by the number of predictions in each
 * bin, of |mean confidence − fraction correct|. 0 for a perfectly calibrated model.
 */
export function ece(predictions: { confidence: number; correct: boolean }[], B = 10): number {
  const conf = new Array<number>(B).fill(0);
  const right = new Array<number>(B).fill(0);
  const count = new Array<number>(B).fill(0);
  for (const p of predictions) {
    const b = Math.min(B - 1, Math.floor(p.confidence * B));
    conf[b]! += p.confidence;
    right[b]! += Number(p.correct);
    count[b]!++;
  }
  let total = 0;
  for (let b = 0; b < B; b++) if (count[b]) total += Math.abs(conf[b]! - right[b]!); // = count·|mean conf − accuracy|
  return total / predictions.length;
}
