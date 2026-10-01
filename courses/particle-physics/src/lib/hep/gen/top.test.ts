import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { charge, particle } from '../particles/index.ts';
import { invariantMass, mass, toRestFrame } from '../kinematics/index.ts';
import { M_T, M_W } from '../sm/index.ts';
import { crossSection } from './integrate.ts';
import { colourFlowValid, conservation } from './process.ts';
import { kFactorFor } from './higgs.ts';
import { sigmaHatGG, sigmaHatQQ, topDecayBranching, topMatrixElements, ttbar } from './top.ts';
import type { TruthEvent } from '../event/index.ts';

describe('tt̄ matrix elements and cross-sections', () => {
  test('the closed-form σ̂(qq̄) and σ̂(gg) equal the integral of dσ̂/dt̂ over the angle (two independent formulas)', () => {
    const m = M_T;
    for (const f of [1.05, 1.5, 3, 10, 100]) {
      const s = 4 * m * m * f;
      const beta = Math.sqrt(1 - (4 * m * m) / s);
      let qq = 0, gg = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) {
        const c = -1 + (2 * (i + 0.5)) / n;
        const me = topMatrixElements(s, m, c);
        // dσ̂/dcosθ = (β ŝ/2) π/ŝ² Σ|M|²  (αs = 1)
        qq += ((beta * s) / 2) * (Math.PI / (s * s)) * me.qq * (2 / n);
        gg += ((beta * s) / 2) * (Math.PI / (s * s)) * me.gg * (2 / n);
      }
      expect(qq / sigmaHatQQ(s, m)).toBeCloseTo(1, 5);
      expect(gg / sigmaHatGG(s, m)).toBeCloseTo(1, 5);
    }
  });
  test('massless limit of the tt̄ elements reproduces the QCD qq̄ → q′q̄′ and gg → qq̄ elements', () => {
    const s = 1e6, m = 1e-3;
    const c = 0.3;
    const t = (-s * (1 - c)) / 2, u = (-s * (1 + c)) / 2;
    const me = topMatrixElements(s, m, c);
    expect(me.qq / ((4 / 9) * (t * t + u * u) / (s * s))).toBeCloseTo(1, 6);
    expect(me.gg / ((1 / 6) * (t * t + u * u) / (t * u) - (3 / 8) * (t * t + u * u) / (s * s))).toBeCloseTo(1, 6);
  });
  const T = ttbar();
  test('σ(pp → tt̄) at 13 TeV is about 440 pb at leading order (the recommended NNLO+NNLL value, 831.8 pb quoted from memory, needs K ≈ 1.9)', () => {
    expect(T.sigma(13000)).toBeGreaterThan(350);
    expect(T.sigma(13000)).toBeLessThan(550);
    expect(kFactorFor(T, 13000, 831.76)).toBeGreaterThan(1.5);
    expect(kFactorFor(T, 13000, 831.76)).toBeLessThan(2.3);
    expect(T.sigma(14000)).toBeGreaterThan(T.sigma(13000));
    expect(T.sigma(13000)).toBeGreaterThan(4 * T.sigma(7000));
  });
  test('gluon fusion dominates at the LHC (≈ 85–90 %), quark annihilation at the Tevatron', () => {
    const r = rng(1);
    let gg = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (T.generate(r, { sqrtS: 13000 }).event.particles[2]!.pdg === 21) gg++;
    expect(gg / n).toBeGreaterThan(0.75);
    const tev = ttbar({ beams: 'ppbar' });
    let q = 0;
    for (let i = 0; i < n; i++) if (tev.generate(r, { sqrtS: 1960 }).event.particles[2]!.pdg !== 21) q++;
    expect(q / n).toBeGreaterThan(0.7);
  });
  test('Monte Carlo agrees with the quadrature (pull < 4)', () => {
    for (const p of [T, ttbar({ beams: 'ppbar' })]) {
      const c = crossSection(p, p.beams === 'pp' ? 13000 : 1960, 40000, rng(2));
      expect(Math.abs(c.pull!)).toBeLessThan(4);
    }
  });
});

