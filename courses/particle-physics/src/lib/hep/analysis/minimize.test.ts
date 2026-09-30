import { describe, expect, test } from 'vitest';
import { invertSPD, minimize, minos, profile } from './minimize.ts';

const rosenbrock = (x: number[]) => 100 * (x[1]! - x[0]! ** 2) ** 2 + (1 - x[0]!) ** 2;

describe('minimize', () => {
  test('Rosenbrock from the classic start, BFGS', () => {
    const r = minimize(rosenbrock, [-1.2, 1], { method: 'bfgs' });
    expect(r.converged).toBe(true);
    expect(r.x[0]).toBeCloseTo(1, 4);
    expect(r.x[1]).toBeCloseTo(1, 4);
    expect(r.fval).toBeLessThan(1e-9);
  });
  test('Rosenbrock with Nelder–Mead', () => {
    const r = minimize(rosenbrock, [-1.2, 1], { method: 'nelder-mead' });
    expect(r.x[0]).toBeCloseTo(1, 3);
    expect(r.x[1]).toBeCloseTo(1, 3);
  });
  test('ten-dimensional Rosenbrock', () => {
    const f = (x: number[]) => x.slice(1).reduce((s, xi, i) => s + 100 * (xi - x[i]! ** 2) ** 2 + (1 - x[i]!) ** 2, 0);
    const r = minimize(f, new Array(10).fill(0.5), { method: 'bfgs', maxIter: 1000, hessian: false });
    expect(r.fval).toBeLessThan(1e-6);
  });
  test('covariance of a correlated quadratic form: cov = 2·errorDef·H⁻¹', () => {
    const H = [[4, 1.5], [1.5, 2]];
    const a = [1, -2];
    const f = (x: number[]) => 0.5 * ((x[0]! - a[0]!) * (H[0]![0]! * (x[0]! - a[0]!) + H[0]![1]! * (x[1]! - a[1]!)) + (x[1]! - a[1]!) * (H[1]![0]! * (x[0]! - a[0]!) + H[1]![1]! * (x[1]! - a[1]!)));
    const r = minimize(f, [5, 5]);
    const inv = invertSPD(H)!;
    expect(r.x[0]).toBeCloseTo(1, 5);
    expect(r.x[1]).toBeCloseTo(-2, 5);
    expect(r.covariance![0]![0]).toBeCloseTo(inv[0]![0]!, 5);
    expect(r.covariance![0]![1]).toBeCloseTo(inv[0]![1]!, 5);
    expect(r.errors[1]).toBeCloseTo(Math.sqrt(inv[1]![1]!), 5);
    // With a χ² (errorDef = 1) the errors are √2 larger for the same function.
    const r1 = minimize(f, [5, 5], { errorDef: 1 });
    expect(r1.errors[0]! / r.errors[0]!).toBeCloseTo(Math.SQRT2, 5);
  });
  test('parameter limits: the constrained minimum of a quadratic sits on the limit', () => {
    const f = (x: number[]) => (x[0]! - 3) ** 2 + (x[1]! + 1) ** 2;
    const r = minimize(f, [0, 1], { upper: [2, Infinity], lower: [-Infinity, 0] });
    expect(r.x[0]).toBeCloseTo(2, 4);
    expect(r.x[1]).toBeCloseTo(0, 4);
    expect(r.fval).toBeCloseTo(2, 6);
  });
  test('two limits, and a minimum inside them', () => {
    const f = (x: number[]) => (x[0]! - 0.3) ** 2 * 10 + (x[1]! - 7) ** 2;
    const r = minimize(f, [0.9, 1], { lower: [0, 0], upper: [1, 10] });
    expect(r.x[0]).toBeCloseTo(0.3, 5);
    expect(r.x[1]).toBeCloseTo(7, 5);
    expect(r.errors[0]).toBeCloseTo(Math.sqrt(0.5 / 10), 4);
  });
  test('fixed parameters stay fixed and get zero error', () => {
    const f = (x: number[]) => (x[0]! - 1) ** 2 + (x[1]! - 2) ** 2 + (x[2]! - 3) ** 2;
    const r = minimize(f, [0, 0.5, 0], { fixed: [false, true, false] });
    expect(r.x[1]).toBe(0.5);
    expect(r.x[0]).toBeCloseTo(1, 5);
    expect(r.x[2]).toBeCloseTo(3, 5);
    expect(r.errors[1]).toBe(0);
    expect(r.fval).toBeCloseTo(2.25, 8);
  });
  test('a non-smooth function falls back on Nelder–Mead in auto mode', () => {
    const f = (x: number[]) => Math.abs(x[0]! - 2) + Math.abs(x[1]! + 1);
    const r = minimize(f, [0, 0], { hessian: false });
    expect(r.x[0]).toBeCloseTo(2, 3);
    expect(r.x[1]).toBeCloseTo(-1, 3);
  });
  test('NaN regions are avoided', () => {
    const f = (x: number[]) => (x[0]! <= 0 ? NaN : x[0]! - Math.log(x[0]!));
    const r = minimize(f, [5]);
    expect(r.x[0]).toBeCloseTo(1, 4);
  });
  test('Gaussian likelihood: error of the mean is σ/√n and the error of σ is σ/√2n', () => {
    // −ln L for n points with sample mean m and sample variance v, as a function of (μ, σ).
    const n = 100, m = 3, v = 4;
    const nll = (p: number[]) => n * Math.log(p[1]!) + (n * (v + (m - p[0]!) ** 2)) / (2 * p[1]! ** 2);
    const r = minimize(nll, [0, 1], { lower: [-Infinity, 1e-3] });
    expect(r.x[0]).toBeCloseTo(m, 4);
    expect(r.x[1]).toBeCloseTo(Math.sqrt(v), 4);
    expect(r.errors[0]).toBeCloseTo(Math.sqrt(v / n), 4);
    expect(r.errors[1]).toBeCloseTo(Math.sqrt(v / (2 * n)), 3);
  });
});

