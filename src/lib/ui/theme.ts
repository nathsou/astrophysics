// Theme access for canvas/GPU code: read CSS custom properties, react to theme switches.

export type ThemeName = 'dark' | 'light';

export const currentTheme = (): ThemeName =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/** Read a CSS variable, e.g. cssVar('--accent'). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Parse a CSS colour (#rgb, #rrggbb, rgb(a)) to linear-ish [r,g,b,a] in 0..1 (sRGB encoded). */
export function cssColor(name: string): [number, number, number, number] {
  const v = cssVar(name);
  if (v.startsWith('#')) {
    const hex = v.length === 4 ? [...v.slice(1)].map((ch) => ch + ch).join('') : v.slice(1);
    const n = parseInt(hex.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  const m = v.match(/[\d.]+/g);
  if (m && m.length >= 3) return [+m[0] / 255, +m[1] / 255, +m[2] / 255, m[3] ? +m[3] : 1];
  return [1, 1, 1, 1];
}

/** Snapshot of the palette most sims need. */
export function palette() {
  return {
    bg: cssVar('--bg-sunk'),
    fg: cssVar('--fg'),
    muted: cssVar('--fg-muted'),
    faint: cssVar('--fg-faint'),
    rule: cssVar('--rule'),
    grid: cssVar('--plot-grid'),
    axis: cssVar('--plot-axis'),
    accent: cssVar('--accent'),
    accent2: cssVar('--accent-2'),
    accent3: cssVar('--accent-3'),
    good: cssVar('--good'),
    bad: cssVar('--bad'),
    series: [1, 2, 3, 4, 5].map((i) => cssVar(`--series-${i}`)),
  };
}
export type Palette = ReturnType<typeof palette>;

const listeners = new Set<(t: ThemeName) => void>();
let observing = false;

/** Subscribe to theme changes. Returns an unsubscribe function. */
export function onThemeChange(fn: (t: ThemeName) => void): () => void {
  listeners.add(fn);
  if (!observing) {
    observing = true;
    new MutationObserver(() => {
      const t = currentTheme();
      for (const l of listeners) l(t);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  return () => listeners.delete(fn);
}
