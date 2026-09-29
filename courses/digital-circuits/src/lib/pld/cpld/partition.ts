/**
 * Partitioning: which function block does each output go to?
 *
 * Every block can look at only 24 signals through the global interconnect matrix, so an output
 * (with its output-enable term) is a set of the signals it reads, and a block needs the union of
 * the sets of its outputs. The partition also has to leave room: at most eight outputs per block,
 * and the block's product-term allocation (`arrangeFb`) has to succeed. The objective is
 *
 *   cost = Σ over blocks ( distinct inputs + 0.5 × borrowed terms
 *                          + 100 × inputs beyond 24 + 1000 if the block cannot be allocated )
 *
 * so a partition with no violations has the fewest total block inputs (fewer signals through the
 * interconnect, and fewer places for a routing surprise) and little borrowing (each borrowed term
 * adds a fixed delay), while a violation is expensive enough to drive the search out of it.
 *
 * Algorithm:
 *
 * 1. Greedy construction. Outputs with a fixed block (pin constraint) go where they must. The rest,
 *    largest support first, go to the block where the cost increases least, that is, the block
 *    that already reads most of the signals the output reads.
 * 2. Kernighan–Lin-style refinement. A pass repeatedly picks the best move of one unlocked output
 *    to another block, or swap of two unlocked outputs in different blocks (swaps keep full
 *    blocks full), even when its gain is negative, applies it, and locks the moved outputs. When
 *    everything is locked, the pass is rolled back to the prefix of moves with the greatest total
 *    gain. Passes repeat until one gains nothing. Accepting temporarily worse moves is what lets
 *    the search escape the local minima of plain hill climbing; the penalties make it repair
 *    infeasible starts. The algorithm is deterministic.
 */
import { FB_INPUTS, FUNCTION_BLOCKS, MACROCELLS_PER_FB } from '../devices/vcpld32-arch';
import { arrangeFb, type Arrangement, type FbMember } from './allocator';

export interface PartItem {
  /** Signals the output reads (ids are arbitrary integers; a block needs their union). */
  support: number[];
  /** Product terms in the OR gate. */
  terms: number;
  /** The output enable is a product term. */
  oe: boolean;
  buried: boolean;
  /** Fixed function block, from a pin constraint. */
  fb?: number;
  /** Fixed macrocell within the block. */
  mc?: number;
}

export interface PartOptions {
  fbs?: number;
  inputLimit?: number;
  /** Per block, macrocells (0–7) whose pad is a pinned input: only buried outputs may sit there. */
  reserved?: boolean[][];
  maxPasses?: number;
  /** Cost of one borrowed product term (default 0.5, in units of one block input). */
  borrowWeight?: number;
}

export interface PartProblem {
  fb: number;
  kind: 'inputs' | 'terms' | 'members';
  inputs: number;
  members: number;
  /** Product terms (including output-enable terms) wanted in the block. */
  termLoad: number;
}

export interface PartResult {
  /** Block of each item. */
  fbOf: number[];
  /** Items of each block, ascending. */
  members: number[][];
  /** Distinct inputs each block needs. */
  inputs: number[];
  /** The macrocell arrangement of each block (null if it cannot be allocated). */
  arrangements: (Arrangement | null)[];
  feasible: boolean;
  problems: PartProblem[];
  stats: {
    initialCost: number;
    finalCost: number;
    initialInputs: number;
    finalInputs: number;
    passes: number;
    moves: number;
  };
}

const INPUT_PENALTY = 100;
const ALLOC_PENALTY = 1000;

