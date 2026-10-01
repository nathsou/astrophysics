/** Chapter 16: the numbers in the text, computed, and the flagship's numerics. */
import { describe, expect, test } from 'vitest';
import { HBARC2_GEV2_PB } from '../../hep/units/index.ts';
import { ALPHA_0, alphaEM, deltaAlpha, rRatio, M_Z, ALPHA_MZ_MSBAR, alphaS } from '../../hep/sm/index.ts';
import { ee2mumuDiffXsec, bhabhaDiffXsec, crossSection, getProcess, unweight, eeToFermions } from '../../hep/gen/index.ts';
import { rng } from '../../hep/random/index.ts';
import { chi2OfColours, energyGrid, measure, scanR, sigmaPb, histogramCos } from './collider.ts';

const sigmaPointNb = (sqrtS: number) => ((4 * Math.PI * ALPHA_0 ** 2) / (3 * sqrtS * sqrtS)) * HBARC2_GEV2_PB * 1e-3;

describe('σ(e⁺e⁻ → μ⁺μ⁻) = 4πα²/3s', () => {
  test('86.8 nb / s[GeV²], and the numbers used in the text', () => {
    expect(sigmaPointNb(1)).toBeCloseTo(86.85, 2);
    expect(sigmaPointNb(10)).toBeCloseTo(0.8685, 4);
    expect(sigmaPointNb(30) * 1000).toBeCloseTo(96.5, 1); // pb
    expect(sigmaPointNb(M_Z) * 1000).toBeCloseTo(10.45, 2); // pb, photon exchange alone at the Z mass
    expect(4 * Math.PI / 3 * ALPHA_0 ** 2).toBeCloseTo(2.2306e-4, 7);
  });
  test('a luminosity of 10³¹ cm⁻² s⁻¹ at √s = 10 GeV gives 31 muon pairs an hour', () => {
    const sigmaCm2 = sigmaPointNb(10) * 1e-33;
    expect(sigmaCm2 * 1e31 * 3600).toBeCloseTo(31.3, 1);
  });
  test('the integral of the differential cross-section, and the angular moments', () => {
    const s = 100;
    const n = 4000;
    let tot = 0, c2 = 0;
    for (let i = 0; i < n; i++) {
      const c = -1 + (2 * (i + 0.5)) / n;
      const f = ee2mumuDiffXsec(s, c) * (2 / n);
      tot += f;
      c2 += c * c * f;
    }
    expect(tot).toBeCloseTo((4 * Math.PI * ALPHA_0 ** 2) / (3 * s), 12);
    expect(c2 / tot).toBeCloseTo(0.4, 6); // ⟨cos²θ⟩ for (1 + cos²θ)
  });
  test('accept–reject efficiency of 1 + cos²θ under a flat envelope is 2/3', () => {
    const r = rng(2);
    let ok = 0;
    const N = 60000;
    for (let i = 0; i < N; i++) {
      const c = 2 * r() - 1;
      if (unweight(1 + c * c, 2, r)) ok++;
    }
    expect(Math.abs(ok / N - 2 / 3)).toBeLessThan(4 * Math.sqrt((2 / 9) / N));
  });
});

describe('the virtual collider (measure)', () => {
  test('muon pairs: σ within 4σ, symmetric angles, ⟨cos²θ⟩ = 0.4', () => {
    const m = measure('mumu', false, 10, 20, 7);
    expect(Math.abs(m.sigmaMeasPb - m.sigmaTheoryPb) / m.sigmaErrPb).toBeLessThan(4);
    expect(Math.abs(m.afb)).toBeLessThan(5 * m.afbErr);
    const mean2 = m.cosTheta.reduce((a, c) => a + c * c, 0) / m.nShown;
    expect(mean2).toBeGreaterThan(0.39);
    expect(mean2).toBeLessThan(0.41);
    const h = histogramCos(m.cosTheta, 20);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(m.nShown);
  });
  test('with the Z at 91 GeV the muon angular distribution is lopsided and σ is ~100 times the photon-only value', () => {
    const z = sigmaPb('mumu', true, 91.2);
    const g = sigmaPb('mumu', false, 91.2);
    expect(z / g).toBeGreaterThan(100);
    const m = measure('mumu', true, 91.2, 2, 3);
    expect(m.afb).toBeGreaterThan(0.005); // A_FB(0) is about 0.016 at the pole
  });
  test('Bhabha: peaked forward', () => {
    const m = measure('bhabha', false, 10, 20, 5);
    const fwd = m.cosTheta.filter((c) => c > 0.7).length;
    const mid = m.cosTheta.filter((c) => Math.abs(c) < 0.2).length;
    expect(fwd).toBeGreaterThan(5 * mid);
  });
  test('Monte Carlo cross-section of the QED-only muon process agrees with 4πα²/3s', () => {
    const cs = crossSection(getProcess('ee->mumu-qed'), 10, 20000, rng(3));
    expect(Math.abs(cs.pull ?? 99)).toBeLessThan(4);
  });
});

