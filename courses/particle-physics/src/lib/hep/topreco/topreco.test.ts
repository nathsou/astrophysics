import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { generate } from '../gen/index.ts';
import { mass, fromPtEtaPhiM, type P4 } from '../kinematics/index.ts';
import { TOP_CHI2, assignTopJets, assignTopJetsReference, assignmentCount, neutrinoPz, selectLeptonJets, type TopJet } from './index.ts';
import { setOverride } from '../hooks.ts';

/** Hard-process partons of one tt̄ → ℓ+jets truth event: lepton, neutrino, and the four quarks. */
function partons(seed: number) {
  const r = rng(seed);
  for (;;) {
    const ev = generate('pp->ttbar->leptonjets', { sqrtS: 13000, shower: false, hadronise: false, decay: false }, r);
    const ps = ev.particles;
    const lep = ps.find((p) => p.status === 'final' && [11, 13].includes(Math.abs(p.pdg)));
    const nu = ps.find((p) => p.status === 'final' && [12, 14].includes(Math.abs(p.pdg)));
    if (!lep || !nu) continue;
    const tLep = ps[ps[lep.mothers[0]!]!.mothers[0]!]!;
    const bLep = ps.find((p) => Math.abs(p.pdg) === 5 && p.mothers[0] === tLep.id)!;
    const tHad = ps.find((p) => Math.abs(p.pdg) === 6 && p.id !== tLep.id)!;
    const bHad = ps.find((p) => Math.abs(p.pdg) === 5 && p.mothers[0] === tHad.id)!;
    const qs = ps.filter((p) => p.status === 'final' && Math.abs(p.pdg) <= 4 && Math.abs(ps[p.mothers[0]!]!.pdg) === 24 && ps[p.mothers[0]!]!.mothers[0] === tHad.id);
    if (qs.length !== 2) continue;
    return { lep: lep.p, nu: nu.p, bLep: bLep.p, bHad: bHad.p, q1: qs[0]!.p, q2: qs[1]!.p, tLep: tLep.p, tHad: tHad.p };
  }
}

describe('neutrinoPz', () => {
  test('reproduces m(ℓν) = m_W when a real solution exists', () => {
    for (let s = 1; s <= 20; s++) {
      const e = partons(s);
      const sol = neutrinoPz(e.lep, { x: e.nu.px, y: e.nu.py }, mass({ E: e.lep.E + e.nu.E, px: e.lep.px + e.nu.px, py: e.lep.py + e.nu.py, pz: e.lep.pz + e.nu.pz }));
      const pt = Math.hypot(e.nu.px, e.nu.py);
      const nu: P4 = { E: Math.hypot(pt, sol.pz), px: e.nu.px, py: e.nu.py, pz: sol.pz };
      const m = mass({ E: e.lep.E + nu.E, px: e.lep.px + nu.px, py: e.lep.py + nu.py, pz: e.lep.pz + nu.pz });
      if (!sol.complex) expect(m).toBeCloseTo(mass({ E: e.lep.E + e.nu.E, px: e.lep.px + e.nu.px, py: e.lep.py + e.nu.py, pz: e.lep.pz + e.nu.pz }), 2);
    }
  });
  test('one of the two roots is the true pz (to the lepton and neutrino being massless)', () => {
    let hit = 0, n = 0;
    for (let s = 1; s <= 40; s++) {
      const e = partons(100 + s);
      const sol = neutrinoPz(e.lep, { x: e.nu.px, y: e.nu.py }, mass({ E: e.lep.E + e.nu.E, px: e.lep.px + e.nu.px, py: e.lep.py + e.nu.py, pz: e.lep.pz + e.nu.pz }));
      n++;
      if (Math.abs(sol.pz - e.nu.pz) < 1e-3) hit++;
    }
    // the smaller-|pz| root is the right one in a large fraction of events, not all of them
    expect(hit / n).toBeGreaterThan(0.4);
    expect(hit / n).toBeLessThan(0.95);
  });
  test('a negative discriminant gives the real part', () => {
    const lep = { E: 40, px: 40, py: 0, pz: 0 };
    const sol = neutrinoPz(lep, { x: -300, y: 0 }, 80.4);
    expect(sol.complex).toBe(true);
    expect(Number.isFinite(sol.pz)).toBe(true);
  });
});

function asJets(e: ReturnType<typeof partons>, extra: P4[], seed: number): { jets: TopJet[]; truth: Record<string, number> } {
  const r = rng(seed);
  const list: { p: P4; btag: number; role: string }[] = [
    { p: e.bLep, btag: 0.9, role: 'bLep' }, { p: e.bHad, btag: 0.9, role: 'bHad' }, { p: e.q1, btag: 0.05, role: 'q' }, { p: e.q2, btag: 0.05, role: 'q' },
    ...extra.map((p) => ({ p, btag: 0.05, role: 'x' })),
  ];
  // shuffle
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  const truth: Record<string, number> = {};
  list.forEach((x, i) => { if (x.role === 'bLep' || x.role === 'bHad') truth[x.role] = i; });
  return { jets: list.map((x) => ({ p: x.p, btag: x.btag })), truth };
}

