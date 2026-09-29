import { describe, expect, test } from 'vitest';
import { multiplierLabel, parseResistance, COLOURS, E12, E24, SERIES, SERIES_TOLERANCE, decode, encode, ideal, nearestPreferred, shopCode, type SeriesName } from './colour-code';

describe('decode', () => {
  test('the classics', () => {
    expect(decode(['yellow', 'violet', 'red', 'gold'])).toEqual({ ok: true, ohms: 4700, tolerance: 5 });
    expect(decode(['brown', 'black', 'orange', 'gold'])).toMatchObject({ ohms: 10000, tolerance: 5 });
    expect(decode(['red', 'red', 'black', 'silver'])).toMatchObject({ ohms: 22, tolerance: 10 });
    expect(decode(['orange', 'orange', 'brown', 'gold'])).toMatchObject({ ohms: 330 });
    expect(decode(['brown', 'black', 'black', 'gold'])).toMatchObject({ ohms: 10 });
  });
  test('five and six bands', () => {
    expect(decode(['brown', 'black', 'black', 'red', 'brown'])).toEqual({ ok: true, ohms: 10000, tolerance: 1 });
    expect(decode(['red', 'red', 'orange', 'brown', 'brown'])).toMatchObject({ ohms: 2230 });
    expect(decode(['yellow', 'violet', 'black', 'brown', 'brown', 'red'])).toEqual({ ok: true, ohms: 4700, tolerance: 1, tempco: 50 });
  });
  test('fractions of an ohm are exact', () => {
    expect(decode(['yellow', 'violet', 'gold', 'gold'])).toMatchObject({ ohms: 4.7 });
    expect(decode(['yellow', 'violet', 'silver', 'gold'])).toMatchObject({ ohms: 0.47 });
  });
  test('wrong colours are refused with a reason', () => {
    expect(decode(['gold', 'violet', 'red', 'gold'])).toMatchObject({ ok: false });
    expect(decode(['yellow', 'violet', 'red', 'orange'])).toMatchObject({ ok: false, message: 'orange is not a tolerance colour.' });
    expect(decode(['yellow', 'violet'])).toMatchObject({ ok: false });
  });
});

describe('encode', () => {
  test('exact values', () => {
    expect(encode(4700, 2, 5)).toEqual({ ok: true, bands: ['yellow', 'violet', 'red', 'gold'], ohms: 4700, exact: true });
    expect(encode(330, 2, 5)).toMatchObject({ bands: ['orange', 'orange', 'brown', 'gold'], exact: true });
    expect(encode(1e6, 2, 5)).toMatchObject({ bands: ['brown', 'black', 'green', 'gold'] });
    expect(encode(4.7, 2, 5)).toMatchObject({ bands: ['yellow', 'violet', 'gold', 'gold'], exact: true });
    expect(encode(0.1, 2, 5)).toMatchObject({ bands: ['brown', 'black', 'silver', 'gold'], exact: true });
    expect(encode(10, 2, 1)).toMatchObject({ bands: ['brown', 'black', 'black', 'brown'] });
    expect(encode(4990, 3, 1)).toMatchObject({ bands: ['yellow', 'white', 'white', 'brown', 'brown'], exact: true });
  });
  test('rounding is reported', () => {
    const r = encode(4990, 2, 5);
    expect(r).toMatchObject({ ok: true, exact: false, ohms: 5000, bands: ['green', 'black', 'red', 'gold'] });
    // carrying into the next decade: 99.6 → 100
    expect(encode(99.6, 2, 5)).toMatchObject({ bands: ['brown', 'black', 'brown', 'gold'], ohms: 100 });
  });
  test('zero ohm link', () => {
    expect(encode(0, 2, 5)).toMatchObject({ bands: ['black', 'black', 'black', 'gold'], ohms: 0 });
  });
  test('out of range and bad input', () => {
    expect(encode(0.001, 2, 5)).toMatchObject({ ok: false });
    expect(encode(1e12, 2, 5)).toMatchObject({ ok: false });
    expect(encode(-1, 2, 5)).toMatchObject({ ok: false });
    expect(encode(100, 2, 3)).toMatchObject({ ok: false });
  });
  test('decode inverts encode for every E24 value in eight decades', () => {
    for (let d = -1; d <= 6; d++)
      for (const v of E24) {
        const ohms = Number((v * 10 ** d).toPrecision(6));
        const e = encode(ohms, 2, 5);
        expect(e.ok && e.exact, String(ohms)).toBe(true);
        if (e.ok) expect(decode(e.bands)).toMatchObject({ ok: true, ohms });
      }
  });
});

