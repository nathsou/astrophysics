/**
 * Signal and instrument colours for Canvas / WebGL code.
 *
 * SVG and HTML should use the CSS custom properties directly (`stroke: var(--sig-high)`, or the
 * `.wire.sig-high` helper classes in app.css). Canvas cannot resolve `var()`, so it reads the same
 * tokens here. The tokens are written as `light-dark(…)` in app.css, which `getPropertyValue` returns
 * unresolved, so each colour is resolved through a hidden probe element's computed `color`
 * (an `rgb(…)` string that Canvas accepts). Outside the browser (SSR, tests) the fallbacks are used.
 *
 *   import { readSignals, onThemeChange } from '$lib/theme/signals';
 *   let sig = readSignals(canvas);                      // resolved in the canvas's colour scheme
 *   const stop = onThemeChange(() => { sig = readSignals(canvas); draw(); });
 *   ctx.strokeStyle = sig.high;
 */

export const SIGNAL_TOKENS = {
  high: '--sig-high',
  highGlow: '--sig-high-glow',
  low: '--sig-low',
  z: '--sig-z',
  x: '--sig-x',
  current: '--sig-current',
  voltNeg: '--volt-neg',
  voltZero: '--volt-zero',
  voltPos: '--volt-pos',
  wire: '--wire',
  copper: '--copper',
  phosphor: '--phosphor',
  phosphorGlow: '--phosphor-glow',
  silicon: '--silicon',
  siliconMetal: '--silicon-metal',
  scopeBg: '--scope-bg',
  scopeGrid: '--scope-grid',
  bg: '--bg',
  panel: '--panel',
  fg: '--fg',
  mute: '--mute',
  line: '--line',
} as const;

export type SignalName = keyof typeof SIGNAL_TOKENS;
export type Signals = Record<SignalName, string>;
export type Scheme = 'light' | 'dark';

/** The values in app.css, for SSR, tests and browsers without light-dark(). Keep in sync. */
export const FALLBACK: Record<Scheme, Signals> = {
  light: {
    high: '#c27000',
    highGlow: 'rgba(255, 160, 0, 0.32)',
    low: '#5b6b7e',
    z: '#80868e',
    x: '#cc3333',
    current: '#1a73c9',
    voltNeg: '#2d62c8',
    voltZero: '#858b93',
    voltPos: '#d1451b',
    wire: '#3a4350',
    copper: '#b8652e',
    phosphor: '#0d8050',
    phosphorGlow: 'rgba(13, 128, 80, 0.25)',
    silicon: '#3b3f5c',
    siliconMetal: '#c2ab78',
    scopeBg: '#0e1a17',
    scopeGrid: 'rgba(92, 240, 160, 0.13)',
    bg: '#f6f2ea',
    panel: '#fcfaf5',
    fg: '#1c2127',
    mute: '#5d6570',
    line: '#dcd4c5',
  },
  dark: {
    high: '#ffb23e',
    highGlow: 'rgba(255, 178, 62, 0.45)',
    low: '#7a8ba1',
    z: '#6f7782',
    x: '#ff6464',
    current: '#62c8ff',
    voltNeg: '#5b8ff0',
    voltZero: '#7d8796',
    voltPos: '#ff7a45',
    wire: '#8494a8',
    copper: '#e0925a',
    phosphor: '#5cf0a0',
    phosphorGlow: 'rgba(92, 240, 160, 0.45)',
    silicon: '#232840',
    siliconMetal: '#c9b27c',
    scopeBg: '#060d0b',
    scopeGrid: 'rgba(92, 240, 160, 0.13)',
    bg: '#0a0f17',
    panel: '#0f1620',
    fg: '#e2e8ef',
    mute: '#8f9bab',
    line: '#213043',
  },
};

/** Stroke widths (CSS px / SVG user units) and the Z dash pattern, as in app.css. */
export const STROKE = { wire: 2, high: 3, zDash: [5, 4] as number[] };

const browser = typeof window !== 'undefined' && typeof document !== 'undefined';

