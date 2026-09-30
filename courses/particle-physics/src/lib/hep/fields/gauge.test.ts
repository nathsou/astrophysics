import { describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { addFluxTube, cloneField, cloneLinks, energyCovariant, energyNaive, fieldEnergy, makePhaseField, maxFluxDifference, plaquette, plaquettes, randomAngles, rotate, rotateGlobal, setUniformFlux, transformLinks, zeroLinks } from './gauge.ts';

describe('global and local phase symmetry', () => {
  const L = 8;
  test('a global rotation leaves the neighbour-difference energy unchanged', () => {
    const f = makePhaseField(L, rng(1));
    const e0 = energyNaive(f);
    for (const a of [0.3, 1.7, -2.9, Math.PI]) {
      const g = cloneField(f);
      rotateGlobal(g, a);
      expect(energyNaive(g)).toBeCloseTo(e0, 12);
    }
  });
  test('independent random rotations change the energy (a lot)', () => {
    const f = makePhaseField(L, rng(1));
    const e0 = energyNaive(f);
    const g = cloneField(f);
    rotate(g, randomAngles(L, rng(2)));
    // random phases: each of the 2L(L−1) edges costs on average 2
    expect(energyNaive(g)).toBeGreaterThan(10 * e0);
    expect(energyNaive(g)).toBeGreaterThan(0.6 * 2 * 2 * L * (L - 1));
  });
  test('with zero link field the covariant energy is the naive one', () => {
    const f = makePhaseField(L, rng(4));
    expect(energyCovariant(f, zeroLinks(L))).toBeCloseTo(energyNaive(f), 12);
  });
  test('gauge invariance: ψ → e^{iα}ψ, A → A + αᵢ − αⱼ leaves the covariant energy and all fluxes unchanged', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const f = makePhaseField(L, rng(seed));
      const A = zeroLinks(L);
      setUniformFlux(A, 0.05 * seed);
      addFluxTube(A, 2, 3, 1.1);
      // random initial link values too (any A is a valid field)
      const r = rng(100 + seed);
      for (let i = 0; i < A.ax.length; i++) { A.ax[i] = A.ax[i]! + 0.3 * (r() - 0.5); A.ay[i] = A.ay[i]! + 0.3 * (r() - 0.5); }
      const e0 = energyCovariant(f, A);
      const B0 = plaquettes(A);
      const f2 = cloneField(f);
      const A2 = cloneLinks(A);
      const alpha = randomAngles(L, rng(200 + seed));
      rotate(f2, alpha);
      transformLinks(A2, alpha);
      expect(energyCovariant(f2, A2)).toBeCloseTo(e0, 10);
      expect(maxFluxDifference(A, A2)).toBeLessThan(1e-12);
      const B1 = plaquettes(A2);
      for (let i = 0; i < B0.length; i++) expect(Math.abs(B1[i]! - B0[i]!)).toBeLessThan(1e-12 + (Math.abs(Math.abs(B0[i]!) - Math.PI) < 1e-9 ? 2 * Math.PI : 0));
      expect(fieldEnergy(A2)).toBeCloseTo(fieldEnergy(A), 10);
      // …but rotating ψ alone (leaving A) does change it, and the naive energy changes even when A is transformed
      const f3 = cloneField(f);
      rotate(f3, alpha);
      expect(Math.abs(energyCovariant(f3, A) - e0)).toBeGreaterThan(1);
      expect(Math.abs(energyNaive(f2) - energyNaive(f))).toBeGreaterThan(1);
    }
  });
  test('uniform flux b gives every plaquette the flux b; a flux tube adds flux to exactly one plaquette', () => {
    const A = zeroLinks(6);
    setUniformFlux(A, 0.4);
    for (const p of plaquettes(A)) expect(p).toBeCloseTo(0.4, 12);
    const B = zeroLinks(6);
    addFluxTube(B, 2, 3, 1.1);
    const pl = plaquettes(B);
    let nonzero = 0;
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { const v = pl[y * 5 + x]!; if (Math.abs(v) > 1e-12) { nonzero++; expect(x).toBe(2); expect(y).toBe(3); expect(v).toBeCloseTo(1.1, 12); } }
    expect(nonzero).toBe(1);
    expect(plaquette(B, 2, 3)).toBeCloseTo(1.1, 12);
  });
  test('the covariant energy of a pure-gauge configuration is zero: A = αᵢ − αⱼ undoes any ψ = e^{iα}', () => {
    // ψ with arbitrary phases, A chosen as the pure gauge that cancels them: the matter cannot tell it from the vacuum.
    const L2 = 6;
    const f = makePhaseField(L2, rng(9), 0, 0);
    const alpha = randomAngles(L2, rng(10));
    const A = zeroLinks(L2);
    transformLinks(A, alpha);
    rotate(f, alpha);
    expect(energyCovariant(f, A)).toBeCloseTo(0, 10);
    expect(Math.max(...plaquettes(A).map(Math.abs))).toBeLessThan(1e-12);
  });
});
