/**
 * The particle table: masses, widths, lifetimes, quantum numbers and the main decay modes of the
 * particles the course uses. Values are rounded from the PDG Review of Particle Physics (2024 edition).
 *
 * Conventions: masses and widths in GeV, lifetimes in seconds. Charge is stored as 3×Q and baryon number as
 * 3×B so that everything is an integer; spin as 2×J. Antiparticles are derived from the table on demand:
 * `particle(211)` is the π⁺ and `particle(-211)` the π⁻.
 */

export type ParticleKind = 'lepton' | 'quark' | 'boson' | 'meson' | 'baryon';

export interface Decay {
  /** Branching fraction (0–1). The fractions of one particle sum to 1 (within rounding). */
  br: number;
  /** PDG IDs of the decay products. */
  products: number[];
}

export interface Particle {
  pdg: number;
  /** ASCII name, e.g. "mu-", "pi0", "Z". */
  name: string;
  /** Typeset symbol, e.g. "μ⁻", "π⁰", "Z". */
  symbol: string;
  kind: ParticleKind;
  /** Mass in GeV. */
  mass: number;
  /** Full width in GeV (0 for particles that are stable on the scale of the course, or whose lifetime is given instead). */
  width: number;
  /** Mean proper lifetime in seconds; Infinity for stable particles. */
  lifetime: number;
  /** 3 × electric charge. */
  charge3: number;
  /** 2 × spin. */
  spin2: number;
  /** 3 × baryon number. */
  baryon3: number;
  /** Lepton numbers [L_e, L_μ, L_τ]. */
  lepton: [number, number, number];
  strangeness: number;
  charm: number;
  bottom: number;
  top: number;
  /** 2 × the third component of isospin (for hadrons and light quarks), else 0. */
  i3x2: number;
  /** Quark content, e.g. "uud" (bars written with a leading "~", e.g. "u~d"); empty for non-hadrons. */
  quarks: string;
  /** Is the particle its own antiparticle? */
  selfConjugate: boolean;
  decays: Decay[];
  /** Is it detected directly (leaves a signal in a detector before it decays)? */
  stable: boolean;
}

const INF = Infinity;
type Spec = Partial<Omit<Particle, 'pdg' | 'name' | 'symbol' | 'kind' | 'mass' | 'decays'>> & { decays?: [number, number[]][] };

const table = new Map<number, Particle>();

function def(pdg: number, name: string, symbol: string, kind: ParticleKind, mass: number, s: Spec = {}): void {
  const particle: Particle = {
    pdg,
    name,
    symbol,
    kind,
    mass,
    width: s.width ?? 0,
    lifetime: s.lifetime ?? (s.width ? 6.582119569e-25 / s.width : INF),
    charge3: s.charge3 ?? 0,
    spin2: s.spin2 ?? 0,
    baryon3: s.baryon3 ?? 0,
    lepton: s.lepton ?? [0, 0, 0],
    strangeness: s.strangeness ?? 0,
    charm: s.charm ?? 0,
    bottom: s.bottom ?? 0,
    top: s.top ?? 0,
    i3x2: s.i3x2 ?? 0,
    quarks: s.quarks ?? '',
    selfConjugate: s.selfConjugate ?? false,
    decays: (s.decays ?? []).map(([br, products]) => ({ br, products })),
    stable: false,
  };
  particle.stable = particle.lifetime === INF || particle.lifetime > 1e-10;
  table.set(pdg, particle);
}

