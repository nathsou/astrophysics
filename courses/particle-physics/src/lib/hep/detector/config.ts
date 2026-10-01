/**
 * Detector configuration and presets.
 *
 * Geometry: a barrel of concentric cylinders around the beam (z), all lengths in mm. Tracker layers, ECAL, HCAL and
 * muon stations are cylinders of given radius and half-length; the calorimeters are projective towers in (η, φ)
 * that also cover the endcap region up to `etaMax`. Endcap disks are not modelled separately: the pseudorapidity
 * coverage of the tracker follows from each layer's half-length (and `etaMax`).
 */
import { muonEnergyAfter, M_MU } from './physics.ts';
import { material } from './materials.ts';

export interface TrackerLayerConfig {
  /** Radius in mm. */
  r: number;
  /** Half-length in mm (the layer spans −halfLength < z < +halfLength). */
  halfLength: number;
  /** Position resolution (Gaussian σ) in the r·φ direction, mm. */
  sigmaRPhi: number;
  /** Position resolution along z, mm. */
  sigmaZ: number;
  /** Material thickness in radiation lengths at normal incidence (sensor, support, cables, cooling). */
  x0: number;
  kind: 'pixel' | 'strip';
}

export interface EcalConfig {
  /** Inner radius (mm). */
  rIn: number;
  /** Depth in radiation lengths. */
  depthX0: number;
  /** Half-length of the barrel (mm); the endcap region is covered up to `etaMax`. */
  halfLength: number;
  /** Pseudorapidity coverage. */
  etaMax: number;
  /** Stochastic term a in σ/E = a/√E ⊕ b ⊕ n/E (√GeV). */
  stochastic: number;
  /** Constant term b. */
  constant: number;
  /** Electronic noise per cell (GeV). Cells below 2 × noise are suppressed. */
  noise: number;
  /** Cell size in η and φ (radians). */
  cellEta: number;
  cellPhi: number;
  /** Longitudinal segmentation. */
  layers: number;
  /** Absorber/scintillator material key from `materials` (default 'PbWO4'). */
  material?: string;
}

export interface HcalConfig {
  rIn: number;
  /** Depth in nuclear interaction lengths of the absorber. */
  depthLambda: number;
  stochastic: number;
  constant: number;
  /** Electronic noise per cell (GeV), optional (default 0). */
  noise?: number;
  cellEta: number;
  cellPhi: number;
  layers: number;
  /** Absorber material key (default 'Fe'). */
  material?: string;
  /** Pseudorapidity coverage (default: the ECAL's). */
  etaMax?: number;
}

export interface MuonStationConfig {
  r: number;
  halfLength: number;
  sigmaRPhi: number;
  sigmaZ: number;
}

export interface MuonConfig {
  stations: MuonStationConfig[];
  /** Field (T, signed, along +z) in the flux-return region between the coil and the stations; 0 or absent = none. */
  returnField?: number;
  /** Momentum (GeV) a muon needs at the vertex to reach the stations; derive it with `deriveMuonMinP`. */
  minPToReach: number;
}

export interface DetectorConfig {
  name: string;
  /** Solenoid field in tesla along +z. */
  bField: number;
  trackerLayers: TrackerLayerConfig[];
  ecal: EcalConfig;
  hcal: HcalConfig;
  muon: MuonConfig;
  /** Pseudorapidity coverage of the tracker. */
  etaMax: number;
  /** Width of the luminous region: σ_z along the beam and σ_xy transverse, mm. */
  beamSpot: { sigmaZ: number; sigmaXY: number };
  /** Mean number of noise hits per tracker layer per event. */
  noiseHitsPerLayer: number;
  /** Fraction of tracker channels that are dead (a fixed, hashed map, the same in every event). */
  deadFraction: number;
  /** Radius (mm) of the coil: the field is `bField` inside and `muon.returnField` outside. Default: the outer radius of the HCAL. */
  solenoidRadius?: number;
  /** One-line description for menus. */
  description?: string;
}

/** The outer radius of the HCAL in mm (its absorber depth is depthLambda × λI of the absorber). */
export function hcalOuterRadius(cfg: DetectorConfig): number {
  const m = material(cfg.hcal.material ?? 'Fe');
  return cfg.hcal.rIn + cfg.hcal.depthLambda * m.lambdaIcm * 10;
}

