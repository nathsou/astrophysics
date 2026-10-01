/**
 * The numbers quoted in the prose of Chapters 9–13, computed from the library, so that the text cannot drift from the code.
 * Each test names the chapter and the sentence it backs.
 */
import { describe, expect, test } from 'vitest';
import { particle } from '../../hep/particles/index.ts';
import { csdaRange, MATERIALS, ionisationLoss, mipLoss } from '../../hep/chamber/material.ts';
import { simulateShower, CTAU_MU_M, CTAU_PI_M } from './airshower.ts';
import { antiprotonThreshold, thresholdKineticFixedTarget } from './threshold.ts';
import { decupletSpacing, gellMannOkuboBaryons, gellMannOkuboMesons, omegaStrongDecayThreshold, unitarityLimit, GEV2_TO_MB, DECUPLET_MASSES } from '../../hep/su3/index.ts';
import { twoBodyMomentum } from '../../hep/kinematics/index.ts';

describe('Chapter 9', () => {
  test('radii and momenta of the Anderson track: R = p / (0.2998 B)', () => {
    expect(0.063 / (0.29979 * 1.5)).toBeCloseTo(0.140, 3); // 14 cm below the plate
    expect(0.023 / (0.29979 * 1.5)).toBeCloseTo(0.0511, 3); // 5 cm above
  });
  test('a proton with the observed curvature would ionise far too much and stop in millimetres', () => {
    const mp = particle(2212).mass * 1000;
    const sp = { mass: mp, charge: 1 };
    const mip = mipLoss(MATERIALS.air, true);
    const T63 = Math.hypot(63, mp) - mp, T23 = Math.hypot(23, mp) - mp;
    expect(T63).toBeCloseTo(2.11, 2);
    expect(T23).toBeCloseTo(0.282, 2);
    expect(ionisationLoss(sp, 63, MATERIALS.air, MATERIALS.air.deltaCut) / mip).toBeGreaterThan(100);
    expect(ionisationLoss(sp, 23, MATERIALS.air, MATERIALS.air.deltaCut) / mip).toBeGreaterThan(350);
    const range = csdaRange(sp, T23, MATERIALS.air);
    expect(range).toBeGreaterThan(3);
    expect(range).toBeLessThan(6); // "about 4 mm"
  });
  test('electron ionisation at those momenta is only a little above minimum', () => {
    const me = particle(11).mass * 1000;
    const mip = mipLoss(MATERIALS.air, true);
    for (const p of [63, 23]) {
      const r = ionisationLoss({ mass: me, charge: 1 }, p, MATERIALS.air, MATERIALS.air.deltaCut) / mip;
      expect(r).toBeGreaterThan(1);
      expect(r).toBeLessThan(2);
    }
  });
  test('thresholds', () => {
    const t = antiprotonThreshold();
    expect(t.fixedTargetKinetic).toBeCloseTo(5.6296, 3);
    expect(4 * t.mp).toBeCloseTo(3.7531, 3);
    expect(t.colliderKineticTotal).toBeCloseTo(1.8765, 3);
  });
  test('antiproton and pion speeds at 1.2 GeV/c', () => {
    expect(1.2 / Math.hypot(1.2, particle(2212).mass)).toBeCloseTo(0.788, 2);
    expect(1.2 / Math.hypot(1.2, particle(211).mass)).toBeCloseTo(0.993, 3);
  });
  test('PET: fluorine-18 in the first hour', () => {
    const lambda = Math.LN2 / (110 * 60);
    const N = 3e8 / lambda;
    expect(N / 1e12).toBeCloseTo(2.86, 1);
    const decays = N * (1 - 2 ** (-60 / 110));
    expect(decays * 0.97).toBeGreaterThan(8.5e11);
    expect(decays * 0.97).toBeLessThan(8.9e11);
    expect(decays * 0.97 * 1.022e6 * 1.602e-19).toBeCloseTo(0.14, 1); // joules
  });
});

