/**
 * Small helpers shared by the field widgets that draw on canvases: resolving CSS theme variables to concrete colours
 * (a canvas cannot use `var()` or `light-dark()`), reacting to theme changes, device-pixel-ratio sizing and colour ramps.
 */

export type RGB = [number, number, number];

/** Resolve a CSS colour expression (for example `var(--track)`) to `rgb(…)` in the context of `el`. */
export function resolveColor(el: Element, expr: string): string {
  const probe = document.createElement('span');
  probe.style.color = expr;
  probe.style.display = 'none';
  el.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

/** Parse `rgb(…)`, `rgba(…)` or `color(srgb …)` (as returned by getComputedStyle) into 0–255 channels. */
export function parseRGB(c: string): RGB {
  const nums = c.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [0, 0, 0];
  if (c.startsWith('color(')) return [nums[0]! * 255, nums[1]! * 255, nums[2]! * 255];
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}

/** Resolve a set of named CSS expressions at once. */
export function readPalette<K extends string>(el: Element, spec: Record<K, string>): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const k of Object.keys(spec) as K[]) out[k] = resolveColor(el, spec[k]);
  return out;
}

/** Call `cb` whenever the page theme may have changed (data-theme on <html>, or the OS preference). Returns an unsubscribe. */
export function watchTheme(cb: () => void): () => void {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener('change', cb);
  };
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Size a canvas to `cssW × cssH` CSS pixels at the device pixel ratio and return a context scaled to CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number, fixedWidth = false): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  // a fluid canvas takes its width from CSS (width: 100%); setting it here too can make the layout chase itself
  if (fixedWidth) canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Linear blend of two colours. */
export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * A diverging ramp (negative → neutral → positive) for a value v in [−1, 1]; `neutral` is usually the panel colour so that the
 * field's zero vanishes into the background in either theme.
 */
export function diverging(v: number, neg: RGB, neutral: RGB, pos: RGB): RGB {
  const t = Math.max(-1, Math.min(1, v));
  return t < 0 ? mix(neutral, neg, -t) : mix(neutral, pos, t);
}

/** A number formatter for readouts. */
export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return '–';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e4 || a < 1e-3) return x.toExponential(Math.max(0, digits - 1)).replace('e', '×10^').replace('^+', '^').replace(/\^(-?\d+)/, (_, e: string) => sup(e));
  return Number(x.toPrecision(digits)).toString();
}
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
function sup(e: string): string {
  return [...e.replace(/^0+(?=\d)/, '')].map((c) => SUP[c] ?? c).join('');
}

/** A tick label for a power of ten, or a number near one: 1e-6 → "10⁻⁶", 1 → "1", 100 → "100", 1e5 → "10⁵". */
export function pow10(v: number): string {
  if (v === 0) return '0';
  const e = Math.round(Math.log10(Math.abs(v)));
  if (Math.abs(Math.abs(v) - 10 ** e) > 1e-9 * 10 ** e) return String(Number(v.toPrecision(3)));
  if (e >= -1 && e <= 3) return String(Number(v.toPrecision(3)));
  return `${v < 0 ? '−' : ''}10${sup(String(e))}`;
}

/** Report whether `el` is on screen (so that an animation can stop while it is scrolled away). Returns an unsubscribe. */
export function watchVisible(el: Element, cb: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    cb(true);
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) cb(e.isIntersecting);
  });
  io.observe(el);
  return () => io.disconnect();
}
