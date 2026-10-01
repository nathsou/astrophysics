import { describe, expect, test } from 'vitest';
import { solveFreezeOut, sigmaVForOmega, yEq, CM3S_PER_GEV2 } from './freezeout.ts';

describe('freeze-out', () => {
  test('1 GeV⁻² = 1.167e-17 cm³/s', () => {
    expect(CM3S_PER_GEV2 / 1.1673e-17).toBeCloseTo(1, 3);
  });
  test('the abundance follows equilibrium at first, then stays constant', () => {
    const r = solveFreezeOut({ mass: 100, sigmaV: 3e-26 });
    const i10 = r.x.findIndex((x) => x >= 10);
    expect(r.Y[i10]! / r.Yeq[i10]!).toBeGreaterThan(0.95);
    expect(r.Y[i10]! / r.Yeq[i10]!).toBeLessThan(1.1);
    const last = r.Y.length - 1;
    expect(r.Y[last]! / r.Y[last - 500]!).toBeGreaterThan(0.97);
    expect(r.Y[last]! / r.Yeq[last]!).toBeGreaterThan(1e10);
    expect(r.xFreeze).toBeGreaterThan(15);
    expect(r.xFreeze).toBeLessThan(30);
  });
  test('the relic density is inversely proportional to the cross-section', () => {
    const a = solveFreezeOut({ mass: 100, sigmaV: 1e-26 }).omegaH2;
    const b = solveFreezeOut({ mass: 100, sigmaV: 2e-26 }).omegaH2;
    expect(a / b).toBeGreaterThan(1.8);
    expect(a / b).toBeLessThan(2.2);
  });
  test('a weak-scale mass and cross-section of order 3e-26 cm³/s give Ω h² of order 0.1', () => {
    const om = solveFreezeOut({ mass: 100, sigmaV: 3e-26 }).omegaH2;
    expect(om).toBeGreaterThan(0.05);
    expect(om).toBeLessThan(0.25);
  });
  test('the cross-section for the observed Ω h² = 0.120 is 1.5–4 × 10⁻²⁶ cm³/s, almost independent of mass', () => {
    const a = sigmaVForOmega(0.12, 100);
    const b = sigmaVForOmega(0.12, 1000);
    expect(a).toBeGreaterThan(1.5e-26);
    expect(a).toBeLessThan(4e-26);
    expect(b / a).toBeGreaterThan(0.8);
    expect(b / a).toBeLessThan(1.4);
  });
  test('equilibrium abundance falls exponentially', () => {
    expect(yEq(20, 2, 90) / yEq(21, 2, 90)).toBeGreaterThan(2.5);
  });
});
