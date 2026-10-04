/**
 * Small worlds (chapter 9): bounded relational model finding, in the style of Alloy and its engine Kodkod.
 *
 * A `world` declares atom types, relations over them with multiplicities, facts, and commands: `check p for n`
 * looks for an instance of the facts in which p is false (a counterexample), `run p for n` for one in which p is
 * true. The scope n bounds every atom type to at most n atoms.
 *
 * The encoding:
 *   - each type T gets n existence variables e_T[0..n), ordered (atom i+1 exists only if atom i does), so scopes are
 *     "up to n" and the instance has no gaps;
 *   - each relation of arity k gets one Boolean per k-tuple of atoms of its column types, true when the tuple is in
 *     the relation (a tuple may only hold atoms that exist);
 *   - every relational expression becomes a Boolean *matrix* of formulas, one per tuple: union is OR, intersection
 *     AND, join a matrix product, transpose a transpose, transitive closure iterated squaring;
 *   - every formula becomes a propositional formula over those Booleans: quantifiers over atom types expand over
 *     the atoms (guarded by existence), `some e` is an OR over e's matrix, `x in e` an implication per tuple;
 *   - the result goes through Tseitin's transformation to CNF, and the CDCL solver answers.
 *
 * Trust: an instance is decoded into relation values and the reference interpreter evaluates every fact and the
 * command's formula on it, so instances (and counterexamples) are checked. "No instance within scope n" rests on the
 * encoder; the SAT part of it carries a DRAT proof checked by the trusted checker.
 */
import type * as A from '../vouch/syntax/ast';
import type { Checked, ContainerInfo, FnInfo } from '../vouch/check/checker';
import type { Sym } from '../vouch/check/symbols';
import type { Ty } from '../vouch/check/types';
import { rel, type RelV, type Value } from '../vouch/interp/values';
import { fand, fnot, forr, tseitin, type Formula } from '../sat/encode';
import type { Cnf } from '../sat/cnf';
import { Solver } from '../sat/solver';
import { checkDrat } from '../sat/check/drat';
import { Runner } from '../vouch/interp/exec';
import { Heap, type Env } from '../vouch/interp/eval';

export class WorldError extends Error {}

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
const imp = (a: Formula, b: Formula) => or(not(a), b);
const iff = (a: Formula, b: Formula) => (isT(a) ? b : isT(b) ? a : isF(a) ? not(b) : isF(b) ? not(a) : or(and(a, b), and(not(a), not(b))));

/** A relational value under encoding: one formula per tuple of atoms of the column types. */
export interface Matrix {
  cols: string[];
  /** Row-major over the column scopes. */
  cells: Formula[];
}

/** One atom type of the world, with its existence variables. */
interface AtomType {
  name: string;
  n: number;
  exists: number[];
}

export interface WorldInstance {
  /** Atom names per type, e.g. Dir → [Dir0, Dir1]. */
  atoms: { type: string; names: string[] }[];
  /** Each relation's tuples, as atom names. */
  rels: { name: string; cols: string[]; tuples: string[][] }[];
}

export interface WorldResult {
  command: A.PropDecl;
  kind: 'check' | 'run';
  scope: number;
  /** For check: a counterexample was found; for run: an instance was found. */
  found: boolean;
  instance?: WorldInstance;
  /** The interpreter's evaluation of the facts and the command on the instance agrees with the solver. */
  instanceChecked?: boolean;
  /** For "nothing found": the DRAT proof of the CNF was checked. */
  proofChecked?: boolean;
  stats: { primaryVars: number; vars: number; clauses: number; ms: number };
  /** The values of the primary variables (for excluding this instance next time). */
  model?: boolean[];
}

export class WorldEncoder {
  private nextVar = 1;
  readonly types = new Map<string, AtomType>();
  /** Relation symbol id → its matrix of variables. */
  readonly relVars = new Map<number, Matrix>();
  readonly info: ContainerInfo;
  private bounds: Formula[] = [];
  names = new Map<number, string>();

