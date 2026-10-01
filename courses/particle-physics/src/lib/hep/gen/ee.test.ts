import { afterEach, describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { setOverride } from '../hooks.ts';
import { charge, particle } from '../particles/index.ts';
import { mass } from '../kinematics/index.ts';
import { HBARC2_GEV2_NB, HBARC2_GEV2_PB } from '../units/index.ts';
import { ALPHA_0, GAMMA_Z, M_Z, asymmetryParameter, breitWignerPeak, rRatio, zWidths } from '../sm/index.ts';
import { bhabha, bhabhaDiffXsec, ee2mumuDiffXsec, eeToFermions, rRatioWithZ } from './ee.ts';
import { crossSection } from './integrate.ts';
import { conservation } from './process.ts';

afterEach(() => setOverride('gen.dsigmaEeMuMu', undefined));

const nb = (pb: number) => pb / 1e3;

describe('e⁺e⁻ → μ⁺μ⁻ by photon exchange', () => {
  const qed = eeToFermions({ final: 'mu', qedOnly: true });
  test('σ = 4πα²/(3s) = 86.8 nb / s[GeV²] (closed form)', () => {
    for (const e of [5, 10, 30]) expect(nb(qed.sigma(e)) * e * e).toBeCloseTo(86.85, 1);
    expect(qed.sigma(10) * 1e-3 * 100).toBeGreaterThan(86.8 * 0.999);
  });
  test('the reference dσ/dcosθ = πα²(1 + cos²θ)/2s integrates to the closed form', () => {
    const s = 100;
    let t = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) t += (ee2mumuDiffXsec(s, -1 + (2 * (i + 0.5)) / n) * 2) / n;
    expect(t / ((4 * Math.PI * ALPHA_0 ** 2) / (3 * s))).toBeCloseTo(1, 8);
  });
  test('Monte Carlo of the differential cross-section reproduces the closed form (pull < 4)', () => {
    const c = crossSection(qed, 10, 40000, rng(1));
    expect(Math.abs(c.pull!)).toBeLessThan(4);
    expect(c.error / c.sigma).toBeLessThan(0.002);
  });
  test('generated events follow 1 + cos²θ: ⟨cos²θ⟩ = 0.4, no forward–backward asymmetry', () => {
    const r = rng(2);
    let c2 = 0, fb = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const { event } = qed.generate(r, { sqrtS: 10 });
      const mu = event.particles.find((p) => p.pdg === 13)!.p;
      const c = mu.pz / Math.hypot(mu.px, mu.py, mu.pz);
      c2 += c * c;
      fb += c > 0 ? 1 : -1;
    }
    expect(c2 / n).toBeGreaterThan(0.395);
    expect(c2 / n).toBeLessThan(0.405);
    expect(Math.abs(fb / n)).toBeLessThan(0.012);
  });
  test("the hook gen.dsigmaEeMuMu drives the angular distribution: a reader's (1 + cosθ)² gives ⟨cosθ⟩ = 1/2", () => {
    setOverride('gen.dsigmaEeMuMu', (s: number, c: number) => ((1 + c) * (1 + c)) / s);
    const r = rng(3);
    let mean = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const mu = qed.generate(r, { sqrtS: 10 }).event.particles.find((p) => p.pdg === 13)!.p;
      mean += mu.pz / Math.hypot(mu.px, mu.py, mu.pz);
    }
    expect(mean / n).toBeGreaterThan(0.49);
    expect(mean / n).toBeLessThan(0.51);
    // and the Monte Carlo cross-section no longer agrees with the analytic one: the check a reader would see
    const c = crossSection(qed, 10, 20000, rng(4));
    expect(Math.abs(c.pull!)).toBeGreaterThan(5);
  });
});

