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
  // TODO
  return { maxAbs: 0, maxRel: 0, worst: 0, ok: true };
}
