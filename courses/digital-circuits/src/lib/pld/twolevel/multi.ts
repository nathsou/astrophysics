/**
 * Multi-output minimisation with shared product terms, for the PLA (whose AND plane is shared by
 * every output through the OR plane).
 *
 * A multi-output term is a cube plus the set of outputs that use it. The cost is the number of
 * terms (the AND plane's rows are the scarce resource), then the number of literals, then the
 * number of OR-plane connections. The heuristic follows the multi-output primes of the classical
 * Quine–McCluskey extension without enumerating all of them:
 *
 *   1. minimise every output alone (exact for few variables, Espresso otherwise);
 *   2. add the pairwise intersections of the cubes of different outputs (a cube that implies two
 *      functions is the intersection of two of their primes), expand each against the union of the
 *      off-sets of the outputs it can serve, and record, for every cube, all outputs it implies;
 *   3. drop redundant terms from that pool, trying several orders and keeping the cheapest result;
 *   4. finally remove OR-plane connections that no output needs.
 *
 * The result is never worse than the independent covers with identical cubes merged, because that
 * is one of the candidates.
 */
import {
  compareCost,
  contains,
  cubeKey,
  intersectOrNull,
  literalCount,
  scc,
  type Cover,
  type Cube,
} from './cube';
import { expandCube } from './espresso';
import { minimise, type MinimiseOptions, type Polarity } from './minimise';
import { complement, coveredBy } from './unate';

/** A multi-output function: per output an on-set and a don't-care set, all over `n` variables. */
export interface MultiSpec {
  n: number;
  on: Cover[];
  dc?: Cover[];
}

export interface MultiTerm {
  cube: Cube;
  /** Indices of the outputs whose OR includes this term (ascending). */
  outputs: number[];
}

export interface MultiCost {
  terms: number;
  literals: number;
  connections: number;
}

export interface MultiCover {
  n: number;
  m: number;
  terms: MultiTerm[];
  /** The cover of each output: the cubes of the terms that serve it. */
  covers: Cover[];
  cost: MultiCost;
}

export interface MultiOptions extends MinimiseOptions {
  /** Cap on the size of the candidate pool (default 400). */
  poolLimit?: number;
}

export function multiCost(terms: MultiTerm[], n: number): MultiCost {
  let literals = 0;
  let connections = 0;
  for (const t of terms) {
    literals += literalCount(t.cube, n);
    connections += t.outputs.length;
  }
  return { terms: terms.length, literals, connections };
}

export function compareMultiCost(a: MultiCost, b: MultiCost): number {
  return a.terms - b.terms || a.literals - b.literals || a.connections - b.connections;
}

function coversOf(terms: MultiTerm[], n: number, m: number): Cover[] {
  return Array.from({ length: m }, (_, j) => ({ n, cubes: terms.filter((t) => t.outputs.includes(j)).map((t) => t.cube) }));
}

/** True if the terms implement the multi-output function (on ⊆ cover ⊆ on ∪ dc, per output). */
export function multiImplements(terms: MultiTerm[], spec: MultiSpec): boolean {
  const { n } = spec;
  const m = spec.on.length;
  for (let j = 0; j < m; j++) {
    const D = spec.dc?.[j]?.cubes ?? [];
    const mine = terms.filter((t) => t.outputs.includes(j)).map((t) => t.cube);
    for (const o of spec.on[j]!.cubes) if (!coveredBy(o, [...mine, ...D], n)) return false;
    const allowed = [...spec.on[j]!.cubes, ...D];
    for (const c of mine) if (!coveredBy(c, allowed, n)) return false;
  }
  return true;
}

interface Pool {
  cube: Cube;
  outs: number[];
}

/** The off-set of an output: the complement of on ∪ dc. */
function offSetOf(spec: MultiSpec, j: number): Cube[] {
  return complement([...spec.on[j]!.cubes, ...(spec.dc?.[j]?.cubes ?? [])], spec.n);
}

