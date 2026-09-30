/**
 * Hadron species for the toy Lund model: which particle of the table a given quark content makes.
 *
 * A "content" is a list of signed quark flavours (PDG IDs of the quarks; negative for antiquarks): [2, -1] is u d̄.
 * The particle table is incomplete (no K*, D*, B*, B_c, Σ*, Ξ*, Σ_c, Ξ_c …); where a needed species is missing the
 * closest one that carries the same flavour is used (the pseudoscalar instead of the vector), so that flavour is
 * always conserved. See README.md for the list.
 */
import { particle } from '../particles/index.ts';
import type { Rng } from '../random/index.ts';
import { sampleMass } from '../decay/masses.ts';

export interface FlavourParams {
  /** Probability of an s s̄ pair relative to u ū or d d̄ (each 1). Pythia's older default was 0.3 (from memory); recent tunes use about 0.22. */
  probStrange: number;
  /** Probability that a string break makes a diquark–antidiquark pair (baryon production). */
  probDiquark: number;
  /** Probability of the vector meson (ρ, ω, φ) rather than the pseudoscalar for light flavours, where both exist in the table: 3:1 by spin counting. */
  vectorFraction: number;
  /** Probability of the decuplet baryon (Δ) rather than the octet one (p, n) for uud and udd. */
  decupletFraction: number;
}

export const defaultFlavour: FlavourParams = { probStrange: 0.3, probDiquark: 0.1, vectorFraction: 0.75, decupletFraction: 0.4 };

// Flavour ids: d = 1, u = 2, s = 3, c = 4, b = 5. Key = 10·quark + antiquark.
const MESON: Record<number, number> = {
  21: 211, 12: -211, 23: 321, 32: -321, 13: 311, 31: -311,
  42: 421, 24: -421, 41: 411, 14: -411, 43: 431, 34: -431,
  25: 521, 52: -521, 15: 511, 51: -511, 35: 531, 53: -531,
};
// Sorted flavour triple → [octet or only state, decuplet or second state].
const BARYON: Record<string, [number, number?]> = {
  '112': [2112, 2114], '122': [2212, 2214], '111': [1114], '222': [2224], '123': [3122, 3212], '223': [3222], '113': [3112],
  '233': [3322], '133': [3312], '333': [3334], '124': [4122], '125': [5122],
};

/** The PDG IDs of every table particle the content can make (empty if none). Used for thresholds; no random numbers. */
export function candidates(content: readonly number[]): number[] {
  const n = content.length;
  if (n === 2) {
    let a = 0, b = 0;
    for (const x of content) {
      if (x > 0) a = x;
      else b = -x;
    }
    if (a === 0 || b === 0) return [];
    if (a === b) return a <= 2 ? [111, 221, 331, 113, 223] : a === 3 ? [221, 331, 333] : a === 4 ? [443] : [553];
    const m = MESON[a * 10 + b];
    if (m === undefined) return [];
    return a + b === 3 ? [m, m > 0 ? 213 : -213] : [m];
  }
  if (n === 3) {
    const pos = content[0]! > 0;
    for (const x of content) if (x > 0 !== pos) return [];
    const key = content.map((x) => Math.abs(x)).sort((x, y) => x - y).join('');
    const b = BARYON[key];
    if (!b) return [];
    const s = pos ? 1 : -1;
    return b[1] === undefined ? [s * b[0]] : [s * b[0], s * b[1]];
  }
  return [];
}

const lightestCache = new Map<number, number>();
/** Mass of the lightest table hadron with this content (nominal masses), or Infinity if there is none. */
export function lightestMass(content: readonly number[]): number {
  // order-independent key: count of each signed flavour as a base-6 digit (contents have at most five quarks)
  let key = 0;
  for (let i = 0; i < content.length; i++) {
    const x = content[i]!;
    key += Math.pow(6, x > 0 ? x - 1 : 4 - x);
  }
  let v = lightestCache.get(key);
  if (v === undefined) {
    v = Infinity;
    for (const pdg of candidates(content)) v = Math.min(v, particle(pdg).mass);
    lightestCache.set(key, v);
  }
  return v;
}

/** The lightest table hadron with this content (0 if none). */
export function lightestPdg(content: readonly number[]): number {
  let best = 0, bm = Infinity;
  for (const pdg of candidates(content)) {
    const m = particle(pdg).mass;
    if (m < bm) {
      bm = m;
      best = pdg;
    }
  }
  return best;
}

/** Choose the hadron for a content (0 if the table has none). Consumes random numbers for the pseudoscalar/vector and octet/decuplet choices. */
export function hadronFor(content: readonly number[], rng: Rng, par: FlavourParams): number {
  const n = content.length;
  if (n === 2) {
    let a = 0, b = 0;
    for (const x of content) {
      if (x > 0) a = x;
      else b = -x;
    }
    if (a === 0 || b === 0) return 0;
    if (a === b) {
      if (a <= 2) {
        if (rng() < par.vectorFraction) return rng() < 0.5 ? 113 : 223;
        // Pseudoscalar nonet, quark-model mixing with θ_P ≈ −11.5° (approximate): |uū⟩ content of π⁰, η, η′.
        const r = rng();
        return r < 0.5 ? 111 : r < 0.766 ? 221 : 331;
      }
      if (a === 3) {
        if (rng() < par.vectorFraction) return 333;
        return rng() < 0.469 ? 221 : 331;
      }
      return a === 4 ? 443 : 553;
    }
    const m = MESON[a * 10 + b];
    if (m === undefined) return 0;
    if (a + b === 3 && rng() < par.vectorFraction) return m > 0 ? 213 : -213; // ρ± (only ud̄ has a vector partner in the table)
    return m;
  }
  if (n === 3) {
    const pos = content[0]! > 0;
    for (const x of content) if (x > 0 !== pos) return 0;
    const key = content.map((x) => Math.abs(x)).sort((x, y) => x - y).join('');
    const b = BARYON[key];
    if (!b) return 0;
    let pick = b[0];
    if (b[1] !== undefined) {
      if (key === '123') pick = rng() < 0.6 ? b[0] : b[1];
      else pick = rng() < par.decupletFraction ? b[1] : b[0];
    }
    return pos ? pick : -pick;
  }
  return 0;
}

/** Draw a light flavour: u : d : s = 1 : 1 : probStrange. Returns 1 (d), 2 (u) or 3 (s). */
export function pickLight(rng: Rng, par: FlavourParams): number {
  const r = rng() * (2 + par.probStrange);
  return r < 1 ? 2 : r < 2 ? 1 : 3;
}

/** A mass for a hadron: nominal for narrow states, a Breit–Wigner truncated to ±2Γ for resonances (ρ, ω, φ, Δ). */
export function hadronMass(pdg: number, rng: Rng): number {
  const p = particle(pdg);
  return p.width > 1e-3 ? sampleMass(pdg, rng, { nWidths: 2 }) : p.mass;
}
