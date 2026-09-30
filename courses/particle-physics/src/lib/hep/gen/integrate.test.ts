import { afterEach, describe, expect, test } from 'vitest';
import { rng } from '../random/index.ts';
import { setOverride } from '../hooks.ts';
import {
  Unweighter, Vegas, breitWignerMap, crossSection, gaussLegendre, integrateMapped, linearMap, mixMap, powerMap, unweight,
} from './integrate.ts';
import type { Process } from './process.ts';

afterEach(() => setOverride('gen.unweight', undefined));

describe('Gauss–Legendre', () => {
  test('integrates polynomials exactly up to degree 2n − 1', () => {
    const g = gaussLegendre(6);
    let s = 0;
    for (let i = 0; i < 6; i++) s += g.w[i]! * g.x[i]! ** 11;
    expect(s).toBeCloseTo(1 / 12, 14);
    expect(g.w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
  });
  test('32 points integrate a smooth function to 1e-14', () => {
    const g = gaussLegendre(32);
    let s = 0;
    for (let i = 0; i < 32; i++) s += g.w[i]! * Math.exp(g.x[i]!);
    expect(s).toBeCloseTo(Math.E - 1, 13);
  });
});

describe('VEGAS', () => {
  const s = 0.05;
  const one = s * Math.sqrt(2 * Math.PI) * erf(0.5 / (s * Math.SQRT2));
  const exact = one ** 3;
  const peak = (u: Float64Array) => Math.exp(-((u[0]! - 0.5) ** 2 + (u[1]! - 0.5) ** 2 + (u[2]! - 0.5) ** 2) / (2 * s * s));

  test('a narrow 3-d Gaussian: the adaptive estimate is right and much more precise than flat sampling', () => {
    const flat = new Vegas(3).integrate(peak, rng(1), { iterations: 1, points: 20000, adapt: false });
    const v = new Vegas(3);
    const res = v.integrate(peak, rng(2), { iterations: 8, points: 5000 });
    expect(Math.abs(res.value - exact)).toBeLessThan(4 * res.error);
    // the same number of points per iteration gives a far smaller error once the grid has adapted
    const frozen = v.integrate(peak, rng(3), { iterations: 1, points: 20000, adapt: false });
    expect(Math.abs(frozen.value - exact)).toBeLessThan(4 * frozen.error);
    expect(frozen.error).toBeLessThan(flat.error / 4);
  });
  test('a singular integrand (x^−0.7 has infinite variance) is tamed by the grid', () => {
    const f = (u: Float64Array) => Math.pow(u[0]!, -0.7);
    const v = new Vegas(1, 50);
    v.integrate(f, rng(4), { iterations: 6, points: 4000 });
    const res = v.integrate(f, rng(5), { iterations: 3, points: 20000, adapt: false });
    expect(res.value).toBeGreaterThan(3.33 * 0.97);
    expect(res.value).toBeLessThan(3.334 * 1.03);
  });
  test('the jacobian of a sample integrates to 1 over the unit cube (grid is a proper change of variables)', () => {
    const v = new Vegas(2, 20);
    v.integrate((u) => Math.exp(-20 * u[0]! - 5 * u[1]!), rng(6), { iterations: 4, points: 3000 });
    const r = rng(7);
    const u = new Float64Array(2);
    let s1 = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) s1 += v.sample(r, u);
    expect(s1 / n).toBeGreaterThan(0.97);
    expect(s1 / n).toBeLessThan(1.03);
    for (const e of v.edges) for (let i = 0; i < e.length - 1; i++) expect(e[i + 1]!).toBeGreaterThan(e[i]!);
  });
  test('deterministic for a given seed', () => {
    const a = new Vegas(2).integrate(peak2, rng(9), { iterations: 3, points: 1000 });
    const b = new Vegas(2).integrate(peak2, rng(9), { iterations: 3, points: 1000 });
    expect(a.value).toBe(b.value);
  });
});
function peak2(u: Float64Array): number {
  return Math.exp(-((u[0]! - 0.3) ** 2 + (u[1]! - 0.6) ** 2) / 0.02);
}
/** erf by the Abramowitz–Stegun series in high precision (numerical integration is simpler and adequate). */
function erf(x: number): number {
  let s = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * x;
    s += Math.exp(-t * t);
  }
  return (2 / Math.sqrt(Math.PI)) * s * (x / n);
}