/** Minimise a multi-output function with shared terms. Every output is minimised as given. */
export function minimiseMulti(spec: MultiSpec, opts: MultiOptions = {}): MultiCover {
  const n = spec.n;
  const m = spec.on.length;
  const dc = (j: number) => spec.dc?.[j]?.cubes ?? [];
  const on = spec.on.map((c) => scc(c.cubes, n));
  const off = spec.on.map((_, j) => offSetOf(spec, j));
  const allowed = spec.on.map((_, j) => [...on[j]!, ...dc(j)]);

  // 1. Independent covers.
  const single: Cube[][] = spec.on.map((c, j) => (on[j]!.length === 0 ? [] : minimise(c, spec.dc?.[j], opts).cubes));

  const outsOf = (c: Cube): number[] => {
    const r: number[] = [];
    for (let j = 0; j < m; j++) if (on[j]!.length > 0 && coveredBy(c, allowed[j]!, n)) r.push(j);
    return r;
  };

  // Baseline: identical cubes merged.
  const baseMap = new Map<string, MultiTerm>();
  single.forEach((cubes, j) => {
    for (const c of cubes) {
      const k = cubeKey(c);
      const t = baseMap.get(k);
      if (t) t.outputs.push(j);
      else baseMap.set(k, { cube: c, outputs: [j] });
    }
  });
  let best: MultiTerm[] = [...baseMap.values()];
  let bestCost = multiCost(best, n);
  if (m > 1 && best.length > 1) {
    // 2. Candidate pool.
    const pool = new Map<string, Pool>();
    const add = (c: Cube, outs: number[]) => {
      const k = cubeKey(c);
      const have = pool.get(k);
      if (!have) pool.set(k, { cube: c, outs });
    };
    for (const c of single.flat()) add(c, outsOf(c));
    const limit = opts.poolLimit ?? 400;
    const shared: Pool[] = [];
    for (let a = 0; a < m; a++)
      for (let b = a + 1; b < m; b++)
        for (const x of single[a]!)
          for (const y of single[b]!) {
            const z = intersectOrNull(x, y, n);
            if (!z || pool.has(cubeKey(z))) continue;
            const outs = outsOf(z);
            if (outs.length >= 2) shared.push({ cube: z, outs });
          }
    shared.sort((p, q) => q.outs.length - p.outs.length || literalCount(p.cube, n) - literalCount(q.cube, n));
    for (const p of shared.slice(0, Math.max(0, limit - pool.size))) {
      add(p.cube, p.outs);
      // Expand against every output it serves.
      const R = p.outs.flatMap((j) => off[j]!);
      const e = R.length ? expandCube(p.cube, [], R, n) : p.cube;
      if (!contains(p.cube, e) || cubeKey(e) === cubeKey(p.cube)) continue;
      add(e, outsOf(e));
    }
    // Absorb pool cubes that another cube contains while serving at least the same outputs.
    const entries = [...pool.values()];
    const live = entries.filter(
      (p, i) => !entries.some((q, k) => k !== i && contains(q.cube, p.cube) && p.outs.every((j) => q.outs.includes(j)) && (cubeKey(q.cube) !== cubeKey(p.cube) || k < i)),
    );

    // 3. Irredundant selections from the pool, in several orders.
    const orders: ((a: Pool, b: Pool) => number)[] = [
      (a, b) => a.outs.length - b.outs.length || literalCount(b.cube, n) - literalCount(a.cube, n),
      (a, b) => literalCount(b.cube, n) - literalCount(a.cube, n) || a.outs.length - b.outs.length,
      (a, b) => literalCount(a.cube, n) - literalCount(b.cube, n) || a.outs.length - b.outs.length,
      (a, b) => a.outs.length - b.outs.length || literalCount(a.cube, n) - literalCount(b.cube, n),
    ];
    for (const order of orders) {
      const sel = selectIrredundant(live, order, on, dc, n);
      const terms = sel.map((p) => ({ cube: p.cube, outputs: p.outs.slice() }));
      const cost = multiCost(terms, n);
      if (compareMultiCost(cost, bestCost) < 0) {
        best = terms;
        bestCost = cost;
      }
    }
  }

  // 4. Trim OR-plane connections.
  best = trimConnections(best, on, dc, n);
  best.sort((a, b) => (a.outputs[0] ?? 0) - (b.outputs[0] ?? 0) || cubeKey(a.cube).localeCompare(cubeKey(b.cube)));
  return { n, m, terms: best, covers: coversOf(best, n, m), cost: multiCost(best, n) };
}

/** Is on[j] covered by the given cubes plus dc[j]? Only the on-cubes that meet `region` matter. */
function stillCovers(on: Cube[], D: Cube[], rest: Cube[], region: Cube, n: number): boolean {
  const F = [...rest, ...D];
  for (const o of on) {
    const x = intersectOrNull(o, region, n);
    if (x && !coveredBy(x, F, n)) return false;
  }
  return true;
}

