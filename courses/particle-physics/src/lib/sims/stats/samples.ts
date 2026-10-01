/**
 * Toy samples for the cut-optimisation widgets and the cuts exercise: signal and background events drawn, from a seeded generator, from simple
 * distributions given in a plain-data description (so that an exercise can state them in YAML).
 *
 *     { seed: 7,
 *       signal:     { events: 3000,  yield: 60,   vars: { m: { dist: 'normal', mean: 125, sigma: 2.5 }, iso: { dist: 'exponential', mean: 0.1 } } },
 *       background: { events: 30000, yield: 6000, vars: { m: { dist: 'exponential', mean: 35, offset: 100, max: 160 }, iso: { dist: 'exponential', mean: 0.35 } } } }
 *
 * Every generated event stands for `yield / events` expected events. Variables are independent unless a `correlate` entry ties two normal variables together.
 */
import { EventTable } from '$lib/hep/event';
import { normal, rng as makeRng, type Rng } from '$lib/hep/random';
import { sampleFromTable, type OptSample } from '$lib/hep/analysis';

export type Dist =
  | { dist: 'normal'; mean: number; sigma: number; min?: number; max?: number }
  | { dist: 'exponential'; mean: number; offset?: number; min?: number; max?: number }
  | { dist: 'uniform'; lo: number; hi: number }
  | { dist: 'lognormal'; mu: number; sigma: number; min?: number; max?: number }
  | { dist: 'halfnormal'; sigma: number; offset?: number; min?: number; max?: number };

export interface SampleSpec {
  /** Number of generated (Monte Carlo) events. */
  events: number;
  /** Expected number of events of this kind before any cut (cross-section × luminosity). */
  yield: number;
  vars: Record<string, Dist>;
  /** Tie pairs of normal variables with a correlation coefficient: [a, b, rho]. */
  correlate?: [string, string, number][];
}

export interface SampleConfig {
  seed?: number;
  signal: SampleSpec;
  background: SampleSpec;
  /** Relative uncertainty on the background used in the significance (default 0). */
  bkgRelUnc?: number;
}

/** One draw from a distribution, truncated to [min, max] by resampling. */
export function draw(r: Rng, d: Dist): number {
  const lo = 'min' in d && d.min !== undefined ? d.min : -Infinity;
  const hi = 'max' in d && d.max !== undefined ? d.max : Infinity;
  for (let k = 0; k < 200; k++) {
    let x: number;
    switch (d.dist) {
      case 'normal':
        x = normal(r, d.mean, d.sigma);
        break;
      case 'exponential':
        x = (d.offset ?? 0) - d.mean * Math.log(1 - r());
        break;
      case 'uniform':
        x = d.lo + (d.hi - d.lo) * r();
        break;
      case 'lognormal':
        x = Math.exp(normal(r, d.mu, d.sigma));
        break;
      case 'halfnormal':
        x = (d.offset ?? 0) + Math.abs(normal(r, 0, d.sigma));
        break;
      default:
        throw new Error(`unknown distribution ${(d as { dist: string }).dist}`);
    }
    if (x >= lo && x <= hi) return x;
  }
  return Math.min(hi, Math.max(lo, 0));
}

/** Generate one sample as columns and wrap it for the optimiser. */
export function generateSample(spec: SampleSpec, r: Rng): { sample: OptSample; table: EventTable } {
  const names = Object.keys(spec.vars);
  const t = new EventTable(spec.events);
  const cols: Record<string, Float64Array> = Object.fromEntries(names.map((nm) => [nm, new Float64Array(spec.events)]));
  const ties = spec.correlate ?? [];
  for (let i = 0; i < spec.events; i++) {
    const done = new Set<string>();
    for (const [a, b, rho] of ties) {
      const da = spec.vars[a]!, db = spec.vars[b]!;
      if (da.dist !== 'normal' || db.dist !== 'normal') throw new Error('correlate: both variables must be normal');
      const z1 = normal(r), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * normal(r);
      cols[a]![i] = da.mean + da.sigma * z1;
      cols[b]![i] = db.mean + db.sigma * z2;
      done.add(a);
      done.add(b);
    }
    for (const nm of names) if (!done.has(nm)) cols[nm]![i] = draw(r, spec.vars[nm]!);
  }
  for (const nm of names) t.setColumn(nm, cols[nm]!);
  return { sample: sampleFromTable(t, spec.yield / spec.events), table: t };
}

/** Generate the signal and background samples of a configuration (signal first, then background, from one seeded stream). */
export function generateSamples(cfg: SampleConfig): { sig: OptSample; bkg: OptSample } {
  const r = makeRng(cfg.seed ?? 1);
  const sig = generateSample(cfg.signal, r.fork('signal')).sample;
  const bkg = generateSample(cfg.background, r.fork('background')).sample;
  return { sig, bkg };
}

/** The default toy of the CutOptimiser widget: a narrow mass peak and a discriminant that is higher for signal. */
export const DEFAULT_CUT_TOY: SampleConfig = {
  seed: 29,
  signal: {
    events: 2500,
    yield: 150,
    vars: { m: { dist: 'normal', mean: 125, sigma: 2.5 }, d: { dist: 'normal', mean: 0.72, sigma: 0.17, min: 0, max: 1 } },
  },
  background: {
    events: 25000,
    yield: 20000,
    vars: { m: { dist: 'exponential', mean: 35, offset: 100, max: 160 }, d: { dist: 'normal', mean: 0.4, sigma: 0.22, min: 0, max: 1 } },
  },
};
