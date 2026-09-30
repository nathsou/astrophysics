/**
 * The resistor colour code (IEC 60062) and the E series of preferred values (IEC 60063), for
 * Appendix A: decode a set of bands to a value and tolerance, encode a value to bands, and find the
 * nearest preferred value.
 */

export interface Colour {
  name: string;
  /** Digit bands: 0–9. */
  digit?: number;
  /** Multiplier band: the power of ten. */
  power?: number;
  /** Tolerance band, ± percent. */
  tolerance?: number;
  /** Temperature coefficient band (six-band resistors), ppm per kelvin. */
  tempco?: number;
  /** Paint. The only place the course uses fixed colours: the colours are the subject. */
  paint: string;
  /** Text colour that reads on the paint. */
  ink: string;
}

export const COLOURS: Colour[] = [
  { name: 'black', digit: 0, power: 0, paint: '#15171a', ink: '#ffffff' },
  { name: 'brown', digit: 1, power: 1, tolerance: 1, tempco: 100, paint: '#7a4a28', ink: '#ffffff' },
  { name: 'red', digit: 2, power: 2, tolerance: 2, tempco: 50, paint: '#d3352b', ink: '#ffffff' },
  { name: 'orange', digit: 3, power: 3, tempco: 15, paint: '#ee7d20', ink: '#1a1a1a' },
  { name: 'yellow', digit: 4, power: 4, tempco: 25, paint: '#f0d22c', ink: '#1a1a1a' },
  { name: 'green', digit: 5, power: 5, tolerance: 0.5, paint: '#3c9b4b', ink: '#ffffff' },
  { name: 'blue', digit: 6, power: 6, tolerance: 0.25, tempco: 10, paint: '#2f62c8', ink: '#ffffff' },
  { name: 'violet', digit: 7, power: 7, tolerance: 0.1, tempco: 5, paint: '#8b50c5', ink: '#ffffff' },
  { name: 'grey', digit: 8, power: 8, tolerance: 0.05, paint: '#8a9098', ink: '#1a1a1a' },
  { name: 'white', digit: 9, power: 9, paint: '#f4f1ea', ink: '#1a1a1a' },
  { name: 'gold', power: -1, tolerance: 5, paint: '#c9a13a', ink: '#1a1a1a' },
  { name: 'silver', power: -2, tolerance: 10, paint: '#b9bec4', ink: '#1a1a1a' },
];

export const colour = (name: string): Colour => {
  const c = COLOURS.find((x) => x.name === name);
  if (!c) throw new Error(`no such colour: ${name}`);
  return c;
};

export const DIGIT_COLOURS = COLOURS.filter((c) => c.digit !== undefined);
export const MULTIPLIER_COLOURS = COLOURS.filter((c) => c.power !== undefined);
export const TOLERANCE_COLOURS = COLOURS.filter((c) => c.tolerance !== undefined);
export const TEMPCO_COLOURS = COLOURS.filter((c) => c.tempco !== undefined);
/** No tolerance band at all means ±20 %. */
export const NO_TOLERANCE = 20;

export type BandCount = 4 | 5 | 6;

export interface Decoded {
  ok: true;
  ohms: number;
  tolerance: number;
  tempco?: number;
}
export type DecodeResult = Decoded | { ok: false; message: string };

/**
 * Decode bands, left to right (the end with the bands bunched together is the left). Four bands:
 * two digits, multiplier, tolerance. Five: three digits. Six: five, then the temperature coefficient.
 */
export function decode(bands: readonly string[]): DecodeResult {
  const n = bands.length;
  if (n < 4 || n > 6) return { ok: false, message: 'A resistor has four, five or six bands.' };
  const nd = n === 4 ? 2 : 3;
  let mantissa = 0;
  for (let i = 0; i < nd; i++) {
    const d = colour(bands[i]!).digit;
    if (d === undefined) return { ok: false, message: `${bands[i]} is not a digit colour (band ${i + 1}).` };
    mantissa = mantissa * 10 + d;
  }
  const power = colour(bands[nd]!).power;
  if (power === undefined) return { ok: false, message: `${bands[nd]} cannot be a multiplier.` };
  const tol = colour(bands[nd + 1]!).tolerance;
  if (tol === undefined) return { ok: false, message: `${bands[nd + 1]} is not a tolerance colour.` };
  let tempco: number | undefined;
  if (n === 6) {
    tempco = colour(bands[5]!).tempco;
    if (tempco === undefined) return { ok: false, message: `${bands[5]} is not a temperature-coefficient colour.` };
  }
  // 10^power with negative powers: divide instead of multiplying, to keep 4.7 exactly 4.7.
  const ohms = power >= 0 ? mantissa * 10 ** power : mantissa / 10 ** -power;
  return { ok: true, ohms, tolerance: tol, ...(tempco !== undefined ? { tempco } : {}) };
}

export interface Encoded {
  ok: true;
  /** Colour names, left to right, including the tolerance band. */
  bands: string[];
  /** The value the bands really mean (the request, rounded to fit). */
  ohms: number;
  /** True if the request needed no rounding. */
  exact: boolean;
}
export type EncodeResult = Encoded | { ok: false; message: string };

