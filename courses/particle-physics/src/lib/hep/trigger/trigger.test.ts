import { describe, expect, test } from 'vitest';
import { setOverride } from '../hooks.ts';
import { rng } from '../random/index.ts';
import { fromPtEtaPhiM } from '../kinematics/index.ts';
import type { RecoEvent, RecoObject } from '../event/index.ts';
import {
  CatalogueEvaluator, EVENT_SIZE_MB, L1_INPUT_RATE_HZ, L1_LATENCY_US, L1_OUTPUT_RATE_HZ, MENU_KINDS, TOY_SAMPLES, bandwidth, effectiveEvents, efficiencyCurve, erf, estimateRates,
  evaluateMenu, fitTurnOn, generateToySamples, itemFromSetting, l1Decision, l1EgCandidates, l1InputFromDetector, l1InputFromReco, l1Jets, l1LatencyBudget, l1Met, l1Variables, liveFraction,
  menuFromSettings, physicsLost, rateHz, referenceL1Decision, turnOn, turnOnQuantile, weightedEfficiency, type ItemSetting, type Sample, type TriggerEvent, type TriggerMenu,
} from './index.ts';

const obj = (kind: RecoObject['kind'], pt: number, eta: number, phi: number, m = 0, charge?: number, isolation = 0): RecoObject => ({ kind, p: fromPtEtaPhiM(pt, eta, phi, m), charge, isolation, truth: -1 });
const reco = (objects: RecoObject[], met = { x: 0, y: 0 }): RecoEvent => ({ tracks: [], vertices: [], clusters: [], objects, met, sumEt: 0 });
const ev = (objects: RecoObject[], met?: { x: number; y: number }): TriggerEvent => ({ reco: reco(objects, met) });

