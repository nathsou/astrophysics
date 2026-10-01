import { describe, expect, test } from 'vitest';
import {
  ALPHA_0, ALPHA_S_MZ, G_F, M_W, M_Z, M_T, SIN2W_EFF, SIN2W_ONSHELL, V_EW,
  alphaEM, alphaS, asymmetryParameter, breitWignerDensity, breitWignerPeak, breitWignerPdf, chi, ckmAbs, ckmMatrix, ckmSquared,
  deltaAlpha, higgsWidths, propagator, rRatio, sigmaMuMuQedNb, topWidth, vacuumPolarisationFunction, wPartialWidth, wTotalWidth, zBranchingFractions,
  zCouplings, zPartialWidth, zWidths,
} from './index.ts';

describe('running of α', () => {
  test('1/137.036 at Q = 0', () => {
    expect(1 / alphaEM(0)).toBeCloseTo(137.035999, 5);
  });
  test('about 1/129 at mZ (QED-only running; the MS-bar 1/127.95 differs by the W loop)', () => {
    const inv = 1 / alphaEM(M_Z);
    expect(inv).toBeGreaterThan(128.5);
    expect(inv).toBeLessThan(129.4);
  });
  test('leptonic shift at mZ is 0.0314 (literature: 0.03150 with higher loops) and the hadronic one 0.0275 (literature 0.0276)', () => {
    expect(deltaAlpha(M_Z, 'leptons')).toBeGreaterThan(0.0308);
    expect(deltaAlpha(M_Z, 'leptons')).toBeLessThan(0.0320);
    expect(deltaAlpha(M_Z, 'hadrons')).toBeGreaterThan(0.0268);
    expect(deltaAlpha(M_Z, 'hadrons')).toBeLessThan(0.0284);
  });
  test('increases monotonically with Q', () => {
    let last = 0;
    for (const q of [0.001, 0.01, 0.1, 1, 3, 10, 30, 91.188, 300, 1000]) {
      const a = alphaEM(q);
      expect(a).toBeGreaterThan(last);
      last = a;
    }
  });
  test('the vacuum-polarisation function has the right limits', () => {
    expect(vacuumPolarisationFunction(1e-6)).toBeCloseTo(1e-6 / 5, 12);
    expect(vacuumPolarisationFunction(1e12)).toBeCloseTo(Math.log(1e12) - 5 / 3, 6);
    // compare with the defining integral
    let s = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const z = (i + 0.5) / n;
      s += z * (1 - z) * Math.log(1 + z * (1 - z) * 7.3);
    }
    expect(vacuumPolarisationFunction(7.3)).toBeCloseTo((6 * s) / n, 7);
  });
});

describe('running of αs', () => {
  test('αs(mZ) = 0.118 at both orders', () => {
    expect(alphaS(M_Z, 1)).toBeCloseTo(ALPHA_S_MZ, 9);
    expect(alphaS(M_Z, 2)).toBeCloseTo(ALPHA_S_MZ, 9);
  });
  test('asymptotic freedom: decreasing with Q', () => {
    let last = 1;
    for (const q of [1, 2, 5, 10, 30, 91.188, 300, 1000, 5000]) {
      const a = alphaS(q);
      expect(a).toBeLessThan(last);
      last = a;
    }
  });
  test('one-loop closed form for nf = 5: 1/α(Q) = 1/α(mZ) + β0/(2π) ln(Q/mZ)', () => {
    const q = 30;
    const expect1 = 1 / (1 / 0.118 + (23 / 3 / (2 * Math.PI)) * Math.log(q / M_Z));
    expect(alphaS(q, 1)).toBeCloseTo(expect1, 7);
  });
  test('two loops give a larger αs than one loop at low Q, and 0.2–0.4 at a few GeV', () => {
    expect(alphaS(2, 2)).toBeGreaterThan(alphaS(2, 1));
    expect(alphaS(2, 2)).toBeGreaterThan(0.25);
    expect(alphaS(2, 2)).toBeLessThan(0.4);
    // continuity across the b threshold
    expect(alphaS(4.18 - 1e-6)).toBeCloseTo(alphaS(4.18 + 1e-6), 5);
    expect(alphaS(1.27 - 1e-6)).toBeCloseTo(alphaS(1.27 + 1e-6), 5);
  });
  test('αs(10 GeV) and αs(1 TeV) are near the values of standard running (0.178 and 0.088 at two loops)', () => {
    expect(alphaS(10)).toBeGreaterThan(0.17);
    expect(alphaS(10)).toBeLessThan(0.185);
    expect(alphaS(1000)).toBeGreaterThan(0.085);
    expect(alphaS(1000)).toBeLessThan(0.092);
  });
});