  constructor(
    readonly checked: Checked,
    worldName: string,
    readonly scope: number,
  ) {
    const info = checked.containers.get(worldName);
    if (!info || info.kind !== 'world') throw new WorldError(`No world called ${worldName}.`);
    this.info = info;
    const typeNames = new Set<string>();
    for (const m of info.decl.members) if (m.k === 'type') for (const n of m.names) typeNames.add(n.name);
    for (const r of info.rels) if (r.ty.k === 'rel') for (const c of r.ty.cols) if (c.k === 'atom') typeNames.add(c.name);
    for (const name of typeNames) {
      const exists = Array.from({ length: scope }, (_, i) => {
        const v = this.fresh();
        this.names.set(v, `${name}${i} exists`);
        return v;
      });
      for (let i = 1; i < scope; i++) this.bounds.push(imp(this.v(exists[i]!), this.v(exists[i - 1]!)));
      this.types.set(name, { name, n: scope, exists });
    }
    for (const r of info.rels) this.declareRel(r);
  }

  private fresh(): number {
    return this.nextVar++;
  }
  private v(x: number): Formula {
    return { k: 'var', v: x };
  }

  get primaryVars(): number {
    return this.nextVar - 1;
  }

  private colsOf(t: Ty): string[] {
    if (t.k === 'atom') return [t.name];
    if (t.k === 'rel') return t.cols.map((c) => {
      if (c.k !== 'atom') throw new WorldError('Relations in worlds hold atoms of declared types.');
      return c.name;
    });
    throw new WorldError('Expected a relation or an atom type.');
  }

  private size(cols: string[]): number {
    return cols.reduce((n, c) => n * this.types.get(c)!.n, 1);
  }

  /** The atom indices of the tuple at a row-major position. */
  tupleAt(cols: string[], pos: number): number[] {
    const out: number[] = new Array(cols.length);
    for (let k = cols.length - 1; k >= 0; k--) {
      const n = this.types.get(cols[k]!)!.n;
      out[k] = pos % n;
      pos = Math.floor(pos / n);
    }
    return out;
  }
  private posOf(cols: string[], tuple: number[]): number {
    let p = 0;
    for (let k = 0; k < cols.length; k++) p = p * this.types.get(cols[k]!)!.n + tuple[k]!;
    return p;
  }
  private existsAll(cols: string[], tuple: number[]): Formula {
    return and(...tuple.map((a, k) => this.v(this.types.get(cols[k]!)!.exists[a]!)));
  }

  private declareRel(r: Sym): void {
    const cols = this.colsOf(r.ty);
    const cells: Formula[] = [];
    for (let p = 0; p < this.size(cols); p++) {
      const x = this.fresh();
      const tup = this.tupleAt(cols, p);
      this.names.set(x, `(${tup.map((a, k) => `${cols[k]}${a}`).join(', ')}) in ${r.name}`);
      this.bounds.push(imp(this.v(x), this.existsAll(cols, tup)));
      cells.push(this.v(x));
    }
    const m = { cols, cells };
    this.relVars.set(r.id, m);
    // Multiplicity of the last column given the others: `A -> lone B`.
    const decl = this.info.decl.members.find((x) => x.k === 'rel' && x.name === r.name) as (A.Member & { k: 'rel' }) | undefined;
    const mult = decl && decl.type.k === 'rel' ? decl.type.mult : 'set';
    if (cols.length >= 2 && mult !== 'set') {
      const last = this.types.get(cols[cols.length - 1]!)!.n;
      const prefixCols = cols.slice(0, -1);
      for (let p = 0; p < this.size(prefixCols); p++) {
        const prefix = this.tupleAt(prefixCols, p);
        const row = Array.from({ length: last }, (_, j) => cells[p * last + j]!);
        const guard = this.existsAll(prefixCols, prefix);
        const atMostOne = and(...row.flatMap((a, i) => row.slice(i + 1).map((b) => not(and(a, b)))));
        const atLeastOne = or(...row);
        const c = mult === 'lone' ? atMostOne : mult === 'one' ? and(atMostOne, atLeastOne) : atLeastOne;
        this.bounds.push(imp(guard, c));
      }
    }
  }

