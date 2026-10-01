/**
 * The quark model's arithmetic: quark content → charge, baryon number, strangeness, isospin; colour neutrality; which table hadrons
 * have a given content; and magnetic moments.
 *
 * Quark content strings follow the particle table: a letter for a quark and the same letter followed by "~" for an antiquark
 * ("uud" is the proton, "ud~" the π⁺). The table also writes π⁰ and η as superpositions ("uu~-dd~"); `parseContent` returns the
 * first term for those.
 */
import { particle, allParticles, type Particle } from '../particles/index.ts';

export type QuarkLetter = 'u' | 'd' | 's' | 'c' | 'b' | 't';
export interface QuarkSpec {
  letter: QuarkLetter;
  pdg: number;
  charge3: number;
  /** 2·I3 */
  i3x2: number;
  strangeness: number;
  charm: number;
  bottom: number;
  top: number;
}

const QUARKS: Record<QuarkLetter, QuarkSpec> = {
  u: { letter: 'u', pdg: 2, charge3: 2, i3x2: 1, strangeness: 0, charm: 0, bottom: 0, top: 0 },
  d: { letter: 'd', pdg: 1, charge3: -1, i3x2: -1, strangeness: 0, charm: 0, bottom: 0, top: 0 },
  s: { letter: 's', pdg: 3, charge3: -1, i3x2: 0, strangeness: -1, charm: 0, bottom: 0, top: 0 },
  c: { letter: 'c', pdg: 4, charge3: 2, i3x2: 0, strangeness: 0, charm: 1, bottom: 0, top: 0 },
  b: { letter: 'b', pdg: 5, charge3: -1, i3x2: 0, strangeness: 0, charm: 0, bottom: -1, top: 0 },
  t: { letter: 't', pdg: 6, charge3: 2, i3x2: 0, strangeness: 0, charm: 0, bottom: 0, top: 1 },
};
export const quarkSpec = (l: QuarkLetter): QuarkSpec => QUARKS[l];
export const QUARK_LETTERS: QuarkLetter[] = ['u', 'd', 's', 'c', 'b', 't'];

export interface Constituent {
  letter: QuarkLetter;
  anti: boolean;
}

/** "uud" → u, u, d; "ud~" → u, d̄. A superposition ("uu~-dd~") yields its first term. */
export function parseContent(s: string): Constituent[] {
  const first = s.split(/[-+]/)[0]!;
  const out: Constituent[] = [];
  for (let i = 0; i < first.length; i++) {
    const ch = first[i]!;
    if (!(ch in QUARKS)) continue;
    const anti = first[i + 1] === '~';
    out.push({ letter: ch as QuarkLetter, anti });
    if (anti) i++;
  }
  return out;
}

export interface Numbers {
  charge3: number;
  baryon3: number;
  strangeness: number;
  charm: number;
  bottom: number;
  top: number;
  i3x2: number;
  /** Hypercharge ×3: Y = B + S + C + B′ + T, times 3. */
  y3: number;
}

/** The additive quantum numbers of a set of quarks and antiquarks. */
export function contentNumbers(list: readonly Constituent[]): Numbers {
  const n: Numbers = { charge3: 0, baryon3: 0, strangeness: 0, charm: 0, bottom: 0, top: 0, i3x2: 0, y3: 0 };
  for (const c of list) {
    const q = QUARKS[c.letter];
    const sgn = c.anti ? -1 : 1;
    n.charge3 += sgn * q.charge3;
    n.baryon3 += sgn;
    n.strangeness += sgn * q.strangeness;
    n.charm += sgn * q.charm;
    n.bottom += sgn * q.bottom;
    n.top += sgn * q.top;
    n.i3x2 += sgn * q.i3x2;
  }
  n.y3 = n.baryon3 + 3 * (n.strangeness + n.charm + n.bottom + n.top);
  return n;
}

/** Flip quarks and antiquarks. */
export const antiContent = (list: readonly Constituent[]): Constituent[] => list.map((c) => ({ ...c, anti: !c.anti }));

/** The key used to compare contents: the sorted multiset, e.g. "d u u" or "d u~". */
export function contentKey(list: readonly Constituent[]): string {
  return list.map((c) => c.letter + (c.anti ? '~' : '')).sort().join(' ');
}

