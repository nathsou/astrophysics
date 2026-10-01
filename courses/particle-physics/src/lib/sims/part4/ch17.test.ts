/** Chapter 17: Noether's theorem and gauge covariance, checked numerically. */
import { describe, expect, test } from 'vitest';
import { defaultKG, KGChain } from '../../hep/fields/index.ts';
import * as g from '../../hep/fields/gauge.ts';
import { rng } from '../../hep/random/index.ts';
import { exactPlaquette, exactStringTension, U1Lattice } from '../../hep/fields/index.ts';

describe('Noether: the U(1) charge of a complex field is conserved, and stops being conserved when the symmetry is broken', () => {
  // ψ = (φ₁ + iφ₂)/√2: two real Klein–Gordon chains. Q = Σ (φ₁ π₂ − φ₂ π₁) generates φ → rotation.
  function charge(a: KGChain, b: KGChain): number {
    let q = 0;
    for (let i = 0; i < a.n; i++) q += a.phi[i]! * b.pi[i]! - b.phi[i]! * a.pi[i]!;
    return q;
  }
  test('equal masses: Q constant to rounding while the energy-density pattern moves', () => {
    const a = new KGChain(defaultKG({ n: 128, m: 0.4, dt: 0.1 }));
    const b = new KGChain(defaultKG({ n: 128, m: 0.4, dt: 0.1 }));
    a.pluck(60, 8, 0.2);
    for (let i = 0; i < b.n; i++) b.pi[i] = 0.1 * Math.exp(-((i - 62) ** 2) / 128);
    const q0 = charge(a, b);
    expect(Math.abs(q0)).toBeGreaterThan(1e-3);
    let worst = 0;
    for (let k = 0; k < 20; k++) {
      a.run(50);
      b.run(50);
      worst = Math.max(worst, Math.abs(charge(a, b) - q0));
    }
    expect(worst / Math.abs(q0)).toBeLessThan(1e-9);
  });
  test('different masses break the rotation symmetry, and Q is no longer conserved', () => {
    const a = new KGChain(defaultKG({ n: 128, m: 0.4, dt: 0.1 }));
    const b = new KGChain(defaultKG({ n: 128, m: 1.0, dt: 0.1 }));
    a.pluck(60, 8, 0.2);
    for (let i = 0; i < b.n; i++) b.pi[i] = 0.1 * Math.exp(-((i - 62) ** 2) / 128);
    const q = (): number => {
      let s = 0;
      for (let i = 0; i < a.n; i++) s += a.phi[i]! * b.pi[i]! - b.phi[i]! * a.pi[i]!;
      return s;
    };
    const q0 = q();
    let worst = 0;
    for (let k = 0; k < 20; k++) {
      a.run(50);
      b.run(50);
      worst = Math.max(worst, Math.abs(q() - q0));
    }
    expect(worst).toBeGreaterThan(1e-3);
  });
});

describe('the covariant derivative in one dimension', () => {
  // ψ(x) = complex function, A(x) real. D = d/dx − iqA. Transformation ψ → e^{iα(x)} ψ, A → A + α'/q.
  const q = 1.7;
  const psi = (x: number): [number, number] => [Math.cos(2 * x) * Math.exp(-x * x / 4), Math.sin(3 * x) * Math.exp(-x * x / 5)];
  const A = (x: number) => 0.4 * Math.sin(x) + 0.1 * x;
  const alpha = (x: number) => 0.8 * Math.sin(1.3 * x) + 0.2 * x * x;
  const dalpha = (x: number) => 0.8 * 1.3 * Math.cos(1.3 * x) + 0.4 * x;
  const mul = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const psi2 = (x: number) => mul([Math.cos(alpha(x)), Math.sin(alpha(x))], psi(x));
  const A2 = (x: number) => A(x) + dalpha(x) / q;
  const h = 1e-5;
  const d = (f: (x: number) => [number, number], x: number): [number, number] => [(f(x + h)[0] - f(x - h)[0]) / (2 * h), (f(x + h)[1] - f(x - h)[1]) / (2 * h)];
  const D = (f: (x: number) => [number, number], a: (x: number) => number, x: number): [number, number] => {
    const df = d(f, x);
    const af = mul([0, q * a(x)], f(x)); // i q A ψ
    return [df[0] - af[0], df[1] - af[1]];
  };
  test('D′ψ′ = e^{iα} Dψ, so |Dψ|² is invariant', () => {
    for (const x of [-1.3, 0.2, 0.9, 2.1]) {
      const lhs = D(psi2, A2, x);
      const rhs = mul([Math.cos(alpha(x)), Math.sin(alpha(x))], D(psi, A, x));
      expect(lhs[0]).toBeCloseTo(rhs[0], 6);
      expect(lhs[1]).toBeCloseTo(rhs[1], 6);
    }
  });
  test('the plain derivative is not covariant: ∂ψ′ ≠ e^{iα}∂ψ unless α is constant', () => {
    const x = 0.9;
    const lhs = d(psi2, x);
    const rhs = mul([Math.cos(alpha(x)), Math.sin(alpha(x))], d(psi, x));
    expect(Math.hypot(lhs[0] - rhs[0], lhs[1] - rhs[1])).toBeGreaterThan(0.05);
  });
  test('with a gauge potential A = α′/q the covariant derivative of e^{iα}ψ is e^{iα}∂ψ: A is pure gauge, B = 0', () => {
    // field strength in 1D is zero; compare D ψ' with A' = α'/q applied to the transformed field starting from A = 0
    const x = -0.4;
    const lhs = D(psi2, (t) => dalpha(t) / q, x);
    const rhs = mul([Math.cos(alpha(x)), Math.sin(alpha(x))], d(psi, x));
    expect(lhs[0]).toBeCloseTo(rhs[0], 6);
    expect(lhs[1]).toBeCloseTo(rhs[1], 6);
  });
});