// ── Leptons ──
def(11, 'e-', 'e⁻', 'lepton', 0.51099895e-3, { charge3: -3, spin2: 1, lepton: [1, 0, 0] });
def(13, 'mu-', 'μ⁻', 'lepton', 0.1056583755, { charge3: -3, spin2: 1, lepton: [0, 1, 0], lifetime: 2.1969811e-6, decays: [[1, [11, -12, 14]]] });
def(15, 'tau-', 'τ⁻', 'lepton', 1.77693, {
  charge3: -3, spin2: 1, lepton: [0, 0, 1], lifetime: 2.903e-13,
  // Representative modes; the remaining hadronic modes are lumped into the last entry.
  decays: [[0.1782, [11, -12, 16]], [0.1739, [13, -14, 16]], [0.1082, [-211, 16]], [0.2549, [-211, 111, 16]], [0.0926, [-211, 111, 111, 16]], [0.0899, [-211, -211, 211, 16]], [0.1023, [-211, -211, 211, 111, 16]]],
});
def(12, 'nu_e', 'ν_e', 'lepton', 0, { spin2: 1, lepton: [1, 0, 0] });
def(14, 'nu_mu', 'ν_μ', 'lepton', 0, { spin2: 1, lepton: [0, 1, 0] });
def(16, 'nu_tau', 'ν_τ', 'lepton', 0, { spin2: 1, lepton: [0, 0, 1] });

// ── Quarks (current masses; top is the pole mass) ──
def(1, 'd', 'd', 'quark', 0.00467, { charge3: -1, spin2: 1, baryon3: 1, i3x2: -1 });
def(2, 'u', 'u', 'quark', 0.00216, { charge3: 2, spin2: 1, baryon3: 1, i3x2: 1 });
def(3, 's', 's', 'quark', 0.0934, { charge3: -1, spin2: 1, baryon3: 1, strangeness: -1 });
def(4, 'c', 'c', 'quark', 1.27, { charge3: 2, spin2: 1, baryon3: 1, charm: 1 });
def(5, 'b', 'b', 'quark', 4.18, { charge3: -1, spin2: 1, baryon3: 1, bottom: -1 });
def(6, 't', 't', 'quark', 172.57, { charge3: 2, spin2: 1, baryon3: 1, top: 1, width: 1.42, decays: [[1, [24, 5]]] });

// ── Gauge and Higgs bosons ──
def(21, 'g', 'g', 'boson', 0, { spin2: 2, selfConjugate: true });
def(22, 'gamma', 'γ', 'boson', 0, { spin2: 2, selfConjugate: true });
def(23, 'Z', 'Z', 'boson', 91.1880, {
  spin2: 2, width: 2.4955, selfConjugate: true,
  decays: [
    [0.03363, [11, -11]], [0.03366, [13, -13]], [0.03370, [15, -15]],
    [0.0667, [12, -12]], [0.0667, [14, -14]], [0.0667, [16, -16]],
    [0.1160, [2, -2]], [0.1160, [4, -4]], [0.1560, [1, -1]], [0.1560, [3, -3]], [0.1512, [5, -5]],
  ],
});
def(24, 'W+', 'W⁺', 'boson', 80.3692, {
  charge3: 3, spin2: 2, width: 2.085,
  decays: [[0.1071, [-11, 12]], [0.1063, [-13, 14]], [0.1138, [-15, 16]], [0.3370, [2, -1]], [0.3370, [4, -3]]],
});
def(25, 'H', 'H', 'boson', 125.20, {
  spin2: 0, width: 0.0041, selfConjugate: true,
  decays: [[0.582, [5, -5]], [0.214, [24, -24]], [0.0819, [21, 21]], [0.0627, [15, -15]], [0.0289, [4, -4]], [0.0262, [23, 23]], [0.00227, [22, 22]], [0.00153, [23, 22]], [0.00022, [13, -13]]],
});

