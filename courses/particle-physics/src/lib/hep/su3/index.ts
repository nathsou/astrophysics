/**
 * `hep/su3`: flavour SU(3) as a pattern. Weight diagrams of the irreducible representations, generated from the highest weight;
 * products of representations and their decomposition; the octet and decuplet of baryons placed on the diagrams; the mass
 * relations of Chapter 12; and the quark-model arithmetic of Chapter 13.
 *
 * Conventions. A representation is labelled (p, q) (the Dynkin labels of its highest weight): (1,0) is the quark triplet 3,
 * (0,1) the antitriplet 3̄, (1,1) the octet 8, (3,0) the decuplet 10. A state has isospin third component I3 and hypercharge Y;
 * both are kept as integers (`i3x2` = 2·I3, `y3` = 3·Y) so that equality is exact. Charge Q = I3 + Y/2 (Gell-Mann–Nishijima).
 *
 * Generation. The states of (p, q) are the Gelfand–Tsetlin patterns with top row (p+q, q, 0): integer triples
 * m13 ≥ m23 ≥ m33, then m12, m22 interlacing them, then m11 interlacing those. A pattern stands for one state. Its rows'
 * sums are s1 = m11, s2 = m12 + m22, s3 = m13 + m23 + m33; the state has n_u = s1 "up" boxes, n_d = s2 − s1 and n_s = s3 − s2,
 * so 2 I3 = n_u − n_d and 3Y = n_u + n_d − 2 n_s. The isospin of the multiplet it belongs to is (m12 − m22)/2.
 */
import { particle } from '../particles/index.ts';

import { type Constituent } from './quark.ts';
export * from './quark.ts';

export interface Weight {
  /** 2·I3 */
  i3x2: number;
  /** 3·Y */
  y3: number;
  mult: number;
}

export interface Multiplet {
  /** The isospin multiplet: its hypercharge (×3) and isospin (×2). */
  y3: number;
  i2: number;
  /** Number of states of the isospin multiplet: 2I + 1. */
  dim: number;
}

export interface Irrep {
  p: number;
  q: number;
  dim: number;
  /** Distinct weights with their multiplicities. */
  weights: Weight[];
  /** The SU(2) × U(1) content: one entry per isospin multiplet. */
  multiplets: Multiplet[];
  /** The highest weight, (2·I3, 3·Y). */
  highest: { i3x2: number; y3: number };
  /** "1", "3", "3̄", "6", "8", "10", "10̄", "15", "27", or "(p,q)". */
  name: string;
}

/** The dimension of the representation (p, q): (p+1)(q+1)(p+q+2)/2. */
export const irrepDim = (p: number, q: number): number => ((p + 1) * (q + 1) * (p + q + 2)) / 2;

const NAMES: Record<string, string> = { '0,0': '1', '1,0': '3', '0,1': '3̄', '2,0': '6', '0,2': '6̄', '1,1': '8', '3,0': '10', '0,3': '10̄', '2,1': '15', '1,2': '15′', '2,2': '27', '4,0': '15′', '0,4': '15′̄' };
export const irrepName = (p: number, q: number): string => NAMES[`${p},${q}`] ?? `(${p},${q})`;

const cache = new Map<string, Irrep>();

