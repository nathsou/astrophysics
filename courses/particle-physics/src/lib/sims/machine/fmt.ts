/** Number formatting shared by the machine and trigger widgets (British English, Unicode superscripts). */
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '+': '' };
const sup = (n: number): string => String(n).split('').map((c) => SUP[c] ?? c).join('');

/** 1.23 × 10³⁴ from 1.23e34 (digits = significant figures). */
export function fmtSci(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return '–';
  if (x === 0) return '0';
  const [m, e] = x.toExponential(digits - 1).split('e');
  const exp = Number(e);
  if (exp === 0) return m!;
  return `${m} × 10${sup(exp)}`;
}
/** A rate in Hz as "640 Hz", "12.3 kHz", "4.1 MHz". */
export function fmtRate(hz: number): string {
  if (!Number.isFinite(hz)) return '–';
  const a = Math.abs(hz);
  if (a >= 1e9) return `${(hz / 1e9).toPrecision(3)} GHz`;
  if (a >= 1e6) return `${(hz / 1e6).toPrecision(3)} MHz`;
  if (a >= 1e3) return `${(hz / 1e3).toPrecision(3)} kHz`;
  if (a >= 10) return `${hz.toFixed(0)} Hz`;
  if (a >= 1) return `${hz.toFixed(1)} Hz`;
  if (a >= 0.01) return `${hz.toFixed(2)} Hz`;
  if (a === 0) return '0 Hz';
  return `${fmtSci(hz, 2)} Hz`;
}
/** A count with thousands separators, or scientific for big numbers. */
export function fmtCount(x: number): string {
  if (!Number.isFinite(x)) return '–';
  if (x >= 1e7) return fmtSci(x, 2);
  if (x >= 100) return Math.round(x).toLocaleString('en-GB');
  if (x >= 1) return x.toFixed(1);
  return x.toPrecision(2);
}
/** A percentage with sensible digits. */
export const fmtPct = (f: number): string => (f >= 0.995 ? '100%' : f < 0.0005 ? '0%' : f < 0.1 ? `${(100 * f).toFixed(1)}%` : `${(100 * f).toFixed(0)}%`);
/** A duration in hours as "6.2 h". */
export const fmtHours = (s: number): string => `${(s / 3600).toFixed(1)} h`;

/** Whether the reader asks for reduced motion (false off the browser). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
