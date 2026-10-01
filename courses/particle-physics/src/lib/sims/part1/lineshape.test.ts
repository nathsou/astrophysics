import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { breitWigner, rng } from '../../hep/random/index.ts';
import { dimuonMasses, parseDimuon } from '../../hep/data/index.ts';
import { particle } from '../../hep/particles/index.ts';
import { bw, bwAmplitude, bwCdf, fitLineshape, fwhm, smeared } from './lineshape.ts';

function dimuon(): Float64Array {
  const b = readFileSync(new URL('../../../../static/data/dimuon.f32', import.meta.url));
  return dimuonMasses(parseDimuon(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}
function hist(m: ArrayLike<number>, lo: number, hi: number, n: number): { edges: number[]; counts: number[] } {
  const counts = new Array<number>(n).fill(0);
  for (let i = 0; i < m.length; i++) {
    const x = m[i]!;
    if (x >= lo && x < hi) counts[Math.floor(((x - lo) / (hi - lo)) * n)]!++;
  }
  return { edges: Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n), counts };
}

describe('Breit–Wigner', () => {
  test('normalised, FWHM = Γ, height 2/(πΓ), and the amplitude circle has diameter 2/Γ', () => {
    const M = 91.1880, G = 2.4955;
    expect(bwCdf(1e9, M, G) - bwCdf(-1e9, M, G)).toBeCloseTo(1, 6);
    expect(bw(M, M, G)).toBeCloseTo(2 / (Math.PI * G), 12);
    expect(fwhm((m) => bw(m, M, G), M - 50, M + 50)).toBeCloseTo(G, 3);
    // |A|² ∝ BW; the amplitude's tip is on the circle of diameter 2/Γ centred at −i/Γ
    for (const e of [M - 10, M - 1, M, M + 0.3, M + 5]) {
      const [re, im] = bwAmplitude(e, M, G);
      expect(Math.hypot(re, im + 1 / G)).toBeCloseTo(1 / G, 10);
      expect(re * re + im * im).toBeCloseTo((2 * Math.PI * bw(e, M, G)) / G, 10);
    }
  });
  test('the sampler of hep/random has the same FWHM', () => {
    const r = rng(1);
    const xs = Array.from({ length: 200000 }, () => breitWigner(r, 10, 2));
    const h = hist(xs, 0, 20, 400);
    const peak = Math.max(...h.counts);
    const above = h.counts.map((c) => c >= peak / 2);
    // crude: the plateau of bins above half of a noisy maximum is 2 wide within 5 %
    const first = above.indexOf(true), last = above.lastIndexOf(true);
    expect(((last - first + 1) * 20) / 400).toBeGreaterThan(1.7);
    expect(((last - first + 1) * 20) / 400).toBeLessThan(2.4);
  });
});

describe('the detector broadens a line', () => {
  test('a line much narrower than the resolution comes out with FWHM 2.355σ; a broad line is unchanged', () => {
    const M = 3.0969;
    const narrow = fwhm((m) => smeared(m, M, 9.26e-5, 0.035), M - 0.3, M + 0.3);
    expect(narrow).toBeCloseTo(2.3548 * 0.035, 2);
    const Z = 91.188;
    expect(fwhm((m) => smeared(m, Z, 2.4955, 0.05), Z - 20, Z + 20, 8000)).toBeCloseTo(2.4955, 1);
  });
  test('the convolution is normalised', () => {
    let s = 0;
    const h = 0.01;
    for (let m = 70; m < 112; m += h) s += smeared(m + h / 2, 91.188, 2.4955, 1.5) * h;
    expect(s).toBeGreaterThan(0.95); // the Breit–Wigner tails beyond the window carry the rest (3.8 %)
    expect(s).toBeCloseTo(bwCdf(112, 91.188, 2.4955) - bwCdf(70, 91.188, 2.4955), 2);
    expect(s).toBeLessThan(1.0001);
    expect(smeared(91.188, 91.188, 2.4955, 0)).toBeCloseTo(bw(91.188, 91.188, 2.4955), 12);
  });
  test('toy fit recovers a known resolution', () => {
    const r = rng(2);
    const xs = Array.from({ length: 30000 }, () => breitWigner(r, 91.188, 2.4955, 60, 120) + 1.5 * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()));
    const h = hist(xs, 70, 112, 42);
    const fit = fitLineshape(h.edges, h.counts, 2.4955, { mass: [90, 92.5], sigma: [0.2, 6] });
    expect(fit.sigma).toBeGreaterThan(1.2);
    expect(fit.sigma).toBeLessThan(1.8);
  });
});

describe('on the shipped CMS dimuon data', () => {
  const m = dimuon();
  test('the J/ψ peak: a fit with the table width gives σ of a few tens of MeV, and the natural width (93 keV) is irrelevant to the shape', () => {
    const h = hist(m, 2.8, 3.4, 60);
    const gamma = particle(443).width;
    const fit = fitLineshape(h.edges, h.counts, gamma, { mass: [3.07, 3.12], sigma: [0.005, 0.2] });
    console.log('J/psi fit', fit);
    expect(fit.mass).toBeGreaterThan(3.08);
    expect(fit.mass).toBeLessThan(3.11);
    expect(fit.sigma).toBeGreaterThan(0.02);
    expect(fit.sigma).toBeLessThan(0.06);
    const wide = fitLineshape(h.edges, h.counts, gamma * 100, { mass: [3.07, 3.12], sigma: [0.005, 0.2] });
    expect(Math.abs(wide.sigma / fit.sigma - 1)).toBeLessThan(0.1);
  });
  test('the Z peak: the fitted σ is comparable with the natural width of 2.5 GeV', () => {
    const h = hist(m, 70, 112, 42);
    const fit = fitLineshape(h.edges, h.counts, particle(23).width, { mass: [89, 92.5], sigma: [0.3, 6] });
    console.log('Z fit', fit, 'FWHM', fwhm((x) => smeared(x, fit.mass, particle(23).width, fit.sigma), fit.mass - 20, fit.mass + 20, 8000));
    expect(fit.sigma).toBeGreaterThan(0.8);
    expect(fit.sigma).toBeLessThan(4);
  });
  test('the sample holds what the chapter says it does', () => {
    const count = (lo: number, hi: number) => Array.from(m).filter((x) => x >= lo && x < hi).length;
    console.log('counts', { all: m.length, jpsi: count(2.9, 3.3), z: count(70, 112) });
    expect(m.length).toBe(100000);
  });
});
