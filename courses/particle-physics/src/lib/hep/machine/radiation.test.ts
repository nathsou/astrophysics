import { describe, expect, test } from 'vitest';
import { LEP, criticalEnergyEV, electronLossKeV, electronToProtonLossRatio, energyForLossFraction, energyLossPerTurn, fractionalLoss, protonLossKeV, radiatedPowerW } from './radiation.ts';
import { LHC } from './fields.ts';

describe('synchrotron radiation', () => {
  test('LEP at 104.5 GeV loses about 3.5 GeV per turn (3.49 with ρ = 3026 m; 3.41 with ρ = 3096 m)', () => {
    const loss = electronLossKeV(LEP.maxBeamEnergy_GeV, LEP.bendingRadius_m) / 1e6; // GeV
    expect(loss).toBeCloseTo(3.486, 2);
    expect(Math.abs(loss / 3.4 - 1)).toBeLessThan(0.05);
    expect(energyLossPerTurn(104.5, 3026)).toBeCloseTo(loss, 3);
    expect(fractionalLoss(104.5, 3026)).toBeCloseTo(0.0334, 3);
    expect(electronLossKeV(104.5, 3096) / 1e6).toBeCloseTo(3.41, 2);
  });
  test('LHC protons: 6.7 keV per turn at 7 TeV, 5.9 keV at 6.8 TeV', () => {
    expect(protonLossKeV(7000, LHC.bendingRadius_m)).toBeCloseTo(6.66, 1);
    expect(protonLossKeV(6800, LHC.bendingRadius_m)).toBeCloseTo(5.93, 1);
  });
  test('electrons radiate (m_p/m_e)⁴ = 1.1 × 10¹³ times more than protons of the same energy and radius', () => {
    expect(electronToProtonLossRatio() / 1.1367e13).toBeCloseTo(1, 3);
    // the practical electron formula (88.46) and the mass scaling differ by under 0.1% from the exact ratio
    expect(electronLossKeV(1000, 1000) / protonLossKeV(1000, 1000) / electronToProtonLossRatio()).toBeCloseTo(1, 2);
  });
  test('critical photon energy: LHC 7 TeV protons ≈ 44 eV, LEP ≈ 0.84 MeV', () => {
    expect(criticalEnergyEV(7000, LHC.bendingRadius_m, 0.938272)).toBeCloseTo(43.8, 0);
    expect(criticalEnergyEV(104.5, 3026) / 1e6).toBeCloseTo(0.8366, 2);
  });
  test('power: 3.49 GeV per turn at 3 mA is about 10 MW; energy at which an LEP-sized ring loses 10% per turn', () => {
    expect(radiatedPowerW(3.486, 3e-3) / 1e6).toBeCloseTo(10.5, 0);
    expect(energyForLossFraction(0.1, 3026)).toBeGreaterThan(150);
    expect(energyForLossFraction(0.1, 3026)).toBeLessThan(160);
  });
});
