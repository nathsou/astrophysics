import { describe, expect, test } from 'vitest';
import { convert, energyScale, equivalents } from './convert.ts';

describe('unit conversion', () => {
  test('1 GeV is 1.783e-27 kg', () => {
    expect(convert(1, 'GeV', 'kg')).toBeCloseTo(1.78266192e-27, 34);
  });
  test('1 eV is 11604.5 K', () => {
    expect(convert(1, 'eV', 'K')).toBeCloseTo(11604.5, 0);
  });
  test('ħc: 1 fm is 0.1973 GeV of energy scale', () => {
    expect(energyScale(1, 'fm')).toBeCloseTo(0.1973269804, 9);
  });
  test('1 GeV⁻¹ is 0.1973 fm and 6.582e-25 s', () => {
    expect(convert(1, 'inv-GeV-l', 'fm')).toBeCloseTo(0.1973269804, 9);
    expect(convert(1, 'inv-GeV-t', 's')).toBeCloseTo(6.582119569e-25, 33);
  });
  test('1 GeV⁻² is 0.3894 mb', () => {
    expect(convert(1, 'inv-GeV2', 'mb')).toBeCloseTo(0.3893793721, 9);
  });
  test('1 barn = 1e-24 cm² = 100 fm²', () => {
    expect(convert(1, 'barn', 'cm2')).toBeCloseTo(1e-24, 30);
  });
  test('Z width 2.4955 GeV is a lifetime of 2.64e-25 s', () => {
    expect(convert(1 / 2.4955, 'inv-GeV-t', 's')).toBeCloseTo(2.6376e-25, 29);
  });
  test('a 6.8 TeV proton carries 1.09 microjoules', () => {
    expect(convert(6.8, 'TeV', 'J')).toBeCloseTo(1.0895e-6, 9);
  });
  test('round trips', () => {
    for (const u of ['TeV', 'kg', 'K', 'inv-m']) expect(convert(convert(3.3, 'GeV', u), u, 'GeV')).toBeCloseTo(3.3, 10);
  });
  test('equivalents lists the whole class', () => {
    const e = equivalents(1, 'GeV');
    expect(e.all.find((x) => x.id === 'MeV')!.value).toBeCloseTo(1000, 6);
  });
});