describe('running α', () => {
  test('1/137.036 at Q = 0, 1/128.96 at mZ with QED loops only; the MS-bar value 1/127.95 is a different quantity', () => {
    expect(1 / ALPHA_0).toBeCloseTo(137.036, 3);
    expect(1 / alphaEM(M_Z)).toBeCloseTo(128.96, 1);
    expect(1 / ALPHA_MZ_MSBAR).toBeCloseTo(127.95, 2);
    expect(alphaEM(M_Z) / ALPHA_0).toBeCloseTo(1.0627, 3);
  });
  test('the leptonic part Δα_lep(mZ) = 0.0314 (one loop) and the leading-log formula Δα = (α/3π) Σ Q²[ln(Q²/m²) − 5/3]', () => {
    expect(deltaAlpha(M_Z, 'leptons')).toBeCloseTo(0.03142, 5);
    const m = [0.000510999, 0.1056584, 1.77686];
    for (const Q of [30, 91.1876, 500]) {
      const ll = (ALPHA_0 / (3 * Math.PI)) * m.reduce((s, mi) => s + (Math.log((Q * Q) / (mi * mi)) - 5 / 3), 0);
      expect(Math.abs(ll / deltaAlpha(Q, 'leptons') - 1)).toBeLessThan(0.003);
    }
  });
});

describe('g − 2', () => {
  const alpha = 1 / 137.035999177;
  const x = alpha / Math.PI;
  const zeta3 = 1.2020569031595942;
  const C2 = 197 / 144 + Math.PI ** 2 / 12 - (Math.PI ** 2 / 2) * Math.log(2) + 0.75 * zeta3;
  test('Schwinger: α/2π = 0.0011614; Petermann and Sommerfield: −0.328479 (closed form)', () => {
    expect(ALPHA_0 / (2 * Math.PI)).toBeCloseTo(0.0011614, 7);
    expect(C2).toBeCloseTo(-0.3284789656, 9);
  });
  test('the series through five loops, electron loops only, agrees with the measurement to eight digits', () => {
    const a = 0.5 * x + C2 * x ** 2 + 1.181241456587 * x ** 3 - 1.9122457649 * x ** 4 + 6.737 * x ** 5;
    const measured = 0.00115965218059;
    expect(a).toBeCloseTo(0.001159652176, 11);
    expect(measured - a).toBeGreaterThan(4e-12);
    expect(measured - a).toBeLessThan(5e-12); // muon and tau loops 2.7e-12, hadrons 1.7e-12 (quoted from the literature)
    expect(Math.abs(a / measured - 1)).toBeLessThan(5e-9);
    // the first term alone is within 0.2 %
    expect(ALPHA_0 / (2 * Math.PI) / measured).toBeCloseTo(1.0015, 3);
  });
  test('the Lamb shift: 1057.8 MHz is 4.37 µeV', () => {
    expect(1057.845e6 * 4.135667696e-15 * 1e6).toBeCloseTo(4.375, 3);
  });
});

describe('the R ratio', () => {
  test('plateaus 2, 10/3, 11/3 (three colours), and the colourless values a third as big', () => {
    expect(rRatio(1.5)).toBeCloseTo(2, 3);
    expect(rRatio(5)).toBeCloseTo(3.30, 1);
    expect(rRatio(50)).toBeCloseTo(11 / 3, 2);
    expect(rRatio(1.5) / 3).toBeCloseTo(2 / 3, 3);
    expect(3 * (4 / 9 + 1 / 9 + 1 / 9 + 4 / 9 + 1 / 9)).toBeCloseTo(11 / 3, 12);
  });
  test('the generator agrees with hep/sm', () => {
    const had = eeToFermions({ final: 'hadrons', qedOnly: true });
    const mu = eeToFermions({ final: 'mu', qedOnly: true });
    for (const e of [2, 5, 10, 30]) expect(had.sigma(e) / mu.sigma(e)).toBeCloseTo(rRatio(e), 4);
  });
  test('the pseudo-data prefer three colours, and reject one, two and five', () => {
    const pts = scanR(energyGrid(1.5, 14, 36), 3000, 1, false);
    const chi = (nc: number) => chi2OfColours(pts, nc, false);
    expect(chi(3).chi2 / chi(3).ndf).toBeLessThan(2);
    for (const nc of [1, 2, 4, 5]) expect(chi(nc).chi2 / chi(nc).ndf).toBeGreaterThan(10);
  });
  test('gluon radiation: R is about 4–5 % higher at 10 GeV and at 30 GeV', () => {
    expect(alphaS(30) / Math.PI).toBeCloseTo(0.0452, 3);
    expect(rRatio(30, { qcd: true }) / rRatio(30)).toBeCloseTo(1.045, 3);
  });
});

describe('Bhabha scattering near the forward direction is Rutherford scattering', () => {
  test('dσ/dcosθ → (πα²/s)·2s²/t² ∝ 1/sin⁴(θ/2)', () => {
    const s = 100;
    for (const th of [0.05, 0.1, 0.2]) {
      const c = Math.cos(th);
      const rutherford = ((Math.PI * ALPHA_0 ** 2) / s) * (2 / Math.sin(th / 2) ** 4);
      expect(bhabhaDiffXsec(s, c) / rutherford).toBeGreaterThan(0.95);
      expect(bhabhaDiffXsec(s, c) / rutherford).toBeLessThan(1.05);
    }
  });
});
