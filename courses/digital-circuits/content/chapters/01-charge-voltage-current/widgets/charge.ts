/**
 * The numbers behind the "charge counter": how many electrons make a coulomb, and how big everyday
 * amounts of charge are.
 */
import { E_CHARGE, sci } from './wire';

export interface Landmark {
  id: string;
  /** Short name for the chip. */
  label: string;
  /** How the readout names it in a sentence ("about 3 times a static shock"). */
  phrase: string;
  /** Number of electrons. */
  electrons: number;
  /** One line for the readout. */
  about: string;
}

const coulombs = (c: number) => c / E_CHARGE;

/** Landmarks on the axis, ascending. Sources for the battery capacities are ordinary datasheet values. */
export const LANDMARKS: Landmark[] = [
  { id: 'one', phrase: 'one electron', label: 'One electron', electrons: 1, about: 'The smallest free charge there is: 1.6×10⁻¹⁹ C.' },
  { id: 'nanoamp', phrase: 'a nanoampere for a second', label: '1 nA for 1 s', electrons: coulombs(1e-9), about: 'A nanoampere, the leakage of a good input pin, still moves six billion electrons every second.' },
  { id: 'shock', phrase: 'a static shock', label: 'Static shock', electrons: coulombs(3e-7), about: 'A doorknob spark: a body of about 100 pF discharging from 3 kV carries roughly 0.3 µC.' },
  { id: 'led', phrase: 'an LED for a second', label: 'LED for 1 s', electrons: coulombs(0.02), about: 'An LED at 20 mA passes 0.02 C every second.' },
  { id: 'coulomb', phrase: 'one coulomb', label: '1 coulomb', electrons: coulombs(1), about: 'One ampere for one second: 6.24×10¹⁸ electrons.' },
  { id: 'aa', phrase: 'an AA cell’s worth', label: 'AA cell', electrons: coulombs(2.5 * 3600), about: 'A 2,500 mAh alkaline cell can push about 9,000 C round a circuit before it is flat.' },
  { id: 'phone', phrase: 'a phone battery’s worth', label: 'Phone battery', electrons: coulombs(3 * 3600), about: 'A 3,000 mAh phone battery: about 10,800 C, or 6.7×10²² electrons.' },
];

/** The slider runs from 10⁰ to 10²³ electrons. */
export const MIN_EXPONENT = 0;
export const MAX_EXPONENT = 23;

export function electronsAt(exponent: number): number {
  return 10 ** exponent;
}

/** Charge of n electrons in coulombs. */
export function chargeOf(electrons: number): number {
  return electrons * E_CHARGE;
}

/** The landmark closest to `exponent` on the log axis, and how many times bigger (or smaller) the amount is than it. */
export function nearestLandmark(exponent: number): { landmark: Landmark; ratio: number } {
  let best = LANDMARKS[0]!;
  let bestD = Infinity;
  for (const l of LANDMARKS) {
    const d = Math.abs(Math.log10(l.electrons) - exponent);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return { landmark: best, ratio: 10 ** (exponent - Math.log10(best.electrons)) };
}

/** "3 ns", "40 ms", "2.5 h", "230 years": a duration in seconds. */
export function formatDuration(s: number): string {
  if (!(s > 0)) return '0 s';
  const g = (x: number) => String(Number(x.toPrecision(2)));
  if (s < 1e-6) return `${g(s * 1e9)} ns`;
  if (s < 1e-3) return `${g(s * 1e6)} µs`;
  if (s < 1) return `${g(s * 1e3)} ms`;
  if (s < 60) return `${g(s)} s`;
  if (s < 3600) return `${g(s / 60)} min`;
  if (s < 86400) return `${g(s / 3600)} h`;
  if (s < 86400 * 365.25) return `${g(s / 86400)} days`;
  const years = s / (86400 * 365.25);
  return years < 1e6 ? `${g(years)} years` : `${sci(years)} years`;
}

/** A charge in coulombs as "1.6×10⁻¹⁹ C" or, for practical sizes, "3 mC". */
export function formatCharge(c: number): string {
  if (c >= 1) return `${String(Number(c.toPrecision(3)))} C`;
  if (c >= 1e-3) return `${String(Number((c * 1e3).toPrecision(3)))} mC`;
  if (c >= 1e-6) return `${String(Number((c * 1e6).toPrecision(3)))} µC`;
  if (c >= 1e-9) return `${String(Number((c * 1e9).toPrecision(3)))} nC`;
  return `${sci(c, 3)} C`;
}

/** Format an electron count: "1", "6.24×10¹⁸". */
export function formatElectrons(n: number): string {
  return n < 1e4 ? String(Math.round(n)) : sci(n, 3);
}
