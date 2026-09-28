// The modern versions: front matter, KaTeX, citations and figure labels.
// BOOK=7 npx vitest run tests/modern.test.ts checks one book.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mathErrors, mdLabels, mdToHtml, splitWidgets } from '../src/ui/markdown-core';
import { splitFrontMatter } from '../src/content/modern';
import { byId } from '../src/text';
import { evaluate, type FigureDef } from '../src/geometry/figure';
import { resolve, type Kind } from '../src/geometry/resolve';
import { widgets } from '../src/widgets/registry';
import '../src/widgets';

const root = join(import.meta.dirname, '..');
const figures = import.meta.glob('../src/figures/b*/p*.ts', { eager: true, import: 'default' }) as Record<string, FigureDef>;
const only = process.env.BOOK ? Number(process.env.BOOK) : undefined;
const dir = join(root, 'content/modern');

const files: { id: string; path: string }[] = [];
for (const b of existsSync(dir) ? readdirSync(dir) : []) {
  if (!/^\d+$/.test(b) || (only !== undefined && Number(b) !== only)) continue;
  for (const f of readdirSync(join(dir, b))) if (f.endsWith('.md')) files.push({ id: `${Number(b)}.${f.replace(/\.md$/, '')}`, path: join(dir, b, f) });
}

describe('modern versions', () => {
  for (const { id, path } of files) {
    it(id, () => {
      const src = readFileSync(path, 'utf8');
      const { meta, body } = splitFrontMatter(src);
      const isIntro = id.endsWith('.intro');
      if (!isIntro) {
        expect(byId.has(id), `${id} is not an item of the Elements (file name?)`).toBe(true);
        expect(meta.title, 'a title in the front matter').toBeTruthy();
      }
      mathErrors.length = 0;
      const html = mdToHtml(body.replace(/^::.*$/gm, ''));
      expect(mathErrors, 'KaTeX errors').toEqual([]);
      expect(html).not.toContain('cite missing');
      for (const part of splitWidgets(body)) if ('widget' in part) expect(widgets[part.widget], `widget ${part.widget} is registered`).toBeTruthy();
      // labels used in the text must exist in the figure
      const [b, n] = id.split('.');
      const fig = figures[`../src/figures/b${b.padStart(2, '0')}/p${(n ?? '').padStart(2, '0')}.ts`];
      const labels = mdLabels(body);
      if (labels.length) {
        expect(fig, 'labels (@X) need a figure').toBeTruthy();
        const scene = evaluate(fig);
        const bad = labels.filter((l) => !resolve(scene, l.label, l.kind as Kind)).map((l) => l.label);
        expect(bad, 'labels with no object in the figure').toEqual([]);
      }
    });
  }
});