describe('the reference assignment', () => {
  test('the number of assignments', () => {
    expect([4, 5, 6, 7].map(assignmentCount)).toEqual([12, 60, 180, 420]);
  });
  test('fewer than four jets: null', () => {
    const e = partons(1);
    expect(assignTopJetsReference([{ p: e.bLep, btag: 1 }, { p: e.bHad, btag: 1 }, { p: e.q1, btag: 0 }], e.lep, { x: e.nu.px, y: e.nu.py })).toBeNull();
  });
  test('the chi² is the formula: brute force agrees', () => {
    const e = partons(5);
    const { jets } = asJets(e, [fromPtEtaPhiM(30, 0.4, 1.0, 5), fromPtEtaPhiM(28, -1.0, -2.0, 4)], 3);
    const a = assignTopJetsReference(jets, e.lep, { x: e.nu.px, y: e.nu.py })!;
    expect(a.q1).toBeLessThan(a.q2);
    expect(new Set([a.bLep, a.bHad, a.q1, a.q2]).size).toBe(4);
    const nu = neutrinoPz(e.lep, { x: e.nu.px, y: e.nu.py });
    const pt = Math.hypot(e.nu.px, e.nu.py);
    const n4: P4 = { E: Math.hypot(pt, nu.pz), px: e.nu.px, py: e.nu.py, pz: nu.pz };
    const sum = (...ps: P4[]) => ps.reduce((s, p) => ({ E: s.E + p.E, px: s.px + p.px, py: s.py + p.py, pz: s.pz + p.pz }), { E: 0, px: 0, py: 0, pz: 0 });
    const chi = (bl: number, bh: number, q1: number, q2: number) =>
      ((mass(sum(jets[q1]!.p, jets[q2]!.p)) - TOP_CHI2.mW) / TOP_CHI2.sigmaW) ** 2 +
      ((mass(sum(jets[q1]!.p, jets[q2]!.p, jets[bh]!.p)) - TOP_CHI2.mT) / TOP_CHI2.sigmaT) ** 2 +
      ((mass(sum(e.lep, n4, jets[bl]!.p)) - TOP_CHI2.mT) / TOP_CHI2.sigmaT) ** 2;
    expect(a.chi2).toBeCloseTo(chi(a.bLep, a.bHad, a.q1, a.q2), 8);
    let min = Infinity;
    for (let bl = 0; bl < 6; bl++) for (let bh = 0; bh < 6; bh++) for (let q1 = 0; q1 < 6; q1++) for (let q2 = q1 + 1; q2 < 6; q2++) {
      if (new Set([bl, bh, q1, q2]).size === 4) min = Math.min(min, chi(bl, bh, q1, q2));
    }
    expect(a.chi2).toBeCloseTo(min, 8);
  });
  test('with exact four-vectors the true assignment is found in most events (parton level)', () => {
    let ok = 0, n = 0;
    for (let s = 1; s <= 60; s++) {
      const e = partons(200 + s);
      const { jets, truth } = asJets(e, [], s);
      const a = assignTopJetsReference(jets, e.lep, { x: e.nu.px, y: e.nu.py })!;
      n++;
      if (a.bLep === truth.bLep && a.bHad === truth.bHad) ok++;
    }
    expect(ok / n).toBeGreaterThan(0.7);
  });
  test('with a large penalty the two b jets are the tagged ones', () => {
    for (let s = 1; s <= 30; s++) {
      const e = partons(300 + s);
      const { jets, truth } = asJets(e, [fromPtEtaPhiM(30, 0.4, 1.0, 5), fromPtEtaPhiM(28, -1.0, -2.0, 4)], s);
      const a = assignTopJetsReference(jets, e.lep, { x: e.nu.px, y: e.nu.py }, { btagPenalty: 1e3 })!;
      expect(new Set([a.bLep, a.bHad])).toEqual(new Set([truth.bLep, truth.bHad]));
    }
  });
  test('maxJets limits the jets considered', () => {
    const e = partons(9);
    const { jets } = asJets(e, [fromPtEtaPhiM(30, 0.4, 1.0, 5), fromPtEtaPhiM(28, -1.0, -2.0, 4)], 1);
    const a = assignTopJetsReference(jets, e.lep, { x: e.nu.px, y: e.nu.py }, { maxJets: 4 })!;
    for (const i of [a.bLep, a.bHad, a.q1, a.q2]) expect(i).toBeLessThan(4);
  });
  test('the hook is honoured', () => {
    const e = partons(11);
    const { jets } = asJets(e, [], 2);
    setOverride('reco.assignTopJets', () => ({ bLep: 0, bHad: 1, q1: 2, q2: 3, chi2: 123, mW: 0, mTopHad: 0, mTopLep: 0, nuPz: 0 }));
    expect(assignTopJets(jets, e.lep, { x: e.nu.px, y: e.nu.py })!.chi2).toBe(123);
    setOverride('reco.assignTopJets', undefined);
    expect(assignTopJets(jets, e.lep, { x: e.nu.px, y: e.nu.py })!.chi2).not.toBe(123);
  });
});

describe('selection', () => {
  test('one isolated lepton, four jets and missing momentum', () => {
    const mk = (kind: string, pt: number, eta: number, phi: number, extra = {}) => ({ kind, p: fromPtEtaPhiM(pt, eta, phi, 0.1), ...extra });
    const objs = [mk('muon', 40, 0.2, 0.1, { charge: -1, isolation: 0.02 }), mk('jet', 80, 0.1, 1, { btag: 0.9 }), mk('jet', 60, -1, 2), mk('jet', 40, 1.5, -2), mk('jet', 30, 0.3, -1)];
    expect(selectLeptonJets(objs, { x: 30, y: 10 })).not.toBeNull();
    expect(selectLeptonJets(objs, { x: 3, y: 1 })).toBeNull();
    expect(selectLeptonJets(objs.slice(0, 4), { x: 30, y: 10 })).toBeNull();
    expect(selectLeptonJets([...objs, mk('electron', 30, 0.5, 2, { isolation: 0.01 })], { x: 30, y: 10 })).toBeNull();
  });
});
