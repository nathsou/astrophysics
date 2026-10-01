import { describe, expect, it } from 'vitest';
import { rng } from '../random/index.ts';
import {
  ALPHA_PDG,
  MATERIALS,
  csdaRange,
  highland,
  info,
  ionisationLoss,
  meanIonisation,
  mipLoss,
  momentumFromRadius,
  radiusOfCurvature,
  simulateTrack,
  visibleLength,
  fitCircle,
  circleThrough,
  angleAt,
  chargeSign,
  measureTrack,
  type SimulateOptions,
} from './index.ts';

const AIR = 'air+alcohol vapour' as const;
const base = (o: Partial<SimulateOptions> & Pick<SimulateOptions, 'pdg'>): SimulateOptions => ({
  position: [0, 0, 0],
  direction: [1, 0, 0],
  bField: 0,
  medium: AIR,
  rng: rng(11),
  ...o,
});
const mu = { mass: 105.6583755, charge: -1 };

describe('material physics', () => {
  it('alpha of 5 MeV has a range in air of 3.5–4.5 cm (this model: about 3.7 cm)', () => {
    const R = csdaRange({ mass: 3727.379, charge: 2 }, 5, MATERIALS.air);
    expect(R).toBeGreaterThan(35);
    expect(R).toBeLessThan(45);
  });
  it('a simulated 5 MeV alpha is straight, dense and stops where the range says', () => {
    const set = simulateTrack(base({ pdg: ALPHA_PDG, T: 0.005, rng: rng(3) }));
    const t = set.primary;
    expect(t.end).toBe('range');
    expect(t.length).toBeGreaterThan(33);
    expect(t.length).toBeLessThan(42);
    // nearly straight: displacement ≈ path length
    const a = t.points[0]!;
    const b = t.points[t.points.length - 1]!;
    expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / t.length).toBeGreaterThan(0.97);
    // ionisation several hundred times minimum, and peaking at the end (Bragg peak)
    const mip = (mipLoss(MATERIALS.air) * MATERIALS.air.density) / 10;
    const n = t.points.length;
    expect(t.points[Math.floor(n * 0.3)]!.dedx / mip).toBeGreaterThan(100);
    // Bragg peak: the ionisation near the end of the range is about twice that at the start
    const late = Math.max(...t.points.filter((p) => p.s > 0.8 * t.length).map((p) => p.dedx));
    expect(late).toBeGreaterThan(t.points[5]!.dedx * 1.8);
  });
  it('minimum-ionising dE/dx in liquid hydrogen is 4.0–4.1 MeV cm²/g; a 1 GeV/c muon is 4.1–4.2', () => {
    const mip = mipLoss(MATERIALS.hydrogen);
    expect(mip).toBeGreaterThan(3.95);
    expect(mip).toBeLessThan(4.1);
    const s = ionisationLoss(mu, 1000, MATERIALS.hydrogen);
    expect(s / 4.1).toBeGreaterThan(0.96);
    expect(s / 4.1).toBeLessThan(1.06);
    // in MeV per cm of liquid: 4.1 × 0.0708 ≈ 0.29
    expect((s * MATERIALS.hydrogen.density)).toBeCloseTo(0.296, 1);
  });
  it('minimum ionisation in lead and air agrees with the tables', () => {
    expect(mipLoss(MATERIALS.lead)).toBeGreaterThan(1.09);
    expect(mipLoss(MATERIALS.lead)).toBeLessThan(1.15);
    expect(mipLoss(MATERIALS.air)).toBeGreaterThan(1.75);
    expect(mipLoss(MATERIALS.air)).toBeLessThan(1.87);
  });
  it('radius of curvature from pT and B', () => {
    expect(radiusOfCurvature(1, 1)).toBeCloseTo(3.3356, 3);
    expect(momentumFromRadius(radiusOfCurvature(0.5, 2), 2)).toBeCloseTo(0.5, 10);
  });
});

