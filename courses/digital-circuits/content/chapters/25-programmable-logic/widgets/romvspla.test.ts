import { describe, expect, test } from 'vitest';
import { cover, coverFromMinterms } from '$lib/pld/twolevel/cube';
import { minimise } from '$lib/pld/twolevel/minimise';
import { FAMILIES, choose, count, family, fits, PLAS, plaFuses, point, romFuses, series, type FamilyId } from './romvspla';

/** The on-set of each family over n inputs, as minterms. */
function onSet(id: FamilyId, n: number): number[] {
  const all = Array.from({ length: 2 ** n }, (_, m) => m);
  const ones = (m: number) => m.toString(2).split('').filter((c) => c === '1').length;
  switch (id) {
    case 'decode':
      return [2 ** n - 1];
    case 'any':
      return all.filter((m) => m !== 0);
    case 'majority':
      return all.filter((m) => ones(m) > n / 2);
    case 'parity':
      return all.filter((m) => ones(m) % 2 === 1);
  }
}

describe('the term counts are what the minimiser finds', () => {
  for (const f of FAMILIES) {
    test(f.id, () => {
      for (let n = 1; n <= 7; n++) {
        const on = coverFromMinterms(n, onSet(f.id, n));
        const got = minimise(on, cover(n), { method: 'exact' }).cubes.length;
        expect(got, `${f.id}, n = ${n}`).toBe(f.terms(n));
      }
    });
  }
});

describe('sizes', () => {
  test('binomials', () => {
    expect(choose(5, 2)).toBe(10);
    expect(choose(24, 13)).toBe(2496144);
    expect(choose(3, 5)).toBe(0);
  });

  test('a ROM has 2ⁿ fuses; a PLA has 2n per term plus one', () => {
    expect(romFuses(10)).toBe(1024);
    expect(plaFuses(8, 16)).toBe(16 * 17);
  });

  test('a decoder is tiny in a PLA and huge in a ROM; parity is the reverse of a bargain', () => {
    const d = point(family('decode'), 20);
    expect(d.pla).toBe(41);
    expect(d.rom).toBe(1048576);
    const p = point(family('parity'), 20);
    expect(p.terms).toBe(524288);
    expect(p.pla).toBeGreaterThan(p.rom);
  });

  test('parity: the PLA overtakes the ROM as soon as 2n + 1 > 2', () => {
    for (const p of series(family('parity'), 2, 24)) expect(p.pla).toBeGreaterThan(p.rom);
  });

  test('the "any request" PLA grows only as n², the ROM as 2ⁿ', () => {
    const s = series(family('any'));
    expect(s[23]!.pla).toBe(24 * 49);
    expect(s[23]!.rom / s[23]!.pla).toBeGreaterThan(10000);
  });

  test('the series has one point per n', () => {
    expect(series(family('majority')).map((p) => p.n)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
});

describe('fitting real devices', () => {
  const [vpla, s100] = PLAS;
  test('the 82S100 holds an 8-input majority (56 terms)? no. A 5-input one (10 terms)? yes', () => {
    expect(point(family('majority'), 8).terms).toBe(56);
    expect(fits(s100!, 8, 56)).toBe(false);
    expect(fits(s100!, 5, point(family('majority'), 5).terms)).toBe(true);
  });
  test('the vPLA has 8 inputs and 16 terms', () => {
    expect(fits(vpla!, 8, 16)).toBe(true);
    expect(fits(vpla!, 9, 1)).toBe(false);
    expect(fits(vpla!, 8, 17)).toBe(false);
  });
});

describe('counts', () => {
  test('binary prefixes', () => {
    expect(count(512)).toBe('512');
    expect(count(1024)).toBe('1 Ki');
    expect(count(65536)).toBe('64 Ki');
    expect(count(2 ** 24)).toBe('16 Mi');
    expect(count(1536)).toBe('1.5 Ki');
  });
});
