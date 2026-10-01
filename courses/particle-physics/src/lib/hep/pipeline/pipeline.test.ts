import { afterEach, describe, expect, test } from 'vitest';
import { setOverride, activeOverrides } from '../hooks.ts';
import { pairMass, type P4 } from '../kinematics/index.ts';
import { estimateRates, l1InputFromDetector, menuFromSettings, type TriggerEvent } from '../trigger/index.ts';
import {
  OBSERVABLES, PIPELINE_VERSION, PRESET_NAMES, accumulate, emptyBatch, fillHist, findBin, fourLeptonMass, leadingPair, machineOf, mergeBatch, mergeConfig,
  parsePayload, payloadMatches, physicsKey, prepare, presetConfig, processEvent, rateReportFrom, runBatch, runEvent, sampleIndexFor, sampleWeights, sampleXsec,
  summarise, eventRng, windowFraction, type BatchResult, type HistAcc, type PipelineConfig,
} from './index.ts';

afterEach(() => {
  for (const n of activeOverrides()) setOverride(n, undefined);
});

/** The deterministic part of a result: everything but wall-clock times and kept events. */
function counts(r: BatchResult): unknown {
  return JSON.parse(JSON.stringify({ ...r, time: undefined, kept: undefined }));
}
/** Bin counts and entry counts exactly; the sums of x and x² (floating point) to rounding. */
function sameHist(a: HistAcc, b: HistAcc): void {
  expect(a.counts).toEqual(b.counts);
  expect([a.underflow, a.overflow, a.sum]).toEqual([b.underflow, b.overflow, b.sum]);
  expect(a.sumx).toBeCloseTo(b.sumx, 8);
  expect(a.sumx2).toBeCloseTo(b.sumx2, 5);
}
const fast = (name: string, pileup = 0): PipelineConfig => {
  const c = presetConfig(name);
  c.machine.pileupMean = pileup;
  return c;
};

describe('configuration', () => {
  test('every preset resolves and has samples, observables and a detector', () => {
    for (const name of PRESET_NAMES) {
      const c = presetConfig(name);
      const p = prepare(c);
      expect(p.samples.length).toBeGreaterThan(0);
      expect(p.observables.length).toBeGreaterThan(0);
      expect(p.detector.trackerLayers.length).toBeGreaterThan(3);
      expect(c.name).toBe(name);
    }
  });
  test('presetConfig returns independent copies; mergeConfig applies a patch on top of a preset and survives garbage', () => {
    const a = presetConfig('zmumu'), b = presetConfig('zmumu');
    a.generator.kFactor = 5;
    expect(b.generator.kFactor).toBe(1);
    const m = mergeConfig({ name: 'higgs-gamgam', machine: { sqrtS: 14000 }, detector: { bField: 2 } });
    expect(m.machine.sqrtS).toBe(14000);
    expect(m.machine.mode).toBe('pp');
    expect(m.detector.bField).toBe(2);
    expect(m.generator.samples.map((s) => s.name)).toEqual(['hgg', 'gg']);
    expect(mergeConfig({ name: 'nonsense', generator: { samples: [] } }).generator.samples.length).toBeGreaterThan(0);
    expect(mergeConfig(null).name).toBe('zmumu');
  });
  test('the machine stage gives the Run-3-like luminosity and pile-up, and ee mode has none', () => {
    const m = machineOf(presetConfig('zmumu'));
    expect(m.lumi).toBeGreaterThan(1e34);
    expect(m.mu).toBeGreaterThan(30);
    expect(machineOf(presetConfig('ee-zpole')).mu).toBe(0);
    expect(machineOf(presetConfig('ee-zpole')).lumi).toBe(2e31);
  });
  test('sample indices are a function of the event index alone and follow the shares', () => {
    const shares = [1, 3];
    const seq = Array.from({ length: 40 }, (_, i) => sampleIndexFor(i, shares));
    expect(seq.slice(0, 8)).toEqual([0, 1, 1, 1, 0, 1, 1, 1]);
    expect(seq.filter((k) => k === 0)).toHaveLength(10);
  });
  test('event random streams differ between indices and seeds and repeat for the same pair', () => {
    expect(eventRng(1, 5)()).toBe(eventRng(1, 5)());
    expect(eventRng(1, 5)()).not.toBe(eventRng(1, 6)());
    expect(eventRng(1, 5)()).not.toBe(eventRng(2, 5)());
  });
});

