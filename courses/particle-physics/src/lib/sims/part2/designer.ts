/**
 * The detector designer of Chapter 7: a parametrised detector, a toy cost model and the measurements that the widget
 * shows, all from `hep/detector`.
 *
 * The cost model is a toy. Its shape follows how the real costs scale (a magnet's cost grows with its stored energy,
 * which goes as B² times the volume; silicon is paid for by area, crystals and absorber by volume), but the prices
 * are invented round numbers in "budget units", so that one design can be compared with another. It says nothing about what
 * any real detector cost.
 */
import { customise, deriveMuonMinP, ecalOuterRadius, hcalOuterRadius, presets, simulate, materials, type DetectorConfig } from '../../hep/detector/index.ts';
import type { FullEvent, TruthEvent, TruthParticle } from '../../hep/event/index.ts';
import { fromPtEtaPhiM } from '../../hep/kinematics/index.ts';
import { particle } from '../../hep/particles/index.ts';
import { rng as makeRng, type Rng } from '../../hep/random/index.ts';
import { circleFit } from '../../hep/reco/fit.ts';
import { reconstruct } from '../../hep/reco/reconstruct.ts';
import { hook } from '../../hep/hooks.ts';
import { K03, ptFromRadiusMm } from './trackMc.ts';

export interface DesignParams {
  /** Solenoid field (T). */
  B: number;
  /** Radius of the outermost tracker layer (mm). */
  trackerRadius: number;
  /** Number of strip layers between 250 mm and the outermost radius (there are always three pixel layers inside). */
  stripLayers: number;
  /** ECAL depth in radiation lengths. */
  ecalDepth: number;
  /** A crystal ECAL (fine but costly) or a sampling one (coarser and cheaper). */
  ecalType: 'crystal' | 'sampling';
  /** HCAL depth in nuclear interaction lengths (of iron). */
  hcalDepth: number;
}

/** The starting design: close to the course's `onion` detector. */
export const DEFAULT_DESIGN: DesignParams = { B: 3.8, trackerRadius: 1100, stripLayers: 4, ecalDepth: 25, ecalType: 'crystal', hcalDepth: 10 };

export const BUDGET = 100;

export const LIMITS = {
  B: { min: 0.5, max: 5, step: 0.1 },
  trackerRadius: { min: 500, max: 1500, step: 50 },
  stripLayers: { min: 2, max: 10, step: 1 },
  ecalDepth: { min: 10, max: 35, step: 1 },
  hcalDepth: { min: 4, max: 12, step: 0.5 },
} as const;

const PIXEL_RADII = [35, 70, 110];
const halfLengthFor = (r: number) => Math.min(3000, 6.05 * r);

/** The detector configuration of a design. */
export function buildConfig(p: DesignParams): DetectorConfig {
  const pix = PIXEL_RADII.map((r) => ({ r, halfLength: halfLengthFor(r), sigmaRPhi: 0.012, sigmaZ: 0.02, x0: 0.012, kind: 'pixel' as const }));
  const n = Math.max(1, Math.round(p.stripLayers));
  const first = 250;
  const last = Math.max(first + 50, p.trackerRadius);
  const strips = Array.from({ length: n }, (_, i) => {
    const r = n === 1 ? last : first + ((last - first) * i) / (n - 1);
    return { r: Math.round(r), halfLength: halfLengthFor(r), sigmaRPhi: 0.04, sigmaZ: 0.5, x0: 0.02, kind: 'strip' as const };
  });
  const crystal = p.ecalType === 'crystal';
  const ecal = {
    rIn: last + 190,
    depthX0: p.ecalDepth,
    halfLength: 3000,
    etaMax: 2.5,
    stochastic: crystal ? 0.027 : 0.1,
    constant: crystal ? 0.003 : 0.007,
    noise: crystal ? 0.015 : 0.03,
    cellEta: 0.0175,
    cellPhi: 0.0175,
    layers: 3,
  };
  const ecalOut = ecalOuterRadius({ ecal } as DetectorConfig);
  const hcal = { rIn: Math.round(ecalOut + 90), depthLambda: p.hcalDepth, stochastic: 1.0, constant: 0.05, noise: 0.02, cellEta: 0.087, cellPhi: 0.087, layers: 4, etaMax: 2.5 };
  const hcalOut = hcalOuterRadius({ hcal } as DetectorConfig);
  const stations = [700, 1700, 2700, 3700].map((d) => ({ r: Math.round(hcalOut + d), halfLength: 7000, sigmaRPhi: 0.3, sigmaZ: 1.5 }));
  return {
    name: 'designer',
    description: 'A design from the detector designer.',
    bField: p.B,
    trackerLayers: [...pix, ...strips],
    ecal,
    hcal,
    muon: { stations, returnField: -0.47 * p.B, minPToReach: deriveMuonMinP(ecal, hcal) },
    etaMax: 2.5,
    beamSpot: { sigmaZ: 50, sigmaXY: 0.015 },
    noiseHitsPerLayer: 1,
    deadFraction: 0.01,
  };
}

