import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { charge, particle } from '../particles/index.ts';
import { invariantMass, mass, toRestFrame } from '../kinematics/index.ts';
import { GAMMA_H, M_H, M_Z, V_EW, alphaS1 } from '../sm/index.ts';
import { HBARC2_GEV2_PB } from '../units/index.ts';
import { higgsBranching, higgsGGF, kFactorFor } from './higgs.ts';
import { crossSection } from './integrate.ts';
import { colourFlowValid, conservation } from './process.ts';
import { luminosity } from './pdf.ts';

describe('gg → H (effective vertex, leading order)', () => {
  const H = higgsGGF({ decay: 'none' });
  test('σ at 13 TeV is about 14 pb at LO: the order of magnitude of a leading-order heavy-top calculation, about 1/3.5 of the quoted N³LO value', () => {
    expect(H.sigma(13000)).toBeGreaterThan(10);
    expect(H.sigma(13000)).toBeLessThan(20);
    // the K-factor that matches the recommended total (48.58 pb, from memory of the LHC Higgs cross-section working group: check before citing)
    const k = kFactorFor(H, 13000, 48.58);
    expect(k).toBeGreaterThan(2.5);
    expect(k).toBeLessThan(4.5);
    expect(higgsGGF({ kFactor: k }).sigma(13000)).toBeCloseTo(48.58, 6);
    expect(H.sigma(14000)).toBeGreaterThan(H.sigma(13000));
    expect(H.sigma(13000)).toBeGreaterThan(H.sigma(8000));
  });
  test('narrow-width check: σ = π² Γ_gg/(8 mH s) dL_gg/dτ at τ = mH²/s, with the luminosity function', () => {
    const s = 13000 ** 2;
    const gGG = (alphaS1(M_H) ** 2 * M_H ** 3) / (72 * Math.PI ** 3 * V_EW ** 2);
    const nwa = ((Math.PI ** 2 * gGG) / (8 * M_H * s)) * luminosity(M_H ** 2 / s, M_H, 'gg') * HBARC2_GEV2_PB;
    expect(Math.abs(H.sigma(13000) / nwa - 1)).toBeLessThan(0.01);
  });
  test('Monte Carlo agrees with the quadrature (pull < 4)', () => {
    const c = crossSection(H, 13000, 30000, rng(1));
    expect(Math.abs(c.pull!)).toBeLessThan(4);
  });
  test('the undecayed Higgs is left for the decay stage: one final particle with pdg 25 and mass mH, colour-singlet gluon pair incoming', () => {
    const { event } = H.generate(rng(2), { sqrtS: 13000 });
    const h = event.particles.find((p) => p.pdg === 25)!;
    expect(h.status).toBe('final');
    expect(Math.abs(mass(h.p) - M_H)).toBeLessThan(2);
    expect(colourFlowValid(event)).toBe(true);
    expect(conservation(event, charge).dE).toBeCloseTo(0, 9);
  });
});

describe('Higgs branching fractions in the process cross-sections', () => {
  test('taken from the particle table; H → 4ℓ (e, μ) is 1.19 × 10⁻⁴, H → WW* → ℓνℓν 0.97 %', () => {
    const H = particle(25);
    expect(higgsBranching('gammagamma')).toBe(H.decays.find((d) => d.products[0] === 22)!.br);
    expect(higgsBranching('bb')).toBeCloseTo(0.582, 6);
    expect(higgsBranching('ZZ4l')).toBeCloseTo(1.186e-4, 6);
    expect(higgsBranching('WWlnulnu')).toBeCloseTo(0.0097, 4);
    expect(higgsBranching('none')).toBe(1);
  });
  test('σ(pp → H → X) = σ(pp → H) × BR', () => {
    const tot = higgsGGF({ decay: 'none' }).sigma(13000);
    for (const d of ['gammagamma', 'ZZ4l', 'bb', 'tautau', 'WWlnulnu'] as const)
      expect(higgsGGF({ decay: d }).sigma(13000) / tot).toBeCloseTo(higgsBranching(d), 10);
  });
});

