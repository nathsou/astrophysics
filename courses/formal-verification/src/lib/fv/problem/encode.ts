/**
 * Constraint problems to SAT (chapter 6). A Vouch `problem` declares variables over small finite types and
 * constraints over them; this encoder turns it into CNF the way people encode puzzles by hand:
 *
 *   - each variable (and each entry of a function-typed variable, such as a Sudoku's `cell[r, c]`) gets one
 *     Boolean per possible value, with "exactly one of them" clauses: the **one-hot** encoding;
 *   - every expression is compiled to a *case split*: for each value it can take, the formula under which it takes
 *     it. `x == y` becomes "for some v, x is v and y is v"; `x + y` combines the cases of x and y;
 *   - quantifiers over finite types are expanded;
 *   - the resulting formula goes through Tseitin's transformation.
 *
 * Solutions are counted by enumeration with blocking clauses over the one-hot variables, and every solution is
 * checked by the reference interpreter, which evaluates the constraints on it.
 */
import type * as A from '../vouch/syntax/ast';
import type { Checked, ContainerInfo, FnInfo } from '../vouch/check/checker';
import type { Sym } from '../vouch/check/symbols';
import type { Ty } from '../vouch/check/types';
import { enumerate, key, show, funcConst, funcSet, type Value } from '../vouch/interp/values';
import { fand, fnot, forr, type Formula } from '../sat/encode';
import { tseitin } from '../sat/encode';
import type { Cnf } from '../sat/cnf';
import { Solver } from '../sat/solver';
import { Runner } from '../vouch/interp/exec';
import type { Env } from '../vouch/interp/eval';
import { Heap } from '../vouch/interp/eval';

export class EncodeError extends Error {}

const T: Formula = { k: 'const', value: true };
const F: Formula = { k: 'const', value: false };
const isT = (f: Formula) => f.k === 'const' && f.value;
const isF = (f: Formula) => f.k === 'const' && !f.value;
function and(...xs: Formula[]): Formula {
  const out: Formula[] = [];
  for (const x of xs) {
    if (isF(x)) return F;
    if (isT(x)) continue;
    if (x.k === 'and') out.push(...x.args);
    else out.push(x);
  }
  return out.length === 0 ? T : out.length === 1 ? out[0]! : fand(...out);
}
function or(...xs: Formula[]): Formula {
  const out: Formula[] = [];
  for (const x of xs) {
    if (isT(x)) return T;
    if (isF(x)) continue;
    if (x.k === 'or') out.push(...x.args);
    else out.push(x);
  }
  return out.length === 0 ? F : out.length === 1 ? out[0]! : forr(...out);
}
const not = (x: Formula): Formula => (isT(x) ? F : isF(x) ? T : x.k === 'not' ? x.a : fnot(x));

/** A case split: the possible values of an expression, each with the condition under which it has that value. */
type Cases = { value: Value; cond: Formula }[];

const MAX_CASES = 4096;

function merge(cases: Cases): Cases {
  const m = new Map<string, { value: Value; conds: Formula[] }>();
  for (const c of cases) {
    if (isF(c.cond)) continue;
    const k = key(c.value);
    const e = m.get(k);
    if (e) e.conds.push(c.cond);
    else m.set(k, { value: c.value, conds: [c.cond] });
  }
  if (m.size > MAX_CASES) throw new EncodeError('An expression has too many possible values to encode this way.');
  return [...m.values()].map((e) => ({ value: e.value, cond: or(...e.conds) }));
}

const asBool = (c: Cases): Formula => or(...c.filter((x) => x.value === true).map((x) => x.cond));
const fromBool = (f: Formula): Cases => [
  { value: true, cond: f },
  { value: false, cond: not(f) },
];

export interface Cell {
  /** Display name, such as `cell[0, 1]`. */
  name: string;
  sym: Sym;
  /** The argument of a function-typed variable (undefined for a plain variable). */
  arg?: Value;
  domain: Value[];
  /** SAT variable per domain value (for Booleans: one variable, for `true`). */
  vars: number[];
}

export interface Encoding {
  cnf: Cnf;
  cells: Cell[];
  /** The SAT variables that determine a solution (for counting). */
  decision: number[];
  stats: { cells: number; oneHotVars: number; tseitinVars: number; clauses: number; oneHotClauses: number };
  /** Named variables, for showing clauses: SAT variable → text such as `cell[0,1] = 3`. */
  names: Map<number, string>;
}