describe('Level 1', () => {
  test('constants: 4 µs latency is 160 crossings of 25 ns; 40 MHz in, 100 kHz out', () => {
    expect(L1_LATENCY_US).toBe(4);
    expect(L1_INPUT_RATE_HZ).toBe(40e6);
    expect(L1_OUTPUT_RATE_HZ).toBe(100e3);
    const b = l1LatencyBudget();
    expect(b.pipelineDepth).toBe(160);
    expect(b.ok).toBe(true);
    expect(b.totalUs).toBeCloseTo(4, 12);
    expect(l1LatencyBudget([{ name: 'slow', us: 5 }]).ok).toBe(false);
  });
  test('a muon gives a stub; a 40 GeV muon passes a 22 GeV threshold and not a 50 GeV one', () => {
    const l1 = l1InputFromReco(reco([obj('muon', 40, 0.5, 1, 0.1057, 1)]));
    expect(l1.muonStubs).toHaveLength(1);
    expect(l1.muonStubs[0]!.pt).toBeCloseTo(40, 0);
    expect(referenceL1Decision(l1, { SingleMu: 22, DoubleMu: 10 })).toEqual(['SingleMu']);
    expect(referenceL1Decision(l1, { SingleMu: 50 })).toEqual([]);
    const two = l1InputFromReco(reco([obj('muon', 40, 0.5, 1, 0.1057, 1), obj('muon', 15, -1.1, -2, 0.1057, -1)]));
    expect(referenceL1Decision(two, { SingleMu: 22, DoubleMu: 12, DoubleMu_Low: 20 })).toEqual(['SingleMu', 'DoubleMu']);
    // a muon outside the muon system is not seen
    expect(l1InputFromReco(reco([obj('muon', 40, 2.6, 1, 0.1, 1)])).muonStubs.filter((s) => Math.abs(s.eta) < 2.4)).toHaveLength(0);
  });
  test('an electron is a narrow EG candidate; a jet of the same ET is not; a jet is a wide cluster', () => {
    const e = l1InputFromReco(reco([obj('electron', 35, 0.3, 0.2, 0.000511, -1)]));
    const eg = l1EgCandidates(e.towers);
    expect(eg).toHaveLength(1);
    expect(eg[0]!.et).toBeGreaterThan(32);
    expect(eg[0]!.et).toBeLessThanOrEqual(35.5);
    expect(Math.abs(l1Jets(e.towers)[0]!.et - 35)).toBeLessThanOrEqual(0.5);
    const j = l1InputFromReco(reco([obj('jet', 100, -0.8, 2.0)]));
    expect(l1EgCandidates(j.towers)).toHaveLength(0);
    const jets = l1Jets(j.towers);
    expect(jets).toHaveLength(1);
    expect(jets[0]!.et).toBeGreaterThan(85);
    expect(jets[0]!.et).toBeLessThan(101);
    expect(referenceL1Decision(j, { SingleJet: 80, SingleEG: 30 })).toEqual(['SingleJet']);
  });
  test('HT sums jets above 30 GeV; MET is the tower vector sum (muons do not contribute)', () => {
    const l1 = l1InputFromReco(reco([obj('jet', 60, 0.0, 0.0), obj('jet', 60, 0.2, 2.1), obj('jet', 60, -0.4, -2.1), obj('jet', 20, 1.0, 1.0)]));
    const v = l1Variables(l1);
    expect(v.HT).toBeGreaterThan(150);
    expect(v.HT).toBeLessThan(181);
    // three equal jets at 120° apart balance: little MET
    expect(v.MET).toBeLessThan(25);
    const one = l1InputFromReco(reco([obj('jet', 100, 0, 1)]));
    expect(l1Met(one.towers).met).toBeGreaterThan(90);
    const mu = l1InputFromReco(reco([obj('muon', 100, 0, 1, 0.1, 1)]));
    expect(l1Met(mu.towers).met).toBeLessThan(1);
  });
  test('noise from a seeded Rng is reproducible and small', () => {
    const r1 = l1InputFromReco(reco([obj('jet', 60, 0, 1)]), { rng: rng(4), softTowers: 40 });
    const r2 = l1InputFromReco(reco([obj('jet', 60, 0, 1)]), { rng: rng(4), softTowers: 40 });
    expect(r1).toEqual(r2);
    expect(l1Variables(r1).MET).toBeLessThan(80);
  });
  test('from the detector: cells become towers with ET = E/cosh η, hits become stubs with pT from the bend', () => {
    const l1 = l1InputFromDetector({
      cells: [{ calo: 'ecal', eta: 1.0, phi: 0.5, energy: 50 * Math.cosh(1.0), layer: 0, truth: [] }],
      muonHits: [
        { station: 1, x: 4000, y: 0, z: 0, truth: -1 },
        { station: 4, x: 7000, y: 0.05 * 7000 * 0.001, z: 0, truth: -1 },
      ],
    });
    expect(l1.towers[0]!.et).toBeCloseTo(50, 0);
    expect(l1.muonStubs).toHaveLength(1);
    expect(l1.muonStubs[0]!.pt).toBeGreaterThan(100);
  });
  test('the hook overrides the decision', () => {
    const l1 = l1InputFromReco(reco([obj('muon', 40, 0.5, 1, 0.1057, 1)]));
    setOverride('trigger.l1Decision', (() => ['Always']) as never);
    try {
      expect(l1Decision(l1, { SingleMu: 22 })).toEqual(['Always']);
    } finally {
      setOverride('trigger.l1Decision', undefined);
    }
    expect(l1Decision(l1, { SingleMu: 22 })).toEqual(['SingleMu']);
  });
});

