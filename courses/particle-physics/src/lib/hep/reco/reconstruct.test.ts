import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import { presets, simulate } from '../detector/index.ts';
import type { DetectorEvent, TruthEvent } from '../event/index.ts';
import { deltaPhi, invariantMass } from '../kinematics/index.ts';
import { setOverride } from '../hooks.ts';
import { reconstruct } from './reconstruct.ts';
import { jetParticles, minBiasTruth, truthEventFrom, type SimpleParticle, type SynthFlavour } from './synthetic.ts';
import { jetFlavour, resolution } from './match.ts';

const cfg = presets.onion!;
const merge = (...evs: TruthEvent[]): TruthEvent => ({ ...evs[0]!, particles: evs.flatMap((e) => e.particles).map((p, i) => ({ ...p, id: i })) });
const ptOf = (p: { px: number; py: number }) => Math.hypot(p.px, p.py);
const etaOf = (p: { px: number; py: number; pz: number }) => Math.asinh(p.pz / ptOf(p));
const phiOf = (p: { px: number; py: number }) => Math.atan2(p.py, p.px);
const dR = (a: { px: number; py: number; pz: number }, eta: number, phi: number) => Math.hypot(etaOf(a) - eta, deltaPhi(phiOf(a), phi));

function event(g: ReturnType<typeof rng>, sig: SimpleParticle[], label: string, opts: { pileup?: number; ue?: number; zv?: number } = {}) {
  const zv = opts.zv ?? 0;
  const truth = merge(truthEventFrom(sig, [0, 0, zv]), minBiasTruth(g, opts.ue ?? 10, [0, 0, zv], 0));
  const pile = Array.from({ length: opts.pileup ?? 0 }, (_, k) => minBiasTruth(g, 25, [normal(g, 0, 0.015), normal(g, 0, 0.015), normal(g, 0, 50)], k + 1));
  const det = simulate(truth, cfg, g.fork(label), { pileup: pile });
  return { truth, det };
}

describe('reconstruct: muons (Z → μμ)', () => {
  test('mass peak, truth links and resolution', () => {
    const g = rng(1);
    const dm: number[] = [];
    let found = 0, total = 0;
    for (let e = 0; e < 50; e++) {
      const phi1 = (g() * 2 - 1) * Math.PI;
      const sig: SimpleParticle[] = [
        { pdg: 13, pt: 30 + 25 * g(), eta: (g() - 0.5) * 1.8, phi: phi1 },
        { pdg: -13, pt: 30 + 25 * g(), eta: (g() - 0.5) * 1.8, phi: phi1 + Math.PI + normal(g, 0, 0.3) },
      ];
      const { truth, det } = event(g, sig, 's' + e, { zv: normal(g, 0, 40) });
      const reco = reconstruct(det, cfg, {}, truth);
      const mus = reco.objects.filter((o) => o.kind === 'muon');
      total += 2;
      found += [0, 1].filter((t) => mus.some((m) => m.truth === t)).length;
      const mt = invariantMass([truth.particles[0]!.p, truth.particles[1]!.p]);
      if (mus.length === 2 && mus[0]!.charge! * mus[1]!.charge! < 0) dm.push(invariantMass([mus[0]!.p, mus[1]!.p]) / mt - 1);
      expect(reco.primaryVertex).toBe(0);
      expect(Math.abs(reco.vertices[0]!.z - truth.primaryVertices[0]![2])).toBeLessThan(0.2);
    }
    expect(found / total).toBeGreaterThan(0.95);
    const r = resolution(dm);
    expect(r.n).toBeGreaterThan(40);
    expect(Math.abs(r.mean)).toBeLessThan(0.01);
    expect(r.sigma68).toBeLessThan(0.015);
  });
  test('muons are isolated; a muon inside a jet is not', () => {
    const g = rng(2);
    const { truth, det } = event(g, [{ pdg: 13, pt: 40, eta: 0.2, phi: 1 }], 'iso');
    const mu = reconstruct(det, cfg, {}, truth).objects.find((o) => o.kind === 'muon')!;
    expect(mu.isolation!).toBeLessThan(0.2);
    const jet = jetParticles(g, 'light', 60, -0.3, 2.0);
    const t2 = merge(truthEventFrom([...jet, { pdg: 13, pt: 12, eta: -0.3, phi: 2.05 }]), minBiasTruth(g, 10, [0, 0, 0], 0));
    const d2 = simulate(t2, cfg, g.fork('m2'));
    const m2 = reconstruct(d2, cfg, {}, t2).objects.filter((o) => o.kind === 'muon');
    if (m2.length) expect(m2[0]!.isolation!).toBeGreaterThan(0.3);
  });
});