export class ProblemEncoder {
  private nextVar = 1;
  cells: Cell[] = [];
  private cellIndex = new Map<string, Cell>();
  private oneHot: number[][] = [];
  names = new Map<number, string>();
  readonly info: ContainerInfo;

  constructor(
    readonly checked: Checked,
    name: string,
  ) {
    const info = checked.containers.get(name);
    if (!info || info.kind !== 'problem') throw new EncodeError(`No problem called ${name}`);
    this.info = info;
    for (const v of info.vars) this.declare(v);
  }

  private fresh(): number {
    return this.nextVar++;
  }

  private declare(v: Sym): void {
    if (v.ty.k === 'func') {
      const params = v.ty.params;
      const dom = params.length === 1 ? enumerate(params[0]!) : this.tuples(params);
      if (!dom) throw new EncodeError(`The arguments of ${v.name} must range over a finite type.`);
      for (const a of dom) this.cell(v, v.ty.result, a);
    } else this.cell(v, v.ty, undefined);
  }

  private tuples(params: Ty[]): Value[] | undefined {
    let out: Value[][] = [[]];
    for (const p of params) {
      const d = enumerate(p);
      if (!d) return undefined;
      out = out.flatMap((t) => d.map((x) => [...t, x]));
    }
    return out.map((items) => ({ t: 'tuple', items }) as Value);
  }

  private cell(sym: Sym, ty: Ty, arg: Value | undefined): Cell {
    const domain = enumerate(ty);
    if (!domain) throw new EncodeError(`${sym.name} must have a finite type (a range such as 1..=9, an enum, or bool).`);
    const name = arg === undefined ? sym.name : `${sym.name}[${arg !== null && typeof arg === 'object' && 'items' in arg && (arg as { t: string }).t === 'tuple' ? (arg as { items: readonly Value[] }).items.map(show).join(', ') : show(arg)}]`;
    let vars: number[];
    if (ty.k === 'bool') {
      vars = [this.fresh()];
      this.names.set(vars[0]!, name);
    } else {
      vars = domain.map((d) => {
        const x = this.fresh();
        this.names.set(x, `${name} = ${show(d)}`);
        return x;
      });
      // Exactly one value: at least one, and no two (pairwise).
      this.oneHot.push(vars);
    }
    const c: Cell = { name, sym, arg, domain, vars };
    this.cells.push(c);
    this.cellIndex.set(`${sym.id}|${arg === undefined ? '' : key(arg)}`, c);
    return c;
  }

  private cellCases(c: Cell): Cases {
    if (c.vars.length === 1 && c.domain.length === 2 && typeof c.domain[0] === 'boolean') return fromBool({ k: 'var', v: c.vars[0]! });
    return c.domain.map((value, i) => ({ value, cond: { k: 'var', v: c.vars[i]! } as Formula }));
  }

  // ── Expressions ──

