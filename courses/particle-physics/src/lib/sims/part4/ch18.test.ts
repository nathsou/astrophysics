/** Chapter 18: the numbers in the text, computed. */
import { describe, expect, test } from 'vitest';
import { GELL_MANN, generators, mul, add, scale, structureConstants, identity, normF, sub } from './groups.ts';
import { alphaS, beta0, M_Z } from '../../hep/sm/index.ts';
import { stringBreaking } from '../../hep/hadronise/index.ts';
import { CF, CA, TR } from '../../hep/shower/index.ts';
import { generateJetEvents, jetMultiplicities } from './jetsim.ts';

describe('colour factors from the matrices', () => {
  test('C_F = Σ T_a T_a = 4/3 and C_A δ_ab = Σ f_acd f_bcd = 3 δ_ab; T_R = 1/2; the library agrees', () => {
    const T = generators('SU3');
    let cf = scale(identity(3), 0);
    for (const t of T) cf = add(cf, mul(t, t));
    expect(normF(sub(cf, scale(identity(3), 4 / 3)))).toBeLessThan(1e-12);
    const f = structureConstants('SU3');
    for (let a = 0; a < 8; a++)
      for (let b = 0; b < 8; b++) {
        let s = 0;
        for (let c = 0; c < 8; c++) for (let d = 0; d < 8; d++) s += f[a]![c]![d]! * f[b]![c]![d]!;
        expect(s).toBeCloseTo(a === b ? 3 : 0, 10);
      }
    expect([CF, CA, TR]).toEqual([4 / 3, 3, 0.5]);
    expect(CA / CF).toBeCloseTo(9 / 4, 12);
    expect(GELL_MANN.length).toBe(8);
  });
});

describe('running of αs', () => {
  test('β0 = 11 − 2nf/3: 23/3 for five flavours, changes sign at 16.5', () => {
    expect(beta0(5)).toBeCloseTo(23 / 3, 12);
    expect(beta0(6)).toBeCloseTo(7, 12);
    expect((11 * 3) / 2).toBe(16.5);
  });
  test('one-loop solution from αs(mZ): 0.173 at 10 GeV (library: 0.173 at one loop, 0.178 at two); 0.30 near 2 GeV', () => {
    const b = beta0(5) / (4 * Math.PI);
    const a10 = 0.118 / (1 + b * 0.118 * Math.log((10 * 10) / (M_Z * M_Z)));
    expect(a10).toBeCloseTo(0.173, 3);
    expect(alphaS(10, 1)).toBeCloseTo(a10, 3);
    expect(alphaS(10, 2)).toBeCloseTo(0.178, 3);
    expect(alphaS(2)).toBeGreaterThan(0.29);
    expect(alphaS(2)).toBeLessThan(0.30);
    expect(alphaS(10) / alphaS(M_Z)).toBeCloseTo(1.51, 2);
  });
  test('Λ at one loop with five flavours is 88 MeV, and ħc/Λ is 2.2 fm there (1 fm for 200 MeV)', () => {
    const lam = M_Z * Math.exp(-(2 * Math.PI) / (beta0(5) * 0.118));
    expect(lam * 1000).toBeCloseTo(87.8, 1);
    expect(0.1973269804 / 0.2).toBeCloseTo(0.987, 3);
  });
});

describe('the string', () => {
  test('a metre of string at 1 GeV/fm stores 1e15 GeV = 1.6e5 J, about 16 tonnes lifted one metre', () => {
    const joule = 1e15 * 1.602176634e-10;
    expect(joule).toBeCloseTo(1.602e5, -2);
    expect(joule / 9.81).toBeCloseTo(16330, -2);
  });
  test('the toy string-breaking probability: threshold 0.79 fm, 15 % at 2 fm, 57 % at 4 fm, 87 % at 6 fm', () => {
    expect(stringBreaking(2).thresholdFm).toBeCloseTo(0.789, 3);
    expect(stringBreaking(1).probability).toBeLessThan(0.02);
    expect(stringBreaking(2).probability).toBeCloseTo(0.148, 2);
    expect(stringBreaking(4).probability).toBeCloseTo(0.573, 2);
    expect(stringBreaking(6).probability).toBeCloseTo(0.874, 2);
  });
});

describe('the quark–gluon plasma temperature', () => {
  test('155 MeV is 1.8e12 K, about 1.2e5 times the solar core (1.5e7 K)', () => {
    const K = 155e6 * 11604.518;
    expect(K / 1e12).toBeCloseTo(1.8, 1);
    expect(K / 1.5e7).toBeGreaterThan(1e5);
  });
});

describe('jets in the figure: two-jet and three-jet fractions', () => {
  const frac = (sqrtS: number, shower: boolean, R = 0.7, ptMin = 5) => {
    const ev = generateJetEvents(sqrtS, 160, 1000 + Math.round(sqrtS * 10) + (shower ? 0 : 500000), { shower });
    const m = jetMultiplicities(ev, R, ptMin);
    return { two: m.filter((k) => k === 2).length / m.length, three: m.filter((k) => k >= 3).length / m.length };
  };
  test('shower off: no three-jet events; shower on: a substantial minority at 91 GeV that falls with R', () => {
    expect(frac(91.2, false).three).toBeLessThan(0.03);
    const a = frac(91.2, true, 0.4);
    const b = frac(91.2, true, 1.2);
    expect(a.three).toBeGreaterThan(0.1);
    expect(a.three).toBeGreaterThan(b.three);
    console.log('three-jet fractions at 91.2 GeV, R = 0.4, 0.7, 1.2:', a.three, frac(91.2, true, 0.7).three, b.three);
    console.log('at 30 GeV (R = 0.7, pT > 5):', frac(30, true).three, ' at 200 GeV:', frac(200, true).three);
  });
});