describe('Z couplings and widths', () => {
  test('couplings of the electron and the up quark', () => {
    const e = zCouplings(11);
    expect(e.gV).toBeCloseTo(-0.5 + 2 * SIN2W_EFF, 12);
    expect(e.gA).toBe(-0.5);
    expect(e.gL).toBeCloseTo(-0.5 + SIN2W_EFF, 12);
    expect(e.gR).toBeCloseTo(SIN2W_EFF, 12);
    const u = zCouplings(2);
    expect(u.gV).toBeCloseTo(0.5 - (4 / 3) * SIN2W_EFF, 12);
    expect(u.gA).toBe(0.5);
  });
  test('asymmetry parameters: A_ℓ = 0.147 and A_b = 0.935 (measured 0.1465 and 0.923)', () => {
    expect(asymmetryParameter(13)).toBeCloseTo(0.147, 2);
    expect(asymmetryParameter(5)).toBeCloseTo(0.935, 2);
  });
  test('Γ(Z → ℓℓ) = 83.4 MeV at leading order (measured 83.98)', () => {
    expect(zPartialWidth(11) * 1e3).toBeCloseTo(83.4, 0);
  });
  test('Γ(Z → νν) = 165.9 MeV (measured 167.1 per species)', () => {
    expect(zPartialWidth(12) * 1e3).toBeCloseTo(165.9, 0);
  });
  test('total Z width: 2.42 GeV at LO, 2.48 GeV with the QCD correction (measured 2.4955)', () => {
    expect(zWidths().total).toBeGreaterThan(2.40);
    expect(zWidths().total).toBeLessThan(2.44);
    const q = zWidths({ qcd: true }).total;
    expect(q).toBeGreaterThan(2.46);
    expect(q).toBeLessThan(2.50);
  });
  test('branching fractions sum to 1; hadrons ≈ 70 %, invisible ≈ 20 %', () => {
    const br = zBranchingFractions({ qcd: true });
    const s = Object.values(br).reduce((a, b) => a + b, 0);
    expect(s).toBeCloseTo(1, 12);
    const had = br.u! + br.d! + br.s! + br.c! + br.b!;
    expect(had).toBeGreaterThan(0.68);
    expect(had).toBeLessThan(0.71);
    expect(br.nu_e! + br.nu_mu! + br.nu_tau!).toBeGreaterThan(0.19);
    expect(br.nu_e! + br.nu_mu! + br.nu_tau!).toBeLessThan(0.21);
  });
});

describe('W, top and Higgs widths', () => {
  test('Γ(W → ℓν) = 226.8 MeV', () => {
    expect(wPartialWidth(11, 12) * 1e3).toBeCloseTo(227.2, 0);
  });
  test('total W width: 2.04 GeV at LO, 2.10 GeV with QCD (measured 2.085)', () => {
    expect(wTotalWidth()).toBeCloseTo(2.044, 2);
    expect(wTotalWidth({ qcd: true })).toBeCloseTo(2.096, 2);
  });
  test('W hadronic/leptonic branching: BR(W → eν) ≈ 10.8 % with QCD', () => {
    expect(wPartialWidth(11, 12) / wTotalWidth({ qcd: true })).toBeGreaterThan(0.104);
    expect(wPartialWidth(11, 12) / wTotalWidth({ qcd: true })).toBeLessThan(0.112);
  });
  test('top width: 1.48 GeV at LO, 1.34 GeV with the QCD correction (table: 1.42)', () => {
    expect(topWidth()).toBeCloseTo(1.480, 2);
    expect(topWidth({ qcd: true })).toBeGreaterThan(1.30);
    expect(topWidth({ qcd: true })).toBeLessThan(1.40);
    expect(M_T).toBeGreaterThan(170);
  });
  test('Higgs: bb̄ dominates (≈ 60 %), WW* ≈ 22 %, γγ ≈ 0.25 %, total ≈ 3.7 MeV at LO (table: 4.1)', () => {
    const h = higgsWidths();
    expect(h.br.bb).toBeGreaterThan(0.5);
    expect(h.br.bb).toBeLessThan(0.65);
    expect(h.br.WW).toBeGreaterThan(0.18);
    expect(h.br.WW).toBeLessThan(0.25);
    expect(h.br.ZZ).toBeGreaterThan(0.018);
    expect(h.br.ZZ).toBeLessThan(0.03);
    expect(h.partial.gammagamma * 1e6).toBeGreaterThan(8.5);
    expect(h.partial.gammagamma * 1e6).toBeLessThan(10);
    expect(h.total * 1e3).toBeGreaterThan(3.3);
    expect(h.total * 1e3).toBeLessThan(4.2);
  });
});

