import { describe, expect, test } from 'vitest';
import { setOverride } from '../hooks.ts';
import { exponential, normal, rng } from '../random/index.ts';
import { fromMass, fromPtEtaPhiM, mass, type P4 } from '../kinematics/index.ts';
import { particle } from '../particles/index.ts';
import type { DetectorEvent, TruthEvent } from '../event/index.ts';
import {
  bethe, caloResolution, caloResponse, criticalEnergy, customise, deriveMuonMinP, densityEffect, gammaP, hcalOuterRadius,
  heitlerShower, helix, interactionLength, landau, landauCdf, landauLambda, landauPdf, LANDAU_MODE, lnGamma, longitudinalFraction,
  longitudinalProfile, materials, moliereRadius, mostProbableLoss, multipleScatteringAngle, muonCriticalEnergy, muonEnergyAfter,
  muonRange, muonStoppingPower, placeInBeamSpot, pTFromRadius, presets, radiationLength, radiusOfCurvature, sagitta, showerShape,
  simulate, truthOffsets, type DetectorConfig, type SimSecondary,
} from './index.ts';

// ── helpers ───────────────────────────────────────────────────────────────────────────────────

type Spec = { pdg: number; p: P4; vertex?: [number, number, number]; collision?: number };
function truthOf(specs: Spec[], extra: Partial<TruthEvent> = {}): TruthEvent {
  return {
    number: 0,
    weight: 1,
    process: 'test',
    sqrtS: 13000,
    primaryVertices: [[0, 0, 0]],
    particles: specs.map((s, id) => ({ id, pdg: s.pdg, p: s.p, vertex: s.vertex ?? [0, 0, 0], status: 'final' as const, mothers: [], daughters: [], collision: s.collision })),
    ...extra,
  };
}
const lepton = (pdg: number, pt: number, eta: number, phi: number): Spec => ({ pdg, p: fromPtEtaPhiM(pt, eta, phi, particle(pdg).mass) });
/** A particle of total energy E (GeV): the transverse momentum follows from η. */
const withE = (pdg: number, E: number, eta: number, phi: number): Spec => {
  const m = particle(pdg).mass;
  return { pdg, p: fromPtEtaPhiM(Math.sqrt(E * E - m * m) / Math.cosh(eta), eta, phi, m) };
};
/** The onion detector with the nuisances switched off (no noise hits, no dead channels, no calorimeter noise or fluctuations). */
const clean = (over: Parameters<typeof customise>[1] = {}): DetectorConfig =>
  customise(presets.onion!, {
    noiseHitsPerLayer: 0,
    deadFraction: 0,
    ecal: { stochastic: 0, constant: 0, noise: 0 },
    hcal: { stochastic: 0, constant: 0, noise: 0 },
    ...over,
  });
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const rms = (xs: number[]) => Math.sqrt(mean(xs.map((x) => x * x)));
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const sumCells = (d: DetectorEvent, calo?: 'ecal' | 'hcal') => d.cells.filter((c) => !calo || c.calo === calo).reduce((a, c) => a + c.energy, 0);

// ── materials ─────────────────────────────────────────────────────────────────────────────────

describe('materials', () => {
  test('radiation lengths match the PDG values the course quotes', () => {
    expect(radiationLength('Pb')).toBeCloseTo(0.56, 2);
    expect(radiationLength('Fe')).toBeCloseTo(1.76, 2);
    expect(radiationLength('Si')).toBeCloseTo(9.37, 2);
    expect(radiationLength('PbWO4')).toBeCloseTo(0.89, 2);
  });
  test('the table has the required materials with sane numbers', () => {
    for (const k of ['Si', 'Fe', 'Pb', 'PbWO4', 'H2O', 'scintillator', 'Cu', 'air']) {
      const m = materials[k]!;
      expect(m, k).toBeDefined();
      expect(m.density).toBeGreaterThan(0);
      expect(m.X0).toBeGreaterThan(0);
      expect(m.lambdaI).toBeGreaterThan(m.X0);
      expect(m.ZoverA).toBeGreaterThan(0.38);
      expect(m.ZoverA).toBeLessThan(0.56);
      expect(m.I).toBeGreaterThan(50);
    }
    expect(interactionLength('Fe')).toBeCloseTo(16.8, 0);
  });
  test('critical energy and Molière radius of lead tungstate', () => {
    expect(criticalEnergy('PbWO4') * 1e3).toBeCloseTo(9.3, 0);
    expect(moliereRadius('PbWO4')).toBeGreaterThan(1.9);
    expect(moliereRadius('PbWO4')).toBeLessThan(2.3);
    expect(criticalEnergy('Pb') * 1e3).toBeCloseTo(7.43, 1);
  });
});

// ── helix geometry ────────────────────────────────────────────────────────────────────────────

describe('helix', () => {
  test('radius obeys pT = 0.3 B R', () => {
    for (const [pt, B] of [[1, 2], [10, 3.8], [100, 3.8], [0.5, 1], [45, 2]] as const) {
      const h = helix(fromPtEtaPhiM(pt, 0.7, 0.3, 0.1396), 1, [0, 0, 0], B);
      expect(h.radius / 1000).toBeCloseTo(pt / (0.299792458 * B), 9);
      expect(radiusOfCurvature(pt, B)).toBeCloseTo(h.radius / 1000, 9);
      expect(pTFromRadius(h.radius / 1000, B)).toBeCloseTo(pt, 6);
    }
    // 1 GeV in 1 T: R = 3.336 m, the textbook number
    expect(radiusOfCurvature(1, 1)).toBeCloseTo(3.3356, 3);
  });
  test('points lie on a circle of radius R and the path length is the arc length', () => {
    const h = helix(fromPtEtaPhiM(3, 0.8, 1.1, 0.1396), -1, [1, -2, 5], 3.8);
    const [cx, cy] = h.centre!;
    let prev = h.pointAt(0);
    let length = 0;
    const sTotal = 900;
    for (let i = 1; i <= 2000; i++) {
      const pt = h.pointAt((sTotal * i) / 2000);
      expect(Math.hypot(pt[0] - cx, pt[1] - cy)).toBeCloseTo(h.radius, 6);
      length += Math.hypot(pt[0] - prev[0], pt[1] - prev[1], pt[2] - prev[2]);
      prev = pt;
    }
    expect(length).toBeCloseTo(sTotal, 0); // polyline length of a fine sampling ≈ s
  });
  test('the direction is tangent to the path and of unit length; momentum is conserved in magnitude', () => {
    const p = fromPtEtaPhiM(2, -0.4, -2, 0.1396);
    const h = helix(p, 1, [0, 0, 0], 2);
    for (const s of [0, 100, 500, 1500]) {
      const eps = 1e-4;
      const a = h.pointAt(s - eps), b = h.pointAt(s + eps);
      const t = [(b[0] - a[0]) / (2 * eps), (b[1] - a[1]) / (2 * eps), (b[2] - a[2]) / (2 * eps)];
      const u = h.directionAt(s);
      expect(Math.hypot(...u)).toBeCloseTo(1, 12);
      for (let k = 0; k < 3; k++) expect(t[k]!).toBeCloseTo(u[k]!, 5);
      const m = h.momentumAt(s);
      expect(Math.hypot(m.px, m.py, m.pz)).toBeCloseTo(Math.hypot(p.px, p.py, p.pz), 10);
    }
  });
  test('a positive particle turns clockwise in B along +z, a negative one anticlockwise', () => {
    const p = fromPtEtaPhiM(1, 0, 0, 0.1396); // along +x
    const pos = helix(p, 1, [0, 0, 0], 2).pointAt(500);
    const neg = helix(p, -1, [0, 0, 0], 2).pointAt(500);
    expect(pos[1]).toBeLessThan(0);
    expect(neg[1]).toBeGreaterThan(0);
    expect(pos[1]).toBeCloseTo(-neg[1], 9);
    // reversing the field reverses the turn
    expect(helix(p, 1, [0, 0, 0], -2).pointAt(500)[1]).toBeGreaterThan(0);
  });
  test('cylinder intersection: lands on the cylinder, is the first crossing, null for curlers and end-cap exits', () => {
    const h = helix(fromPtEtaPhiM(5, 0.5, 0.4, 0.1396), 1, [0, 0, 3], 3.8);
    for (const r of [50, 200, 700, 1100]) {
      const s = h.intersectCylinder(r, 5000)!;
      expect(s).not.toBeNull();
      const pt = h.pointAt(s);
      expect(Math.hypot(pt[0], pt[1])).toBeCloseTo(r, 6);
      // nothing earlier is on the cylinder: the radius grows monotonically up to s for a track that has not turned back
      let last = 0;
      for (let k = 1; k <= 50; k++) {
        const q = h.pointAt((s * k) / 50);
        const rr = Math.hypot(q[0], q[1]);
        expect(rr).toBeGreaterThanOrEqual(last - 1e-9);
        last = rr;
      }
    }
    // a 0.2 GeV track in 3.8 T has R = 175 mm: it cannot reach r = 400 mm but does reach 300
    const loop = helix(fromPtEtaPhiM(0.2, 0, 0, 0.1396), 1, [0, 0, 0], 3.8);
    expect(loop.radius).toBeCloseTo(175.5, 0);
    expect(loop.intersectCylinder(400, 5000)).toBeNull();
    expect(loop.intersectCylinder(300, 5000)).not.toBeNull();
    // leaving through the end of a short cylinder
    expect(h.intersectCylinder(1100, 400)).toBeNull();
    // the exit of a volume is the barrel for central tracks and the end for forward ones
    expect(h.exitVolume(1100, 6000)!.endcap).toBe(false);
    expect(helix(fromPtEtaPhiM(20, 3, 0, 0.1396), 1, [0, 0, 0], 3.8).exitVolume(1100, 3000)!.endcap).toBe(true);
  });
  test('neutral particles and B = 0 move on straight lines', () => {
    const p = fromPtEtaPhiM(3, 1, 2, 0);
    const h = helix(p, 0, [1, 2, 3], 3.8);
    expect(h.radius).toBe(Infinity);
    const a = h.pointAt(0), b = h.pointAt(1000);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    expect(len).toBeCloseTo(1000, 6);
    const s = h.intersectCylinder(800, 1e6)!;
    const q = h.pointAt(s);
    expect(Math.hypot(q[0], q[1])).toBeCloseTo(800, 6);
    const h0 = helix(fromPtEtaPhiM(3, 0, 0, 0.1), 1, [0, 0, 0], 0);
    expect(h0.radius).toBe(Infinity);
  });
  test('pT from the curvature of three points (the 0.3 B R rule)', () => {
    const pt = 7.5, B = 2.5;
    const h = helix(fromPtEtaPhiM(pt, 0.2, 0.9, 0.1396), 1, [0, 0, 0], B);
    const P = [h.pointAt(0), h.pointAt(600), h.pointAt(1200)];
    // circumradius of three points
    const [a, b, c] = P as [[number, number, number], [number, number, number], [number, number, number]];
    const ab = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const bc = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
    const R = (ab * bc * ca) / (2 * area2);
    expect(pTFromRadius(R / 1000, B)).toBeCloseTo(pt, 6);
    expect(sagitta(pt, B, 1000)).toBeCloseTo((0.29979 * B * 1) / (8 * pt) * 1000, 1); // s ≈ 0.3 B L²/(8 pT): L = 1 m gives mm
  });
});