/** Encode a value with two (four-band) or three (five-band) significant digits. */
export function encode(ohms: number, digits: 2 | 3, tolerance: number): EncodeResult {
  if (!Number.isFinite(ohms) || ohms < 0) return { ok: false, message: 'Enter a resistance of zero or more.' };
  const tolBand = TOLERANCE_COLOURS.find((c) => c.tolerance === tolerance);
  if (!tolBand) return { ok: false, message: `No band for a tolerance of ±${tolerance} %.` };
  if (ohms === 0) return { ok: true, bands: [...Array(digits).fill('black'), 'black', tolBand.name], ohms: 0, exact: true };
  const [m, e] = ohms.toExponential(digits - 1).split('e') as [string, string];
  const power = Number(e) - (digits - 1);
  const mult = MULTIPLIER_COLOURS.find((c) => c.power === power);
  if (!mult) {
    return { ok: false, message: power < -2 ? 'Too small: the smallest multiplier is ×0.01 (silver).' : 'Too large: the largest multiplier is ×10⁹ (white).' };
  }
  const digitNames = m.replace('.', '').split('').map((d) => DIGIT_COLOURS[Number(d)]!.name);
  const rounded = power >= 0 ? Number(m.replace('.', '')) * 10 ** power : Number(m.replace('.', '')) / 10 ** -power;
  return { ok: true, bands: [...digitNames, mult.name, tolBand.name], ohms: rounded, exact: Math.abs(rounded - ohms) <= ohms * 1e-9 };
}

// ---------------------------------------------------------------------------------------------
// Preferred values

export const E6 = [10, 15, 22, 33, 47, 68];
export const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
export const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
/** E48 and E96 are the powers 10^(k/N) rounded to three digits. */
export const e96 = (): number[] => Array.from({ length: 96 }, (_, k) => Math.round(10 ** (2 + k / 96)));

export const SERIES = { E6, E12, E24, E96: e96() } as const;
export type SeriesName = keyof typeof SERIES;

/** Tolerance the series was designed for: neighbouring ranges just touch. */
export const SERIES_TOLERANCE: Record<SeriesName, number> = { E6: 20, E12: 10, E24: 5, E96: 1 };

/** The exact geometric value 10^(k/N) that the k-th member of a series approximates. */
export const ideal = (series: SeriesName, k: number) => 10 ** (1 + k / SERIES[series].length);

/** The preferred value nearest to `ohms` (nearest in ratio, since tolerances are ratios). */
export function nearestPreferred(ohms: number, series: SeriesName): number {
  if (!(ohms > 0)) return 0;
  const table = SERIES[series];
  const scale = series === 'E96' ? 100 : 10;
  const decade = Math.floor(Math.log10(ohms));
  let best = table[0]! * 10 ** (decade - Math.log10(scale));
  let bestErr = Infinity;
  for (const d of [decade - 1, decade, decade + 1]) {
    for (const v of table) {
      const candidate = (v * 10 ** d) / (scale / 10);
      const err = Math.abs(Math.log(candidate / ohms));
      if (err < bestErr) {
        best = candidate;
        bestErr = err;
      }
    }
  }
  return Number(best.toPrecision(3));
}

/** Value in the form printed on parts and in shops: 4.7k, 2M2, 470R. */
export function shopCode(ohms: number): string {
  const units: [number, string][] = [
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
    [1, 'R'],
  ];
  for (const [scale, letter] of units) {
    if (ohms >= scale) {
      const s = Number((ohms / scale).toPrecision(3)).toString();
      return s.includes('.') ? s.replace('.', letter) : s + letter;
    }
  }
  return Number(ohms.toPrecision(3)).toString().replace('.', 'R');
}

/** Parse a resistance as people type it: 470, 4.7k, 4k7, 2M2, 0R47, 1e3, 4.7 kΩ, 100 ohm. */
export function parseResistance(text: string): number | undefined {
  const t = text.trim().replace(/[\s  ]/g, '').replace(/(?:ohms?|Ω)$/i, '');
  if (t === '') return undefined;
  const scale: Record<string, number> = { r: 1, k: 1e3, m: 1e6, g: 1e9 };
  // 4k7, 2M2, 0R47: the letter is the decimal point.
  let m = /^(\d+)([rkmg])(\d*)$/i.exec(t);
  if (m) return Number(`${m[1]}.${m[3] || '0'}`) * scale[m[2]!.toLowerCase()]!;
  m = /^(\d*\.?\d+(?:e[+-]?\d+)?)([kmg]?)$/i.exec(t);
  if (m) return Number(m[1]) * (m[2] ? scale[m[2].toLowerCase()]! : 1);
  return undefined;
}

/** The multiplier as printed in tables: ×1, ×10, ×1k, ×100M, ×0.1. */
export function multiplierLabel(power: number): string {
  if (power < 0) return `×${10 ** power}`;
  const units = ['', 'k', 'M', 'G'];
  const group = Math.floor(power / 3);
  return `×${10 ** (power - group * 3)}${units[group]}`;
}