export function partition(items: PartItem[], opts: PartOptions = {}): PartResult {
  const fbs = opts.fbs ?? FUNCTION_BLOCKS;
  const limit = opts.inputLimit ?? FB_INPUTS;
  const borrowWeight = opts.borrowWeight ?? 0.5;
  const reserved = opts.reserved ?? [];
  const maxPasses = opts.maxPasses ?? 12;
  const N = items.length;
  if (N > 32) throw new Error('partition handles at most 32 outputs (the device has 32 macrocells)');

  // A block's contents are a bit mask over the items; costs are memoised per (block, mask).
  const memo = new Map<number, { cost: number; inputs: number; arrangement: Arrangement | null; problem: PartProblem['kind'] | null; termLoad: number }>();
  const idsOf = (mask: number): number[] => {
    const ids: number[] = [];
    for (let i = 0; i < N; i++) if ((mask >>> i) & 1) ids.push(i);
    return ids;
  };
  const evalFb = (fb: number, mask: number) => {
    const key = fb * 4294967296 + (mask >>> 0);
    let r = memo.get(key);
    if (r) return r;
    const ids = idsOf(mask);
    const set = new Set<number>();
    let termLoad = 0;
    for (const i of ids) {
      for (const s of items[i]!.support) set.add(s);
      termLoad += items[i]!.terms + (items[i]!.oe ? 1 : 0);
    }
    const inputs = set.size;
    let cost = inputs;
    let problem: PartProblem['kind'] | null = null;
    let arrangement: Arrangement | null = null;
    if (inputs > limit) {
      cost += INPUT_PENALTY * (inputs - limit);
      problem = 'inputs';
    }
    if (ids.length > MACROCELLS_PER_FB) {
      cost += ALLOC_PENALTY * (ids.length - MACROCELLS_PER_FB);
      problem ??= 'members';
    } else if (termLoad > MACROCELLS_PER_FB * 5) {
      // More terms than the block has slots: hopeless, and not worth a search.
      cost += ALLOC_PENALTY + (termLoad - MACROCELLS_PER_FB * 5);
      problem ??= 'terms';
    } else {
      const members: FbMember[] = ids.map((i) => ({ terms: items[i]!.terms, oe: items[i]!.oe, buried: items[i]!.buried, mc: items[i]!.mc }));
      arrangement = arrangeFb(members, reserved[fb]);
      if (arrangement) cost += borrowWeight * arrangement.borrowed;
      else {
        cost += ALLOC_PENALTY + Math.max(0, termLoad - MACROCELLS_PER_FB * 5);
        problem ??= 'terms';
      }
    }
    r = { cost, inputs, arrangement, problem, termLoad };
    if (memo.size > 400000) memo.clear();
    memo.set(key, r);
    return r;
  };

  const fbOf = new Array<number>(N).fill(-1);
  const masks = new Array<number>(fbs).fill(0);
  const bit = (i: number) => (1 << i) >>> 0;
  const insert = (fb: number, i: number) => {
    masks[fb] = (masks[fb]! | bit(i)) >>> 0;
    fbOf[i] = fb;
  };
  const remove = (fb: number, i: number) => {
    masks[fb] = (masks[fb]! & ~bit(i)) >>> 0;
    fbOf[i] = -1;
  };
  const count = (mask: number) => idsOf(mask).length;
  const total = () => masks.reduce((s, m, fb) => s + evalFb(fb, m).cost, 0);
  const totalInputs = () => masks.reduce((s, m, fb) => s + evalFb(fb, m).inputs, 0);

  // -- 1. Greedy construction ------------------------------------------------------------------
  const order = [...Array(N).keys()].sort((a, b) => {
    const fa = items[a]!.fb !== undefined ? 0 : 1;
    const fb2 = items[b]!.fb !== undefined ? 0 : 1;
    return fa - fb2 || items[b]!.support.length - items[a]!.support.length || items[b]!.terms - items[a]!.terms || a - b;
  });
  for (const i of order) {
    const fixed = items[i]!.fb;
    if (fixed !== undefined) {
      insert(fixed, i);
      continue;
    }
    let best = -1;
    let bestDelta = Infinity;
    let bestCount = Infinity;
    for (let fb = 0; fb < fbs; fb++) {
      const delta = evalFb(fb, masks[fb]! | bit(i)).cost - evalFb(fb, masks[fb]!).cost;
      const c = count(masks[fb]!);
      if (delta < bestDelta - 1e-9 || (Math.abs(delta - bestDelta) <= 1e-9 && c < bestCount)) {
        bestDelta = delta;
        bestCount = c;
        best = fb;
      }
    }
    insert(best, i);
  }
  const initialCost = total();
  const initialInputs = totalInputs();

  // -- 2. Kernighan–Lin refinement ---------------------------------------------------------------
  const movable = [...Array(N).keys()].filter((i) => items[i]!.fb === undefined);
  let passes = 0;
  let movesApplied = 0;
  type Op = { i: number; from: number; to: number; j?: number };
  for (; passes < maxPasses; passes++) {
    const locked = new Set<number>();
    const history: Op[] = [];
    let cum = 0;
    let bestCum = 0;
    let bestLen = 0;
    for (;;) {
      let bestGain = -Infinity;
      let bestOp: Op | null = null;
      const base = masks.map((m, fb) => evalFb(fb, m).cost);
      const sizes = masks.map(count);
      for (const i of movable) {
        if (locked.has(i)) continue;
        const a = fbOf[i]!;
        const maskA = (masks[a]! & ~bit(i)) >>> 0;
        const costAWithout = evalFb(a, maskA).cost;
        for (let b = 0; b < fbs; b++) {
          if (b === a) continue;
          // Single move.
          if (sizes[b]! < MACROCELLS_PER_FB) {
            const gain = base[a]! + base[b]! - costAWithout - evalFb(b, masks[b]! | bit(i)).cost;
            if (gain > bestGain + 1e-9) {
              bestGain = gain;
              bestOp = { i, from: a, to: b };
            }
          }
          // Swaps with each unlocked output of block b.
          for (const j of idsOf(masks[b]!)) {
            if (locked.has(j) || items[j]!.fb !== undefined || j < i) continue;
            const gain = base[a]! + base[b]! - evalFb(a, maskA | bit(j)).cost - evalFb(b, (masks[b]! & ~bit(j)) | bit(i)).cost;
            if (gain > bestGain + 1e-9) {
              bestGain = gain;
              bestOp = { i, from: a, to: b, j };
            }
          }
        }
      }
      if (!bestOp) break;
      const { i, from, to, j } = bestOp;
      remove(from, i);
      if (j !== undefined) {
        remove(to, j);
        insert(from, j);
        locked.add(j);
      }
      insert(to, i);
      locked.add(i);
      history.push(bestOp);
      cum += bestGain;
      if (cum > bestCum + 1e-9) {
        bestCum = cum;
        bestLen = history.length;
      }
    }
    // Roll back to the best prefix.
    for (let k = history.length - 1; k >= bestLen; k--) {
      const { i, from, to, j } = history[k]!;
      remove(to, i);
      if (j !== undefined) {
        remove(from, j);
        insert(to, j);
      }
      insert(from, i);
    }
    movesApplied += bestLen;
    if (bestCum <= 1e-9) break;
  }
  passes = Math.min(passes + 1, maxPasses);

  // -- Result ----------------------------------------------------------------------------------------
  const members = masks.map(idsOf);
  const info = masks.map((m, fb) => evalFb(fb, m));
  const problems: PartProblem[] = [];
  info.forEach((r, fb) => {
    if (r.problem) problems.push({ fb, kind: r.problem, inputs: r.inputs, members: members[fb]!.length, termLoad: r.termLoad });
  });
  return {
    fbOf,
    members,
    inputs: info.map((r) => r.inputs),
    arrangements: info.map((r) => r.arrangement),
    feasible: problems.length === 0,
    problems,
    stats: { initialCost, finalCost: total(), initialInputs, finalInputs: totalInputs(), passes, moves: movesApplied },
  };
}
