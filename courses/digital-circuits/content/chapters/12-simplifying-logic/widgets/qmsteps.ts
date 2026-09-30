/**
 * The Quine–McCluskey stepper: turns the trace of `quineMcCluskey` (rounds, merges, the prime implicant chart,
 * essential selection, dominance, the cyclic core, Petrick's products) into a list of frames, each a step the
 * reader can stop at, with a sentence saying what has just happened.
 */
import { quineMcCluskey, type QmChartStep, type QmImplicant, type QmTrace } from '$lib/pld/twolevel';
import { textOf } from './kmap';

export const NAMES = ['A', 'B', 'C', 'D', 'E', 'F'];

export type Phase = 'list' | 'merge' | 'primes' | 'chart' | 'essential' | 'row-dominance' | 'column-dominance' | 'core' | 'petrick-sums' | 'petrick-multiply' | 'petrick-pick' | 'result';

export interface ChartState {
  /** Primes chosen so far (essential ones, in order). */
  selected: number[];
  /** Rows removed by dominance. */
  removedRows: number[];
  /** Columns removed: covered by a chosen prime, or dominated. */
  removedCols: number[];
}

export interface Frame {
  phase: Phase;
  title: string;
  text: string;
  /** Implicant columns on show: 1 is just the minterms. */
  rounds: number;
  /** The round whose merges this frame is about (index into trace.rounds), for the reveal animation. */
  mergeRound?: number;
  primes: boolean;
  chart: boolean;
  chartState: ChartState;
  /** Rows and columns of the chart to highlight. */
  active: { rows: number[]; cols: number[] };
  /** Petrick: show the sums, and this many multiplication steps (0: only the sums); -1: not shown yet. */
  petrick: number;
  result: boolean;
}

export interface Parsed {
  n: number;
  on: number[];
  dc: number[];
}

/** "0, 1 2;5" → [0, 1, 2, 5]. Returns an error message for anything else. */
export function parseList(text: string, n: number): { ok: true; list: number[] } | { ok: false; why: string } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const out = new Set<number>();
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return { ok: false, why: `“${p}” is not a number.` };
    const v = Number(p);
    if (v >= 2 ** n) return { ok: false, why: `${v} is too big: with ${n} variables the minterms are 0 to ${2 ** n - 1}.` };
    out.add(v);
  }
  return { ok: true, list: [...out].sort((a, b) => a - b) };
}

/** Label of a prime: P1, P2, … in the order the trace lists them. */
export function labels(trace: QmTrace): Map<number, string> {
  return new Map(trace.primes.map((id, i) => [id, `P${i + 1}`]));
}

