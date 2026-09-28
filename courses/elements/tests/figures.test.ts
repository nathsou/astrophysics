// Every figure: its construction runs, every label of Heath's text resolves to an object of the
// figure (or is listed in `unresolved` with a reason), and its claims hold in random configurations.
// BOOK=7 npx vitest run tests/figures.test.ts checks one book.

import { describe, expect, it } from 'vitest';
import { evaluate, type FigureDef } from '../src/geometry/figure';
import { trials } from '../src/geometry/jitter';
import { mentions, resolve } from '../src/geometry/resolve';
import { itemById } from '../src/text/load-node';

const figures = import.meta.glob('../src/figures/b*/p[0-9]*.ts', { eager: true, import: 'default' }) as Record<string, FigureDef>;
const only = process.env.BOOK ? Number(process.env.BOOK) : undefined;

describe('figures', () => {
  for (const [path, def] of Object.entries(figures)) {
    const m = /b(\d+)\/p(\d+)\.ts$/.exec(path)!;
    const book = Number(m[1]);
    if (only !== undefined && book !== only) continue;
    const id = `${book}.${Number(m[2])}`;
    it(`${id} resolves every label of the text`, () => {
      const scene = evaluate(def);
      const item = itemById(id);
      expect(item, `no item ${id}`).toBeTruthy();
      const allowed = def.unresolved ?? {};
      const missing = new Set<string>();
      for (const p of item!.paras) for (const mn of mentions(p.c)) if (!resolve(scene, mn.label, mn.kind) && !(mn.label in allowed)) missing.add(`${mn.label} (${mn.kind ?? 'no kind'})`);
      expect([...missing], 'labels with no object in the figure').toEqual([]);
      for (const [l, why] of Object.entries(allowed)) expect(why.length, `reason for leaving ${l} unresolved`).toBeGreaterThan(5);
    });
    it(`${id} claims hold in random configurations`, () => {
      const scene = evaluate(def);
      expect(scene.claims.filter((c) => !c.ok), 'claims in the default configuration').toEqual([]);
      const { ok } = trials(def, 50);
      const movable = [...scene.points.values()].some((p) => p.kind !== 'fixed') || scene.params.length > 0;
      if (movable) expect(ok.length, 'valid random configurations (most random configurations are degenerate: reduce `jitter`)').toBeGreaterThanOrEqual(20);
      for (const t of ok) {
        const bad = t.scene.claims.filter((c) => !c.ok);
        if (bad.length) throw new Error(`claim failed: ${bad.map((b) => `${b.label} (${b.lhs} vs ${b.rhs})`).join('; ')} in ${JSON.stringify(t.state)}`);
      }
    });
  }
});
