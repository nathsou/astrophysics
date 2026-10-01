/**
 * The detector geometry as reconstruction needs it: a small, flat description extracted from a `DetectorConfig`
 * (or given directly, in tests). Reconstruction never reads the detector's internals beyond this.
 */
import { calorimeterThickness, hcalOuterRadius, muonEnergyAfter, material, type DetectorConfig } from '../detector/index.ts';

/** A cylindrical tracking layer (barrel). Hits carry the index of the layer in `RecoGeometry.layers` (after `layerMap`). */
export interface TrackerLayer {
  /** Radius in mm. */
  r: number;
  /** Half-length in mm: hits exist only for |z| < halfLength. */
  halfLength: number;
  /** Hit resolution along the transverse direction (r·φ) and along z, in mm. */
  sigmaRPhi: number;
  sigmaZ: number;
  /** Material thickness in radiation lengths at normal incidence (for multiple scattering). */
  xOverX0: number;
  pixel: boolean;
}

export interface CaloGeometry {
  /** Inner radius of the calorimeter in mm (where tracks are extrapolated to). */
  rInner: number;
  /** Cell size in η and φ (the φ size is 2π / round(2π / cellPhi)). */
  dEta: number;
  dPhi: number;
  etaMax: number;
  /** Multiply the summed cell energies by this to get the calibrated energy (1: the cells are already in GeV). */
  scale: number;
  /** Electronic noise per cell in GeV (for thresholds). */
  noise: number;
  /** Number of longitudinal layers. */
  layers: number;
  /** Energy resolution σ/E = stochastic/√E ⊕ constant (E in GeV), used to judge whether an energy excess is significant. */
  stochastic: number;
  constant: number;
}

export interface MuonGeometry {
  stations: { r: number; halfLength: number; sigmaRPhi: number; sigmaZ: number }[];
  /** Field (T, along +z) between the coil and the stations. */
  returnField: number;
  /** Momentum a muon needs to reach the stations. */
  minP: number;
  /** Material the calorimeters present to a radial muon, in radiation lengths (for its multiple scattering). */
  caloX0: number;
  /** Expected muon momentum (GeV) after the calorimeters, for one of p0 (GeV) crossing with path factor f (≥ 1). */
  momentumAfterCalo: (p0: number, f: number) => number;
}

export interface RecoGeometry {
  /** Solenoid field in tesla along +z. */
  bField: number;
  /** Tracker layers sorted by radius. */
  layers: TrackerLayer[];
  /**
   * Maps the `layer` number a hit carries to the index in `layers` (−1 for unknown layers). `undefined` means the
   * identity: the hits' layer numbers already are indices into `layers`.
   */
  layerMap?: number[];
  /** Number of pixel layers (used for seeding). */
  nPixelLayers: number;
  /** Tracker half-length in z (mm) and the η it covers. */
  zMax: number;
  etaMax: number;
  /** Outer radius (mm) of the region with the solenoid field; beyond it, in the return-field region, muons bend the other way. */
  coilRadius: number;
  ecal: CaloGeometry;
  hcal: CaloGeometry;
  muon: MuonGeometry;
  /** Transverse size of the luminous region (mm) and its length along z (mm). */
  beamSpotXY: number;
  luminousZ: number;
}

/** A CMS-like default, used for tests and as the fallback. */
export const DEFAULT_GEOMETRY: RecoGeometry = {
  bField: 3.8,
  layers: [
    { r: 30, halfLength: 3000, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02, pixel: true },
    { r: 60, halfLength: 3000, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02, pixel: true },
    { r: 100, halfLength: 3000, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02, pixel: true },
    { r: 150, halfLength: 3000, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02, pixel: true },
    { r: 250, halfLength: 3000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03, pixel: false },
    { r: 370, halfLength: 3000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03, pixel: false },
    { r: 500, halfLength: 3000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03, pixel: false },
    { r: 650, halfLength: 3000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03, pixel: false },
    { r: 800, halfLength: 3000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03, pixel: false },
    { r: 1000, halfLength: 3000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03, pixel: false },
  ],
  nPixelLayers: 4,
  zMax: 3000,
  etaMax: 2.5,
  coilRadius: 3000,
  ecal: { rInner: 1290, dEta: 0.0175, dPhi: 0.0175, etaMax: 2.5, scale: 1, noise: 0.03, layers: 3, stochastic: 0.027, constant: 0.003 },
  hcal: { rInner: 1600, dEta: 0.087, dPhi: 0.087, etaMax: 2.5, scale: 1, noise: 0.02, layers: 4, stochastic: 1.0, constant: 0.05 },
  muon: {
    stations: [4000, 5000, 6000, 7000].map((r) => ({ r, halfLength: 7000, sigmaRPhi: 0.3, sigmaZ: 1.5 })),
    returnField: -1.8,
    minP: 4,
    caloX0: 120,
    momentumAfterCalo: (p0) => Math.max(0.5, p0 - 3),
  },
  beamSpotXY: 0.015,
  luminousZ: 50,
};

