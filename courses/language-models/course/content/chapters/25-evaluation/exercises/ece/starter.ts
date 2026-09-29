/**
 * Expected calibration error with B equal-width bins: the average, weighted by the number of predictions in each
 * bin, of |mean confidence − fraction correct|. 0 for a perfectly calibrated model.
 */
export function ece(predictions: { confidence: number; correct: boolean }[], B = 10): number {
  // TODO
  return 0;
}