describe('t → W b and the W decays', () => {
  test('decay branching factors from the W table: ee/eμ/μμ 4.5 %, ℓ+jets 28.7 %, all-jets 45 %', () => {
    expect(topDecayBranching('inclusive')).toBe(1);
    expect(topDecayBranching('dilepton')).toBeCloseTo((0.2134 / 1.0012) ** 2, 4);
    expect(topDecayBranching('leptonjets')).toBeCloseTo(2 * (0.2134 / 1.0012) * (0.674 / 1.0012), 4);
    expect(topDecayBranching('hadronic')).toBeCloseTo((0.674 / 1.0012) ** 2, 4);
    const tot = ttbar().sigma(13000);
    expect(ttbar({ decay: 'dilepton' }).sigma(13000) / tot).toBeCloseTo(topDecayBranching('dilepton'), 10);
  });
  const finalsOf = (ev: TruthEvent) => ev.particles.filter((p) => p.status === 'final');
  test('dilepton events: two b, two charged leptons (e or μ) of opposite charge, two neutrinos', () => {
    const p = ttbar({ decay: 'dilepton' });
    const r = rng(3);
    for (let i = 0; i < 300; i++) {
      const fin = finalsOf(p.generate(r, { sqrtS: 13000 }).event);
      expect(fin.length).toBe(6);
      expect(fin.filter((q) => Math.abs(q.pdg) === 5).length).toBe(2);
      const ch = fin.filter((q) => [11, 13].includes(Math.abs(q.pdg)));
      expect(ch.length).toBe(2);
      expect(ch[0]!.pdg * ch[1]!.pdg).toBeLessThan(0);
      expect(fin.filter((q) => [12, 14].includes(Math.abs(q.pdg))).length).toBe(2);
    }
  });
  test('ℓ+jets: one charged lepton, one neutrino, four quarks; all-jets: six quarks; inclusive: any', () => {
    const r = rng(4);
    const lj = ttbar({ decay: 'leptonjets' });
    const had = ttbar({ decay: 'hadronic' });
    for (let i = 0; i < 200; i++) {
      const f = finalsOf(lj.generate(r, { sqrtS: 13000 }).event);
      expect(f.filter((q) => [11, 13].includes(Math.abs(q.pdg))).length).toBe(1);
      expect(f.filter((q) => Math.abs(q.pdg) <= 5).length).toBe(4); // 2 b + 2 light
      const h = finalsOf(had.generate(r, { sqrtS: 13000 }).event);
      expect(h.length).toBe(6);
      expect(h.every((q) => Math.abs(q.pdg) <= 5)).toBe(true);
    }
  });
  test('the tops are on shell, the W mass is Breit–Wigner distributed around 80.4 GeV, (W b) gives back the top mass exactly', () => {
    const p = ttbar({ decay: 'dilepton' });
    const r = rng(5);
    const mw: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const { event } = p.generate(r, { sqrtS: 13000 });
      const t = event.particles.find((q) => q.pdg === 6)!;
      expect(mass(t.p)).toBeCloseTo(M_T, 7);
      const kids = t.daughters.map((k) => event.particles[k]!);
      expect(invariantMass(kids.map((k) => k.p))).toBeCloseTo(M_T, 6);
      const W = kids.find((k) => Math.abs(k.pdg) === 24)!;
      mw.push(mass(W.p));
    }
    mw.sort((a, b) => a - b);
    expect(mw[2000]).toBeGreaterThan(M_W - 0.3);
    expect(mw[2000]).toBeLessThan(M_W + 0.3);
  });
  test('W helicity fractions F₀ = 0.70, F_L = 0.30, F_R = 0: ⟨cosθ*⟩ = −F_L/2 = −0.15 for ℓ⁺ from t and +0.15 for ℓ⁻ from t̄', () => {
    const p = ttbar({ decay: 'dilepton' });
    const r = rng(6);
    let cp = 0, cm = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const ev = p.generate(r, { sqrtS: 13000 }).event;
      const cs = (topPdg: number, wPdg: number) => {
        const t = ev.particles.find((q) => q.pdg === topPdg)!;
        const w = ev.particles.find((q) => q.pdg === wPdg)!;
        const l = ev.particles.find((q) => q.mothers[0] === w.id && Math.abs(q.pdg) % 2 === 1)!;
        const wt = toRestFrame(w.p, t.p), lt = toRestFrame(l.p, t.p);
        const lw = toRestFrame(lt, wt);
        return (lw.px * wt.px + lw.py * wt.py + lw.pz * wt.pz) / (Math.hypot(wt.px, wt.py, wt.pz) * Math.hypot(lw.px, lw.py, lw.pz));
      };
      cp += cs(6, 24);
      cm += cs(-6, -24);
    }
    const fL = (2 * M_W ** 2) / (M_T ** 2 + 2 * M_W ** 2);
    expect(Math.abs(cp / n + fL / 2)).toBeLessThan(0.012);
    expect(Math.abs(cm / n - fL / 2)).toBeLessThan(0.012);
  });
  test('conservation (1e-9) and valid colour flow in every decay channel; τ left for the decay stage', () => {
    const r = rng(7);
    for (const d of ['inclusive', 'dilepton', 'leptonjets', 'hadronic'] as const) {
      const p = ttbar({ decay: d });
      for (let i = 0; i < 150; i++) {
        const { event } = p.generate(r, { sqrtS: 13000 });
        const c = conservation(event, charge);
        expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
        expect(Math.abs(c.dpx)).toBeLessThan(1e-9 * 13000);
        expect(Math.abs(c.dpy)).toBeLessThan(1e-9 * 13000);
        expect(Math.abs(c.dpz)).toBeLessThan(1e-9 * 13000);
        expect(c.dCharge).toBe(0);
        expect(colourFlowValid(event)).toBe(true);
      }
    }
    const taus = new Set<number>();
    const p = ttbar();
    for (let i = 0; i < 600; i++) for (const q of p.generate(r, { sqrtS: 13000 }).event.particles) if (Math.abs(q.pdg) === 15) taus.add(q.status === 'final' ? 1 : 0);
    expect([...taus]).toEqual([1]);
    expect(particle(15).decays.length).toBeGreaterThan(0);
  });
});