/** Every hadron of the table (and its antiparticle) whose leading quark content is this multiset. */
export function hadronsWithContent(list: readonly Constituent[]): Particle[] {
  const key = contentKey(list);
  const out: Particle[] = [];
  for (const p of allParticles()) {
    if (p.kind !== 'meson' && p.kind !== 'baryon') continue;
    const c = parseContent(p.quarks);
    if (c.length && contentKey(c) === key) out.push(p);
    if (!p.selfConjugate && c.length && contentKey(antiContent(c)) === key) out.push(particle(-p.pdg));
  }
  return out;
}

// ── Colour ───────────────────────────────────────────────────────────────────────────────────────────────────

export type Colour = 'r' | 'g' | 'b';
/** The colour triplet has the same weights as (u, d, s): r = (I3 = ½, Y = ⅓), g = (−½, ⅓), b = (0, −⅔). */
const COLOUR_W: Record<Colour, [number, number]> = { r: [1, 1], g: [-1, 1], b: [0, -2] }; // (2·I3c, 3·Yc)

export interface ColouredQuark extends Constituent {
  colour: Colour;
}

/** The net colour weights of a set of coloured quarks; zero in both components is necessary for a colour singlet. */
export function netColour(list: readonly { colour: Colour; anti: boolean }[]): [number, number] {
  let a = 0, b = 0;
  for (const c of list) {
    const [x, y] = COLOUR_W[c.colour];
    const s = c.anti ? -1 : 1;
    a += s * x;
    b += s * y;
  }
  return [a, b];
}
export const isColourNeutral = (list: readonly { colour: Colour; anti: boolean }[]): boolean => {
  const [a, b] = netColour(list);
  return a === 0 && b === 0;
};

// ── Magnetic moments ─────────────────────────────────────────────────────────────────────────────────────────

/** Measured magnetic moments in nuclear magnetons (PDG 2024): μ_p = 2.7928473, μ_n = −1.9130427, μ_Λ = −0.613 ± 0.004. */
export const MEASURED_MOMENTS = { p: 2.7928473446, n: -1.91304273, Lambda: -0.613, LambdaError: 0.004 } as const;

/**
 * Quark-model magnetic moments of the spin-½ octet (static SU(6) wave functions), given the moments of the quarks.
 * p = (4μu − μd)/3, n = (4μd − μu)/3, Λ = μs, Σ⁺ = (4μu − μs)/3, Σ⁻ = (4μd − μs)/3, Ξ⁰ = (4μs − μu)/3, Ξ⁻ = (4μs − μd)/3.
 */
export function octetMoments(mu: { u: number; d: number; s: number }) {
  return {
    p: (4 * mu.u - mu.d) / 3,
    n: (4 * mu.d - mu.u) / 3,
    Lambda: mu.s,
    'Sigma+': (4 * mu.u - mu.s) / 3,
    'Sigma-': (4 * mu.d - mu.s) / 3,
    'Xi0': (4 * mu.s - mu.u) / 3,
    'Xi-': (4 * mu.s - mu.d) / 3,
  };
}

/**
 * Dirac moments of point quarks in nuclear magnetons, μ_q = Q_q · (m_p / m_q): with every constituent one third of the proton's
 * mass (m_q = m_p/3) that is u: +2, d: −1, s: −1. The model then gives μ_p = 3 and μ_n = −2 exactly.
 */
export function equalMassQuarkMoments(): { u: number; d: number; s: number } {
  return { u: (2 / 3) * 3, d: (-1 / 3) * 3, s: (-1 / 3) * 3 };
}

/** The quark moments that reproduce the measured μ_p and μ_n exactly: μu = (4μp + μn)/5, μd = (4μn + μp)/5. */
export function momentsFitToNucleons(mp = MEASURED_MOMENTS.p, mn = MEASURED_MOMENTS.n): { u: number; d: number } {
  return { u: (4 * mp + mn) / 5, d: (4 * mn + mp) / 5 };
}

/** The constituent mass (in units of the proton mass) that a quark of charge Q and moment μ (nuclear magnetons) implies: m/m_p = Q/μ. */
export const constituentMassRatio = (charge: number, muInNuclearMagnetons: number): number => charge / muInNuclearMagnetons;