/** The outer radius of the ECAL in mm. */
export function ecalOuterRadius(cfg: DetectorConfig): number {
  const m = material(cfg.ecal.material ?? 'PbWO4');
  return cfg.ecal.rIn + cfg.ecal.depthX0 * m.X0cm * 10;
}

/** The mass (g/cm²) of ECAL and HCAL material a radial muon crosses. */
export function calorimeterThickness(ecal: EcalConfig, hcal: HcalConfig): { ecal: number; hcal: number } {
  const me = material(ecal.material ?? 'PbWO4');
  const mh = material(hcal.material ?? 'Fe');
  return { ecal: ecal.depthX0 * me.X0, hcal: hcal.depthLambda * mh.lambdaI };
}

/**
 * The momentum (GeV) a muon needs at the vertex to cross the calorimeters and still have 1 GeV left at the coil:
 * derived from the mean muon energy loss (ionisation plus radiative) in the ECAL and the HCAL absorber.
 */
export function deriveMuonMinP(ecal: EcalConfig, hcal: HcalConfig, pLeft = 1): number {
  const t = calorimeterThickness(ecal, hcal);
  const me = material(ecal.material ?? 'PbWO4');
  const mh = material(hcal.material ?? 'Fe');
  const need = Math.sqrt(pLeft * pLeft + M_MU * M_MU);
  let lo = pLeft;
  let hi = 100;
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi);
    let E = Math.sqrt(mid * mid + M_MU * M_MU);
    E = muonEnergyAfter(me, t.ecal, E);
    E = E > 0 ? muonEnergyAfter(mh, t.hcal, E) : 0;
    if (E >= need) hi = mid;
    else lo = mid;
  }
  return Math.round(hi * 10) / 10;
}