export interface CostBreakdown {
  tracker: number;
  magnet: number;
  ecal: number;
  hcal: number;
  muon: number;
  total: number;
  /** Stored magnetic energy in GJ (for the display). */
  storedEnergyGJ: number;
}

const MU0 = 4e-7 * Math.PI;
/** Divides the raw prices so that the default design costs about 80 of the 100 budget units. */
const COST_SCALE = 7;

/** The toy cost of a design, in budget units (the budget is `BUDGET`). */
export function cost(p: DesignParams): CostBreakdown {
  const cfg = buildConfig(p);
  // silicon: area in m² × price per m² (pixels dear, strips cheap), plus a small fixed cost per layer for services
  let tracker = 0;
  for (const l of cfg.trackerLayers) {
    const area = 2 * Math.PI * (l.r / 1000) * (2 * l.halfLength / 1000);
    tracker += area * (l.kind === 'pixel' ? 8 : 1.6) + 0.3;
  }
  // magnet: stored energy U = B²/(2 μ0) × volume of the coil, cost ∝ U^0.7
  const R = hcalOuterRadius(cfg) / 1000;
  const half = 3.0 * (R / 2.5); // the coil must enclose the calorimeter barrel: its half-length grows with its radius
  const volume = Math.PI * R * R * (2 * Math.min(Math.max(half, 3), 8));
  const U = ((p.B * p.B) / (2 * MU0)) * volume; // J
  const storedEnergyGJ = U / 1e9;
  const magnet = 60 * Math.pow(storedEnergyGJ, 0.7);
  // calorimeters: shell volume in m³ × price per m³
  const shell = (rIn: number, rOut: number) => Math.PI * ((rOut / 1000) ** 2 - (rIn / 1000) ** 2) * 2 * 3;
  const eOut = ecalOuterRadius(cfg);
  const ecal = shell(cfg.ecal.rIn, eOut) * (p.ecalType === 'crystal' ? 16 : 4.5);
  const hcal = shell(cfg.hcal.rIn, hcalOuterRadius(cfg)) * 0.6;
  // muon chambers: area of four stations
  let muon = 0;
  for (const s of cfg.muon.stations) muon += 2 * Math.PI * (s.r / 1000) * 12 * 0.025;
  const k = 1 / COST_SCALE;
  return { tracker: tracker * k, magnet: magnet * k, ecal: ecal * k, hcal: hcal * k, muon: muon * k, total: (tracker + magnet + ecal + hcal + muon) * k, storedEnergyGJ };
}

export interface Measurements {
  /** σ(pT)/pT for 100 GeV and 10 GeV muons (robust width of pT_true/pT_fit − 1, from circle fits to the hits). */
  ptRes100: number;
  ptRes10: number;
  /** σ/E and mean response for 50 GeV electrons (ECAL cells only: the fraction of the shower it contains) and 50 GeV pions (all cells). */
  eRes50: number;
  eResponse: number;
  hadRes50: number;
  hadResponse: number;
  /** Fraction of a 100 GeV pion's energy that is not seen in the calorimeters (leakage, from the response). */
  leakage100: number;
  /** The lowest muon momentum that reaches the muon stations (GeV). */
  muonMinP: number;
  /** Fraction of 100 GeV muons that leave hits in at least three muon stations. */
  muonEff100: number;
}

function truthOf(list: { pdg: number; pt: number; eta: number; phi: number }[]): TruthEvent {
  const particles: TruthParticle[] = list.map((s, i) => ({
    id: i,
    pdg: s.pdg,
    p: fromPtEtaPhiM(s.pt, s.eta, s.phi, particle(s.pdg).mass),
    vertex: [0, 0, 0],
    status: 'final',
    mothers: [],
    daughters: [],
    collision: 0,
  }));
  return { number: 0, weight: 1, process: 'particle gun', sqrtS: 13000, particles, primaryVertices: [[0, 0, 0]] };
}

