/**
 * The step checker: is `a = b` (or `a ≤ b`, …) a valid step, given what we know about the variables?
 *
 * 1. Exact: both sides are put in canonical form (canon.ts). Equal forms mean the identity holds
 *    wherever both sides are defined: a proof.
 * 2. Search: otherwise the claim is tested at many sample points drawn from each variable's domain
 *    (and satisfying the assumptions). A failing point is a counterexample, which is a proof that
 *    the step is wrong. If no point fails, the step is *probably* right, and we say so honestly.
 *
 * For inequalities, a difference that is a polynomial with non-negative coefficients in even powers
 * (or in variables known to be non-negative) is accepted exactly.
 */
import { Rat } from './rational';
import { fn as mkFn, subst, symbols, type Expr, type Rel } from './expr';
import { Canon } from './canon';
import { evalExact, evalNum, type FnTable, type NumEnv, type RatEnv } from './eval';
import { parseChain, parseExpr, ParseError, type ParseOptions } from './parse';
import { monoKey, polyDegree, rfAdd, rfAsPoly, rfNeg, type Mono, type Poly } from './poly';

export type Domain =
  | 'real'
  | 'pos'
  | 'nonneg'
  | 'int'
  | 'nat'
  | 'posint'
  | { min: number; max: number; int?: boolean };

export interface Definition {
  params: string[];
  body: string | Expr;
}

export interface CheckOptions {
  /** Domain per variable; others get `defaultDomain`. */
  domains?: Record<string, Domain>;
  defaultDomain?: Domain;
  /** Assumptions such as "x > 0", "n >= 1", "a != b". */
  assume?: string[];
  /** Functions defined by the exercise, expanded before checking: { S: { params: ['n'], body: 'n(n+1)/2' } }. */
  defs?: Record<string, Definition>;
  /** Numeric-only functions (no symbolic definition). */
  fns?: FnTable;
  parse?: ParseOptions;
  samples?: number;
  /** Seed for reproducible sampling. */
  seed?: number;
}

export type Verdict =
  | { ok: true; how: 'exact' }
  | { ok: true; how: 'tested'; samples: number }
  | { ok: false; how: 'counterexample'; at: NumEnv; lhs: number; rhs: number }
  | { ok: false; how: 'error'; message: string; pos?: number };

const INT_DOMAINS = new Set(['int', 'nat', 'posint']);

function isIntDomain(d: Domain): boolean {
  return typeof d === 'string' ? INT_DOMAINS.has(d) : !!d.int;
}

