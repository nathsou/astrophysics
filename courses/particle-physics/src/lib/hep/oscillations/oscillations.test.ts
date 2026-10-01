import { describe, expect, test, afterEach } from 'vitest';
import {
  OSC_PHASE_CONSTANT, HBARC_EV_M, phase, oscillationLength, probability, probabilityTwoFlavourReference, pmns, mul3, dagger3,
  defaultParams, paramsFromSin2, probabilities3, probabilityTwoFlavourMatter, matterPotential, resonanceEnergy, jarlskog,
  neutrinoMasses, sumOfMasses, betaDecayMass, majoranaRange, solarSurvival, mixingSquared,
} from './index.ts';
import { setOverride } from '../hooks.ts';

afterEach(() => setOverride('oscillations.probability', undefined));

describe('the phase constant', () => {
  test('1.267 is Δm² L / (4 E ħc) in eV², km and GeV (derived step by step)', () => {
    // Δm² = 1 eV², L = 1 km, E = 1 GeV. Natural units: Δm² L / 4E with L in eV⁻¹ and E in eV.
    const hbarcEvM = 197.3269804e6 * 1e-15; // 197.327 MeV·fm = 1.97327e-7 eV·m
    expect(HBARC_EV_M).toBeCloseTo(hbarcEvM, 12);
    const Lnat = 1000 / hbarcEvM; // 1 km in eV⁻¹
    const Enat = 1e9; // 1 GeV in eV
    const direct = (1 * Lnat) / (4 * Enat);
    expect(direct).toBeCloseTo(1.26693, 4);
    expect(OSC_PHASE_CONSTANT).toBeCloseTo(direct, 10);
    expect(OSC_PHASE_CONSTANT).toBeCloseTo(1.267, 3);
  });
  test('oscillation length: 2.48 E/Δm² km', () => {
    expect(oscillationLength(1, 1)).toBeCloseTo(2.48, 2);
    expect(oscillationLength(2.5e-3, 1)).toBeCloseTo(992, -1); // about 1000 km per GeV at the atmospheric splitting
  });
});

describe('two flavours', () => {
  test('first maximum: phase π/2 gives P = sin²2θ', () => {
    const dm2 = 2.5e-3, E = 1;
    const L = Math.PI / 2 / (OSC_PHASE_CONSTANT * dm2 / E);
    expect(L).toBeCloseTo(495.6, 0); // the atmospheric-scale oscillation maximum at 1 GeV, about 500 km
    expect(probabilityTwoFlavourReference(Math.PI / 4, dm2, L, E)).toBeCloseTo(1, 12);
    expect(probabilityTwoFlavourReference(0.3, dm2, L, E)).toBeCloseTo(Math.sin(0.6) ** 2, 12);
  });
  test('no mixing, no oscillation; L = 0, no oscillation', () => {
    expect(probabilityTwoFlavourReference(0, 2.5e-3, 500, 1)).toBe(0);
    expect(probabilityTwoFlavourReference(0.7, 2.5e-3, 0, 1)).toBe(0);
  });
  test('the hook is used when installed, and removed again', () => {
    expect(probability(0.5, 1e-3, 100, 1)).toBeCloseTo(probabilityTwoFlavourReference(0.5, 1e-3, 100, 1), 12);
    setOverride('oscillations.probability', (() => 0.123) as never);
    expect(probability(0.5, 1e-3, 100, 1)).toBe(0.123);
  });
  test('phase helper agrees with the formula', () => {
    expect(phase(2.5e-3, 295, 0.6)).toBeCloseTo(OSC_PHASE_CONSTANT * 2.5e-3 * 295 / 0.6, 12);
  });
});