describe('reconstruct: electrons and photons', () => {
  test('electrons: efficiency, E/p near 1, charge, not photons', () => {
    const g = rng(3);
    let found = 0, n = 0, wrongCharge = 0, asPhoton = 0;
    const eop: number[] = [], eres: number[] = [];
    for (let e = 0; e < 50; e++) {
      const q = g() < 0.5 ? 11 : -11;
      const pt = 15 + 50 * g();
      const { truth, det } = event(g, [{ pdg: q, pt, eta: (g() - 0.5) * 4, phi: (g() * 2 - 1) * Math.PI }], 'e' + e);
      const reco = reconstruct(det, cfg, {}, truth);
      n++;
      const el = reco.objects.find((o) => o.kind === 'electron' && o.truth === 0);
      if (el) {
        found++;
        eop.push(el.variables!.eOverP!);
        eres.push(ptOf(el.p) / pt - 1);
        if ((el.charge! > 0) !== (q < 0)) wrongCharge++;
        expect(el.isolation!).toBeLessThan(0.3);
      } else if (reco.objects.some((o) => o.kind === 'photon')) asPhoton++;
    }
    expect(found / n).toBeGreaterThan(0.9);
    expect(wrongCharge).toBeLessThanOrEqual(1);
    expect(asPhoton).toBeLessThan(5);
    expect(Math.abs(resolution(eres).mean)).toBeLessThan(0.02);
    expect(resolution(eres).sigma68).toBeLessThan(0.03);
    expect(resolution(eop).median).toBeGreaterThan(0.95);
  });
  test('photons (converted or not): efficiency, resolution, no electron', () => {
    const g = rng(4);
    let found = 0, n = 0, conv = 0, convFound = 0, fakeEl = 0;
    const res: number[] = [];
    for (let e = 0; e < 60; e++) {
      const pt = 15 + 50 * g(), eta = (g() - 0.5) * 4, phi = (g() * 2 - 1) * Math.PI;
      const { truth, det } = event(g, [{ pdg: 22, pt, eta, phi }], 'g' + e);
      const reco = reconstruct(det, cfg, {}, truth);
      const isConv = det.hits.some((h) => h.truth >= 0);
      n++;
      if (isConv) conv++;
      const ph = reco.objects.find((o) => o.kind === 'photon' && dR(o.p, eta, phi) < 0.1 && Math.abs(ptOf(o.p) / pt - 1) < 0.25);
      if (ph) {
        found++;
        res.push(ptOf(ph.p) / pt - 1);
        if (isConv) convFound++;
      }
      if (reco.objects.some((o) => o.kind === 'electron')) fakeEl++;
    }
    expect(found / n).toBeGreaterThan(0.85);
    expect(convFound / Math.max(1, conv)).toBeGreaterThan(0.45);
    expect(fakeEl).toBeLessThan(4);
    expect(Math.abs(resolution(res).mean)).toBeLessThan(0.02);
    expect(resolution(res).sigma68).toBeLessThan(0.03);
  });
});