/** A copy of `cfg` with the given top-level or nested fields replaced (shallow merge of each sub-object). */
export function customise(cfg: DetectorConfig, patch: DeepPartial<DetectorConfig>): DetectorConfig {
  const out: DetectorConfig = JSON.parse(JSON.stringify(cfg));
  for (const [k, v] of Object.entries(patch)) {
    const cur = (out as unknown as Record<string, unknown>)[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object') Object.assign(cur, v);
    else (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}
type DeepPartial<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Partial<T[K]> : T[K] };

// ── Presets ───────────────────────────────────────────────────────────────────────────────────

const pix = (r: number, halfLength: number, x0 = 0.012): TrackerLayerConfig => ({ r, halfLength, sigmaRPhi: 0.012, sigmaZ: 0.02, x0, kind: 'pixel' });
const strip = (r: number, halfLength: number, x0 = 0.02): TrackerLayerConfig => ({ r, halfLength, sigmaRPhi: 0.04, sigmaZ: 0.5, x0, kind: 'strip' });

const onionCal = {
  ecal: { rIn: 1290, depthX0: 25, halfLength: 3000, etaMax: 2.5, stochastic: 0.027, constant: 0.003, noise: 0.015, cellEta: 0.0175, cellPhi: 0.0175, layers: 3 },
  hcal: { rIn: 1600, depthLambda: 10, stochastic: 1.0, constant: 0.05, noise: 0.02, cellEta: 0.087, cellPhi: 0.087, layers: 4, etaMax: 2.5 },
} satisfies { ecal: EcalConfig; hcal: HcalConfig };

/**
 * The presets. The numbers of `cms-like` and `atlas-like` are *approximate* public design values, rounded and
 * simplified to fit the model (no endcap disks, one effective material per calorimeter, a solenoidal stand-in for
 * the ATLAS toroids); they are there to show how two design philosophies differ, not to reproduce either detector.
 */
export const presets: Record<string, DetectorConfig> = {
  /** A few tracker layers in a 2 T field: enough for the chapter on tracks. */
  minimal: {
    name: 'minimal',
    description: 'Five tracker layers in 2 T and a modest calorimeter: the detector of the chapter on tracks.',
    bField: 2,
    trackerLayers: [
      { r: 50, halfLength: 1000, sigmaRPhi: 0.05, sigmaZ: 0.1, x0: 0.01, kind: 'pixel' },
      { r: 100, halfLength: 1500, sigmaRPhi: 0.05, sigmaZ: 0.1, x0: 0.01, kind: 'pixel' },
      { r: 200, halfLength: 2000, sigmaRPhi: 0.05, sigmaZ: 0.1, x0: 0.01, kind: 'pixel' },
      { r: 300, halfLength: 2500, sigmaRPhi: 0.05, sigmaZ: 0.1, x0: 0.01, kind: 'pixel' },
      { r: 400, halfLength: 3000, sigmaRPhi: 0.05, sigmaZ: 0.1, x0: 0.01, kind: 'pixel' },
    ],
    ecal: { rIn: 500, depthX0: 25, halfLength: 3000, etaMax: 2.5, stochastic: 0.05, constant: 0.01, noise: 0.01, cellEta: 0.03, cellPhi: 0.03, layers: 2 },
    hcal: { rIn: 750, depthLambda: 8, stochastic: 1.0, constant: 0.08, noise: 0.05, cellEta: 0.1, cellPhi: 0.1, layers: 2, etaMax: 2.5 },
    muon: { stations: [{ r: 2500, halfLength: 5000, sigmaRPhi: 0.5, sigmaZ: 2 }, { r: 3500, halfLength: 5000, sigmaRPhi: 0.5, sigmaZ: 2 }], returnField: 0, minPToReach: 3 },
    etaMax: 2.5,
    beamSpot: { sigmaZ: 50, sigmaXY: 0.02 },
    noiseHitsPerLayer: 0,
    deadFraction: 0,
  },

  /** The course detector: 4 pixel and 4 strip layers to r = 1.1 m, 3.8 T, PbWO₄-like ECAL, steel HCAL, muon stations to 7 m. */
  onion: {
    name: 'onion',
    description: 'The course detector: 4 pixel + 4 strip layers to 1.1 m, 3.8 T, 25 X0 ECAL, 10 λ HCAL, muon stations to 7 m.',
    bField: 3.8,
    trackerLayers: [pix(35, 300), pix(70, 500), pix(110, 700), pix(160, 1000), strip(280, 1800), strip(500, 2800), strip(800, 3000), strip(1100, 3000)],
    ...onionCal,
    muon: {
      stations: [4000, 5000, 6000, 7000].map((r) => ({ r, halfLength: 7000, sigmaRPhi: 0.3, sigmaZ: 1.5 })),
      returnField: -1.8,
      minPToReach: deriveMuonMinP(onionCal.ecal, onionCal.hcal),
    },
    etaMax: 2.5,
    beamSpot: { sigmaZ: 50, sigmaXY: 0.015 },
    noiseHitsPerLayer: 1,
    deadFraction: 0.01,
  },

  /**
   * A compact-solenoid detector in the spirit of CMS (approximate public numbers): 3.8 T, all-silicon tracker
   * (4 pixel + 10 strip layers to ~1.1 m), a PbWO₄ crystal ECAL (25.8 X0, ≈ 2.8 %/√E ⊕ 0.3 %), a brass/scintillator
   * HCAL inside the coil (≈ 7 λ, ≈ 100 %/√E ⊕ 5 %), and muon stations in the iron return yoke (−2 T).
   */
  'cms-like': (() => {
    const ecal: EcalConfig = { rIn: 1290, depthX0: 25.8, halfLength: 3000, etaMax: 3.0, stochastic: 0.028, constant: 0.003, noise: 0.04, cellEta: 0.0174, cellPhi: 0.0174, layers: 3 };
    const hcal: HcalConfig = { rIn: 1810, depthLambda: 7, stochastic: 1.0, constant: 0.05, noise: 0.1, cellEta: 0.087, cellPhi: 0.087, layers: 3, etaMax: 3.0 };
    return {
      name: 'cms-like',
      description: 'Compact solenoid: 3.8 T, all-silicon tracker, PbWO4 ECAL, brass HCAL inside the coil, return-yoke muon system.',
      bField: 3.8,
      trackerLayers: [
        pix(29, 270, 0.015), pix(68, 270, 0.015), pix(109, 270, 0.015), pix(160, 270, 0.015),
        ...[255, 340, 430, 520].map((r) => strip(r, 1300, 0.025)),
        ...[610, 696, 782, 870, 965, 1080].map((r) => strip(r, 1100, 0.03)),
      ],
      ecal,
      hcal,
      solenoidRadius: 3000,
      muon: {
        stations: [4000, 4900, 5900, 7000].map((r) => ({ r, halfLength: 6500, sigmaRPhi: 0.25, sigmaZ: 1.0 })),
        returnField: -2,
        minPToReach: deriveMuonMinP(ecal, hcal),
      },
      etaMax: 2.5,
      beamSpot: { sigmaZ: 50, sigmaXY: 0.015 },
      noiseHitsPerLayer: 1,
      deadFraction: 0.02,
    };
  })(),

  /**
   * A detector with the ATLAS philosophy (approximate public numbers): a weaker 2 T solenoid round a silicon tracker
   * plus a straw-tube tracker (modelled as four coarse outer layers with almost no z information), a sampling liquid-argon ECAL
   * (≈ 10 %/√E ⊕ 0.7 %), a tile HCAL outside it (≈ 50 %/√E ⊕ 3 %), and a large air-core toroid muon spectrometer, here
   * approximated by a 0.5 T axial return field and stations at 5–10 m. The big, light muon system and the fine-sampling
   * calorimeter are the point: muon momentum is measured independently of the inner tracker.
   */
  'atlas-like': (() => {
    const ecal: EcalConfig = { rIn: 1500, depthX0: 24, halfLength: 3200, etaMax: 3.2, stochastic: 0.1, constant: 0.007, noise: 0.03, cellEta: 0.025, cellPhi: 0.0245, layers: 3 };
    const hcal: HcalConfig = { rIn: 2280, depthLambda: 7.4, stochastic: 0.5, constant: 0.03, noise: 0.1, cellEta: 0.1, cellPhi: 0.1, layers: 3, etaMax: 3.2 };
    return {
      name: 'atlas-like',
      description: 'Sampling LAr ECAL, tile HCAL, weaker 2 T solenoid, big air-core-toroid-like muon system (approximated).',
      bField: 2,
      trackerLayers: [
        pix(33, 400, 0.02), pix(50.5, 400, 0.02), pix(88.5, 400, 0.02), pix(122.5, 400, 0.02),
        ...[299, 371, 443, 514].map((r) => strip(r, 750, 0.03)),
        ...[650, 800, 950, 1070].map((r) => ({ r, halfLength: 700, sigmaRPhi: 0.13, sigmaZ: 50, x0: 0.03, kind: 'strip' as const })),
      ],
      ecal,
      hcal,
      muon: {
        stations: [5000, 7500, 9500].map((r) => ({ r, halfLength: 12000, sigmaRPhi: 0.06, sigmaZ: 1.5 })),
        returnField: 0.5,
        minPToReach: deriveMuonMinP(ecal, hcal),
      },
      etaMax: 2.5,
      beamSpot: { sigmaZ: 50, sigmaXY: 0.012 },
      noiseHitsPerLayer: 1,
      deadFraction: 0.02,
    };
  })(),

  /** A round-number detector to play with: six identical layers, 2 T, simple calorimeters. */
  sandbox: {
    name: 'sandbox',
    description: 'Round numbers: six layers of 50 μm resolution in 2 T, moderate calorimeters; meant to be edited.',
    bField: 2,
    trackerLayers: [50, 100, 150, 200, 250, 300].map((r) => ({ r, halfLength: 2500, sigmaRPhi: 0.05, sigmaZ: 0.1, x0: 0.01, kind: 'pixel' as const })),
    ecal: { rIn: 500, depthX0: 25, halfLength: 2500, etaMax: 2.5, stochastic: 0.05, constant: 0.01, noise: 0, cellEta: 0.05, cellPhi: 0.05, layers: 2 },
    hcal: { rIn: 800, depthLambda: 8, stochastic: 0.8, constant: 0.05, noise: 0, cellEta: 0.1, cellPhi: 0.1, layers: 2, etaMax: 2.5 },
    muon: { stations: [{ r: 2500, halfLength: 5000, sigmaRPhi: 0.5, sigmaZ: 2 }, { r: 3000, halfLength: 5000, sigmaRPhi: 0.5, sigmaZ: 2 }], returnField: 0, minPToReach: 3 },
    etaMax: 2.5,
    beamSpot: { sigmaZ: 0, sigmaXY: 0 },
    noiseHitsPerLayer: 0,
    deadFraction: 0,
  },
};