  compile(e: A.Expr, env: Map<number, Value>): Cases {
    const ev = (x: A.Expr) => this.compile(x, env);
    const boolOf = (x: A.Expr) => asBool(ev(x));
    switch (e.k) {
      case 'int':
        return [{ value: e.value, cond: T }];
      case 'bool':
        return [{ value: e.value, cond: T }];
      case 'var': {
        const s = this.checked.refs.get(e);
        if (!s) throw new EncodeError(`Unknown name ${e.name}.`);
        if (env.has(s.id)) return [{ value: env.get(s.id)!, cond: T }];
        if (s.kind === 'variant' && s.ty.k === 'enum') return [{ value: { t: 'enum', name: s.ty.name, tag: s.index!, variant: s.name, fields: [] }, cond: T }];
        if (s.kind === 'const' && s.value !== undefined) return [{ value: s.value, cond: T }];
        if (s.kind === 'const' && s.decl?.k === 'const') return this.compile(s.decl.value, env);
        const c = this.cellIndex.get(`${s.id}|`);
        if (c) return this.cellCases(c);
        throw new EncodeError(`${e.name} cannot be used here.`);
      }
      case 'index': {
        const t = e.target;
        const s = t.k === 'var' ? this.checked.refs.get(t) : undefined;
        if (!s || s.ty.k !== 'func' || env.has(s.id)) throw new EncodeError('Only problem variables of function type can be indexed.');
        const idx = e.indices.map(ev);
        // Every combination of index values.
        let combos: { vals: Value[]; cond: Formula }[] = [{ vals: [], cond: T }];
        for (const c of idx) combos = combos.flatMap((x) => c.map((y) => ({ vals: [...x.vals, y.value], cond: and(x.cond, y.cond) })));
        const out: Cases = [];
        for (const combo of combos) {
          const arg: Value = combo.vals.length === 1 ? combo.vals[0]! : ({ t: 'tuple', items: combo.vals } as Value);
          const cell = this.cellIndex.get(`${s.id}|${key(arg)}`);
          if (!cell) continue;
          for (const x of this.cellCases(cell)) out.push({ value: x.value, cond: and(combo.cond, x.cond) });
        }
        return merge(out);
      }
      case 'unary':
        if (e.op === '!') return fromBool(not(boolOf(e.arg)));
        if (e.op === '-') return merge(ev(e.arg).map((c) => ({ value: -(c.value as bigint), cond: c.cond })));
        if (e.op === '#') return this.cardinality(e.arg, env);
        throw new EncodeError(`The operator ${e.op} is not supported in problems.`);
      case 'binary':
        return this.binary(e, env);
      case 'chain': {
        const args = e.args.map(ev);
        const parts = e.ops.map((op, i) => this.relate(op, args[i]!, args[i + 1]!));
        return fromBool(and(...parts));
      }
      case 'quant': {
        const parts: Formula[] = [];
        this.expand(e.binders, env, (inner) => parts.push(asBool(this.compile(e.body, inner))));
        return fromBool(e.q === 'forall' ? and(...parts) : or(...parts));
      }
      case 'if': {
        const c = boolOf(e.cond);
        const a = ev(e.then);
        const b = ev(e.else);
        return merge([...a.map((x) => ({ value: x.value, cond: and(c, x.cond) })), ...b.map((x) => ({ value: x.value, cond: and(not(c), x.cond) }))]);
      }
      case 'call':
        return this.call(e, env);
      case 'tuple': {
        let out: Cases = [{ value: { t: 'tuple', items: [] } as Value, cond: T }];
        for (const x of e.elems) {
          const c = ev(x);
          out = merge(out.flatMap((o) => c.map((y) => ({ value: { t: 'tuple', items: [...(o.value as { items: readonly Value[] }).items, y.value] } as Value, cond: and(o.cond, y.cond) }))));
        }
        return out;
      }
      case 'block': {
        // let-bindings with a single possible value are substituted; others are expanded by cases.
        const go = (i: number, en: Map<number, Value>): Cases => {
          if (i === e.lets.length) return this.compile(e.body, en);
          const l = e.lets[i]!;
          const s = this.checked.refs.get(l)!;
          return merge(this.compile(l.value, en).flatMap((c) => go(i + 1, new Map(en).set(s.id, c.value)).map((r) => ({ value: r.value, cond: and(c.cond, r.cond) }))));
        };
        return go(0, env);
      }
      default:
        throw new EncodeError(`This kind of expression (${e.k}) is not supported in problems.`);
    }
  }

  private relate(op: string, a: Cases, b: Cases): Formula {
    const out: Formula[] = [];
    for (const x of a) {
      for (const y of b) {
        let holds: boolean;
        const kx = key(x.value);
        const ky = key(y.value);
        switch (op) {
          case '==':
            holds = kx === ky;
            break;
          case '!=':
            holds = kx !== ky;
            break;
          case '<':
            holds = (x.value as bigint) < (y.value as bigint);
            break;
          case '<=':
            holds = (x.value as bigint) <= (y.value as bigint);
            break;
          case '>':
            holds = (x.value as bigint) > (y.value as bigint);
            break;
          case '>=':
            holds = (x.value as bigint) >= (y.value as bigint);
            break;
          default:
            throw new EncodeError(`Cannot compare with ${op}.`);
        }
        if (holds) out.push(and(x.cond, y.cond));
      }
    }
    return or(...out);
  }

