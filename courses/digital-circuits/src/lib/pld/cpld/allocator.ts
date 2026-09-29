/**
 * The product-term allocator of one vCPLD-32 function block.
 *
 * Rules (they are the device's, see `devices/vcpld32-arch.ts`): a block has eight macrocells in a
 * chain; macrocell j owns five term slots; a slot is steered to macrocell j's own OR gate, or one
 * hop up (j + 1) or down (j − 1); nothing is passed on and the chain does not wrap. Macrocell i's
 * OR gate can therefore use slots of i − 1, i and i + 1, at most 15. A macrocell with a
 * product-term output enable spends its slot 4 on the enable, so it owns four usable slots.
 *
 * `allocateTerms` decides, for the number of terms each macrocell needs, which slots go where,
 * using as few borrowed terms as possible (a borrowed term adds a fixed delay, and the neighbour
 * that lends it loses it). It is a transportation problem on a path. Two slots never need to
 * cross between the same pair of neighbours (if i lent to i + 1 and i + 1 lent to i, each could
 * use its own instead), so each of the seven links carries a net flow f in −5…5 (positive: i lends
 * to i + 1, negative: i + 1 lends to i), and a dynamic programme over the chain, with the flow on
 * the previous link as its state, finds the flows of least total |f| such that every macrocell
 * gets its terms and no macrocell gives away more slots than it has:
 *
 *   macrocell i receives  max(f[i−1], 0) + max(−f[i], 0)   from its neighbours and uses
 *   own = need − received  of its own slots, and lends  max(f[i], 0) + max(−f[i−1], 0);
 *   own + lent ≤ capacity.
 *
 * When there is no solution, a left-to-right greedy (take what the left neighbour left over, then
 * your own, then the right neighbour's) says where it runs out, for the error message. Because
 * a demanding output wants idle neighbours, `arrangeFb` also searches over which macrocell each
 * output sits in.
 */
import { MACROCELLS_PER_FB, TERMS_PER_MC, type SteerName } from '../devices/vcpld32-arch';

export interface AllocDemand {
  /** Product terms the macrocell's OR gate must collect. */
  terms: number;
  /** True if the output enable is a product term (it takes slot 4). */
  oe?: boolean;
}

export interface McAllocation {
  mc: number;
  needed: number;
  /** Own slots used by this macrocell's own OR. */
  own: number;
  /** Terms taken from the macrocell below (index − 1), steered up. */
  fromBelow: number;
  /** Terms taken from the macrocell above (index + 1), steered down. */
  fromAbove: number;
  borrowed: number;
  /** Own slots lent to neighbours. */
  lent: number;
  /** Slots that exist for terms (5, or 4 when slot 4 is the output-enable term). */
  capacity: number;
  oeSlot: boolean;
  /** Steering of each of the five slots. */
  steer: SteerName[];
  /** For each of this macrocell's OR terms in order (own, from below, from above): the (macrocell, slot) that supplies it. */
  sources: { mc: number; slot: number }[];
}

export interface FbAllocation {
  ok: true;
  mcs: McAllocation[];
  borrowed: number;
  termsUsed: number;
}

export interface AllocFailure {
  ok: false;
  /** The first macrocell that cannot get what it needs. */
  mc: number;
  needed: number;
  /** Terms it could collect at most given the neighbours' claims so far. */
  available: number;
  shortfall: number;
  message: string;
}

export type AllocResult = FbAllocation | AllocFailure;

export function capacityOf(d: AllocDemand | undefined): number {
  return d?.oe ? TERMS_PER_MC - 1 : TERMS_PER_MC;
}

/** Most terms a single output can have at macrocell `mc` (10 at the ends of the chain, 15 inside; one fewer with a product-term enable). */
export function maxTermsAt(mc: number, oe: boolean): number {
  const cap = oe ? TERMS_PER_MC - 1 : TERMS_PER_MC;
  const neighbours = (mc > 0 ? 1 : 0) + (mc < MACROCELLS_PER_FB - 1 ? 1 : 0);
  return cap + neighbours * TERMS_PER_MC;
}

/** The left-to-right greedy: exact for feasibility; finds where an infeasible demand runs out (null if feasible). */
function greedyShortfall(need: ArrayLike<number>, cap: ArrayLike<number>): { mc: number; wanted: number; available: number; shortfall: number } | null {
  const n = MACROCELLS_PER_FB;
  const left = Array.from(cap);
  for (let i = 0; i < n; i++) {
    let r = need[i]!;
    if (i > 0) {
      const a = Math.min(r, left[i - 1]!);
      left[i - 1] = left[i - 1]! - a;
      r -= a;
    }
    const b = Math.min(r, left[i]!);
    left[i] = left[i]! - b;
    r -= b;
    if (i < n - 1) {
      const c = Math.min(r, left[i + 1]!);
      left[i + 1] = left[i + 1]! - c;
      r -= c;
    }
    if (r > 0) return { mc: i, wanted: need[i]!, available: need[i]! - r, shortfall: r };
  }
  return null;
}

