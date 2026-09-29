// A Vite plugin providing `virtual:modern-meta`: the front matter (title) of every modern
// write-up in content/modern/, so that lists and citation previews can show the modern titles
// without loading the write-ups themselves.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export interface ModernMeta {
  title?: string;
}

export function parseFrontMatter(src: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: src.slice(m[0].length) };
}

/** content/modern/1/47.md → 1.47; 1/def.15.md → 1.def.15 */
export const idOfPath = (book: string, file: string) => `${Number(book)}.${file.replace(/\.md$/, '')}`;

export function readModernMeta(root: string): Record<string, ModernMeta> {
  const dir = join(root, 'content/modern');
  const out: Record<string, ModernMeta> = {};
  if (!existsSync(dir)) return out;
  for (const b of readdirSync(dir)) {
    if (!/^\d+$/.test(b)) continue;
    for (const f of readdirSync(join(dir, b))) {
      if (!f.endsWith('.md')) continue;
      const { meta } = parseFrontMatter(readFileSync(join(dir, b, f), 'utf8'));
      out[idOfPath(b, f)] = { ...(meta.title ? { title: meta.title } : {}) };
    }
  }
  return out;
}

export function modernMeta(root: string): Plugin {
  const id = 'virtual:modern-meta';
  const resolved = '\0' + id;
  return {
    name: 'modern-meta',
    resolveId: (s) => (s === id ? resolved : undefined),
    load(s) {
      if (s !== resolved) return;
      return `export default ${JSON.stringify(readModernMeta(root))};`;
    },
    handleHotUpdate(ctx) {
      if (ctx.file.includes('/content/modern/')) {
        const m = ctx.server.moduleGraph.getModuleById(resolved);
        if (m) ctx.server.moduleGraph.invalidateModule(m);
      }
    },
  };
}
