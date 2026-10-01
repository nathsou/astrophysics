/** Small formatting and scheduling helpers shared by the Part VIII widgets (no DOM except `setTimeout`). */

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

/** A number with a fixed count of significant figures, with a proper minus sign. */
export function sig(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : 'n/a';
  return String(Number(x.toPrecision(digits))).replace('-', '−');
}

/** Scientific notation with Unicode superscripts: 2.5 × 10⁻³. Values in [0.01, 1000) are written plainly. */
export function sci(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return 'n/a';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 0.01 && a < 1000) return sig(x, digits);
  const e = Math.floor(Math.log10(a));
  const m = x / 10 ** e;
  const exp = String(e).split('').map((c) => SUP[c] ?? c).join('');
  return `${m.toFixed(digits - 1).replace('-', '−')} × 10${exp}`;
}

/** Yield to the browser between slices of work. */
export async function chunked(total: number, chunk: number, step: (i: number) => void, progress?: (done: number) => void, cancelled?: () => boolean): Promise<boolean> {
  for (let i = 0; i < total; i += chunk) {
    if (cancelled?.()) return false;
    const end = Math.min(total, i + chunk);
    for (let j = i; j < end; j++) step(j);
    progress?.(end);
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return !cancelled?.();
}

/** n values from lo to hi, evenly spaced. */
export function linspace(lo: number, hi: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}
/** n values from lo to hi, evenly spaced on a log scale. */
export function logspace(lo: number, hi: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => lo * Math.pow(hi / lo, i / (n - 1)));
}

/** A tick label for a power of ten: 10⁻⁹. Other values fall back to `sig`. */
export function pow10Label(v: number): string {
  const e = Math.round(Math.log10(v));
  if (Math.abs(v / 10 ** e - 1) > 1e-9) return sig(v, 2);
  if (e === 0) return '1';
  if (e === 1) return '10';
  if (e === -1) return '0.1';
  return `10${String(e).split('').map((c) => SUP[c] ?? c).join('')}`;
}