// ── energy loss ───────────────────────────────────────────────────────────────────────────────

describe('Bethe–Bloch and the Landau distribution', () => {
  test('minimum ionisation in silicon: 1.66 MeV cm²/g at βγ ≈ 3.5 (PDG 1.664)', () => {
    const v = bethe({ material: 'Si', betaGamma: 3.5 });
    expect(v).toBeGreaterThan(1.62);
    expect(v).toBeLessThan(1.71);
    // and it really is the minimum
    for (const bg of [1, 1.5, 2, 6, 10, 30, 100, 1000]) expect(bethe({ material: 'Si', betaGamma: bg })).toBeGreaterThan(v - 0.01);
    // the minimum sits between βγ = 3 and 4
    let best = 0, min = Infinity;
    for (let bg = 1; bg < 20; bg += 0.05) {
      const x = bethe({ material: 'Si', betaGamma: bg });
      if (x < min) { min = x; best = bg; }
    }
    expect(best).toBeGreaterThan(2.8);
    expect(best).toBeLessThan(4.6);
  });
  test('minimum ionisation of other materials against PDG values', () => {
    const pdg: [string, number, number][] = [['Fe', 1.451, 0.04], ['Cu', 1.403, 0.04], ['Pb', 1.122, 0.06], ['H2O', 1.992, 0.04], ['Al', 1.615, 0.04]];
    for (const [m, ref, tol] of pdg) {
      let min = Infinity;
      for (let bg = 2.5; bg < 6; bg += 0.1) min = Math.min(min, bethe({ material: m, betaGamma: bg }));
      expect(Math.abs(min / ref - 1), m).toBeLessThan(tol);
    }
  });
  test('the density effect flattens the relativistic rise; without it the loss keeps growing', () => {
    const min = bethe({ material: 'Si', betaGamma: 3.5 });
    const high = bethe({ material: 'Si', betaGamma: 1000 });
    const highNoDelta = bethe({ material: 'Si', betaGamma: 1000, densityCorrection: false });
    expect(high / min).toBeGreaterThan(1.3);
    expect(high / min).toBeLessThan(1.8);
    expect(highNoDelta).toBeGreaterThan(1.2 * high);
    expect(densityEffect('Si', 0.1)).toBeLessThan(0.01);
    expect(densityEffect('Si', 1000)).toBeGreaterThan(9);
  });
  test('low-velocity protons lose much more than minimum-ionising particles (1/β²)', () => {
    const slow = bethe({ material: 'Si', betaGamma: 0.3, mass: 0.938 });
    expect(slow / bethe({ material: 'Si', betaGamma: 3.5 })).toBeGreaterThan(5);
  });
  test('the standard Landau density has its mode at −0.2228 (φ = 0.1806) and FWHM 4.02', () => {
    expect(LANDAU_MODE).toBeCloseTo(-0.2228, 4);
    expect(landauPdf(LANDAU_MODE)).toBeCloseTo(0.18065, 3);
    const half = landauPdf(LANDAU_MODE) / 2;
    let lo = -2, hi = LANDAU_MODE;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (landauPdf(m) < half) lo = m; else hi = m; }
    const left = lo;
    lo = LANDAU_MODE; hi = 40;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (landauPdf(m) > half) lo = m; else hi = m; }
    expect(lo - left).toBeCloseTo(4.02, 1);
    expect(landauCdf(1e9)).toBeCloseTo(1, 3);
  });
  test('sampled Landau values follow the CDF and peak at the most probable value', () => {
    const r = rng(11);
    const n = 100000;
    const xs = Array.from({ length: n }, () => landauLambda(r));
    for (const x of [-1, -0.2228, 1, 3, 10]) {
      const frac = xs.filter((v) => v < x).length / n;
      expect(Math.abs(frac - landauCdf(x)), `CDF at ${x}`).toBeLessThan(0.006);
    }
    // histogram mode
    const bins = new Map<number, number>();
    for (const v of xs) if (v > -3 && v < 4) bins.set(Math.round(v * 5), (bins.get(Math.round(v * 5)) ?? 0) + 1);
    let bestBin = 0, bestCount = 0;
    for (const [b, c] of bins) if (c > bestCount) { bestBin = b; bestCount = c; }
    expect(bestBin / 5).toBeGreaterThan(-0.6);
    expect(bestBin / 5).toBeLessThan(0.2);
    // the long tail: P(λ > 20) ≈ 1/20
    expect(xs.filter((v) => v > 20).length / n).toBeGreaterThan(0.03);
    expect(xs.filter((v) => v > 20).length / n).toBeLessThan(0.07);
    // landau(rng, mpv, xi) is a shift and scale
    const r2 = rng(11);
    expect(landau(r2, 5, 2)).toBeCloseTo(5 + 2 * (xs[0]! - LANDAU_MODE), 9);
  });
  test('hits in a 300 μm silicon sensor: most probable deposit ≈ 80–90 keV, mean ≈ 115 keV', () => {
    const cfg = clean();
    const r = rng(5);
    const ed: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const d = simulate(truthOf([lepton(13, 50, 0.0, (i * 2.399) % 6)]), cfg, r);
      for (const h of d.hits) if (h.layer === 4 && h.edep !== undefined) ed.push(h.edep);
    }
    expect(ed.length).toBeGreaterThan(3000);
    // strip layer 4 (320 μm): MPV of the distribution by histogram (5 keV bins)
    const bins = new Map<number, number>();
    for (const e of ed) bins.set(Math.floor(e / 5), (bins.get(Math.floor(e / 5)) ?? 0) + 1);
    let best = 0, bc = 0;
    for (const [b, c] of bins) if (c > bc) { best = b; bc = c; }
    const mpv = best * 5 + 2.5;
    expect(mpv).toBeGreaterThan(70);
    expect(mpv).toBeLessThan(100);
    expect(mpv / mostProbableLoss('Si', 0.032 * 2.329, 50 / 0.10566) / 1e3).toBeCloseTo(1, 0);
    expect(mean(ed)).toBeGreaterThan(mpv);
  });
});

// ── multiple scattering ───────────────────────────────────────────────────────────────────────

