// Synchronous access to the converted text for tests and scripts (the app loads books lazily).
import type { Book, Item } from './types';

const books = import.meta.glob('./data/book-*.json', { eager: true, import: 'default' }) as Record<string, Book>;
const all = new Map<string, Item>();
for (const b of Object.values(books)) for (const s of b.sections) for (const it of s.items) all.set(it.id, it);

export const itemById = (id: string) => all.get(id);
export const allItems = () => [...all.values()];
export const allBooks = () => Object.values(books).sort((a, b) => a.n - b.n);
