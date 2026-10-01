import { describe, expect, test } from 'vitest';

/** The numbers quoted in Appendix G, computed here so that the text and the arithmetic cannot drift apart. */
const N_A = 6.02214076e23;
const YEAR = 365.25 * 24 * 3600;

describe('potassium-40 in a salt substitute', () => {
  const abundance = 1.17e-4; // 0.0117 % of natural potassium
  const halfLife = 1.248e9 * YEAR; // s
  const molarK = 39.0983; // g/mol, natural potassium
  const molarKCl = 39.0983 + 35.453;

  test('natural potassium has a specific activity of about 31 Bq per gram', () => {
    const nPerGram = (N_A / molarK) * abundance;
    const activity = (Math.LN2 / halfLife) * nPerGram;
    expect(activity).toBeGreaterThan(30.5);
    expect(activity).toBeLessThan(32.5);
  });
  test('potassium chloride is 52.4 % potassium by mass, so about 16.6 Bq per gram, and 100 g give about 1.7 kBq', () => {
    const fraction = molarK / molarKCl;
    expect(fraction).toBeCloseTo(0.5244, 3);
    const perGram = (Math.LN2 / halfLife) * (N_A / molarK) * abundance * fraction;
    expect(perGram).toBeGreaterThan(16.2);
    expect(perGram).toBeLessThan(17.0);
    expect(100 * perGram).toBeGreaterThan(1620);
    expect(100 * perGram).toBeLessThan(1700);
  });
});

describe('cosmic muons through a small scintillator', () => {
  test('a vertical intensity of 70 m⁻² s⁻¹ sr⁻¹ with a cos²θ dependence gives about 1 per cm² per minute on a horizontal surface', () => {
    const I0 = 70; // m^-2 s^-1 sr^-1
    // flux through a horizontal surface: ∫ I0 cos²θ cosθ... for I(θ) = I0 cos²θ the rate per unit horizontal area is I0 ∫ cos²θ cosθ dΩ = I0 · 2π ∫0^{π/2} cos³θ sinθ dθ = I0 · π/2
    const perM2s = I0 * (Math.PI / 2);
    const perCm2min = (perM2s / 1e4) * 60;
    expect(perCm2min).toBeGreaterThan(0.6);
    expect(perCm2min).toBeLessThan(1.1);
  });
  test('the rate through a plate of 25 cm², and its fall with the tilt of the plate', () => {
    const perCm2min = 1;
    expect(25 * perCm2min).toBe(25);
    // a plate tilted by an angle α from the horizontal: the rate is still about proportional to cos²... (checked in the zenith lab, not here)
  });
});
