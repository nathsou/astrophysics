/**
 * The seven-segment decoder: which segments each hexadecimal digit lights, the minimised equation of each
 * segment (with the six unused codes 10–15 either shown as the letters A–F or treated as don't-cares, as
 * for a decimal display), and the gate network of a segment.
 *
 * The digit table is the one the parts bin's `seg7` part is checked against (`SEG7` in partsbin/refs.ts):
 * bit s of SEG7[d] is segment a…g for s = 0…6, and the digits 6, 7 and 9 have their tails (segments a, a b c
 * and a b c d f g). The input bits are called D3 (the most significant) to D0, so the row number of a truth
 * table is the digit itself, and D3 is the first variable of the minimiser.
 */
import { ONE, ZERO, coverFromMinterms, getVar, minimiseMulti, quineMcCluskey } from '$lib/pld/twolevel';
import { SEG7, SEG_NAMES } from '$lib/partsbin/refs';
import { twoLevelDag, type Lit } from '../../11-boolean-algebra/widgets/synth';
import type { Dag } from '../../11-boolean-algebra/widgets/layout';

export { SEG_NAMES };

/** hex: all sixteen digits are shown. bcd: the codes 10–15 never occur, so the minimiser may use them freely. */
export type SegMode = 'hex' | 'bcd';

export const INPUTS = ['D3', 'D2', 'D1', 'D0'];
export const HEX = '0123456789ABCDEF'.split('');
export const DC_CODES = [10, 11, 12, 13, 14, 15];

/** Is segment s (0 = a … 6 = g) lit for this digit? */
export const segmentLit = (digit: number, s: number): 0 | 1 => ((SEG7[digit]! >> s) & 1) as 0 | 1;

/** The digits that light segment s. */
export const litDigits = (s: number, upTo = 16): number[] => Array.from({ length: upTo }, (_, d) => d).filter((d) => segmentLit(d, s));

/** The bit mask of the segments of a digit (a = bit 0), the format of the `seven-seg` element's state. */
export const segmentMask = (digit: number): number => SEG7[digit]!;

export interface SegEquation {
  segment: number;
  name: string;
  /** The digits that light it (in bcd mode only 0–9). */
  on: number[];
  dc: number[];
  terms: Lit[][];
  /** Constant function, if it is one. */
  constant?: '0' | '1';
  text: string;
  literals: number;
}

const termText = (t: Lit[]): string => t.map((l) => (l.neg ? '¬' : '') + INPUTS[l.v]).join('·');
export const termsText = (terms: Lit[][]): string => (terms.length === 0 ? '0' : terms.length === 1 && terms[0]!.length === 0 ? '1' : terms.map(termText).join(' + '));

function litsOf(c: Parameters<typeof getVar>[0]): Lit[] {
  const out: Lit[] = [];
  for (let v = 0; v < 4; v++) {
    const f = getVar(c, v);
    if (f === ONE) out.push({ v, neg: false });
    else if (f === ZERO) out.push({ v, neg: true });
  }
  return out;
}

const cache = new Map<string, SegEquation>();

