/**
 * The Chapter 29 analyses, run on the shipped files: the numbers quoted in the chapter. Reads static/data/ from disk.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_4L_CUTS, DEFAULT_GG_CUTS, GG_SELECTED, analyse4l, countingWindow, diphotonCutflow, diphotonStage, drawDataset, fitDiphoton, histogram4l, massOf, parse4lSim,
  parseCmsOpenData, parseDiphoton, signalShapeFromSimulation, templateFit,
} from './higgs.ts';
import { getProcess } from '../../hep/gen/index.ts';

const dir = path.resolve(import.meta.dirname, '../../../../static/data');
const have = existsSync(path.join(dir, 'higgs-gamgam-sim.bin'));
const buf = (f: string) => { const b = readFileSync(path.join(dir, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

describe.runIf(have)('the diphoton analysis on the simulated sample', () => {
  const man = JSON.parse(readFileSync(path.join(dir, 'higgs-gamgam-sim.manifest.json'), 'utf8'));
  const sample = parseDiphoton(buf('higgs-gamgam-sim.bin'), man);
  const out: Record<string, unknown> = {};

  test('the cut flow', () => {
    const flow = diphotonCutflow(sample, DEFAULT_GG_CUTS, 1);
    out.flow = flow.map((f) => `${f.name}: S ${f.signal.toFixed(1)}  B ${f.background.toFixed(0)}`);
    const last = flow.at(-1)!;
    out.sb = last.signal / last.background;
    expect(flow[0]!.signal).toBeCloseTo(man.samples.signal.sigmaLO_pb * 3.4 * man.samples.background.poolLuminosity_fb * 1000, 3);
    expect(last.signal).toBeGreaterThan(50);
    expect(last.background).toBeGreaterThan(10000);
  });

  test('the signal line shape and the fit of the whole data set (seed 1, μ = 1)', () => {
    const shape = signalShapeFromSimulation(sample, DEFAULT_GG_CUTS);
    out.shape = shape;
    const data = drawDataset(sample, { mu: 1, fraction: 1, seed: 1 });
    const masses = data.filter((d) => diphotonStage(d.event, DEFAULT_GG_CUTS) === GG_SELECTED).map((d) => d.m);
    const nSig = data.filter((d) => d.signal && diphotonStage(d.event, DEFAULT_GG_CUTS) === GG_SELECTED).length;
    const fit = fitDiphoton(masses, shape);
    out.fit = { n: masses.length, nSigTruth: nSig, mass: fit.mass, shift: fit.shift, yield: fit.signalYield, z0: fit.z0, chi2: fit.chi2, ndf: fit.ndf, p: fit.pValueFit, nll: fit.nll, nll0: fit.nll0 };
    expect(fit.fit.converged).toBe(true);
    expect(Math.abs(fit.shift.value)).toBeLessThan(4 * fit.shift.error + 1);
  });

  test('the same fit for seeds 1 to 20: the pull of the yield and of the mass', () => {
    const shape = signalShapeFromSimulation(sample, DEFAULT_GG_CUTS);
    const pulls: number[] = [], zs: number[] = [], mp: number[] = [], ys: number[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const data = drawDataset(sample, { mu: 1, fraction: 1, seed });
      const sel = data.filter((d) => diphotonStage(d.event, DEFAULT_GG_CUTS) === GG_SELECTED);
      const nSig = sel.filter((d) => d.signal).length;
      const fit = fitDiphoton(sel.map((d) => d.m), shape);
      pulls.push((fit.signalYield.value - nSig) / fit.signalYield.error);
      mp.push(fit.shift.value / fit.shift.error);
      zs.push(fit.z0);
      ys.push(fit.signalYield.value);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const sd = (a: number[]) => Math.sqrt(a.reduce((x, y) => x + (y - mean(a)) ** 2, 0) / (a.length - 1));
    out.toys = { pullYield: [mean(pulls), sd(pulls)], pullMass: [mean(mp), sd(mp)], z0: [mean(zs), sd(zs)], yield: [mean(ys), sd(ys)] };
    // a no-signal fit
    const data0 = drawDataset(sample, { mu: 0, fraction: 1, seed: 3 });
    const fit0 = fitDiphoton(data0.filter((d) => diphotonStage(d.event, DEFAULT_GG_CUTS) === GG_SELECTED).map((d) => d.m), shape);
    out.noSignal = { yield: fit0.signalYield, z0: fit0.z0 };
    expect(Math.abs(mean(pulls))).toBeLessThan(1.2);
  });

  test('print', () => {
    writeFileSync('/tmp/higgs-gg-out.json', JSON.stringify(out, null, 1));
  });
});

describe.runIf(existsSync(path.join(dir, 'h4l-cms-opendata.json')))('the four-lepton analysis on real data and on simulation', () => {
  const cms = parseCmsOpenData(JSON.parse(readFileSync(path.join(dir, 'h4l-cms-opendata.json'), 'utf8')));
  const out: Record<string, unknown> = {};
  test('recomputed masses reproduce the file', () => {
    let worst = 0;
    cms.events.forEach((e, i) => {
      const t = e.leptons.reduce((a, l) => ({ E: a.E + l.p.E, px: a.px + l.p.px, py: a.py + l.p.py, pz: a.pz + l.p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
      const p = Math.hypot(t.px, t.py, t.pz);
      worst = Math.max(worst, Math.abs(Math.sqrt(Math.max(0, (t.E - p) * (t.E + p))) - cms.published[i]!));
    });
    out.worst = worst;
    expect(worst).toBeLessThan(0.01);
    expect(cms.events.length).toBe(278);
  });
  test('selection and counting on the real events', () => {
    const { h, passed, results } = histogram4l(cms.events);
    out.passed = passed;
    out.reasons = results.reduce((a: Record<string, number>, r) => { const k = r.pass ? 'pass' : r.reason!; a[k] = (a[k] ?? 0) + 1; return a; }, {});
    const bkg = cms.mc.zz.map((v, i) => v + cms.mc.dy[i]! + cms.mc.ttbar[i]!);
    const obs = Array.from(h.counts);
    out.hzzSum = cms.mc.hzz.reduce((a, b) => a + b, 0);
    out.bkgSum = bkg.reduce((a, b) => a + b, 0);
    out.window = countingWindow(obs, cms.mc.hzz, bkg, [17, 20]);
    out.window2 = countingWindow(obs, cms.mc.hzz, bkg, [16, 21]);
    out.templateFit = templateFit(obs, cms.mc.hzz, bkg);
    out.templateFit100160 = templateFit(obs, cms.mc.hzz, bkg, [100, 160], Array.from({ length: 38 }, (_, i) => 70 + 3 * i));
    out.observedAll = obs.reduce((a, b) => a + b, 0);
    out.observedNear = obs.slice(14, 23);
    out.bkgNear = bkg.slice(14, 23).map((x) => +x.toFixed(2));
    out.sigNear = cms.mc.hzz.slice(14, 23).map((x) => +x.toFixed(2));
    // the same without any selection (the file's own M)
    const raw = new Array<number>(37).fill(0);
    cms.published.forEach((m) => { const k = Math.floor((m - 70) / 3); if (k >= 0 && k < 37) raw[k]!++; });
    out.rawWindow = countingWindow(raw, cms.mc.hzz, bkg, [17, 20]);
    expect(passed).toBeGreaterThan(50);
  });
  const haveSim = existsSync(path.join(dir, 'higgs-4l-sim.bin'));
  test.runIf(haveSim)('the course simulation through the same analysis', () => {
    const sim = parse4lSim(buf('higgs-4l-sim.bin'));
    const man = JSON.parse(readFileSync(path.join(dir, 'higgs-4l-sim.manifest.json'), 'utf8'));
    const trig = sim.filter((e) => e.trigger);
    const r = histogram4l(trig);
    const generated = man.sample.generated;
    const s8 = getProcess('pp->H->ZZ->4l').sigma(8000), s7 = getProcess('pp->H->ZZ->4l').sigma(7000);
    const expected = 3.4 * (s8 * 11.6 + s7 * 2.3) * 1000;
    out.sim = { stored: sim.length, generated, triggered: trig.length, passed: r.passed, effTotal: r.passed / generated, expectedProduced: expected, expectedSelected: (expected * r.passed) / generated, s8, s7 };
    const mm = Array.from(r.h.counts);
    out.simMassPeak = mm.slice(15, 22);
    // resolution: the passed events' m4l spread
    const ms = r.results.filter((x) => x.pass).map((x) => x.m4l!);
    const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
    const inPeak = ms.filter((m) => m > 110 && m < 140);
    const mu = inPeak.reduce((a, b) => a + b, 0) / inPeak.length;
    out.simPeak = { n: ms.length, mean, mu, sd: Math.sqrt(inPeak.reduce((a, b) => a + (b - mu) ** 2, 0) / inPeak.length) };
    const flav = r.results.filter((x) => x.pass).reduce((a: Record<string, number>, x) => { a[x.flavour!] = (a[x.flavour!] ?? 0) + 1; return a; }, {});
    out.simFlavours = flav;
  });
  test('print', () => { writeFileSync('/tmp/higgs-4l-out.json', JSON.stringify(out, null, 1)); });
});