function diagnose(demands: (AllocDemand | undefined)[], cap: number[]): AllocFailure {
  const g = greedyShortfall(demands.map((d) => d?.terms ?? 0), cap);
  if (!g) return { ok: false, mc: 0, needed: 0, available: 0, shortfall: 0, message: 'no allocation exists' };
  return {
    ok: false,
    mc: g.mc,
    needed: g.wanted,
    available: g.available,
    shortfall: g.shortfall,
    message: `macrocell ${g.mc} of the block needs ${g.wanted} product terms but can collect only ${g.available} (its own slots and what its neighbours can spare)`,
  };
}

const MAXF = TERMS_PER_MC;
const W = 2 * MAXF + 1;
const INF = 1e9;
const dpScratch = new Float64Array(MACROCELLS_PER_FB * W);
const fromScratch = new Int8Array(MACROCELLS_PER_FB * W);

/**
 * Least total borrowing for the given needs and capacities, or -1 if there is no allocation. With
 * `flow` given, the link flows (f[i] between macrocells i and i + 1) are stored in it.
 */
function solve(need: ArrayLike<number>, cap: ArrayLike<number>, flow?: number[]): number {
  const n = MACROCELLS_PER_FB;
  let easy = true;
  for (let i = 0; i < n; i++) if (need[i]! > cap[i]!) easy = false;
  if (easy) {
    flow?.fill(0);
    return 0;
  }
  dpScratch.fill(INF);
  for (let i = 0; i < n; i++) {
    const f0 = i === n - 1 ? 0 : -MAXF;
    const f1 = i === n - 1 ? 0 : MAXF;
    const g0 = i === 0 ? 0 : -MAXF;
    const g1 = i === 0 ? 0 : MAXF;
    for (let f = f0; f <= f1; f++) {
      let bestCost = INF;
      let bestFrom = 0;
      const pf = f > 0 ? f : 0;
      const nf = f < 0 ? -f : 0;
      for (let g = g0; g <= g1; g++) {
        const before = i === 0 ? 0 : dpScratch[(i - 1) * W + g + MAXF]!;
        if (before >= INF) continue;
        const own = need[i]! - ((g > 0 ? g : 0) + nf);
        if (own < 0) continue;
        if (own + pf + (g < 0 ? -g : 0) > cap[i]!) continue;
        const cost = before + (f < 0 ? -f : f);
        if (cost < bestCost) {
          bestCost = cost;
          bestFrom = g;
        }
      }
      dpScratch[i * W + f + MAXF] = bestCost;
      fromScratch[i * W + f + MAXF] = bestFrom;
    }
  }
  const total = dpScratch[(n - 1) * W + MAXF]!;
  if (total >= INF) return -1;
  if (flow) {
    let f = 0;
    for (let i = n - 1; i >= 0; i--) {
      flow[i] = f;
      f = fromScratch[i * W + f + MAXF]!;
    }
  }
  return total;
}