function nonNegDomain(d: Domain): boolean {
  if (typeof d === 'string') return d === 'pos' || d === 'nonneg' || d === 'nat' || d === 'posint';
  return d.min >= 0;
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleValue(d: Domain, r: () => number, i: number): number {
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const intIn = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  // The first samples walk through "interesting" values, later ones are random.
  if (typeof d !== 'string') {
    if (d.int) return i < d.max - d.min + 1 && i < 40 ? d.min + i : intIn(d.min, d.max);
    return d.min + r() * (d.max - d.min);
  }
  switch (d) {
    case 'nat':
      return i < 30 ? i : intIn(0, 60);
    case 'posint':
      return i < 30 ? i + 1 : intIn(1, 60);
    case 'int':
      return i < 31 ? i - 15 : intIn(-60, 60);
    case 'pos':
      return i % 3 === 0 ? pick([0.001, 0.1, 0.5, 1, 2, 3, 10, 100]) : r() * (i % 2 ? 1 : 20);
    case 'nonneg':
      return i % 3 === 0 ? pick([0, 0.001, 0.5, 1, 2, 10]) : r() * (i % 2 ? 1 : 20);
    case 'real':
      return i % 3 === 0 ? pick([-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3]) : (r() - 0.5) * (i % 2 ? 2 : 40);
  }
}

function close(a: number, b: number): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function holds(rel: Rel, a: number, b: number): boolean {
  const eq = close(a, b);
  switch (rel) {
    case '=':
      return eq;
    case '!=':
      return !eq;
    case '<':
      return a < b && !eq;
    case '<=':
      return a < b || eq;
    case '>':
      return a > b && !eq;
    case '>=':
      return a > b || eq;
  }
}

function holdsExact(rel: Rel, a: Rat, b: Rat): boolean {
  const c = a.cmp(b);
  switch (rel) {
    case '=':
      return c === 0;
    case '!=':
      return c !== 0;
    case '<':
      return c < 0;
    case '<=':
      return c <= 0;
    case '>':
      return c > 0;
    case '>=':
      return c >= 0;
  }
}

/**
 * A sufficient test for p ≥ 0 everywhere: non-negative coefficients (with odd powers only of
 * non-negative atoms), or a positive semidefinite quadratic form, or — if every exponent is even —
 * the same test for p with x² renamed to y.
 */
export function nonNegative(p: Poly, nonneg: Set<string>, depth = 0): boolean {
  let simple = true;
  for (const t of p.values()) {
    if (t.c.sign() < 0) simple = false;
    for (const [atom, e] of t.mono) if (e % 2 !== 0 && !nonneg.has(atom)) simple = false;
  }
  if (simple) return true;
  if (polyDegree(p) <= 2 && psdQuadratic(p)) return true;
  const allEven = [...p.values()].every((t) => [...t.mono.values()].every((e) => e % 2 === 0));
  if (allEven && depth < 4) {
    const halved: Poly = new Map();
    const atoms = new Set<string>();
    for (const t of p.values()) {
      const mono: Mono = new Map([...t.mono].map(([a, e]) => [a, e / 2]));
      mono.forEach((_, a) => atoms.add(a));
      halved.set(monoKey(mono), { mono, c: t.c });
    }
    return nonNegative(halved, new Set([...nonneg, ...atoms]), depth + 1);
  }
  return false;
}

/** Is a polynomial of degree ≤ 2 non-negative for all real values? (Its Gram matrix is PSD.) */
function psdQuadratic(p: Poly): boolean {
  const atoms = [...new Set([...p.values()].flatMap((t) => [...t.mono.keys()]))].sort();
  const idx = new Map(atoms.map((a, i) => [a, i + 1]));
  const n = atoms.length + 1;
  const m: Rat[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => Rat.ZERO));
  const half = Rat.of(1, 2);
  for (const t of p.values()) {
    const vs = [...t.mono.entries()];
    if (vs.length === 0) m[0]![0] = m[0]![0]!.add(t.c);
    else if (vs.length === 1 && vs[0]![1] === 1) {
      const i = idx.get(vs[0]![0])!;
      m[0]![i] = m[0]![i]!.add(t.c.mul(half));
      m[i]![0] = m[i]![0]!.add(t.c.mul(half));
    } else if (vs.length === 1 && vs[0]![1] === 2) {
      const i = idx.get(vs[0]![0])!;
      m[i]![i] = m[i]![i]!.add(t.c);
    } else if (vs.length === 2) {
      const i = idx.get(vs[0]![0])!;
      const j = idx.get(vs[1]![0])!;
      m[i]![j] = m[i]![j]!.add(t.c.mul(half));
      m[j]![i] = m[j]![i]!.add(t.c.mul(half));
    } else return false;
  }
  // Symmetric Gaussian elimination: PSD iff every pivot ≥ 0 and zero pivots have zero rows.
  for (let k = 0; k < n; k++) {
    const piv = m[k]![k]!;
    if (piv.sign() < 0) return false;
    if (piv.isZero()) {
      for (let j = k + 1; j < n; j++) if (!m[k]![j]!.isZero()) return false;
      continue;
    }
    for (let i = k + 1; i < n; i++) {
      const f = m[i]![k]!.div(piv);
      for (let j = k + 1; j < n; j++) m[i]![j] = m[i]![j]!.sub(f.mul(m[k]![j]!));
    }
  }
  return true;
}

export class Checker {
  readonly opts: CheckOptions;
  private readonly defs: Record<string, { params: string[]; body: Expr }>;
  private readonly assumptions: { exprs: Expr[]; rels: Rel[] }[];