describe('the PMNS matrix', () => {
  const p = defaultParams();
  const U = pmns(p.theta12, p.theta13, p.theta23, p.deltaCP);
  test('is unitary', () => {
    const I = mul3(U, dagger3(U));
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        expect(I.re[i]![j]!).toBeCloseTo(i === j ? 1 : 0, 12);
        expect(I.im[i]![j]!).toBeCloseTo(0, 12);
      }
  });
  test('|U_e3|² = sin²θ13, |U_e2|² = sin²θ12 cos²θ13', () => {
    const m = mixingSquared(U);
    expect(m[0]![2]).toBeCloseTo(0.022, 6);
    expect(m[0]![1]).toBeCloseTo(0.307 * (1 - 0.022), 6);
    // every row and column sums to one
    for (let i = 0; i < 3; i++) {
      expect(m[i]![0]! + m[i]![1]! + m[i]![2]!).toBeCloseTo(1, 12);
      expect(m[0]![i]! + m[1]![i]! + m[2]![i]!).toBeCloseTo(1, 12);
    }
  });
  test('the mixing is large: ν₃ is nearly half ν_μ and half ν_τ, and only a little ν_e', () => {
    const m = mixingSquared(U);
    expect(m[0]![2]!).toBeLessThan(0.03);
    expect(m[1]![2]!).toBeGreaterThan(0.4);
    expect(m[2]![2]!).toBeGreaterThan(0.4);
  });
  test('Jarlskog invariant: at most about 0.033, against about 3e-5 for quarks', () => {
    const j = jarlskog({ ...p, deltaCP: Math.PI / 2 });
    expect(j).toBeGreaterThan(0.03);
    expect(j).toBeLessThan(0.04);
    expect(jarlskog({ ...p, deltaCP: 0 })).toBeCloseTo(0, 12);
  });
});

describe('three-flavour probabilities', () => {
  const p = defaultParams();
  test('rows sum to one (vacuum and matter, neutrinos and antineutrinos)', () => {
    for (const opt of [{}, { matter: 2.8 }, { anti: true }, { matter: 2.8, anti: true }]) {
      for (const [L, E] of [[295, 0.6], [1300, 2.5], [12700, 5], [52, 0.004]] as const) {
        const P = probabilities3(p, L, E, opt);
        for (let a = 0; a < 3; a++) expect(P[a]![0]! + P[a]![1]! + P[a]![2]!).toBeCloseTo(1, 9);
        for (let b = 0; b < 3; b++) expect(P[0]![b]! + P[1]![b]! + P[2]![b]!).toBeCloseTo(1, 9);
      }
    }
  });
  test('L = 0: nothing has changed', () => {
    const P = probabilities3(p, 0, 1);
    expect(P[0]![0]).toBeCloseTo(1, 12);
    expect(P[1]![1]).toBeCloseTo(1, 12);
  });
  test('atmospheric-scale disappearance reaches about sin²2θ23 at the first maximum', () => {
    const E = 1;
    const L = Math.PI / 2 / (OSC_PHASE_CONSTANT * 2.5e-3 / E);
    const P = probabilities3(p, L, E);
    const survival = P[1]![1]!;
    const s22 = Math.sin(2 * p.theta23) ** 2;
    expect(survival).toBeGreaterThan(1 - s22 - 0.06);
    expect(survival).toBeLessThan(1 - s22 + 0.06);
  });
  test('reactor: P(ν̄_e → ν̄_e) at 1.8 km / 3 MeV is the θ13 dip, at 53 km / 4 MeV the solar dip', () => {
    // Daya Bay-like: the first θ13 minimum at 2.5e-3 eV²: L/E = π/2/(1.267 Δm²) = 496 km/GeV, i.e. 1.6 km at 3.2 MeV
    const short = probabilities3(p, 1.6, 0.0032, { anti: true })[0]![0]!;
    expect(short).toBeGreaterThan(1 - 4 * 0.022 - 0.02);
    expect(short).toBeLessThan(1 - 4 * 0.022 * 0.9 * 0.5);
    // a long baseline: the solar term dominates, survival well below 1
    const long = probabilities3(p, 53, 0.004, { anti: true })[0]![0]!;
    expect(long).toBeLessThan(0.75);
  });
  test('CP: in vacuum P(νμ→νe) − P(ν̄μ→ν̄e) = −16 J sinΔ21 sinΔ31 sinΔ32 (size checked), and it vanishes for δ = 0, π', () => {
    const L = 295, E = 0.6;
    const pd = { ...p, deltaCP: -Math.PI / 2 };
    const a = probabilities3(pd, L, E)[1]![0]!;
    const b = probabilities3(pd, L, E, { anti: true })[1]![0]!;
    const d21 = phase(pd.dm21, L, E), d31 = phase(pd.dm31, L, E), d32 = d31 - d21;
    const expected = 16 * Math.abs(jarlskog(pd) * Math.sin(d21) * Math.sin(d31) * Math.sin(d32));
    expect(Math.abs(a - b)).toBeCloseTo(expected, 6);
    for (const dcp of [0, Math.PI]) {
      const q = { ...p, deltaCP: dcp };
      expect(probabilities3(q, L, E)[1]![0]!).toBeCloseTo(probabilities3(q, L, E, { anti: true })[1]![0]!, 10);
    }
  });
  test('T2K-like beam: P(νμ→νe) is a few per cent, and larger than the antineutrino one for δ = −π/2', () => {
    const pd = { ...p, deltaCP: -Math.PI / 2 };
    const a = probabilities3(pd, 295, 0.6, { matter: 2.6 })[1]![0]!;
    const b = probabilities3(pd, 295, 0.6, { matter: 2.6, anti: true })[1]![0]!;
    expect(a).toBeGreaterThan(0.03);
    expect(a).toBeLessThan(0.1);
    expect(a).toBeGreaterThan(b);
  });
});