describe('colours', () => {
  test('one colour per digit, in the order of the spectrum', () => {
    expect(COLOURS.filter((c) => c.digit !== undefined).map((c) => c.name)).toEqual(['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white']);
  });
  test('paint is unique so bands can be told apart', () => {
    expect(new Set(COLOURS.map((c) => c.paint)).size).toBe(COLOURS.length);
  });
});

describe('E series', () => {
  test('sizes', () => {
    expect(SERIES.E12.length).toBe(12);
    expect(SERIES.E24.length).toBe(24);
    expect(SERIES.E96.length).toBe(96);
    expect(SERIES.E6.length).toBe(6);
  });
  test('every E12 value is in E24, every E6 in E12', () => {
    for (const v of E12) expect(E24).toContain(v);
    for (const v of SERIES.E6) expect(E12).toContain(v);
  });
  test('E96 spot checks against the published series', () => {
    const e = SERIES.E96;
    expect(e.slice(0, 4)).toEqual([100, 102, 105, 107]);
    expect(e[24]).toBe(178);
    expect(e[48]).toBe(316);
    expect(e[56]).toBe(383);
    expect(e[95]).toBe(976);
    expect(e).toContain(499);
    expect(e).toContain(953);
    expect(e).toContain(619);
  });
  test('values lie within 5 % (E96: 0.5 %) of the ideal geometric progression', () => {
    for (const s of ['E6', 'E12', 'E24', 'E96'] as SeriesName[]) {
      const scale = s === 'E96' ? 10 : 1;
      SERIES[s].forEach((v, k) => {
        const err = Math.abs(v / scale / ideal(s, k) - 1);
        expect(err, `${s}[${k}]`).toBeLessThan(s === 'E96' ? 0.005 : 0.05);
      });
    }
  });
  test('each step multiplies by about 10^(1/N)', () => {
    for (const s of ['E6', 'E12', 'E24'] as SeriesName[]) {
      const step = 10 ** (1 / SERIES[s].length);
      const list = [...SERIES[s], 100];
      for (let i = 0; i < list.length - 1; i++) expect(list[i + 1]! / list[i]! / step, `${s} ${list[i]}`).toBeCloseTo(1, 1);
    }
  });
  test('nearest preferred value', () => {
    expect(nearestPreferred(4700, 'E12')).toBe(4700);
    expect(nearestPreferred(4900, 'E12')).toBe(4700);
    expect(nearestPreferred(5200, 'E12')).toBe(5600);
    expect(nearestPreferred(5000, 'E12')).toBe(4700);
    expect(nearestPreferred(5000, 'E24')).toBe(5100);
    expect(nearestPreferred(0.9, 'E12')).toBe(0.82);
    expect(nearestPreferred(97, 'E12')).toBe(100);
    expect(nearestPreferred(3.3e6, 'E24')).toBe(3.3e6);
    expect(nearestPreferred(4990, 'E96')).toBe(4990);
    expect(nearestPreferred(1234, 'E96')).toBe(1240);
  });
  test('shop codes', () => {
    expect(shopCode(4700)).toBe('4k7');
    expect(shopCode(470)).toBe('470R');
    expect(shopCode(2.2e6)).toBe('2M2');
    expect(shopCode(0.47)).toBe('0R47');
    expect(shopCode(10000)).toBe('10k');
    expect(shopCode(4.7)).toBe('4R7');
  });
});

describe('parseResistance', () => {
  test.each([
    ['470', 470],
    ['4.7k', 4700],
    ['4k7', 4700],
    ['2M2', 2.2e6],
    ['0R47', 0.47],
    ['4R7', 4.7],
    ['1e3', 1000],
    ['4.7 kΩ', 4700],
    ['100 ohm', 100],
    ['10K', 10000],
    ['1m', 1e6],
  ])('%s', (text, value) => expect(parseResistance(text)).toBeCloseTo(value, 9));
  test('rubbish', () => {
    expect(parseResistance('')).toBeUndefined();
    expect(parseResistance('abc')).toBeUndefined();
    expect(parseResistance('4.7.1k')).toBeUndefined();
  });
});

test('multiplier labels', () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1, -2].map(multiplierLabel)).toEqual(['×1', '×10', '×100', '×1k', '×10k', '×100k', '×1M', '×10M', '×100M', '×1G', '×0.1', '×0.01']);
});