describe('reconstruct: jets, missing momentum and taus', () => {
  test('light jets: found, calibrated to ±8 %, resolution ~10 %, back-to-back', () => {
    const g = rng(5);
    const r: number[] = [];
    let found = 0, n = 0;
    for (let e = 0; e < 40; e++) {
      const pt = 40 + 60 * g();
      const eta = (g() - 0.5) * 3, phi = (g() * 2 - 1) * Math.PI;
      const parts = [...jetParticles(g, 'light', pt, eta, phi), ...jetParticles(g, 'light', pt * 0.9, -eta * 0.5, phi + Math.PI)];
      const { truth, det } = event(g, parts, 'j' + e);
      const reco = reconstruct(det, cfg, {}, truth);
      const jets = reco.objects.filter((o) => o.kind === 'jet');
      n++;
      const lead = jets.find((j) => dR(j.p, eta, phi) < 0.3);
      if (!lead) continue;
      found++;
      // the visible truth momentum within ΔR < 0.4 of the reco jet
      let sx = 0, sy = 0;
      for (const t of truth.particles.slice(0, parts.length)) if (dR(t.p, etaOf(lead.p), phiOf(lead.p)) < 0.4) {
        sx += t.p.px;
        sy += t.p.py;
      }
      if (Math.hypot(sx, sy) > 20) r.push(ptOf(lead.p) / Math.hypot(sx, sy) - 1);
      expect(lead.nConstituents!).toBeGreaterThan(1);
    }
    expect(found / n).toBeGreaterThan(0.95);
    const s = resolution(r);
    expect(Math.abs(s.median)).toBeLessThan(0.08);
    expect(s.sigma68).toBeLessThan(0.12);
  });
  test('missing pT: a jet recoiling against an invisible particle', () => {
    const g = rng(6);
    const resid: number[] = [];
    for (let e = 0; e < 40; e++) {
      const pt = 30 + 40 * g(), eta = (g() - 0.5) * 2, phi = (g() * 2 - 1) * Math.PI;
      const { truth, det } = event(g, [{ pdg: 12, pt, eta: -eta, phi: phi + Math.PI }, ...jetParticles(g, 'light', pt, eta, phi)], 'm' + e);
      const reco = reconstruct(det, cfg, {}, truth);
      const nu = truth.particles[0]!.p;
      // the neutrino is the first particle: MET should be near its transverse momentum
      resid.push(Math.hypot(reco.met.x - nu.px, reco.met.y - nu.py));
      expect(reco.sumEt).toBeGreaterThan(pt * 0.5);
    }
    resid.sort((a, b) => a - b);
    expect(resid[Math.floor(resid.length / 2)]!).toBeLessThan(8);
  });
  test('hadronic taus: a narrow 1-prong or 3-prong jet becomes a tau candidate, a quark jet usually does not', () => {
    const g = rng(7);
    let tauFound = 0, quarkAsTau = 0, n = 0;
    for (let e = 0; e < 30; e++) {
      const pt = 40 + 30 * g(), eta = (g() - 0.5) * 2, phi = (g() * 2 - 1) * Math.PI;
      // a tau decay: π± π0 (ρ) or 3 charged pions, collimated
      const prong = g() < 0.5 ? [{ pdg: 211, f: 0.65 }, { pdg: 111, f: 0.35 }] : [{ pdg: 211, f: 0.4 }, { pdg: -211, f: 0.3 }, { pdg: 211, f: 0.2 }, { pdg: 111, f: 0.1 }];
      const tauP: SimpleParticle[] = prong.map((p, i) => ({ pdg: p.pdg, pt: pt * p.f, eta: eta + 0.02 * (i - 1), phi: phi + 0.02 * (i % 2 ? 1 : -1) }));
      const { truth, det } = event(g, tauP, 't' + e);
      const reco = reconstruct(det, cfg, {}, truth);
      n++;
      if (reco.objects.some((o) => o.kind === 'tau')) tauFound++;
      const q = event(g, jetParticles(g, 'light', pt, eta, phi), 'q' + e);
      if (reconstruct(q.det, cfg, {}, q.truth).objects.some((o) => o.kind === 'tau')) quarkAsTau++;
    }
    expect(tauFound / n).toBeGreaterThan(0.5);
    expect(quarkAsTau / n).toBeLessThan(0.35);
  });
});

describe('reconstruct: b-tagging (measured on the course detector)', () => {
  test('b jets tagged ≈ 70 %, light jets ≈ 1 %, c jets in between (jet pT 30–80 GeV)', () => {
    const rate = (flavour: SynthFlavour, n: number, seed: number) => {
      const g = rng(seed);
      let tagged = 0, total = 0;
      for (let e = 0; e < n; e++) {
        const pt = 30 + 50 * g(), eta = (g() - 0.5) * 3.6, phi = (g() * 2 - 1) * Math.PI;
        const parts = [...jetParticles(g, flavour, pt, eta, phi), ...jetParticles(g, 'light', 40, -eta * 0.5, phi + Math.PI)];
        const { truth, det } = event(g, parts, flavour + e);
        const reco = reconstruct(det, cfg, {}, truth);
        const jet = reco.objects.find((o) => o.kind === 'jet' && dR(o.p, eta, phi) < 0.3 && o.btag !== undefined);
        if (!jet) continue;
        total++;
        expect(jetFlavour(jet.p, truth)).toBe(flavour === 'light' ? 'light' : flavour);
        if (jet.btag! > 0.5) tagged++;
      }
      return { eff: tagged / total, n: total };
    };
    const b = rate('b', 150, 101);
    const c = rate('c', 100, 102);
    const l = rate('light', 300, 103);
    console.log(`b-tag: b ${b.eff.toFixed(3)} (n=${b.n}), c ${c.eff.toFixed(3)} (n=${c.n}), light ${l.eff.toFixed(4)} (n=${l.n})`);
    expect(b.eff).toBeGreaterThan(0.6);
    expect(b.eff).toBeLessThan(0.85);
    expect(c.eff).toBeGreaterThan(l.eff);
    expect(c.eff).toBeLessThan(b.eff);
    expect(l.eff).toBeLessThan(0.03);
  });
});