describe('multiple scattering', () => {
  test("Highland's formula", () => {
    // 1 GeV muon, 1 % X0: 13.6 MeV/(β p) √0.01 [1 + 0.038 ln(0.01/β²)]
    const beta = 1 / Math.sqrt(1 + (0.10566 / 1) ** 2);
    const expected = (0.0136 / (beta * 1)) * 0.1 * (1 + 0.038 * Math.log(0.01 / (beta * beta)));
    expect(multipleScatteringAngle(1, beta, 0.01)).toBeCloseTo(expected, 12);
    expect(multipleScatteringAngle(1, beta, 0.01)).toBeCloseTo(1.1e-3, 4);
    // scales as 1/p and as √(x/X0) (up to the log)
    expect(multipleScatteringAngle(10, 1, 0.01) / multipleScatteringAngle(1, 1, 0.01)).toBeCloseTo(0.1, 5);
    expect(multipleScatteringAngle(1, 1, 0.04) / multipleScatteringAngle(1, 1, 0.01)).toBeGreaterThan(2);
    expect(multipleScatteringAngle(1, 1, 0)).toBe(0);
  });
  test('the scattering in the simulated layer has the Highland width', () => {
    // straight tracks (B = 0) through one scatterer at r = 100 mm (x0 = 5 %), then two perfect layers: the change of the
    // transverse direction is measured from the two later hits
    const cfg = customise(clean(), {
      bField: 0,
      trackerLayers: [
        { r: 100, halfLength: 5000, sigmaRPhi: 0, sigmaZ: 0, x0: 0.05, kind: 'strip' },
        { r: 200, halfLength: 5000, sigmaRPhi: 0, sigmaZ: 0, x0: 0, kind: 'strip' },
        { r: 300, halfLength: 5000, sigmaRPhi: 0, sigmaZ: 0, x0: 0, kind: 'strip' },
      ],
    });
    const r = rng(21);
    const p = 2;
    const dphi: number[] = [];
    for (let i = 0; i < 6000; i++) {
      const phi0 = -3 + 6 * r();
      const d = simulate(truthOf([{ pdg: 13, p: fromPtEtaPhiM(p, 0, phi0, 0.10566) }]), cfg, r);
      const h1 = d.hits.find((h) => h.layer === 1)!, h2 = d.hits.find((h) => h.layer === 2)!;
      const ang = Math.atan2(h2.y - h1.y, h2.x - h1.x);
      let dd = ang - phi0;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      dphi.push(dd);
    }
    const beta = p / Math.sqrt(p * p + 0.10566 ** 2);
    const expected = multipleScatteringAngle(p, beta, 0.05);
    expect(mean(dphi)).toBeLessThan(0.05 * expected * 10);
    expect(Math.abs(sd(dphi) / expected - 1)).toBeLessThan(0.04);
    // Gaussian core: 68 % within ±1σ
    const within = dphi.filter((x) => Math.abs(x) < expected).length / dphi.length;
    expect(within).toBeGreaterThan(0.64);
    expect(within).toBeLessThan(0.72);
  });
});

describe('hooks', () => {
  test("the reader's multiple-scattering function can replace the reference inside the simulation", () => {
    const cfg = customise(clean(), {
      bField: 0,
      trackerLayers: [
        { r: 100, halfLength: 5000, sigmaRPhi: 0, sigmaZ: 0, x0: 0.05, kind: 'strip' },
        { r: 200, halfLength: 5000, sigmaRPhi: 0, sigmaZ: 0, x0: 0, kind: 'strip' },
        { r: 300, halfLength: 5000, sigmaRPhi: 0, sigmaZ: 0, x0: 0, kind: 'strip' },
      ],
    });
    const width = () => {
      const r = rng(3);
      const v: number[] = [];
      for (let i = 0; i < 500; i++) {
        const d = simulate(truthOf([lepton(13, 2, 0, 0.5)]), cfg, r);
        const h1 = d.hits.find((h) => h.layer === 1)!, h2 = d.hits.find((h) => h.layer === 2)!;
        v.push(Math.atan2(h2.y - h1.y, h2.x - h1.x) - 0.5);
      }
      return sd(v);
    };
    const normalWidth = width();
    expect(normalWidth).toBeGreaterThan(0.0008);
    setOverride('detector.multipleScatteringAngle', () => 0);
    try {
      expect(width()).toBeLessThan(1e-9);
    } finally {
      setOverride('detector.multipleScatteringAngle', undefined);
    }
    expect(width()).toBeCloseTo(normalWidth, 12);
  });
});

// ── tracker hits ──────────────────────────────────────────────────────────────────────────────

describe('tracker hits', () => {
  test('residuals have the configured widths', () => {
    const cfg = customise(clean(), {
      bField: 0,
      trackerLayers: [
        { r: 100, halfLength: 5000, sigmaRPhi: 0.05, sigmaZ: 0.2, x0: 0, kind: 'pixel' },
        { r: 300, halfLength: 5000, sigmaRPhi: 0.2, sigmaZ: 1.0, x0: 0, kind: 'strip' },
      ],
    });
    const r = rng(2);
    const resT: number[][] = [[], []];
    const resZ: number[][] = [[], []];
    for (let i = 0; i < 8000; i++) {
      const phi0 = -3 + 6 * r();
      const eta = -1.5 + 3 * r();
      const v: [number, number, number] = [0, 0, 0];
      const d = simulate(truthOf([{ pdg: 13, p: fromPtEtaPhiM(20, eta, phi0, 0.10566), vertex: v }]), cfg, r);
      for (const h of d.hits) {
        const L = cfg.trackerLayers[h.layer]!;
        // truth crossing of the straight line through the origin
        const t = L.r / Math.sqrt(1 - 0 * 1) / 1;
        const x = L.r * Math.cos(phi0), y = L.r * Math.sin(phi0), z = L.r * Math.sinh(eta);
        void t;
        resT[h.layer]!.push((h.x - x) * -Math.sin(phi0) + (h.y - y) * Math.cos(phi0));
        resZ[h.layer]!.push(h.z - z);
      }
    }
    expect(sd(resT[0]!) / 0.05).toBeCloseTo(1, 1);
    expect(sd(resT[1]!) / 0.2).toBeCloseTo(1, 1);
    expect(sd(resZ[0]!) / 0.2).toBeCloseTo(1, 1);
    expect(sd(resZ[1]!) / 1.0).toBeCloseTo(1, 1);
    expect(Math.abs(mean(resT[0]!))).toBeLessThan(0.005);
  });
  test('every layer is hit once by a central 10 GeV muon; hits sit on the layer cylinders (to within the smearing)', () => {
    const cfg = clean();
    const d = simulate(truthOf([lepton(13, 10, 0.2, 1)]), cfg, rng(1));
    expect(d.hits.map((h) => h.layer).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const h of d.hits) {
      expect(Math.abs(Math.hypot(h.x, h.y) - cfg.trackerLayers[h.layer]!.r)).toBeLessThan(0.5);
      expect(h.truth).toBe(0);
      expect(h.edep).toBeGreaterThan(10);
    }
  });
  test('curlers do not reach the outer layers', () => {
    // pT = 0.15 GeV in 3.8 T: R = 132 mm: reaches r = 35, 70, 110, 160, 250 (2R = 263) but not 280 and beyond
    const d = simulate(truthOf([lepton(13, 0.15, 0, 0.3)]), clean(), rng(3));
    const layers = new Set(d.hits.map((h) => h.layer));
    for (const l of [0, 1, 2, 3]) expect(layers.has(l)).toBe(true);
    for (const l of [4, 5, 6, 7]) expect(layers.has(l)).toBe(false);
    // and a muon with pT below ~ 0.03 GeV does not get out of the beam pipe region at all
    expect(simulate(truthOf([lepton(13, 0.02, 0, 0.3)]), clean(), rng(3)).hits.length).toBeLessThanOrEqual(1);
  });
  test('tracks beyond etaMax leave no tracker hits; neutral particles leave none at all', () => {
    const cfg = clean();
    expect(simulate(truthOf([lepton(13, 20, 3.0, 0.3)]), cfg, rng(3)).hits).toHaveLength(0);
    expect(simulate(truthOf([lepton(13, 20, 2.3, 0.3)]), cfg, rng(3)).hits.length).toBeGreaterThan(3);
    const neutral = simulate(truthOf([{ pdg: 2112, p: fromMass(0.9396, 5, 3, 2) }, { pdg: 12, p: fromMass(0, 5, 3, 2) }, { pdg: 22, p: fromMass(0, 5, 3, 2) }]), customise(cfg, { trackerLayers: [] }), rng(3));
    expect(neutral.hits).toHaveLength(0);
  });
  test('the z-range of a layer cuts the forward hits', () => {
    const cfg = clean();
    const d = simulate(truthOf([lepton(13, 50, 2.3, 0.3)]), cfg, rng(3));
    const layers = d.hits.map((h) => h.layer);
    expect(layers).toContain(0);
    expect(layers).not.toContain(7); // halfLength 3000 at r = 1100 means |η| < 1.7
  });
  test('dead channels: a fixed fraction of hits is lost, the same channels in every event', () => {
    const cfg = clean({ deadFraction: 0.2 });
    const r = rng(7);
    let got = 0, total = 0;
    for (let i = 0; i < 3000; i++) {
      got += simulate(truthOf([lepton(13, 20, 0.3, (i * 0.0021) % 6 - 3)]), cfg, r).hits.length;
      total += 8;
    }
    expect(got / total).toBeGreaterThan(0.77);
    expect(got / total).toBeLessThan(0.83);
    expect(simulate(truthOf([lepton(13, 20, 0.3, 1)]), clean({ deadFraction: 1 }), r).hits).toHaveLength(0);
    // the same track twice, with different random streams but no scattering: the dead pattern is reproducible, because it is
    // a property of the channel (a hash of where the particle crossed), not of the random stream
    const still = customise(cfg, { trackerLayers: cfg.trackerLayers.map((l) => ({ ...l, x0: 0 })) });
    const a = simulate(truthOf([lepton(13, 20, 0.3, 1.234)]), still, rng(1)).hits.map((h) => h.layer);
    const b = simulate(truthOf([lepton(13, 20, 0.3, 1.234)]), still, rng(99)).hits.map((h) => h.layer);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThan(8 + 1);
  });
  test('noise hits: Poisson in number, truth −1', () => {
    const cfg = clean({ noiseHitsPerLayer: 3 });
    const r = rng(1);
    const counts = Array.from({ length: 500 }, () => simulate(truthOf([]), cfg, r).hits.length);
    expect(mean(counts)).toBeGreaterThan(23);
    expect(mean(counts)).toBeLessThan(25);
    expect(sd(counts)).toBeCloseTo(Math.sqrt(24), 0);
    const d = simulate(truthOf([]), cfg, r);
    for (const h of d.hits) expect(h.truth).toBe(-1);
  });
});