  private binary(e: A.Expr & { k: 'binary' }, env: Map<number, Value>): Cases {
    const op = e.op;
    if (op === '&&' || op === '||' || op === '==>' || op === '<==' || op === '<==>') {
      const l = asBool(this.compile(e.left, env));
      const r = asBool(this.compile(e.right, env));
      const f = op === '&&' ? and(l, r) : op === '||' ? or(l, r) : op === '==>' ? or(not(l), r) : op === '<==' ? or(l, not(r)) : or(and(l, r), and(not(l), not(r)));
      return fromBool(f);
    }
    const a = this.compile(e.left, env);
    const b = this.compile(e.right, env);
    if (['==', '!=', '<', '<=', '>', '>='].includes(op)) return fromBool(this.relate(op, a, b));
    if (op === 'in' || op === '!in') {
      // Membership in a literal set or sequence: compile each element.
      const r = e.right;
      if (r.k !== 'setlit' && r.k !== 'seqlit') throw new EncodeError('`in` needs a set or sequence written out, such as {1, 2, 3}.');
      const f = or(...r.elems.map((x) => this.relate('==', a, this.compile(x, env))));
      return fromBool(op === 'in' ? f : not(f));
    }
    const fn = (x: bigint, y: bigint): bigint | undefined => {
      switch (op) {
        case '+':
          return x + y;
        case '-':
          return x - y;
        case '*':
          return x * y;
        case '/':
          return y === 0n ? undefined : x / y;
        case '%':
          return y === 0n ? undefined : x % y;
      }
      throw new EncodeError(`The operator ${op} is not supported in problems.`);
    };
    const out: Cases = [];
    for (const x of a) {
      for (const y of b) {
        const v = fn(x.value as bigint, y.value as bigint);
        if (v === undefined) throw new EncodeError('A division by zero is possible here.');
        out.push({ value: v, cond: and(x.cond, y.cond) });
      }
    }
    return merge(out);
  }

  /** `#{x: T | p(x)}`: the number of values that satisfy p, as a case split (a sum of indicators). */
  private cardinality(arg: A.Expr, env: Map<number, Value>): Cases {
    if (arg.k !== 'comprehension' || arg.seq || arg.binders.length !== 1) throw new EncodeError('`#` needs a set written as {x: T | condition}.');
    const conds: Formula[] = [];
    this.expand(arg.binders, env, (inner) => conds.push(asBool(this.compile(arg.body, inner))));
    let sum: Cases = [{ value: 0n, cond: T }];
    for (const c of conds) {
      sum = merge(sum.flatMap((s) => [
        { value: s.value, cond: and(s.cond, not(c)) },
        { value: (s.value as bigint) + 1n, cond: and(s.cond, c) },
      ]));
    }
    return sum;
  }

  private call(e: A.Expr & { k: 'call' }, env: Map<number, Value>): Cases {
    const s = this.checked.refs.get(e);
    const args = e.args.map((a) => this.compile(a, env));
    if (!s) {
      if (e.callee === 'abs') return merge(args[0]!.map((c) => ({ value: (c.value as bigint) < 0n ? -(c.value as bigint) : c.value, cond: c.cond })));
      if (e.callee === 'min' || e.callee === 'max') {
        let acc = args[0]!;
        for (const b of args.slice(1)) {
          const out: Cases = [];
          for (const x of acc) for (const y of b) out.push({ value: (e.callee === 'min') === (x.value as bigint) <= (y.value as bigint) ? x.value : y.value, cond: and(x.cond, y.cond) });
          acc = merge(out);
        }
        return acc;
      }
      throw new EncodeError(`${e.callee}(…) is not supported in problems.`);
    }
    const info = [...this.checked.fns.values()].find((f) => f.sym === s) as FnInfo | undefined;
    if (!info || !info.decl.body || 'stmts' in info.decl.body) throw new EncodeError(`${e.callee} must be a predicate or pure function with an expression body.`);
    // Expand the call over every combination of argument values.
    const go = (i: number, en: Map<number, Value>, cond: Formula): Cases => {
      if (i === args.length) return this.compile(info.decl.body as A.Expr, en).map((r) => ({ value: r.value, cond: and(cond, r.cond) }));
      return args[i]!.flatMap((c) => go(i + 1, new Map(en).set(info.params[i]!.id, c.value), and(cond, c.cond)));
    };
    return merge(go(0, new Map(env), T));
  }

  private expand(bs: A.Binder[], env: Map<number, Value>, f: (env: Map<number, Value>) => void): void {
    const go = (i: number, en: Map<number, Value>) => {
      if (i === bs.length) return f(en);
      const b = bs[i]!;
      const s = this.checked.refs.get(b)!;
      let dom: Value[] | undefined;
      if (b.range && !('set' in b.range)) {
        const lo = this.compile(b.range.lo, en);
        const hi = this.compile(b.range.hi, en);
        if (lo.length !== 1 || hi.length !== 1) throw new EncodeError('Quantifier ranges must not depend on the unknowns.');
        dom = [];
        for (let v = lo[0]!.value as bigint; b.range.inclusive ? v <= (hi[0]!.value as bigint) : v < (hi[0]!.value as bigint); v++) dom.push(v);
      } else dom = enumerate(s.ty);
      if (!dom) throw new EncodeError(`The quantifier over ${b.name} must range over a finite type.`);
      for (const v of dom) go(i + 1, new Map(en).set(s.id, v));
    };
    go(0, env);
  }