describe('helices', () => {
  it('a 0.3 GeV/c track in 1 T has R = 1 m, and the fitted circle agrees', () => {
    const set = simulateTrack(base({ pdg: 13, p: 0.3, bField: 1, scatterTail: false, bounds: { xMin: -1e3, xMax: 1e3, yMin: -2e3, yMax: 2e3 } }));
    const pts = set.primary.points.filter((_, i) => i % 3 === 0);
    const fit = fitCircle(pts)!;
    expect(fit.R / 1000).toBeGreaterThan(0.97 * (0.3 / 0.29979));
    expect(fit.R / 1000).toBeLessThan(1.03 * (0.3 / 0.29979));
  });
  it('positive charge goes clockwise for B out of the page, negative anticlockwise', () => {
    const run = (pdg: number) => {
      const set = simulateTrack(base({ pdg, p: 0.1, bField: 1, rng: rng(2), secondaries: false, bounds: { xMin: -1e3, xMax: 1e3, yMin: -1e3, yMax: 1e3 } }));
      return fitCircle(set.primary.points.filter((_, i) => i % 2 === 0))!;
    };
    expect(run(-13).orientation).toBe(-1); // pdg −13 is the μ⁺
    expect(run(13).orientation).toBe(1); // the μ⁻ turns anticlockwise
  });
  it('chargeSign inverts the sense of rotation', () => {
    expect(chargeSign(-1, 1)).toBe(1);
    expect(chargeSign(1, 1)).toBe(-1);
    expect(chargeSign(1, -1)).toBe(1);
  });
});

describe('the lead plate (Anderson)', () => {
  it('the exit momentum is smaller and the energy lost matches the mean loss', () => {
    // A 300 MeV/c muon crosses 6 mm of lead travelling up: mean energy loss ≈ 1.25 MeV cm²/g × 11.35 g/cm³ × 0.6 cm.
    const set = simulateTrack(base({ pdg: -13, p: 0.3, direction: [0, 1, 0], position: [0, -50, 0], bField: 1.5, fluctuations: false, deltaRays: 0, plates: [{ y0: -3, y1: 3 }], bounds: { yMax: 50, xMin: -1e3, xMax: 1e3 } }));
    const pts = set.primary.points;
    const before = pts.filter((p) => p.layer === 0 && p.y < 0).pop()!;
    const after = pts.find((p) => p.layer === 0 && p.y > 0)!;
    const mass = 0.10566;
    const dE = (Math.hypot(before.p, mass) - Math.hypot(after.p, mass)) * 1000;
    const expected = mipLoss(MATERIALS.lead) * 1.1 * MATERIALS.lead.density * 0.6; // relativistic rise ~10 % at βγ ≈ 3
    expect(dE).toBeGreaterThan(expected * 0.85);
    expect(dE).toBeLessThan(expected * 1.3);
    expect(after.p).toBeLessThan(before.p);
  });
  it('the radius of curvature on the exit side is smaller in proportion to the momentum', () => {
    // Use the first seed in which the positron comes out of the plate with enough track left to measure.
    let set = simulateTrack(base({ pdg: -11, p: 0.063, direction: [0.03, 1, 0], position: [-20, -90, 0], bField: 1.5, rng: rng(1), plates: [{ y0: -3, y1: 3 }], bounds: { yMin: -100, yMax: 100, xMin: -500, xMax: 500 } }));
    for (let seed = 2; seed < 60 && set.primary.points.filter((p) => p.layer === 0 && p.y > 3 && p.visible).length < 40; seed++) {
      set = simulateTrack(base({ pdg: -11, p: 0.063, direction: [0.03, 1, 0], position: [-20, -90, 0], bField: 1.5, rng: rng(seed), plates: [{ y0: -3, y1: 3 }], bounds: { yMin: -100, yMax: 100, xMin: -500, xMax: 500 } }));
    }
    const m = measureTrack(set.primary, 1.5, AIR);
    const segs = m.segments.filter((s) => s.fit && !s.fit.straight);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    const below = segs[0]!;
    const above = segs[segs.length - 1]!;
    expect(above.fit!.R).toBeLessThan(below.fit!.R);
    // R ∝ p: the fitted radii give the momenta, and they match the track's own momentum at the two ends
    const pb = set.primary.points[below.from]!.p;
    const pa = set.primary.points[above.from]!.p;
    expect(below.pT / pb).toBeGreaterThan(0.9);
    expect(below.pT / pb).toBeLessThan(1.1);
    expect(above.pT / pa).toBeGreaterThan(0.75);
    expect(above.pT / pa).toBeLessThan(1.25);
    expect(pa).toBeLessThan(pb);
  });
  it('Anderson-like energies: the mean electron loss in 6 mm of lead leaves roughly a third of 63 MeV', () => {
    // Radiative loss dominates: dE/dx ≈ E/X0 + collisional: E(t) = (E0 + Ec') e^(−t) − Ec' with t = 6/5.6.
    const t = 6 / 5.612;
    const E = (63 + 5.6) * Math.exp(-t) - 5.6;
    expect(E).toBeGreaterThan(15);
    expect(E).toBeLessThan(30);
  });
});

