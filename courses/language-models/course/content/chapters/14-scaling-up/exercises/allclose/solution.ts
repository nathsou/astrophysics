export interface Comparison {
  /** Largest |actual − expected|. */
  maxAbs: number;
  /** Largest |actual − expected| / |expected|, over elements whose expected value is not 0. */
  maxRel: number;
  /** Index of the element that exceeds its tolerance by the most (or comes closest to it). */
  worst: number;
  /** True when every element satisfies |actual − expected| ≤ atol + rtol·|expected|, and none is NaN. */
  ok: boolean;
}

/**
 * Compare two arrays element by element, as torch.allclose and numpy.allclose do, and report enough
 * to debug a failure. Throws if the lengths differ.
 */
export function compare(actual: ArrayLike<number>, expected: ArrayLike<number>, rtol = 1e-5, atol = 1e-8): Comparison {
  if (actual.length !== expected.length) throw new Error(`length ${actual.length} ≠ ${expected.length}`);
  let maxAbs = 0, maxRel = 0, worst = 0, worstExcess = -Infinity, ok = true;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i]!, e = expected[i]!;
    const err = Math.abs(a - e);
    // NaN compares false with everything, so test for it explicitly.
    if (Number.isNaN(err)) {
      ok = false;
      if (worstExcess < Infinity) (worst = i), (worstExcess = Infinity);
      continue;
    }
    maxAbs = Math.max(maxAbs, err);
    if (e !== 0) maxRel = Math.max(maxRel, err / Math.abs(e));
    const excess = err - (atol + rtol * Math.abs(e));
    if (excess > 0) ok = false;
    if (excess > worstExcess) (worst = i), (worstExcess = excess);
  }
  return { maxAbs, maxRel, worst, ok };
}