  constructor(opts: CheckOptions = {}) {
    this.opts = opts;
    const fnNames = [...Object.entries(opts.defs ?? {}).filter(([, d]) => d.params.length > 0).map(([k]) => k), ...Object.keys(opts.fns ?? {}), ...(opts.parse?.functions ?? [])];
    const constNames = Object.entries(opts.defs ?? {}).filter(([, d]) => d.params.length === 0).map(([k]) => k);
    this.parseOpts = { ...opts.parse, functions: fnNames, variables: [...(opts.parse?.variables ?? []), ...constNames] };
    this.defs = {};
    for (const [name, d] of Object.entries(opts.defs ?? {})) {
      this.defs[name] = { params: d.params, body: typeof d.body === 'string' ? parseExpr(d.body, this.parseOpts) : d.body };
    }
    this.assumptions = (opts.assume ?? []).map((a) => parseChain(a, this.parseOpts));
  }

  readonly parseOpts: ParseOptions;

  domainOf(v: string): Domain {
    return this.opts.domains?.[v] ?? this.opts.defaultDomain ?? 'real';
  }

  /** Expand defined functions (repeatedly, so definitions may use each other). */
  expand(e: Expr, depth = 0): Expr {
    if (depth > 20) return e;
    const go = (x: Expr): Expr => {
      switch (x.k) {
        case 'num':
          return x;
        case 'sym': {
          const d = this.defs[x.name];
          return d && d.params.length === 0 ? this.expand(d.body, depth + 1) : x;
        }
        case 'add':
          return { k: 'add', args: x.args.map(go) };
        case 'mul':
          return { k: 'mul', args: x.args.map(go) };
        case 'pow':
          return { k: 'pow', base: go(x.base), exp: go(x.exp) };
        case 'fn': {
          const d = this.defs[x.name];
          const args = x.args.map(go);
          if (d && args.length === d.params.length) {
            return this.expand(subst(d.body, Object.fromEntries(d.params.map((p, i) => [p, args[i]!]))), depth + 1);
          }
          return mkFn(x.name, ...args);
        }
      }
    };
    return go(e);
  }

  parse(src: string): Expr {
    return parseExpr(src, this.parseOpts);
  }

  private canon(): Canon {
    const intVars: string[] = [];
    for (const [v, d] of Object.entries(this.opts.domains ?? {})) if (isIntDomain(d)) intVars.push(v);
    return new Canon({ intVars });
  }

  /** Try to prove `a rel b` symbolically. */
  private exact(a: Expr, rel: Rel, b: Expr, vars: string[]): boolean {
    try {
      const c = this.canon();
      if (rel === '=') return c.equal(a, b);
      if (rel === '!=') return false;
      // Normalise to 0 ≤ d (or 0 < d).
      const [lo, hi] = rel === '<' || rel === '<=' ? [a, b] : [b, a];
      const d = c.reduce(rfAdd(c.rf(hi), rfNeg(c.rf(lo))));
      const p = rfAsPoly(d);
      if (!p) return false;
      const nonneg = new Set(vars.filter((v) => nonNegDomain(this.domainOf(v))));
      if (rel === '<=' || rel === '>=') return nonNegative(p, nonneg);
      // Strict: every coefficient non-negative, odd powers only of non-negative variables, positive constant.
      let constant = Rat.ZERO;
      for (const [k, t] of p) {
        if (k === '') constant = t.c;
        if (t.c.sign() < 0) return false;
        for (const [atom, e] of t.mono) if (e % 2 !== 0 && !nonneg.has(atom)) return false;
      }
      return constant.sign() > 0;
    } catch {
      return false;
    }
  }

  private satisfiesAssumptions(env: NumEnv): boolean {
    for (const { exprs, rels } of this.assumptions) {
      for (let i = 0; i < rels.length; i++) {
        let a: number, b: number;
        try {
          a = evalNum(this.expand(exprs[i]!), env, this.opts.fns);
          b = evalNum(this.expand(exprs[i + 1]!), env, this.opts.fns);
        } catch {
          return false;
        }
        if (!holds(rels[i]!, a, b)) return false;
      }
    }
    return true;
  }