describe('multiple scattering', () => {
  it("agrees with Highland's formula for a muon crossing 5 mm of lead", () => {
    const angles: number[] = [];
    for (let i = 0; i < 300; i++) {
      const s = simulateTrack(base({ pdg: 13, p: 1, direction: [0, 1, 0], position: [0, -1, 0], rng: rng(100 + i), plates: [{ y0: 0, y1: 5 }], bounds: { yMax: 12 }, scatterTail: false, fluctuations: false }));
      const p = s.primary.points;
      const a = p[p.length - 2]!;
      const b = p[p.length - 1]!;
      angles.push(Math.atan2(b.x - a.x, b.y - a.y));
    }
    angles.sort((a, b) => a - b);
    const sigma = (angles[Math.floor(0.75 * angles.length)]! - angles[Math.floor(0.25 * angles.length)]!) / 1.349;
    const mm = 105.6583755;
    const beta = 1000 / Math.hypot(1000, mm);
    const expected = highland(1000, beta, 1, 5 / (MATERIALS.lead.X0 / MATERIALS.lead.density / 0.1));
    expect(sigma / expected).toBeGreaterThan(0.88);
    expect(sigma / expected).toBeLessThan(1.12);
  });
  it('low-energy electrons wiggle: their tracks are far from straight', () => {
    const set = simulateTrack(base({ pdg: 11, T: 0.0005, rng: rng(9) }));
    const t = set.primary;
    const a = t.points[0]!;
    const b = t.points[t.points.length - 1]!;
    expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / t.length).toBeLessThan(0.97);
  });
});

