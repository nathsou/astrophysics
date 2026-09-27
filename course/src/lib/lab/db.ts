/**
 * Local persistence (IndexedDB) for learner state: exercise code, progress and settings.
 * Everything degrades to an in-memory map when storage is unavailable (private windows etc.).
 */
import { openDB, type IDBPDatabase } from 'idb';

const STORES = ['exercises', 'progress', 'kv', 'runs'] as const;
type Store = (typeof STORES)[number];

let dbp: Promise<IDBPDatabase | null> | undefined;
const memory = new Map<string, unknown>();

function db(): Promise<IDBPDatabase | null> {
  dbp ??= openDB('lm-course', 1, {
    upgrade(d) {
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    },
  }).catch(() => null);
  return dbp;
}

export async function get<T>(store: Store, key: string): Promise<T | undefined> {
  try {
    const d = await db();
    if (d) return (await d.get(store, key)) as T | undefined;
  } catch {
    /* fall through to memory */
  }
  return memory.get(`${store}:${key}`) as T | undefined;
}

export async function put(store: Store, key: string, value: unknown): Promise<void> {
  memory.set(`${store}:${key}`, value);
  try {
    const d = await db();
    await d?.put(store, value, key);
  } catch {
    /* in-memory only */
  }
}

export async function all<T>(store: Store): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  try {
    const d = await db();
    if (d) {
      const keys = await d.getAllKeys(store);
      const vals = await d.getAll(store);
      keys.forEach((k, i) => out.set(String(k), vals[i] as T));
      return out;
    }
  } catch {
    /* fall through */
  }
  for (const [k, v] of memory) if (k.startsWith(`${store}:`)) out.set(k.slice(store.length + 1), v as T);
  return out;
}

export interface SavedExercise {
  code: string;
  passed: boolean;
  /** Whether widgets should use this implementation instead of the reference one. */
  useMine?: boolean;
  updatedAt: number;
}
