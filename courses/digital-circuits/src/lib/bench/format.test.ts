import { describe, expect, test } from 'vitest';
import { formatReadout, formatSI, formatSpeed, logicChar, mainValue } from './format';

const s = (x: string) => x.replace(/ /g, ' ').replace(/−/g, '-');

describe('formatSI', () => {
  test('uses SI prefixes and trims zeros', () => {
    expect(s(formatSI(4700, 'Ω'))).toBe('4.7 kΩ');
    expect(s(formatSI(1e-7, 'F'))).toBe('100 nF');
    expect(s(formatSI(9, 'V'))).toBe('9 V');
    expect(s(formatSI(0.0012, 'A'))).toBe('1.2 mA');
    expect(s(formatSI(2.5e-6, 's'))).toBe('2.5 µs');
    expect(s(formatSI(1e6, 'Ω'))).toBe('1 MΩ');
    expect(s(formatSI(0, 'V'))).toBe('0 V');
    expect(s(formatSI(0.25, 'W'))).toBe('250 mW');
  });
  test('rounding that carries moves to the next prefix', () => {
    expect(s(formatSI(999.96, 'Ω'))).toBe('1 kΩ');
    expect(s(formatSI(0.99999, 'V'))).toBe('1 V');
  });
  test('negative values use a minus sign; NaN is a dash', () => {
    expect(formatSI(-2.5, 'V')).toBe('−2.5 V');
    expect(formatSI(NaN, 'V')).toBe('–');
  });
  test('numbers without a unit', () => {
    expect(s(formatSI(1500))).toBe('1.5 k');
    expect(s(formatSI(12))).toBe('12');
  });
});

describe('formatReadout', () => {
  test('fixed significant digits for steady readouts', () => {
    expect(s(formatReadout(3.2, 'V'))).toBe('3.20 V');
    expect(s(formatReadout(0.0123, 'A'))).toBe('12.3 mA');
    expect(s(formatReadout(-0.5, 'V'))).toBe('-500 mV');
    expect(s(formatReadout(0, 'V'))).toBe('0.00 V');
  });
});

describe('labels', () => {
  test('main values of parts', () => {
    expect(s(mainValue('resistor', { resistance: 4700 })!)).toBe('4.7 kΩ');
    expect(s(mainValue('capacitor', { capacitance: 1e-7 })!)).toBe('100 nF');
    expect(s(mainValue('battery', { voltage: 9 })!)).toBe('9 V');
    expect(s(mainValue('lamp', { ratedVoltage: 6, ratedPower: 0.3 })!)).toBe('6 V 300 mW');
    expect(mainValue('nand', {})).toBeUndefined();
  });
  test('logic characters and speeds', () => {
    expect([0, 1, 2, 3].map(logicChar).join('')).toBe('01XZ');
    expect(s(formatSpeed(1e-6))).toBe('1 µs/s');
  });
});
