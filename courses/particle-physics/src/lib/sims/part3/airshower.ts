/**
 * A toy air shower (Chapter 10). Only the hadronic part is followed particle by particle: a primary proton, its secondary charged pions,
 * the muons they decay into, and the muons' flight to the ground. Everything else is a stated simplification:
 *
 *  - Atmosphere: isothermal, X(h) = X₀ exp(−h/H) with X₀ = 1030 g/cm² and H = 7.5 km (the real scale height varies with height).
 *  - A proton interacts after an exponential depth of mean 80 g/cm², keeps half its energy and gives the other half to new pions;
 *    a pion interacts after mean 120 g/cm² and shares all its energy among its secondaries. The multiplicity is 10 (E/TeV)^0.2
 *    charged pions, half as many neutral pions again. Kaons and baryon-antibaryon pairs are ignored.
 *  - Neutral pions decay at once into photons: their energy goes to the electromagnetic component, which is not followed.
 *  - A charged pion decays or interacts, whichever comes first: the decay is exponential in the path βγcτ with τ from `hep/particles`.
 *    A decay gives a muon with a fraction of the pion's energy uniform between (m_μ/m_π)² and 1 (isotropic decay of a spin-0 particle).
 *  - A muon loses 2 MeV cm²/g on the way down (minimum ionisation) and decays with its own βγcτ; a muon that falls below its mass stops.
 *  - Transverse momenta of secondaries are exponential with mean 0.4 GeV and set the lateral drift (straight lines after birth).
 *
 * With `timeDilation: false` the muons' decay length is cτ (the lifetime applied in the lab frame) instead of βγcτ, to show what
 * special relativity changes. Pions and everything else are left as they are.
 *
 * It is a teaching toy, tested for internal consistency and order of magnitude (Heitler–Matthews, Astropart. Phys. 22, 387): it is not a
 * substitute for CORSIKA, and no claim of agreement with any measured shower is made.
 */
import { rng as makeRng, type Rng } from '../../hep/random/index.ts';
import { particle } from '../../hep/particles/index.ts';

export const X0 = 1030; // g/cm², vertical depth at sea level
export const H_KM = 7.5; // scale height, km
export const LAMBDA_P = 80; // g/cm²
export const LAMBDA_PI = 120; // g/cm²
export const MU_LOSS = 0.002; // GeV per g/cm²: 2 MeV cm²/g
export const E_PION_STOP = 0.15; // GeV: a pion below this is taken to decay at once

const mPi = particle(211).mass;
const mMu = particle(13).mass;
const C_M_PER_S = 299_792_458;
/** Proper decay lengths cτ in metres from the table's lifetimes. */
export const CTAU_PI_M = particle(211).lifetime * C_M_PER_S;
export const CTAU_MU_M = particle(13).lifetime * C_M_PER_S;

/** Height (km) of a vertical atmospheric depth X (g/cm²). */
export const heightOfDepth = (X: number): number => H_KM * Math.log(X0 / X);
/** Vertical depth (g/cm²) at a height (km). */
export const depthAtHeight = (h: number): number => X0 * Math.exp(-h / H_KM);
/** Air density (g/cm³) at a vertical depth X: ρ = X/H for an isothermal atmosphere. */
export const densityAtDepth = (X: number): number => X / (H_KM * 1e5);

export interface ShowerConfig {
  /** Primary energy, GeV. */
  E0: number;
  /** Zenith angle, degrees (0 = vertical). */
  zenithDeg?: number;
  seed?: number;
  /** Apply special-relativistic time dilation to the muons (default true). */
  timeDilation?: boolean;
  /** How many tracks to keep for drawing. */
  keepTracks?: number;
}

export interface Track {
  kind: 'proton' | 'pion' | 'muon';
  /** Polyline of (lateral km, height km). */
  pts: [number, number][];
  /** Muons only: did it reach the ground? */
  reached?: boolean;
  E: number;
}