// ── Light mesons ──
def(211, 'pi+', 'π⁺', 'meson', 0.13957039, { charge3: 3, i3x2: 2, quarks: 'ud~', lifetime: 2.6033e-8, decays: [[0.99988, [-13, 14]], [0.00012, [-11, 12]]] });
def(111, 'pi0', 'π⁰', 'meson', 0.1349768, { i3x2: 0, quarks: 'uu~-dd~', lifetime: 8.43e-17, selfConjugate: true, decays: [[0.98823, [22, 22]], [0.01174, [22, 11, -11]], [0.00003, [11, -11, 11, -11]]] });
def(321, 'K+', 'K⁺', 'meson', 0.493677, { charge3: 3, spin2: 0, strangeness: 1, i3x2: 1, quarks: 'us~', lifetime: 1.238e-8, decays: [[0.6356, [-13, 14]], [0.2067, [211, 111]], [0.0558, [211, 211, -211]], [0.0507, [111, -11, 12]], [0.0335, [111, -13, 14]], [0.0176, [211, 111, 111]]] });
def(311, 'K0', 'K⁰', 'meson', 0.497611, { strangeness: 1, i3x2: -1, quarks: 'ds~', decays: [[0.5, [310]], [0.5, [130]]], lifetime: 1e-20 });
def(310, 'K_S', 'K_S⁰', 'meson', 0.497611, { selfConjugate: true, lifetime: 8.954e-11, decays: [[0.692, [211, -211]], [0.3069, [111, 111]]] });
def(130, 'K_L', 'K_L⁰', 'meson', 0.497611, { selfConjugate: true, lifetime: 5.116e-8, decays: [[0.4055, [-211, -11, 12]], [0.2704, [-211, -13, 14]], [0.1952, [111, 111, 111]], [0.1254, [211, -211, 111]]] });
def(221, 'eta', 'η', 'meson', 0.547862, { width: 1.31e-6, selfConjugate: true, quarks: 'uu~+dd~-ss~', decays: [[0.3936, [22, 22]], [0.3257, [111, 111, 111]], [0.2292, [211, -211, 111]], [0.0422, [211, -211, 22]]] });
def(331, 'eta_prime', 'η′', 'meson', 0.95778, { width: 1.88e-4, selfConjugate: true, decays: [[0.426, [211, -211, 221]], [0.289, [113, 22]], [0.228, [111, 111, 221]], [0.0262, [223, 22]], [0.031, [22, 22]]] });
def(113, 'rho0', 'ρ⁰', 'meson', 0.77526, { spin2: 2, width: 0.1474, selfConjugate: true, quarks: 'uu~-dd~', decays: [[0.99955, [211, -211]], [0.00045, [11, -11]]] });
def(213, 'rho+', 'ρ⁺', 'meson', 0.77511, { charge3: 3, spin2: 2, width: 0.1491, i3x2: 2, quarks: 'ud~', decays: [[1, [211, 111]]] });
def(223, 'omega', 'ω', 'meson', 0.78266, { spin2: 2, width: 8.68e-3, selfConjugate: true, quarks: 'uu~+dd~', decays: [[0.893, [211, -211, 111]], [0.0834, [111, 22]], [0.0153, [211, -211]], [0.00007, [11, -11]]] });
def(333, 'phi', 'φ', 'meson', 1.019461, { spin2: 2, width: 4.249e-3, selfConjugate: true, quarks: 'ss~', decays: [[0.491, [321, -321]], [0.34, [130, 310]], [0.154, [211, -211, 111]], [0.0129, [221, 22]]] });

