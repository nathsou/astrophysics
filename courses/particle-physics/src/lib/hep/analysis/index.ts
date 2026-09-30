/**
 * `hep/analysis`: histograms, selections, fits, significance and limits.
 *
 * See README.md in this directory for the API and worked examples. Everything is deterministic: functions that need random numbers take a seeded `Rng`.
 * Three functions the reader writes in Chapter 28 are plugged in through hooks: `analysis.fitLikelihood`, `analysis.significance` and `analysis.cls`.
 */
export * from './special.ts';
export * from './counting.ts';
export * from './hist.ts';
export * from './select.ts';
export * from './minimize.ts';
export * from './models.ts';
export * from './fit.ts';
export * from './likelihood.ts';
export * from './significance.ts';
export * from './limits.ts';
export * from './bumphunt.ts';
export * from './optimise.ts';