export interface ShowerResult {
  config: Required<Omit<ShowerConfig, 'keepTracks'>> & { keepTracks: number };
  /** Height of the first interaction, km. */
  firstHeightKm: number;
  /** Numbers of particles produced. */
  pions: number;
  chargedPionDecays: number;
  muonsMade: number;
  /** Muons reaching sea level in the simulation. */
  muonsGround: number;
  /** With the muon decay length cτ (no dilation), the expected number reaching the ground from the same muons, ignoring energy loss. */
  expectedNoDilation: number;
  /** With time dilation and no energy loss, the expected number (for comparison with the simulated count). */
  expectedDilationNoLoss: number;
  /** Energy that went into neutral pions (the electromagnetic component), GeV. */
  emEnergy: number;
  /** Energies (GeV) of the muons that reached the ground. */
  groundEnergies: number[];
  /** For every muon made: the height (km) where it was born, its energy (GeV) then, whether it reached the ground, and the probability it would have had without time dilation. */
  muonBirthKm: Float32Array;
  muonEnergy: Float32Array;
  muonReached: Uint8Array;
  muonPNoDilation: Float32Array;
  /** Lateral distances (km) of ground muons from the shower axis. */
  groundRadii: number[];
  tracks: Track[];
}

/** Multiplicity of charged pions in one hadronic interaction at energy E (GeV). */
export const chargedMultiplicity = (E: number): number => Math.max(2, Math.round(10 * Math.pow(Math.max(E, 1) / 1000, 0.2)));

interface Pion { E: number; s: number; lat: number }

/** Decay-length integral for a particle of decay length L (m) from slant depth s0 to s1: the optical depth ∫ dl/L = (H/cosθ) ln(s1/s0)/L. */
const opticalDepth = (Hm: number, s0: number, s1: number, L: number) => (Hm * Math.log(s1 / s0)) / L;