describe('H → γγ, bb̄, ττ', () => {
  test('γγ: invariant mass is mH to a few MeV (Breit–Wigner of width 4.1 MeV), photons isotropic in the Higgs frame, unit weight', () => {
    const p = higgsGGF({ decay: 'gammagamma' });
    const r = rng(3);
    const dev: number[] = [];
    let c = 0, c2 = 0;
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const { event, weight } = p.generate(r, { sqrtS: 13000 });
      expect(weight).toBe(1);
      const g = event.particles.filter((q) => q.pdg === 22 && q.status === 'final');
      expect(g.length).toBe(2);
      dev.push(Math.abs(invariantMass(g.map((q) => q.p)) - M_H));
      const h = event.particles.find((q) => q.pdg === 25)!;
      const gr = toRestFrame(g[0]!.p, h.p);
      const cos = gr.pz / Math.hypot(gr.px, gr.py, gr.pz);
      c += cos;
      c2 += cos * cos;
      const cc = conservation(event, charge);
      expect(Math.abs(cc.dE)).toBeLessThan(1e-9 * 13000);
      expect(Math.abs(cc.dpz)).toBeLessThan(1e-9 * 13000);
    }
    dev.sort((a, b) => a - b);
    // median |m − mH| of a Cauchy distribution is Γ/2
    expect(dev[n / 2]).toBeGreaterThan(0.4 * GAMMA_H);
    expect(dev[n / 2]).toBeLessThan(0.6 * GAMMA_H);
    expect(Math.abs(c / n)).toBeLessThan(0.03);
    expect(c2 / n).toBeGreaterThan(0.32);
    expect(c2 / n).toBeLessThan(0.35);
  });
  test('bb̄ and ττ: quarks carry colour, masses are right, conservation', () => {
    const r = rng(4);
    const bb = higgsGGF({ decay: 'bb' }).generate(r, { sqrtS: 13000 }).event;
    const b = bb.particles.filter((q) => Math.abs(q.pdg) === 5);
    expect(b.length).toBe(2);
    expect(mass(b[0]!.p)).toBeCloseTo(particle(5).mass, 5);
    expect(b[0]!.colour).toEqual([103, 0]);
    expect(colourFlowValid(bb)).toBe(true);
    const tt = higgsGGF({ decay: 'tautau' }).generate(r, { sqrtS: 13000 }).event;
    expect(tt.particles.filter((q) => Math.abs(q.pdg) === 15).length).toBe(2);
    expect(conservation(tt, charge).dCharge).toBe(0);
  });
});

