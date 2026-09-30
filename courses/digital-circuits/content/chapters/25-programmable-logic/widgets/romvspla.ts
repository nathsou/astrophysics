/**
 * ROM against PLA as the number of inputs grows.
 *
 * A ROM with n address lines has 2ⁿ words, whatever it stores. A PLA has as many product terms as the
 * function needs after minimisation, which depends on the *kind* of function, not on n. The four families
 * below run from the best case for a PLA (one term, however many inputs) to the worst (parity, where the
 * PLA needs exactly as many terms as the ROM has words with a 1 in them, half of them).
 *
 * Sizes are counted in fuses (crosspoints) of a single-output function: a ROM has one per stored bit,
 * a PLA has two per input per term in the AND plane and one per term in the OR plane.
 */

export type FamilyId = 'decode' | 'any' | 'majority' | 'parity';

export interface Family {
  id: FamilyId;
  label: string;
  /** One line for the reader: what the function is. */
  blurb: string;
  /** Product terms of the minimal two-level cover of the function of n inputs. */
  terms(n: number): number;
}

/** C(n, k) as a float (exact up to 2⁵³, far beyond the sizes used here). */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const m = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= m; i++) r = (r * (n - m + i)) / i;
  return Math.round(r);
}

export const FAMILIES: readonly Family[] = [
  {
    id: 'decode',
    label: 'Address decode',
    blurb: 'Is this address in one particular block? One AND of all n inputs.',
    terms: () => 1,
  },
  {
    id: 'any',
    label: 'Any request',
    blurb: 'Is any of the n inputs 1? One single-literal term per input.',
    terms: (n) => n,
  },
  {
    id: 'majority',
    label: 'Majority',
    blurb: 'Are more than half of the n inputs 1? One term for every choice of ⌊n/2⌋ + 1 of them.',
    terms: (n) => choose(n, Math.floor(n / 2) + 1),
  },
  {
    id: 'parity',
    label: 'Parity',
    blurb: 'Is an odd number of the n inputs 1? The worst case: half of all 2ⁿ input combinations are terms of their own.',
    terms: (n) => 2 ** (n - 1),
  },
];

export const family = (id: FamilyId): Family => FAMILIES.find((f) => f.id === id)!;

/** Words in a ROM with n address lines. */
export const romWords = (n: number): number => 2 ** n;

/** Fuses of a ROM storing a one-bit-wide function of n inputs. */
export const romFuses = (n: number): number => 2 ** n;

/** Fuses of a PLA computing one output of n inputs from the given number of product terms. */
export const plaFuses = (n: number, terms: number): number => terms * (2 * n + 1);

export interface Point {
  n: number;
  terms: number;
  rom: number;
  pla: number;
}

export function point(f: Family, n: number): Point {
  const terms = f.terms(n);
  return { n, terms, rom: romFuses(n), pla: plaFuses(n, terms) };
}

export const series = (f: Family, from = 1, to = 24): Point[] => Array.from({ length: to - from + 1 }, (_, i) => point(f, from + i));

/** The PLAs of the chapter: the course's vPLA and the Signetics 82S100 (16 inputs, 48 terms, 8 outputs). */
export interface PlaSpec {
  name: string;
  inputs: number;
  terms: number;
}
export const PLAS: readonly PlaSpec[] = [
  { name: 'vPLA', inputs: 8, terms: 16 },
  { name: '82S100', inputs: 16, terms: 48 },
];

export function fits(spec: PlaSpec, n: number, terms: number): boolean {
  return n <= spec.inputs && terms <= spec.terms;
}

/** 1,024 → "1 Ki", 16,777,216 → "16 Mi"; small numbers as they are. */
export function count(x: number): string {
  if (x < 1024) return String(x);
  const units = ['Ki', 'Mi', 'Gi'];
  let v = x;
  let u = -1;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${units[u]}`;
}

/** Plain thousands separators for large counts ("2,496,144"). */
export const grouped = (x: number): string => Math.round(x).toLocaleString('en-GB');