describe('mappings', () => {
  test('density is the inverse of the jacobian, for every mapping', () => {
    const maps = [breitWignerMap(91.19, 2.5, 50 ** 2, 130 ** 2), powerMap(2, 100, 1e6), powerMap(1, 100, 1e6), linearMap(3, 9), mixMap([{ map: powerMap(1, 10, 1e4), weight: 1 }, { map: breitWignerMap(91, 3, 100, 1e4), weight: 2 }])];
    for (const m of maps)
      for (const u of [0.05, 0.3, 0.5, 0.8, 0.97]) {
        const { x, jac } = m(u);
        expect(m.density(x) * jac).toBeCloseTo(1, 10);
      }
  });
  test('the density of every mapping integrates to 1', () => {
    const m = mixMap([{ map: powerMap(2, 50 ** 2, 200 ** 2), weight: 1 }, { map: breitWignerMap(91.19, 2.5, 50 ** 2, 200 ** 2), weight: 3 }]);
    // ∫ density dx over a fine grid in u (x = x(u)): Σ density·(dx/du) du = 1 trivially; instead integrate in x with a geometric grid
    let s = 0;
    const n = 2_000_000;
    const lo = 50 ** 2, hi = 200 ** 2;
    for (let i = 0; i < n; i++) {
      const x = lo + ((i + 0.5) * (hi - lo)) / n;
      s += m.density(x) * ((hi - lo) / n);
    }
    expect(s).toBeCloseTo(1, 4);
  });
  test('the Breit–Wigner mapping removes the peak: the estimate of ∫ dm²/((m² − M²)² + M²Γ²) has tiny variance', () => {
    const M = 91.19, G = 2.5;
    const map = breitWignerMap(M, G, 10 ** 2, 300 ** 2);
    const r = rng(12);
    let s = 0, s2 = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const { x, jac } = map(r());
      const w = jac / ((x - M * M) ** 2 + M * M * G * G);
      s += w;
      s2 += w * w;
    }
    const mean = s / n;
    expect(Math.sqrt(s2 / n - mean * mean) / mean).toBeLessThan(1e-5); // rounding only; uniform sampling would give a relative spread of order 1
    const exact = (Math.atan((300 ** 2 - M * M) / (M * G)) - Math.atan((10 ** 2 - M * M) / (M * G))) / (M * G);
    expect(mean / exact).toBeCloseTo(1, 8);
  });
  test('mixture: ∫ g(x) dx estimated through the mapping (g = 1/x² on [1, 10] is 0.9), and the quadrature per segment agrees', () => {
    const m = mixMap([{ map: powerMap(1, 1, 10), weight: 1 }, { map: powerMap(2, 1, 10), weight: 1 }, { map: linearMap(1, 10), weight: 1 }]);
    const r = rng(3);
    let s = 0;
    const n = 200000;
    for (let i = 0; i < n; i++) {
      const { x, jac } = m(r());
      s += jac / (x * x);
    }
    expect(s / n).toBeCloseTo(0.9, 2);
    expect(integrateMapped(m, 20, (u) => { const { x, jac } = m(u); return jac / (x * x); })).toBeCloseTo(0.9, 6);
  });
});

describe('unweighting', () => {
  test('accepts with probability w/wMax', () => {
    const r = rng(1);
    let k = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) if (unweight(0.3, 1, r)) k++;
    expect(k / n).toBeGreaterThan(0.295);
    expect(k / n).toBeLessThan(0.305);
  });
  test('the unweighted sample has the weighted distribution: x uniform with w = x² gives ⟨x⟩ = 3/4', () => {
    const r = rng(2);
    const u = new Unweighter(1);
    let sum = 0, n = 0;
    for (let i = 0; i < 200000; i++) {
      const x = r();
      if (u.accept(x * x, r)) {
        sum += x;
        n++;
      }
    }
    expect(sum / n).toBeGreaterThan(0.745);
    expect(sum / n).toBeLessThan(0.755);
    expect(u.efficiency).toBeCloseTo(1 / 3, 1);
    expect(u.state.overweight).toBe(0);
  });
  test('a weight above the running maximum raises it and is kept', () => {
    const r = rng(3);
    const u = new Unweighter(1);
    expect(u.accept(5, r)).toBe(true);
    expect(u.state.max).toBe(5);
    expect(u.state.overweight).toBe(1);
    expect(u.accept(-1, r)).toBe(false);
    expect(u.accept(0, r)).toBe(false);
  });
  test("the reader's version of the hook gen.unweight replaces the reference", () => {
    const r = rng(4);
    const u = new Unweighter(1);
    let kept = 0;
    for (let i = 0; i < 1000; i++) if (u.accept(0.001, r)) kept++;
    expect(kept).toBeLessThan(10);
    setOverride('gen.unweight', () => true);
    const u2 = new Unweighter(1);
    kept = 0;
    for (let i = 0; i < 1000; i++) if (u2.accept(0.001, r)) kept++;
    expect(kept).toBe(1000);
  });
});

describe('crossSection', () => {
  const dummy: Process = {
    name: 'dummy',
    title: 'dummy',
    beams: 'ee',
    sigma: () => 2,
    sigmaAnalytic: () => 2,
    weightedPoint: (r) => 4 * r(), // mean 2, variance 4/3
    generate: () => { throw new Error('unused'); },
  };
  test('mean and standard error of the weighted points, with the pull against the analytic value', () => {
    const res = crossSection(dummy, 100, 40000, rng(5));
    expect(res.sigma).toBeCloseTo(2, 1);
    expect(res.error).toBeCloseTo(Math.sqrt(4 / 3 / 40000), 3);
    expect(Math.abs(res.pull!)).toBeLessThan(4);
    expect(res.analytic).toBe(2);
  });
});