describe('menus', () => {
  const setting = (key: string, l1: number, hlt: number, prescale = 1): ItemSetting => ({ key, l1Threshold: l1, hltThreshold: hlt, prescale });
  const dimuonZ = ev([obj('muon', 45, 0.3, 0.5, 0.1057, 1), obj('muon', 38, -0.7, -2.5, 0.1057, -1)]);
  const jetty = ev([obj('jet', 300, 0.1, 1), obj('jet', 280, -0.2, -2.1)]);
  test('evaluateMenu: L1 seed and HLT selection per item', () => {
    const menu = menuFromSettings('test', [setting('SingleMu', 22, 24), setting('DoubleMu', 12, 14), setting('SingleJet', 150, 170), setting('DoubleEG', 22, 25)]);
    const [d1, d2] = evaluateMenu([dimuonZ, jetty], menu);
    expect(d1!.hltPassed).toEqual(['SingleMu', 'DoubleMu']);
    expect(d1!.fired).toEqual(['SingleMu', 'DoubleMu']);
    expect(d1!.pHlt).toBeCloseTo(1, 12);
    expect(d2!.hltPassed).toEqual(['SingleJet']);
    expect(d2!.l1Passed).toEqual(['SingleJet']);
  });
  test('an event can pass L1 but fail the HLT: a non-isolated muon', () => {
    const fake = ev([obj('muon', 45, 0.3, 0.5, 0.1057, 1, 0.8)]);
    const [d] = evaluateMenu([fake], menuFromSettings('t', [setting('SingleMu', 22, 24)]));
    expect(d!.l1Passed).toEqual(['SingleMu']);
    expect(d!.hltPassed).toEqual([]);
    expect(d!.pL1).toBe(1);
    expect(d!.pHlt).toBe(0);
  });
  test('prescale N keeps every Nth event (counter) or a fraction 1/N on average (seeded), and the expectation is 1/N', () => {
    const menu = menuFromSettings('t', [setting('SingleMu', 22, 24, 5)]);
    const events = Array.from({ length: 10 }, () => dimuonZ);
    const dec = evaluateMenu(events, menu);
    expect(dec.filter((d) => d.fired.length).length).toBe(2);
    expect(dec[0]!.pHlt).toBeCloseTo(0.2, 12);
    const many = evaluateMenu(Array.from({ length: 4000 }, () => dimuonZ), menu, { rng: rng(5) });
    const k = many.filter((d) => d.fired.length).length;
    expect(k).toBeGreaterThan(740);
    expect(k).toBeLessThan(860);
  });
  test('a menu OR counts overlapping items once', () => {
    const a = menuFromSettings('a', [setting('SingleMu', 22, 24)]);
    const both = menuFromSettings('both', [setting('SingleMu', 22, 24), { ...setting('SingleMu', 22, 24), key: 'SingleMu' }]);
    const sample: Sample = { name: 's', sigmaPb: 1e6, events: [dimuonZ, jetty, dimuonZ, jetty] };
    const ra = estimateRates([sample], a, { lumi: 1e34 });
    const rb = estimateRates([sample], both, { lumi: 1e34 });
    expect(rb.hltTotal).toBeCloseTo(ra.hltTotal, 10);
    expect(rb.items[0]!.hltRate + rb.items[1]!.hltRate).toBeCloseTo(2 * ra.hltTotal, 10);
    expect(rb.overlap[0]![1]).toBeCloseTo(ra.hltTotal, 10);
    expect(rb.items[0]!.hltUniqueRaw).toBe(0);
  });
  test('rate = σ · L · efficiency with the binomial error; dead time and bandwidth', () => {
    const passEv = dimuonZ;
    const failEv = jetty;
    const events = [...Array(100).fill(passEv), ...Array(900).fill(failEv)];
    const sample: Sample = { name: 's', sigmaPb: 1e6, events };
    const menu = menuFromSettings('m', [setting('SingleMu', 22, 24)]);
    const rep = estimateRates([sample], menu, { lumi: 1e34 });
    // 1 pb × 10³⁴ cm⁻² s⁻¹ = 10⁻² Hz, so a 10⁶ pb process runs at 10⁴ Hz
    expect(rateHz(1e6, 1e34, 1)).toBeCloseTo(1e4, 6);
    expect(rep.hltTotal).toBeCloseTo(1e3, 6);
    expect(rep.hltTotalError).toBeCloseTo(1e4 * Math.sqrt((0.1 * 0.9) / 1000), 6);
    expect(rep.samples[0]!.efficiency).toBeCloseTo(0.1, 12);
    expect(rep.bandwidthMBs).toBeCloseTo(1e3 * EVENT_SIZE_MB, 6);
    expect(liveFraction(100e3, 1e-7)).toBeCloseTo(1 / 1.01, 12);
    expect(bandwidth(1000, 1)).toEqual({ MBs: 1000, GBs: 1, TBperDay: 86.4 });
  });
  test('weighted efficiency: weights shift the mean; equal weights reproduce the binomial error', () => {
    expect(weightedEfficiency([1, 1, 1, 1], [1, 0, 0, 0])).toEqual({ eff: 0.25, err: Math.sqrt(0.25 * 0.75 / 4) });
    expect(weightedEfficiency([3, 1], [1, 0]).eff).toBeCloseTo(0.75, 12);
    expect(effectiveEvents([1, 1, 1, 1])).toBe(4);
    expect(effectiveEvents([10, 1, 1])).toBeLessThan(2);
  });
  test('the physics sample efficiency for hand-made signal events', () => {
    const menu = menuFromSettings('m', [setting('DoubleMu', 12, 14)]);
    const fid = { ...dimuonZ, fiducial: true };
    const out = { ...jetty, fiducial: false };
    const s: Sample = { name: 'Z', sigmaPb: 2000, events: [fid, fid, fid, out] };
    const [e] = physicsLost(menu, [s]);
    expect(e!.efficiency).toBeCloseTo(0.75, 12);
    expect(e!.fiducialEfficiency).toBeCloseTo(1, 12);
  });
});

