/**
 * Programming a GAL22V10's fuses from product terms, exactly as galette and GALasm do it.
 *
 * A term is written over pin levels: literal `{ pin, neg }` is the level on that pin, or its
 * complement. A sum is a list of products (OR of ANDs); `[]` is the constant 0 and `[[]]` (one
 * empty product) is the constant 1.
 *
 * Rules (the ones galette's `gal_builder.rs` and `gal.rs` apply for the 22V10):
 * - The array starts with every fuse at 1 (nothing connected). A product connects, for each of its
 *   literals, the true column (fuse 0) or the complement column of the pin. The product-term rows
 *   after the ones a sum uses are cleared to all 0, which connects every column: x·x̄ = 0, the
 *   constant false.
 * - A macrocell with no output has all its rows (OE and product terms) cleared: the pin is not
 *   driven. If some equation uses the pin, S1 is 1 (combinational, so the feedback is the pin
 *   level: the pin works as an input); otherwise S1 is 0.
 * - A macrocell with an output has S0 = 1 for active high and 0 for active low, and S1 = 0 for a
 *   registered output and 1 otherwise. Its OE row is left all 1 (always enabled) unless an enable
 *   term is given.
 * - The feedback of a registered macrocell is the inverted register output, whatever the
 *   polarity, while the pin is Q in active-high mode and Q̄ in active-low mode. A literal that
 *   refers to a registered active-high pin is therefore programmed with its polarity flipped, so
 *   that it means "the level on the pin".
 * - AR and SP are single product terms; when missing their rows are cleared (never true).
 */
import {
  AR_ROW,
  COLUMNS,
  FUSE_COUNT,
  ARRAY_FUSES,
  GND_PIN,
  INPUT_PINS,
  OLMC_PINS,
  SP_ROW,
  VCC_PIN,
  isOlmcPin,
  olmcRows,
  pinColumn,
  s0Fuse,
  s1Fuse,
  setSignature,
} from './gal22v10';

export interface GalLit {
  pin: number;
  /** True for the complement of the pin level. */
  neg: boolean;
}

export type GalProduct = GalLit[];
export type GalSum = GalProduct[];

export const GAL_TRUE: GalSum = [[]];
export const GAL_FALSE: GalSum = [];

export interface OlmcProgram {
  pin: number;
  sum: GalSum;
  registered: boolean;
  /** Pin level = sum (true) or its complement (false). */
  activeHigh: boolean;
  /** Output enable: a sum with at most one product; omitted means always enabled. */
  oe?: GalSum;
  /** Source line of the output equation and of the enable, for error messages. */
  line?: number;
  oeLine?: number;
}

export interface GalProgram {
  outputs: OlmcProgram[];
  ar?: GalSum;
  sp?: GalSum;
  arLine?: number;
  spLine?: number;
  signature?: string | Uint8Array;
  /** Extra OLMC pins to treat as inputs even if no equation uses them. */
  inputPins?: number[];
}

export type GalProgramErrorCode = 'too-many-products' | 'more-than-one-product' | 'bad-power' | 'bad-pin';

export class GalProgramError extends Error {
  constructor(
    readonly code: GalProgramErrorCode,
    message: string,
    readonly line?: number,
    /** For 'too-many-products': the pin, the limit and the number needed. */
    readonly info?: { pin?: number; max?: number; seen?: number },
  ) {
    super(message);
    this.name = 'GalProgramError';
  }
}

function columnFor(pin: number, line: number | undefined): number {
  if (pin === GND_PIN || pin === VCC_PIN) throw new GalProgramError('bad-power', 'use of VCC and GND is not allowed in equations', line);
  if (!(INPUT_PINS as readonly number[]).includes(pin) && !isOlmcPin(pin)) throw new GalProgramError('bad-pin', `pin ${pin} is not an input to the AND array`, line);
  return pinColumn(pin);
}

/** Every OLMC pin some literal in the program refers to. */
export function referencedOlmcPins(p: GalProgram): Set<number> {
  const used = new Set<number>(p.inputPins ?? []);
  const scan = (s: GalSum | undefined) => {
    for (const prod of s ?? []) for (const l of prod) if (isOlmcPin(l.pin)) used.add(l.pin);
  };
  for (const o of p.outputs) {
    scan(o.sum);
    scan(o.oe);
  }
  scan(p.ar);
  scan(p.sp);
  return used;
}

export function programGal22v10(p: GalProgram): Uint8Array {
  const fuses = new Uint8Array(FUSE_COUNT);
  fuses.fill(1, 0, ARRAY_FUSES);
  const byPin = new Map<number, OlmcProgram>();
  for (const o of p.outputs) {
    if (!isOlmcPin(o.pin)) throw new GalProgramError('bad-pin', `pin ${o.pin} cannot be an output`, o.line);
    if (byPin.has(o.pin)) throw new GalProgramError('bad-pin', `output ${o.pin} is defined more than once`, o.line);
    byPin.set(o.pin, o);
  }
  const feedback = referencedOlmcPins(p);
  const needsFlip = (pin: number): boolean => {
    const o = byPin.get(pin);
    return o !== undefined && o.registered && o.activeHigh;
  };

  // Configuration bits.
  for (const pin of OLMC_PINS) {
    const o = byPin.get(pin);
    if (o) {
      fuses[s0Fuse(pin)] = o.activeHigh ? 1 : 0;
      fuses[s1Fuse(pin)] = o.registered ? 0 : 1;
    } else fuses[s1Fuse(pin)] = feedback.has(pin) ? 1 : 0;
  }

  const clear = (from: number, to: number) => fuses.fill(0, from * COLUMNS, to * COLUMNS);

  // Enter a sum into rows [start + offset, start + max), returning the first unused row.
  const enter = (sum: GalSum, start: number, offset: number, max: number, line: number | undefined, pin: number | undefined) => {
    const singleRow = max === offset + 1;
    let off = offset;
    for (const prod of sum) {
      if (off === max) {
        if (singleRow) throw new GalProgramError('more-than-one-product', 'only one product term allowed (no OR)', line);
        throw new GalProgramError('too-many-products', `too many product terms in sum for pin (max: ${max - 1}, saw: ${sum.length})`, line, {
          pin,
          max: max - 1,
          seen: sum.length,
        });
      }
      for (const l of prod) {
        const col = columnFor(l.pin, line) + ((l.neg !== needsFlip(l.pin)) ? 1 : 0);
        fuses[(start + off) * COLUMNS + col] = 0;
      }
      off++;
    }
    clear(start + off, start + max);
  };

  // Galette processes the macrocells from pin 14 up to pin 23.
  for (const pin of [...OLMC_PINS].reverse()) {
    const r = olmcRows(pin);
    const size = r.terms + 1;
    const o = byPin.get(pin);
    if (!o) {
      enter(GAL_FALSE, r.oeRow, 0, size, undefined, pin);
      continue;
    }
    enter(o.sum, r.oeRow, 1, size, o.line, pin);
    if (o.oe) enter(o.oe, r.oeRow, 0, 1, o.oeLine ?? o.line, pin);
  }
  enter(p.ar ?? GAL_FALSE, AR_ROW, 0, 1, p.arLine, undefined);
  enter(p.sp ?? GAL_FALSE, SP_ROW, 0, 1, p.spLine, undefined);
  if (p.signature !== undefined) setSignature(fuses, p.signature);
  return fuses;
}
