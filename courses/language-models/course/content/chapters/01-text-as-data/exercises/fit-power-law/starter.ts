export interface PowerLawFit {
  s: number; // exponent in f(r) = C / r^s
  C: number; // scale
  r2: number; // coefficient of determination of the log–log fit
}

/**
 * Fit f(x) = C / x^s to points (xs[i], ys[i]) by least squares on the log–log line
 *
 *   log y = log C − s · log x
 *
 * Skip points where x or y is not positive (their logarithm is undefined).
 */
export function fitPowerLaw(xs: number[], ys: number[]): PowerLawFit {
  // TODO: accumulate Σ log x, Σ log y, Σ (log x)², Σ log x · log y; solve for slope and intercept.
  return { s: 1, C: 1, r2: 0 };
}
