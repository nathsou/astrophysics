/**
 * The detector geometry as reconstruction needs it: a small, flat description extracted from a `DetectorConfig`
 * (or given directly, in tests). Reconstruction never reads the detector's internals beyond this.
 */
import type { DetectorConfig } from '../detector/index.ts';

/** A cylindrical tracking layer (barrel). Hits carry the index of the layer in this array. */
export interface TrackerLayer {
  /** Radius in mm. */
  r: number;
  /** Hit resolution along the transverse direction (r·φ) and along z, in mm. */
  sigmaRPhi: number;
  sigmaZ: number;
  /** Material thickness in radiation lengths at normal incidence (for multiple scattering). */
  xOverX0: number;
}

export interface CaloGeometry {
  /** Inner radius of the calorimeter in mm (where tracks are extrapolated to). */
  rInner: number;
  /** Cell size in η and φ. */
  dEta: number;
  dPhi: number;
  /** Multiply the summed cell energies by this to get the calibrated energy (1 if cells are already in GeV). */
  scale: number;
  /** Typical noise per cell in GeV (for thresholds). */
  noise: number;
}

export interface RecoGeometry {
  /** Solenoid field in tesla along +z. */
  bField: number;
  layers: TrackerLayer[];
  /** Number of innermost layers that are pixels (used for seeding). */
  nPixelLayers: number;
  /** Tracker half-length in z (mm) and the η it covers. */
  zMax: number;
  etaMax: number;
  /** Outer radius (mm) of the region with the solenoid field; beyond it tracks are straight. */
  coilRadius: number;
  ecal: CaloGeometry;
  hcal: CaloGeometry;
  /** Radii (mm) of the muon stations. */
  muonStations: number[];
  /** Transverse size of the luminous region (mm) and its length along z (mm). */
  beamSpotXY: number;
  luminousZ: number;
}

/** A CMS-like default, used for tests and when a config does not say. */
export const DEFAULT_GEOMETRY: RecoGeometry = {
  bField: 3.8,
  layers: [
    { r: 30, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02 },
    { r: 60, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02 },
    { r: 100, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02 },
    { r: 150, sigmaRPhi: 0.01, sigmaZ: 0.03, xOverX0: 0.02 },
    { r: 250, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03 },
    { r: 370, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03 },
    { r: 500, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03 },
    { r: 650, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03 },
    { r: 800, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03 },
    { r: 1000, sigmaRPhi: 0.03, sigmaZ: 0.3, xOverX0: 0.03 },
  ],
  nPixelLayers: 4,
  zMax: 2800,
  etaMax: 2.5,
  coilRadius: 1300,
  ecal: { rInner: 1290, dEta: 0.0175, dPhi: 0.0175, scale: 1, noise: 0.05 },
  hcal: { rInner: 1800, dEta: 0.087, dPhi: 0.087, scale: 1, noise: 0.2 },
  muonStations: [4000, 5000, 6000, 7000],
  beamSpotXY: 0.015,
  luminousZ: 50,
};

/** The geometry that reconstruction uses, from a detector configuration. */
export function geometryFromConfig(cfg: DetectorConfig | Partial<RecoGeometry>): RecoGeometry {
  return { ...DEFAULT_GEOMETRY, ...(cfg as Partial<RecoGeometry>) };
}