const converted = new WeakMap<object, RecoGeometry>();

function isRecoGeometry(c: object): c is RecoGeometry {
  const g = c as Partial<RecoGeometry>;
  return Array.isArray(g.layers) && typeof g.bField === 'number' && g.ecal !== undefined && 'rInner' in g.ecal && g.muon !== undefined && 'stations' in g.muon;
}

/**
 * The geometry that reconstruction uses, from a detector configuration. The result is cached per configuration
 * object, so repeated calls return the same object (which per-geometry caches rely on). A `RecoGeometry`, or a
 * partial one (filled in from `DEFAULT_GEOMETRY`), is accepted too, for tests.
 */
export function geometryFromConfig(cfg: DetectorConfig | Partial<RecoGeometry>): RecoGeometry {
  const hit = converted.get(cfg as object);
  if (hit) return hit;
  let out: RecoGeometry;
  if (isRecoGeometry(cfg)) out = cfg;
  else if ('trackerLayers' in cfg && Array.isArray((cfg as DetectorConfig).trackerLayers)) out = fromDetectorConfig(cfg as DetectorConfig);
  else out = { ...DEFAULT_GEOMETRY, ...(cfg as Partial<RecoGeometry>) };
  converted.set(cfg as object, out);
  return out;
}

function fromDetectorConfig(cfg: DetectorConfig): RecoGeometry {
  const order = cfg.trackerLayers.map((l, i) => ({ l, i })).sort((a, b) => a.l.r - b.l.r);
  const layers: TrackerLayer[] = order.map(({ l }) => ({ r: l.r, halfLength: l.halfLength, sigmaRPhi: l.sigmaRPhi, sigmaZ: l.sigmaZ, xOverX0: l.x0, pixel: l.kind === 'pixel' }));
  const layerMap: number[] = new Array(cfg.trackerLayers.length).fill(-1);
  order.forEach(({ i }, k) => (layerMap[i] = k));
  const identity = layerMap.every((v, i) => v === i);
  const nPhi = (cellPhi: number) => Math.max(4, Math.round((2 * Math.PI) / cellPhi));
  const coilRadius = cfg.solenoidRadius ?? hcalOuterRadius(cfg);
  const thick = calorimeterThickness(cfg.ecal, cfg.hcal);
  const me = material(cfg.ecal.material ?? 'PbWO4');
  const mh = material(cfg.hcal.material ?? 'Fe');
  const M_MU = 0.1056583755;
  const eta = cfg.etaMax;
  return {
    bField: cfg.bField,
    layers,
    layerMap: identity ? undefined : layerMap,
    nPixelLayers: layers.filter((l) => l.pixel).length,
    zMax: Math.max(...layers.map((l) => l.halfLength)),
    etaMax: eta,
    coilRadius,
    ecal: { rInner: cfg.ecal.rIn, dEta: cfg.ecal.cellEta, dPhi: (2 * Math.PI) / nPhi(cfg.ecal.cellPhi), etaMax: cfg.ecal.etaMax, scale: 1, noise: cfg.ecal.noise, layers: Math.max(1, Math.round(cfg.ecal.layers)), stochastic: cfg.ecal.stochastic, constant: cfg.ecal.constant },
    hcal: { rInner: cfg.hcal.rIn, dEta: cfg.hcal.cellEta, dPhi: (2 * Math.PI) / nPhi(cfg.hcal.cellPhi), etaMax: cfg.hcal.etaMax ?? cfg.ecal.etaMax, scale: 1, noise: cfg.hcal.noise ?? 0, layers: Math.max(1, Math.round(cfg.hcal.layers)), stochastic: cfg.hcal.stochastic, constant: cfg.hcal.constant },
    muon: {
      stations: cfg.muon.stations.map((s) => ({ r: s.r, halfLength: s.halfLength, sigmaRPhi: s.sigmaRPhi, sigmaZ: s.sigmaZ })),
      returnField: cfg.muon.returnField ?? 0,
      minP: cfg.muon.minPToReach,
      caloX0: cfg.ecal.depthX0 + thick.hcal / mh.X0,
      momentumAfterCalo: (p0, f) => {
        let E = muonEnergyAfter(me, thick.ecal * f, Math.sqrt(p0 * p0 + M_MU * M_MU));
        if (E > 0) E = muonEnergyAfter(mh, thick.hcal * f, E);
        return E > M_MU ? Math.sqrt(E * E - M_MU * M_MU) : 0;
      },
    },
    beamSpotXY: cfg.beamSpot.sigmaXY,
    luminousZ: cfg.beamSpot.sigmaZ,
  };
}
