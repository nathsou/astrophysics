/**
 * The geometry the event display needs, defined here so that the display does not depend on the detector module.
 * Lengths in mm, field in tesla. `geometryFromDetectorConfig` adapts any detector configuration that has the
 * structural shape below (so the detector module's `DetectorConfig` matches without an import).
 */

export interface Cylinder {
  r: number;
  halfLength: number;
}

export interface CaloShell {
  rIn: number;
  rOut: number;
  halfLength: number;
  /** Tower size in η and φ (radians) used to draw cells. */
  cell: number;
}

export interface DisplayGeometry {
  /** Solenoid field along +z, in tesla. */
  bField: number;
  /** Tracker layers, innermost first: concentric barrel cylinders. */
  tracker: Cylinder[];
  ecal: CaloShell;
  hcal: CaloShell;
  /** The solenoid coil (drawn between the calorimeters and the muon system). */
  solenoid: Cylinder;
  /** Muon stations, innermost first. */
  muon: Cylinder[];
  /** Field outside the solenoid as a multiple of `bField` (1 = the same helix continues; CMS's return field is about −0.5). */
  outerFieldFactor: number;
}

/** A CMS-like detector: 3.8 T, tracker to 1.1 m, ECAL at 1.29 m, HCAL at 1.81 m, four muon stations to 7 m. */
export const defaultGeometry: DisplayGeometry = {
  bField: 3.8,
  tracker: [
    { r: 30, halfLength: 500 },
    { r: 70, halfLength: 700 },
    { r: 110, halfLength: 900 },
    { r: 200, halfLength: 1500 },
    { r: 300, halfLength: 2000 },
    { r: 420, halfLength: 2500 },
    { r: 550, halfLength: 2700 },
    { r: 700, halfLength: 2700 },
    { r: 860, halfLength: 2700 },
    { r: 1100, halfLength: 2700 },
  ],
  ecal: { rIn: 1290, rOut: 1510, halfLength: 3040, cell: 0.087 },
  hcal: { rIn: 1810, rOut: 2950, halfLength: 4250, cell: 0.087 },
  solenoid: { r: 3400, halfLength: 6000 },
  muon: [
    { r: 4000, halfLength: 6000 },
    { r: 4900, halfLength: 7000 },
    { r: 5900, halfLength: 7800 },
    { r: 7000, halfLength: 8800 },
  ],
  outerFieldFactor: 1,
};

/** Radiation length and nuclear interaction length used to turn calorimeter depths into millimetres (PbWO₄ and steel, approximately). */
export const X0_MM = 8.9;
export const LAMBDA_MM = 165;

/** The structural shape of a detector configuration that `geometryFromDetectorConfig` accepts. */
export interface DetectorConfigShape {
  bField: number;
  trackerLayers: { r: number; halfLength: number }[];
  ecal: { rIn: number; depthX0: number; halfLength: number };
  hcal: { rIn: number; depthLambda: number };
  muon: { stations: { r: number; halfLength: number }[] };
}

/**
 * Build a display geometry from a detector configuration. The ECAL thickness is `depthX0` radiation lengths (8.9 mm each,
 * lead tungstate) and the HCAL thickness `depthLambda` interaction lengths (165 mm each, steel). The HCAL is given the same
 * η coverage as the ECAL, and the coil sits between the HCAL and the first muon station. These are drawing choices.
 */
export function geometryFromDetectorConfig(cfg: DetectorConfigShape): DisplayGeometry {
  const ecalOut = cfg.ecal.rIn + cfg.ecal.depthX0 * X0_MM;
  const hcalIn = Math.max(cfg.hcal.rIn, ecalOut + 10);
  const hcalOut = hcalIn + cfg.hcal.depthLambda * LAMBDA_MM;
  const stations = cfg.muon.stations.map((s) => ({ r: s.r, halfLength: s.halfLength }));
  const st0 = stations[0]?.r ?? hcalOut + 1000;
  const coilR = Math.min(hcalOut + 500, (hcalOut + st0) / 2);
  const hcalHalf = cfg.ecal.halfLength * (hcalIn / cfg.ecal.rIn);
  return {
    bField: cfg.bField,
    tracker: cfg.trackerLayers.map((l) => ({ r: l.r, halfLength: l.halfLength })),
    ecal: { rIn: cfg.ecal.rIn, rOut: ecalOut, halfLength: cfg.ecal.halfLength, cell: 0.087 },
    hcal: { rIn: hcalIn, rOut: hcalOut, halfLength: hcalHalf, cell: 0.087 },
    solenoid: { r: coilR, halfLength: hcalHalf * 1.1 },
    muon: stations,
    outerFieldFactor: 1,
  };
}

/** Outermost radius of the detector (last muon station, else the coil, else the HCAL). */
export function outerRadius(g: DisplayGeometry): number {
  return Math.max(g.muon[g.muon.length - 1]?.r ?? 0, g.solenoid.r, g.hcal.rOut);
}
/** Largest half-length of the detector. */
export function outerHalfLength(g: DisplayGeometry): number {
  return Math.max(g.muon[g.muon.length - 1]?.halfLength ?? 0, g.solenoid.halfLength, g.hcal.halfLength);
}
/** Outermost tracker radius. */
export function trackerRadius(g: DisplayGeometry): number {
  return g.tracker.reduce((m, l) => Math.max(m, l.r), 0);
}
/** Largest tracker half-length. */
export function trackerHalfLength(g: DisplayGeometry): number {
  return g.tracker.reduce((m, l) => Math.max(m, l.halfLength), 0);
}

/**
 * Distance along the ray from the origin with pseudorapidity η to the surface of the cylinder of radius `r` and half-length
 * `halfLength` (whichever of the barrel surface or the end cap is reached first).
 */
export function faceDistance(eta: number, r: number, halfLength: number): number {
  const tBarrel = r * Math.cosh(eta); // r / sin θ, since sin θ = 1 / cosh η
  const th = Math.abs(Math.tanh(eta));
  const tz = th > 1e-9 ? halfLength / th : Infinity;
  return Math.min(tBarrel, tz);
}

/** The unit vector of direction (η, φ). */
export function direction(eta: number, phi: number): [number, number, number] {
  const ch = Math.cosh(eta);
  return [Math.cos(phi) / ch, Math.sin(phi) / ch, Math.tanh(eta)];
}

/** η and φ of a point (x, y, z) seen from the origin. */
export function etaPhiOf(x: number, y: number, z: number): { eta: number; phi: number } {
  const r = Math.hypot(x, y);
  return { eta: r === 0 ? (z >= 0 ? 10 : -10) : Math.asinh(z / r), phi: Math.atan2(y, x) };
}
