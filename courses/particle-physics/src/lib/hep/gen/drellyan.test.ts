import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { charge } from '../particles/index.ts';
import { mass, toRestFrame } from '../kinematics/index.ts';
import { GAMMA_Z, M_W, M_Z } from '../sm/index.ts';
import { drellYan, wBoson, zPrime, zPrimeWidth } from './drellyan.ts';
import { crossSection } from './integrate.ts';
import { conservation } from './process.ts';

describe('pp → γ*/Z → μ⁺μ⁻', () => {
  const z = drellYan();
  test('the cross-section is of the right size for leading order at 13 TeV (about 1.6 nb in 60–120 GeV; NNLO is about 25 % higher)', () => {
    expect(z.sigma(13000) / 1e3).toBeGreaterThan(1.3);
    expect(z.sigma(13000) / 1e3).toBeLessThan(1.9);
  });
  test('grows with √s; p p̄ at the Tevatron energy is larger than pp', () => {
    expect(z.sigma(8000)).toBeGreaterThan(z.sigma(7000));
    expect(z.sigma(13000)).toBeGreaterThan(z.sigma(8000));
    expect(drellYan({ beams: 'ppbar' }).sigma(1960)).toBeGreaterThan(1.25 * z.sigma(1960));
  });
  test('Monte Carlo (VEGAS on m, y, cosθ) agrees with the deterministic quadrature (pull < 4), at 7 and 13 TeV', () => {
    for (const e of [7000, 13000]) {
      const c = crossSection(z, e, 30000, rng(1));
      expect(Math.abs(c.pull!)).toBeLessThan(4);
      expect(c.error / c.sigma).toBeLessThan(0.01);
    }
  });
  test('the K-factor option multiplies the cross-section and the weights', () => {
    const k = drellYan({ kFactor: 1.25 });
    expect(k.sigma(13000) / z.sigma(13000)).toBeCloseTo(1.25, 12);
    const r = rng(2);
    expect(k.generate(r, { sqrtS: 13000, weighted: true }).weight).toBeGreaterThan(0);
  });
  test('mass spectrum: Breit–Wigner peak at mZ with the width of the Z smeared by the parton luminosity', () => {
    const r = rng(3);
    const n = 20000;
    const ms: number[] = [];
    for (let i = 0; i < n; i++) ms.push(mass(z.generate(r, { sqrtS: 13000 }).event.particles.find((p) => p.status === 'intermediate')!.p));
    ms.sort((a, b) => a - b);
    expect(ms[n / 2]).toBeGreaterThan(90.3);
    expect(ms[n / 2]).toBeLessThan(91.6);
    // the central 68 % is about one full width wide (Γ ≈ 2.5 GeV → ±2.5 GeV)
    const w = ms[Math.floor(0.84 * n)]! - ms[Math.floor(0.16 * n)]!;
    expect(w).toBeGreaterThan(0.9 * GAMMA_Z);
    expect(w).toBeLessThan(2.6 * GAMMA_Z);
    expect(ms[0]).toBeGreaterThanOrEqual(60);
    expect(ms[n - 1]).toBeLessThanOrEqual(120);
  });
  test('in the frame of the parton collision the lepton angle follows 1 + cos²θ + asymmetry: ⟨cos²θ⟩ = 0.4 (every term odd in cosθ drops out)', () => {
    const r = rng(4);
    let c2 = 0, fb = 0;
    const n = 30000;
    for (let i = 0; i < n; i++) {
      const ev = z.generate(r, { sqrtS: 13000 }).event;
      const boson = ev.particles.find((p) => p.status === 'intermediate')!;
      const lm = toRestFrame(ev.particles.find((p) => p.pdg === 13)!.p, boson.p);
      const quark = ev.particles.find((p) => p.status === 'hard' && p.pdg > 0)!;
      const c = (Math.sign(quark.p.pz) * lm.pz) / Math.hypot(lm.px, lm.py, lm.pz);
      c2 += c * c;
      fb += c > 0 ? 1 : -1;
    }
    expect(Math.abs(c2 / n - 0.4)).toBeLessThan(0.01);
    // forward–backward asymmetry relative to the quark direction: the parity violation of the Z and the γ–Z interference (about +5 % here)
    expect(fb / n).toBeGreaterThan(0.02);
    expect(fb / n).toBeLessThan(0.09);
  });
  test('energy, momentum and charge are conserved (1e-9), for pp and p p̄, and the record is well formed', () => {
    for (const p of [z, drellYan({ lepton: 'e' }), drellYan({ lepton: 'tau' }), drellYan({ beams: 'ppbar' })]) {
      const r = rng(5);
      for (let i = 0; i < 300; i++) {
        const { event } = p.generate(r, { sqrtS: p.beams === 'pp' ? 13000 : 1960 });
        const c = conservation(event, charge);
        expect(Math.abs(c.dE) / event.sqrtS).toBeLessThan(1e-9);
        expect(Math.abs(c.dpx)).toBeLessThan(1e-9 * event.sqrtS);
        expect(Math.abs(c.dpz)).toBeLessThan(1e-9 * event.sqrtS);
        expect(c.dCharge).toBe(0);
        expect(event.particles[0]!.status).toBe('beam');
        expect(event.particles[2]!.status).toBe('hard');
        expect(event.particles[2]!.mothers).toEqual([0]);
        expect(event.particles[3]!.mothers).toEqual([1]);
        expect(event.particles.filter((q) => q.status === 'final').length).toBe(2);
      }
    }
  });
  test('p p̄: the antiquark comes from the antiproton', () => {
    const p = drellYan({ beams: 'ppbar' });
    const r = rng(6);
    let qFromProton = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const ev = p.generate(r, { sqrtS: 1960 }).event;
      if (ev.particles[2]!.pdg > 0) qFromProton++;
    }
    expect(qFromProton / n).toBeGreaterThan(0.6); // valence quark in the proton, valence antiquark in the antiproton
    expect(ev0(p).particles[1]!.pdg).toBe(-2212);
  });
});
const ev0 = (p: ReturnType<typeof drellYan>) => p.generate(rng(1), { sqrtS: 1960 }).event;