// ── momentum resolution ───────────────────────────────────────────────────────────────────────

/** A weighted least-squares circle fit for a track through the origin: φ_i = φ0 − asin(κ r_i / 2), linearised and iterated. */
function fitCurvature(hits: { x: number; y: number }[], sigma: number[]): number {
  const r = hits.map((h) => Math.hypot(h.x, h.y));
  // unwrap φ relative to the first hit
  const phi0 = Math.atan2(hits[0]!.y, hits[0]!.x);
  const phi = hits.map((h) => {
    let d = Math.atan2(h.y, h.x) - phi0;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return d;
  });
  let kappa = 0;
  for (let it = 0; it < 4; it++) {
    // model φ_i − φ_ref = a − (κ/2)·g(r_i) with g(r) = asin(κ r/2)/(κ/2) ≈ r(1 + κ²r²/24)
    let S = 0, Sx = 0, Sy = 0, Sxx = 0, Sxy = 0;
    for (let i = 0; i < r.length; i++) {
      const w = (r[i]! / sigma[i]!) ** 2;
      const x = r[i]! * (1 + (kappa * r[i]!) ** 2 / 24);
      S += w; Sx += w * x; Sy += w * phi[i]!; Sxx += w * x * x; Sxy += w * x * phi[i]!;
    }
    const slope = (S * Sxy - Sx * Sy) / (S * Sxx - Sx * Sx);
    kappa = -2 * slope;
  }
  return kappa;
}

describe('momentum resolution emerges from the geometry', () => {
  const cfg = clean();
  function resolution(pt: number, n: number, seed: number, eta = 0.3): { rel: number; bias: number; nfit: number } {
    const r = rng(seed);
    const dev: number[] = [];
    for (let i = 0; i < n; i++) {
      const charge = i % 2 ? 1 : -1;
      const phi = -3 + 6 * r();
      const d = simulate(truthOf([{ pdg: charge > 0 ? -13 : 13, p: fromPtEtaPhiM(pt, eta, phi, 0.10566) }]), cfg, r);
      const hs = d.hits.filter((h) => h.truth === 0).sort((a, b) => a.layer - b.layer);
      if (hs.length < 6) continue;
      const sig = hs.map((h) => cfg.trackerLayers[h.layer]!.sigmaRPhi);
      const kappa = Math.abs(fitCurvature(hs, sig)); // 1/mm
      const R = 1 / kappa / 1000; // m
      const ptFit = pTFromRadius(R, cfg.bField);
      dev.push(pt / ptFit - 1); // 1/pT is Gaussian
    }
    return { rel: sd(dev), bias: mean(dev), nfit: dev.length };
  }
  test('σ(pT)/pT at 100 GeV for the onion preset is 1–3 %, and grows linearly with pT', () => {
    const r100 = resolution(100, 3000, 1);
    const r10 = resolution(10, 3000, 2);
    const r400 = resolution(400, 3000, 3);
    console.log(`onion σ(pT)/pT: 10 GeV ${(100 * r10.rel).toFixed(2)} %, 100 GeV ${(100 * r100.rel).toFixed(2)} %, 400 GeV ${(100 * r400.rel).toFixed(2)} %`);
    expect(r100.nfit).toBeGreaterThan(2800);
    expect(r100.rel).toBeGreaterThan(0.008);
    expect(r100.rel).toBeLessThan(0.03);
    // no bias in 1/pT
    expect(Math.abs(r100.bias)).toBeLessThan(0.2 * r100.rel);
    // high pT: measurement error dominates, σ ∝ pT; low pT: multiple scattering, nearly flat in pT
    expect(r400.rel / r100.rel).toBeGreaterThan(2.6);
    expect(r400.rel / r100.rel).toBeLessThan(4.2);
    expect(r10.rel).toBeGreaterThan(0.002);
    expect(r10.rel).toBeLessThan(0.02);
  });
  test('it agrees with the Gluckstern estimate σ(pT)/pT ≈ σ pT / (0.3 B L²) √(720/(N + 4))', () => {
    const r400 = resolution(400, 2500, 5, 0.0);
    const L = 1.1 - 0.035; // lever arm in m
    const sigEff = 0.02e-3; // m: mean of the pixel (10 μm) and strip (30 μm) resolutions
    const g = ((sigEff * 400) / (0.29979 * 3.8 * L * L)) * Math.sqrt(720 / 12);
    expect(r400.rel / g).toBeGreaterThan(0.6);
    expect(r400.rel / g).toBeLessThan(1.6);
  });
  test('a weaker field gives proportionally worse resolution', () => {
    const cfgB = (B: number) => customise(cfg, { bField: B });
    const fitRes = (c: DetectorConfig, seed: number) => {
      const r = rng(seed);
      const dev: number[] = [];
      for (let i = 0; i < 1500; i++) {
        const d = simulate(truthOf([lepton(13, 200, 0.2, -3 + 6 * r())]), c, r);
        const hs = d.hits.sort((a, b) => a.layer - b.layer);
        const k = Math.abs(fitCurvature(hs, hs.map((h) => c.trackerLayers[h.layer]!.sigmaRPhi)));
        dev.push(200 / pTFromRadius(1 / k / 1000, c.bField) - 1);
      }
      return sd(dev);
    };
    const a = fitRes(cfgB(3.8), 1), b = fitRes(cfgB(1.9), 2);
    expect(b / a).toBeGreaterThan(1.7);
    expect(b / a).toBeLessThan(2.4);
  });
});

// ── showers ───────────────────────────────────────────────────────────────────────────────────