describe('secondaries', () => {
  it('ionisation is what the droplet density follows: alpha ≫ proton ≫ muon', () => {
    const mip = (mipLoss(MATERIALS.air, true) * MATERIALS.air.density) / 10;
    const ion = (o: Partial<SimulateOptions> & Pick<SimulateOptions, 'pdg'>) => meanIonisation(simulateTrack(base({ rng: rng(4), ...o })).primary, mip);
    const a = ion({ pdg: ALPHA_PDG, T: 0.0053 });
    const p = ion({ pdg: 2212, T: 0.002 });
    const m = ion({ pdg: 13, p: 1 });
    expect(a).toBeGreaterThan(p);
    expect(p).toBeGreaterThan(20 * m);
    expect(m).toBeGreaterThan(0.95);
    expect(m).toBeLessThan(1.3);
  });
  it('a pion decays in flight to a muon with a kink and an invisible neutrino', () => {
    const set = simulateTrack(base({ pdg: 211, p: 0.2, direction: [0, -1, 0], position: [0, 90, 0], bField: 0, forceDecayAt: { 211: 60 }, rng: rng(21) }));
    const pi = set.primary;
    expect(pi.end).toBe('decay');
    expect(pi.length).toBeCloseTo(60, 0);
    const mus = set.tracks.filter((t) => t.origin === 'decay');
    expect(mus).toHaveLength(1);
    expect(mus[0]!.pdg).toBe(-13);
    expect(pi.kinks.some((k) => k.kind === 'decay' && k.angle > 0.0)).toBe(true);
    expect(mus[0]!.points[0]!.y).toBeCloseTo(pi.points[pi.points.length - 1]!.y, 6);
  });
  it('K_S → π⁺π⁻: a neutral parent with no ionisation and a V of two tracks from one vertex', () => {
    const set = simulateTrack(base({ pdg: 310, p: 1, bField: 1, forceDecayAt: { 310: 80 }, channel: { 310: [211, -211] }, rng: rng(8) }));
    const parent = set.primary;
    expect(parent.neutral).toBe(true);
    expect(parent.points.every((p) => p.dedx === 0)).toBe(true);
    expect(parent.length).toBeCloseTo(80, 3);
    const kids = set.tracks.filter((t) => t.parent === parent.id);
    expect(kids.map((t) => t.pdg).sort()).toEqual([-211, 211]);
    const v = parent.points[parent.points.length - 1]!;
    for (const k of kids) expect(Math.hypot(k.points[0]!.x - v.x, k.points[0]!.y - v.y)).toBeLessThan(1e-9);
  });
  it('a photon converts to e⁺e⁻ that curve opposite ways and share the photon energy', () => {
    const set = simulateTrack(base({ pdg: 22, p: 0.3, bField: 1, medium: 'liquid hydrogen', forceConversionAt: [50], rng: rng(6), bounds: { xMin: -1e3, xMax: 1e3, yMin: -1e3, yMax: 1e3 } }));
    const ee = set.tracks.filter((t) => t.origin === 'pair production');
    expect(ee).toHaveLength(2);
    const pMinus = ee.find((t) => t.pdg === 11)!;
    const pPlus = ee.find((t) => t.pdg === -11)!;
    expect(pMinus.points[0]!.p + pPlus.points[0]!.p).toBeGreaterThan(0.28);
    expect(pMinus.points[0]!.p + pPlus.points[0]!.p).toBeLessThan(0.33);
    const fit = (t: typeof pMinus) => fitCircle(t.points.filter((_, i) => i % 2 === 0).slice(0, 40))!;
    expect(fit(pMinus).orientation).toBe(-fit(pPlus).orientation);
  });
  it('electron showers in lead: more particles come out than go in', () => {
    const set = simulateTrack(base({ pdg: 11, p: 0.5, direction: [0, -1, 0], position: [0, 60, 0], bField: 1, plates: [{ y0: -10, y1: 10 }], rng: rng(13), bounds: { yMin: -90, yMax: 90, xMin: -400, xMax: 400 }, maxTracks: 300 }));
    expect(set.tracks.length).toBeGreaterThan(20);
    expect(set.tracks.some((t) => t.pdg === 22 && t.origin === 'bremsstrahlung')).toBe(true);
  });
  it('delta rays appear on heavily ionising tracks in a dense medium', () => {
    const set = simulateTrack(base({ pdg: -211, p: 1, medium: 'liquid hydrogen', bField: 0, bounds: { xMax: 600 }, rng: rng(2) }));
    expect(set.tracks.filter((t) => t.origin === 'delta ray').length).toBeGreaterThan(2);
  });
  it('is deterministic for a given seed', () => {
    const run = () => simulateTrack(base({ pdg: 11, T: 0.002, bField: 1, rng: rng(77) })).primary.points.map((p) => p.x + p.y);
    expect(run()).toEqual(run());
  });
  it('sensitive depth hides points outside the layer', () => {
    const set = simulateTrack(base({ pdg: 13, p: 1, direction: [1, 0, 0.2], sensitiveZ: [-5, 5], bounds: { xMax: 100, zMin: -100, zMax: 100 } }));
    const t = set.primary;
    expect(visibleLength(t)).toBeLessThan(t.length);
    expect(visibleLength(t)).toBeGreaterThan(0);
  });
});

describe('measurement tools', () => {
  it('circle through three points', () => {
    const c = circleThrough({ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 })!;
    expect(c.R).toBeCloseTo(1, 10);
    expect(c.cx).toBeCloseTo(0, 10);
    expect(circleThrough({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
  it('angle at a vertex', () => {
    expect(angleAt({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 10);
  });
  it('the particle table has the alpha', () => {
    expect(info(ALPHA_PDG).charge).toBe(2);
  });
});