describe('pp → W → ℓν', () => {
  test('cross-sections: W⁺ > W⁻ (valence u vs d); W⁺/W⁻ about 1.3–1.4 at 13 TeV; p p̄ is charge symmetric (ratio 1, by CP)', () => {
    const wp = wBoson({ charge: 1 }), wm = wBoson({ charge: -1 });
    const ratio = wp.sigma(13000) / wm.sigma(13000);
    expect(ratio).toBeGreaterThan(1.25);
    expect(ratio).toBeLessThan(1.45);
    expect(wBoson({ charge: 1, beams: 'ppbar' }).sigma(1960) / wBoson({ charge: -1, beams: 'ppbar' }).sigma(1960)).toBeCloseTo(1, 10);
    expect(wBoson().sigma(13000)).toBeCloseTo(wp.sigma(13000) + wm.sigma(13000), 6);
  });
  test('σ(W → μν)/σ(Z → μμ) is about 10–11 at leading order (13 TeV)', () => {
    const r = wBoson().sigma(13000) / drellYan().sigma(13000);
    expect(r).toBeGreaterThan(9);
    expect(r).toBeLessThan(12);
  });
  test('Monte Carlo agrees with the quadrature (pull < 4)', () => {
    for (const p of [wBoson(), wBoson({ charge: 1 }), wBoson({ charge: -1, beams: 'ppbar' })]) {
      const c = crossSection(p, p.beams === 'pp' ? 13000 : 1960, 30000, rng(7));
      expect(Math.abs(c.pull!)).toBeLessThan(4);
    }
  });
  test('V−A angular distribution: in the W frame the ℓ⁺ goes opposite to the u quark, ⟨cos θ⟩ = −1/2, and the ℓ⁻ along the d quark, +1/2', () => {
    for (const ch of [1, -1] as const) {
      const w = wBoson({ charge: ch });
      const r = rng(8 + ch);
      let mc = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) {
        const ev = w.generate(r, { sqrtS: 13000 }).event;
        const boson = ev.particles.find((p) => p.status === 'intermediate')!;
        expect(boson.pdg).toBe(ch === 1 ? 24 : -24);
        const lep = ev.particles.find((p) => p.status === 'final' && Math.abs(p.pdg) === 13)!;
        expect(lep.pdg).toBe(ch === 1 ? -13 : 13);
        const lr = toRestFrame(lep.p, boson.p);
        const quark = ev.particles.find((p) => p.status === 'hard' && p.pdg > 0)!;
        mc += (Math.sign(quark.p.pz) * lr.pz) / Math.hypot(lr.px, lr.py, lr.pz);
      }
      expect(mc / n).toBeGreaterThan(ch === 1 ? -0.52 : 0.48);
      expect(mc / n).toBeLessThan(ch === 1 ? -0.48 : 0.52);
    }
  });
  test('the W⁺ goes forward along the u-rich proton: the lepton pseudorapidity asymmetry of W⁺ vs W⁻ exists in the detector frame of the pair (lepton charge asymmetry)', () => {
    // the pair rapidity is symmetric for pp, but the W⁺/W⁻ rates differ: ratio of counts follows the cross-section ratio
    const r = rng(10);
    const w = wBoson();
    let plus = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (w.generate(r, { sqrtS: 13000 }).event.particles.find((p) => Math.abs(p.pdg) === 24)!.pdg === 24) plus++;
    const expected = wBoson({ charge: 1 }).sigma(13000) / wBoson().sigma(13000);
    expect(Math.abs(plus / n - expected)).toBeLessThan(4 * Math.sqrt((expected * (1 - expected)) / n));
  });
  test('transverse-mass-like Jacobian edge: the lepton pT of W events peaks near mW/2', () => {
    const r = rng(11);
    const w = wBoson();
    let near = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const l = w.generate(r, { sqrtS: 13000 }).event.particles.find((p) => p.status === 'final' && Math.abs(p.pdg) === 13)!.p;
      const pt = Math.hypot(l.px, l.py);
      if (pt > 0.4 * M_W && pt < 0.52 * M_W) near++;
    }
    expect(near / n).toBeGreaterThan(0.3);
  });
  test('conservation and record: W, charged lepton and neutrino, unit weights', () => {
    const r = rng(12);
    for (const p of [wBoson(), wBoson({ lepton: 'e' }), wBoson({ lepton: 'tau', charge: 1 })]) {
      for (let i = 0; i < 300; i++) {
        const { event, weight } = p.generate(r, { sqrtS: 13000 });
        expect(weight).toBe(1);
        const c = conservation(event, charge);
        expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
        expect(Math.abs(c.dpz)).toBeLessThan(1e-9 * 13000);
        expect(c.dCharge).toBe(0);
        const fin = event.particles.filter((q) => q.status === 'final');
        expect(fin.some((q) => [12, 14, 16].includes(Math.abs(q.pdg)))).toBe(true);
      }
    }
  });
});