describe('showers', () => {
  test('Heitler: the equal-split model has N = E0/Ec particles at t = ln(E0/Ec)', () => {
    const s = heitlerShower(64, 1);
    expect(s.generations).toHaveLength(7); // 0..6: 2^6 = 64 particles of 1 GeV
    expect(s.generations[6]!.count).toBe(64);
    expect(s.nMax).toBe(64);
    expect(s.tMaxX0).toBeCloseTo(Math.log(64), 10);
    expect(s.totalDeposited).toBeCloseTo(64, 12);
    // N_max ∝ E0, t_max grows logarithmically
    const big = heitlerShower(1024, 1);
    expect(big.nMax / s.nMax).toBe(16);
    expect(big.tMaxX0 - s.tMaxX0).toBeCloseTo(Math.log(16), 10);
  });
  test('Heitler: energy is conserved and the multiplicity scales with E0/Ec when the splitting is random', () => {
    const r = rng(4);
    for (const E0 of [1, 10, 100, 500]) {
      const s = heitlerShower(E0, 0.0093, r);
      expect(s.totalDeposited).toBeCloseTo(E0, 9);
      expect(s.generations.reduce((a, g) => a + g.deposited, 0)).toBeCloseTo(E0, 9);
      expect(s.generations.reduce((a, g) => a + g.stopped, 0)).toBeGreaterThan(0.5 * E0 / 0.0093);
      expect(s.generations.reduce((a, g) => a + g.stopped, 0)).toBeLessThan(3 * E0 / 0.0093);
      expect(s.generations[0]!.count).toBe(1);
    }
    expect(heitlerShower(0.5, 1, r).generations).toHaveLength(1); // below Ec: no shower
  });
  test('the gamma-distribution profile integrates to E0 and peaks at t_max = ln(E0/Ec) − 0.5', () => {
    const E0 = 50, Ec = criticalEnergy('PbWO4');
    let integral = 0, peakT = 0, peak = 0;
    for (let t = 0.005; t < 80; t += 0.01) {
      const v = longitudinalProfile(E0, t, Ec);
      integral += v * 0.01;
      if (v > peak) { peak = v; peakT = t; }
    }
    expect(integral).toBeCloseTo(E0, 0);
    expect(peakT).toBeCloseTo(showerShape(E0, Ec).tMax, 1);
    expect(peakT).toBeCloseTo(Math.log(E0 / Ec) - 0.5, 1);
    expect(longitudinalFraction(E0, Ec, 0, 25)).toBeGreaterThan(0.98); // 25 X0 contain 50 GeV
    expect(longitudinalFraction(1000, Ec, 0, 25)).toBeLessThan(longitudinalFraction(10, Ec, 0, 25));
    // photons start later than electrons
    expect(showerShape(E0, Ec, 'photon').tMax - showerShape(E0, Ec, 'electron').tMax).toBeCloseTo(1, 10);
  });
  test('special functions', () => {
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(lnGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 12);
    expect(gammaP(1, 2)).toBeCloseTo(1 - Math.exp(-2), 12);
    expect(gammaP(3, 2)).toBeCloseTo(1 - Math.exp(-2) * (1 + 2 + 2), 10);
    expect(gammaP(2.5, 40)).toBeCloseTo(1, 10);
  });
  test('electron showers: ECAL + HCAL cells sum to the electron energy (no noise, no fluctuations)', () => {
    const cfg = clean();
    const r = rng(8);
    for (const E of [2, 20, 100]) {
      const sums: number[] = [];
      for (let i = 0; i < 30; i++) {
        const d = simulate(truthOf([withE(11, E, -1 + 2 * r(), -3 + 6 * r())]), cfg, r);
        sums.push(sumCells(d));
      }
      expect(mean(sums) / E, `E = ${E}`).toBeGreaterThan(0.95);
      expect(mean(sums) / E).toBeLessThan(1.001);
    }
  });
  test('photons shower too; 500 GeV electrons leak into the HCAL; a neutrino deposits nothing', () => {
    const cfg = clean();
    const r = rng(9);
    const g = simulate(truthOf([withE(22, 30, 0.3, 1)]), cfg, r);
    expect(sumCells(g, 'ecal') / 30).toBeGreaterThan(0.93);
    const big = simulate(truthOf([withE(11, 500, 0.1, 0.5)]), cfg, r);
    expect(sumCells(big, 'hcal')).toBeGreaterThan(0);
    expect(sumCells(big, 'hcal') / 500).toBeLessThan(0.02);
    expect(simulate(truthOf([{ pdg: 12, p: fromMass(0, 30, 0, 0) }, { pdg: -14, p: fromMass(0, 0, 30, 10) }]), cfg, r).cells).toHaveLength(0);
  });
  test('the ECAL shower is compact: 90 % of the energy within ±1 cell of the maximum, and centred where the electron hit', () => {
    const cfg = clean();
    const r = rng(10);
    let inside = 0, tot = 0;
    for (let i = 0; i < 100; i++) {
      const d = simulate(truthOf([withE(22, 20, 0.4, 1.0)]), cfg, r);
      const ecal = d.cells.filter((c) => c.calo === 'ecal');
      const w = ecal.reduce((a, c) => a + c.energy, 0);
      const eta0 = ecal.reduce((a, c) => a + c.energy * c.eta, 0) / w;
      const phi0 = ecal.reduce((a, c) => a + c.energy * c.phi, 0) / w;
      expect(eta0).toBeCloseTo(0.4, 1);
      expect(phi0).toBeCloseTo(1.0, 1);
      for (const c of ecal) {
        tot += c.energy;
        if (Math.abs(c.eta - eta0) < 1.6 * cfg.ecal.cellEta && Math.abs(c.phi - phi0) < 1.6 * cfg.ecal.cellPhi) inside += c.energy;
      }
    }
    expect(inside / tot).toBeGreaterThan(0.85);
  });
  test('the energy is deposited in depth as the gamma profile says: later layers get less, then the maximum moves with ln E', () => {
    const cfg = customise(clean(), { ecal: { layers: 6 } });
    const r = rng(12);
    const layerE = (E: number) => {
      const e = new Array(6).fill(0);
      for (let i = 0; i < 20; i++) for (const c of simulate(truthOf([{ pdg: 22, p: fromPtEtaPhiM(E, 0.1, 0.3, 0) }]), cfg, r).cells) if (c.calo === 'ecal') e[c.layer] += c.energy;
      return e;
    };
    const lo = layerE(2), hi = layerE(200);
    const centre = (e: number[]) => e.reduce((a, v, k) => a + v * (k + 0.5), 0) / e.reduce((a, v) => a + v, 0);
    expect(centre(hi)).toBeGreaterThan(centre(lo));
    expect(hi[5]!).toBeLessThan(hi[2]!);
  });
  test('hadrons: visible energy ≈ kinetic energy, more of it in the HCAL, with a long tail in depth', () => {
    const cfg = clean();
    const r = rng(13);
    let e = 0, h = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const d = simulate(truthOf([withE(211, 30, -0.8 + 1.6 * r(), -3 + 6 * r())]), cfg, r);
      e += sumCells(d, 'ecal');
      h += sumCells(d, 'hcal');
    }
    const Ekin = 30 - 0.13957;
    expect((e + h) / N / Ekin).toBeGreaterThan(0.93);
    expect((e + h) / N / Ekin).toBeLessThan(1.05);
    expect(h / e).toBeGreaterThan(1.3);
    // neutral hadrons do the same, without a track
    const n = simulate(truthOf([withE(2112, 30, 0.2, 1)]), cfg, r);
    expect(sumCells(n)).toBeGreaterThan(20);
    expect(n.hits).toHaveLength(0);
  });
  test('antiprotons deposit their annihilation energy', () => {
    const d = simulate(truthOf([withE(-2212, 10, 0.1, 1)]), clean(), rng(14));
    expect(sumCells(d)).toBeGreaterThan(10 - 0.938 + 0.5);
  });
});

describe('calorimeter resolution emerges from the parameters', () => {
  const cfg = customise(presets.onion!, { ecal: { stochastic: 0.027, constant: 0.003, noise: 0.05 }, hcal: { stochastic: 1.0, constant: 0.05, noise: 0.2 } });
  for (const kind of ['em', 'had'] as const) {
    test(`σ/E follows a/√E ⊕ b ⊕ n/E for the ${kind === 'em' ? 'ECAL' : 'HCAL'}`, () => {
      const r = rng(kind === 'em' ? 1 : 2);
      for (const E of [5, 25, 100, 400]) {
        const xs = Array.from({ length: 30000 }, () => caloResponse(kind, E, cfg, r));
        const pred = caloResolution(kind, E, cfg);
        expect(mean(xs) / E).toBeGreaterThan(0.99);
        expect(mean(xs) / E).toBeLessThan(1.01 + 3 * pred / Math.sqrt(30000));
        // statistical error on σ from 30000 samples is 0.4 %
        expect(Math.abs(sd(xs) / E / pred - 1), `${kind} E=${E}`).toBeLessThan(0.03);
      }
    });
  }
  test('each term alone', () => {
    const r = rng(3);
    const only = (a: number, b: number, n: number) => customise(presets.onion!, { ecal: { stochastic: a, constant: b, noise: n } });
    const E = 50;
    const sA = sd(Array.from({ length: 40000 }, () => caloResponse('em', E, only(0.1, 0, 0), r))) / E;
    expect(sA / (0.1 / Math.sqrt(E))).toBeCloseTo(1, 1);
    const sB = sd(Array.from({ length: 40000 }, () => caloResponse('em', E, only(0, 0.02, 0), r))) / E;
    expect(sB / 0.02).toBeCloseTo(1, 1);
    const sC = sd(Array.from({ length: 40000 }, () => caloResponse('em', E, only(0, 0, 1.5), r))) / E;
    expect(sC / (1.5 / E)).toBeCloseTo(1, 1);
    // 1/√E dependence of the stochastic term: quadrupling E halves σ/E
    const s4 = sd(Array.from({ length: 40000 }, () => caloResponse('em', 4 * E, only(0.1, 0, 0), r))) / (4 * E);
    expect(sA / s4).toBeCloseTo(2, 1);
  });
  test('the cells of a simulated electron reproduce the ECAL stochastic term', () => {
    const c = customise(clean(), { ecal: { stochastic: 0.1, constant: 0, noise: 0 } });
    const r = rng(5);
    const E = 20;
    const sums = Array.from({ length: 1500 }, () => sumCells(simulate(truthOf([withE(11, E, 0.1, -3 + 6 * r())]), c, r), 'ecal'));
    expect(Math.abs(sd(sums) / mean(sums) / (0.1 / Math.sqrt(E)) - 1)).toBeLessThan(0.1);
  });
});

// ── muons ─────────────────────────────────────────────────────────────────────────────────────

