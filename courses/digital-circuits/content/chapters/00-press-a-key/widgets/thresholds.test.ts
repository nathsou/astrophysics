import { describe, expect, test } from 'vitest';
import { MESSAGE, NOISE, NOISE_MARGIN_HIGH, NOISE_MARGIN_LOW, V_IH, V_IL, errors, noiseMargin, read, received, wireVoltage } from './thresholds';

describe('the digital abstraction', () => {
  test('above 3.5 V is a 1, below 1.5 V a 0, and in between nothing is promised', () => {
    expect(read(5)).toBe(1);
    expect(read(V_IH)).toBe(1);
    expect(read(V_IL)).toBe(0);
    expect(read(0)).toBe(0);
    expect(read(2.5)).toBe('undefined');
    expect(read(3.49)).toBe('undefined');
  });
  test('the noise margin is about 1.4 V each way', () => {
    expect(NOISE_MARGIN_HIGH).toBeCloseTo(1.4, 9);
    expect(NOISE_MARGIN_LOW).toBeCloseTo(1.4, 9);
    expect(noiseMargin).toBeCloseTo(1.4, 9);
  });
  test('the message survives any noise below the margin, whatever the pattern', () => {
    for (const amp of [0, 0.5, 1, 1.39]) {
      expect(errors(amp)).toBe(0);
      expect(received(amp)).toEqual([...MESSAGE]);
    }
  });
  test('noise above the margin starts to corrupt bits', () => {
    expect(errors(1.6)).toBeGreaterThan(0);
    expect(errors(3)).toBeGreaterThan(errors(1.6) - 1);
  });
  test('the pattern reaches ±1, so the margin is exactly where the first error appears', () => {
    expect(Math.max(...NOISE.map(Math.abs))).toBe(1);
    expect(errors(1.41)).toBeGreaterThan(0);
  });
  test('the wire voltage stays between 0 and 5 V', () => {
    for (let i = 0; i < MESSAGE.length; i++) for (const amp of [0, 2, 10]) expect(wireVoltage(i, amp)).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < MESSAGE.length; i++) expect(wireVoltage(i, 10)).toBeLessThanOrEqual(5);
  });
});
