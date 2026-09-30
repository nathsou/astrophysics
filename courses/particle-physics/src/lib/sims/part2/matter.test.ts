import { describe, expect, test } from 'vitest';
import { csdaRange, electronLossPerX0, emContainmentDepth, emShowerMax, hadronContainmentDepth, hadronFraction, minimumIonisation, rangeCm, rossiCriticalEnergy, SPECIES, stoppingPower } from './matter.ts';
import { criticalEnergy, heitlerShower, materials } from '../../hep/detector/index.ts';

const sp = (id: string) => SPECIES.find((s) => s.id === id)!;

describe('energy loss by ionisation', () => {
  test('the minimum of the muon curve agrees with the PDG values (MeV cm²/g) within 2 %, at βγ between 3 and 4', () => {
    const pdg: Record<string, number> = { Si: 1.664, Fe: 1.451, Cu: 1.403, Pb: 1.122, H2O: 1.992 };
    for (const [m, v] of Object.entries(pdg)) {
      const r = minimumIonisation(m);
      expect(Math.abs(r.value / v - 1)).toBeLessThan(0.02);
      expect(r.betaGamma).toBeGreaterThan(2.9);
      expect(r.betaGamma).toBeLessThan(4.1);
    }
  });
  test('the relativistic rise is cut off by the density effect', () => {
    const withCorr = stoppingPower('Fe', 0.1057, 1000);
    const without = stoppingPower('Fe', 0.1057, 1000, false);
    expect(withCorr).toBeLessThan(without);
    const min = minimumIonisation('Fe').value;
    expect(withCorr / min).toBeGreaterThan(1.1);
    expect(withCorr / min).toBeLessThan(1.6);
  });
  test('below the minimum the loss rises as 1/β²: a slow proton loses much more', () => {
    const slow = stoppingPower('H2O', sp('p').mass, 0.3);
    expect(slow / minimumIonisation('H2O').value).toBeGreaterThan(5);
  });
  test('a 100 MeV proton has a range of 7.7 g/cm² in water (NIST PSTAR 7.718), and a 1 GeV/c muon 73 cm in iron', () => {
    expect(csdaRange('H2O', sp('p').mass, 0.1)).toBeGreaterThan(7.718 * 0.97);
    expect(csdaRange('H2O', sp('p').mass, 0.1)).toBeLessThan(7.718 * 1.03);
    const r = rangeCm('Fe', sp('mu'), 1);
    expect(r).toBeGreaterThan(70);
    expect(r).toBeLessThan(76);
  });
});

describe('the critical energy', () => {
  test('Rossi’s crossing from Bethe–Bloch reproduces the table value for every material, within 2 %', () => {
    for (const m of ['Si', 'Fe', 'Cu', 'Pb', 'H2O']) {
      const e = rossiCriticalEnergy(m);
      expect(Math.abs(e / materials[m]!.Ec - 1)).toBeLessThan(0.02);
    }
    expect(electronLossPerX0('Pb', 7.43).ionisation).toBeCloseTo(7.43, 0);
  });
});

describe('showers', () => {
  test('the depth of maximum: ln(E0/Ec) − 0.5 for an electron; Heitler’s toy lands within one splitting length above ln(E0/Ec)', () => {
    const Ec = criticalEnergy('Pb');
    for (const E0 of [1, 10, 100, 1000]) {
      const t = emShowerMax(E0, Ec);
      expect(t).toBeCloseTo(Math.log(E0 / Ec) - 0.5, 10);
      expect(heitlerShower(E0, Ec).tMaxX0).toBeGreaterThan(t);
      expect(heitlerShower(E0, Ec).tMaxX0 - Math.log(E0 / Ec)).toBeLessThan(Math.LN2);
    }
  });
  test('about 95 % of a 100 GeV electron shower in lead is inside 18–27 X0', () => {
    const d = emContainmentDepth(100, criticalEnergy('Pb'), 0.95);
    expect(d).toBeGreaterThan(18);
    expect(d).toBeLessThan(27);
    // the depth grows by a few X0 per factor of ten, not linearly with E
    expect(emContainmentDepth(1000, criticalEnergy('Pb'), 0.95) - d).toBeLessThan(5);
  });
  test('hadronic showers are contained in about 4–10 interaction lengths at 100 GeV', () => {
    const l = hadronContainmentDepth(100, 0.95);
    expect(l).toBeGreaterThan(4);
    expect(l).toBeLessThan(10);
    expect(hadronFraction(100, 0, 1000)).toBeCloseTo(1, 6);
  });
});