function robustSigma(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  if (s.length < 3) return NaN;
  const q = (f: number) => s[Math.min(s.length - 1, Math.max(0, Math.round(f * (s.length - 1))))]!;
  return (q(0.8413) - q(0.1587)) / 2;
}
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);

/** The total energy in the calorimeter cells (of one calorimeter, or of both). */
function caloSum(cells: { energy: number; calo: 'ecal' | 'hcal' }[], which?: 'ecal' | 'hcal'): number {
  let s = 0;
  for (const c of cells) if (!which || c.calo === which) s += c.energy;
  return s;
}

/** σ(pT)/pT for muons of transverse momentum pT through the tracker of `cfg`. */
export function trackerResolution(cfg: DetectorConfig, pT: number, n: number, r: Rng): number {
  const fit = hook('reco.circleFit', circleFit);
  const dev: number[] = [];
  for (let i = 0; i < n; i++) {
    const pdg = i % 2 ? -13 : 13;
    const ev = truthOf([{ pdg, pt: pT, eta: -0.8 + 1.6 * r(), phi: -3 + 6 * r() }]);
    const det = simulate(ev, cfg, r);
    const hits = det.hits.filter((h) => h.truth === 0);
    if (hits.length < 5) continue;
    const res = fit(hits.map((h) => ({ x: h.x, y: h.y, sigma: cfg.trackerLayers[h.layer]!.sigmaRPhi })));
    dev.push(pT / ptFromRadiusMm(res.R, cfg.bField) - 1);
  }
  return robustSigma(dev);
}

/** Calorimeter resolution and response for particles of energy E (GeV). */
export function caloMeasurement(cfg: DetectorConfig, pdg: number, E: number, n: number, r: Rng, which?: 'ecal' | 'hcal'): { res: number; response: number } {
  const v: number[] = [];
  const m = particle(pdg).mass;
  for (let i = 0; i < n; i++) {
    const eta = -0.6 + 1.2 * r();
    const pt = Math.sqrt(E * E - m * m) / Math.cosh(eta);
    const det = simulate(truthOf([{ pdg, pt, eta, phi: -3 + 6 * r() }]), cfg, r);
    v.push(caloSum(det.cells, which));
  }
  const mu = mean(v);
  return { res: robustSigma(v) / mu, response: mu / E };
}

/** All the numbers the designer shows. `n` is the number of simulated particles per measurement (default 200; the calorimeter ones use half). */
export function measure(p: DesignParams, n = 200, seed = 1): Measurements {
  const cfg = buildConfig(p);
  const r = makeRng(seed);
  const ptRes100 = trackerResolution(cfg, 100, n, r.fork('100'));
  const ptRes10 = trackerResolution(cfg, 10, n, r.fork('10'));
  const e = caloMeasurement(cfg, 11, 50, Math.round(n / 2), r.fork('e'), 'ecal');
  const h = caloMeasurement(cfg, 211, 50, Math.round(n / 2), r.fork('h'));
  const h100 = caloMeasurement(cfg, 211, 100, Math.round(n / 2), r.fork('h100'));
  // muons at 100 GeV: how many leave hits in three or more stations
  const rm = r.fork('mu');
  let ok = 0;
  const nm = Math.round(n / 2);
  for (let i = 0; i < nm; i++) {
    const det = simulate(truthOf([{ pdg: i % 2 ? -13 : 13, pt: 100, eta: -0.8 + 1.6 * rm(), phi: -3 + 6 * rm() }]), cfg, rm);
    const st = new Set(det.muonHits.filter((x) => x.truth === 0).map((x) => x.station));
    if (st.size >= 3) ok++;
  }
  return {
    ptRes100,
    ptRes10,
    eRes50: e.res,
    eResponse: e.response,
    hadRes50: h.res,
    hadResponse: h.response,
    leakage100: Math.max(0, 1 - h100.response),
    muonMinP: cfg.muon.minPToReach,
    muonEff100: ok / nm,
  };
}

/** A complete simulated and reconstructed event with one particle, for the event display. */
export function gunEventFor(cfg: DetectorConfig, pdg: number, pt: number, eta: number, phi: number, seed: number): FullEvent {
  const truth = truthOf([{ pdg, pt, eta, phi }]);
  const r = makeRng(seed);
  const detector = simulate(truth, cfg, r);
  const reco = reconstruct(detector, cfg, {}, truth);
  return { truth, detector, reco, weight: 1 };
}

export { customise, presets, materials, K03 };