export function allocateTerms(demands: (AllocDemand | undefined)[]): AllocResult {
  const n = MACROCELLS_PER_FB;
  const cap = Array.from({ length: n }, (_, j) => capacityOf(demands[j]));
  const d = Array.from({ length: n }, (_, j) => demands[j]?.terms ?? 0);
  const flow = new Array<number>(n).fill(0);
  if (solve(d, cap, flow) < 0) return diagnose(demands, cap);
  const pos = (x: number) => Math.max(x, 0);
  const fromBelow = new Array<number>(n).fill(0);
  const fromAbove = new Array<number>(n).fill(0);
  const own = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    fromBelow[i] = i > 0 ? pos(flow[i - 1]!) : 0;
    fromAbove[i] = i < n - 1 ? pos(-flow[i]!) : 0;
    own[i] = d[i]! - fromBelow[i]! - fromAbove[i]!;
  }
  // Slot numbering of macrocell j: local slots first, then those lent down, then those lent up.
  const mcs: McAllocation[] = [];
  const lentDown = (j: number) => (j > 0 ? fromAbove[j - 1]! : 0); // j's slots used by j − 1 (which took them "from above")
  const lentUp = (j: number) => (j < n - 1 ? fromBelow[j + 1]! : 0); // j's slots used by j + 1 (which took them "from below")
  for (let j = 0; j < n; j++) {
    const steer: SteerName[] = new Array<SteerName>(TERMS_PER_MC).fill('off');
    let s = 0;
    for (let k = 0; k < own[j]!; k++) steer[s++] = 'local';
    for (let k = 0; k < lentDown(j); k++) steer[s++] = 'down';
    for (let k = 0; k < lentUp(j); k++) steer[s++] = 'up';
    mcs.push({
      mc: j,
      needed: demands[j]?.terms ?? 0,
      own: own[j]!,
      fromBelow: fromBelow[j]!,
      fromAbove: fromAbove[j]!,
      borrowed: fromBelow[j]! + fromAbove[j]!,
      lent: lentDown(j) + lentUp(j),
      capacity: cap[j]!,
      oeSlot: !!demands[j]?.oe,
      steer,
      sources: [],
    });
  }
  // Which slot supplies each OR input.
  for (const m of mcs) {
    const j = m.mc;
    for (let k = 0; k < m.own; k++) m.sources.push({ mc: j, slot: k });
    if (j > 0) {
      // Slots of j − 1 steered up, after its local and down slots.
      const below = mcs[j - 1]!;
      const start = below.own + (j - 1 > 0 ? fromAbove[j - 2]! : 0);
      for (let k = 0; k < m.fromBelow; k++) m.sources.push({ mc: j - 1, slot: start + k });
    }
    if (j < n - 1) {
      const above = mcs[j + 1]!;
      const start = above.own;
      for (let k = 0; k < m.fromAbove; k++) m.sources.push({ mc: j + 1, slot: start + k });
    }
  }
  return { ok: true, mcs, borrowed: fromBelow.reduce((a, b) => a + b, 0) + fromAbove.reduce((a, b) => a + b, 0), termsUsed: demands.reduce((s, d) => s + (d?.terms ?? 0) + (d?.oe ? 1 : 0), 0) };
}

// ---------------------------------------------------------------------------------------------
// Which macrocell does each output sit in?

export interface FbMember {
  terms: number;
  oe: boolean;
  /** A buried output does not use its pin; a pin-driving one needs a macrocell whose pad is not reserved as an input. */
  buried: boolean;
  /** Fixed macrocell (0–7), from a pin constraint. */
  mc?: number;
}

export interface Arrangement {
  /** Macrocell (0–7) of each member. */
  positions: number[];
  allocation: FbAllocation;
  borrowed: number;
}

const arrangeCache = new Map<string, Arrangement | null>();

/**
 * Place the outputs of one block into its macrocells so that the product-term allocation
 * succeeds with as little borrowing as possible. `reserved[m]` marks macrocells whose pad is used
 * as an input pin, which only buried outputs may occupy. Outputs are placed in the given order
 * into the lowest free macrocells when that already works; otherwise the arrangement is improved
 * by swaps and moves, and as a last resort by trying every permutation. Returns null if no
 * arrangement works. Results are cached.
 */
export function arrangeFb(members: FbMember[], reserved: boolean[] = []): Arrangement | null {
  const n = MACROCELLS_PER_FB;
  if (members.length > n) return null;
  const key = `${reserved.map((r) => (r ? 1 : 0)).join('')}|${members.map((m) => `${m.terms},${m.oe ? 1 : 0},${m.buried ? 1 : 0},${m.mc ?? '-'}`).join(';')}`;
  const cached = arrangeCache.get(key);
  if (cached !== undefined) return cached;
  const result = arrangeUncached(members, reserved);
  if (arrangeCache.size > 20000) arrangeCache.clear();
  arrangeCache.set(key, result);
  return result;
}