describe('profile and minos', () => {
  test('profile of a correlated parabola is the parabola with the marginal width', () => {
    const f = (x: number[]) => 0.5 * (4 * x[0]! ** 2 + 2 * 1.5 * x[0]! * x[1]! + 2 * x[1]! ** 2);
    const best = minimize(f, [1, 1]);
    const p = profile(f, 0, [-0.5, 0, 0.5], { best });
    // Profiling out y leaves ½ (4 − 1.5²/2) x²; Δ(−2 ln L) = (4 − 1.125) x².
    expect(p[1]!.delta).toBeCloseTo(0, 6);
    expect(p[2]!.delta).toBeCloseTo((4 - 1.5 ** 2 / 2) * 0.25, 5);
    expect(p[0]!.delta).toBeCloseTo(p[2]!.delta, 5);
  });
  test('MINOS on an asymmetric likelihood (Poisson with n = 3): the Δ(−2 ln L) = 1 interval', () => {
    const n = 3;
    const nll = (p: number[]) => p[0]! - n * Math.log(p[0]!);
    const best = minimize(nll, [2], { lower: [1e-6] });
    const m = minos(nll, best, 0, { lower: [1e-6] });
    // Solve 2(μ − n − n ln(μ/n)) = 1 by hand-rolled bisection.
    const g = (mu: number) => 2 * (mu - n - n * Math.log(mu / n)) - 1;
    const root = (a: number, b: number) => { for (let i = 0; i < 100; i++) { const c = (a + b) / 2; if (Math.sign(g(c)) === Math.sign(g(a))) a = c; else b = c; } return (a + b) / 2; };
    expect(m.hi).toBeCloseTo(root(n, 10) - n, 3);
    expect(m.lo).toBeCloseTo(n - root(0.1, n), 3);
    expect(m.hi).toBeGreaterThan(m.lo);
  });
});