describe('matter', () => {
  test('V = 7.63e-14 eV × Y_e ρ', () => {
    expect(matterPotential(1, 1) / 7.63e-14).toBeCloseTo(1, 2);
    expect(matterPotential(2.8, 0.5) / (7.63e-14 * 1.4)).toBeCloseTo(1, 2);
  });
  test('the numerical propagation equals the closed two-flavour MSW formula (θ12 = 0, Δm²21 = 0, e–τ system)', () => {
    // with θ23 = 0 and Δm²21 = 0 the νμ decouples and the e–τ pair oscillates with θ13 and Δm²31 in matter
    const p = { theta12: 0.5, theta13: 0.15, theta23: 0, deltaCP: 0, dm21: 0, dm31: 2.5e-3 };
    const rho = 2.8;
    const V = matterPotential(rho);
    for (const [L, E] of [[800, 2], [1300, 6], [3000, 10], [5000, 20]] as const) {
      const P = probabilities3(p, L, E, { matter: rho })[0]![2]!;
      const closed = probabilityTwoFlavourMatter(p.theta13, p.dm31, L, E, V);
      expect(P).toBeCloseTo(closed, 6);
    }
  });
  test('the resonance for θ13 in the Earth\'s crust is near 10 GeV, and the oscillation is enhanced there', () => {
    const theta = Math.asin(Math.sqrt(0.022));
    const V = matterPotential(2.8);
    const Eres = resonanceEnergy(theta, 2.5e-3, V);
    expect(Eres).toBeGreaterThan(8);
    expect(Eres).toBeLessThan(14);
    const L = 1300;
    const atRes = probabilityTwoFlavourMatter(theta, 2.5e-3, L, Eres, V);
    const vac = probabilityTwoFlavourMatter(theta, 2.5e-3, L, Eres, 0);
    expect(atRes).toBeGreaterThan(vac);
  });
  test('matter swaps the sign of the effect for antineutrinos and for the inverted ordering', () => {
    const no = defaultParams('normal');
    const io = defaultParams('inverted');
    const L = 1300, E = 2.5;
    const nu = probabilities3(no, L, E, { matter: 2.8 })[1]![0]!;
    const nuVac = probabilities3(no, L, E)[1]![0]!;
    const anu = probabilities3(no, L, E, { matter: 2.8, anti: true })[1]![0]!;
    const anuVac = probabilities3(no, L, E, { anti: true })[1]![0]!;
    expect(nu / nuVac).toBeGreaterThan(anu / anuVac);
    const nuIo = probabilities3(io, L, E, { matter: 2.8 })[1]![0]!;
    const nuIoVac = probabilities3(io, L, E)[1]![0]!;
    expect(nuIo / nuIoVac).toBeLessThan(nu / nuVac);
  });
  test('layers compose: two half-length layers equal one layer', () => {
    const p = defaultParams();
    const one = probabilities3(p, 1000, 3, { matter: 3 });
    const two = probabilities3(p, 1000, 3, { matter: [{ density: 3, length: 400 }, { density: 3, length: 600 }] });
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) expect(two[a]![b]!).toBeCloseTo(one[a]![b]!, 9);
  });
});

