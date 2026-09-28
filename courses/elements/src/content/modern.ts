// The modern versions: one Markdown file per item in content/modern/<book>/<item>.md.

import meta from 'virtual:modern-meta';

const loaders = import.meta.glob('../../content/modern/*/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export const pathOf = (id: string) => {
  const [b, ...rest] = id.split('.');
  return `../../content/modern/${b}/${rest.join('.')}.md`;
};

export const hasModern = (id: string) => pathOf(id) in loaders;
export const modernTitle = (id: string): string | undefined => (meta as Record<string, { title?: string }>)[id]?.title;

export async function loadModern(id: string): Promise<string | undefined> {
  const l = loaders[pathOf(id)];
  return l ? await l() : undefined;
}

export function splitFrontMatter(src: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta: out, body: src.slice(m[0].length) };
}