  // ── Expressions ──

  private atomMatrix(type: string, i: number): Matrix {
    const n = this.types.get(type)!.n;
    return { cols: [type], cells: Array.from({ length: n }, (_, j) => (j === i ? T : F)) };
  }
  private typeMatrix(type: string): Matrix {
    return { cols: [type], cells: this.types.get(type)!.exists.map((x) => this.v(x)) };
  }

  private zip(a: Matrix, b: Matrix, f: (x: Formula, y: Formula) => Formula): Matrix {
    if (a.cols.join() !== b.cols.join()) throw new WorldError(`These relations have different column types: (${a.cols.join(', ')}) and (${b.cols.join(', ')}).`);
    return { cols: a.cols, cells: a.cells.map((x, i) => f(x, b.cells[i]!)) };
  }

  join(a: Matrix, b: Matrix): Matrix {
    const mid = a.cols[a.cols.length - 1]!;
    if (mid !== b.cols[0]) return { cols: [...a.cols.slice(0, -1), ...b.cols.slice(1)], cells: new Array(this.size([...a.cols.slice(0, -1), ...b.cols.slice(1)])).fill(F) };
    const n = this.types.get(mid)!.n;
    const left = a.cols.slice(0, -1);
    const right = b.cols.slice(1);
    const cols = [...left, ...right];
    const nl = this.size(left);
    const nr = this.size(right);
    const cells: Formula[] = [];
    for (let i = 0; i < nl; i++) {
      for (let j = 0; j < nr; j++) {
        const terms: Formula[] = [];
        for (let k = 0; k < n; k++) terms.push(and(a.cells[i * n + k]!, b.cells[k * nr + j]!));
        cells.push(or(...terms));
      }
    }
    return { cols, cells };
  }

  private transpose(a: Matrix): Matrix {
    const [c0, c1] = a.cols as [string, string];
    const n0 = this.types.get(c0)!.n;
    const n1 = this.types.get(c1)!.n;
    const cells: Formula[] = [];
    for (let j = 0; j < n1; j++) for (let i = 0; i < n0; i++) cells.push(a.cells[i * n1 + j]!);
    return { cols: [c1, c0], cells };
  }

  private closure(a: Matrix, reflexive: boolean): Matrix {
    if (a.cols.length !== 2 || a.cols[0] !== a.cols[1]) throw new WorldError('Closure needs a binary relation from a type to itself.');
    const n = this.types.get(a.cols[0]!)!.n;
    let r = a;
    // Iterated squaring: after k rounds, r holds the paths of length up to 2^k.
    for (let len = 1; len < n; len *= 2) r = this.zip(r, this.join(r, r), (x, y) => or(x, y));
    if (reflexive) {
      const ex = this.types.get(a.cols[0]!)!.exists;
      r = { cols: r.cols, cells: r.cells.map((c, p) => (Math.floor(p / n) === p % n ? or(c, this.v(ex[p % n]!)) : c)) };
    }
    return r;
  }

