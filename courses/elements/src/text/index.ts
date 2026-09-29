// Access to the converted text in the app: a small eager index of every item, and the books
// themselves, loaded on demand.

import indexData from './data/index.json';
import type { Book, IndexEntry, Item } from './types';

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

export const index = indexData as IndexEntry[];
export const byId = new Map(index.map((e) => [e.id, e]));
export const propositions = index.filter((e) => e.kind === 'prop');

const loaders = import.meta.glob('./data/book-*.json', { import: 'default' }) as Record<string, () => Promise<Book>>;
const cache = new Map<number, Book>();
const itemCache = new Map<string, Item>();

export async function loadBook(n: number): Promise<Book> {
  const hit = cache.get(n);
  if (hit) return hit;
  const b = await loaders[`./data/book-${String(n).padStart(2, '0')}.json`]();
  cache.set(n, b);
  for (const s of b.sections) for (const it of s.items) itemCache.set(it.id, it);
  return b;
}
export const cachedBook = (n: number) => cache.get(n);
export const cachedItem = (id: string) => itemCache.get(id);

export async function loadItem(id: string): Promise<Item | undefined> {
  const e = byId.get(id);
  if (!e) return undefined;
  await loadBook(e.book);
  return itemCache.get(id);
}

export const bookOf = (id: string) => Number(id.split('.')[0]);

/** "I.47", "I Def. 15", "Post. 5", "C.N. 1", "X Def. II.3" */
export function citeLabel(id: string, withBook = true): string {
  const e = byId.get(id);
  const [b] = id.split('.');
  const R = ROMAN[Number(b)];
  if (!e) return id;
  switch (e.kind) {
    case 'prop':
      return `${R}.${e.n}`;
    case 'post':
      return `Post. ${e.n}`;
    case 'cn':
      return `C.N. ${e.n}`;
    case 'def':
      return `${withBook ? R + ' ' : ''}Def. ${e.group ? ROMAN[e.group] + '.' : ''}${e.n}`;
  }
}

/** Long form: "Book I, Proposition 47" */
export function longLabel(id: string): string {
  const e = byId.get(id);
  if (!e) return id;
  const B = `Book ${ROMAN[e.book]}`;
  switch (e.kind) {
    case 'prop':
      return `${B}, Proposition ${e.n}`;
    case 'post':
      return `Postulate ${e.n}`;
    case 'cn':
      return `Common Notion ${e.n}`;
    case 'def':
      return `${B}, Definition ${e.group ? ROMAN[e.group] + '.' : ''}${e.n}`;
  }
}

/** Accepts "I.47", "1.47", "i 47" and item ids; returns the item id if it exists. */
export function parseRef(s: string): string | undefined {
  const t = s.trim();
  if (byId.has(t)) return t;
  const m = /^([ivxlc]+|\d+)[\s.]+(\d+)$/i.exec(t);
  if (!m) return undefined;
  const b = /^\d+$/.test(m[1]) ? Number(m[1]) : ROMAN.indexOf(m[1].toUpperCase());
  const id = `${b}.${Number(m[2])}`;
  return byId.has(id) ? id : undefined;
}

export const nextId = (id: string) => {
  const i = index.findIndex((e) => e.id === id);
  return i >= 0 && i + 1 < index.length ? index[i + 1].id : undefined;
};
export const prevId = (id: string) => {
  const i = index.findIndex((e) => e.id === id);
  return i > 0 ? index[i - 1].id : undefined;
};

export const hrefOf = (id: string) => `#/${id}`;