describe('determinism and splitting', () => {
  test('the same seed gives the same events, histograms and sums', () => {
    const c = fast('zmumu');
    expect(counts(runBatch(c, 40, 7))).toEqual(counts(runBatch(c, 40, 7)));
    expect(counts(runBatch(c, 40, 7))).not.toEqual(counts(runBatch(c, 40, 8)));
  });

  test('event i is the same event whatever else was run before it', () => {
    const c = fast('zmumu');
    const a = runEvent(c, 13, 3);
    runBatch(c, 5, 3, { start: 50 });
    const b = runEvent(c, 13, 3);
    expect(b.event!.truth!.particles.length).toBe(a.event!.truth!.particles.length);
    expect(b.event!.truth!.particles[3]!.p).toEqual(a.event!.truth!.particles[3]!.p);
    expect(b.event!.reco.objects.map((o) => o.p)).toEqual(a.event!.reco.objects.map((o) => o.p));
    expect(b.values).toEqual(a.values);
  });

  test('worker-count independence: any split of a run into batches, merged in any order, adds up to the same result', () => {
    // Two samples, a trigger menu and pile-up, so that several accumulators and random streams are exercised.
    const c = fast('higgs-4l', 2);
    const N = 36;
    const whole = runBatch(c, N, 5);
    // simulate W workers taking chunks of size S in a scrambled order
    for (const [W, S] of [[1, 36], [2, 7], [3, 5], [5, 4], [4, 1]] as const) {
      const chunks: { start: number; n: number }[] = [];
      for (let s = 0; s < N; s += S) chunks.push({ start: s, n: Math.min(S, N - s) });
      // round-robin to workers, then workers finish in reverse order
      const perWorker: BatchResult[][] = Array.from({ length: W }, () => []);
      chunks.forEach((ch, i) => perWorker[i % W]!.push(runBatch(c, ch.n, 5, { start: ch.start })));
      const results = perWorker.reverse().flat();
      const merged = results.slice(1).reduce((acc, r) => mergeBatch(acc, r), results[0]!);
      const a = counts(whole) as BatchResult, b = counts(merged) as BatchResult;
      // integers (event counts, histograms, truth-matching counts, trigger pass counts) agree exactly
      expect(b.n).toBe(a.n);
      a.samples.forEach((s, k) => {
        const t = b.samples[k]!;
        expect(t.n).toBe(s.n);
        expect(t.selected).toBe(s.selected);
        expect(t.triggered).toBe(s.triggered);
        expect(t.inWindow).toBe(s.inWindow);
        t.hist.forEach((h, i) => sameHist(h, s.hist[i]!));
        sameHist(t.truthHist, s.truthHist);
        expect(t.eff).toEqual(s.eff);
        expect(t.tracks).toBe(s.tracks);
        expect(t.hits).toBe(s.hits);
        expect(t.trigger.fired).toBe(s.trigger.fired);
        expect(t.trigger.itemFired).toEqual(s.trigger.itemFired);
        expect(t.trigger.overlap).toEqual(s.trigger.overlap);
        // floating-point sums agree to rounding
        expect(t.trigger.pL1).toBeCloseTo(s.trigger.pL1, 9);
        expect(t.trigger.pHlt).toBeCloseTo(s.trigger.pHlt, 9);
      });
    }
    expect(whole.samples.reduce((s, x) => s + x.n, 0)).toBe(N);
  }, 120_000);
});