describe('reconstruct: pile-up, hooks, performance', () => {
  const zmm = (g: ReturnType<typeof rng>, label: string, pileup: number) => {
    const phi1 = (g() * 2 - 1) * Math.PI;
    const sig: SimpleParticle[] = [
      { pdg: 13, pt: 35 + 20 * g(), eta: (g() - 0.5) * 1.8, phi: phi1 },
      { pdg: -13, pt: 35 + 20 * g(), eta: (g() - 0.5) * 1.8, phi: phi1 + Math.PI + normal(g, 0, 0.3) },
    ];
    return event(g, sig, label, { pileup, ue: 15, zv: normal(g, 0, 50) });
  };
  test('with 20 pile-up collisions the hard-scatter vertex and the muons are still found', () => {
    const g = rng(8);
    let pvOk = 0, muOk = 0, n = 0;
    for (let e = 0; e < 5; e++) {
      const { truth, det } = zmm(g, 'pu' + e, 20);
      const reco = reconstruct(det, cfg, {}, truth);
      n++;
      if (reco.primaryVertex === 0 && Math.abs(reco.vertices[0]!.z - truth.primaryVertices[0]![2]) < 0.3) pvOk++;
      if ([0, 1].every((t) => reco.objects.some((o) => o.kind === 'muon' && o.truth === t))) muOk++;
      expect(reco.vertices.filter((v) => v.kind === 'pileup').length).toBeGreaterThan(10);
    }
    expect(pvOk).toBeGreaterThanOrEqual(4);
    expect(muOk).toBeGreaterThanOrEqual(4);
  });
  test('the hooks reco.missingPt, reco.bTag, reco.antiKt and reco.impactParameter replace the reference functions', () => {
    const g = rng(9);
    const { det } = zmm(g, 'h', 0);
    const jets = event(g, jetParticles(g, 'b', 60, 0.2, 1.0), 'hj').det;
    const called: string[] = [];
    const spy = (name: string, ref: (...a: never[]) => unknown, ret?: unknown) => setOverride(name, ((...a: never[]) => (called.push(name), ret !== undefined ? ret : ref(...a))) as never);
    // import the references lazily so the spies can call through
    return Promise.all([import('./objects.ts'), import('./jets.ts'), import('./btag.ts'), import('./vertex.ts')]).then(([o, j, b, v]) => {
      try {
        spy('reco.missingPt', o.missingPt as never);
        spy('reco.antiKt', j.antiKt as never);
        spy('reco.bTag', b.bTagScore as never, 0.123);
        spy('reco.impactParameter', v.impactParameter as never);
        reconstruct(det, cfg);
        const reco = reconstruct(jets, cfg);
        expect(new Set(called)).toEqual(new Set(['reco.missingPt', 'reco.antiKt', 'reco.bTag', 'reco.impactParameter']));
        expect(reco.objects.filter((x) => x.kind === 'jet' && x.btag !== undefined).every((x) => x.btag === 0.123)).toBe(true);
      } finally {
        for (const n of ['reco.missingPt', 'reco.antiKt', 'reco.bTag', 'reco.impactParameter']) setOverride(n, undefined);
      }
    });
  });
  test('works without truth (real data): no match info, same objects', () => {
    const g = rng(10);
    const { truth, det } = zmm(g, 'nt', 0);
    const a = reconstruct(det, cfg);
    const b = reconstruct(det, cfg, {}, truth);
    expect(a.match).toBeUndefined();
    expect(b.match).toBeDefined();
    expect(a.objects.map((o) => o.kind)).toEqual(b.objects.map((o) => o.kind));
    expect(a.tracks.every((t) => t.truth === -1)).toBe(true);
    expect(b.match!.nMatchedTracks / Math.max(1, b.match!.nTruthTracks)).toBeGreaterThan(0.9);
  });
  const best = (f: () => void, reps: number) => {
    let m = Infinity;
    for (let r = 0; r < reps; r++) {
      const t0 = performance.now();
      f();
      m = Math.min(m, performance.now() - t0);
    }
    return m;
  };
  test('speed: Z → μμ without pile-up (target 2000 events/s, asserted at half)', () => {
    const g = rng(11);
    const dets: DetectorEvent[] = Array.from({ length: 60 }, (_, e) => zmm(g, 'sp' + e, 0).det);
    for (const d of dets.slice(0, 10)) reconstruct(d, cfg); // warm up, and calibrate once
    const ms = best(() => dets.forEach((d) => reconstruct(d, cfg)), 5) / dets.length;
    console.log(`reconstruct, no pile-up: ${ms.toFixed(3)} ms/event = ${(1000 / ms).toFixed(0)} events/s`);
    expect(1000 / ms).toBeGreaterThan(1000);
  });
  test('speed: 50 pile-up collisions (target 50 events/s, asserted at half)', () => {
    const g = rng(12);
    const dets: DetectorEvent[] = Array.from({ length: 3 }, (_, e) => zmm(g, 'pu50_' + e, 50).det);
    reconstruct(dets[0]!, cfg);
    const ms = best(() => dets.forEach((d) => reconstruct(d, cfg)), 3) / dets.length;
    console.log(`reconstruct, 50 pile-up: ${ms.toFixed(1)} ms/event = ${(1000 / ms).toFixed(1)} events/s (${dets[0]!.hits.length} hits, ${dets[0]!.cells.length} cells)`);
    expect(1000 / ms).toBeGreaterThan(25);
  });
});