function arrangeUncached(members: FbMember[], reserved: boolean[]): Arrangement | null {
  const n = MACROCELLS_PER_FB;
  // Fixed positions must be valid and distinct.
  const taken = new Array<boolean>(n).fill(false);
  for (const m of members) {
    if (m.mc === undefined) continue;
    if (m.mc < 0 || m.mc >= n || taken[m.mc]) return null;
    if (reserved[m.mc] && !m.buried) return null;
    taken[m.mc] = true;
  }
  const free = [...Array(n).keys()].filter((p) => !taken[p]);
  const movable = members.map((m, i) => ({ m, i })).filter(({ m }) => m.mc === undefined);
  const canSit = (member: FbMember, p: number) => member.buried || !reserved[p];

  const needBuf = new Array<number>(n).fill(0);
  const capBuf = new Array<number>(n).fill(5);
  /** Borrowed terms for a placement, or 1000 + how far short it falls. */
  const cost = (pos: number[]) => {
    needBuf.fill(0);
    capBuf.fill(5);
    members.forEach((m, i) => {
      needBuf[pos[i]!] = m.terms;
      capBuf[pos[i]!] = m.oe ? 4 : 5;
    });
    const borrowed = solve(needBuf, capBuf);
    if (borrowed >= 0) return borrowed;
    return 1000 + (greedyShortfall(needBuf, capBuf)?.shortfall ?? 1);
  };
  const finish = (pos: number[]): Arrangement => {
    const d: (AllocDemand | undefined)[] = new Array(n).fill(undefined);
    members.forEach((m, i) => (d[pos[i]!] = { terms: m.terms, oe: m.oe }));
    const allocation = allocateTerms(d) as FbAllocation;
    return { positions: pos.slice(), allocation, borrowed: allocation.borrowed };
  };

  // Natural placement: fixed ones where they are, the rest in order into the lowest free positions
  // where they may sit.
  const natural = (): number[] | null => {
    const pos = new Array<number>(members.length).fill(-1);
    members.forEach((m, i) => {
      if (m.mc !== undefined) pos[i] = m.mc;
    });
    const avail = free.slice();
    for (const { m, i } of movable) {
      const at = avail.findIndex((p) => canSit(m, p));
      if (at < 0) return null;
      pos[i] = avail.splice(at, 1)[0]!;
    }
    return pos;
  };
  const start = natural();
  if (!start) return null;
  let best = start;
  let bestCost = cost(best);
  if (bestCost === 0) return finish(best);

  // Hill climbing from the natural placement: swap two movable outputs, or move one to a free slot.
  const climb = (init: number[]): { pos: number[]; cost: number } => {
    let pos = init.slice();
    let c = cost(pos);
    for (let round = 0; round < 50 && c > 0; round++) {
      let improved: { pos: number[]; cost: number } | null = null;
      for (let a = 0; a < movable.length; a++) {
        const ia = movable[a]!.i;
        for (let b = a + 1; b < movable.length; b++) {
          const ib = movable[b]!.i;
          if (!canSit(members[ia]!, pos[ib]!) || !canSit(members[ib]!, pos[ia]!)) continue;
          const t = pos.slice();
          [t[ia], t[ib]] = [t[ib]!, t[ia]!];
          const tc = cost(t);
          if (tc < (improved?.cost ?? c)) improved = { pos: t, cost: tc };
        }
        const used = new Set(pos);
        for (const p of free) {
          if (used.has(p) || !canSit(members[ia]!, p)) continue;
          const t = pos.slice();
          t[ia] = p;
          const tc = cost(t);
          if (tc < (improved?.cost ?? c)) improved = { pos: t, cost: tc };
        }
      }
      if (!improved) break;
      pos = improved.pos;
      c = improved.cost;
    }
    return { pos, cost: c };
  };
  const climbed = climb(start);
  if (climbed.cost < bestCost) {
    best = climbed.pos;
    bestCost = climbed.cost;
  }
  // Heavy outputs on positions with the most spare neighbours: a second start with the movable
  // outputs sorted by decreasing demand into the positions ordered from the middle outwards.
  const middleOut = free.slice().sort((a, b) => Math.abs(a - 3.5) - Math.abs(b - 3.5) || a - b);
  {
    const pos = start.slice();
    const avail = middleOut.slice();
    for (const { m, i } of movable.slice().sort((a, b) => b.m.terms - a.m.terms || a.i - b.i)) {
      const at = avail.findIndex((p) => canSit(m, p));
      if (at >= 0) pos[i] = avail.splice(at, 1)[0]!;
    }
    if (new Set(pos).size === pos.length) {
      const r = climb(pos);
      if (r.cost < bestCost) {
        best = r.pos;
        bestCost = r.cost;
      }
    }
  }
  if (bestCost < 1000) return finish(best);

  // Exhaustive search over the placements of the movable outputs.
  let found: number[] | null = null;
  let foundCost = Infinity;
  const pos = start.slice();
  const usedPos = new Set<number>(members.filter((m) => m.mc !== undefined).map((m) => m.mc!));
  const rec = (k: number) => {
    if (foundCost === 0) return;
    if (k === movable.length) {
      const c = cost(pos);
      if (c < foundCost) {
        foundCost = c;
        found = pos.slice();
      }
      return;
    }
    const { m, i } = movable[k]!;
    for (const p of free) {
      if (usedPos.has(p) || !canSit(m, p)) continue;
      usedPos.add(p);
      pos[i] = p;
      rec(k + 1);
      usedPos.delete(p);
    }
  };
  rec(0);
  if (found && foundCost < 1000) return finish(found);
  return null;
}