describe('toy samples and the catalogue', () => {
  const samples = generateToySamples({ seed: 11, nPerSample: 600 });
  test('deterministic, with the right cross-sections and event weights', () => {
    const again = generateToySamples({ seed: 11, nPerSample: 600, only: ['zmumu'] });
    expect(again[0]!.events[5]!.reco.objects.map((o) => o.p.E)).toEqual(samples.find((s) => s.name === 'zmumu')!.events[5]!.reco.objects.map((o) => o.p.E));
    expect(samples.map((s) => s.name)).toEqual(TOY_SAMPLES.map((t) => t.key));
    const mb = samples.find((s) => s.name === 'minbias')!;
    const total = mb.events.reduce((s, e) => s + (e.weight ?? 1), 0);
    expect(total / mb.sigmaPb).toBeCloseTo(1, 6);
    const dj = samples.find((s) => s.name === 'dijets')!;
    expect(dj.events.reduce((s, e) => s + (e.weight ?? 1), 0) / dj.sigmaPb).toBeCloseTo(1, 6);
  });
  test('Z → μμ events have two opposite-sign muons at the Z mass', () => {
    const z = samples.find((s) => s.name === 'zmumu')!;
    const both = z.events.filter((e) => e.reco.objects.filter((o) => o.kind === 'muon').length === 2);
    expect(both.length).toBeGreaterThan(400);
    let n = 0;
    for (const e of both.slice(0, 200)) {
      const [a, b] = e.reco.objects.filter((o) => o.kind === 'muon');
      const s = { E: a!.p.E + b!.p.E, px: a!.p.px + b!.p.px, py: a!.p.py + b!.p.py, pz: a!.p.pz + b!.p.pz };
      const m = Math.sqrt(s.E * s.E - s.px * s.px - s.py * s.py - s.pz * s.pz);
      if (m > 60 && m < 120) n++;
      expect((a!.charge ?? 0) * (b!.charge ?? 0)).toBe(-1);
    }
    expect(n).toBeGreaterThan(190);
  });
  test('the fast catalogue evaluator agrees with the general rate estimate', () => {
    const settings: ItemSetting[] = [
      { key: 'SingleMu', l1Threshold: 22, hltThreshold: 24, prescale: 1 },
      { key: 'DoubleMu', l1Threshold: 12, hltThreshold: 14, prescale: 1 },
      { key: 'SingleEG', l1Threshold: 30, hltThreshold: 32, prescale: 2 },
      { key: 'DoubleEG', l1Threshold: 20, hltThreshold: 22, prescale: 1 },
      { key: 'SingleJet', l1Threshold: 100, hltThreshold: 120, prescale: 1 },
      { key: 'HT', l1Threshold: 200, hltThreshold: 240, prescale: 1 },
      { key: 'MET', l1Threshold: 100, hltThreshold: 120, prescale: 1 },
      { key: 'BPhys', l1Threshold: 5, hltThreshold: 5, prescale: 50 },
    ];
    const menu = menuFromSettings('m', settings);
    const slow = estimateRates(samples, menu, { lumi: 2e34 });
    const fast = new CatalogueEvaluator(samples).evaluate(settings, 2e34);
    expect(fast.hltTotal).toBeCloseTo(slow.hltTotal, 6);
    expect(fast.l1Total).toBeCloseTo(slow.l1Total, 6);
    expect(fast.hltTotalError).toBeCloseTo(slow.hltTotalError, 6);
    fast.items.forEach((it, i) => {
      expect(it.hltRate).toBeCloseTo(slow.items[i]!.hltRate, 6);
      expect(it.l1Rate).toBeCloseTo(slow.items[i]!.l1Rate, 6);
    });
    fast.samples.forEach((s, i) => {
      expect(s.fiducialEfficiency).toBeCloseTo(slow.samples[i]!.fiducialEfficiency, 9);
      expect(s.efficiency).toBeCloseTo(slow.samples[i]!.efficiency, 9);
    });
    const loss = physicsLost(menu, samples);
    loss.forEach((l, i) => expect(l.fiducialEfficiency).toBeCloseTo(slow.samples[i]!.fiducialEfficiency, 9));
  });
  test('physics: a sensible menu keeps Higgs and Z events; thresholds at 100 GeV throw the Z away; low jet thresholds blow up the rate', () => {
    const good = menuFromSettings('good', [
      { key: 'SingleMu', l1Threshold: 22, hltThreshold: 24, prescale: 1 },
      { key: 'DoubleMu', l1Threshold: 12, hltThreshold: 14, prescale: 1 },
      { key: 'DoubleEG', l1Threshold: 20, hltThreshold: 22, prescale: 1 },
      { key: 'SingleEG', l1Threshold: 30, hltThreshold: 32, prescale: 1 },
    ]);
    const res = physicsLost(good, samples);
    const by = (n: string) => res.find((r) => r.name === n)!;
    expect(by('zmumu').fiducialEfficiency).toBeGreaterThan(0.95);
    expect(by('hgg').fiducialEfficiency).toBeGreaterThan(0.9);
    expect(by('h4l').fiducialEfficiency).toBeGreaterThan(0.9);
    expect(by('bmumu').fiducialEfficiency).toBeLessThan(0.05);
    const harsh = menuFromSettings('harsh', [{ key: 'SingleMu', l1Threshold: 100, hltThreshold: 100, prescale: 1 }]);
    expect(physicsLost(harsh, samples).find((r) => r.name === 'zmumu')!.efficiency).toBeLessThan(0.05);
    const ev2 = new CatalogueEvaluator(samples);
    const loose = ev2.evaluate([{ key: 'SingleJet', l1Threshold: 20, hltThreshold: 20, prescale: 1 }]);
    const tight = ev2.evaluate([{ key: 'SingleJet', l1Threshold: 200, hltThreshold: 200, prescale: 1 }]);
    expect(loose.l1Total).toBeGreaterThan(5e5);
    expect(loose.l1Total).toBeGreaterThan(100 * tight.l1Total);
    // at a typical menu the L1 rate stays under 100 kHz while loose thresholds exceed it
    expect(tight.l1Total).toBeLessThan(L1_OUTPUT_RATE_HZ);
    expect(MENU_KINDS.length).toBe(8);
    expect(itemFromSetting({ key: 'HT', l1Threshold: 1, hltThreshold: 1, prescale: 1 }).name).toBe('HT');
  });
});

