// Tiny global stores built on useSyncExternalStore.
//
// Cross-highlighting works without re-rendering React: hovering sets a list of
// keys, and a single <style> element is rewritten with attribute selectors
// that light up every element carrying one of those keys, in every view.

import { useSyncExternalStore } from 'react';
import type { Info } from '../compiler/listing';

type Listener = () => void;

export class Store<T> {
  private listeners = new Set<Listener>();
  constructor(private v: T) {}
  get = () => this.v;
  set = (v: T) => {
    if (Object.is(v, this.v)) return;
    this.v = v;
    for (const l of this.listeners) l();
  };
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export function useStore<T>(s: Store<T>): T {
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

// ------------------------------------------------------------ highlighting

let styleEl: HTMLStyleElement | null = null;
const q = (s: string) => JSON.stringify(s);

export interface HighlightSpec {
  /** elements whose own key is one of these */
  own: string[];
  /** elements that link to one of these */
  linkedTo?: string[];
}

export function setHighlight(h: HighlightSpec | null) {
  if (typeof document === 'undefined') return;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'hl-style';
    document.head.appendChild(styleEl);
  }
  if (!h || (!h.own.length && !h.linkedTo?.length)) {
    styleEl.textContent = '';
    return;
  }
  const sel: string[] = [];
  for (const k of h.own) sel.push(`[data-k=${q(k)}]`);
  for (const k of h.linkedTo ?? []) sel.push(`[data-l~=${q(k)}]`);
  styleEl.textContent = `${sel.join(',')}{background:var(--hl)!important;border-radius:3px}` +
    `.ln${sel.map((s) => s).join(',.ln')}{background:var(--hl-line)!important;border-left-color:var(--amber)!important}`;
}

// ------------------------------------------------------------ tooltip

export interface TipState {
  x: number;
  y: number;
  /** bottom of the anchor, so the tip can flip below */
  y2: number;
  info?: Info;
  node?: React.ReactNode;
  why?: string;
  ctx?: TipContext;
}

/** context a code view supplies so tooltips can say more (e.g. which target) */
export interface TipContext {
  target?: string;
}

export const tipStore = new Store<TipState | null>(null);

export function showTip(el: Element, content: Omit<TipState, 'x' | 'y' | 'y2'>) {
  const r = el.getBoundingClientRect();
  tipStore.set({ x: r.left, y: r.top, y2: r.bottom, ...content });
}
export const hideTip = () => tipStore.set(null);

// ------------------------------------------------------------ theme

export type Theme = 'light' | 'dark' | 'auto';
const initialTheme = (): Theme => {
  try { return (localStorage.getItem('theme') as Theme) || 'auto'; } catch { return 'auto'; }
};
export const themeStore = new Store<Theme>(initialTheme());
export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch { /* private mode */ }
}

export function persisted<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function persist<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}