  /** Compile a relational expression to a matrix. `env` binds quantified variables and parameters. */
  rel(e: A.Expr, env: Map<number, Matrix>): Matrix {
    switch (e.k) {
      case 'var': {
        const s = this.checked.refs.get(e);
        if (!s) throw new WorldError(`Unknown name ${e.name}.`);
        if (env.has(s.id)) return env.get(s.id)!;
        if (s.kind === 'rel') return this.relVars.get(s.id)!;
        if (s.kind === 'type' && s.ty.k === 'atom') return this.typeMatrix(s.ty.name);
        throw new WorldError(`${e.name} cannot be used in a world formula.`);
      }
      case 'field': {
        const s = this.checked.refs.get(e);
        if (!s || s.kind !== 'rel') throw new WorldError(`No relation called ${e.name}.`);
        return this.join(this.rel(e.target, env), this.relVars.get(s.id)!);
      }
      case 'binary': {
        const op = e.op;
        if (op === '.') return this.join(this.rel(e.left, env), this.rel(e.right, env));
        if (op === '+') return this.zip(this.rel(e.left, env), this.rel(e.right, env), (x, y) => or(x, y));
        if (op === '&') return this.zip(this.rel(e.left, env), this.rel(e.right, env), (x, y) => and(x, y));
        if (op === '-') return this.zip(this.rel(e.left, env), this.rel(e.right, env), (x, y) => and(x, not(y)));
        throw new WorldError(`The operator ${op} does not build a relation.`);
      }
      case 'unary': {
        if (e.op === '~') return this.transpose(this.rel(e.arg, env));
        if (e.op === '^' || e.op === '*') return this.closure(this.rel(e.arg, env), e.op === '*');
        throw new WorldError(`The operator ${e.op} does not build a relation.`);
      }
      case 'comprehension': {
        if (e.value || e.seq || e.binders.length !== 1) throw new WorldError('A set in a world is written { x: T | condition }.');
        const b = e.binders[0]!;
        const s = this.checked.refs.get(b)!;
        if (s.ty.k !== 'atom') throw new WorldError('The variable of a set comprehension ranges over an atom type.');
        const t = this.types.get(s.ty.name)!;
        return {
          cols: [t.name],
          cells: t.exists.map((x, i) => and(this.v(x), this.formula(e.body, new Map(env).set(s.id, this.atomMatrix(t.name, i))))),
        };
      }
      case 'if': {
        const c = this.formula(e.cond, env);
        return this.zip(this.rel(e.then, env), this.rel(e.else, env), (x, y) => or(and(c, x), and(not(c), y)));
      }
      case 'call':
        return this.inline(e, env, (body, en) => this.rel(body, en));
      default:
        throw new WorldError(`This kind of expression (${e.k}) is not supported in worlds.`);
    }
  }

  /** Compile a formula. */
  formula(e: A.Expr, env: Map<number, Matrix>): Formula {
    const f = (x: A.Expr) => this.formula(x, env);
    switch (e.k) {
      case 'bool':
        return e.value ? T : F;
      case 'unary':
        if (e.op === '!') return not(f(e.arg));
        break;
      case 'mult': {
        const cells = this.rel(e.arg, env).cells;
        const some = or(...cells);
        const lone = and(...cells.flatMap((a, i) => cells.slice(i + 1).map((b) => not(and(a, b)))));
        return e.m === 'some' ? some : e.m === 'no' ? not(some) : e.m === 'lone' ? lone : and(some, lone);
      }
      case 'binary': {
        const op = e.op;
        if (op === '&&') return and(f(e.left), f(e.right));
        if (op === '||') return or(f(e.left), f(e.right));
        if (op === '==>') return imp(f(e.left), f(e.right));
        if (op === '<==') return imp(f(e.right), f(e.left));
        if (op === '<==>') return iff(f(e.left), f(e.right));
        if (op === 'in' || op === '!in') {
          const sub = this.zip(this.rel(e.left, env), this.rel(e.right, env), (x, y) => imp(x, y));
          const g = and(...sub.cells);
          return op === 'in' ? g : not(g);
        }
        if (op === '==' || op === '!=') {
          if (this.isCard(e.left) || this.isCard(e.right)) return this.compareCard(op, e.left, e.right, env);
          const eq = and(...this.zip(this.rel(e.left, env), this.rel(e.right, env), iff).cells);
          return op === '==' ? eq : not(eq);
        }
        if (['<', '<=', '>', '>='].includes(op)) return this.compareCard(op, e.left, e.right, env);
        break;
      }
      case 'chain': {
        const parts: Formula[] = [];
        for (let i = 0; i < e.ops.length; i++) parts.push(this.compareCard(e.ops[i]!, e.args[i]!, e.args[i + 1]!, env));
        return and(...parts);
      }
      case 'quant': {
        const parts: Formula[] = [];
        this.expand(e.binders, env, (inner, guard) => parts.push(e.q === 'forall' ? imp(guard, this.formula(e.body, inner)) : and(guard, this.formula(e.body, inner))));
        return e.q === 'forall' ? and(...parts) : or(...parts);
      }
      case 'if':
        return or(and(f(e.cond), f(e.then)), and(not(f(e.cond)), f(e.else)));
      case 'call':
        return this.inline(e, env, (body, en) => this.formula(body, en));
      case 'block': {
        let en = env;
        for (const l of e.lets) {
          const s = this.checked.refs.get(l);
          if (!s) throw new WorldError('Unknown let binding.');
          en = new Map(en).set(s.id, this.rel(l.value, en));
        }
        return this.formula(e.body, en);
      }
    }
    throw new WorldError(`This kind of formula (${e.k}${'op' in e ? ` ${String(e.op)}` : ''}) is not supported in worlds.`);
  }