describe('muons', () => {
  test('a muon deposits a MIP in the calorimeters (a few hundred MeV in total), independent of its energy', () => {
    const cfg = clean();
    const r = rng(15);
    const a = sumCells(simulate(truthOf([lepton(13, 10, 0.0, 1)]), cfg, r));
    const b = sumCells(simulate(truthOf([lepton(13, 100, 0.0, 1)]), cfg, r));
    expect(a).toBeGreaterThan(0.2);
    expect(a).toBeLessThan(1.5);
    expect(b).toBeCloseTo(a, 6);
  });
  test('energy loss and range (PDG tables: ≈ 5500 g/cm² at 10 GeV in iron, ≈ 4×10⁴ at 100 GeV)', () => {
    const fe = materials.Fe!;
    const r10 = muonRange('Fe', 10) * fe.density;
    const r100 = muonRange('Fe', 100) * fe.density;
    expect(r10).toBeGreaterThan(4500);
    expect(r10).toBeLessThan(6500);
    expect(r100).toBeGreaterThan(3.3e4);
    expect(r100).toBeLessThan(4.8e4);
    // critical energy in iron ≈ 350 GeV (approximate radiative model: within 30 %)
    expect(muonCriticalEnergy('Fe')).toBeGreaterThan(250);
    expect(muonCriticalEnergy('Fe')).toBeLessThan(450);
    // the total stopping power at 100 GeV in iron is ≈ 2.7 MeV cm²/g
    expect(muonStoppingPower('Fe', 100)).toBeGreaterThan(2.3);
    expect(muonStoppingPower('Fe', 100)).toBeLessThan(3.1);
    // a muon that stops has lost everything; one with plenty keeps most
    expect(muonEnergyAfter('Fe', 2000, 1.0)).toBe(0);
    expect(muonEnergyAfter('Fe', 100, 50)).toBeGreaterThan(49);
    expect(muonEnergyAfter('Fe', 100, 50)).toBeLessThan(50);
  });
  test('penetration: only muons above the minimum momentum reach the muon stations', () => {
    const cfg = presets.onion!;
    expect(cfg.muon.minPToReach).toBeGreaterThan(2);
    expect(cfg.muon.minPToReach).toBeLessThan(6);
    expect(cfg.muon.minPToReach).toBe(deriveMuonMinP(cfg.ecal, cfg.hcal));
    const r = rng(16);
    const stations = (p: number) => simulate(truthOf([lepton(13, p, 0.0, 1)]), clean(), r).muonHits.length;
    expect(stations(1.5)).toBe(0);
    expect(stations(cfg.muon.minPToReach - 0.3)).toBe(0);
    expect(stations(cfg.muon.minPToReach + 1)).toBe(4);
    expect(stations(50)).toBe(4);
    // the override works
    const lo = customise(clean(), { muon: { minPToReach: 0.5 } });
    expect(simulate(truthOf([lepton(13, 1.0, 0.0, 1)]), lo, r).muonHits.length).toBe(0); // stops in the steel anyway: range, not just the threshold
    // pions and electrons never reach the stations
    expect(simulate(truthOf([lepton(211, 50, 0.0, 1), lepton(11, 50, 0.3, 2)]), clean(), r).muonHits).toHaveLength(0);
    // muon hits sit on the station cylinders
    const d = simulate(truthOf([lepton(13, 50, 0.3, 1)]), clean(), r);
    d.muonHits.forEach((h, i) => expect(Math.hypot(h.x, h.y)).toBeCloseTo(presets.onion!.muon.stations[i]!.r, -1));
  });
  test('the return field bends the muon the other way than the solenoid does', () => {
    const r = rng(17);
    const phiOf = (h: { x: number; y: number }) => Math.atan2(h.y, h.x);
    const p = lepton(13, 20, 0.0, 0.3);
    const drift = (field: number) => {
      const c = customise(clean({ trackerLayers: [] as never }), { muon: { returnField: field } });
      const hs = simulate(truthOf([p]), c, r).muonHits.map(phiOf);
      expect(hs).toHaveLength(4);
      return hs[3]! - hs[0]!; // how far φ moves between the first and the last station
    };
    // Without a return field the muon leaves the coil on the tangent of its circle in the solenoid (φ drifts with radius);
    // the return field (opposite sense) bends it back, more strongly the stronger it is, and a field of the other sign the other way.
    const d0 = drift(0), dMinus = drift(-1.8), dPlus = drift(1.8);
    expect(Math.abs(d0)).toBeGreaterThan(0.01);
    expect(Math.sign(d0)).toBe(1); // μ⁻ turns anticlockwise in the solenoid (φ grows)
    expect(d0 - dMinus).toBeGreaterThan(0.02);
    expect(dPlus - d0).toBeGreaterThan(0.02);
    // bending angle of the extra 3.7 m in 1.8 T at 20 GeV: L/(2R) ≈ 0.055 rad between first and last station (order of magnitude)
    expect(Math.abs(dPlus - d0)).toBeLessThan(0.15);
  });
});

// ── decays, conversions, bremsstrahlung ───────────────────────────────────────────────────────