describe('the lattice version (hep/fields/gauge)', () => {
  test('global rotation leaves the naive energy alone; local rotation does not; the combined transformation leaves the covariant energy and the fluxes alone', () => {
    const r = rng(4);
    const f = g.makePhaseField(8, r);
    const A = g.zeroLinks(8);
    g.setUniformFlux(A, 0.3);
    const e0 = g.energyNaive(f);
    const ec0 = g.energyCovariant(f, A);
    const p0 = Float64Array.from(g.plaquettes(A));
    const f1 = g.cloneField(f);
    g.rotateGlobal(f1, 1.1);
    expect(g.energyNaive(f1)).toBeCloseTo(e0, 10);
    const angles = g.randomAngles(8, r);
    const f2 = g.cloneField(f);
    g.rotate(f2, angles);
    expect(Math.abs(g.energyNaive(f2) - e0)).toBeGreaterThan(1);
    const A3 = g.cloneLinks(A);
    g.transformLinks(A3, angles);
    expect(g.energyCovariant(f2, A3)).toBeCloseTo(ec0, 10);
    const p3 = g.plaquettes(A3);
    for (let i = 0; i < p0.length; i++) expect(p3[i]).toBeCloseTo(p0[i]!, 10);
    expect(g.energyCovariant(f2, A)).not.toBeCloseTo(ec0, 2); // A left behind
  });
});

describe('the 2D U(1) lattice gauge theory: exact results used in the deep dive', () => {
  test('⟨cos θ_p⟩ = I₁(β)/I₀(β) and the string tension σ = −ln of it', () => {
    for (const beta of [0.5, 1.5, 3]) {
      const p = exactPlaquette(beta);
      expect(exactStringTension(beta)).toBeCloseTo(-Math.log(p), 12);
    }
    expect(exactPlaquette(1.5)).toBeGreaterThan(0.5);
    expect(exactPlaquette(1.5)).toBeLessThan(0.7);
  });
  test('a Monte Carlo lattice reproduces the exact plaquette within errors', () => {
    const lat = new U1Lattice(16, rng(2), true);
    for (let i = 0; i < 200; i++) lat.sweepHeatbath(1.5);
    let s = 0;
    const n = 200;
    for (let i = 0; i < n; i++) {
      lat.sweepHeatbath(1.5);
      s += lat.meanPlaquette();
    }
    expect(Math.abs(s / n - exactPlaquette(1.5))).toBeLessThan(0.01);
  });
});

describe('counts quoted in the text', () => {
  test('n² − 1 generators: 1, 3, 8, 15; 12 gauge bosons in SU(3)×SU(2)×U(1)', () => {
    expect([2, 3, 4].map((n) => n * n - 1)).toEqual([3, 8, 15]);
    expect(8 + 3 + 1).toBe(12);
  });
  test('memory of one SU(3) configuration on a 64⁴ lattice', () => {
    const links = 4 * 64 ** 4;
    expect(links).toBe(67108864);
    expect((links * 18 * 8) / 1e9).toBeCloseTo(9.66, 2);
  });
  test('photon mass bound 1e-18 eV corresponds to a Compton wavelength of about 2e11 m', () => {
    const hbarc_eV_m = 197.3269804e6 * 1e-15; // eV·m
    expect(hbarc_eV_m / 1e-18).toBeCloseTo(1.97e11, -9);
  });
});
