import { describe, expect, test } from 'vitest';
import { BANDS, HC, MATERIALS, colourBand, energyEv, nearestMaterial, spectrumPosition, spectrumRgb, spectrumStops, wavelengthNm } from './led';
import { LED_COLOURS } from '$lib/sim/analog';

describe('photon energy and wavelength', () => {
  test('E = hc / λ: 1.9 eV is 650 nm, and back', () => {
    expect(wavelengthNm(1.9)).toBeCloseTo(652.5, 0);
    expect(energyEv(650)).toBeCloseTo(1.907, 2);
    expect(energyEv(wavelengthNm(2.7))).toBeCloseTo(2.7, 9);
    expect(HC).toBeCloseTo(1239.84, 2);
  });

  test('silicon’s 1.12 eV gap is infrared (1100 nm): silicon cannot make a visible LED', () => {
    expect(wavelengthNm(1.12)).toBeGreaterThan(1050);
    expect(colourBand(1.12).name).toBe('infrared');
  });
});

describe('colours', () => {
  test('the four real materials give the colours the text claims', () => {
    const name = (f: string) => colourBand(MATERIALS.find((m) => m.formula === f)!.gap).name;
    expect(name('GaAs')).toBe('infrared');
    expect(name('GaAsP')).toBe('red');
    expect(name('GaP:N')).toBe('green');
    expect(name('InGaN')).toBe('blue');
  });

  test('the bands run from red at low energy to blue at high, with the right LED type of the engine', () => {
    expect(colourBand(1.3).led).toBe('infrared');
    expect(colourBand(1.9).led).toBe('red');
    expect(colourBand(2.05).led).toBe('amber');
    expect(colourBand(2.4).led).toBe('green');
    expect(colourBand(2.8).led).toBe('blue');
    expect(colourBand(3.2).led).toBe('blue');
    // Every LED type named by a band exists in the engine.
    for (const b of BANDS) expect(LED_COLOURS[b.led], b.led).toBeDefined();
  });

  test('forward voltages of the engine’s LEDs follow the bandgap order (blue > green > red > infrared)', () => {
    const vf = (c: string) => LED_COLOURS[c]!.vf;
    expect(vf('infrared')).toBeLessThan(vf('red'));
    expect(vf('red')).toBeLessThan(vf('green'));
    expect(vf('green')).toBeLessThan(vf('blue'));
    // Each is within about 0.5 V of its photon energy (Vf ≈ E/q plus a little).
    expect(Math.abs(vf('red') - energyEv(650))).toBeLessThan(0.2);
    expect(Math.abs(vf('blue') - energyEv(465))).toBeLessThan(0.5);
  });

  test('the spectrum has no colour outside the visible range and the right hues inside', () => {
    expect(spectrumRgb(300)).toBeNull();
    expect(spectrumRgb(850)).toBeNull();
    const [r1, g1, b1] = spectrumRgb(650)!;
    expect(r1).toBeGreaterThan(200);
    expect(g1).toBeLessThan(60);
    expect(b1).toBe(0);
    const [r2, g2, b2] = spectrumRgb(530)!;
    expect(g2).toBeGreaterThan(200);
    expect(r2).toBeLessThan(g2);
    expect(b2).toBe(0);
    const [r3, , b3] = spectrumRgb(460)!;
    expect(b3).toBeGreaterThan(200);
    expect(r3).toBe(0);
  });

  test('the nearest material and the spectrum bar', () => {
    expect(nearestMaterial(1.5).formula).toBe('GaAs');
    expect(nearestMaterial(2.6).formula).toBe('InGaN');
    expect(spectrumPosition(350)).toBe(0);
    expect(spectrumPosition(900)).toBe(1);
    expect(spectrumStops()).toContain('linear-gradient');
  });
});
