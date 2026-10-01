import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { besselRatio } from './bessel.ts';
import { blockStats, exactPlaquette, exactStringTension, exactWilson, metropolisDelta, U1Lattice, vonMises } from './u1lattice.ts';

describe('von Mises sampler', () => {
  for (const kappa of [0.2, 1, 5, 40]) {
    test(`⟨cos θ⟩ = I₁/I₀ for κ = ${kappa}`, () => {
      const r = rng(11);
      const N = 200_000;
      let s = 0, s2 = 0;
      for (let i = 0; i < N; i++) { const c = Math.cos(vonMises(r, kappa)); s += c; s2 += c * c; }
      const m = s / N;
      const err = Math.sqrt((s2 / N - m * m) / N);
      expect(Math.abs(m - besselRatio(kappa))).toBeLessThan(4.5 * err);
    });
  }
});

function run(beta: number, L: number, algo: 'hb' | 'met', therm: number, meas: number, seed: number) {
  const lat = new U1Lattice(L, rng(seed));
  const d = metropolisDelta(beta);
  const step = () => (algo === 'hb' ? lat.sweepHeatbath(beta) : lat.sweepMetropolis(beta, d, 3));
  for (let i = 0; i < therm; i++) step();
  const p: number[] = [];
  const w22: number[] = [];
  const w12: number[] = [];
  for (let i = 0; i < meas; i++) {
    step();
    p.push(lat.meanPlaquette());
    w22.push(lat.wilsonLoop(2, 2));
    w12.push(lat.wilsonLoop(1, 2));
  }
  return { p: blockStats(p, 10), w22: blockStats(w22, 10), w12: blockStats(w12, 10) };
}

describe('2D U(1) lattice gauge theory against the exact results', () => {
  for (const beta of [0.5, 1, 2, 4]) {
    for (const algo of ['hb', 'met'] as const) {
      test(`plaquette and Wilson loops at β = ${beta} (${algo})`, () => {
        const res = run(beta, 16, algo, 200, 1500, 42 + Math.round(beta * 10));
        // exact: I1(β)/I0(β); accept within 4σ (plus a tiny floor for the blocking estimate)
        expect(Math.abs(res.p.mean - exactPlaquette(beta))).toBeLessThan(4 * res.p.err + 2e-4);
        expect(Math.abs(res.w22.mean - exactWilson(beta, 2, 2))).toBeLessThan(4 * res.w22.err + 1e-3);
        expect(Math.abs(res.w12.mean - exactWilson(beta, 1, 2))).toBeLessThan(4 * res.w12.err + 1e-3);
        expect(res.p.err).toBeLessThan(0.01);
      });
    }
  }
  test('Creutz ratio at β = 1 gives the string tension −ln(I₁/I₀)', () => {
    const beta = 1;
    const lat = new U1Lattice(16, rng(5));
    for (let i = 0; i < 100; i++) lat.sweepHeatbath(beta);
    const s = { w11: 0, w12: 0, w22: 0 };
    const N = 4000;
    for (let i = 0; i < N; i++) {
      lat.sweepHeatbath(beta);
      s.w11 += lat.wilsonLoop(1, 1); s.w12 += lat.wilsonLoop(1, 2); s.w22 += lat.wilsonLoop(2, 2);
    }
    // Creutz ratio χ(2,2) = −ln[ W(2,2) W(1,1) / (W(1,2) W(2,1)) ]
    const creutz = -Math.log(((s.w22 / N) * (s.w11 / N)) / ((s.w12 / N) * (s.w12 / N)));
    expect(Math.abs(creutz - exactStringTension(beta))).toBeLessThan(0.05);
  });
  test('a cold start thermalises: the plaquette falls from 1 to the exact value in a few sweeps', () => {
    const lat = new U1Lattice(16, rng(3));
    expect(lat.meanPlaquette()).toBe(1);
    for (let i = 0; i < 30; i++) lat.sweepHeatbath(1);
    expect(Math.abs(lat.meanPlaquette() - exactPlaquette(1))).toBeLessThan(0.05);
  });
  test('Metropolis acceptance is near a half with the suggested step', () => {
    for (const beta of [0.5, 2, 6]) {
      const lat = new U1Lattice(16, rng(1));
      let acc = 0;
      for (let i = 0; i < 60; i++) { const a = lat.sweepMetropolis(beta, metropolisDelta(beta), 1); if (i >= 30) acc += a; }
      expect(acc / 30).toBeGreaterThan(0.3);
      expect(acc / 30).toBeLessThan(0.85);
    }
  });
  test('the same seed gives the same lattice', () => {
    const a = new U1Lattice(8, rng(9));
    const b = new U1Lattice(8, rng(9));
    for (let i = 0; i < 20; i++) { a.sweepMetropolis(1.5, 1, 2); b.sweepMetropolis(1.5, 1, 2); }
    expect(Array.from(a.th)).toEqual(Array.from(b.th));
  });
  test('a 32×32 lattice does at least 60 sweeps per second on the CPU', () => {
    const lat = new U1Lattice(32, rng(1));
    const t0 = performance.now();
    const n = 120;
    for (let i = 0; i < n; i++) lat.sweepMetropolis(1.5, 1.2, 2);
    const rate = (n / (performance.now() - t0)) * 1000;
    expect(rate).toBeGreaterThan(60);
  });
});