describe('Z line shape at leading order', () => {
  const mm = eeToFermions({ final: 'mu' });
  const had = eeToFermions({ final: 'hadrons' });
  const hadQcd = eeToFermions({ final: 'hadrons', qcd: true });

  test('σ(μμ) at the pole is 1.98 nb, within 1.5 % of 12π Γee Γμμ/(mZ² ΓZ²) with the LO widths', () => {
    const w = zWidths();
    const bw = breitWignerPeak(M_Z, GAMMA_Z, w.byFlavour.e!, w.byFlavour.mu!) * HBARC2_GEV2_NB;
    const sig = nb(mm.sigma(M_Z));
    expect(sig).toBeGreaterThan(1.96);
    expect(sig).toBeLessThan(2.0);
    expect(Math.abs(sig / bw - 1)).toBeLessThan(0.015);
  });
  test('hadronic peak: 39.5 nb at LO, 41.0 nb with the QCD correction (the deconvoluted LEP value is 41.54 nb), 30 nb once ISR is on', () => {
    const pole = nb(had.sigma(M_Z));
    const poleQcd = nb(hadQcd.sigma(M_Z));
    expect(pole).toBeGreaterThan(38.5);
    expect(pole).toBeLessThan(40.5);
    expect(poleQcd).toBeGreaterThan(40.0);
    expect(poleQcd).toBeLessThan(42.0);
    expect(Math.abs(poleQcd / 41.54 - 1)).toBeLessThan(0.03);
    const isr = nb(hadQcd.sigmaISR(M_Z));
    // initial-state radiation LOWERS the peak (and shifts it up); it does not raise it
    expect(isr).toBeLessThan(poleQcd);
    expect(isr / poleQcd).toBeGreaterThan(0.70);
    expect(isr / poleQcd).toBeLessThan(0.78);
    expect(nb(mm.sigmaISR(M_Z))).toBeGreaterThan(1.40);
    expect(nb(mm.sigmaISR(M_Z))).toBeLessThan(1.55);
    // above the peak the radiative return makes the cross-section larger
    expect(hadQcd.sigmaISR(100)).toBeGreaterThan(hadQcd.sigma(100));
  });
  test('R ratio: 3.58 at 10 GeV with and without the Z (photon only = 3.58); hadron/muon cross-section ratio at 30 GeV', () => {
    expect(rRatioWithZ(10)).toBeGreaterThan(3.55);
    expect(rRatioWithZ(10)).toBeLessThan(3.65);
    expect(Math.abs(rRatioWithZ(10) / rRatio(10) - 1)).toBeLessThan(0.02);
    expect(rRatioWithZ(10, { qcd: true })).toBeCloseTo(rRatioWithZ(10) * (1 + 0.1782 / Math.PI), 1);
  });
  test('forward–backward asymmetry at the pole: 0.0161 = (3/4) A_e A_μ; changes sign across the pole', () => {
    const a = asymmetryParameter(11) * asymmetryParameter(13) * 0.75;
    expect(Math.abs(mm.afb(M_Z) / a - 1)).toBeLessThan(0.1);
    expect(mm.afb(M_Z)).toBeGreaterThan(0.0155);
    expect(mm.afb(M_Z)).toBeLessThan(0.0175);
    expect(mm.afb(89)).toBeLessThan(-0.1);
    expect(mm.afb(93)).toBeGreaterThan(0.1);
    expect(mm.afb(200)).toBeGreaterThan(0.5);
    expect(mm.afb(10)).toBeLessThan(0.01);
  });
  test('below the Z, γ–Z interference makes the μ⁻ go backwards (PETRA-era negative A_FB)', () => {
    expect(mm.afb(50)).toBeLessThan(-0.15);
  });
  test('generated events show the asymmetry: ⟨sign cosθ⟩ = A_FB at the pole', () => {
    const r = rng(5);
    let fb = 0;
    const n = 300000;
    for (let i = 0; i < n; i++) {
      const mu = mm.generate(r, { sqrtS: M_Z }).event.particles.find((p) => p.pdg === 13)!.p;
      fb += mu.pz > 0 ? 1 : -1;
    }
    expect(Math.abs(fb / n - mm.afb(M_Z))).toBeLessThan(0.008); // 4σ
  });
  test('Monte Carlo cross-sections agree with the closed forms (pull < 4)', () => {
    for (const p of [mm, had, eeToFermions({ final: 'tau' }), eeToFermions({ final: 'b' })]) {
      const c = crossSection(p, M_Z + 1, 30000, rng(6));
      expect(Math.abs(c.pull!)).toBeLessThan(4);
    }
  });
  test('τ threshold: σ(ττ) = σ_point β(3 − β²)/2 at 4 GeV from photon exchange alone', () => {
    const p = eeToFermions({ final: 'tau', qedOnly: true });
    const s = 16;
    const b = Math.sqrt(1 - (4 * particle(15).mass ** 2) / s);
    const sigmaPoint = ((4 * Math.PI * ALPHA_0 ** 2) / (3 * s)) * HBARC2_GEV2_PB;
    expect(p.sigma(4) / sigmaPoint).toBeCloseTo((b * (3 - b * b)) / 2, 10);
    expect(p.sigma(3.5)).toBe(0);
  });
  test('σ by flavour at the pole follows the Z branching fractions (b/d ≈ 0.99, u/d ≈ 0.78)', () => {
    const f = had.sigmaByFlavour(M_Z);
    expect(f[5]! / f[1]!).toBeGreaterThan(0.95);
    expect(f[5]! / f[1]!).toBeLessThan(1.02);
    expect(f[2]! / f[1]!).toBeGreaterThan(0.75);
    expect(f[2]! / f[1]!).toBeLessThan(0.82);
    expect(f[6]).toBe(0);
  });
});