describe('turn-on curves', () => {
  test('erf', () => {
    expect(erf(0)).toBeCloseTo(0, 7);
    expect(erf(1)).toBeCloseTo(0.8427008, 6);
    expect(erf(-2)).toBeCloseTo(-0.9953223, 6);
  });
  test('the fit recovers a noiseless curve', () => {
    const truth = { plateau: 0.95, x50: 24, sigma: 2.5 };
    const points = Array.from({ length: 30 }, (_, i) => ({ x: 10 + i * 1.5, eff: turnOn(10 + i * 1.5, truth), err: 0.02, n: 100 }));
    const fit = fitTurnOn(points);
    expect(fit.plateau).toBeCloseTo(0.95, 3);
    expect(fit.x50).toBeCloseTo(24, 2);
    expect(fit.sigma).toBeCloseTo(2.5, 2);
    expect(fit.chi2).toBeLessThan(1e-3);
    expect(turnOnQuantile(truth, 0.5)).toBeCloseTo(24, 6);
    expect(turnOnQuantile(truth, 0.975)).toBeCloseTo(24 + 1.96 * 2.5, 2);
  });
  test('efficiency vs pT from simulated events and a fit with a finite-statistics scatter', () => {
    const r = rng(9);
    const pts: number[] = [];
    const pass: boolean[] = [];
    for (let i = 0; i < 40000; i++) {
      const pt = 5 + 55 * r();
      const measured = pt * (1 + 0.1 * (r() + r() + r() - 1.5) * 2);
      pts.push(pt);
      pass.push(measured > 24);
    }
    const edges = Array.from({ length: 28 }, (_, i) => 5 + i * 2);
    const curve = efficiencyCurve(pts, pass, edges);
    const fit = fitTurnOn(curve);
    expect(fit.plateau).toBeGreaterThan(0.97);
    expect(fit.plateau).toBeLessThan(1.03);
    expect(fit.x50).toBeGreaterThan(23);
    expect(fit.x50).toBeLessThan(25);
    expect(fit.sigma).toBeGreaterThan(1.5);
    expect(fit.sigma).toBeLessThan(3.5);
  });
});