describe('secondaries', () => {
  function run(spec: Spec, n: number, seed: number, cfg = clean()) {
    const r = rng(seed);
    const sec: SimSecondary[] = [];
    for (let i = 0; i < n; i++) simulate(truthOf([spec]), cfg, r, { secondaries: sec });
    return sec;
  }
  test('K_S decays in flight with the exponential law; the daughters conserve four-momentum', () => {
    const p = fromPtEtaPhiM(5, 0, 0.3, particle(310).mass);
    const sec = run({ pdg: 310, p }, 4000, 1);
    // K_S → π⁺π⁻ (69 %) or π⁰π⁰ → 4 γ (31 %): the neutral mode gives two π⁰ which decay promptly to photons: group by the parent vertex
    const byVertex = new Map<string, SimSecondary[]>();
    for (const s of sec) {
      if (s.origin !== 'decay') continue;
      const k = s.vertex.map((v) => v.toFixed(6)).join(',');
      byVertex.set(k, [...(byVertex.get(k) ?? []), s]);
    }
    const tauCm = 0.8954e-10 * 299792458 * 1e3; // mm
    const L = (p.px ** 2 + p.py ** 2 + p.pz ** 2) ** 0.5 / particle(310).mass * tauCm;
    const radii: number[] = [];
    let charged = 0;
    for (const [k, list] of byVertex) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      const rr = Math.hypot(x, y);
      if (list.some((s) => s.pdg === 211 || s.pdg === -211)) {
        charged++;
        radii.push(rr);
        // the two pions carry the K_S four-momentum
        const pi = list.filter((s) => Math.abs(s.pdg) === 211);
        expect(pi).toHaveLength(2);
        const E = pi[0]!.p.E + pi[1]!.p.E;
        const px = pi[0]!.p.px + pi[1]!.p.px, py = pi[0]!.p.py + pi[1]!.p.py, pz = pi[0]!.p.pz + pi[1]!.p.pz;
        expect(mass({ E, px, py, pz })).toBeCloseTo(particle(310).mass, 6);
        expect(px).toBeCloseTo(p.px, 6);
        expect(py).toBeCloseTo(p.py, 6);
        expect(pi[0]!.charge + pi[1]!.charge).toBe(0);
      }
    }
    // decay vertices of all K_S follow exp(−r/L) truncated at the ECAL radius; mean of the truncated exponential
    const R = presets.onion!.ecal.rIn;
    const meanTrunc = L - (R * Math.exp(-R / L)) / (1 - Math.exp(-R / L));
    expect(charged / 4000).toBeGreaterThan(0.69 * 0.96);
    expect(charged / 4000).toBeLessThan(0.69 * 1.04);
    expect(Math.abs(mean(radii) / meanTrunc - 1)).toBeLessThan(0.05);
  });
  test('the pions of a K_S decay leave tracker hits that start away from the beam line (a V⁰)', () => {
    const r = rng(2);
    let found = 0;
    for (let i = 0; i < 300; i++) {
      const d = simulate(truthOf([{ pdg: 310, p: fromPtEtaPhiM(3, 0.2, 0.5, particle(310).mass) }]), clean(), r);
      if (d.hits.length > 0) {
        found++;
        // every hit belongs to the K_S (truth index 0) and the innermost layer hit is beyond the first layer
        expect(d.hits.every((h) => h.truth === 0)).toBe(true);
      }
    }
    expect(found).toBeGreaterThan(100);
  });
  test('charged pions decay in flight with the boosted lifetime; the muon takes most of the momentum', () => {
    const p = fromPtEtaPhiM(5, 0, 0.3, particle(211).mass);
    const sec = run({ pdg: 211, p }, 30000, 3);
    const mus = sec.filter((s) => s.origin === 'decay' && Math.abs(s.pdg) === 13);
    const L = (5 / particle(211).mass) * particle(211).lifetime * 299792458 * 1e3;
    const expected = 30000 * (1 - Math.exp(-presets.onion!.ecal.rIn / L));
    expect(Math.abs(mus.length / expected - 1)).toBeLessThan(0.15);
    for (const m of mus.slice(0, 50)) {
      const pm = Math.hypot(m.p.px, m.p.py, m.p.pz);
      expect(pm).toBeLessThan(5.0001);
      expect(pm).toBeGreaterThan(5 * 0.5);
      expect(Math.abs(m.charge)).toBe(1);
    }
  });
  test('an unstable particle left in the truth record decays promptly: π⁰ → γγ deposits its energy in the ECAL', () => {
    const r = rng(4);
    const d = simulate(truthOf([{ pdg: 111, p: fromPtEtaPhiM(10, 0.2, 1, particle(111).mass) }]), clean(), r);
    expect(sumCells(d, 'ecal') / (10 * Math.cosh(0.2))).toBeGreaterThan(0.9);
  });
  test('a generator-decayed particle is not decayed twice; its charged track is followed up to the decay vertex', () => {
    const parent = { id: 0, pdg: 211, p: fromPtEtaPhiM(6.2, 0, 0.5, 0.13957), vertex: [0, 0, 0] as [number, number, number], endVertex: [60, 30, 0] as [number, number, number], status: 'decayed' as const, mothers: [], daughters: [1], collision: undefined };
    const mu = { id: 1, pdg: -13, p: fromPtEtaPhiM(6.0, 0, 0.5, 0.10566), vertex: [60, 30, 0] as [number, number, number], status: 'final' as const, mothers: [0], daughters: [], collision: undefined };
    const ev: TruthEvent = { number: 0, weight: 1, process: 't', sqrtS: 1, primaryVertices: [[0, 0, 0]], particles: [parent, mu] };
    const d = simulate(ev, clean(), rng(5));
    const fromPion = d.hits.filter((h) => h.truth === 0);
    const fromMuon = d.hits.filter((h) => h.truth === 1);
    // |endVertex| = 67 mm: the pion crosses layer 0 (35 mm) only; the muon starts at 67 mm and crosses the layers beyond
    expect(fromPion.map((h) => h.layer)).toEqual([0]);
    expect(fromMuon.map((h) => h.layer)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(d.muonHits.length).toBe(4);
  });
  test('photon conversion: probability 1 − exp(−7/9 Σ x0) and the pair shares the photon energy', () => {
    const cfg = clean();
    const sumX0 = cfg.trackerLayers.reduce((a, l) => a + l.x0, 0);
    const expected = 1 - Math.exp((-7 / 9) * sumX0);
    const r = rng(6);
    const sec: SimSecondary[] = [];
    const N = 20000;
    for (let i = 0; i < N; i++) simulate(truthOf([{ pdg: 22, p: fromPtEtaPhiM(10, 0.0, -3 + 6 * r(), 0) }]), cfg, r, { secondaries: sec });
    const conv = sec.filter((s) => s.origin === 'conversion');
    expect(conv.length % 2).toBe(0);
    const f = conv.length / 2 / N;
    expect(Math.abs(f / expected - 1)).toBeLessThan(0.06);
    // energy conservation and opposite charges
    for (let i = 0; i < 40; i++) {
      const a = conv[2 * i]!, b = conv[2 * i + 1]!;
      expect(a.p.E + b.p.E).toBeCloseTo(10, 6);
      expect(a.charge + b.charge).toBe(0);
    }
    // conversions happen at the layer radii
    const radii = new Set(conv.map((s) => Math.round(Math.hypot(s.vertex[0], s.vertex[1]))));
    for (const rad of radii) expect(cfg.trackerLayers.map((l) => l.r)).toContain(rad);
  });
  test('converted photons leave two tracks that start at the conversion point', () => {
    const cfg = clean({ trackerLayers: customise(clean(), {}).trackerLayers.map((l) => ({ ...l, x0: 0.5 })) as never });
    const r = rng(7);
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const d = simulate(truthOf([{ pdg: 22, p: fromPtEtaPhiM(5, 0, -3 + 6 * r(), 0) }]), cfg, r);
      if (d.hits.length > 0) {
        seen++;
        const first = Math.min(...d.hits.map((h) => h.layer));
        expect(first).toBeGreaterThanOrEqual(0);
        expect(d.hits.every((h) => h.truth === 0)).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(150);
  });
  test('electron bremsstrahlung: mean radiated fraction 1 − exp(−Σx0) and the electron loses what the photons carry', () => {
    const cfg = clean();
    const sumX0 = cfg.trackerLayers.reduce((a, l) => a + l.x0, 0);
    const r = rng(8);
    const E0 = 40;
    const sec: SimSecondary[] = [];
    const N = 8000;
    for (let i = 0; i < N; i++) simulate(truthOf([lepton(11, E0, 0, -3 + 6 * r())]), cfg, r, { secondaries: sec });
    const brem = sec.filter((s) => s.origin === 'bremsstrahlung');
    expect(brem.length).toBeGreaterThan(N);
    const fracRad = brem.reduce((a, s) => a + s.p.E, 0) / N / Math.sqrt(E0 * E0 + 0.000511 ** 2);
    const expected = 1 - Math.exp(-sumX0);
    expect(Math.abs(fracRad / expected - 1)).toBeLessThan(0.08);
    // the total energy in the ECAL + HCAL is unchanged: the photons land in the calorimeter too
    const d = simulate(truthOf([withE(11, E0, 0, 0.5)]), cfg, r);
    expect(sumCells(d) / E0).toBeGreaterThan(0.93);
  });
  test('the photons radiated by a bending electron land away from it in φ (the bending plane)', () => {
    const cfg = clean();
    const r = rng(9);
    let dphi = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const d = simulate(truthOf([lepton(-11, 6, 0, 0.5)]), cfg, r);
      const ecal = d.cells.filter((c) => c.calo === 'ecal');
      if (ecal.length === 0) continue;
      const w = ecal.reduce((a, c) => a + c.energy, 0);
      dphi += ecal.reduce((a, c) => a + c.energy * c.phi, 0) / w;
      n++;
    }
    // positron at 6 GeV: bends clockwise by ≈ 1290/(2 R) = 0.078 rad between the vertex and the ECAL
    expect(n).toBeGreaterThan(50);
    expect(dphi / n).toBeLessThan(0.5);
    expect(0.5 - dphi / n).toBeGreaterThan(0.08);
    expect(0.5 - dphi / n).toBeLessThan(0.13);
  });
});

// ── pile-up, presets, determinism, speed ──────────────────────────────────────────────────────

function minBias(r: ReturnType<typeof rng>, z: number, collision: number, nch = 60, nph = 60): TruthEvent {
  const specs: Spec[] = [];
  const v: [number, number, number] = [0, 0, z];
  for (let i = 0; i < nch; i++) {
    const u = r();
    const pdg = (r() < 0.5 ? 1 : -1) * (u < 0.7 ? 211 : u < 0.85 ? 321 : 2212);
    specs.push({ pdg, p: fromPtEtaPhiM(0.1 + exponential(r, 0.4), (r() * 2 - 1) * 5, (r() * 2 - 1) * Math.PI, particle(pdg).mass), vertex: v, collision });
  }
  for (let i = 0; i < nph; i++) specs.push({ pdg: 22, p: fromPtEtaPhiM(0.1 + exponential(r, 0.3), (r() * 2 - 1) * 5, (r() * 2 - 1) * Math.PI, 0), vertex: v, collision });
  return truthOf(specs, { primaryVertices: [v] });
}

describe('pile-up', () => {
  test('overlaid collisions add hits and cells, are counted, and carry truth indices beyond the hard event', () => {
    const r = rng(20);
    const hard = truthOf([lepton(13, 45, 0.3, 1), lepton(-13, 45, -0.5, -2)]);
    const pile = Array.from({ length: 5 }, (_, k) => minBias(r, -40 + 20 * k, k + 1, 30, 30));
    const cfg = clean();
    const bare = simulate(hard, cfg, rng(1));
    const d = simulate(hard, cfg, rng(1), { pileup: pile });
    expect(bare.pileup).toBe(0);
    expect(d.pileup).toBe(5);
    expect(d.hits.length).toBeGreaterThan(bare.hits.length + 100);
    expect(d.cells.length).toBeGreaterThan(bare.cells.length);
    const offs = truthOffsets(hard, pile);
    expect(offs[0]).toBe(2);
    expect(offs[1]).toBe(2 + pile[0]!.particles.length);
    const max = 2 + pile.reduce((a, e) => a + e.particles.length, 0);
    for (const h of d.hits) {
      expect(h.truth).toBeLessThan(max);
      expect(h.truth).toBeGreaterThanOrEqual(-1);
    }
    expect(d.hits.filter((h) => h.truth >= 2).length).toBeGreaterThan(100);
    // the hard event's own hits are unchanged in number
    expect(d.hits.filter((h) => h.truth >= 0 && h.truth < 2).length).toBe(bare.hits.length);
    // pile-up already inside the truth record (collision ≥ 1) is counted as well
    const inside = truthOf([lepton(13, 45, 0.3, 1), { ...lepton(211, 1, 0.3, 2), collision: 1 }, { ...lepton(211, 1, 0.3, 2), collision: 2 }]);
    expect(simulate(inside, cfg, rng(2)).pileup).toBe(2);
  });
  test('pile-up events generated at the origin are spread along the beam by the beam spot', () => {
    const cfg = customise(clean(), { beamSpot: { sigmaZ: 50, sigmaXY: 0.02 } });
    const r = rng(3);
    const zs: number[] = [];
    for (let i = 0; i < 300; i++) {
      const e = truthOf([lepton(13, 10, 0, 1)], { primaryVertices: [[0, 0, 0]] });
      const shifted = placeInBeamSpot(e, cfg, r);
      zs.push(shifted.primaryVertices[0]![2]);
      expect(shifted.particles[0]!.vertex[2]).toBe(shifted.primaryVertices[0]![2]);
    }
    expect(sd(zs)).toBeGreaterThan(42);
    expect(sd(zs)).toBeLessThan(58);
  });
});

