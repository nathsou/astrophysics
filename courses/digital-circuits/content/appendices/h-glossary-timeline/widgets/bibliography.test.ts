import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import YAML from 'yaml';
import { CITATIONS, REFS, groupRefs, parseBibliography, sortPlaces, whereOf } from './bibliography';

const yamlKeys = Object.keys(YAML.parse(readFileSync(new URL('../../../bibliography.yaml', import.meta.url), 'utf8')));

describe('places', () => {
  test('chapters and appendices are recognised and put in course order', () => {
    expect(whereOf('shannons-switches')).toMatchObject({ label: 'Ch 6', kind: 'chapter' });
    expect(whereOf('appendix:octet')).toMatchObject({ label: 'App. E', kind: 'appendix' });
    expect(whereOf('no-such-chapter')).toBeUndefined();
    expect(sortPlaces(['appendix:octet', 'cmos', 'relays', 'nonsense', 'appendix:reference'])).toEqual(['relays', 'cmos', 'appendix:reference', 'appendix:octet']);
  });
});

describe('grouping', () => {
  const refs = parseBibliography(`
zeta:\n  authors: Zed\n  year: 2001\n  title: Late\nalpha:\n  authors: Ann\n  year: 2000\n  title: Early\nbeta:\n  authors: Bob\n  year: 1999\n  title: Only in an appendix\ngamma:\n  authors: Cy\n  year: 1998\n  title: Nobody cites me\n`);
  const map = { zeta: ['cmos', 'relays'], alpha: ['the-transistor'], beta: ['appendix:octet'] };
  const groups = groupRefs(refs, map);
  test('a source goes to the part of the first chapter that cites it, and lists all its citers in course order', () => {
    const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
    expect(byId['part-I']!.entries.map((e) => e.key)).toEqual(['zeta']);
    expect(byId['part-I']!.entries[0]!.cited.map((w) => w.label)).toEqual(['Ch 5', 'Ch 9']);
    expect(byId['part-II']!.entries.map((e) => e.key)).toEqual(['alpha']);
    expect(byId['appendices']!.entries.map((e) => e.key)).toEqual(['beta']);
    expect(byId['uncited']!.entries.map((e) => e.key)).toEqual(['gamma']);
  });
  test('groups follow the order of the course, and empty groups are left out', () => {
    expect(groups.map((g) => g.id)).toEqual(['part-I', 'part-II', 'appendices', 'uncited']);
  });
});

describe('the real bibliography', () => {
  const groups = groupRefs(REFS, CITATIONS);
  test('every source appears exactly once, in a group', () => {
    expect(REFS.map((r) => r.key)).toEqual(yamlKeys);
    const keys = groups.flatMap((g) => g.entries.map((e) => e.key));
    expect(keys.sort()).toEqual([...yamlKeys].sort());
  });
  test('entries within a group are sorted by author', () => {
    for (const g of groups) {
      const authors = g.entries.map((e) => e.authors.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
      expect(authors, g.id).toEqual([...authors].sort((a, b) => a.localeCompare(b)));
    }
  });
  test('the citation map names only real chapters and appendices, and real sources', () => {
    for (const [key, places] of Object.entries(CITATIONS)) {
      expect(yamlKeys, key).toContain(key);
      for (const p of places) expect(whereOf(p), `${key}: ${p}`).toBeDefined();
    }
  });
});