/** The minimal sum of products of segment s. */
export function segmentEquation(s: number, mode: SegMode): SegEquation {
  const key = `${mode}${s}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const dc = mode === 'bcd' ? DC_CODES : [];
  const on = litDigits(s, mode === 'bcd' ? 10 : 16);
  let terms: Lit[][];
  let constant: '0' | '1' | undefined;
  if (on.length === 0) {
    terms = [];
    constant = '0';
  } else {
    terms = quineMcCluskey(4, on, dc, { names: INPUTS }).cover.cubes.map(litsOf);
    if (terms.some((t) => t.length === 0)) {
      terms = [[]];
      constant = '1';
    }
  }
  const eq: SegEquation = { segment: s, name: SEG_NAMES[s]!, on, dc, terms, constant, text: termsText(terms), literals: terms.reduce((a, t) => a + t.length, 0) };
  cache.set(key, eq);
  return eq;
}

export const allEquations = (mode: SegMode): SegEquation[] => SEG_NAMES.map((_, s) => segmentEquation(s, mode));

/** The value of a sum of products for a digit (D3 is the top bit). */
export function evalTerms(terms: Lit[][], digit: number): 0 | 1 {
  const bit = (v: number) => (digit >> (3 - v)) & 1;
  return terms.some((t) => t.every((l) => (bit(l.v) === 1) !== l.neg)) ? 1 : 0;
}

/** The segments the minimised equations light for a digit, as a mask (a = bit 0). */
export function decoded(digit: number, mode: SegMode): number {
  return allEquations(mode).reduce((m, e, s) => m | (evalTerms(e.terms, digit) << s), 0);
}

/** The gate network of one segment: inverters, an AND per term and an OR. */
export function segmentDag(s: number, mode: SegMode): Dag {
  const e = segmentEquation(s, mode);
  return twoLevelDag(4, INPUTS, e.terms, 'or', 4, e.name);
}

export interface SharedCost {
  /** Distinct product terms over all seven segments. */
  terms: number;
  /** Literals in those distinct terms. */
  literals: number;
  /** Product terms summed over the segments, counting a shared term once per segment. */
  termUses: number;
  /** Segments that need an OR gate (two terms or more). */
  ors: number;
  /** Inverters (each complemented input once) plus one AND per multi-literal term plus the ORs. */
  gates: number;
}

/** What the seven equations cost when equal product terms are built once and shared. */
export function sharedCost(mode: SegMode): SharedCost {
  const eqs = allEquations(mode);
  const distinct = new Map<string, Lit[]>();
  let termUses = 0;
  for (const e of eqs)
    for (const t of e.terms) {
      termUses++;
      distinct.set(termText(t), t);
    }
  const negated = new Set<number>();
  let ands = 0;
  let literals = 0;
  for (const t of distinct.values()) {
    literals += t.length;
    for (const l of t) if (l.neg) negated.add(l.v);
    if (t.length > 1) ands++;
  }
  const ors = eqs.filter((e) => e.terms.length > 1).length;
  return { terms: distinct.size, literals, termUses, ors, gates: negated.size + ands + ors };
}

// ── Sharing product terms across the seven segments ────────────────────────────

export interface SharedTerm {
  lits: Lit[];
  /** Segments (0 = a … 6 = g) that use the term. */
  segments: number[];
}

export interface SharedNetwork {
  terms: SharedTerm[];
  /** Inverters, one per complemented input that some term uses. */
  inverters: number;
  ands: number;
  ors: number;
  gates: number;
  literals: number;
}

const multiCache = new Map<SegMode, SharedNetwork>();

/** The widest gate the catalog offers. */
export const MAX_FAN_IN = 8;
/** OR gates needed to join `k` signals with gates of at most eight inputs. */
export const orGates = (k: number): number => (k <= 1 ? 0 : Math.ceil((k - 1) / (MAX_FAN_IN - 1)));

/**
 * The seven segments minimised together (Chapter 12's multi-output minimisation, as in a PLA): product terms
 * that several segments need are built once. Fewer gates than minimising each segment alone.
 */
export function sharedNetwork(mode: SegMode): SharedNetwork {
  const hit = multiCache.get(mode);
  if (hit) return hit;
  const upTo = mode === 'bcd' ? 10 : 16;
  const on = SEG_NAMES.map((_, s) => coverFromMinterms(4, litDigits(s, upTo)));
  const dc = SEG_NAMES.map(() => coverFromMinterms(4, mode === 'bcd' ? DC_CODES : []));
  const r = minimiseMulti({ n: 4, on, dc });
  const terms: SharedTerm[] = r.terms.map((t) => ({ lits: litsOf(t.cube), segments: t.outputs }));
  const negated = new Set<number>();
  for (const t of terms) for (const l of t.lits) if (l.neg) negated.add(l.v);
  const ands = terms.filter((t) => t.lits.length > 1).length;
  // An OR gate has at most eight inputs, so a segment with more terms needs a second gate.
  const ors = SEG_NAMES.reduce((sum, _, s) => sum + orGates(terms.filter((t) => t.segments.includes(s)).length), 0);
  const net = { terms, inverters: negated.size, ands, ors, gates: negated.size + ands + ors, literals: terms.reduce((a, t) => a + t.lits.length, 0) };
  multiCache.set(mode, net);
  return net;
}

/** The whole decoder as a gate network (inputs D3…D0, outputs a…g) with shared product terms. */
export function sharedDag(mode: SegMode, inputNames = INPUTS): Dag {
  const net = sharedNetwork(mode);
  const gates: Dag['gates'] = [];
  const inv = new Map<number, string>();
  const lit = (l: Lit): string => {
    if (!l.neg) return inputNames[l.v]!;
    if (!inv.has(l.v)) {
      inv.set(l.v, `n${l.v}`);
      gates.push({ id: `n${l.v}`, kind: 'not', inputs: [inputNames[l.v]!] });
    }
    return inv.get(l.v)!;
  };
  const signal = net.terms.map((t, i) => {
    if (t.lits.length === 1) return lit(t.lits[0]!);
    const id = `t${i}`;
    gates.push({ id, kind: 'and', inputs: t.lits.map(lit) });
    return id;
  });
  const outputs = SEG_NAMES.map((name, s) => {
    let mine = net.terms.flatMap((t, i) => (t.segments.includes(s) ? [signal[i]!] : []));
    if (mine.length === 1) return { name, signal: mine[0]! };
    let part = 0;
    // A gate has at most eight inputs: join the first eight, then carry the result on.
    while (mine.length > MAX_FAN_IN) {
      const id = `o${s}_${part++}`;
      gates.push({ id, kind: 'or', inputs: mine.slice(0, MAX_FAN_IN) });
      mine = [id, ...mine.slice(MAX_FAN_IN)];
    }
    gates.push({ id: `o${s}`, kind: 'or', inputs: mine });
    return { name, signal: `o${s}` };
  });
  return { inputs: inputNames, gates, outputs };
}
