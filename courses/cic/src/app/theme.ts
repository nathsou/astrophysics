import { createSignal } from 'solid-js';

export type ThemePref = 'system' | 'light' | 'dark';

function load(): ThemePref {
  try {
    const v = localStorage.getItem('theme') ?? localStorage.getItem('cic-theme');
    if (v === 'light' || v === 'dark' || v === 'system') return v;
    if (v === 'auto') return 'system';
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

const [theme, setThemeSignal] = createSignal<ThemePref>(load());
const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
const [systemDark, setSystemDark] = createSignal(media?.matches ?? false);

function apply(t: ThemePref) {
  const root = document.documentElement;
  root.setAttribute('data-theme', t === 'system' ? (systemDark() ? 'dark' : 'light') : t);
}
apply(theme());
media?.addEventListener('change', (event) => {
  setSystemDark(event.matches);
  if (theme() === 'system') apply('system');
});
window.addEventListener('storage', (event) => {
  if (event.key !== 'theme') return;
  const next = load();
  setThemeSignal(next);
  apply(next);
});

export function setTheme(t: ThemePref) {
  setThemeSignal(t);
  apply(t);
  try {
    localStorage.setItem('theme', t);
    localStorage.removeItem('cic-theme');
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
  return systemDark();
}

export { theme };
