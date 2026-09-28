// Every item of the Elements has a modern version, and every proposition has a figure.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { index } from '../src/text';

const root = join(import.meta.dirname, '..');
const modernPath = (id: string) => {
  const [b, ...rest] = id.split('.');
  return join(root, 'content/modern', b, `${rest.join('.')}.md`);
};
const figurePath = (id: string) => {
  const [b, n] = id.split('.');
  return join(root, 'src/figures', `b${b.padStart(2, '0')}`, `p${n.padStart(2, '0')}.ts`);
};

describe('coverage', () => {
  it('every item has a modern version', () => {
    expect(index.filter((e) => !existsSync(modernPath(e.id))).map((e) => e.id)).toEqual([]);
  });
  it('every proposition has a figure', () => {
    expect(index.filter((e) => e.kind === 'prop' && !existsSync(figurePath(e.id))).map((e) => e.id)).toEqual([]);
  });
  it('every book has an introduction', () => {
    for (let b = 1; b <= 13; b++) expect(existsSync(join(root, 'content/modern', String(b), 'intro.md')), `book ${b}`).toBe(true);
  });
});