describe('Chapter 10', () => {
  test('decay lengths and masses', () => {
    expect(CTAU_MU_M).toBeCloseTo(658.6, 0);
    expect(CTAU_PI_M).toBeCloseTo(7.80, 2);
    expect(particle(13).mass / particle(11).mass).toBeCloseTo(206.77, 1);
    expect(particle(211).mass / particle(11).mass).toBeCloseTo(273.1, 0);
    expect(particle(111).lifetime).toBeCloseTo(8.43e-17, 19);
  });
  test('Yukawa: ħc/R', () => {
    expect(197.327 / 2).toBeCloseTo(98.7, 1);
    expect(197.327 / 2 / (particle(11).mass * 1000)).toBeCloseTo(193, 0);
    expect(197.327 / 1.4).toBeCloseTo(140.9, 1);
    expect(197.327 / 1.4 / (particle(11).mass * 1000)).toBeCloseTo(276, 0);
    expect(197.327 / (particle(211).mass * 1000)).toBeCloseTo(1.414, 3);
  });
  test('π⁺ → μ⁺ ν at rest', () => {
    const mpi = particle(211).mass, mmu = particle(13).mass;
    const E = (mpi * mpi + mmu * mmu) / (2 * mpi);
    expect(E * 1000).toBeCloseTo(109.78, 1);
    expect((E - mmu) * 1000).toBeCloseTo(4.12, 2);
  });
  test('muon survival over 15 km', () => {
    const m = particle(13).mass;
    const bg = Math.sqrt((3 / m) ** 2 - 1);
    expect(bg).toBeCloseTo(28.4, 1);
    expect(bg * CTAU_MU_M / 1000).toBeCloseTo(18.7, 1);
    expect(Math.exp(-15000 / (bg * CTAU_MU_M))).toBeCloseTo(0.448, 3);
    expect(Math.exp(-15000 / CTAU_MU_M)).toBeCloseTo(1.3e-10, 11);
    expect(15000 / bg).toBeCloseTo(528.6, 0);
    const bgHalf = 15000 / (CTAU_MU_M * Math.LN2);
    expect(m * Math.sqrt(1 + bgHalf * bgHalf)).toBeCloseTo(3.47, 2);
  });
  test('the sky integral for a horizontal plate', () => {
    const I0 = 70;
    expect(((Math.PI / 2) * I0 * 60) / 1e4).toBeCloseTo(0.66, 2);
    expect((Math.PI / 2) * I0).toBeCloseTo(110, 0);
  });
  test('the default toy shower (10^15 eV, vertical, seed 4)', () => {
    const a = simulateShower({ E0: 1e6, seed: 4 });
    expect(a.firstHeightKm).toBeGreaterThan(20.5);
    expect(a.firstHeightKm).toBeLessThan(22);
    expect(a.pions).toBeGreaterThan(28000);
    expect(a.pions).toBeLessThan(30000);
    expect(a.muonsMade).toBeGreaterThan(20500);
    expect(a.muonsMade).toBeLessThan(21800);
    expect(a.muonsGround / a.muonsMade).toBeGreaterThan(0.54);
    expect(a.muonsGround / a.muonsMade).toBeLessThan(0.56);
    const s = [...a.groundEnergies].sort((x, y) => x - y);
    expect(s[Math.floor(s.length / 2)]).toBeGreaterThan(3.4);
    expect(s[Math.floor(s.length / 2)]).toBeLessThan(3.8);
    expect(a.expectedNoDilation).toBeGreaterThan(1300);
    expect(a.expectedNoDilation).toBeLessThan(1420);
    expect(a.expectedNoDilation / a.muonsMade).toBeGreaterThan(0.06);
    expect(a.expectedNoDilation / a.muonsMade).toBeLessThan(0.07);
    let tot = 0, low = 0;
    a.muonBirthKm.forEach((h, k) => { tot += a.muonPNoDilation[k]!; if (h < 3) low += a.muonPNoDilation[k]!; });
    expect(low / tot).toBeGreaterThan(0.98);
    expect(a.muonsGround / a.expectedNoDilation).toBeGreaterThan(8.3);
    expect(a.muonsGround / a.expectedNoDilation).toBeLessThan(8.8);
    // scaling and zenith dependence
    const b = simulateShower({ E0: 1e7, seed: 4 });
    expect(b.muonsMade / a.muonsMade).toBeGreaterThan(8.0);
    expect(b.muonsMade / a.muonsMade).toBeLessThan(8.6);
    expect(Math.log10(b.muonsMade / a.muonsMade)).toBeCloseTo(0.92, 2);
    const z = simulateShower({ E0: 1e6, seed: 4, zenithDeg: 60 });
    expect(z.muonsGround / z.muonsMade).toBeGreaterThan(0.30);
    expect(z.muonsGround / z.muonsMade).toBeLessThan(0.34);
  });
});

