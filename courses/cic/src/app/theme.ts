import { createSignal } from 'solid-js';

export type ThemePref = 'system' | 'light' | 'dark';

function load(): ThemePref {
  try {
    const v = localStorage.getItem('cic-theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

const [theme, setThemeSignal] = createSignal<ThemePref>(load());

function apply(t: ThemePref) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
}
apply(theme());

export function setTheme(t: ThemePref) {
  setThemeSignal(t);
  apply(t);
  try {
    localStorage.setItem('cic-theme', t);
  } catch {
    /* ignore */
  }
}

export function cycleTheme() {
  const order: ThemePref[] = ['system', 'light', 'dark'];
  setTheme(order[(order.indexOf(theme()) + 1) % order.length]);
}

/** the effective theme, taking the system preference into account */
export function isDark(): boolean {
  const t = theme();
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export { theme };
