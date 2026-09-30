import { describe, expect, test } from 'vitest';
import { FAMILIES, family, link } from './levels';

describe('families', () => {
  test('every family is self-consistent', () => {
    for (const f of FAMILIES) {
      expect(f.vil, f.id).toBeLessThan(f.vih);
      expect(f.vol, f.id).toBeLessThan(f.vil);
      expect(f.voh, f.id).toBeGreaterThan(f.vih);
      expect(f.volLight, f.id).toBeLessThanOrEqual(f.vol);
      expect(f.vohLight, f.id).toBeGreaterThanOrEqual(f.voh);
      expect(f.vohLight, f.id).toBeLessThan(f.vcc);
      expect(f.vinMax, f.id).toBeGreaterThan(f.vcc);
    }
  });
  test('74HC thresholds are 70 % and 30 % of the supply', () => {
    const hc = family('hc');
    expect(hc.vih / hc.vcc).toBeCloseTo(0.7, 5);
    expect(hc.vil / hc.vcc).toBeCloseTo(0.3, 5);
  });
  test('1.8 V LVCMOS thresholds are 65 % and 35 %', () => {
    const f = family('lvcmos18');
    expect(f.vih / f.vcc).toBeCloseTo(0.65, 5);
    expect(f.vil / f.vcc).toBeCloseTo(0.35, 5);
    expect(f.voh).toBeCloseTo(f.vcc - 0.45, 5);
  });
});

describe('links', () => {
  const l = (a: string, b: string) => link(family(a), family(b));
  test('HC to HC has the 1.4 V margins of chapter 10', () => {
    expect(l('hc', 'hc')).toMatchObject({ ok: true, nmh: 1.4, nml: 1.4 });
  });
  test('HCT reads what HC cannot', () => {
    expect(l('ttl', 'hc').ok).toBe(false);
    expect(l('ttl', 'hct').ok).toBe(true);
    expect(l('lvcmos33', 'hc').ok).toBe(false);
    expect(l('lvcmos33', 'hct').ok).toBe(true);
    expect(l('hct', 'hc').ok).toBe(true);
  });
  test('a 5 V output must not drive a 3.3 V input', () => {
    expect(l('hc', 'lvcmos33')).toMatchObject({ ok: false, overvoltage: true });
    expect(l('lvcmos33', 'lvcmos18').overvoltage).toBe(true);
  });
  test('1.8 V is too low for anything above', () => {
    expect(l('lvcmos18', 'lvcmos33').ok).toBe(false);
    expect(l('lvcmos18', 'hct').ok).toBe(false);
    expect(l('lvcmos18', 'lvcmos18').ok).toBe(true);
  });
  test('verdict text', () => {
    expect(l('hc', 'hc').verdict).toBe('Yes, with margins of 1.4 V (1) and 1.4 V (0).');
  });
});
