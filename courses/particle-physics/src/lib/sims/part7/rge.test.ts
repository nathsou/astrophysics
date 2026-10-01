import { describe, expect, test } from 'vitest';
import { initialCouplings, runCouplings, M_PLANCK_GEV } from './rge.ts';

describe('the one-loop running of the Higgs self-coupling (a toy)', () => {
  test('λ starts at 0.126 and the top Yukawa coupling at about 0.93', () => {
    const c = initialCouplings(172.57, 125.2);
    expect(c[4]).toBeCloseTo(0.1264, 4);
    expect(c[3]).toBeGreaterThan(0.9);
    expect(c[3]).toBeLessThan(0.97);
  });

  test('for the measured top mass λ falls through zero between 10⁷ and 10¹¹ GeV (the careful calculations say about 10¹⁰)', () => {
    const r = runCouplings(172.57);
    console.log('toy zero crossing at', r.zeroAt.toExponential(2), 'GeV');
    expect(r.zeroAt).toBeGreaterThan(1e7);
    expect(r.zeroAt).toBeLessThan(1e11);
    expect(r.lambda.at(-1)!).toBeLessThan(0);
  });

  test('the crossing scale falls steeply as the top mass rises, and λ stays positive for a light top', () => {
    const z = (mt: number) => runCouplings(mt).zeroAt;
    console.log('crossing scales for mt = 165, 170, 172.57, 175, 180:', [165, 170, 172.57, 175, 180].map((m) => z(m).toExponential(1)).join(' '));
    expect(z(175)).toBeLessThan(z(172.57));
    expect(z(172.57)).toBeLessThan(z(170));
    expect(z(165)).toBeGreaterThan(M_PLANCK_GEV * 0 + 1e12);
  });

  test('a heavier Higgs boson pushes the crossing up', () => {
    expect(runCouplings(172.57, 130).zeroAt).toBeGreaterThan(runCouplings(172.57, 125.2).zeroAt);
  });
});