/** The colour scheme in effect at `el` (default: the document). */
export function currentScheme(el?: Element | null): Scheme {
  if (!browser) return 'light';
  const target = el ?? document.documentElement;
  const probe = resolve('light-dark(rgb(0, 0, 0), rgb(255, 255, 255))', target);
  if (probe === 'rgb(255, 255, 255)') return 'dark';
  if (probe === 'rgb(0, 0, 0)') return 'light';
  // No light-dark() support: fall back to the theme attribute and the media query.
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let probeEl: HTMLSpanElement | undefined;

/** Resolve any CSS colour expression (e.g. `var(--sig-high)`) to a computed `rgb()` string at `el`. */
function resolve(expr: string, el: Element): string {
  const host = el instanceof HTMLElement || el instanceof SVGElement ? el : document.body;
  const container = host instanceof SVGElement || host instanceof HTMLCanvasElement ? (host.parentElement ?? document.body) : host;
  probeEl ??= Object.assign(document.createElement('span'), { ariaHidden: 'true' });
  probeEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  probeEl.style.color = '';
  probeEl.style.color = expr;
  container.appendChild(probeEl);
  const value = getComputedStyle(probeEl).color;
  probeEl.remove();
  return value;
}

/**
 * One token, resolved at `el` (so a canvas inside `.screen` gets the dark values).
 * Returns the fallback when the token is missing or outside the browser.
 */
export function signalColor(name: SignalName, el?: Element | null): string {
  if (!browser) return FALLBACK.light[name];
  const target = el ?? document.documentElement;
  const raw = getComputedStyle(target).getPropertyValue(SIGNAL_TOKENS[name]).trim();
  if (!raw) return FALLBACK[currentScheme(target)][name];
  return resolve(`var(${SIGNAL_TOKENS[name]})`, target) || FALLBACK[currentScheme(target)][name];
}

/** Every signal colour, resolved at `el`. Cheap enough to call on each theme change, not per frame. */
export function readSignals(el?: Element | null): Signals {
  if (!browser) return { ...FALLBACK.light };
  const out = {} as Signals;
  for (const name of Object.keys(SIGNAL_TOKENS) as SignalName[]) out[name] = signalColor(name, el);
  return out;
}

/**
 * Colour for a voltage on the diverging scale: `min` → --volt-neg, 0 → --volt-zero, `max` → --volt-pos.
 * `sig` is a result of readSignals(). Interpolates in sRGB; values outside the range are clamped.
 */
export function voltColor(v: number, sig: Pick<Signals, 'voltNeg' | 'voltZero' | 'voltPos'>, min = -5, max = 5): string {
  if (v >= 0) return mix(sig.voltZero, sig.voltPos, max > 0 ? Math.min(1, v / max) : 0);
  return mix(sig.voltZero, sig.voltNeg, min < 0 ? Math.min(1, v / min) : 0);
}

/** Parse `#rgb`, `#rrggbb` or `rgb(a)(…)` into [r, g, b, a]. */
export function parseColor(c: string): [number, number, number, number] {
  const s = c.trim();
  if (s.startsWith('#')) {
    const h = s.length === 4 ? [...s.slice(1)].map((d) => d + d).join('') : s.slice(1, 7);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = /rgba?\(([^)]+)\)/.exec(s);
  if (!m) return [0, 0, 0, 1];
  const parts = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

/** Linear sRGB mix of two colours (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  const k = Math.max(0, Math.min(1, t));
  const c = x.map((v, i) => v + (y[i]! - v) * k);
  return `rgba(${Math.round(c[0]!)}, ${Math.round(c[1]!)}, ${Math.round(c[2]!)}, ${+c[3]!.toFixed(3)})`;
}

/** Same colour with a different alpha. */
export function withAlpha(c: string, alpha: number): string {
  const [r, g, b] = parseColor(c);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Call `cb` whenever the resolved theme may have changed: the `data-theme` attribute (the theme
 * toggle, or another tab via the storage event) or the OS preference. Returns an unsubscribe function.
 */
export function onThemeChange(cb: () => void): () => void {
  if (!browser) return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', cb);
  };
}

/** True when the reader asked for reduced motion (animate current as static arrows, no X flicker). */
export function prefersReducedMotion(): boolean {
  return browser && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