describe('Chapter 11', () => {
  test('the Λ lives about 4.7 × 10¹³ times longer than the Δ', () => {
    const tauDelta = 6.582e-25 / particle(2224).width;
    expect(tauDelta).toBeCloseTo(5.63e-24, 26);
    expect(particle(3122).lifetime / tauDelta).toBeCloseTo(4.7e13, -12);
  });
  test('the energy of neutron decay is 0.782 MeV', () => {
    const q = particle(2112).mass - particle(2212).mass - particle(11).mass;
    expect(q * 1000).toBeCloseTo(0.782, 3);
  });
});

describe('Chapter 12', () => {
  test('nucleon and pion mass differences', () => {
    expect((particle(2112).mass - particle(2212).mass) * 1000).toBeCloseTo(1.293, 3);
    expect((particle(2112).mass / particle(2212).mass - 1) * 100).toBeCloseTo(0.138, 2);
    expect(particle(211).mass * 1000).toBeCloseTo(139.57, 2);
    expect(particle(111).mass * 1000).toBeCloseTo(134.98, 2);
  });
  test('the Δ: lifetime, flight distance, pion energy at the peak, unitarity limit', () => {
    const G = particle(2224).width;
    expect(0.1973269804 / G).toBeCloseTo(1.69, 2);
    const mp = particle(2212).mass, mpi = particle(211).mass, M = 1.232;
    expect(((M * M - mp * mp - mpi * mpi) / (2 * mp)) * 1000).toBeCloseTo(329.3, 0);
    expect(((M * M - mp * mp - mpi * mpi) / (2 * mp) - mpi) * 1000).toBeCloseTo(189.7, 0);
    const k = twoBodyMomentum(M, mpi, mp);
    expect(k * 1000).toBeCloseTo(227, 0);
    expect(unitarityLimit(k, 3, 0, 1) * GEV2_TO_MB).toBeCloseTo(190, -1);
  });
  test('Gell-Mann–Okubo', () => {
    const b = gellMannOkuboBaryons();
    expect([b.N * 1000, b.Xi * 1000, b.Lambda * 1000, b.Sigma * 1000].map((x) => Math.round(x * 10) / 10)).toEqual([938.9, 1318.3, 1115.7, 1193.2]);
    expect(b.lhs * 1000).toBeCloseTo(4514.4, 0);
    expect(b.rhs * 1000).toBeCloseTo(4540.2, 0);
    expect(Math.abs(b.relativeDifference) * 100).toBeCloseTo(0.57, 1);
    expect(Math.abs(gellMannOkuboMesons().relativeDifference) * 100).toBeCloseTo(6.4, 0);
  });
  test('the decuplet spacing and the Ω⁻ prediction', () => {
    const sp = decupletSpacing();
    expect(sp.step1 * 1000).toBeCloseTo(151.7, 0);
    expect(sp.step2 * 1000).toBeCloseTo(148.1, 0);
    expect(sp.omegaFromLastSpacing * 1000).toBeCloseTo(1679.9, 0);
    expect(sp.omegaFromMeanSpacing * 1000).toBeCloseTo(1681.8, 0);
    const old = decupletSpacing({ delta: 1.232, sigmaStar: 1.385, xiStar: 1.530 });
    expect((old.step1 * 1000)).toBeCloseTo(153, 0);
    expect((old.step2 * 1000)).toBeCloseTo(145, 0);
    expect(old.omegaFromMeanSpacing * 1000).toBeCloseTo(1679, 0);
    expect(old.omegaFromLastSpacing * 1000).toBeCloseTo(1675, 0);
    expect(Math.abs(DECUPLET_MASSES[-3].mass - sp.omegaFromMeanSpacing) / DECUPLET_MASSES[-3].mass).toBeLessThan(0.006);
  });
  test('the Ω⁻ cannot decay strongly, lives 82 ps, and is made by a K⁻ of about 3.1 GeV/c', () => {
    const t = omegaStrongDecayThreshold();
    expect(t.threshold * 1000).toBeCloseTo(1808.5, 0);
    expect(t.open).toBe(false);
    expect(particle(3334).lifetime * 1e12).toBeCloseTo(82.1, 0);
    expect(particle(3334).lifetime * 299792458 * 100).toBeCloseTo(2.46, 2); // cτ in cm
    const finals = particle(3334).mass + particle(321).mass + particle(311).mass;
    expect(finals).toBeCloseTo(2.6637, 3);
    const T = thresholdKineticFixedTarget(particle(-321).mass, particle(2212).mass, finals);
    const E = T + particle(-321).mass;
    expect(Math.sqrt(E * E - particle(-321).mass ** 2)).toBeCloseTo(3.14, 1);
  });
});