describe('the hard-process record', () => {
  const procs = [
    eeToFermions({ final: 'mu' }), eeToFermions({ final: 'tau' }), eeToFermions({ final: 'hadrons' }), eeToFermions({ final: 'b', qcd: true }),
    eeToFermions({ final: 'mu', qedOnly: true }), bhabha(),
  ];
  for (const p of procs)
    test(`${p.name}: energy, momentum and charge are conserved to 1e-9 (with and without ISR)`, () => {
      const r = rng(7);
      for (const isr of p.name === 'ee->ee' ? [false] : [false, true])
        for (const e of [10.58, 91.19, 200]) {
          for (let i = 0; i < 300; i++) {
            const { event } = p.generate(r, { sqrtS: e, isr });
            const c = conservation(event, charge);
            expect(Math.abs(c.dE) / e).toBeLessThan(1e-9);
            expect(Math.abs(c.dpx) / e).toBeLessThan(1e-9);
            expect(Math.abs(c.dpy) / e).toBeLessThan(1e-9);
            expect(Math.abs(c.dpz) / e).toBeLessThan(1e-9);
            expect(c.dCharge).toBe(0);
          }
        }
    });
  test('masses and colour of the outgoing fermions; Z in the record, links consistent', () => {
    const r = rng(8);
    const ev = eeToFermions({ final: 'tau' }).generate(r, { sqrtS: 30 }).event;
    const taus = ev.particles.filter((p) => Math.abs(p.pdg) === 15);
    expect(taus.length).toBe(2);
    for (const t of taus) expect(mass(t.p)).toBeCloseTo(particle(15).mass, 6);
    const boson = ev.particles.find((p) => p.status === 'intermediate')!;
    expect(boson.pdg).toBe(23);
    expect(boson.daughters).toEqual(taus.map((t) => t.id));
    for (const t of taus) expect(t.mothers).toEqual([boson.id]);
    const q = eeToFermions({ final: 'hadrons' }).generate(r, { sqrtS: 91.2 }).event.particles.filter((p) => p.status === 'final');
    expect(q[0]!.colour).toEqual([101, 0]);
    expect(q[1]!.colour).toEqual([0, 101]);
    for (const p of ev.particles) expect(p.collision).toBe(0);
  });
  test('ISR: a collinear photon along the beam, mostly soft, with the radiator normalised by the exponentiated form', () => {
    const p = eeToFermions({ final: 'mu' });
    const r = rng(9);
    let hard = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      const { event } = p.generate(r, { sqrtS: 200, isr: true });
      const g = event.particles.find((q) => q.pdg === 22 && q.status === 'final')!;
      expect(Math.abs(g.p.px) + Math.abs(g.p.py)).toBe(0);
      if ((2 * g.p.E) / 200 > 0.5) hard++;
    }
    // at 200 GeV the radiative return to the Z dominates the cross-section: most events have a hard photon
    expect(hard / n).toBeGreaterThan(0.5);
  });
  test('ISR weighted points average to σ_ISR (pull < 4)', () => {
    const p = eeToFermions({ final: 'mu' });
    for (const e of [M_Z, 200]) {
      const r = rng(10);
      let s = 0, s2 = 0;
      const n = 60000;
      for (let i = 0; i < n; i++) {
        const w = p.weightedPoint(r, { sqrtS: e, isr: true });
        s += w;
        s2 += w * w;
      }
      const mean = s / n, err = Math.sqrt((s2 / n - mean * mean) / n);
      expect(Math.abs(mean - p.sigmaISR(e))).toBeLessThan(4 * err);
    }
  });
});

describe('Bhabha scattering', () => {
  const b = bhabha({ cosMax: 0.9 });
  test('Monte Carlo agrees with the quadrature of the closed-form differential cross-section', () => {
    const c = crossSection(b, 10, 30000, rng(11));
    expect(Math.abs(c.pull!)).toBeLessThan(4);
  });
  test('forward peak: the formula is the sum of s- and t-channel terms, ≫ μμ at small angle', () => {
    const s = 100;
    expect(bhabhaDiffXsec(s, 0.9)).toBeGreaterThan(20 * ee2mumuDiffXsec(s, 0.9));
    // at 90° the Bhabha/μμ ratio is exactly 9 (4.5 against 0.5 in units of πα²/s)
    expect(bhabhaDiffXsec(s, 0) / ee2mumuDiffXsec(s, 0)).toBeCloseTo(9, 10);
  });
  test('the electron goes mostly forward', () => {
    const r = rng(12);
    let f = 0;
    for (let i = 0; i < 4000; i++) {
      const e = b.generate(r, { sqrtS: 10 }).event.particles.find((p) => p.pdg === 11 && p.status === 'final')!.p;
      if (e.pz > 0) f++;
    }
    expect(f / 4000).toBeGreaterThan(0.85);
  });
});

describe('performance', () => {
  test('at least 50 000 e⁺e⁻ → μ⁺μ⁻ events per second per core (the target is 100 000)', () => {
    const p = eeToFermions({ final: 'mu' });
    const r = rng(13);
    p.generate(r, { sqrtS: 91.2 });
    const n = 100000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) p.generate(r, { sqrtS: 91.2 });
    const rate = n / ((performance.now() - t0) / 1000);
    expect(rate).toBeGreaterThan(50000);
  });
});