// ── Charm and bottom mesons, quarkonia ──
def(421, 'D0', 'D⁰', 'meson', 1.86484, { charm: 1, quarks: 'cu~', lifetime: 4.103e-13, decays: [[0.0395, [-321, 211]], [0.0801, [-321, 211, 111]], [0.0823, [-321, 211, 211, -211]], [0.0343, [-321, -11, 12]], [0.0327, [-321, -13, 14]], [0.7, [310, 211, -211]]] });
def(411, 'D+', 'D⁺', 'meson', 1.86966, { charge3: 3, charm: 1, quarks: 'cd~', lifetime: 1.033e-12, decays: [[0.094, [-321, 211, 211]], [0.0876, [310, 211]], [0.072, [-311, -11, 12]], [0.73, [310, 211, 111]]] });
def(511, 'B0', 'B⁰', 'meson', 5.27966, { bottom: 1, quarks: 'db~', lifetime: 1.517e-12, decays: [[0.0004, [443, 310]], [0.0025, [-411, 211]], [0.0219, [-411, -11, 12]], [0.0219, [-411, -13, 14]], [0.9533, [-421, 211, -211]]] });
def(521, 'B+', 'B⁺', 'meson', 5.27934, { charge3: 3, bottom: 1, quarks: 'ub~', lifetime: 1.638e-12, decays: [[0.001, [443, 321]], [0.0046, [-421, 211]], [0.0226, [-421, -11, 12]], [0.0226, [-421, -13, 14]], [0.9492, [-421, 211, 111]]] });
def(531, 'B_s0', 'B_s⁰', 'meson', 5.36692, { bottom: 1, strangeness: -1, quarks: 'sb~', lifetime: 1.520e-12, decays: [[0.0004, [443, 333]], [0.0036, [-431, 211]], [0.0207, [-431, -11, 12]], [0.0207, [-431, -13, 14]], [0.955, [-431, 211, 211, -211]]] });
def(431, 'D_s+', 'D_s⁺', 'meson', 1.96835, { charge3: 3, charm: 1, strangeness: 1, quarks: 'cs~', lifetime: 5.04e-13, decays: [[0.0545, [333, 211]], [0.945, [321, -321, 211]]] });
def(443, 'J/psi', 'J/ψ', 'meson', 3.096900, { spin2: 2, width: 9.26e-5, selfConjugate: true, quarks: 'cc~', decays: [[0.0597, [11, -11]], [0.0596, [13, -13]], [0.877, [211, -211, 111]], [0.0037, [22, 221]]] });
def(100443, 'psi(2S)', 'ψ(2S)', 'meson', 3.686097, { spin2: 2, width: 2.94e-4, selfConjugate: true, quarks: 'cc~', decays: [[0.00793, [11, -11]], [0.008, [13, -13]], [0.349, [443, 211, -211]], [0.1, [443, 111, 111]], [0.535, [211, -211, 111]]] });
def(553, 'Upsilon(1S)', 'Υ(1S)', 'meson', 9.4603, { spin2: 2, width: 5.402e-5, selfConjugate: true, quarks: 'bb~', decays: [[0.0238, [11, -11]], [0.0248, [13, -13]], [0.0260, [15, -15]], [0.9254, [21, 21, 21]]] });
def(100553, 'Upsilon(2S)', 'Υ(2S)', 'meson', 10.02326, { spin2: 2, width: 3.198e-5, selfConjugate: true, quarks: 'bb~', decays: [[0.0191, [11, -11]], [0.0193, [13, -13]], [0.0200, [15, -15]], [0.4, [553, 211, -211]], [0.5416, [21, 21, 21]]] });
def(200553, 'Upsilon(3S)', 'Υ(3S)', 'meson', 10.3552, { spin2: 2, width: 2.032e-5, selfConjugate: true, quarks: 'bb~', decays: [[0.0218, [11, -11]], [0.0218, [13, -13]], [0.0229, [15, -15]], [0.3, [100553, 211, -211]], [0.6335, [21, 21, 21]]] });