describe('CKM', () => {
  test('unitary to 1e-10', () => {
    const V = ckmMatrix();
    // PDG convention: V_ub = Aλ³(ρ − iη), so its imaginary part is negative
    expect(V[0]![2]!.im).toBeLessThan(0);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let re = 0, im = 0;
        for (let k = 0; k < 3; k++) {
          const a = V[i]![k]!, b = V[j]![k]!;
          re += a.re * b.re + a.im * b.im;
          im += a.im * b.re - a.re * b.im;
        }
        expect(re).toBeCloseTo(i === j ? 1 : 0, 10);
        expect(im).toBeCloseTo(0, 10);
      }
  });
  test('magnitudes agree with the PDG values', () => {
    expect(ckmAbs(2, 1)).toBeCloseTo(0.9743, 3);
    expect(ckmAbs(2, 3)).toBeCloseTo(0.2250, 3);
    expect(ckmAbs(2, 5)).toBeCloseTo(0.0037, 3);
    expect(ckmAbs(4, 3)).toBeCloseTo(0.9735, 3);
    expect(ckmAbs(4, 5)).toBeCloseTo(0.0418, 3);
    expect(ckmAbs(6, 5)).toBeCloseTo(0.9991, 3);
    expect(ckmSquared(4, 1)).toBeCloseTo(ckmSquared(2, 3) * 0.998, 2);
  });
});

describe('propagators and the R ratio', () => {
  test('Breit–Wigner: density peaks at the pole with height 1/(M²Γ²)', () => {
    expect(breitWignerDensity(M_Z ** 2, M_Z, 2.4955)).toBeCloseTo(1 / (M_Z ** 2 * 2.4955 ** 2), 18);
    const p = propagator(M_Z ** 2 + 100, M_Z, 2.5);
    const d = breitWignerDensity(M_Z ** 2 + 100, M_Z, 2.5);
    expect(p.re * p.re + p.im * p.im).toBeCloseTo(d, 18);
    const c = chi(M_Z ** 2, M_Z, 2.4955);
    expect(c.re).toBeCloseTo(0, 6);
    expect(c.im).toBeCloseTo(-M_Z / 2.4955, 6); // running width at s = M² equals Γ
  });
  test('Breit–Wigner pdf is normalised', () => {
    let s = 0;
    const dm = 0.01;
    for (let m = M_Z - 200; m < M_Z + 200; m += dm) s += breitWignerPdf(m, M_Z, 2.5) * dm;
    expect(s).toBeGreaterThan(0.98);
    expect(s).toBeLessThan(1.0);
  });
  test('R = 2, 10/3, 11/3 plateaus (3 colours)', () => {
    expect(rRatio(1.5)).toBeCloseTo(2, 3);
    expect(rRatio(3.0)).toBeGreaterThan(2.9);
    expect(rRatio(20)).toBeCloseTo(11 / 3, 1);
    expect(rRatio(6.0)).toBeCloseTo(10 / 3, 0);
    expect(rRatio(10)).toBeGreaterThan(3.5);
    expect(rRatio(20, { qcd: true })).toBeCloseTo(rRatio(20) * (1 + alphaS(20) / Math.PI), 10);
  });
  test('e⁺e⁻ → μ⁺μ⁻ point cross-section: 86.8 nb / s[GeV²]', () => {
    expect(sigmaMuMuQedNb(10) * 100).toBeCloseTo(86.85, 1);
  });
  test('Breit–Wigner peak for the Z: σ0(μμ) from the LO widths', () => {
    const w = zWidths();
    const sig = breitWignerPeak(M_Z, w.total, w.byFlavour.e!, w.byFlavour.mu!) * 0.3893793721e6;
    expect(sig).toBeGreaterThan(1.9);
    expect(sig).toBeLessThan(2.1);
  });
  test('constants', () => {
    expect(SIN2W_ONSHELL).toBeCloseTo(0.2232, 3);
    expect(V_EW).toBeCloseTo(246.22, 1);
    expect(ALPHA_0 * 137.036).toBeCloseTo(1, 5);
    expect(G_F).toBeGreaterThan(1e-5);
    expect(M_W).toBeGreaterThan(80);
  });
});