/** Generate the representation (p, q) by enumerating Gelfand–Tsetlin patterns. */
export function irrep(p: number, q: number): Irrep {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 0 || q < 0) throw new Error('Dynkin labels must be non-negative integers');
  const key = `${p},${q}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m13 = p + q, m23 = q, m33 = 0;
  const wmap = new Map<string, Weight>();
  const mmap = new Map<string, Multiplet>();
  let dim = 0;
  for (let m12 = m23; m12 <= m13; m12++) {
    for (let m22 = m33; m22 <= m23; m22++) {
      const s2 = m12 + m22;
      const i2 = m12 - m22; // 2 × isospin
      const y3 = 3 * s2 - 2 * (m13 + m23 + m33);
      mmap.set(`${y3},${i2}`, { y3, i2, dim: i2 + 1 });
      for (let m11 = m22; m11 <= m12; m11++) {
        dim++;
        const nu = m11;
        const nd = s2 - m11;
        const i3x2 = nu - nd;
        const k = `${i3x2},${y3}`;
        const w = wmap.get(k);
        if (w) w.mult++;
        else wmap.set(k, { i3x2, y3, mult: 1 });
      }
    }
  }
  const out: Irrep = {
    p,
    q,
    dim,
    weights: [...wmap.values()].sort((a, b) => b.y3 - a.y3 || a.i3x2 - b.i3x2),
    multiplets: [...mmap.values()].sort((a, b) => b.y3 - a.y3 || a.i2 - b.i2),
    highest: { i3x2: p, y3: p + 2 * q },
    name: irrepName(p, q),
  };
  if (out.dim !== irrepDim(p, q)) throw new Error('internal error: dimension mismatch');
  cache.set(key, out);
  return out;
}

/** The conjugate representation (q, p): the same diagram reflected through the origin. */
export const conjugate = (r: Irrep): Irrep => irrep(r.q, r.p);

/** Electric charge ×6 of a weight: 6Q = 3·(2 I3) + 3Y. Divisible by 2 for triality-zero states; Q = i3x2/2 + y3/6. */
export const chargeOf = (w: { i3x2: number; y3: number }): number => w.i3x2 / 2 + w.y3 / 6;
/** Strangeness from the hypercharge for baryons and mesons: Y = B + S. */
export const strangenessOf = (w: { y3: number }, baryonNumber: number): number => w.y3 / 3 - baryonNumber;

// ── Products and decomposition ────────────────────────────────────────────────────────────────────────────────

/** The weights of a tensor product: every sum of a weight of a and a weight of b. */
export function productWeights(a: readonly Weight[], b: readonly Weight[]): Weight[] {
  const m = new Map<string, Weight>();
  for (const x of a)
    for (const y of b) {
      const i3x2 = x.i3x2 + y.i3x2;
      const y3 = x.y3 + y.y3;
      const k = `${i3x2},${y3}`;
      const w = m.get(k);
      if (w) w.mult += x.mult * y.mult;
      else m.set(k, { i3x2, y3, mult: x.mult * y.mult });
    }
  return [...m.values()];
}

/** The order in which highest weights are found: a linear functional positive on both simple roots. */
const height = (w: { i3x2: number; y3: number }) => 3 * w.i3x2 + 2 * w.y3;

/**
 * Split a set of weights (the weights of a product) into irreducible representations, by repeatedly taking the highest weight,
 * which must be the highest weight of one irrep, and removing that irrep's weights. Returns [{ p, q, count }] ordered from
 * the largest representation down.
 */
export function decompose(weights: readonly Weight[]): { p: number; q: number; count: number; name: string }[] {
  const left = new Map<string, Weight>();
  for (const w of weights) left.set(`${w.i3x2},${w.y3}`, { ...w });
  const out: { p: number; q: number; count: number; name: string }[] = [];
  for (let guard = 0; guard < 200; guard++) {
    let top: Weight | null = null;
    for (const w of left.values()) if (w.mult > 0 && (top === null || height(w) > height(top))) top = w;
    if (!top) break;
    const p = top.i3x2;
    const q2 = top.y3 - p;
    if (p < 0 || q2 < 0 || q2 % 2 !== 0) throw new Error('not a sum of SU(3) representations');
    const q = q2 / 2;
    const r = irrep(p, q);
    const count = top.mult;
    for (const w of r.weights) {
      const k = `${w.i3x2},${w.y3}`;
      const cur = left.get(k);
      if (!cur || cur.mult < w.mult * count) throw new Error('not a sum of SU(3) representations');
      cur.mult -= w.mult * count;
    }
    out.push({ p, q, count, name: r.name });
  }
  return out;
}

/** Decompose the product of representations, for example `decomposeProduct([[1,0],[0,1]])` = 8 ⊕ 1. */
export function decomposeProduct(factors: readonly (readonly [number, number])[]): { p: number; q: number; count: number; name: string }[] {
  let w: Weight[] = [{ i3x2: 0, y3: 0, mult: 1 }];
  for (const [p, q] of factors) w = productWeights(w, irrep(p, q).weights);
  return decompose(w);
}

/** "8 ⊕ 1" or "10 ⊕ 8 ⊕ 8 ⊕ 1" */
export function formatDecomposition(parts: readonly { name: string; count: number }[]): string {
  return parts.flatMap((d) => Array.from({ length: d.count }, () => d.name)).join(' ⊕ ');
}

// ── The baryon octet and decuplet placed on the diagrams ─────────────────────────────────────────────────────

export interface Slot {
  i3x2: number;
  y3: number;
  /** The particle of the table sitting at this weight (first of them when the weight is degenerate), or null when none is known. */
  pdg: number | null;
  /** All the table particles at this weight (the octet centre holds Σ⁰ and Λ). */
  all: number[];
  name: string;
  symbol: string;
  /** Strangeness and charge of the state. */
  strangeness: number;
  charge: number;
}

/**
 * The baryon octet (1,1) and decuplet (3,0) of spin ½ and spin 3/2. Each weight is matched to table entries by strangeness and
 * isospin: a baryon of the table has `i3x2` and `strangeness`, and Y = 1 + S.
 */
export function baryonMultiplet(kind: 'octet' | 'decuplet'): Slot[] {
  const r = kind === 'octet' ? irrep(1, 1) : irrep(3, 0);
  const spin2 = kind === 'octet' ? 1 : 3;
  const table = BARYONS.filter((b) => b.spin2 === spin2);
  return r.weights.map((w) => {
    const S = w.y3 / 3 - 1;
    const all = table.filter((b) => b.i3x2 === w.i3x2 && b.strangeness === S).map((b) => b.pdg);
    const first = all[0] ?? null;
    return {
      i3x2: w.i3x2,
      y3: w.y3,
      pdg: first,
      all,
      name: first !== null ? particle(first).name : '?',
      symbol: first !== null ? particle(first).symbol : '?',
      strangeness: S,
      charge: chargeOf(w),
    };
  });
}

interface BaryonRow { pdg: number; spin2: number; i3x2: number; strangeness: number }
/**
 * Spin-½ octet members of the table, and the spin-3/2 decuplet members the table has (Δ and Ω⁻). The Σ*(1385) and Ξ*(1530)
 * are not in `hep/particles`; their masses are in `DECUPLET_MASSES` below.
 */
const BARYONS: BaryonRow[] = [
  { pdg: 2212, spin2: 1, i3x2: 1, strangeness: 0 },
  { pdg: 2112, spin2: 1, i3x2: -1, strangeness: 0 },
  { pdg: 3222, spin2: 1, i3x2: 2, strangeness: -1 },
  { pdg: 3212, spin2: 1, i3x2: 0, strangeness: -1 },
  { pdg: 3122, spin2: 1, i3x2: 0, strangeness: -1 },
  { pdg: 3112, spin2: 1, i3x2: -2, strangeness: -1 },
  { pdg: 3322, spin2: 1, i3x2: 1, strangeness: -2 },
  { pdg: 3312, spin2: 1, i3x2: -1, strangeness: -2 },
  { pdg: 2224, spin2: 3, i3x2: 3, strangeness: 0 },
  { pdg: 2214, spin2: 3, i3x2: 1, strangeness: 0 },
  { pdg: 2114, spin2: 3, i3x2: -1, strangeness: 0 },
  { pdg: 1114, spin2: 3, i3x2: -3, strangeness: 0 },
  { pdg: 3334, spin2: 3, i3x2: 0, strangeness: -3 },
];

// ── Masses: equal spacing and Gell-Mann–Okubo ─────────────────────────────────────────────────────────────────

/**
 * Masses (GeV) of the decuplet by strangeness. Δ and Ω⁻ come from `hep/particles`. The Σ*(1385) and Ξ*(1530) are not in the table; the values are
 * those of the neutral members in the PDG listing, rounded (Σ(1385)⁰ 1.3837, Ξ(1530)⁰ 1.5318 GeV; the charged members differ by a few MeV), typed from
 * memory of the listing and to be checked against it.
 * The historical prediction used only the first three.
 */
export const DECUPLET_MASSES = {
  0: { name: 'Δ', mass: particle(2224).mass },
  [-1]: { name: 'Σ*', mass: 1.3837 },
  [-2]: { name: 'Ξ*', mass: 1.5318 },
  [-3]: { name: 'Ω⁻', mass: particle(3334).mass },
} as const;

/**
 * Equal spacing in the decuplet: M(S) = M₀ + S·Δ with the mass falling by the same step for each unit of strangeness. Returns the
 * step and the predicted Ω⁻ mass from the last two known levels (the Gell-Mann 1962 argument), and from a straight-line fit through
 * the three.
 */
export function decupletSpacing(masses: { delta: number; sigmaStar: number; xiStar: number } = { delta: DECUPLET_MASSES[0].mass, sigmaStar: DECUPLET_MASSES[-1].mass, xiStar: DECUPLET_MASSES[-2].mass }) {
  const step1 = masses.sigmaStar - masses.delta;
  const step2 = masses.xiStar - masses.sigmaStar;
  const lastStep = step2;
  const fromLast = masses.xiStar + lastStep;
  // least squares through (S = 0, −1, −2): slope = (M(−2) − M(0))/(−2) sign aside
  const slope = (masses.xiStar - masses.delta) / 2;
  const fit = masses.xiStar + slope;
  return { step1, step2, meanStep: slope, omegaFromLastSpacing: fromLast, omegaFromMeanSpacing: fit };
}

/**
 * The Gell-Mann–Okubo relation for the spin-½ baryon octet: 2(m_N + m_Ξ) = 3 m_Λ + m_Σ. Returns both sides (GeV), with the
 * isospin averages taken from the table (N = p, n; Σ = Σ⁺, Σ⁰, Σ⁻; Ξ = Ξ⁰, Ξ⁻).
 */
export function gellMannOkuboBaryons() {
  const avg = (ids: number[]) => ids.reduce((s, id) => s + particle(id).mass, 0) / ids.length;
  const N = avg([2212, 2112]);
  const Sigma = avg([3222, 3212, 3112]);
  const Xi = avg([3322, 3312]);
  const Lambda = particle(3122).mass;
  const lhs = 2 * (N + Xi);
  const rhs = 3 * Lambda + Sigma;
  return { N, Lambda, Sigma, Xi, lhs, rhs, relativeDifference: (rhs - lhs) / lhs };
}

/** The same relation for the pseudoscalar meson octet, in squares of masses: 4 m_K² = 3 m_η² + m_π². */
export function gellMannOkuboMesons() {
  const mK = (particle(321).mass + particle(311).mass) / 2;
  const mPi = (particle(211).mass * 2 + particle(111).mass) / 3;
  const mEta = particle(221).mass;
  const lhs = 4 * mK * mK;
  const rhs = 3 * mEta * mEta + mPi * mPi;
  return { mK, mPi, mEta, lhs, rhs, relativeDifference: (rhs - lhs) / lhs };
}

/**
 * The Ω⁻ cannot decay by the strong force: every state with the same baryon number and strangeness −2 or less that the strong force
 * could produce together with a kaon is heavier than the Ω⁻. Returns the threshold masses of Ξ K for the two charge states, GeV.
 */
export function omegaStrongDecayThreshold() {
  const xiK = Math.min(particle(3322).mass + particle(321).mass, particle(3312).mass + particle(311).mass);
  return { threshold: xiK, omega: particle(3334).mass, open: particle(3334).mass > xiK };
}

// ── Isospin arithmetic ────────────────────────────────────────────────────────────────────────────────────────

/** The Gell-Mann–Nishijima relation Q = I3 + Y/2 with Y = B + S (+ C + B′ for heavy flavours), checked against the table. */
export function gellMannNishijima(pdg: number): { q: number; fromNumbers: number } {
  const p = particle(pdg);
  const y = p.baryon3 / 3 + p.strangeness + p.charm + p.bottom + p.top;
  return { q: p.charge3 / 3, fromNumbers: p.i3x2 / 2 + y / 2 };
}

/**
 * Clebsch–Gordan weights for π N at total isospin 3/2 and 1/2, for the charge states of the Δ resonance (Chapter 12): the fraction
 * of the I = 3/2 amplitude in each charge channel. π⁺p is pure I = 3/2; π⁻p is 1/3 of I = 3/2 and 2/3 of I = 1/2.
 */
export function pionNucleonIsospinFractions() {
  return {
    'pi+ p': { i32: 1, i12: 0 },
    'pi- p': { i32: 1 / 3, i12: 2 / 3 },
    'pi0 p': { i32: 2 / 3, i12: 1 / 3 },
  } as const;
}

/**
 * The largest elastic cross-section a single partial wave of total angular momentum J can give in the scattering of spin-s₁ on spin-s₂
 * particles with centre-of-mass momentum k: σ = (4π/k²)(2J+1)/((2s₁+1)(2s₂+1)). Natural units (GeV⁻²); multiply by
 * 0.3894 for millibarn.
 */
export function unitarityLimit(k: number, twoJ: number, twoS1: number, twoS2: number): number {
  return ((4 * Math.PI) / (k * k)) * ((twoJ + 1) / ((twoS1 + 1) * (twoS2 + 1)));
}
export const GEV2_TO_MB = 0.389379372;

/**
 * Do these quarks and antiquarks, with colour left free, contain a colour singlet? Found by decomposing the product of colour
 * triplets and antitriplets: 3 ⊗ 3̄ ∋ 1 and 3 ⊗ 3 ⊗ 3 ∋ 1, but 3 ⊗ 3 and 3 ⊗ 3 ⊗ 3̄ do not.
 */
export function hasColourSinglet(list: readonly Constituent[]): boolean {
  if (!list.length) return false;
  const parts = decomposeProduct(list.map((c) => (c.anti ? ([0, 1] as const) : ([1, 0] as const))));
  return parts.some((d) => d.p === 0 && d.q === 0);
}

/** The flavour multiplets that can contain a state with this weight, for baryons made of three quarks of u, d, s (3 ⊗ 3 ⊗ 3) or mesons (3 ⊗ 3̄). */
export function flavourMultiplets(list: readonly Constituent[]): string[] {
  const light = list.every((c) => ['u', 'd', 's'].includes(c.letter));
  if (!light) return [];
  const parts = decomposeProduct(list.map((c) => (c.anti ? ([0, 1] as const) : ([1, 0] as const))));
  const n = contentWeight(list);
  const found: string[] = [];
  for (const d of parts) {
    const r = irrep(d.p, d.q);
    if (r.weights.some((w) => w.i3x2 === n.i3x2 && w.y3 === n.y3)) for (let k = 0; k < d.count; k++) found.push(r.name);
  }
  return found;
}

/** The (2·I3, 3·Y) of a light-quark content, from the triplet weights u (1, 1), d (−1, 1), s (0, −2). */
export function contentWeight(list: readonly Constituent[]): { i3x2: number; y3: number } {
  let i3x2 = 0, y3 = 0;
  for (const c of list) {
    const [a, b] = c.letter === 'u' ? [1, 1] : c.letter === 'd' ? [-1, 1] : c.letter === 's' ? [0, -2] : [0, 0];
    const s = c.anti ? -1 : 1;
    i3x2 += s * a;
    y3 += s * b;
  }
  return { i3x2, y3 };
}