// ── Baryons ──
def(2212, 'p', 'p', 'baryon', 0.93827208816, { charge3: 3, spin2: 1, baryon3: 3, i3x2: 1, quarks: 'uud' });
def(2112, 'n', 'n', 'baryon', 0.9395654205, { spin2: 1, baryon3: 3, i3x2: -1, quarks: 'udd', lifetime: 878.4, decays: [[1, [2212, 11, -12]]] });
def(3122, 'Lambda', 'Λ', 'baryon', 1.115683, { spin2: 1, baryon3: 3, strangeness: -1, quarks: 'uds', lifetime: 2.632e-10, decays: [[0.639, [2212, -211]], [0.358, [2112, 111]], [0.003, [2212, 11, -12]]] });
def(3222, 'Sigma+', 'Σ⁺', 'baryon', 1.18937, { charge3: 3, spin2: 1, baryon3: 3, strangeness: -1, i3x2: 2, quarks: 'uus', lifetime: 8.018e-11, decays: [[0.5157, [2212, 111]], [0.4831, [2112, 211]], [0.0012, [2212, 22]]] });
def(3212, 'Sigma0', 'Σ⁰', 'baryon', 1.192642, { spin2: 1, baryon3: 3, strangeness: -1, i3x2: 0, quarks: 'uds', lifetime: 7.4e-20, decays: [[1, [3122, 22]]] });
def(3112, 'Sigma-', 'Σ⁻', 'baryon', 1.197449, { charge3: -3, spin2: 1, baryon3: 3, strangeness: -1, i3x2: -2, quarks: 'dds', lifetime: 1.479e-10, decays: [[0.9985, [2112, -211]], [0.0015, [2112, 11, -12]]] });
def(3322, 'Xi0', 'Ξ⁰', 'baryon', 1.31486, { spin2: 1, baryon3: 3, strangeness: -2, i3x2: 1, quarks: 'uss', lifetime: 2.90e-10, decays: [[0.995, [3122, 111]], [0.005, [3122, 22]]] });
def(3312, 'Xi-', 'Ξ⁻', 'baryon', 1.32171, { charge3: -3, spin2: 1, baryon3: 3, strangeness: -2, i3x2: -1, quarks: 'dss', lifetime: 1.639e-10, decays: [[0.99887, [3122, -211]], [0.00113, [3122, 11, -12]]] });
def(3334, 'Omega-', 'Ω⁻', 'baryon', 1.67245, { charge3: -3, spin2: 3, baryon3: 3, strangeness: -3, i3x2: 0, quarks: 'sss', lifetime: 8.21e-11, decays: [[0.678, [3122, -321]], [0.236, [3322, -211]], [0.086, [3312, 111]]] });
def(2224, 'Delta++', 'Δ⁺⁺', 'baryon', 1.232, { charge3: 6, spin2: 3, baryon3: 3, i3x2: 3, quarks: 'uuu', width: 0.117, decays: [[1, [2212, 211]]] });
def(2214, 'Delta+', 'Δ⁺', 'baryon', 1.232, { charge3: 3, spin2: 3, baryon3: 3, i3x2: 1, quarks: 'uud', width: 0.117, decays: [[0.667, [2212, 111]], [0.333, [2112, 211]]] });
def(2114, 'Delta0', 'Δ⁰', 'baryon', 1.232, { spin2: 3, baryon3: 3, i3x2: -1, quarks: 'udd', width: 0.117, decays: [[0.667, [2112, 111]], [0.333, [2212, -211]]] });
def(1114, 'Delta-', 'Δ⁻', 'baryon', 1.232, { charge3: -3, spin2: 3, baryon3: 3, i3x2: -3, quarks: 'ddd', width: 0.117, decays: [[1, [2112, -211]]] });
def(4122, 'Lambda_c+', 'Λ_c⁺', 'baryon', 2.28646, { charge3: 3, spin2: 1, baryon3: 3, charm: 1, quarks: 'udc', lifetime: 2.029e-13, decays: [[0.0628, [2212, -321, 211]], [0.0159, [2212, 310]], [0.013, [3122, 211]], [0.9083, [2212, -321, 211, 111]]] });
def(5122, 'Lambda_b', 'Λ_b⁰', 'baryon', 5.61960, { spin2: 1, baryon3: 3, bottom: 1, quarks: 'udb', lifetime: 1.471e-12, decays: [[0.6, [4122, -211]], [0.4, [4122, 13, -14]]] });

// ── Helpers ──
/** The antiparticle of a table entry (derived by flipping every additive quantum number). */
function anti(p: Particle): Particle {
  const flip = (x: number) => (x === 0 ? 0 : -x);
  return {
    ...p,
    pdg: -p.pdg,
    name: flipName(p.name),
    symbol: flipSymbol(p.symbol),
    charge3: flip(p.charge3),
    baryon3: flip(p.baryon3),
    lepton: [flip(p.lepton[0]), flip(p.lepton[1]), flip(p.lepton[2])],
    strangeness: flip(p.strangeness),
    charm: flip(p.charm),
    bottom: flip(p.bottom),
    top: flip(p.top),
    i3x2: flip(p.i3x2),
    quarks: p.quarks.replace(/(~?)([udscbt])/g, (_, bar: string, q: string) => (bar ? q : `~${q}`)),
    decays: p.decays.map((d) => ({ br: d.br, products: d.products.map((id) => (table.get(id)?.selfConjugate ? id : -id)) })),
  };
}
function flipName(n: string): string {
  if (n.endsWith('++')) return n.slice(0, -2) + '--';
  if (n.endsWith('--')) return n.slice(0, -2) + '++';
  if (n.endsWith('+')) return n.slice(0, -1) + '-';
  if (n.endsWith('-')) return n.slice(0, -1) + '+';
  return `anti-${n}`;
}
function flipSymbol(s: string): string {
  if (s.endsWith('⁺⁺')) return s.slice(0, -2) + '⁻⁻';
  if (s.endsWith('⁺')) return s.slice(0, -1) + '⁻';
  if (s.endsWith('⁻')) return s.slice(0, -1) + '⁺';
  return s + '̄';
}