  // ── The whole problem ──

  encode(): Encoding {
    const parts: Formula[] = [];
    for (const c of this.info.constraints) parts.push(asBool(this.compile(c.expr, new Map())));
    const oneHotClauses: number[][] = [];
    for (const vars of this.oneHot) {
      oneHotClauses.push([...vars]);
      for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) oneHotClauses.push([-vars[i]!, -vars[j]!]);
    }
    const decisionVars = this.nextVar - 1;
    const body = and(...parts);
    const t = tseitin(body, this.nextVar);
    const clauses = [...oneHotClauses, ...t.clauses];
    return {
      cnf: { nvars: Math.max(t.nvars, decisionVars), clauses },
      cells: this.cells,
      decision: Array.from({ length: decisionVars }, (_, i) => i + 1),
      stats: { cells: this.cells.length, oneHotVars: decisionVars, tseitinVars: t.fresh, clauses: clauses.length, oneHotClauses: oneHotClauses.length },
      names: this.names,
    };
  }
}

export interface Solution {
  /** Variable name → value (function variables as a whole function value). */
  values: Map<string, Value>;
  /** Every constraint, evaluated by the reference interpreter on this solution. */
  checked: boolean;
}

export interface ProblemResult {
  encoding: Encoding;
  count: number;
  /** True when counting stopped at the limit. */
  more: boolean;
  solutions: Solution[];
  ms: number;
}

/** Solve or count a problem: enumerate solutions with blocking clauses (up to `limit`). */
export function solveProblem(checked: Checked, name: string, opts: { limit?: number; keep?: number } = {}): ProblemResult {
  const t0 = Date.now();
  const enc = new ProblemEncoder(checked, name);
  const encoding = enc.encode();
  const limit = opts.limit ?? 1000;
  const keep = opts.keep ?? 3;
  const s = new Solver();
  s.ensureVars(encoding.cnf.nvars);
  let ok = true;
  for (const c of encoding.cnf.clauses) if (!s.addClause(c)) ok = false;
  const solutions: Solution[] = [];
  let count = 0;
  let more = false;
  while (ok && s.solve() === 'sat') {
    if (count >= limit) {
      more = true;
      break;
    }
    count++;
    const m = s.model;
    if (solutions.length < keep) solutions.push(decode(checked, enc, encoding, m));
    // Block this assignment of the one-hot variables.
    const block = encoding.decision.map((v) => (m[v] ? -v : v));
    if (!s.addClause(block)) break;
  }
  return { encoding, count, more, solutions, ms: Date.now() - t0 };
}

function decode(checked: Checked, enc: ProblemEncoder, encoding: Encoding, m: boolean[]): Solution {
  const values = new Map<string, Value>();
  const vals = new Map<number, Value>();
  for (const v of enc.info.vars) {
    const cells = encoding.cells.filter((c) => c.sym === v);
    const valueOf = (c: Cell): Value => (c.vars.length === 1 && typeof c.domain[0] === 'boolean' ? !!m[c.vars[0]!] : c.domain[c.vars.findIndex((x) => m[x])] ?? c.domain[0]!);
    let val: Value;
    if (v.ty.k === 'func') {
      let f = funcConst(cells[0] ? valueOf(cells[0]) : null);
      for (const c of cells) f = funcSet(f, c.arg!, valueOf(c));
      val = f;
    } else val = valueOf(cells[0]!);
    values.set(v.name, val);
    vals.set(v.id, val);
  }
  // The interpreter checks the solution (this is what makes it trustworthy, not the encoder).
  let checkedOk = true;
  try {
    const r = new Runner(checked, { fuel: 1_000_000 });
    const env: Env = { vals, heap: new Heap() };
    for (const c of enc.info.constraints) if (!r.ev.eval(c.expr, env)) checkedOk = false;
  } catch {
    checkedOk = false;
  }
  return { values, checked: checkedOk };
}
