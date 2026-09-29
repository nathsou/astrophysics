// Small global stores built on useSyncExternalStore, the shared theme, cross-highlighting and
// the inspector.

import { useSyncExternalStore, type ReactNode } from 'react';

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

// ------------------------------------------------------------ persistence

export function persisted<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function persist<T>(key: string, v: T) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/** A store whose value is saved in localStorage under `key`. */
export function persistedStore<T>(key: string, fallback: T): Store<T> {
  const s = new Store<T>(persisted(key, fallback));
  s.subscribe(() => persist(key, s.get()));
  return s;
}

// ------------------------------------------------------------ theme (shared by all courses)

export type Theme = 'light' | 'dark' | 'system';
const readTheme = (): Theme => {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
};
export const themeStore = new Store<Theme>(readTheme());
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
export function applyTheme(t: Theme, save = true) {
  document.documentElement.dataset.theme = t === 'system' ? (media?.matches ? 'dark' : 'light') : t;
  if (save) {
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
  }
}
media?.addEventListener('change', () => themeStore.get() === 'system' && applyTheme('system', false));
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== 'theme') return;
    themeStore.set(readTheme());
    applyTheme(readTheme(), false);
  });
}

// ------------------------------------------------------------ cross-highlighting
//
// Every view marks elements with `data-n="<node id>"` (and code items with `data-pos`). Hovering
// or focusing sets the highlighted keys; a single <style> element lights up matching elements in
// every view at once, without re-rendering React.

let styleEl: HTMLStyleElement | null = null;

export interface Highlight {
  /** node ids to emphasise strongly */
  primary: string[];
  /** node ids to emphasise softly (e.g. other occurrences bound by the same quantifier) */
  secondary?: string[];
  /** a quantifier binding the primary occurrence */
  binder?: string[];
}

export const highlightStore = new Store<Highlight | null>(null);

highlightStore.subscribe(() => {
  if (typeof document === 'undefined') return;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'hl-style';
    document.head.appendChild(styleEl);
  }
  const h = highlightStore.get();
  if (!h) {
    styleEl.textContent = '';
    return;
  }
  const sel = (ids: string[]) => ids.map((id) => `[data-n="${CSS.escape(id)}"]`).join(',');
  const svg = (ids: string[]) => ids.map((id) => `g[data-n="${CSS.escape(id)}"]>rect`).join(',');
  let css = '';
  if (h.secondary?.length) css += `${sel(h.secondary)}{background:var(--hl-2);border-radius:3px;}${svg(h.secondary)}{fill:var(--hl-2);}`;
  if (h.binder?.length) css += `${sel(h.binder)}{background:var(--hl-binder);border-radius:3px;box-shadow:0 0 0 1px var(--hl-binder-ring);}${svg(h.binder)}{fill:var(--hl-binder);stroke:var(--hl-binder-ring);}`;
  if (h.primary.length) css += `${sel(h.primary)}{background:var(--hl);border-radius:3px;}${svg(h.primary)}{fill:var(--hl);}`;
  styleEl.textContent = css;
});

// ------------------------------------------------------------ inspector

export interface InspectorEntry {
  /** stable key, to avoid re-rendering when the same thing is inspected again */
  key: string;
  title: ReactNode;
  kicker?: string;
  body: ReactNode;
}

export const inspectorStore = new Store<InspectorEntry | null>(null);
/** Whether the inspector is pinned (clicked) rather than showing the hovered item. */
export const inspectorPinned = new Store<boolean>(false);

/** Below this width the inspector floats over the page (or opens from the top bar) instead of sitting beside it. */
export const inspectorNarrow = () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 1260px)').matches;
/** Whether the floating inspector is collapsed; shared with the "Inspector" button of the mobile bar. */
export const inspectorCollapsed = new Store<boolean>(inspectorNarrow());

export function inspect(entry: InspectorEntry | null, pin = false) {
  if (!pin && inspectorPinned.get()) return;
  inspectorStore.set(entry);
  if (pin) inspectorPinned.set(!!entry);
}

// ------------------------------------------------------------ reduced motion

export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
