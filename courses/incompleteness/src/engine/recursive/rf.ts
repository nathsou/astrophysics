// Recursive functions (chapter Recursive Functions), as terms, with evaluation traces.
//
//   zero(x) = 0     succ(x) = x + 1     P^n_i(x_0, …, x_{n-1}) = x_i
//   composition:          h(x⃗) = f(g_0(x⃗), …, g_{k-1}(x⃗))
//   primitive recursion:  h(x⃗, 0) = f(x⃗),  h(x⃗, y + 1) = g(x⃗, y, h(x⃗, y))   (x⃗ non-empty, as in the book)
//   minimization:         h(z⃗) = μx f(x, z⃗) = the least x with f(x, z⃗) = 0 and f(y, z⃗) defined for y < x
//
// The chapter on representability uses a different basis: zero, succ, projections, addition,
// multiplication and the characteristic function of =, closed under composition and *regular*
// minimization. Those three extra functions appear here as basic functions too.

export type BasicName = 'add' | 'mult' | 'chareq';

export type RF =
  | { k: 'zero'; id: string }
  | { k: 'succ'; id: string }
  | { k: 'proj'; id: string; n: number; i: number }
  | { k: 'basic'; id: string; name: BasicName }
  | { k: 'comp'; id: string; f: RF; gs: RF[] }
  | { k: 'rec'; id: string; f: RF; g: RF }
  | { k: 'min'; id: string; f: RF }
  /** A named definition, shown by name (e.g. add defined by primitive recursion). */
  | { k: 'def'; id: string; name: string; tex: string; body: RF };

let counter = 0;
const rid = () => `r${++counter}`;

export const R = {
  zero: (): RF => ({ k: 'zero', id: rid() }),
  succ: (): RF => ({ k: 'succ', id: rid() }),
  proj: (n: number, i: number): RF => ({ k: 'proj', id: rid(), n, i }),
  basic: (name: BasicName): RF => ({ k: 'basic', id: rid(), name }),
  comp: (f: RF, gs: RF[]): RF => ({ k: 'comp', id: rid(), f, gs }),
  rec: (f: RF, g: RF): RF => ({ k: 'rec', id: rid(), f, g }),
  min: (f: RF): RF => ({ k: 'min', id: rid(), f }),
  def: (name: string, tex: string, body: RF): RF => ({ k: 'def', id: rid(), name, tex, body }),
};

export const BASIC_ARITY: Record<BasicName, number> = { add: 2, mult: 2, chareq: 2 };
export const BASIC_TEX: Record<BasicName, string> = { add: '\\mathrm{add}', mult: '\\mathrm{mult}', chareq: '\\chi_{=}' };

export type ArityResult = { ok: true; arity: number } | { ok: false; errors: { id: string; message: string }[] };

/** The number of arguments, or the reasons the definition is ill-formed. */
export function arity(f: RF): ArityResult {
  const errors: { id: string; message: string }[] = [];
  const go = (g: RF): number | null => {
    switch (g.k) {
      case 'zero':
      case 'succ':
        return 1;
      case 'proj':
        if (!(g.n >= 1 && g.i >= 0 && g.i < g.n)) {
          errors.push({ id: g.id, message: `P^${g.n}_${g.i} needs 0 ≤ i < n` });
          return null;
        }
        return g.n;
      case 'basic':
        return BASIC_ARITY[g.name];
      case 'def':
        return go(g.body);
      case 'comp': {
        const fa = go(g.f);
        const ga = g.gs.map(go);
        if (fa === null || ga.some((a) => a === null)) return null;
        if (g.gs.length === 0) {
          errors.push({ id: g.id, message: 'composition needs at least one inner function' });
          return null;
        }
        if (fa !== g.gs.length) errors.push({ id: g.id, message: `the outer function takes ${fa} argument${fa === 1 ? '' : 's'} but ${g.gs.length} inner function${g.gs.length === 1 ? ' is' : 's are'} given` });
        if (new Set(ga).size > 1) errors.push({ id: g.id, message: 'the inner functions must all take the same number of arguments' });
        return ga[0]!;
      }
      case 'rec': {
        const fa = go(g.f);
        const gaa = go(g.g);
        if (fa === null || gaa === null) return null;
        if (fa < 1) errors.push({ id: g.id, message: 'the base function needs at least one argument (the book requires k ≥ 1)' });
        if (gaa !== fa + 2) errors.push({ id: g.id, message: `the step function must take k + 2 = ${fa + 2} arguments (x⃗, y and the previous value), not ${gaa}` });
        return fa + 1;
      }
      case 'min': {
        const fa = go(g.f);
        if (fa === null) return null;
        if (fa < 1) errors.push({ id: g.id, message: 'minimization needs a function of at least one argument' });
        return fa - 1;
      }
    }
  };
  const a = go(f);
  if (errors.length || a === null) return { ok: false, errors };
  return { ok: true, arity: a };
}

// ------------------------------------------------------------------ evaluation

export type CallRule = 'zero' | 'succ' | 'proj' | 'basic' | 'def' | 'comp' | 'rec-base' | 'rec-step' | 'rec' | 'min' | 'min-test';