function selectIrredundant(
  candidates: Pool[],
  order: (a: Pool, b: Pool) => number,
  on: Cube[][],
  dc: (j: number) => Cube[],
  n: number,
): Pool[] {
  const sel = candidates.slice().sort(order);
  // sel[i] is dropped when every output it serves is still covered without it.
  const keep = new Uint8Array(sel.length).fill(1);
  for (let i = 0; i < sel.length; i++) {
    let ok = true;
    for (const j of sel[i]!.outs) {
      const rest: Cube[] = [];
      for (let k = 0; k < sel.length; k++) if (k !== i && keep[k] && sel[k]!.outs.includes(j)) rest.push(sel[k]!.cube);
      if (!stillCovers(on[j]!, dc(j), rest, sel[i]!.cube, n)) {
        ok = false;
        break;
      }
    }
    if (ok) keep[i] = 0;
  }
  return sel.filter((_, i) => keep[i]);
}

/** Remove (term, output) connections that leave every output covered. */
function trimConnections(terms: MultiTerm[], on: Cube[][], dc: (j: number) => Cube[], n: number): MultiTerm[] {
  const out = terms.map((t) => ({ cube: t.cube, outputs: t.outputs.slice() }));
  // Try the least useful connections first: terms with the most outputs are trimmed first.
  const idx = out.map((_, i) => i).sort((a, b) => out[b]!.outputs.length - out[a]!.outputs.length);
  for (const i of idx) {
    for (const j of out[i]!.outputs.slice()) {
      const rest: Cube[] = [];
      out.forEach((t, k) => {
        if (k !== i && t.outputs.includes(j)) rest.push(t.cube);
      });
      if (stillCovers(on[j]!, dc(j), rest, out[i]!.cube, n)) out[i]!.outputs = out[i]!.outputs.filter((x) => x !== j);
    }
  }
  return out.filter((t) => t.outputs.length > 0);
}

export interface MultiPolarityResult extends MultiCover {
  /** 'low' means the output's cover is the complement of its function. */
  polarity: Polarity[];
}

/**
 * Minimise with a choice of output polarity per output (a PLA has an output inverter per output).
 * `polarity` is fixed per output, or 'auto': each output starts with the polarity that is cheaper
 * on its own, then each output's polarity is flipped in turn if that lowers the shared cost.
 */
export function minimiseMultiPolarity(
  spec: MultiSpec,
  polarity: 'auto' | 'high' | Polarity[] = 'high',
  opts: MultiOptions = {},
): MultiPolarityResult {
  const { n } = spec;
  const m = spec.on.length;
  const flipSpec = (pol: Polarity[]): MultiSpec => ({
    n,
    on: spec.on.map((c, j) => (pol[j] === 'low' ? { n, cubes: offSetOf(spec, j) } : c)),
    dc: spec.dc,
  });
  const run = (pol: Polarity[]): MultiPolarityResult => ({ ...minimiseMulti(flipSpec(pol), opts), polarity: pol.slice() });
  if (polarity !== 'auto') {
    const pol: Polarity[] = Array.isArray(polarity) ? polarity.slice() : Array<Polarity>(m).fill('high');
    return run(pol);
  }
  const pol: Polarity[] = spec.on.map((c, j) => {
    if (c.cubes.length === 0) return 'high';
    const hi = minimise(c, spec.dc?.[j], opts);
    const lo = minimise({ n, cubes: offSetOf(spec, j) }, spec.dc?.[j], opts);
    return compareCost(
      { cubes: lo.cubes.length, literals: lo.cubes.reduce((s, x) => s + literalCount(x, n), 0) },
      { cubes: hi.cubes.length, literals: hi.cubes.reduce((s, x) => s + literalCount(x, n), 0) },
    ) < 0
      ? 'low'
      : 'high';
  });
  let best = run(pol);
  for (let j = 0; j < m; j++) {
    if (spec.on[j]!.cubes.length === 0) continue;
    const trial = pol.slice();
    trial[j] = trial[j] === 'high' ? 'low' : 'high';
    const r = run(trial);
    if (compareMultiCost(r.cost, best.cost) < 0) {
      best = r;
      pol[j] = trial[j]!;
    }
  }
  return best;
}