  private isCard(e: A.Expr): boolean {
    return (e.k === 'unary' && e.op === '#') || e.k === 'int';
  }

  /** Cardinality as a vector: count[k] is the condition under which exactly k cells are true. */
  private count(e: A.Expr, env: Map<number, Matrix>): Formula[] {
    if (e.k === 'int') {
      const k = Number(e.value);
      return Array.from({ length: k + 1 }, (_, i) => (i === k ? T : F));
    }
    if (e.k !== 'unary' || e.op !== '#') throw new WorldError('Only #expressions and numbers can be compared in worlds.');
    const cells = this.rel(e.arg, env).cells;
    let dp: Formula[] = [T];
    for (const c of cells) {
      const next: Formula[] = [];
      for (let k = 0; k <= dp.length; k++) next.push(or(and(dp[k] ?? F, not(c)), and(dp[k - 1] ?? F, c)));
      dp = next;
    }
    return dp;
  }

  private compareCard(op: string, l: A.Expr, r: A.Expr, env: Map<number, Matrix>): Formula {
    const a = this.count(l, env);
    const b = this.count(r, env);
    const out: Formula[] = [];
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        const holds = op === '==' ? i === j : op === '!=' ? i !== j : op === '<' ? i < j : op === '<=' ? i <= j : op === '>' ? i > j : i >= j;
        if (holds) out.push(and(a[i]!, b[j]!));
      }
    }
    return or(...out);
  }

  private expand(bs: A.Binder[], env: Map<number, Matrix>, f: (env: Map<number, Matrix>, guard: Formula) => void): void {
    const go = (i: number, en: Map<number, Matrix>, guard: Formula) => {
      if (i === bs.length) return f(en, guard);
      const b = bs[i]!;
      const s = this.checked.refs.get(b)!;
      if (s.ty.k !== 'atom') throw new WorldError(`In a world, ${b.name} must range over an atom type.`);
      const t = this.types.get(s.ty.name)!;
      for (let a = 0; a < t.n; a++) go(i + 1, new Map(en).set(s.id, this.atomMatrix(t.name, a)), and(guard, this.v(t.exists[a]!)));
    };
    go(0, env, T);
  }

  private inline<R>(e: A.Expr & { k: 'call' }, env: Map<number, Matrix>, k: (body: A.Expr, env: Map<number, Matrix>) => R): R {
    const s = this.checked.refs.get(e);
    const info = s ? ([...this.checked.fns.values()].find((x) => x.sym === s) as FnInfo | undefined) : undefined;
    if (!info || !info.decl.body || 'stmts' in info.decl.body) throw new WorldError(`${e.callee} must be a predicate or pure function with an expression body.`);
    const en = new Map(env);
    e.args.forEach((a, i) => en.set(info.params[i]!.id, this.rel(a, env)));
    return k(info.decl.body as A.Expr, en);
  }

  // ── Commands ──

  /** The CNF for a command: bounds, multiplicities, facts, and the command's formula (negated for check). */
  encode(cmd: A.PropDecl): { cnf: Cnf; primary: number } {
    const facts = this.info.facts.map((x) => this.formula(x.expr, new Map()));
    const goal = this.formula(cmd.expr, new Map());
    const body = and(...this.bounds, ...facts, cmd.k === 'check' ? not(goal) : goal);
    const primary = this.primaryVars;
    if (isF(body)) return { cnf: { nvars: primary, clauses: [[]] }, primary };
    const t = tseitin(body, this.nextVar);
    return { cnf: { nvars: Math.max(t.nvars, primary), clauses: t.clauses }, primary };
  }

  /** Decode a model into an instance and relation values for the interpreter. */
  decode(m: boolean[]): { instance: WorldInstance; universe: Map<string, number>; vals: Map<number, Value> } {
    const universe = new Map<string, number>();
    const atoms: WorldInstance['atoms'] = [];
    for (const t of this.types.values()) {
      const n = t.exists.filter((x) => m[x]).length;
      universe.set(t.name, n);
      atoms.push({ type: t.name, names: Array.from({ length: n }, (_, i) => `${t.name}${i}`) });
    }
    const vals = new Map<number, Value>();
    const rels: WorldInstance['rels'] = [];
    for (const r of this.info.rels) {
      const mat = this.relVars.get(r.id)!;
      const tuples: number[][] = [];
      mat.cells.forEach((c, p) => {
        if (c.k === 'var' && m[c.v]) tuples.push(this.tupleAt(mat.cols, p));
      });
      vals.set(r.id, rel(mat.cols.length, tuples.map((t) => t.map((a, k) => ({ t: 'atom' as const, type: mat.cols[k]!, i: a })))));
      rels.push({ name: r.name, cols: mat.cols, tuples: tuples.map((t) => t.map((a, k) => `${mat.cols[k]}${a}`)) });
    }
    return { instance: { atoms, rels }, universe, vals };
  }
}