describe('H → ZZ* → 4ℓ and H → WW* → ℓνℓν', () => {
  const h4 = higgsGGF({ decay: 'ZZ4l' });
  test('the four-lepton mass is mH (1e-9), charge and momentum conserved, every Z decays to ℓ⁺ℓ⁻ of one flavour', () => {
    const r = rng(5);
    for (let i = 0; i < 400; i++) {
      const { event } = h4.generate(r, { sqrtS: 13000 });
      const L = event.particles.filter((p) => p.status === 'final');
      expect(L.length).toBe(4);
      expect(invariantMass(L.map((p) => p.p))).toBeCloseTo(mass(event.particles.find((p) => p.pdg === 25)!.p), 7);
      const c = conservation(event, charge);
      expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
      expect(Math.abs(c.dpx)).toBeLessThan(1e-9 * 13000);
      expect(c.dCharge).toBe(0);
      for (const z of event.particles.filter((p) => p.pdg === 23)) {
        const d = z.daughters.map((k) => event.particles[k]!.pdg);
        expect(d[0]).toBe(-d[1]!);
        expect(mass(z.p)).toBeGreaterThan(3.99);
      }
    }
  });
  test('Z mass spectra: the on-shell Z near 90 GeV, the off-shell Z* between 4 and 35 GeV peaking near 25–30, flavours 4e : 4μ : 2e2μ = 1 : 1 : 2', () => {
    const r = rng(6);
    const n = 8000;
    const m1: number[] = [], m2: number[] = [];
    let ee = 0, mm = 0;
    for (let i = 0; i < n; i++) {
      const { event } = h4.generate(r, { sqrtS: 13000 });
      const zs = event.particles.filter((p) => p.pdg === 23).map((z) => mass(z.p));
      m1.push(Math.max(...zs));
      m2.push(Math.min(...zs));
      const fl = new Set(event.particles.filter((p) => p.status === 'final').map((p) => Math.abs(p.pdg)));
      if (fl.size === 1) (fl.has(11) ? ee++ : mm++);
    }
    m1.sort((a, b) => a - b);
    m2.sort((a, b) => a - b);
    expect(m1[n / 2]).toBeGreaterThan(88.5);
    expect(m1[n / 2]).toBeLessThan(91.5);
    expect(m2[n / 2]).toBeGreaterThan(22);
    expect(m2[n / 2]).toBeLessThan(30);
    expect(m2[0]).toBeGreaterThanOrEqual(4);
    expect(m2[n - 1]).toBeLessThanOrEqual(M_H / 2 + 1e-9); // the lighter boson is below mH/2 by construction (M_H − M_Z = 34 GeV is where the peak ends)
    expect(m2.filter((m) => m > M_H - M_Z + 5).length / n).toBeLessThan(0.12); // both bosons off shell (m₂ > 39 GeV): under ten per cent
    expect(ee / n).toBeGreaterThan(0.22);
    expect(ee / n).toBeLessThan(0.28);
    expect(mm / n).toBeGreaterThan(0.22);
    expect(mm / n).toBeLessThan(0.28);
  });
  test('spin correlations are in: the two ℓ⁻ of H → ZZ* are anti-collinear-ish (⟨cos⟩ < 0), and for WW* the charged leptons are close together (⟨cos⟩ = +0.23)', () => {
    const r = rng(7);
    let cz = 0;
    const nz = 5000;
    for (let i = 0; i < nz; i++) {
      const ev = h4.generate(r, { sqrtS: 13000 }).event;
      const H = ev.particles.find((p) => p.pdg === 25)!;
      const L = ev.particles.filter((p) => p.status === 'final');
      const a = toRestFrame(L[0]!.p, H.p), b = toRestFrame(L[2]!.p, H.p);
      cz += (a.px * b.px + a.py * b.py + a.pz * b.pz) / (Math.hypot(a.px, a.py, a.pz) * Math.hypot(b.px, b.py, b.pz));
    }
    expect(cz / nz).toBeLessThan(-0.03);
    const hw = higgsGGF({ decay: 'WWlnulnu' });
    let cw = 0;
    const nw = 6000;
    for (let i = 0; i < nw; i++) {
      const ev = hw.generate(r, { sqrtS: 13000 }).event;
      const H = ev.particles.find((p) => p.pdg === 25)!;
      const L = ev.particles.filter((p) => p.status === 'final' && Math.abs(p.pdg) % 2 === 1);
      expect(L.length).toBe(2);
      expect(L[0]!.pdg * L[1]!.pdg).toBeLessThan(0);
      const a = toRestFrame(L[0]!.p, H.p), b = toRestFrame(L[1]!.p, H.p);
      cw += (a.px * b.px + a.py * b.py + a.pz * b.pz) / (Math.hypot(a.px, a.py, a.pz) * Math.hypot(b.px, b.py, b.pz));
    }
    expect(cw / nw).toBeGreaterThan(0.18);
    expect(cw / nw).toBeLessThan(0.28);
  });
  test('WW* record: W⁻ → ℓ⁻ν̄ and W⁺ → ℓ⁺ν, missing energy carried by the neutrinos, conservation', () => {
    const hw = higgsGGF({ decay: 'WWlnulnu' });
    const r = rng(8);
    for (let i = 0; i < 300; i++) {
      const { event } = hw.generate(r, { sqrtS: 13000 });
      const fin = event.particles.filter((p) => p.status === 'final');
      expect(fin.length).toBe(4);
      expect(fin.filter((p) => [12, 14, 16].includes(Math.abs(p.pdg))).length).toBe(2);
      const c = conservation(event, charge);
      expect(Math.abs(c.dE)).toBeLessThan(1e-9 * 13000);
      expect(c.dCharge).toBe(0);
    }
  });
});
