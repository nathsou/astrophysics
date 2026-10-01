/**
 * Calorimeter energy calibration against the detector simulation: test-beam style. Photons of known energy fix the ECAL
 * scale (the cells lose a few per cent of a shower below their noise thresholds); charged pions of known energy, whose
 * energy is shared between both calorimeters, fix the HCAL scale once the ECAL part is corrected.
 */
import type { DetectorConfig } from '../detector/index.ts';
import { simulate } from '../detector/index.ts';
import { rng } from '../random/index.ts';
import { clusterCells } from './calo.ts';
import type { RecoConfig } from './config.ts';
import { resolveConfig } from './config.ts';
import { geometryFromConfig, type RecoGeometry } from './geometry.ts';
import { truthEventFrom } from './synthetic.ts';

export interface Calibration {
  /** Multiply ECAL / HCAL cluster energies by these. */
  ecal: number;
  hcal: number;
  /** Number of showers used and the energies (GeV). */
  n: number;
}

/**
 * Derive the calorimeter scales of a detector configuration: simulate `n` photons (energy `energy` GeV, flat in |η| < 1)
 * and `n` charged pions, cluster them with scale 1, and return the factors that bring the mean back to the true energy.
 * Deterministic (a fixed seed).
 */
export function calibrateCalorimeters(cfg: DetectorConfig, opts: { n?: number; energy?: number; rc?: Partial<RecoConfig> } = {}): Calibration {
  const n = opts.n ?? 40;
  const E = opts.energy ?? 30;
  const base = geometryFromConfig(cfg);
  const unit: RecoGeometry = { ...base, ecal: { ...base.ecal, scale: 1 }, hcal: { ...base.hcal, scale: 1 } };
  const rc = resolveConfig(opts.rc);
  const g = rng(20240101);
  let eSum = 0, eN = 0;
  let hadE = 0, hadH = 0, hN = 0;
  for (let k = 0; k < n; k++) {
    const eta = (2 * g() - 1) * 1.0;
    const phi = (2 * g() - 1) * Math.PI;
    const gam = simulate(truthEventFrom([{ pdg: 22, pt: E / Math.cosh(eta), eta, phi }]), cfg, g.fork('gam' + k));
    // skip conversions: a track in the tracker means part of the energy left as charged particles
    if (!gam.hits.some((h) => h.truth >= 0)) {
      const cl = clusterCells(gam.cells, unit, rc).filter((c) => c.calo === 'ecal');
      eSum += cl.reduce((a, c) => a + c.energy, 0);
      eN++;
    }
    const pi = simulate(truthEventFrom([{ pdg: 211, pt: E / Math.cosh(eta), eta, phi }]), cfg, g.fork('pi' + k));
    const cl = clusterCells(pi.cells, unit, rc);
    hadE += cl.filter((c) => c.calo === 'ecal').reduce((a, c) => a + c.energy, 0);
    hadH += cl.filter((c) => c.calo === 'hcal').reduce((a, c) => a + c.energy, 0);
    hN++;
  }
  const ecal = eN > 0 && eSum > 0 ? (eN * E) / eSum : 1;
  const kin = Math.sqrt(E * E + 0.13957 ** 2) - 0.13957;
  const hcal = hN > 0 && hadH > 0 ? Math.max(0.5, Math.min(2, (kin - (ecal * hadE) / hN) / (hadH / hN))) : 1;
  return { ecal, hcal, n };
}

/** A copy of the geometry with the calorimeter scales multiplied by the calibration. */
export function applyCalibration(geom: RecoGeometry, cal: Calibration): RecoGeometry {
  return { ...geom, ecal: { ...geom.ecal, scale: geom.ecal.scale * cal.ecal }, hcal: { ...geom.hcal, scale: geom.hcal.scale * cal.hcal } };
}

const geomCache = new WeakMap<object, RecoGeometry>();

/**
 * The geometry for a configuration. A `DetectorConfig` is calibrated once (with `calibrateCalorimeters`, if
 * `rc.autoCalibrate` is not false) and the result remembered, so repeated calls return the same object; a `RecoGeometry`
 * is used as given.
 */
export function calibratedGeometry(cfg: DetectorConfig | RecoGeometry, rc?: Partial<RecoConfig>): RecoGeometry {
  const conf = resolveConfig(rc);
  if (!conf.autoCalibrate || !('trackerLayers' in cfg)) return geometryFromConfig(cfg);
  let g = geomCache.get(cfg);
  if (!g) {
    const cal = calibrateCalorimeters(cfg, { rc });
    g = applyCalibration(geometryFromConfig(cfg), cal);
    geomCache.set(cfg, g);
  }
  return g;
}