const antiCache = new Map<number, Particle>();
/** Look up a particle by PDG ID. Negative IDs give antiparticles. Throws for unknown IDs. */
export function particle(pdg: number): Particle {
  const p = table.get(pdg);
  if (p) return p;
  if (pdg < 0) {
    const a = antiCache.get(pdg);
    if (a) return a;
    const base = table.get(-pdg);
    if (base && !base.selfConjugate) {
      const made = anti(base);
      antiCache.set(pdg, made);
      return made;
    }
  }
  throw new Error(`unknown particle: PDG ID ${pdg}`);
}
/** Whether the ID is in the table. */
export function hasParticle(pdg: number): boolean {
  return table.has(pdg) || (pdg < 0 && table.has(-pdg) && !table.get(-pdg)!.selfConjugate);
}
/** The antiparticle's PDG ID (the same ID for self-conjugate particles). */
export function antiId(pdg: number): number {
  return particle(pdg).selfConjugate ? pdg : -pdg;
}
/** Every particle in the table (particles only; use `particle(-id)` for the antiparticle). */
export function allParticles(): Particle[] {
  return [...table.values()];
}
/** Find a particle by its ASCII name ("mu-", "Z", "pi0", "anti-p" …). */
export function byName(name: string): Particle | undefined {
  for (const p of table.values()) if (p.name === name) return p;
  for (const p of table.values()) if (!p.selfConjugate && anti(p).name === name) return particle(-p.pdg);
  return undefined;
}

/** Electric charge in units of e. */
export const charge = (pdg: number): number => particle(pdg).charge3 / 3;
/** Whether the particle carries colour (quarks, gluons and their antiparticles). */
export const isColoured = (pdg: number): boolean => Math.abs(pdg) <= 6 || pdg === 21;
export const isLepton = (pdg: number): boolean => Math.abs(pdg) >= 11 && Math.abs(pdg) <= 16;
export const isNeutrino = (pdg: number): boolean => [12, 14, 16].includes(Math.abs(pdg));
export const isChargedLepton = (pdg: number): boolean => [11, 13, 15].includes(Math.abs(pdg));
export const isHadron = (pdg: number): boolean => ['meson', 'baryon'].includes(particle(pdg).kind);
export const isQuark = (pdg: number): boolean => Math.abs(pdg) >= 1 && Math.abs(pdg) <= 6;

/** Pretty-print a list of PDG IDs as "π⁺ π⁻ γ". */
export function symbols(ids: readonly number[]): string {
  return ids.map((id) => particle(id).symbol).join(' ');
}

/**
 * Sum of the additive quantum numbers of a list of particles: charge (in e), baryon number, lepton numbers,
 * strangeness, charm and bottom. The conservation checker of Chapter 11 is built on this.
 */
export function quantumNumbers(ids: readonly number[]): { charge3: number; baryon3: number; lepton: [number, number, number]; strangeness: number; charm: number; bottom: number; top: number } {
  const q = { charge3: 0, baryon3: 0, lepton: [0, 0, 0] as [number, number, number], strangeness: 0, charm: 0, bottom: 0, top: 0 };
  for (const id of ids) {
    const p = particle(id);
    q.charge3 += p.charge3;
    q.baryon3 += p.baryon3;
    q.lepton[0] += p.lepton[0];
    q.lepton[1] += p.lepton[1];
    q.lepton[2] += p.lepton[2];
    q.strangeness += p.strangeness;
    q.charm += p.charm;
    q.bottom += p.bottom;
    q.top += p.top;
  }
  return q;
}