const plural = (k: number, one: string, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const list = (xs: (number | string)[]) => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function termOf(trace: QmTrace, id: number): string {
  return textOf([trace.implicants[id]!.pattern], 'sop', trace.names);
}

/** The chart after the first `k` chart steps. */
export function chartAfter(trace: QmTrace, k: number): ChartState {
  const st: ChartState = { selected: [], removedRows: [], removedCols: [] };
  for (const step of trace.steps.slice(0, k)) {
    if (step.kind === 'essential') {
      st.selected.push(step.prime);
      st.removedCols.push(...step.covers);
    } else if (step.kind === 'row-dominance') st.removedRows.push(step.removed);
    else if (step.kind === 'column-dominance') st.removedCols.push(step.removed);
  }
  return st;
}

export function buildFrames(trace: QmTrace): Frame[] {
  const L = labels(trace);
  const lab = (id: number) => L.get(id) ?? `#${id}`;
  const frames: Frame[] = [];
  const base = (): Omit<Frame, 'phase' | 'title' | 'text'> => ({ rounds: 1, primes: false, chart: false, chartState: { selected: [], removedRows: [], removedCols: [] }, active: { rows: [], cols: [] }, petrick: -1, result: false });
  const n = trace.n;
  const on = trace.on;
  const dc = trace.dc;

  frames.push({
    ...base(),
    phase: 'list',
    title: 'List the minterms by their number of 1s',
    text: `Write ${plural(on.length + dc.length, 'minterm')} in binary${dc.length ? ` (${on.length} that must be 1 and ${plural(dc.length, 'don’t-care')}, which may be used to make bigger groups but need not be covered)` : ''}, and group them by how many 1s they contain. Two terms can only merge if they differ in exactly one bit, so their counts of 1s differ by exactly one: only neighbouring groups need comparing.`,
  });

  const merging = trace.rounds.filter((r) => r.merges.length > 0);
  merging.forEach((round, i) => {
    const fresh = new Set(round.merges.filter((m) => !m.duplicate).map((m) => m.result));
    frames.push({
      ...base(),
      phase: 'merge',
      title: `Round ${i + 1}: merge terms that differ in one bit`,
      text: `Compare each term with the terms in the next group down. If they differ in exactly one bit, merge them and write a dash in that bit: the new term stands for both. ${plural(round.merges.length, 'pair')} merge${round.merges.length === 1 ? 's' : ''}, giving ${plural(fresh.size, 'new term')}${round.merges.length > fresh.size ? ` (${round.merges.length - fresh.size} of the merges give a term that is already there)` : ''}. A term that merged is ticked: something bigger covers it.`,
      rounds: round.round + 2,
      mergeRound: round.round,
    });
  });

  const nPrimes = trace.primes.length;
  const last = trace.rounds.length;
  frames.push({
    ...base(),
    phase: 'primes',
    title: 'The terms that never merged are the prime implicants',
    text: `No more merges are possible. Every term without a tick is a **prime implicant**: a product term that cannot be made any bigger without covering a 0. There ${nPrimes === 1 ? 'is' : 'are'} ${nPrimes}${trace.implicants.some((im) => trace.primes.includes(im.id) && im.onlyDontCares) ? ' (a prime made only of don’t-cares is of no use, and is left out from here on)' : ''}: ${list(trace.primes.map((p) => `${lab(p)} = ${termOf(trace, p)}`))}.`,
    rounds: last,
    primes: true,
  });

  const chartFrame = (over: Partial<Frame> & Pick<Frame, 'phase' | 'title' | 'text'>): Frame => ({ ...base(), rounds: last, primes: true, chart: true, ...over });
  frames.push(
    chartFrame({
      phase: 'chart',
      title: 'The prime implicant chart',
      text: `Now choose primes so that every minterm that must be 1 is covered. Draw a chart: a row for each prime, a column for each of the ${on.length} required minterms (don’t-cares are not columns), and a dot where a prime covers a minterm.`,
    }),
  );

  const stepsSoFar = (k: number) => chartAfter(trace, k);
  trace.steps.forEach((step: QmChartStep, i) => {
    const before = stepsSoFar(i + 1);
    if (step.kind === 'essential') {
      frames.push(
        chartFrame({
          phase: 'essential',
          title: `${lab(step.prime)} is essential`,
          text: `Minterm${step.because.length === 1 ? '' : 's'} ${list(step.because)} ${step.because.length === 1 ? 'has' : 'have'} a single dot: only ${lab(step.prime)} (${termOf(trace, step.prime)}) covers ${step.because.length === 1 ? 'it' : 'them'}, so ${lab(step.prime)} must be in the answer. Choose it, and cross out the ${plural(step.covers.length, 'column')} it covers (${list(step.covers)}).`,
          chartState: before,
          active: { rows: [step.prime], cols: step.because },
        }),
      );
    } else if (step.kind === 'row-dominance') {
      frames.push(
        chartFrame({
          phase: 'row-dominance',
          title: `${lab(step.by)} dominates ${lab(step.removed)}`,
          text: `${lab(step.by)} covers every remaining minterm that ${lab(step.removed)} covers, and no more expensive: anything ${lab(step.removed)} can do, ${lab(step.by)} does as well. Drop the row of ${lab(step.removed)}.`,
          chartState: before,
          active: { rows: [step.by, step.removed], cols: [] },
        }),
      );
    } else if (step.kind === 'column-dominance') {
      frames.push(
        chartFrame({
          phase: 'column-dominance',
          title: `Minterm ${step.by} implies minterm ${step.removed}`,
          text: `Every prime that covers minterm ${step.by} also covers minterm ${step.removed}, so covering ${step.by} covers ${step.removed} for free. Drop the column of ${step.removed}.`,
          chartState: before,
          active: { rows: [], cols: [step.by, step.removed] },
        }),
      );
    } else {
      frames.push(
        chartFrame({
          phase: 'core',
          title: 'A cyclic core',
          text: `What remains has no essential prime and nothing to drop: every remaining minterm can be covered in at least two ways, so nothing is forced. This is a **cyclic core**, and choosing needs a systematic method: Petrick’s.`,
          chartState: before,
          active: { rows: step.rows, cols: step.cols },
        }),
      );
    }
  });

  const pet = trace.petrick;
  const finalChart = chartAfter(trace, trace.steps.length);
  if (pet) {
    const prod = (ids: number[]) => ids.map(lab).join('·');
    frames.push(
      chartFrame({
        phase: 'petrick-sums',
        title: 'Petrick: one sum for each column',
        text: `Each remaining minterm must be covered by at least one of the primes with a dot in its column: write that as a sum, ${pet.sums.slice(0, 2).map((s) => `(${s.primes.map(lab).join(' + ')})`).join(' and ')}${pet.sums.length > 2 ? ' and so on' : ''}. All the conditions must hold at once, so the answer is their **product**. Multiplying it out gives a sum of products, in which each product is a way to cover everything.`,
        chartState: finalChart,
        active: { rows: pet.rows, cols: pet.cols },
        petrick: 0,
      }),
    );
    pet.steps.forEach((step, i) => {
      frames.push(
        chartFrame({
          phase: 'petrick-multiply',
          title: `Multiply in the column of minterm ${step.minterm}`,
          text: `Multiply by (${step.sum.map(lab).join(' + ')}), then simplify with X + X·Y = X: ${plural(step.count, 'product')} ${step.count === 1 ? 'is' : 'are'} left${step.products ? `: ${step.products.slice(0, 8).map(prod).join(' + ')}${step.products.length > 8 ? ' + …' : ''}` : ' (too many to list)'}.`,
          chartState: finalChart,
          active: { rows: step.sum, cols: [step.minterm] },
          petrick: i + 1,
        }),
      );
    });
    frames.push(
      chartFrame({
        phase: 'petrick-pick',
        title: 'Pick the cheapest product',
        text:
          pet.method === 'petrick'
            ? `Every product is a valid cover. Take one with the fewest primes${pet.minimal.length > 1 ? ` (${pet.minimal.length} tie for fewest: ${pet.minimal.slice(0, 4).map(prod).join(', ')}${pet.minimal.length > 4 ? ', …' : ''}; the tie is broken by fewer literals)` : ''}: ${prod(pet.chosen)}.`
            : `The product grew too large to write out, so the tool solved the covering problem by branch and bound instead${pet.method === 'incomplete' ? ', and ran out of its budget: this answer may not be the smallest' : ' (still exact)'}: ${prod(pet.chosen)}.`,
        chartState: finalChart,
        active: { rows: pet.chosen, cols: [] },
        petrick: pet.steps.length,
      }),
    );
  }

  const cost = { terms: trace.solution.length, literals: trace.solution.reduce((s, id) => s + trace.implicants[id]!.literals, 0) };
  frames.push(
    chartFrame({
      phase: 'result',
      title: 'The minimum cover',
      text: `The chosen primes, ${trace.solution.map(lab).join(', ')}, cover every required minterm. The sum of their product terms is the answer: ${plural(cost.terms, 'term')} and ${plural(cost.literals, 'literal')}. No cover of this function has fewer terms.`,
      chartState: { ...finalChart, selected: trace.solution },
      active: { rows: trace.solution, cols: [] },
      petrick: pet ? pet.steps.length : -1,
      result: true,
    }),
  );
  return frames;
}

export interface Example {
  id: string;
  label: string;
  n: number;
  on: number[];
  dc: number[];
  note: string;
}

export const EXAMPLES: Example[] = [
  { id: 'textbook', label: 'A textbook example', n: 4, on: [4, 8, 10, 11, 12, 15], dc: [9, 14], note: 'Six minterms and two don’t-cares: a typical exam question.' },
  { id: 'cyclic', label: 'A cyclic core', n: 3, on: [0, 1, 2, 5, 6, 7], dc: [], note: 'Six primes, no essential one: Petrick’s method has to choose.' },
  { id: 'seg-a', label: '7-segment a', n: 4, on: [0, 2, 3, 5, 6, 7, 8, 9], dc: [10, 11, 12, 13, 14, 15], note: 'The BCD segment of Chapter 12’s map, with six don’t-cares.' },
  { id: 'five', label: 'Five variables', n: 5, on: [0, 1, 2, 5, 6, 7, 8, 9, 10, 14, 17, 21, 22, 25, 26, 30], dc: [], note: 'Beyond what a Karnaugh map draws comfortably: the algorithm does not care.' },
  { id: 'parity', label: '4-bit parity', n: 4, on: [1, 2, 4, 7, 8, 11, 13, 14], dc: [], note: 'Nothing merges: all eight minterms are primes, and all are essential.' },
];

export function run(n: number, on: number[], dc: number[]) {
  const q = quineMcCluskey(n, on, dc, { names: NAMES.slice(0, n) });
  return { q, frames: buildFrames(q.trace) };
}
