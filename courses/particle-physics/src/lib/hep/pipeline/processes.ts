/**
 * From a sample specification to a `Process` of hep/gen, with an optional generator-level window, and its cross-section.
 *
 * A *window* is a cut on the hard process, made before the parton shower, hadronisation and detector simulation, which are the
 * expensive stages. For the diphoton background of H → γγ, only about one hard event in six has a mass between 100 and 160 GeV: the
 * others would be simulated and then thrown away by the analysis. The window rejects them at the cost of one hard-process call
 * (about 70 µs), and the sample's cross-section is multiplied by the fraction that passed, found with a fixed-seed Monte Carlo
 * (`WINDOW_EVENTS` hard events), so the normalisation does not depend on call order or on which worker computed it.
 */
import { diphoton, dijets, drellYan, getProcess, higgsGGF, ttbar, wBoson, type HiggsDecay, type Process, type ProcessConfig } from '../gen/index.ts';
import type { TruthEvent } from '../event/index.ts';
import { invariantMass } from '../kinematics/index.ts';
import { rng } from '../random/index.ts';
import { mix32 } from './rand.ts';
import type { GenWindow, SampleSpec } from './config.ts';
import { zzStarProcess } from './zz.ts';

/** Hard events used to estimate the fraction of a window (statistical error about 0.3 % for a fraction of 0.2). */
export const WINDOW_EVENTS = 20000;

const num = (o: SampleSpec['options'], k: string): number | undefined => (o && typeof o[k] === 'number' ? (o[k] as number) : undefined);

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** The mass of the two hardest outgoing particles of type `pdg` in a hard-process record (NaN if there are fewer than two). */
export function windowMass(ev: TruthEvent, pdg: number): number {
  const c = ev.particles.filter((p) => p.status === 'final' && Math.abs(p.pdg) === pdg).sort((a, b) => Math.hypot(b.p.px, b.p.py) - Math.hypot(a.p.px, a.p.py));
  return c.length >= 2 ? invariantMass([c[0]!.p, c[1]!.p]) : NaN;
}

/** The process named by a sample, with its factory options applied (no window). */
function baseProcess(spec: SampleSpec): Process {
  const o = spec.options;
  const n = spec.process;
  if (n === 'pp->ZZ*->4l') return zzStarProcess({ lo: num(o, 'lo'), hi: num(o, 'hi') });
  if (!o || Object.keys(o).length === 0) return getProcess(n);
  const lep = /^pp->Z->(mumu|ee|tautau)$/.exec(n);
  if (lep) return drellYan({ lepton: ({ mumu: 'mu', ee: 'e', tautau: 'tau' } as const)[lep[1] as 'mumu' | 'ee' | 'tautau'], mMin: num(o, 'mMin'), mMax: num(o, 'mMax') });
  if (n === 'pp->jj' || n === 'pp->dijets') return dijets({ ptMin: num(o, 'ptMin'), ptMax: num(o, 'ptMax') });
  if (n === 'pp->gammagamma' || n === 'pp->diphoton') return diphoton({ ptMin: num(o, 'ptMin'), ptMax: num(o, 'ptMax') });
  const h = /^pp->H->(gammagamma|ZZ->4l)$/.exec(n);
  if (h) return higgsGGF({ decay: (h[1] === 'gammagamma' ? 'gammagamma' : 'ZZ4l') as HiggsDecay, mH: num(o, 'mH') });
  const w = /^pp->W->(munu|enu)$/.exec(n);
  if (w) return wBoson({ lepton: w[1] === 'munu' ? 'mu' : 'e', mMin: num(o, 'mMin'), mMax: num(o, 'mMax') });
  if (n === 'pp->ttbar') return ttbar({});
  throw new Error(`process "${n}" takes no options here (got ${Object.keys(o).join(', ')})`);
}

const processCache = new Map<string, Process>();
const effCache = new Map<string, { eff: number; error: number }>();
const specKey = (spec: SampleSpec): string => JSON.stringify([spec.process, spec.options ?? {}, spec.window ?? null]);

/** Wrap `base` so that only hard events inside the window are returned. */
function windowed(base: Process, w: GenWindow, key: string): Process {
  const pass = (ev: TruthEvent) => {
    const m = windowMass(ev, w.pdg);
    return m >= w.lo && m < w.hi;
  };
  const fraction = (sqrtS: number): { eff: number; error: number } => {
    const k = `${key}@${sqrtS}`;
    let e = effCache.get(k);
    if (!e) {
      const r = rng(mix32(hash(key), Math.round(sqrtS)));
      let ok = 0;
      for (let i = 0; i < WINDOW_EVENTS; i++) if (pass(base.generate(r, { sqrtS }).event)) ok++;
      const eff = ok / WINDOW_EVENTS;
      e = { eff, error: Math.sqrt((eff * (1 - eff)) / WINDOW_EVENTS) };
      effCache.set(k, e);
    }
    return e;
  };
  return {
    name: `${base.name}[${w.lo}<m${w.pdg}<${w.hi}]`,
    title: `${base.title} (${w.lo} < m < ${w.hi} GeV)`,
    beams: base.beams,
    sigma: (sqrtS) => base.sigma(sqrtS) * fraction(sqrtS).eff,
    weightedPoint: () => {
      throw new Error('a windowed process has no weighted point; use generate()');
    },
    generate(r, cfg: ProcessConfig) {
      for (let n = 0; n < 1e6; n++) {
        const res = base.generate(r, cfg);
        if (pass(res.event)) return res;
      }
      throw new Error(`${base.name}: no event inside the window ${w.lo}–${w.hi} GeV in 10⁶ trials`);
    },
  };
}

/** The process of a sample, with its window if it has one. Cached by specification. */
export function processFor(spec: SampleSpec): Process {
  const key = specKey(spec);
  let p = processCache.get(key);
  if (!p) {
    p = baseProcess(spec);
    if (spec.window) p = windowed(p, spec.window, key);
    processCache.set(key, p);
  }
  return p;
}

/** The fraction of the base process' hard events inside the sample's window, with its statistical error (1 if there is no window). */
export function windowFraction(spec: SampleSpec, sqrtS: number): { eff: number; error: number } {
  if (!spec.window) return { eff: 1, error: 0 };
  const p = processFor(spec);
  p.sigma(sqrtS); // fills the cache
  return effCache.get(`${specKey(spec)}@${sqrtS}`)!;
}

/**
 * The leading-order cross-section of a sample in pb at √s (window included; the K-factor is not: see `sampleXsec`).
 * The first call at a new √s trains the process's integration grid (0.1 to 2 s); later calls are free.
 */
export function sampleSigmaLO(spec: SampleSpec, sqrtS: number): number {
  return processFor(spec).sigma(sqrtS);
}

/** The cross-section of a sample in pb with its K-factor (the sample's own times the global one). */
export function sampleXsec(spec: SampleSpec, sqrtS: number, globalK = 1): number {
  return sampleSigmaLO(spec, sqrtS) * (spec.kFactor ?? 1) * globalK;
}
