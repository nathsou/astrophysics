/**
 * The glossary, bibliography and timeline are edited by many chapters. A stray unquoted ": " in one
 * entry breaks every page, so parse them here and check the basic shape of each entry.
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const root = path.resolve(import.meta.dirname, '../../content');
const load = (name: string) => YAML.parse(readFileSync(path.join(root, `${name}.yaml`), 'utf8'));

describe('shared content YAML', () => {
  test('bibliography entries have authors, a year and a title', () => {
    const bib = load('bibliography') as Record<string, Record<string, unknown>>;
    for (const [key, e] of Object.entries(bib)) {
      expect(e, key).toBeTypeOf('object');
      expect(e.authors, `${key}.authors`).toBeTruthy();
      expect(e.year, `${key}.year`).toBeTruthy();
      expect(e.title, `${key}.title`).toBeTruthy();
    }
  });
  test('glossary entries have a term and a definition', () => {
    const g = load('glossary') as Record<string, Record<string, unknown>>;
    for (const [key, e] of Object.entries(g)) {
      expect(typeof e.term, `${key}.term`).toBe('string');
      expect(typeof e.definition, `${key}.definition`).toBe('string');
    }
  });
  test('timeline entries have a year, a title and text', () => {
    const t = load('timeline') as Record<string, unknown>[];
    expect(Array.isArray(t)).toBe(true);
    for (const e of t) {
      expect(typeof e.year, JSON.stringify(e).slice(0, 80)).toBe('number');
      expect(e.title).toBeTruthy();
      expect(e.text).toBeTruthy();
    }
  });
});
