/**
 * The polarity demo: fit one output into a chosen macrocell with the course's real GAL22V10 fitter, in either
 * output polarity, and see how many product terms it needs against how many the macrocell has.
 */
import { GalFitError, fitGal22v10Equations } from '$lib/pld/devices/gal22v10-fit';
import { PRODUCT_TERMS } from '$lib/pld/devices/gal22v10';

export interface Preset {
  id: string;
  label: string;
  /** One line of the story. */
  story: string;
  /** The equations, in the fitter's syntax. The output is called Y. */
  equations: string;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'ok',
    label: 'System OK',
    story: 'The lamp is lit unless a fault flag G is set, or all of A, B, C are on, or all of D, E, F are on.',
    equations: 'Y = !(G | A & B & C | D & E & F)',
  },
  {
    id: 'clear',
    label: 'All clear',
    story: 'The lamp is lit only when none of the four flags A, B, C, D is set.',
    equations: 'Y = !A & !B & !C & !D',
  },
  {
    id: 'parity5',
    label: '5-input parity',
    story: 'An odd number of the five inputs are on. The polarity cannot help: the complement (even) is just as big.',
    equations: 'Y = A ^ B ^ C ^ D ^ E',
  },
];

export type PolarityChoice = 'auto' | 'high' | 'low';

/** The macrocells in order of size. Pins 23 and 14 have 8 terms; 19 and 18 have 16. */
export const PINS = [23, 22, 21, 20, 19] as const;
export const capacity = (pin: number): number => PRODUCT_TERMS[pin]!;

export type Outcome =
  | {
      ok: true;
      /** The polarity the fitter used. */
      polarity: 'high' | 'low';
      terms: number;
      capacity: number;
      highTerms: number;
      lowTerms: number;
      /** The equation as stored, in galette's notation. */
      stored: string;
    }
  | { ok: false; message: string; needed?: number; capacity: number; highTerms?: number; lowTerms?: number };

export function fitOutput(presetId: string, pin: number, polarity: PolarityChoice): Outcome {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`No preset ${presetId}`);
  try {
    const fit = fitGal22v10Equations(preset.equations, { pins: { Y: pin }, polarity: { Y: polarity } });
    const o = fit.outputs[0]!;
    return { ok: true, polarity: o.polarity, terms: o.terms, capacity: o.capacity, highTerms: o.highTerms, lowTerms: o.lowTerms, stored: `${o.polarity === 'low' ? '/' : ''}Y = ${o.sum}` };
  } catch (e) {
    if (e instanceof GalFitError && e.code === 'too-many-terms') {
      // The message carries both counts: "needs 9 product terms (9 active high, 3 active low)".
      const m = /\((\d+) active high, (\d+) active low\)/.exec(e.message);
      return { ok: false, message: e.message, needed: e.info?.needed, capacity: capacity(pin), highTerms: m ? Number(m[1]) : undefined, lowTerms: m ? Number(m[2]) : undefined };
    }
    throw e;
  }
}
