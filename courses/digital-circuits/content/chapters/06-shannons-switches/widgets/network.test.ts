import { describe, expect, test } from 'vitest';
import { NETWORKS, litCount, rowIndex, rows, substituted } from './network';

describe('series–parallel networks', () => {
  test('(A && B) || C lights five of the eight rows, A && (B || C) three', () => {
    expect(litCount(NETWORKS['ab-c'])).toBe(5);
    expect(litCount(NETWORKS['a-bc'])).toBe(3);
  });

  test('the network agrees with the expression it prints, for every row', () => {
    for (const n of Object.values(NETWORKS)) {
      const src = n.tokens.join('');
      const f = new Function('A', 'B', 'C', `return (${src});`) as (a: boolean, b: boolean, c: boolean) => boolean;
      for (const r of rows()) expect(n.conducts(r), `${src} at ${JSON.stringify(r)}`).toBe(f(r.a, r.b, r.c));
    }
  });

  test('a branch is highlighted only if the whole branch conducts', () => {
    const n = NETWORKS['ab-c'];
    expect(n.branch({ a: true, b: false, c: false }, 'a')).toBe(false);
    expect(n.branch({ a: true, b: true, c: false }, 'b')).toBe(true);
    expect(n.branch({ a: false, b: false, c: true }, 'c')).toBe(true);
    const m = NETWORKS['a-bc'];
    expect(m.branch({ a: false, b: true, c: true }, 'b')).toBe(false);
    expect(m.branch({ a: true, b: true, c: false }, 'b')).toBe(true);
    expect(m.branch({ a: true, b: true, c: false }, 'c')).toBe(false);
  });

  test('every conducting row highlights at least one path, and every dark row none', () => {
    for (const n of Object.values(NETWORKS)) {
      for (const r of rows()) {
        const any = (['a', 'b', 'c'] as const).some((w) => n.branch(r, w));
        expect(any).toBe(n.conducts(r));
      }
    }
  });

  test('row numbering and substitution', () => {
    expect(rows().map(rowIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(substituted(NETWORKS['ab-c'], { a: true, b: false, c: true })).toBe('(1 && 0) || 1');
    expect(substituted(NETWORKS['a-bc'], { a: false, b: true, c: false })).toBe('0 && (1 || 0)');
  });
});
