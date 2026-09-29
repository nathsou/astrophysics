// Small global stores built on useSyncExternalStore: theme, reading preferences, and the object
// currently hovered in the text or the figure.

import { useSyncExternalStore } from 'react';

type Listener = () => void;

export class Store<T> {
  private listeners = new Set<Listener>();
  private v: T;
  constructor(v: T) {
    this.v = v;
  }
  get = () => this.v;
  set = (v: T) => {
    if (Object.is(v, this.v)) return;
    this.v = v;
    for (const l of this.listeners) l();
  };
  update = (f: (v: T) => T) => this.set(f(this.v));
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
}

export function useStore<T>(s: Store<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

export function persisted<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function persistentStore<T>(key: string, fallback: T): Store<T> {
  const s = new Store<T>(persisted(key, fallback));
  s.subscribe(() => {
    try {
      localStorage.setItem(key, JSON.stringify(s.get()));
    } catch {
      /* storage unavailable */
    }
  });
  return s;
}

// ------------------------------------------------------------------ theme (shared with the other courses)

export type Theme = 'system' | 'light' | 'dark';
function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}
export const themeStore = new Store<Theme>(readTheme());
export function applyTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', t);
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.theme = t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
}

// ------------------------------------------------------------------ reading preferences

export type TextMode = 'heath' | 'modern';
// A new key: the old one could hold 'both', which no longer exists.
export const textModeStore = persistentStore<TextMode>('elements.textMode.v2', 'heath');
export const byrneStore = persistentStore<boolean>('elements.byrne.v2', true);

// ------------------------------------------------------------------ hover linking between text and figure

/** The key of the object under the pointer (see geometry/resolve.ts), or null. */
export const hoverStore = new Store<string | null>(null);
/** The paragraph the reader is stepping through, or null for the whole figure. */
export const stepStore = new Store<number | null>(null);