export function simulateShower(cfg: ShowerConfig, r: Rng = makeRng(cfg.seed ?? 1)): ShowerResult {
  const zenithDeg = cfg.zenithDeg ?? 0;
  const timeDilation = cfg.timeDilation ?? true;
  const keep = cfg.keepTracks ?? 260;
  const cosZ = Math.cos((zenithDeg * Math.PI) / 180);
  const expo = (mean: number) => -mean * Math.log(1 - r());
  const slantTotal = X0 / cosZ;
  // The slant path element is (H/cosθ) ds/s, with H the scale height in metres.
  const Hm = (H_KM * 1000) / cosZ;
  const posKm = (s: number, lat: number): [number, number] => [lat, heightOfDepth(Math.min(X0, s * cosZ))];
  const out: ShowerResult = {
    config: { E0: cfg.E0, zenithDeg, seed: cfg.seed ?? 1, timeDilation, keepTracks: keep },
    firstHeightKm: NaN, pions: 0, chargedPionDecays: 0, muonsMade: 0, muonsGround: 0, expectedNoDilation: 0, expectedDilationNoLoss: 0, emEnergy: 0,
    groundEnergies: [], muonBirthKm: new Float32Array(0), muonEnergy: new Float32Array(0), muonReached: new Uint8Array(0), muonPNoDilation: new Float32Array(0), groundRadii: [], tracks: [],
  };

  const share = (E: number, nTot: number): number[] => {
    const w = Array.from({ length: nTot }, () => -Math.log(1 - r()));
    const sw = w.reduce((a, b) => a + b, 0);
    return w.map((x) => (E * x) / sw);
  };

  // The leading proton: interacts repeatedly, each time keeping half its energy.
  const queue: Pion[] = [];
  let E = cfg.E0;
  let s = 0;
  const pTrack: [number, number][] = [posKm(0, 0)];
  while (E > 50) {
    s += expo(LAMBDA_P);
    if (s >= slantTotal) break;
    if (Number.isNaN(out.firstHeightKm)) out.firstHeightKm = heightOfDepth(s * cosZ);
    pTrack.push(posKm(s, 0));
    const give = E / 2;
    E -= give;
    const nCh = chargedMultiplicity(give);
    const shares = share(give, Math.round(1.5 * nCh));
    shares.forEach((Ei, i) => (i < nCh ? queue.push({ E: Ei, s, lat: 0 }) : (out.emEnergy += Ei)));
  }
  out.tracks.push({ kind: 'proton', pts: pTrack, E: cfg.E0 });

  // Charged pions: each runs until it interacts, decays or reaches the ground. Decay and interaction points are sampled in closed form.
  const muons: { E: number; s: number; lat: number; ang: number }[] = [];
  const f0 = (mMu / mPi) ** 2;
  let drawPi = keep;
  for (let iq = 0; iq < queue.length; iq++) {
    const p = queue[iq]!;
    const sInt = p.s + expo(LAMBDA_PI);
    let sDec = Infinity;
    if (p.E > E_PION_STOP) {
      const gam = p.E / mPi;
      const L = Math.sqrt(gam * gam - 1) * CTAU_PI_M;
      sDec = p.s * Math.exp((expo(1) * L) / Hm);
    } else sDec = p.s;
    const pt = expo(0.4);
    const ang = Math.min(0.5, pt / Math.max(p.E, 0.3)) * (r() < 0.5 ? -1 : 1);
    const sEnd = Math.min(sInt, sDec, slantTotal);
    const lat = p.lat + (ang * Hm * Math.log(sEnd / p.s)) / 1000;
    if (drawPi > 0 && r() < 0.25) {
      out.tracks.push({ kind: 'pion', pts: [posKm(p.s, p.lat), posKm(sEnd, lat)], E: p.E });
      drawPi--;
    }
    if (sEnd >= slantTotal) continue;
    if (sDec <= sInt) {
      out.chargedPionDecays++;
      const Em = p.E * (f0 + (1 - f0) * r());
      if (Em > mMu) muons.push({ E: Em, s: sDec, lat, ang });
    } else {
      const nCh = chargedMultiplicity(p.E);
      const shares = share(p.E, Math.round(1.5 * nCh));
      shares.forEach((Ei, i) => (i < nCh ? queue.push({ E: Ei, s: sInt, lat }) : (out.emEnergy += Ei)));
    }
  }
  out.pions = queue.length;
  out.muonsMade = muons.length;

  // Muons: decay in flight and lose energy to ionisation on the way down.
  const STEP = 10; // g/cm² of slant depth
  const n = muons.length;
  out.muonBirthKm = new Float32Array(n);
  out.muonEnergy = new Float32Array(n);
  out.muonReached = new Uint8Array(n);
  out.muonPNoDilation = new Float32Array(n);
  let drawMu = keep;
  muons.forEach((m, k) => {
    const gam0 = m.E / mMu;
    const beta0 = Math.sqrt(1 - 1 / (gam0 * gam0));
    const pNo = Math.exp(-opticalDepth(Hm, m.s, slantTotal, CTAU_MU_M));
    out.expectedNoDilation += pNo;
    out.expectedDilationNoLoss += Math.exp(-opticalDepth(Hm, m.s, slantTotal, gam0 * beta0 * CTAU_MU_M));
    out.muonBirthKm[k] = heightOfDepth(m.s * cosZ);
    out.muonEnergy[k] = m.E;
    out.muonPNoDilation[k] = pNo;
    let Em = m.E;
    let sm = m.s;
    let lat = m.lat;
    let alive = true;
    while (sm < slantTotal) {
      const dsl = Math.min(STEP, slantTotal - sm);
      Em -= MU_LOSS * dsl;
      if (Em <= mMu) { alive = false; break; }
      const gam = Em / mMu;
      const L = timeDilation ? Math.sqrt(gam * gam - 1) * CTAU_MU_M : CTAU_MU_M;
      const x = opticalDepth(Hm, sm, sm + dsl, L);
      if (r() < 1 - Math.exp(-x)) { alive = false; break; }
      lat += (m.ang * Hm * Math.log((sm + dsl) / sm)) / 1000;
      sm += dsl;
    }
    if (alive) {
      out.muonsGround++;
      out.muonReached[k] = 1;
      out.groundEnergies.push(Em);
      out.groundRadii.push(Math.abs(lat));
    }
    if (drawMu > 0 && (alive || r() < 0.2)) {
      out.tracks.push({ kind: 'muon', pts: [posKm(m.s, m.lat), posKm(sm, lat)], reached: alive, E: m.E });
      drawMu--;
    }
  });
  return out;
}