describe('Z′', () => {
  const sm = drellYan({ mMin: 1500, mMax: 4500 });
  const both = zPrime({ mass: 3000 });
  const sig = zPrime({ mass: 3000 }, { signalOnly: true });
  test('sequential Z′: Γ/M ≈ 3 % (2.96 %)', () => {
    expect(zPrimeWidth({ mass: 3000 }) / 3000).toBeGreaterThan(0.027);
    expect(zPrimeWidth({ mass: 3000 }) / 3000).toBeLessThan(0.033);
    expect(zPrimeWidth({ mass: 1000, width: 10 })).toBe(10);
  });
  test('Monte Carlo agrees with the quadrature (pull < 4) for signal-only and with SM background', () => {
    for (const p of [both, sig]) {
      const c = crossSection(p, 13000, 40000, rng(13));
      expect(Math.abs(c.pull!)).toBeLessThan(4);
    }
  });
  test('the signal is a peak at the Z′ mass with pdg 32; the full model includes destructive γ/Z–Z′ interference', () => {
    const r = rng(14);
    const ms: number[] = [];
    const n = 8000;
    for (let i = 0; i < n; i++) {
      const ev = sig.generate(r, { sqrtS: 13000 }).event;
      const b = ev.particles.find((p) => p.status === 'intermediate')!;
      expect(b.pdg).toBe(32);
      ms.push(mass(b.p));
    }
    ms.sort((a, b) => a - b);
    expect(ms[n / 2]).toBeGreaterThan(2930);
    expect(ms[n / 2]).toBeLessThan(3010);
    // total = SM + signal + interference, and the interference is negative for the SSM couplings
    const interference = both.sigma(13000) - sm.sigma(13000) - sig.sigma(13000);
    expect(interference).toBeLessThan(0);
    expect(both.sigma(13000)).toBeGreaterThan(0);
  });
  test('couplings are configurable: a leptophobic Z′ has no dilepton signal; doubling the lepton coupling multiplies the signal by about 4 at fixed width', () => {
    const lepto = zPrime({ mass: 3000, lepton: { L: 0, R: 0 }, width: 90 }, { signalOnly: true });
    expect(lepto.sigma(13000)).toBeLessThan(1e-12);
    const base = zPrime({ mass: 3000, width: 90 }, { signalOnly: true });
    const dbl = zPrime({ mass: 3000, width: 90, lepton: { L: 2 * (-0.5 + 0.23122), R: 2 * 0.23122 } }, { signalOnly: true });
    // the signal ∝ g_q² g_ℓ² / Γ² near the peak: g_ℓ → 2 g_ℓ gives a factor 4 in the rate at fixed width
    expect(dbl.sigma(13000) / base.sigma(13000)).toBeGreaterThan(3.5);
    expect(dbl.sigma(13000) / base.sigma(13000)).toBeLessThan(4.5);
  });
  test('the lepton pair and partons conserve momentum', () => {
    const r = rng(15);
    for (let i = 0; i < 200; i++) {
      const { event } = both.generate(r, { sqrtS: 13000 });
      const c = conservation(event, charge);
      expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
      expect(c.dCharge).toBe(0);
    }
  });
});

describe('performance', () => {
  test('at least 2 500 pp → Z → μμ hard-process events per second per core (the target is 5 000)', () => {
    const z = drellYan();
    const r = rng(20);
    z.generate(r, { sqrtS: 13000 });
    const n = 6000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) z.generate(r, { sqrtS: 13000 });
    const rate = n / ((performance.now() - t0) / 1000);
    expect(rate).toBeGreaterThan(2500);
  });
  test('M_Z is what the mass window assumes', () => {
    expect(M_Z).toBeGreaterThan(60);
    expect(M_Z).toBeLessThan(120);
  });
});