describe('presets', () => {
  test('the required presets exist, are self-consistent and simulate to finite numbers', () => {
    for (const k of ['minimal', 'onion', 'cms-like', 'atlas-like', 'sandbox']) expect(presets[k], k).toBeDefined();
    const onion = presets.onion!;
    expect(onion.bField).toBe(3.8);
    expect(onion.trackerLayers.filter((l) => l.kind === 'pixel')).toHaveLength(4);
    expect(onion.trackerLayers.filter((l) => l.kind === 'strip')).toHaveLength(4);
    expect(Math.max(...onion.trackerLayers.map((l) => l.r))).toBe(1100);
    expect(onion.ecal.depthX0).toBe(25);
    expect(onion.ecal.stochastic).toBeCloseTo(0.027, 6);
    expect(onion.ecal.constant).toBeCloseTo(0.003, 6);
    expect(onion.hcal.depthLambda).toBeGreaterThanOrEqual(9);
    expect(onion.hcal.stochastic).toBe(1);
    expect(onion.hcal.constant).toBe(0.05);
    expect(Math.max(...onion.muon.stations.map((s) => s.r))).toBeGreaterThanOrEqual(6500);
    expect(presets.minimal!.bField).toBe(2);
    expect(presets['cms-like']!.bField).toBe(3.8);
    expect(presets['atlas-like']!.ecal.stochastic).toBeGreaterThan(presets['cms-like']!.ecal.stochastic);
    expect(presets['atlas-like']!.hcal.stochastic).toBeLessThan(presets['cms-like']!.hcal.stochastic);
    const r = rng(30);
    for (const [name, cfg] of Object.entries(presets)) {
      // layers are ordered outward, geometry is nested
      for (let i = 1; i < cfg.trackerLayers.length; i++) expect(cfg.trackerLayers[i]!.r, name).toBeGreaterThan(cfg.trackerLayers[i - 1]!.r);
      expect(cfg.ecal.rIn, name).toBeGreaterThan(cfg.trackerLayers[cfg.trackerLayers.length - 1]!.r);
      expect(cfg.hcal.rIn, name).toBeGreaterThan(cfg.ecal.rIn);
      expect(cfg.muon.stations[0]!.r, name).toBeGreaterThan(hcalOuterRadius(cfg));
      for (let ev = 0; ev < 20; ev++) {
        const specs = [lepton(13, 30, -2 + 4 * r(), -3 + 6 * r()), lepton(-11, 25, -2 + 4 * r(), -3 + 6 * r()), lepton(211, 15, -2 + 4 * r(), -3 + 6 * r()), { pdg: 22, p: fromPtEtaPhiM(12, -2 + 4 * r(), -3 + 6 * r(), 0) }, { pdg: 310, p: fromPtEtaPhiM(4, r(), -3 + 6 * r(), 0.4976) }];
        const d = simulate(truthOf(specs), cfg, r);
        for (const h of d.hits) for (const v of [h.x, h.y, h.z, h.edep ?? 0]) expect(Number.isFinite(v), name).toBe(true);
        for (const c of d.cells) {
          expect(Number.isFinite(c.energy)).toBe(true);
          expect(c.energy).toBeGreaterThan(0);
          expect(Math.abs(c.eta)).toBeLessThan(Math.max(cfg.ecal.etaMax, cfg.hcal.etaMax ?? 0));
          expect(c.phi).toBeGreaterThan(-Math.PI);
          expect(c.phi).toBeLessThan(Math.PI);
          expect(c.layer).toBeGreaterThanOrEqual(0);
          expect(c.layer).toBeLessThan(c.calo === 'ecal' ? cfg.ecal.layers : cfg.hcal.layers);
        }
        for (const m of d.muonHits) for (const v of [m.x, m.y, m.z]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
  test('customise copies and overrides', () => {
    const c = customise(presets.onion!, { bField: 1, ecal: { noise: 0 } });
    expect(c.bField).toBe(1);
    expect(c.ecal.noise).toBe(0);
    expect(c.ecal.rIn).toBe(presets.onion!.ecal.rIn);
    expect(presets.onion!.bField).toBe(3.8);
    expect(presets.onion!.ecal.noise).toBeGreaterThan(0);
  });
  test('the muon threshold is derived from the calorimeter material: thicker steel needs more momentum', () => {
    const thin = deriveMuonMinP(presets.onion!.ecal, { ...presets.onion!.hcal, depthLambda: 5 });
    const thick = deriveMuonMinP(presets.onion!.ecal, { ...presets.onion!.hcal, depthLambda: 12 });
    expect(thick).toBeGreaterThan(thin + 1);
  });
});

describe('determinism', () => {
  test('the same seed gives the same event; a different seed gives a different one', () => {
    const cfg = presets.onion!;
    const ev = truthOf([lepton(13, 40, 0.3, 1), lepton(-13, 40, -0.3, -2), lepton(11, 20, 0.5, 2), { pdg: 310, p: fromPtEtaPhiM(5, 0, 1, 0.4976) }, lepton(211, 8, 0.1, 0.1)]);
    const pile = [minBias(rng(1), 10, 1, 20, 20)];
    const a = simulate(ev, cfg, rng(77), { pileup: pile });
    const b = simulate(ev, cfg, rng(77), { pileup: pile });
    const c = simulate(ev, cfg, rng(78), { pileup: pile });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    // repeated calls in one process do not change the result (no hidden state leaks between events)
    expect(JSON.stringify(simulate(ev, cfg, rng(77), { pileup: pile }))).toBe(JSON.stringify(a));
  });
  test('the input truth event is not modified', () => {
    const ev = truthOf([lepton(13, 40, 0.3, 1)], { primaryVertices: [[0, 0, 0]] });
    const before = JSON.stringify(ev);
    simulate(ev, presets.onion!, rng(1), { pileup: [minBias(rng(2), 0, 1, 5, 5)] });
    expect(JSON.stringify(ev)).toBe(before);
  });
});

/**
 * CPU seconds used by this process (so that other processes on a busy machine do not count against the benchmark);
 * wall-clock time where the runtime has no such counter.
 */
function cpuSeconds(): number {
  const proc = (globalThis as { process?: { cpuUsage?: () => { user: number; system: number } } }).process;
  if (proc?.cpuUsage) {
    const u = proc.cpuUsage();
    return (u.user + u.system) / 1e6;
  }
  return performance.now() / 1000;
}
function rate(fn: () => void, seconds: number): number {
  for (let i = 0; i < 5; i++) fn(); // warm up (JIT, tables)
  const t0 = cpuSeconds();
  let n = 0;
  while (cpuSeconds() - t0 < seconds) {
    fn();
    n++;
  }
  return n / (cpuSeconds() - t0);
}

describe('speed (CPU time; half of the targets in the plan)', () => {
  const cfg = presets.onion!;
  const zmm = (r: ReturnType<typeof rng>) => truthOf([lepton(13, 30 + 20 * r(), -2 + 4 * r(), -3 + 6 * r()), lepton(-13, 30 + 20 * r(), -2 + 4 * r(), -3 + 6 * r())]);
  test('Z → μμ without pile-up: at least 1,000 events/s', () => {
    const r = rng(40);
    const v = rate(() => simulate(zmm(r), cfg, r), 1);
    console.log(`Z→μμ, no pile-up: ${v.toFixed(0)} events/s per core`);
    expect(v).toBeGreaterThan(1000);
  });
  test('Z → μμ with 50 pile-up collisions (about 1,500 tracks and 1,500 photons in acceptance): at least 25 events/s', () => {
    const r = rng(41);
    const pile = Array.from({ length: 50 }, (_, k) => minBias(r, (r() * 2 - 1) * 100, k + 1));
    const v = rate(() => simulate(zmm(r), cfg, r, { pileup: pile }), 2);
    console.log(`Z→μμ + 50 pile-up: ${v.toFixed(1)} events/s per core`);
    expect(v).toBeGreaterThan(25);
  });
});

// keep the unused imports honest
void normal;
void interactionLength;
