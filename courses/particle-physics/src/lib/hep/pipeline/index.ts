/**
 * `hep/pipeline`: the whole mini-LHC as one function call. Machine → generator → detector → reconstruction → trigger → analysis, with every stage's
 * hooks live, so the reader's code runs inside. See README.md for the configuration schema, the presets and the loader contract for real data.
 *
 *     import { presetConfig, runBatch, summarise, sampleXsec } from 'hep/pipeline';
 *     const cfg = presetConfig('zmumu');
 *     const res = runBatch(cfg, 500, 1);                        // events 0…499 of the run with seed 1
 *     const sum = summarise(res, cfg, cfg.generator.samples.map((s) => sampleXsec(s, cfg.machine.sqrtS)));
 */
export * from './config.ts';
export * from './rand.ts';
export * from './processes.ts';
export * from './observables.ts';
export * from './accum.ts';
export * from './machine.ts';
export * from './run.ts';
export * from './summary.ts';
export * from './samples.ts';
export * from './real.ts';
export { zzStarProcess, zzForm, dsigmaDcos, type ZZOptions } from './zz.ts';
