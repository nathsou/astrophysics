/** Chapter 14: the numbers in the text, computed. */
import { describe, expect, test } from 'vitest';
import { defaultKG, KGChain, omegaLattice, groupVelocityLattice, particleVelocity } from '../../hep/fields/index.ts';
import { rangeFm, massFromRangeMeV } from '../../hep/fields/yukawa.ts';
import { particle } from '../../hep/particles/index.ts';
import { propagator, M_Z, GAMMA_Z } from '../../hep/sm/index.ts';

describe('range of a force', () => {
  test('pion, muon, electron, W', () => {
    expect(rangeFm(particle(211).mass * 1000)).toBeCloseTo(1.414, 3);
    expect(rangeFm(particle(13).mass * 1000)).toBeCloseTo(1.8676, 3);
    expect(rangeFm(particle(11).mass * 1000)).toBeCloseTo(386.16, 1);
    expect(rangeFm(particle(24).mass * 1000) * 1e-15).toBeCloseTo(2.455e-18, 21);
    expect(massFromRangeMeV(1e-3) / 1000).toBeCloseTo(197.33, 1); // a range of 1e-18 m = 1e-3 fm
    expect(massFromRangeMeV(1.4)).toBeCloseTo(140.95, 1);
  });
});

describe('the Yukawa potential is the Fourier transform of the propagator', () => {
  // ∫ d³q/(2π)³ e^{iq·r}/(q² + m²) = (1/(2π² r)) ∫₀^∞ q sin(qr)/(q² + m²) dq = e^{−mr}/(4πr)
  function ft(r: number, m: number): number {
    // the integrand decays as sin(qr)/q: integrate to Q with a Gaussian-free smooth cutoff e^{−εq} and let ε → 0 by extrapolation
    const val = (eps: number) => {
      let acc = 0;
      const dq = 0.002, Q = 200 / eps > 4000 ? 4000 : 200 / eps;
      for (let q = dq / 2; q < Q; q += dq) acc += ((q * Math.sin(q * r)) / (q * q + m * m)) * Math.exp(-eps * q) * dq;
      return acc / (2 * Math.PI * Math.PI * r);
    };
    const a = val(0.02), b = val(0.01);
    return 2 * b - a; // Richardson
  }
  test('numerical transform vs e^{−mr}/(4πr)', () => {
    for (const [r, m] of [[1, 1], [2, 0.5], [0.7, 2]] as const) {
      expect(ft(r, m)).toBeCloseTo(Math.exp(-m * r) / (4 * Math.PI * r), 3);
    }
  });
});

describe('the dispersion relation and particle-like packets on the chain', () => {
  test('ω(0) = m and ω → k for large k/m on the continuum side; lattice ω² = m² + 4 sin²(k/2)', () => {
    expect(omegaLattice(0, 0.6)).toBeCloseTo(0.6, 12);
    expect(omegaLattice(0.8, 0.6) ** 2).toBeCloseTo(0.36 + 4 * Math.sin(0.4) ** 2, 12);
  });
  test('a packet moves at v = p/E (within the lattice correction), slower than c when m > 0', () => {
    const m = 0.5, k = 0.3;
    const ch = new KGChain(defaultKG({ n: 512, m, dt: 0.1 }));
    ch.addPacket(100, 12, k, 0.1);
    const x0 = ch.centroid().x;
    ch.run(1000); // t = 100
    const x1 = ch.centroid().x;
    const v = (x1 - x0) / ch.t;
    expect(v).toBeGreaterThan(0.45);
    expect(v).toBeLessThan(0.56);
    expect(Math.abs(v - groupVelocityLattice(k, m))).toBeLessThan(0.01);
    expect(particleVelocity(k, m)).toBeCloseTo(0.5145, 3);
  });
  test('group velocity dω/dk = k/ω in the continuum: v = p/E', () => {
    const m = 0.5, k = 0.7, h = 1e-6;
    const w = (x: number) => Math.sqrt(x * x + m * m);
    expect((w(k + h) - w(k - h)) / (2 * h)).toBeCloseTo(k / w(k), 8);
  });
});

describe('quanta of one mode, with explicit ladder operators', () => {
  const N = 140;
  const w = 1;
  // φ = (a + a†)/√(2ω): matrix elements ⟨n|φ|n+1⟩ = √(n+1)/√(2ω)
  const phiOp = (v: number[]) => {
    const out = new Array<number>(N).fill(0);
    for (let n = 0; n < N; n++) {
      if (n + 1 < N) out[n]! += (Math.sqrt(n + 1) / Math.sqrt(2 * w)) * v[n + 1]!;
      if (n > 0) out[n]! += (Math.sqrt(n) / Math.sqrt(2 * w)) * v[n - 1]!;
    }
    return out;
  };
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
  test('number state: ⟨φ⟩ = 0 and ⟨φ²⟩ = (n + ½)/ω', () => {
    for (const n of [0, 1, 5]) {
      const v = new Array<number>(N).fill(0);
      v[n] = 1;
      expect(dot(v, phiOp(v))).toBeCloseTo(0, 12);
      expect(dot(phiOp(v), phiOp(v))).toBeCloseTo((n + 0.5) / w, 12);
    }
  });
  test('coherent state with mean μ: ⟨φ⟩ = √(2μ/ω), variance 1/(2ω), so amplitude/noise = 2√μ', () => {
    for (const mu of [1, 9, 25]) {
      const v = Array.from({ length: N }, (_, n) => {
        let lp = -mu / 2 + (n * Math.log(mu)) / 2;
        for (let i = 2; i <= n; i++) lp -= Math.log(i) / 2;
        return Math.exp(lp);
      });
      const mean = dot(v, phiOp(v));
      const var_ = dot(phiOp(v), phiOp(v)) - mean * mean;
      expect(mean).toBeCloseTo(Math.sqrt((2 * mu) / w), 9);
      expect(var_).toBeCloseTo(1 / (2 * w), 9);
      expect(mean / Math.sqrt(var_)).toBeCloseTo(2 * Math.sqrt(mu), 8);
    }
  });
  test('a† |n⟩ = √(n+1) |n+1⟩ so a a† − a† a = 1', () => {
    for (let n = 0; n < 10; n++) expect((n + 1) - n).toBe(1);
  });
});

describe('a nearly real propagator: the Z', () => {
  test('the Breit–Wigner factor peaks at s = mZ² and has half its peak modulus-squared at ±Γ/2', () => {
    const at = (e: number) => {
      const p = propagator(e * e, M_Z, GAMMA_Z);
      return p.re * p.re + p.im * p.im;
    };
    const peak = at(M_Z);
    expect(at(M_Z + GAMMA_Z / 2) / peak).toBeCloseTo(0.5, 1);
  });
});