/** Default scope when a command has no `for n`. */
export const DEFAULT_SCOPE = 3;

/** Run one command of a world: find a counterexample (check) or an instance (run) within the scope. */
export function runCommand(checked: Checked, world: string, cmd: A.PropDecl, opts: { scope?: number; proof?: boolean; exclude?: boolean[][] } = {}): WorldResult {
  const t0 = Date.now();
  const scope = opts.scope ?? cmd.scope ?? DEFAULT_SCOPE;
  const enc = new WorldEncoder(checked, world, scope);
  const { cnf, primary } = enc.encode(cmd);
  const s = new Solver({ proof: opts.proof ?? true });
  s.ensureVars(cnf.nvars);
  let ok = true;
  for (const c of cnf.clauses) if (!s.addClause(c)) ok = false;
  // Exclude instances already shown (for "next instance").
  for (const m of opts.exclude ?? []) if (ok && !s.addClause(Array.from({ length: primary }, (_, i) => (m[i + 1] ? -(i + 1) : i + 1)))) ok = false;
  const r = ok ? s.solve() : 'unsat';
  const stats = { primaryVars: primary, vars: cnf.nvars, clauses: cnf.clauses.length, ms: 0 };
  const kind = cmd.k === 'run' ? 'run' : 'check';
  if (r === 'sat') {
    const { instance, universe, vals } = enc.decode(s.model);
    let instanceChecked = true;
    try {
      const runner = new Runner(checked, { fuel: 1_000_000 });
      const env: Env = { vals, heap: new Heap(), universe };
      for (const f of enc.info.facts) if (runner.ev.eval(f.expr, env) !== true) instanceChecked = false;
      const g = runner.ev.eval(cmd.expr, env);
      if (g !== (kind === 'run')) instanceChecked = false;
    } catch {
      instanceChecked = false;
    }
    stats.ms = Date.now() - t0;
    return { command: cmd, kind, scope, found: true, instance, instanceChecked, stats, model: s.model.slice(0, primary + 1) };
  }
  let proofChecked: boolean | undefined;
  if (r === 'unsat' && (opts.proof ?? true) && !(opts.exclude?.length)) proofChecked = checkDrat(cnf.clauses, s.proof).ok;
  stats.ms = Date.now() - t0;
  return { command: cmd, kind, scope, found: false, proofChecked, stats };
}
