/**
 * Undo and redo as a pure value: a stack of past states, the present one and a stack of futures.
 * States are immutable snapshots (the editor's operations return new circuits), so a "command" is
 * simply the state it produced. Commits that share a `key` within `window` milliseconds replace each
 * other, so dragging a slider or typing in a field is one undo step, not fifty.
 */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
  /** Coalescing key and time of the last commit. */
  readonly key?: string;
  readonly at?: number;
}

export interface CommitOptions {
  /** Commits with the same key close together become one step. */
  key?: string;
  /** Time of the commit (ms); defaults to Date.now(). */
  now?: number;
  /** How long a key stays open (ms). */
  window?: number;
  /** Most steps kept. */
  limit?: number;
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function commit<T>(h: History<T>, next: T, options: CommitOptions = {}): History<T> {
  if (Object.is(next, h.present)) return h;
  const now = options.now ?? Date.now();
  const { key, window = 800, limit = 200 } = options;
  if (key !== undefined && h.key === key && h.at !== undefined && now - h.at <= window && h.past.length) {
    return { past: h.past, present: next, future: [], key, at: now };
  }
  const past = [...h.past, h.present];
  if (past.length > limit) past.splice(0, past.length - limit);
  return { past, present: next, future: [], key, at: now };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const present = h.past[h.past.length - 1]!;
  return { past: h.past.slice(0, -1), present, future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [present, ...future] = h.future as [T, ...T[]];
  return { past: [...h.past, h.present], present, future };
}

/** Start again from a state (a new or opened circuit): no undo across it. */
export const reset = <T>(_h: History<T>, present: T): History<T> => createHistory(present);
