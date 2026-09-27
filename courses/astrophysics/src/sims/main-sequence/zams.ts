// Shared physics for Chapter 14 (The Main Sequence): a Kroupa-IMF sampler, analytic
// zero-age-main-sequence (ZAMS) fits, the MS lifetime law, and a schematic post-MS
// evolutionary track used to age a whole cluster cheaply (thousands of stars, one
// closed-form evaluation each — no per-star ODE integration).
//
// The ZAMS fits are deliberately simple power laws, not a real stellar-evolution grid
// (see the Hood in the chapter for what codes like MIST/PARSEC actually solve). They are
// tuned to be continuous and to pass through the Sun at 1 M☉.

export const Tsun = 5772; // K
const logTsun = Math.log10(Tsun);

/** Deterministic PRNG (mulberry32) so "Resample" is reproducible per seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample one stellar mass (M☉) from a Kroupa (2001)-style broken power law,
 * dN/dM ∝ M^-1.3 for 0.1–0.5 M☉ and ∝ M^-2.3 for 0.5–60 M☉, via inverse-CDF sampling.
 * The two segments are normalised so the number density dN/dM is continuous at 0.5 M☉.
 */
export function sampleKroupaMass(rng: () => number): number {
  const m0 = 0.1, m1 = 0.5, m2 = 60;
  const a1 = 1.3, a2 = 2.3;
  const k2 = Math.pow(m1, a2 - a1); // continuity: k2·m1^-a2 = m1^-a1
  const I1 = (Math.pow(m1, 1 - a1) - Math.pow(m0, 1 - a1)) / (1 - a1);
  const I2 = (k2 * (Math.pow(m2, 1 - a2) - Math.pow(m1, 1 - a2))) / (1 - a2);
  const total = I1 + I2;
  const u = rng() * total;
  if (u <= I1) {
    const val = u * (1 - a1) + Math.pow(m0, 1 - a1);
    return Math.pow(val, 1 / (1 - a1));
  }
  const u2 = u - I1;
  const val = (u2 * (1 - a2)) / k2 + Math.pow(m1, 1 - a2);
  return Math.pow(val, 1 / (1 - a2));
}

/** ZAMS luminosity (L☉) from mass (M☉): piecewise power law, ≈ M^3.5 overall, steepening at low mass. */
export function zamsL(M: number): number {
  if (M < 0.43) return 0.23 * M ** 2.3;
  if (M < 2) return M ** 4;
  if (M < 20) return 1.5 * M ** 3.5;
  return 3200 * M; // Eddington-limited: L saturates to roughly linear in M
}

/** ZAMS radius (R☉) from mass (M☉): R ∝ M^0.8 below 1 M☉, ∝ M^0.57 above (both continuity-matched at 1 M☉). */
export function zamsR(M: number): number {
  return M < 1 ? M ** 0.8 : M ** 0.57;
}

/** Effective temperature (K) from L (L☉) and R (R☉), via L = 4πR²σT⁴. */
export function teffFromLR(L: number, R: number): number {
  return Tsun * (L / (R * R)) ** 0.25;
}

/** Main-sequence lifetime (yr): τ ≈ 10¹⁰ yr (M/M☉)^-2.5, from τ ∝ M/L and L ∝ M^3.5. */
export function msLifetime(M: number): number {
  return 1e10 * M ** -2.5;
}

export type Phase = 'ms' | 'giant' | 'clump' | 'agb' | 'wd' | 'sn' | 'gone';

export interface StarState {
  L: number; // L☉
  R: number; // R☉
  T: number; // K
  phase: Phase;
}

const Rfrom = (L: number, T: number) => Math.sqrt(L) * (Tsun / T) ** 2;

/**
 * Evolve one star of mass M (M☉) to age t (yr). Purely a function of (M, t) — no memory —
 * so scrubbing the age slider backwards and forwards is exact and needs no simulation state.
 * The main sequence itself uses the real scaling laws; everything past the turn-off is a
 * schematic, hand-tuned track (subgiant/RGB → clump/HB or blue loop → AGB → remnant) meant
 * to show the *shape* of post-MS evolution on the HR diagram, not to match a real isochrone.
 */
export function evolveStar(M: number, t: number): StarState {
  const Lz = zamsL(M), Rz = zamsR(M), Tz = teffFromLR(Lz, Rz);
  const tauMS = msLifetime(M);
  const tPost = 0.15 * tauMS;
  const tDeath = tauMS + tPost;
  const highMass = M >= 8;

  if (t < tauMS) {
    const f = t / tauMS;
    const L = Lz * (1 + 0.35 * f); // the Sun brightens ~35% over its MS life
    const R = Rz * (1 + 0.2 * f);
    return { L, R, T: teffFromLR(L, R), phase: 'ms' };
  }

  if (t < tDeath) {
    const p = (t - tauMS) / tPost;
    let L: number, T: number, phase: Phase;
    if (p < 0.6) {
      const q = p / 0.6;
      const Lpeak = highMass ? Lz * 3 : Lz * (M < 2 ? 200 : 30);
      L = Lz * (1 + (Lpeak / Lz - 1) * q);
      T = highMass ? Tz * (1 - 0.5 * q) : 4200 - 900 * q;
      phase = 'giant';
    } else if (p < 0.8 && !highMass) {
      const q = (p - 0.6) / 0.2;
      L = Lz * 30 * (1 - 0.25 * q);
      T = 4700 + 250 * Math.sin(q * Math.PI); // the "blueward hook" of the clump/HB
      phase = 'clump';
    } else {
      const q = highMass ? (p - 0.6) / 0.4 : (p - 0.8) / 0.2;
      const Lbase = highMass ? Lz * 3 : Lz * 22.5;
      const Lpeak2 = highMass ? Lz * 8 : Lz * 400;
      L = Lbase + (Lpeak2 - Lbase) * q;
      T = highMass ? Tz * 0.4 : 3200;
      phase = 'agb';
    }
    return { L, R: Rfrom(L, T), T, phase };
  }

  const tSince = t - tDeath;
  if (highMass) {
    if (tSince < Math.max(tauMS * 0.0005, 3e4)) {
      const L = Lz * 5e6; // schematic peak supernova luminosity, for the flash render only
      return { L, R: Rfrom(L, 8000), T: 8000, phase: 'sn' };
    }
    return { L: 0, R: 0, T: 0, phase: 'gone' }; // exploded: gone from the diagram
  }
  // White-dwarf cooling: fixed degenerate radius (smaller for higher remnant mass), T falls
  // roughly as a cooling power law (schematic — real cooling curves depend on core composition).
  const Rwd = 0.013 * Math.pow(Math.max(M, 0.5), -1 / 3);
  const Twd = Math.max(3500, 3.2e4 * Math.pow(Math.max(tSince, 1e5) / 1e6, -0.35));
  const Lwd = Rwd * Rwd * (Twd / Tsun) ** 4;
  return { L: Lwd, R: Rwd, T: Twd, phase: 'wd' };
}

/** Turn-off mass (M☉) at cluster age t (yr): invert τ(M) = t. */
export function turnoffMass(t: number, mMax = 60): number {
  if (t <= msLifetime(mMax)) return mMax;
  return Math.min(mMax, Math.pow(1e10 / t, 1 / 2.5));
}
