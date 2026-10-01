/** Number formatting for the readouts (British English: a thin grouping of thousands, SI-style units). */

export const int = (n: number): string => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-GB') : '–');

/** A number with `digits` significant figures, in plain or scientific notation as the size demands. */
export function sig(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return '–';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e6 || a < 1e-3) return x.toExponential(digits - 1).replace('e', ' × 10^').replace('^+', '^').replace(/\^(-?\d+)/, (_, e) => sup(e));
  return Number(x.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 6 });
}
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (e: string): string => [...e].map((c) => SUP[c] ?? c).join('');

/** A rate in hertz with a sensible unit. */
export function hz(r: number): string {
  if (!Number.isFinite(r)) return '–';
  const a = Math.abs(r);
  if (a === 0) return '0 Hz';
  if (a >= 1e9) return `${sig(r / 1e9)} GHz`;
  if (a >= 1e6) return `${sig(r / 1e6)} MHz`;
  if (a >= 1e3) return `${sig(r / 1e3)} kHz`;
  if (a >= 1) return `${sig(r)} Hz`;
  if (a >= 1e-3) return `${sig(r * 1e3)} mHz`;
  return `${sig(r)} Hz`;
}

/** A cross-section in pb with a sensible unit (pb, nb, µb, mb; fb below one picobarn). */
export function xsec(pb: number): string {
  if (!Number.isFinite(pb)) return '–';
  const a = Math.abs(pb);
  if (a >= 1e9) return `${sig(pb / 1e9)} mb`;
  if (a >= 1e6) return `${sig(pb / 1e6)} µb`;
  if (a >= 1e3) return `${sig(pb / 1e3)} nb`;
  if (a >= 1) return `${sig(pb)} pb`;
  return `${sig(pb * 1e3)} fb`;
}

/** Luminosity in cm⁻² s⁻¹. */
export const lumi = (l: number): string => `${sig(l)} cm⁻² s⁻¹`;

export function pct(x: number, digits = 1): string {
  return Number.isFinite(x) ? `${(100 * x).toFixed(digits)} %` : '–';
}
export function plusMinus(v: number, e: number, digits = 3): string {
  if (!Number.isFinite(v)) return '–';
  if (!(e > 0)) return sig(v, digits);
  // round the error to two figures and the value to the same decimal place
  const dec = Math.max(0, 1 - Math.floor(Math.log10(e)));
  return `${v.toFixed(Math.min(dec, 8))} ± ${e.toFixed(Math.min(dec, 8))}`;
}

export function duration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}
