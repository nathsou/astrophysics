import { describe, expect, test } from 'vitest';
import { allDefs } from '$lib/sim/netlist/catalog';
import { connect } from '$lib/sim/netlist/connect';
import { CATEGORIES, galleryEntries, grouped, matches } from './gallery';

const entries = galleryEntries();

describe('gallery', () => {
  test('one entry for every catalog type, once', () => {
    expect(entries.length).toBe(allDefs().length);
    expect(new Set(entries.map((e) => e.type)).size).toBe(entries.length);
  });
  test('every category in the catalog has a heading', () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    for (const e of entries) expect(known.has(e.category), `${e.type}: ${e.category}`).toBe(true);
  });
  test('every entry has a name, a description and a one-component circuit that resolves', () => {
    for (const e of entries) {
      expect(e.name, e.type).toBeTruthy();
      expect(e.description, e.type).toBeTruthy();
      expect(e.circuit.components).toHaveLength(1);
      expect(() => connect(e.circuit), e.type).not.toThrow();
    }
  });
  test('grouping keeps every entry and the category order', () => {
    const g = grouped(entries);
    expect(g.flatMap((x) => x.entries).length).toBe(entries.length);
    const order = CATEGORIES.map((c) => c.id);
    const ids = g.map((x) => x.id);
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
  });
  test('search: every word must match, in name, type, pins or description', () => {
    const nand = entries.find((e) => e.type === 'nand')!;
    expect(matches(nand, 'nand')).toBe(true);
    expect(matches(nand, 'NAND gate')).toBe(true);
    expect(matches(nand, 'nand flip')).toBe(false);
    expect(matches(entries.find((e) => e.type === 'relay')!, 'COM')).toBe(true);
    expect(grouped(entries, 'zzzz')).toEqual([]);
    expect(grouped(entries, 'transistor').flatMap((g) => g.entries.map((e) => e.type))).toEqual(expect.arrayContaining(['npn', 'pnp']));
    expect(grouped(entries, 'mosfet').flatMap((g) => g.entries.map((e) => e.type))).toEqual(['nmos', 'pmos']);
  });
});