describe('physics of the whole chain', () => {
  test('energy and momentum are conserved in the truth record: e⁺e⁻ → μ⁺μ⁻ with a parton shower and no ISR sums to (√s, 0)', () => {
    const c = presetConfig('ee-zpole');
    c.generator.isr = false;
    for (let i = 0; i < 20; i++) {
      const t = runEvent(c, i, 2).event!.truth!;
      const final = t.particles.filter((p) => p.status === 'final' && (p.collision ?? 0) === 0);
      const sum = final.reduce((s, p) => ({ E: s.E + p.p.E, px: s.px + p.p.px, py: s.py + p.p.py, pz: s.pz + p.p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
      expect(Math.abs(sum.E - c.machine.sqrtS) / c.machine.sqrtS).toBeLessThan(1e-9);
      expect(Math.hypot(sum.px, sum.py, sum.pz)).toBeLessThan(1e-6);
    }
  });
  test('transverse momentum is conserved in pp → Z → μμ with showers, hadronisation and decays', () => {
    const c = fast('zmumu');
    for (let i = 0; i < 20; i++) {
      const t = runEvent(c, i, 2).event!.truth!;
      const final = t.particles.filter((p) => p.status === 'final' && (p.collision ?? 0) === 0);
      const px = final.reduce((s, p) => s + p.p.px, 0), py = final.reduce((s, p) => s + p.p.py, 0);
      expect(Math.hypot(px, py)).toBeLessThan(1e-6 * c.machine.sqrtS);
    }
  });

  test('the reconstructed Z → μμ mass peaks at 91 GeV with the right width, and reco tracks the truth', () => {
    const c = fast('zmumu');
    const mll: number[] = [];
    const res = runBatch(c, 700, 1, { onEvent: (o) => { if (o.selected && o.values[0] != null) mll.push(o.values[0]); } });
    expect(mll.length).toBeGreaterThan(40);
    mll.sort((a, b) => a - b);
    const median = mll[Math.floor(mll.length / 2)]!;
    expect(Math.abs(median - 91.19)).toBeLessThan(1.0);
    expect(mll.filter((m) => m > 81 && m < 101).length / mll.length).toBeGreaterThan(0.75);
    const s = summarise(res, c, [sampleXsec(c.generator.samples[0]!, c.machine.sqrtS)]);
    // resolution: the reconstructed mass is within about a per cent of the truth mass event by event
    expect(s.resolution!.rms).toBeLessThan(0.02);
    expect(Math.abs(s.resolution!.mean)).toBeLessThan(0.005);
    // truth matching: every prompt muon in the muon system's acceptance is found, and tracking is efficient
    const mu = s.efficiencies.find((e) => e.kind === 'muon')!;
    expect(mu.efficiency).toBeGreaterThan(0.95);
    expect(s.tracking.efficiency).toBeGreaterThan(0.9);
    expect(s.fit!.converged).toBe(true);
    expect(Math.abs(s.fit!.params['sig.mean']!.value - 91.19)).toBeLessThan(1.5);
  }, 120_000);

  test('e⁺e⁻ → μ⁺μ⁻ with initial-state radiation: at √s = 200 GeV a fifth of the pairs "return" to the Z peak, and on the pole the peak is the Z', () => {
    const c = presetConfig('ee-zpole');
    c.machine.sqrtS = 200;
    c.analysis.binning = { mll: { bins: 90, lo: 20, hi: 200 } };
    const res = runBatch(c, 300, 3);
    const s = summarise(res, c, [sampleXsec(c.generator.samples[0]!, 200)]);
    const o = s.observables[0]!;
    const sumBetween = (lo: number, hi: number) => o.total.counts.reduce((acc, n, i) => (o.edges[i]! >= lo && o.edges[i + 1]! <= hi ? acc + n : acc), 0);
    const all = o.total.counts.reduce((a, b) => a + b, 0);
    expect(all).toBeGreaterThan(80);
    expect(sumBetween(84, 98) / all).toBeGreaterThan(0.1);
    expect(sumBetween(180, 200) / all).toBeGreaterThan(0.3);
    // on the pole the visible mass is the Z mass
    const pole = presetConfig('ee-zpole');
    const mll: number[] = [];
    runBatch(pole, 80, 3, { onEvent: (e) => { if (e.values[0] != null) mll.push(e.values[0]); } });
    mll.sort((a, b) => a - b);
    expect(Math.abs(mll[Math.floor(mll.length / 2)]! - 91.19)).toBeLessThan(1);
  });

  test('a four-lepton Higgs sample reconstructs a peak at 125 GeV', () => {
    const c = fast('higgs-4l');
    c.generator.samples = [c.generator.samples[0]!];
    const m: number[] = [];
    runBatch(c, 120, 4, { onEvent: (o) => { if (o.selected && o.values[0] != null) m.push(o.values[0]); } });
    expect(m.length).toBeGreaterThan(8);
    m.sort((a, b) => a - b);
    expect(Math.abs(m[Math.floor(m.length / 2)]! - 125.25)).toBeLessThan(3);
  }, 120_000);
});

describe('hooks: the reader’s code runs inside the pipeline', () => {
  test('a kinematics.pairMass override changes the dimuon mass of every event', () => {
    const c = fast('zmumu');
    const before: number[] = [];
    const after: number[] = [];
    runBatch(c, 80, 1, { onEvent: (o) => { if (o.values[0] != null) before.push(o.values[0]); } });
    setOverride('kinematics.pairMass', (a: P4, b: P4) => pairMass(a, b) + 10);
    runBatch(c, 80, 1, { onEvent: (o) => { if (o.values[0] != null) after.push(o.values[0]); } });
    expect(before.length).toBeGreaterThan(3);
    expect(after).toHaveLength(before.length);
    before.forEach((m, i) => expect(after[i]! - m).toBeCloseTo(10, 6));
  });

  test('a reco.antiKt override changes the jets of the reconstructed events', () => {
    const c = fast('dijet');
    c.generator.samples = [c.generator.samples[2]!];
    const jets = (r: BatchResult) => r.samples[0]!.objects.jet ?? 0;
    const ref = runBatch(c, 12, 1);
    setOverride('reco.antiKt', () => ({ jets: [], constituents: [] }));
    const mine = runBatch(c, 12, 1);
    expect(jets(ref)).toBeGreaterThan(10);
    expect(jets(mine)).toBe(0);
  }, 120_000);

  test('a trigger.l1Decision override that never fires keeps no events, and a faulty override is reported as a stage error, not a crash', () => {
    const c = fast('zmumu');
    setOverride('trigger.l1Decision', () => []);
    const none = runBatch(c, 30, 1);
    expect(none.samples[0]!.trigger.fired).toBe(0);
    expect(none.samples[0]!.selected).toBe(0);
    setOverride('trigger.l1Decision', () => { throw new Error('oops'); });
    const bad = runBatch(c, 5, 1);
    expect(bad.samples[0]!.failed).toBe(5);
    expect(bad.errors[0]!.stage).toBe('trigger');
    expect(bad.errors[0]!.message).toContain('oops');
  });

  test('a machine.luminosity override changes the machine stage', () => {
    const c = fast('zmumu');
    const ref = machineOf(c).lumi;
    setOverride('machine.luminosity', () => 12345);
    expect(machineOf(c).lumi).toBe(12345);
    expect(ref).not.toBe(12345);
  });
});

describe('normalisation, rates and summaries', () => {
  test('weights scale the histograms to σ K L: expected events = cross-section × K × luminosity', () => {
    const c = fast('higgs-gamgam');
    c.analysis.lumiFb = 50;
    c.generator.kFactor = 2;
    const res = runBatch(c, 20, 1);
    const xsec = [0.0346, 16.9];
    const w = sampleWeights(res, c, xsec);
    res.samples.forEach((s, k) => expect(w[k]! * s.n).toBeCloseTo(xsec[k]! * 2 * 50 * 1000, 6));
    const s = summarise(res, c, xsec);
    expect(s.isLO).toBe(false);
    expect(summarise(res, presetConfig('higgs-gamgam'), xsec).isLO).toBe(true);
  }, 120_000);

  test('the generator-level window reduces the cross-section by the fraction that passes, and the fraction is reproducible', () => {
    const spec = presetConfig('higgs-gamgam').generator.samples[1]!;
    const f = windowFraction(spec, 13600);
    expect(f.eff).toBeGreaterThan(0.1);
    expect(f.eff).toBeLessThan(0.3);
    expect(windowFraction(spec, 13600).eff).toBe(f.eff);
    const unwindowed = sampleXsec({ ...spec, window: undefined }, 13600);
    expect(sampleXsec(spec, 13600) / unwindowed).toBeCloseTo(f.eff, 10);
  });

  test('trigger rates from the accumulated sums equal hep/trigger estimateRates on the same events', () => {
    const c = fast('higgs-4l');
    c.generator.samples = c.generator.samples.map((s) => ({ ...s, share: 1 }));
    const p = prepare(c);
    const res = emptyBatch(p);
    const events: TriggerEvent[][] = c.generator.samples.map(() => []);
    for (let i = 0; i < 24; i++) {
      const o = processEvent(p, i, 9);
      accumulate(p, res, o);
      events[o.sampleIndex]!.push({ reco: o.event!.reco, l1: l1InputFromDetector(o.event!.detector!, p.detector.bField) });
    }
    const xsec = [0.0018, 0.0013];
    const lumi = 2e34, dead = 1e-7;
    const mine = rateReportFrom(res, c, xsec, lumi, dead);
    const menu = menuFromSettings(c.name, c.trigger.menu);
    const ref = estimateRates(events.map((e, k) => ({ name: c.generator.samples[k]!.name, sigmaPb: xsec[k]!, events: e })), menu, { lumi, deadTimeS: dead });
    expect(mine.l1Total).toBeCloseTo(ref.l1Total, 12);
    expect(mine.hltTotal).toBeCloseTo(ref.hltTotal, 12);
    expect(mine.hltTotalError).toBeCloseTo(ref.hltTotalError, 12);
    expect(mine.liveFraction).toBeCloseTo(ref.liveFraction, 12);
    expect(mine.bandwidthMBs).toBeCloseTo(ref.bandwidthMBs, 12);
    ref.items.forEach((it, i) => {
      expect(mine.items[i]!.hltRate).toBeCloseTo(it.hltRate, 12);
      expect(mine.items[i]!.l1RateRaw).toBeCloseTo(it.l1RateRaw, 12);
      expect(mine.items[i]!.hltUniqueRaw).toBeCloseTo(it.hltUniqueRaw, 12);
      expect(mine.items[i]!.hltError).toBeCloseTo(it.hltError, 12);
    });
    ref.overlap.forEach((row, i) => row.forEach((v, j) => expect(mine.overlap[i]![j]!).toBeCloseTo(v, 12)));
  }, 120_000);

  test('stage counters and timings are filled, and every stage reports a positive rate', () => {
    const c = fast('zmumu');
    const res = runBatch(c, 25, 1);
    const s = summarise(res, c, [1666]);
    expect(s.stages.map((x) => x.stage)).toEqual(['machine', 'generator', 'detector', 'reconstruction', 'trigger', 'analysis']);
    for (const st of s.stages) expect(st.eventsPerSecond).toBeGreaterThan(0);
    expect(s.stages[1]!.counters[0]!.value).toBe(25);
    expect(s.stages[2]!.perEvent[0]!.value).toBeGreaterThan(50);
  });

  test('pseudo-data are Poisson fluctuations of the expectation that do not re-roll as the expectation grows slightly', () => {
    const c = fast('higgs-gamgam');
    const res = runBatch(c, 12, 1);
    const xsec = [0.0346, 16.9];
    const a = summarise(res, c, xsec, { seed: 1 }), b = summarise(res, c, xsec, { seed: 1 }), d = summarise(res, c, xsec, { seed: 2 });
    expect(a.observables[0]!.pseudo!.counts).toEqual(b.observables[0]!.pseudo!.counts);
    expect(a.observables[0]!.pseudo!.counts).not.toEqual(d.observables[0]!.pseudo!.counts);
    // consistent with the expectation: total within a few √N
    const e = a.observables[0]!.total.counts.reduce((x, y) => x + y, 0), o = a.observables[0]!.pseudo!.counts.reduce((x, y) => x + y, 0);
    expect(Math.abs(o - e)).toBeLessThan(6 * Math.sqrt(e) + 1);
  }, 120_000);
});

describe('observables', () => {
  const mu = (pt: number, phi: number, q: number, flavour = 13) => ({ p: { E: pt, px: pt * Math.cos(phi), py: pt * Math.sin(phi), pz: 0 }, charge: q, flavour });
  test('leadingPair takes the leading particle with the hardest opposite-sign same-flavour partner', () => {
    const pair = leadingPair([mu(50, 0, 1), mu(40, 1, 1), mu(30, 2, -1)])!;
    expect(pair[1].p.px).toBeCloseTo(30 * Math.cos(2), 9);
    expect(leadingPair([mu(50, 0, 1), mu(40, 1, 1)])).toBeNull();
    expect(leadingPair([mu(50, 0, 1, 13), mu(40, 1, -1, 11)])).toBeNull();
  });
  test('the four-lepton mass of Z → ee plus Z → μμ at rest-frame kinematics, and pT thresholds', () => {
    // H (125) → Z(91) Z*(~30): build leptons in a back-to-back configuration with the right total mass by construction
    const E = 125 / 4;
    const lep = (px: number, py: number, pz: number, q: number, f: number) => ({ p: { E: Math.hypot(px, py, pz), px, py, pz }, charge: q, flavour: f });
    // two pairs, each pair back to back along ±x and ±y with equal energies: pair masses 2E_pair
    const z1 = [lep(40, 0, 10, 1, 13), lep(-40, 0, 10, -1, 13)];
    const z2 = [lep(0, 8, -9, 1, 11), lep(0, -8, -9, -1, 11)];
    const all = [...z1, ...z2].sort((a, b) => b.p.px ** 2 + b.p.py ** 2 - a.p.px ** 2 - a.p.py ** 2);
    const tot = all.reduce((s, l) => ({ E: s.E + l.p.E, px: s.px + l.p.px, py: s.py + l.p.py, pz: s.pz + l.p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
    const m = fourLeptonMass(all);
    // masses of the pairs: m(z1) = 2·√(1600+100) = 82.5, m(z2) = 2·√(64+81) = 24.1: inside the Z1 and Z2 windows
    expect(m).not.toBeNull();
    expect(m!).toBeCloseTo(Math.sqrt(tot.E ** 2 - tot.px ** 2 - tot.py ** 2 - tot.pz ** 2), 6);
    void E;
    // lowering the second lepton below 10 GeV fails the pT thresholds
    expect(fourLeptonMass([all[0]!, lep(5, 0, 0, 1, 13), all[2]!, all[3]!])).toBeNull();
  });
  test('every observable name is defined with an increasing range, and unknown ones are rejected', () => {
    for (const o of Object.values(OBSERVABLES)) expect(o.hi).toBeGreaterThan(o.lo);
    const c = fast('zmumu');
    c.analysis.observables = ['nonsense'];
    expect(() => prepare(c)).toThrow(/unknown observable/);
  });
  test('histogram bin search: under, over, edges and NaN', () => {
    const e = [0, 1, 2, 4];
    expect(findBin(e, -1)).toBe(-1);
    expect(findBin(e, 0)).toBe(0);
    expect(findBin(e, 1)).toBe(1);
    expect(findBin(e, 3.99)).toBe(2);
    expect(findBin(e, 4)).toBe(3);
    expect(findBin(e, NaN)).toBe(3);
  });
});

describe('samples and manifests', () => {
  test('payload parsing validates its shape and physicsKey ignores presentation options', () => {
    const c = fast('zmumu');
    const result = runBatch(c, 3, 1);
    const payload = parsePayload({ manifest: { pipelineVersion: PIPELINE_VERSION }, config: c, xsec: [1], result });
    expect(payloadMatches(payload, c)).toBe(true);
    const c2 = structuredClone(c);
    c2.analysis.fit = null;
    c2.analysis.lumiFb = 3;
    expect(physicsKey(c2)).toBe(physicsKey(c));
    c2.detector.bField = 2;
    expect(payloadMatches(payload, c2)).toBe(false);
    expect(() => parsePayload({})).toThrow();
    expect(() => parsePayload({ manifest: {}, config: c, xsec: [1, 2], result })).toThrow();
  });
});

describe('performance (asserted at half the target where the plan sets one)', () => {
  test('histogram filling: 10⁶ events in well under 200 ms (the plan: 100 ms for the analysis library)', () => {
    const edges = Array.from({ length: 61 }, (_, i) => 60 + i);
    const h = { counts: new Array<number>(60).fill(0), underflow: 0, overflow: 0, sum: 0, sumx: 0, sumx2: 0 };
    const t0 = performance.now();
    let x = 0.5;
    for (let i = 0; i < 1e6; i++) {
      x = (x * 9301 + 49297) % 233280;
      fillHist(h, edges, 50 + (x / 233280) * 80);
    }
    expect(performance.now() - t0).toBeLessThan(200);
    expect(h.sum + h.underflow + h.overflow).toBe(1e6);
  });

  test('the whole chain runs Z → μμ without pile-up at tens of events per second per core, and the pipeline’s own stages (trigger, analysis, accumulation) cost a small share', () => {
    const c = fast('zmumu');
    const p = prepare(c);
    processEvent(p, 0, 1); // warm up: grid training, calibration, JIT
    const N = 60;
    const t0 = performance.now();
    const res = runBatch(c, N, 2, { prepared: p });
    const wall = performance.now() - t0;
    const rate = (N / wall) * 1000;
    // measured about 130–260 events/s on a busy development machine (generator 380/s, simulation 1000/s, reconstruction 800/s alone); the floor is conservative
    expect(rate).toBeGreaterThan(40);
    const own = res.time.trigger + res.time.analysis + res.time.machine;
    const total = Object.values(res.time).reduce((a, b) => a + b, 0);
    expect(own / total).toBeLessThan(0.25);
    // the stage timings account for the wall-clock time
    expect(total).toBeGreaterThan(0.8 * wall);
  }, 120_000);
});