describe('solar neutrinos (adiabatic)', () => {
  const th = Math.asin(Math.sqrt(0.307));
  test('low energy: the vacuum average 1 − ½ sin²2θ12 ≈ 0.57; high energy: sin²θ12 ≈ 0.31', () => {
    const low = solarSurvival(th, 7.49e-5, 1e-6, 150);
    expect(low).toBeCloseTo(1 - 0.5 * Math.sin(2 * th) ** 2, 3);
    const high = solarSurvival(th, 7.49e-5, 15, 150);
    expect(high).toBeGreaterThan(0.30);
    expect(high).toBeLessThan(0.36);
  });
});

describe('masses', () => {
  const p = defaultParams();
  test('the sum of the masses has a floor: about 0.059 eV (normal) and 0.099 eV (inverted, 0.0988 here)', () => {
    expect(sumOfMasses(neutrinoMasses(0, p.dm21, 2.513e-3, 'normal'))).toBeCloseTo(0.0587, 3);
    expect(sumOfMasses(neutrinoMasses(0, p.dm21, 2.48e-3, 'inverted'))).toBeCloseTo(0.0988, 3);
  });
  test('mass differences come back out', () => {
    const m = neutrinoMasses(0.03, 7.49e-5, 2.5e-3, 'normal');
    expect(m[1] ** 2 - m[0] ** 2).toBeCloseTo(7.49e-5, 12);
    expect(m[2] ** 2 - m[0] ** 2).toBeCloseTo(2.5e-3, 12);
    const i = neutrinoMasses(0.03, 7.49e-5, 2.5e-3, 'inverted');
    expect(i[1] ** 2 - i[0] ** 2).toBeCloseTo(7.49e-5, 12);
    expect(i[1] ** 2 - i[2] ** 2).toBeCloseTo(2.5e-3, 12);
  });
  test('for a large common mass m_β ≈ m', () => {
    const m = neutrinoMasses(1, p.dm21, 2.5e-3, 'normal');
    expect(betaDecayMass(m, p)).toBeCloseTo(1, 3);
  });
  test('m_ββ: the normal ordering allows a cancellation to zero; the inverted one does not', () => {
    // scan the lightest mass for the smallest possible m_ββ
    let minNo = Infinity, minIo = Infinity;
    for (let k = 0; k < 400; k++) {
      const ml = 1e-4 * Math.pow(1e3, k / 399); // 1e-4 … 0.1 eV
      minNo = Math.min(minNo, majoranaRange(neutrinoMasses(ml, p.dm21, 2.513e-3, 'normal'), p, 48).min);
      minIo = Math.min(minIo, majoranaRange(neutrinoMasses(ml, p.dm21, 2.48e-3, 'inverted'), p, 48).min);
    }
    expect(minNo).toBeLessThan(2e-4); // a cancellation exists (to the resolution of the scan)
    expect(minIo).toBeGreaterThan(0.01); // the inverted ordering has a floor of about 0.015 eV
    expect(minIo).toBeLessThan(0.025);
  });
  test('the ordering is a parameter: paramsFromSin2 gives Δm²31 < 0 for the inverted ordering', () => {
    expect(paramsFromSin2(0.3, 0.02, 0.5, 0, 7.5e-5, 2.5e-3, 'inverted').dm31).toBeLessThan(0);
  });
});
