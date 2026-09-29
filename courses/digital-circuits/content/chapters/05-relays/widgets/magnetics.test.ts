import { describe, expect, test } from 'vitest';
import { EARTH_HORIZONTAL, IRON_SATURATION, MU0, compassDeflection, formatTesla, ironCoreField, liftableMass, pullForce, solenoidField, wireField } from './magnetics';

describe('magnetics', () => {
  test('a straight wire: 1 A at 1 cm gives 20 µT, as strong as the horizontal Earth field', () => {
    expect(wireField(1, 0.01)).toBeCloseTo(20e-6, 9);
    expect(compassDeflection(wireField(1, 0.01))).toBeCloseTo(45, 5);
  });
  test('the field falls as 1/r and grows with the current', () => {
    expect(wireField(1, 0.02)).toBeCloseTo(wireField(1, 0.01) / 2, 12);
    expect(wireField(3, 0.01)).toBeCloseTo(3 * wireField(1, 0.01), 12);
  });
  test('no current, no deflection; a huge current points the needle at the wire’s field (90°)', () => {
    expect(compassDeflection(0)).toBe(0);
    expect(compassDeflection(1)).toBeGreaterThan(89.99);
  });
  test('a solenoid: B = μ0·N·I / l', () => {
    expect(solenoidField(100, 0.5, 0.05)).toBeCloseTo((MU0 * 100 * 0.5) / 0.05, 12);
    expect(solenoidField(100, 0.5, 0.05)).toBeCloseTo(1.2566e-3, 6);
  });
  test('coiling the wire multiplies the field by the number of turns', () => {
    expect(solenoidField(50, 1, 0.05) / solenoidField(1, 1, 0.05)).toBeCloseTo(50, 9);
  });
  test('an iron core multiplies a weak field by its gain and saturates a strong one', () => {
    const weak = ironCoreField(10, 0.01, 0.05);
    expect(weak / solenoidField(10, 0.01, 0.05)).toBeGreaterThan(490);
    expect(weak / solenoidField(10, 0.01, 0.05)).toBeLessThanOrEqual(500);
    const strong = ironCoreField(500, 5, 0.05);
    expect(strong).toBeLessThanOrEqual(IRON_SATURATION);
    expect(strong).toBeGreaterThan(0.99 * IRON_SATURATION);
  });
  test('the pull on an iron plate grows as the square of the field: a core turns micronewtons into newtons', () => {
    const air = pullForce(solenoidField(100, 0.5, 0.05), 1e-4);
    const iron = pullForce(ironCoreField(100, 0.5, 0.05), 1e-4);
    expect(air).toBeLessThan(1e-3);
    expect(iron).toBeGreaterThan(5);
    expect(liftableMass(iron)).toBeGreaterThan(0.5);
  });
  test('formatting', () => {
    expect(formatTesla(EARTH_HORIZONTAL)).toBe('20 µT');
    expect(formatTesla(1.3e-3)).toBe('1.3 mT');
    expect(formatTesla(0.63)).toBe('0.63 T');
  });
});
