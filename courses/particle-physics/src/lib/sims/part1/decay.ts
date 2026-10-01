/**
 * The model behind the decay clock (Chapter 3): unstable particles with a lifetime τ, the decay times drawn by inverse transform,
 * the decay modes drawn from the branching ratios, and the estimate of τ from what has been seen so far.
 */
import { exponential, choice, type Rng } from '../../hep/random/index.ts';
import { particle, symbols } from '../../hep/particles/index.ts';
import { HBAR_GEV_S } from '../../hep/units/index.ts';

export interface DecayMode {
  label: string;
  br: number;
}
export interface DecayPreset {
  id: string;
  label: string;
  pdg: number;
  /** Mean lifetime τ in seconds (ħ/Γ for a particle that is listed by its width). */
  tauS: number;
  /** Full width Γ in GeV. */
  widthGeV: number;
  massGeV: number;
  modes: DecayMode[];
}

/** The Z's eleven modes of the table, grouped the way the experiments quote them. */
function zModes(): DecayMode[] {
  const z = particle(23);
  const sum = (pred: (p: number[]) => boolean) => z.decays.filter((d) => pred(d.products)).reduce((a, d) => a + d.br, 0);
  const lep = (id: number) => sum((p) => Math.abs(p[0]!) === id);
  return [
    { label: 'e⁺e⁻', br: lep(11) },
    { label: 'μ⁺μ⁻', br: lep(13) },
    { label: 'τ⁺τ⁻', br: lep(15) },
    { label: 'νν̄ (invisible)', br: sum((p) => [12, 14, 16].includes(Math.abs(p[0]!))) },
    { label: 'qq̄ (hadrons)', br: sum((p) => Math.abs(p[0]!) <= 5) },
  ];
}

function modesOf(pdg: number): DecayMode[] {
  if (pdg === 23) return zModes();
  return particle(pdg).decays.map((d) => ({ label: symbols(d.products).replace(/ /g, ' '), br: d.br }));
}

function preset(id: string, label: string, pdg: number): DecayPreset {
  const p = particle(pdg);
  const tauS = Number.isFinite(p.lifetime) ? p.lifetime : Infinity;
  return { id, label, pdg, tauS, widthGeV: p.width > 0 ? p.width : HBAR_GEV_S / tauS, massGeV: p.mass, modes: modesOf(pdg) };
}

export const PRESETS: DecayPreset[] = [
  preset('mu', 'μ⁻', 13),
  preset('pi+', 'π⁺', 211),
  preset('ks', 'K_S', 310),
  preset('pi0', 'π⁰', 111),
  preset('jpsi', 'J/ψ', 443),
  preset('z', 'Z', 23),
];

/** The decay times of n particles of mean lifetime τ (in any unit), sorted, each with the index of its decay mode. */
export function sampleDecays(r: Rng, n: number, tau: number, weights: readonly number[]): { t: Float64Array; mode: Uint8Array } {
  const items = Array.from({ length: n }, () => ({ t: exponential(r, tau), m: weights.length > 1 ? choice(r, weights) : 0 }));
  items.sort((a, b) => a.t - b.t);
  const t = new Float64Array(n);
  const mode = new Uint8Array(n);
  items.forEach((it, i) => {
    t[i] = it.t;
    mode[i] = it.m;
  });
  return { t, mode };
}

/** How many of the sorted decay times are at or before t. */
export function decayedBy(sorted: ArrayLike<number>, t: number): number {
  let a = 0, b = sorted.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (sorted[m]! <= t) a = m + 1;
    else b = m;
  }
  return a;
}

/**
 * The maximum-likelihood lifetime from particles watched up to time `tObs`: total observed time divided by the number of decays.
 * (Particles that have not decayed yet count for the time they were watched.) The uncertainty is τ̂/√k for k decays.
 */
export function lifetimeEstimate(sorted: ArrayLike<number>, tObs: number): { tau: number; err: number; decays: number } {
  const k = decayedBy(sorted, tObs);
  if (k === 0) return { tau: NaN, err: NaN, decays: 0 };
  let exposure = 0;
  for (let i = 0; i < k; i++) exposure += sorted[i]!;
  exposure += (sorted.length - k) * tObs;
  const tau = exposure / k;
  return { tau, err: tau / Math.sqrt(k), decays: k };
}

/** The width Γ in GeV for a lifetime in seconds, Γ = ħ/τ. */
export const widthOf = (tauS: number): number => HBAR_GEV_S / tauS;
/** The lifetime in seconds for a width in GeV. */
export const lifetimeOf = (widthGeV: number): number => HBAR_GEV_S / widthGeV;

/** Format a width given in GeV with an SI prefix, down to eV, then as a power of ten in eV. */
export function formatWidth(gev: number): string {
  const ev = gev * 1e9;
  if (ev >= 1e9) return `${sig(ev / 1e9)} GeV`;
  if (ev >= 1e6) return `${sig(ev / 1e6)} MeV`;
  if (ev >= 1e3) return `${sig(ev / 1e3)} keV`;
  if (ev >= 1) return `${sig(ev)} eV`;
  return `${ev.toExponential(2).replace('e', ' × 10^').replace('^-', '^−')} eV`;
}
function sig(x: number): string {
  return Number(x.toPrecision(3)).toString();
}