export interface Call {
  /** unique per call */
  key: string;
  fn: RF;
  args: bigint[];
  /** undefined while unfinished, or if evaluation ran out of steps */
  value?: bigint;
  status: 'ok' | 'out-of-fuel';
  rule: CallRule;
  children: Call[];
  /** e.g. "h(2, 3) = g(2, 2, h(2, 2))" */
  note?: string;
}

export interface EvalResult {
  value?: bigint;
  status: 'ok' | 'out-of-fuel';
  root: Call;
  calls: number;
}

export interface EvalOptions {
  /** Maximum number of function calls before giving up (a search may not terminate). */
  fuel?: number;
  /** Record calls below this depth only (the value is still computed). */
  maxTraceDepth?: number;
}

class OutOfFuel extends Error {}

export function evaluate(f: RF, args: bigint[], opt: EvalOptions = {}): EvalResult {
  let fuel = opt.fuel ?? 20_000;
  let calls = 0;
  let key = 0;
  const maxDepth = opt.maxTraceDepth ?? 50;
  const root: Call = { key: 'c0', fn: f, args, status: 'ok', rule: ruleOf(f), children: [] };

  const call = (g: RF, xs: bigint[], parent: Call | null, depth: number, rule?: CallRule, note?: string): bigint => {
    if (--fuel < 0) throw new OutOfFuel();
    calls++;
    const node: Call = parent === null ? root : { key: `c${++key}`, fn: g, args: xs, status: 'ok', rule: rule ?? ruleOf(g), children: [], note };
    if (parent && depth <= maxDepth) parent.children.push(node);
    try {
      const v = run(g, xs, node, depth);
      node.value = v;
      return v;
    } catch (e) {
      node.status = 'out-of-fuel';
      throw e;
    }
  };

  const run = (g: RF, xs: bigint[], node: Call, depth: number): bigint => {
    switch (g.k) {
      case 'zero':
        return 0n;
      case 'succ':
        return xs[0] + 1n;
      case 'proj':
        return xs[g.i];
      case 'basic':
        return g.name === 'add' ? xs[0] + xs[1] : g.name === 'mult' ? xs[0] * xs[1] : xs[0] === xs[1] ? 1n : 0n;
      case 'def':
        return call(g.body, xs, node, depth + 1);
      case 'comp': {
        const ys = g.gs.map((h) => call(h, xs, node, depth + 1));
        return call(g.f, ys, node, depth + 1);
      }
      case 'rec': {
        const xv = xs.slice(0, -1);
        const y = xs[xs.length - 1];
        let acc = call(g.f, xv, node, depth + 1, 'rec-base', `base case: h(${[...xv, 0n].join(', ')}) = f(${xv.join(', ')})`);
        for (let i = 0n; i < y; i++) {
          acc = call(g.g, [...xv, i, acc], node, depth + 1, 'rec-step', `h(${[...xv, i + 1n].join(', ')}) = g(${[...xv, i].join(', ')}, h(${[...xv, i].join(', ')}))`);
        }
        return acc;
      }
      case 'min': {
        for (let x = 0n; ; x++) {
          const v = call(g.f, [x, ...xs], node, depth + 1, 'min-test', `try x = ${x}`);
          if (v === 0n) return x;
        }
      }
    }
  };

  try {
    const value = call(f, args, null, 0);
    return { value, status: 'ok', root, calls };
  } catch (e) {
    if (e instanceof OutOfFuel) {
      root.status = 'out-of-fuel';
      return { status: 'out-of-fuel', root, calls };
    }
    throw e;
  }
}

function ruleOf(g: RF): CallRule {
  return g.k === 'rec' ? 'rec' : g.k === 'min' ? 'min' : g.k;
}

/** Steps of a trace in the order they happen: a call is entered, its children run, it returns. */
export type TraceEvent = { kind: 'enter' | 'exit'; call: Call; depth: number };

export function events(root: Call): TraceEvent[] {
  const out: TraceEvent[] = [];
  const go = (c: Call, depth: number) => {
    out.push({ kind: 'enter', call: c, depth });
    c.children.forEach((ch) => go(ch, depth + 1));
    out.push({ kind: 'exit', call: c, depth });
  };
  go(root, 0);
  return out;
}

// ------------------------------------------------------------------ notation

export function rfTex(f: RF): string {
  switch (f.k) {
    case 'zero':
      return '\\mathrm{zero}';
    case 'succ':
      return '\\mathrm{succ}';
    case 'proj':
      return `P^{${f.n}}_{${f.i}}`;
    case 'basic':
      return BASIC_TEX[f.name];
    case 'def':
      return f.tex;
    case 'comp':
      return `${rfTex(f.f)} \\circ (${f.gs.map(rfTex).join(', ')})`;
    case 'rec':
      return `\\mathrm{Rec}(${rfTex(f.f)}, ${rfTex(f.g)})`;
    case 'min':
      return `\\mu(${rfTex(f.f)})`;
  }
}

/** Library of functions defined in the book. */
export function library() {
  const add = R.def('add', '\\mathrm{add}', R.rec(R.proj(1, 0), R.comp(R.succ(), [R.proj(3, 2)])));
  const mult = R.def('mult', '\\mathrm{mult}', R.rec(R.zero(), R.comp(add, [R.proj(3, 2), R.proj(3, 0)])));
  return { add, mult };
}
