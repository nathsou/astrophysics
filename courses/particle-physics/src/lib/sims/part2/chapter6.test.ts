import { describe, expect, test } from 'vitest';
import { criticalEnergy, materials, meanEnergyLoss, moliereRadius, mostProbableLoss, multipleScatteringAngle, muonCriticalEnergy, muonRange, heitlerShower } from '../../hep/detector/index.ts';
import { emContainmentDepth, hadronContainmentDepth, minimumIonisation } from './matter.ts';

/** The numbers quoted in the prose of Chapter 6, computed from the library. */
describe('Chapter 6: numbers in the text', () => {
  const beta = (p: number, m: number) => p / Math.sqrt(p * p + m * m);
  test('Highland: 12.9 mrad for a 1 GeV/c muon through 5 mm of lead, 0.6 mrad through 300 μm of silicon', () => {
    const pb = materials.Pb!;
    expect(multipleScatteringAngle(1, beta(1, 0.10566), 0.5 / pb.X0cm) * 1000).toBeCloseTo(12.9, 1);
    const si = materials.Si!;
    expect(multipleScatteringAngle(1, beta(1, 0.10566), 0.03 / si.X0cm) * 1000).toBeGreaterThan(0.55);
    expect(multipleScatteringAngle(1, beta(1, 0.10566), 0.03 / si.X0cm) * 1000).toBeLessThan(0.65);
  });
  test('the approximate radiation-length formula gives 6.3 g/cm² for lead and 14.1 for iron', () => {
    const f = (A: number, Z: number) => (716 * A) / (Z * (Z + 1) * Math.log(287 / Math.sqrt(Z)));
    expect(f(207.2, 82)).toBeCloseTo(6.31, 1);
    expect(f(55.845, 26)).toBeCloseTo(14.13, 1);
    expect(Math.abs(f(207.2, 82) / materials.Pb!.X0 - 1)).toBeLessThan(0.02);
    expect(Math.abs(f(55.845, 26) / materials.Fe!.X0 - 1)).toBeLessThan(0.03);
  });
  test('silicon, 300 μm: mean loss 116 keV, most probable 78 keV (two thirds of the mean)', () => {
    const si = materials.Si!;
    const x = 0.03 * si.density;
    const mean = meanEnergyLoss(si, x, 3.5 * 0.10566, 0.10566) * 1e6; // keV
    const mpv = mostProbableLoss(si, x, 3.5) * 1e3; // keV
    expect(mean).toBeGreaterThan(115);
    expect(mean).toBeLessThan(117);
    expect(mpv).toBeGreaterThan(77);
    expect(mpv).toBeLessThan(80);
    expect(mpv / mean).toBeGreaterThan(0.62);
    expect(mpv / mean).toBeLessThan(0.72);
    expect(1.664 * x * 1000).toBeCloseTo(116, 0);
  });
  test('lead: E_c 7.43 MeV, 13,459 particles for 100 GeV, shower maximum 5.3 cm (Heitler) or 5.1 cm (profile), 95 % at 19.7 X0 = 11 cm; R_M = 1.6 cm', () => {
    const Ec = criticalEnergy('Pb');
    expect(100 / Ec).toBeCloseTo(13459, -1);
    expect(Math.log(100 / Ec) * materials.Pb!.X0cm).toBeCloseTo(5.3, 1);
    expect((Math.log(100 / Ec) - 0.5) * materials.Pb!.X0cm).toBeCloseTo(5.06, 1);
    const d = emContainmentDepth(100, Ec, 0.95);
    expect(d).toBeCloseTo(19.7, 0);
    expect(d * materials.Pb!.X0cm).toBeCloseTo(11.0, 0);
    expect(emContainmentDepth(10, Ec, 0.95)).toBeCloseTo(16.5, 0);
    expect(moliereRadius('Pb')).toBeCloseTo(1.6, 1);
    expect(moliereRadius('H2O')).toBeCloseTo(9.8, 1);
  });
  test('hadronic showers: 95 % of 100 GeV within 5.7 λ; the ECAL (25 X0 of lead tungstate) is about one λ thick; the HCAL 1.7 m', () => {
    expect(hadronContainmentDepth(100, 0.95)).toBeCloseTo(5.7, 0);
    const w = materials.PbWO4!;
    expect((25 * w.X0cm) / w.lambdaIcm).toBeCloseTo(1.0, 1);
    expect((10 * materials.Fe!.lambdaIcm) / 100).toBeCloseTo(1.68, 2);
  });
  test('muons in iron: range 6.9 m at 10 GeV/c and 54 m at 100 GeV/c, critical energy a few hundred GeV; a muon loses 127 MeV in 10 cm of lead', () => {
    expect(muonRange('Fe', 10) / 100).toBeGreaterThan(6.7);
    expect(muonRange('Fe', 10) / 100).toBeLessThan(7.1);
    expect(muonRange('Fe', 100) / 100).toBeGreaterThan(52);
    expect(muonRange('Fe', 100) / 100).toBeLessThan(56);
    expect(muonCriticalEnergy('Fe')).toBeGreaterThan(300);
    expect(muonCriticalEnergy('Fe')).toBeLessThan(380);
    expect(minimumIonisation('Pb').value * 11.35 * 10).toBeCloseTo(127, -1);
  });
  test('Cherenkov light in water (n = 1.33): threshold β = 0.75, 41° at β = 1, muon above 120 MeV/c, electron above 0.26 MeV', () => {
    const n = 1.33;
    expect(1 / n).toBeCloseTo(0.752, 2);
    expect((Math.acos(1 / n) * 180) / Math.PI).toBeCloseTo(41.2, 1);
    const bg = 1 / n / Math.sqrt(1 - 1 / n ** 2);
    expect(0.10566 * bg * 1000).toBeCloseTo(120, 0);
    expect(0.511 * (1 / Math.sqrt(1 - 1 / n ** 2) - 1)).toBeCloseTo(0.264, 2);
  });
  test('a 10 GeV neutrino in iron: mean free path 3 × 10⁷ km', () => {
    const nucleons = materials.Fe!.density * 6.022e23;
    const mfpCm = 1 / (nucleons * 0.7e-38 * 10);
    expect(mfpCm / 1e5 / 1e7).toBeCloseTo(3.0, 1);
    expect(mfpCm / 1e5 / 1.27e4).toBeGreaterThan(2300);
    expect(mfpCm / 1e5 / 1.27e4).toBeLessThan(2500);
    expect(300 / mfpCm).toBeCloseTo(1e-10, 11);
  });
});