  /** Check a single relation between two expressions. */
  relation(aIn: Expr, rel: Rel, bIn: Expr): Verdict {
    const a = this.expand(aIn);
    const b = this.expand(bIn);
    const vars = [...new Set([...symbols(a), ...symbols(b), ...this.assumptions.flatMap((x) => x.exprs.flatMap((e) => [...symbols(e)]))])].sort();
    if (this.exact(a, rel, b, vars)) return { ok: true, how: 'exact' };

    const r = rng(this.opts.seed ?? 12345);
    const target = this.opts.samples ?? 200;
    let tested = 0;
    for (let i = 0; i < target * 20 && tested < target; i++) {
      const env: NumEnv = {};
      for (const v of vars) env[v] = sampleValue(this.domainOf(v), r, i);
      if (!this.satisfiesAssumptions(env)) continue;
      // Exact comparison for integer points where possible.
      const allRational = vars.every((v) => Number.isInteger(env[v]!));
      if (allRational) {
        const ratEnv: RatEnv = Object.fromEntries(vars.map((v) => [v, Rat.of(env[v]!)]));
        let x: Rat | null = null;
        let y: Rat | null = null;
        try {
          x = evalExact(a, ratEnv);
          y = evalExact(b, ratEnv);
        } catch {
          continue; // division by zero at this point: outside the domain of the claim
        }
        if (x && y) {
          tested++;
          if (!holdsExact(rel, x, y)) return { ok: false, how: 'counterexample', at: env, lhs: x.toNumber(), rhs: y.toNumber() };
          continue;
        }
      }
      let x: number, y: number;
      try {
        x = evalNum(a, env, this.opts.fns);
        y = evalNum(b, env, this.opts.fns);
      } catch {
        continue;
      }
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      tested++;
      if (!holds(rel, x, y)) return { ok: false, how: 'counterexample', at: env, lhs: x, rhs: y };
    }
    if (tested === 0) return { ok: false, how: 'error', message: 'Could not find any values satisfying the assumptions to test.' };
    return { ok: true, how: 'tested', samples: tested };
  }

  /** Check a typed claim such as "2^(n+1) - 1 = 2(2^n - 1) + 1" or a chain "a = b ≤ c". */
  claim(src: string): { steps: { from: Expr; rel: Rel; to: Expr; verdict: Verdict }[]; error?: Verdict } {
    let parsed: { exprs: Expr[]; rels: Rel[] };
    try {
      parsed = parseChain(src, this.parseOpts);
    } catch (e) {
      const pos = e instanceof ParseError ? e.pos : undefined;
      return { steps: [], error: { ok: false, how: 'error', message: e instanceof Error ? e.message : String(e), pos } };
    }
    const steps = parsed.rels.map((rel, i) => {
      const from = parsed.exprs[i]!;
      const to = parsed.exprs[i + 1]!;
      return { from, rel, to, verdict: this.relation(from, rel, to) };
    });
    return { steps };
  }
}

/** Does `a` equal `b` (strings), under the given options? Convenience wrapper for exercises. */
export function checkEqual(a: string, b: string, opts: CheckOptions = {}): Verdict {
  const c = new Checker(opts);
  try {
    return c.relation(c.parse(a), '=', c.parse(b));
  } catch (e) {
    return { ok: false, how: 'error', message: e instanceof Error ? e.message : String(e), pos: e instanceof ParseError ? e.pos : undefined };
  }
}

/** Combine the verdicts of a chain into one: the chain proves a REL b where REL is the strongest link. */
export function chainRelation(rels: Rel[]): Rel | null {
  if (rels.includes('!=')) return rels.length === 1 ? '!=' : null;
  const up = rels.some((r) => r === '<' || r === '<=');
  const down = rels.some((r) => r === '>' || r === '>=');
  if (up && down) return null;
  const strict = rels.some((r) => r === '<' || r === '>');
  if (up) return strict ? '<' : '<=';
  if (down) return strict ? '>' : '>=';
  return '=';
}
