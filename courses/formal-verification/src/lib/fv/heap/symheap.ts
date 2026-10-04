/**
 * The heap verifier (chapters 21–22): symbolic execution with symbolic heaps, in the style of Smallfoot (Berdine,
 * Calcagno and O'Hearn, 2005), for Vouch functions over objects with fields and the built-in list predicates.
 *
 * A symbolic heap is a pure part (equalities and disequalities between values, and arithmetic) and a spatial part:
 * a separating conjunction of field points-to facts `x.f ↦ v` and list segments `lseg(x, y)` along `next`. Each
 * statement transforms the symbolic heap:
 *
 *   - reading or writing x.f needs x.f ↦ v in the heap; if only lseg(x, y) is there and x ≠ y is provable, the
 *     segment is unfolded into x.next ↦ n ∗ (the node's other fields) ∗ lseg(n, y) for a fresh n;
 *   - `new` adds points-to facts for a fresh address, `free x` removes all of x's fields;
 *   - `if` splits the state; infeasible branches are dropped (the pure part goes to the SMT solver);
 *   - a loop is checked with its invariant (a symbolic heap): the invariant must hold on entry with some frame left
 *     over, which the loop body does not touch; the body runs from the invariant and must re-establish it exactly;
 *   - a call is replaced by the callee's contract: subtract its precondition from the heap (frame inference), add
 *     its postcondition;
 *   - at a return, the postcondition must account for the whole heap: anything left over is a leak.
 *
 * Entailment between symbolic heaps is by subtraction: match points-to facts, consume a points-to of x.next or a
 * segment from x to shorten a goal segment from x, and drop provably empty segments. This is incomplete (it can
 * fail on true entailments), and the verdict then says *unknown*, not *error*.
 */
import type * as A from '../vouch/syntax/ast';
import type { Span } from '../vouch/syntax/lexer';
import type { Checked } from '../vouch/check/checker';
import {
  add, and, BOOL, bool, div, eq, freshVar, ge, gt, imp, INT, iff, ite, le, lt, mod, mul, neg, not, num, or, pretty, sub, uSort, v, type Term,
} from '../logic/term';
import { checkSat } from '../smt/solver';

export const LOC = uSort('Loc');
export const NULL = v('null', LOC);

export type Atom = { k: 'pt'; at: Term; field: string; val: Term } | { k: 'seg'; from: Term; to: Term };

export interface SymHeap {
  pure: Term[];
  atoms: Atom[];
}

export interface HeapState {
  env: Map<string, Term>;
  h: SymHeap;
  /** Addresses freed on this path (for better messages). */
  freed: Term[];
}

export interface HeapError {
  kind: 'null' | 'not-owned' | 'freed' | 'leak' | 'post' | 'invariant' | 'precondition' | 'assert' | 'unsupported';
  message: string;
  span: Span;
  /** Was the failure established, or could the entailment prover merely not show the goal? */
  definite: boolean;
}

export interface HeapStep {
  span: Span;
  label: string;
  state: string[];
  event?: string;
  path: number;
}

export interface HeapResult {
  fn: string;
  errors: HeapError[];
  steps: HeapStep[];
  paths: number;
  verified: boolean;
}

class Unsupported extends Error {}

// ── Pure reasoning ──

function derivedFacts(h: SymHeap): Term[] {
  const out: Term[] = [];
  const pts = h.atoms.filter((a): a is Extract<Atom, { k: 'pt' }> => a.k === 'pt');
  for (const p of pts) out.push(not(eq(p.at, NULL)));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (pts[i]!.field === pts[j]!.field) out.push(not(eq(pts[i]!.at, pts[j]!.at)));
  return out;
}

/** Does the pure part (with what separation implies) entail f? */
function proves(h: SymHeap, f: Term): boolean {
  if (f.op === 'true') return true;
  const r = checkSat([...h.pure, ...derivedFacts(h), not(f)], { timeout: 2000 });
  return r.status === 'unsat';
}

function consistent(h: SymHeap): boolean {
  const r = checkSat([...h.pure, ...derivedFacts(h)], { timeout: 2000 });
  return r.status !== 'unsat';
}

const sameLoc = (h: SymHeap, a: Term, b: Term) => a === b || proves(h, eq(a, b));

// ── Showing states ──

const clean = (s: string) => s.replace(/!\d+/g, (m) => `′${m.slice(1)}`);
export function showAtom(a: Atom): string {
  return clean(a.k === 'pt' ? `${pretty(a.at)}.${a.field} ↦ ${pretty(a.val)}` : a.to === NULL ? `list(${pretty(a.from)})` : `lseg(${pretty(a.from)}, ${pretty(a.to)})`);
}
export function showState(s: HeapState): string[] {
  const env = [...s.env].filter(([k]) => !k.startsWith('$')).map(([k, t]) => `${k} = ${clean(pretty(t))}`);
  const spatial = s.h.atoms.length ? s.h.atoms.map(showAtom).join(' ∗ ') : 'emp';
  const pure = s.h.pure.filter((p) => p.op !== 'true').map((p) => clean(pretty(p)));
  return [env.join(', '), spatial, ...(pure.length ? [pure.join(' ∧ ')] : [])];
}

// ── The verifier ──

interface ClassInfo {
  fields: { name: string; ref: boolean }[];
}

export class HeapVerifier {
  private classes = new Map<string, ClassInfo>();
  private errors: HeapError[] = [];
  steps: HeapStep[] = [];
  private pathCount = 0;
  private fn!: A.FnDecl;
  private entry!: HeapState;

  constructor(
    private checked: Checked,
    private source = '',
  ) {
    for (const d of checked.program.decls) {
      if (d.k === 'class') this.classes.set(d.name, { fields: d.fields.map((f) => ({ name: f.name, ref: f.type.k === 'ref' })) });
    }
  }

  private sortOf(t: A.TypeExpr | undefined): 'loc' | 'int' | 'bool' {
    if (!t) return 'int';
    if (t.k === 'ref') return 'loc';
    if ('name' in t && (t as { name: string }).name === 'bool') return 'bool';
    return 'int';
  }
  private sortOfExpr(e: A.Expr): 'loc' | 'int' | 'bool' {
    const t = this.checked.types.get(e);
    if (!t) return 'int';
    return t.k === 'ref' ? 'loc' : t.k === 'bool' ? 'bool' : 'int';
  }
  private fresh(name: string, sort: 'loc' | 'int' | 'bool'): Term {
    return freshVar(name, sort === 'loc' ? LOC : sort === 'bool' ? BOOL : INT);
  }
  private fieldSort(cls: string | undefined, field: string): 'loc' | 'int' {
    const c = cls ? this.classes.get(cls) : undefined;
    for (const ci of c ? [c] : this.classes.values()) {
      const f = ci.fields.find((x) => x.name === field);
      if (f) return f.ref ? 'loc' : 'int';
    }
    return 'int';
  }
  /** The class of a list node: the class with a `next` field (the first one). */
  private listClass(): ClassInfo | undefined {
    return [...this.classes.values()].find((c) => c.fields.some((f) => f.name === 'next'));
  }

  private record(s: HeapState, span: Span, label: string, event?: string) {
    if (this.steps.length < 400) this.steps.push({ span, label, state: showState(s), event, path: this.pathCount });
  }
  private error(kind: HeapError['kind'], message: string, span: Span, definite = true) {
    if (!this.errors.some((e) => e.span.start === span.start && e.kind === kind)) this.errors.push({ kind, message, span, definite });
  }

  // ── Expressions (pure values only; field reads are statements) ──

  private expr(e: A.Expr, s: HeapState, old = false): Term {
    switch (e.k) {
      case 'int':
        return num(e.value);
      case 'bool':
        return bool(e.value);
      case 'null':
        return NULL;
      case 'var': {
        const env = old ? this.entry.env : s.env;
        const t = env.get(e.name);
        if (!t) throw new Unsupported(`unknown variable ${e.name}`);
        return t;
      }
      case 'old':
        return this.expr(e.arg, this.entry, true);
      case 'field': {
        // A field read inside an assertion or a condition: the value must be in the heap.
        const base = this.expr(e.target, s, old);
        const st = old ? this.entry : s;
        const p = st.h.atoms.find((a) => a.k === 'pt' && a.field === e.name && sameLoc(st.h, a.at, base)) as Extract<Atom, { k: 'pt' }> | undefined;
        if (!p) throw new Unsupported(`the value of ${clean(pretty(base))}.${e.name} is not available here`);
        return p.val;
      }
      case 'unary':
        if (e.op === '-') return neg(this.expr(e.arg, s, old));
        if (e.op === '!') return not(this.expr(e.arg, s, old));
        break;
      case 'chain': {
        const parts: Term[] = [];
        for (let i = 0; i < e.ops.length; i++) parts.push(cmp(e.ops[i]!, this.expr(e.args[i]!, s, old), this.expr(e.args[i + 1]!, s, old)));
        return and(...parts);
      }
      case 'if':
        return ite(this.expr(e.cond, s, old), this.expr(e.then, s, old), this.expr(e.else, s, old));
      case 'binary': {
        const op = e.op;
        if (op === '&&') return and(this.expr(e.left, s, old), this.expr(e.right, s, old));
        if (op === '||') return or(this.expr(e.left, s, old), this.expr(e.right, s, old));
        if (op === '==>') return imp(this.expr(e.left, s, old), this.expr(e.right, s, old));
        const a = this.expr(e.left, s, old);
        const b = this.expr(e.right, s, old);
        switch (op) {
          case '+': return add(a, b);
          case '-': return sub(a, b);
          case '*': return mul(a, b);
          case '/': return div(a, b);
          case '%': return mod(a, b);
          case '==': return a.sort.k === 'bool' ? iff(a, b) : eq(a, b);
          case '!=': return not(a.sort.k === 'bool' ? iff(a, b) : eq(a, b));
          case '<': case '<=': case '>': case '>=': return cmp(op, a, b);
        }
      }
    }
    throw new Unsupported(`this expression is not supported by the heap verifier`);
  }

  /** A heap assertion as a symbolic heap (with the values it mentions evaluated in s, or in the entry state for old). */
  assertion(e: A.Expr, s: HeapState, old = false): SymHeap {
    const out: SymHeap = { pure: [], atoms: [] };
    const walk = (x: A.Expr) => {
      if (x.k === 'emp') return;
      if (x.k === 'binary' && (x.op === '**' || x.op === '&&') && (isHeap(x.left) || isHeap(x.right))) {
        walk(x.left);
        walk(x.right);
        return;
      }
      if (x.k === 'binary' && x.op === '|->') {
        if (x.left.k !== 'field') throw new Unsupported('the left side of |-> must be a field');
        out.atoms.push({ k: 'pt', at: this.expr(x.left.target, s, old), field: x.left.name, val: this.expr(x.right, s, old) });
        return;
      }
      if (x.k === 'call' && (x.callee === 'list' || x.callee === 'lseg')) {
        out.atoms.push({ k: 'seg', from: this.expr(x.args[0]!, s, old), to: x.callee === 'list' ? NULL : this.expr(x.args[1]!, s, old) });
        return;
      }
      if (x.k === 'old') {
        const inner = this.assertion(x.arg, this.entry, true);
        out.pure.push(...inner.pure);
        out.atoms.push(...inner.atoms);
        return;
      }
      out.pure.push(this.expr(x, s, old));
    };
    walk(e);
    return out;
  }

  // ── Entailment by subtraction ──

  /**
   * Does `left` entail `goal ∗ frame` for some frame? Returns the frame (what is left of `left`), or a reason.
   * With `exact`, the frame must be empty (or provably empty segments).
   */
  entail(left: SymHeap, goal: SymHeap, exact: boolean): { ok: true; frame: Atom[] } | { ok: false; reason: string; definite: boolean } {
    const L = [...left.atoms];
    const G = [...goal.atoms];
    const ctx: SymHeap = { pure: left.pure, atoms: L };
    const pending: Term[] = [...goal.pure];
    let guard = 0;
    while (G.length) {
      if (++guard > 500) return { ok: false, reason: 'the entailment prover gave up', definite: false };
      const g = G.shift()!;
      if (g.k === 'pt') {
        const i = L.findIndex((a) => a.k === 'pt' && a.field === g.field && sameLoc(ctx, a.at, g.at));
        if (i < 0) {
          // Unfold a segment that must contain g.at at its head.
          const j = L.findIndex((a) => a.k === 'seg' && sameLoc(ctx, a.from, g.at) && proves(ctx, not(eq(a.from, a.to))));
          if (j >= 0) {
            L.splice(j, 1, ...this.unfold(L[j] as Extract<Atom, { k: 'seg' }>));
            G.unshift(g);
            continue;
          }
          return { ok: false, reason: `${showAtom(g)} is not in the heap`, definite: false };
        }
        const a = L[i] as Extract<Atom, { k: 'pt' }>;
        pending.push(a.val.sort.k === 'bool' ? iff(a.val, g.val) : eq(a.val, g.val));
        L.splice(i, 1);
        continue;
      }
      // A goal segment.
      if (sameLoc(ctx, g.from, g.to)) continue;
      const p = L.findIndex((a) => a.k === 'pt' && a.field === 'next' && sameLoc(ctx, a.at, g.from));
      if (p >= 0) {
        const node = L[p] as Extract<Atom, { k: 'pt' }>;
        // The node's other fields belong to the segment too.
        for (let k = L.length - 1; k >= 0; k--) {
          const a = L[k]!;
          if (a.k === 'pt' && sameLoc(ctx, a.at, node.at)) L.splice(k, 1);
        }
        pending.push(not(eq(g.from, g.to)));
        G.unshift({ k: 'seg', from: node.val, to: g.to });
        continue;
      }
      const sgi = L.findIndex((a) => a.k === 'seg' && sameLoc(ctx, a.from, g.from));
      if (sgi >= 0) {
        const seg = L[sgi] as Extract<Atom, { k: 'seg' }>;
        if (sameLoc(ctx, seg.to, g.to)) {
          L.splice(sgi, 1);
          continue;
        }
        // lseg(x, y) ∗ … ⊢ lseg(x, z): consume lseg(x, y) and prove lseg(y, z), provided z cannot lie inside the
        // consumed segment (z is null, or is allocated elsewhere in the heap).
        const zSafe = proves(ctx, eq(g.to, NULL)) || L.some((a) => a !== seg && ((a.k === 'pt' && sameLoc(ctx, a.at, g.to)) || (a.k === 'seg' && sameLoc(ctx, a.from, g.to) && proves(ctx, not(eq(a.from, a.to))))));
        if (zSafe) {
          L.splice(sgi, 1);
          G.unshift({ k: 'seg', from: seg.to, to: g.to });
          continue;
        }
      }
      return { ok: false, reason: `${showAtom(g)} cannot be shown`, definite: false };
    }
    for (const f of pending) if (!proves(ctx, f)) return { ok: false, reason: `${clean(pretty(f))} does not follow`, definite: false };
    const frame = L.filter((a) => !(a.k === 'seg' && sameLoc(ctx, a.from, a.to)));
    if (exact && frame.length) return { ok: false, reason: `left over: ${frame.map(showAtom).join(' ∗ ')}`, definite: true };
    return { ok: true, frame };
  }

  /** lseg(x, y) with x ≠ y: x.next ↦ n ∗ (x's other fields ↦ fresh) ∗ lseg(n, y). */
  private unfold(seg: Extract<Atom, { k: 'seg' }>): Atom[] {
    const cls = this.listClass();
    const n = this.fresh('n', 'loc');
    const out: Atom[] = [{ k: 'pt', at: seg.from, field: 'next', val: n }];
    for (const f of cls?.fields ?? []) if (f.name !== 'next') out.push({ k: 'pt', at: seg.from, field: f.name, val: this.fresh(f.name, f.ref ? 'loc' : 'int') });
    out.push({ k: 'seg', from: n, to: seg.to });
    return out;
  }

  /** Find x.f in the heap, unfolding a segment if needed. Returns the index, or reports an error. */
  private access(s: HeapState, at: Term, field: string, span: Span, what: string): number | undefined {
    for (let round = 0; round < 3; round++) {
      const i = s.h.atoms.findIndex((a) => a.k === 'pt' && a.field === field && sameLoc(s.h, a.at, at));
      if (i >= 0) return i;
      const j = s.h.atoms.findIndex((a) => a.k === 'seg' && sameLoc(s.h, a.from, at));
      if (j >= 0) {
        const seg = s.h.atoms[j] as Extract<Atom, { k: 'seg' }>;
        if (proves(s.h, not(eq(seg.from, seg.to)))) {
          s.h.atoms.splice(j, 1, ...this.unfold(seg));
          this.record(s, span, `unfold ${showAtom(seg)}`, 'unfold');
          continue;
        }
        const nullish = seg.to === NULL ? `${clean(pretty(at))} may be null (the list may be empty)` : `the segment from ${clean(pretty(at))} may be empty`;
        this.error('null', `Possible null dereference: ${what} ${clean(pretty(at))}.${field}, but ${nullish}.`, span);
        return undefined;
      }
      if (proves(s.h, eq(at, NULL))) {
        this.error('null', `Null dereference: ${what} ${clean(pretty(at))}.${field}, and ${clean(pretty(at))} is null.`, span);
        return undefined;
      }
      if (s.freed.some((f) => sameLoc(s.h, f, at))) {
        this.error('freed', `Use after free: ${what} ${clean(pretty(at))}.${field}, but that object has been freed.`, span);
        return undefined;
      }
      this.error('not-owned', `Access to memory this code does not own: ${what} ${clean(pretty(at))}.${field}, which no assertion gives access to (it may be null or not allocated).`, span);
      return undefined;
    }
    return undefined;
  }

  // ── Statements ──

  verify(name: string): HeapResult {
    const info = this.checked.fns.get(name);
    if (!info) throw new Error(`no function ${name}`);
    this.fn = info.decl;
    this.errors = [];
    this.steps = [];
    const env = new Map<string, Term>();
    for (const p of this.fn.params) env.set(p.name, this.fresh(p.name, this.sortOf(p.type)));
    const s0: HeapState = { env, h: { pure: [], atoms: [] }, freed: [] };
    this.entry = s0;
    try {
      for (const r of this.fn.spec.requires) {
        const a = this.assertion(r.value, s0);
        s0.h.pure.push(...a.pure);
        s0.h.atoms.push(...a.atoms);
      }
      this.entry = { env: new Map(env), h: { pure: [...s0.h.pure], atoms: [...s0.h.atoms] }, freed: [] };
      this.record(s0, this.fn.nameSpan, 'on entry: the precondition');
      const body = this.fn.body as A.Block;
      const ends = this.block(body.stmts, [s0]);
      for (const s of ends) this.ret(s, undefined, this.fn.nameSpan);
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      this.error('unsupported', `Not supported by the heap verifier: ${e.message}.`, this.fn.nameSpan, false);
    }
    return { fn: name, errors: this.errors, steps: this.steps, paths: this.pathCount, verified: !this.errors.length };
  }

  private clone(s: HeapState): HeapState {
    return { env: new Map(s.env), h: { pure: [...s.h.pure], atoms: [...s.h.atoms] }, freed: [...s.freed] };
  }

  /** Execute statements on each state; returns the states that fall off the end (returns are handled inside). */
  private block(stmts: A.Stmt[], states: HeapState[]): HeapState[] {
    let cur = states;
    for (const st of stmts) {
      const next: HeapState[] = [];
      for (const s of cur) next.push(...this.stmt(st, s));
      cur = next;
    }
    return cur;
  }

  private text(span: Span): string {
    return this.source.slice(span.start, span.end).split('\n')[0]!.trim();
  }

  private stmt(st: A.Stmt, s: HeapState): HeapState[] {
    const label = this.text(st.span);
    switch (st.k) {
      case 'let':
      case 'assign': {
        const target = st.k === 'let' ? st.name : undefined;
        const value = st.k === 'let' ? st.init : st.value;
        if (!value) throw new Unsupported('declarations need an initial value');
        if (st.k === 'assign' && st.target.k === 'field') {
          // Mutation x.f = e.
          const at = this.expr(st.target.target, s);
          const val = this.rhs(value, s, st.span);
          if (!val) return [];
          const i = this.access(s, at, st.target.name, st.span, 'writing');
          if (i === undefined) return [];
          const a = s.h.atoms[i] as Extract<Atom, { k: 'pt' }>;
          s.h.atoms[i] = { ...a, val };
          this.record(s, st.span, label);
          return [s];
        }
        if (st.k === 'assign' && (st.target.k !== 'var' || st.op !== '=')) throw new Unsupported('this assignment');
        const name = target ?? ((st as { target: A.Expr }).target as { name: string }).name;
        const val = this.rhs(value, s, st.span);
        if (!val) return [];
        s.env.set(name, val);
        this.record(s, st.span, label);
        return [s];
      }
      case 'free': {
        const at = this.expr(st.target, s);
        const cls = this.checked.types.get(st.target);
        const fields = (cls?.k === 'ref' ? this.classes.get(cls.cls)?.fields : undefined) ?? [];
        for (const f of fields) {
          const i = this.access(s, at, f.name, st.span, 'freeing');
          if (i === undefined) return [];
          s.h.atoms.splice(i, 1);
        }
        s.freed.push(at);
        this.record(s, st.span, label, 'free');
        return [s];
      }
      case 'if': {
        const c = this.expr(st.cond, s);
        const out: HeapState[] = [];
        for (const [cond, body] of [[c, st.then.stmts], [not(c), st.else ? ('stmts' in st.else ? (st.else as A.Block).stmts : [st.else as A.Stmt]) : []]] as const) {
          const b = this.clone(s);
          b.h.pure.push(cond);
          if (!consistent(b.h)) continue;
          this.pathCount++;
          this.record(b, st.span, `${label} — ${cond === c ? 'then' : 'else'} branch`, 'branch');
          out.push(...this.block([...body], [b]));
        }
        return out;
      }
      case 'while':
        return this.loop(st, s);
      case 'return': {
        const val = st.value ? this.rhs(st.value, s, st.span) : undefined;
        if (st.value && !val) return [];
        this.ret(s, val, st.span);
        return [];
      }
      case 'assert': {
        const goal = this.assertion(st.cond, s);
        const r = this.entail(s.h, goal, false);
        if (!r.ok) this.error('assert', `The assertion may not hold: ${r.reason}.`, st.span, false);
        else s.h.pure.push(...goal.pure);
        this.record(s, st.span, label);
        return [s];
      }
      case 'expr': {
        if (st.expr.k === 'call') {
          const r = this.call(st.expr, s, st.span);
          return r ? [r.state] : [];
        }
        throw new Unsupported('expression statements other than calls');
      }
      case 'block':
        return this.block(st.body.stmts, [s]);
      case 'skip':
        return [s];
      default:
        throw new Unsupported(`\`${st.k}\` statements`);
    }
  }

  /** The value of a right-hand side: a pure expression, a field read, `new`, or a call. */
  private rhs(e: A.Expr, s: HeapState, span: Span): Term | undefined {
    if (e.k === 'field') {
      const at = this.expr(e.target, s);
      const i = this.access(s, at, e.name, span, 'reading');
      if (i === undefined) return undefined;
      return (s.h.atoms[i] as Extract<Atom, { k: 'pt' }>).val;
    }
    if (e.k === 'new') {
      const at = this.fresh(e.cls.toLowerCase(), 'loc');
      const cls = this.classes.get(e.cls);
      for (const f of cls?.fields ?? []) {
        const given = e.fields.find((x) => x.name === f.name);
        const val = given ? this.expr(given.value, s) : f.ref ? NULL : num(0);
        s.h.atoms.push({ k: 'pt', at, field: f.name, val });
      }
      s.h.pure.push(not(eq(at, NULL)));
      return at;
    }
    if (e.k === 'call' && this.checked.fns.has(e.callee)) {
      const r = this.call(e, s, span);
      if (!r) return undefined;
      Object.assign(s, r.state);
      return r.result;
    }
    return this.expr(e, s);
  }

  /** A call: subtract the callee's precondition (frame inference), add its postcondition. */
  private call(e: A.Expr & { k: 'call' }, s: HeapState, span: Span): { state: HeapState; result?: Term } | undefined {
    const callee = this.checked.fns.get(e.callee);
    if (!callee) throw new Unsupported(`the call of ${e.callee}`);
    const d = callee.decl;
    const args = e.args.map((a) => this.expr(a, s));
    const calleeEnv = new Map(d.params.map((p, i) => [p.name, args[i]!] as [string, Term]));
    const callerEntry = this.entry;
    const pre: HeapState = { env: calleeEnv, h: { pure: [], atoms: [] }, freed: [] };
    this.entry = pre;
    try {
      const want: SymHeap = { pure: [], atoms: [] };
      for (const r of d.spec.requires) {
        const a = this.assertion(r.value, pre);
        want.pure.push(...a.pure);
        want.atoms.push(...a.atoms);
      }
      const r = this.entail(s.h, want, false);
      if (!r.ok) {
        this.error('precondition', `The precondition of ${d.name} may not hold here: ${r.reason}.`, span, r.definite);
        return undefined;
      }
      // The callee's precondition values are fixed by the call; its postcondition adds new facts.
      const entryHeap: HeapState = { env: calleeEnv, h: { pure: [...s.h.pure, ...want.pure], atoms: [...s.h.atoms.filter((a) => !r.frame.includes(a))] }, freed: [] };
      this.entry = entryHeap;
      const post: HeapState = { env: new Map(calleeEnv), h: { pure: [], atoms: [] }, freed: [] };
      const result = d.result ? this.fresh(`${d.name}_result`, this.sortOf(d.result.type)) : undefined;
      if (result) post.env.set('result', result);
      const got: SymHeap = { pure: [], atoms: [] };
      for (const q of d.spec.ensures) {
        const a = this.assertion(q.value, post);
        got.pure.push(...a.pure);
        got.atoms.push(...a.atoms);
      }
      const state: HeapState = { env: s.env, h: { pure: [...s.h.pure, ...got.pure], atoms: [...r.frame, ...got.atoms] }, freed: s.freed };
      this.record(state, span, `call ${d.name}: its precondition is taken from the heap, the rest is the frame`, 'call');
      return { state, result };
    } finally {
      this.entry = callerEntry;
    }
  }

  private ret(s: HeapState, val: Term | undefined, span: Span): void {
    const post: HeapState = { env: new Map(s.env), h: s.h, freed: s.freed };
    if (val) post.env.set('result', val);
    const goal: SymHeap = { pure: [], atoms: [] };
    try {
      for (const q of this.fn.spec.ensures) {
        const a = this.assertion(q.value, post);
        goal.pure.push(...a.pure);
        goal.atoms.push(...a.atoms);
      }
    } catch (e) {
      if (!(e instanceof Unsupported)) throw e;
      this.error('post', `The postcondition cannot be checked here: ${e.message}.`, span, false);
      return;
    }
    const r = this.entail(s.h, goal, true);
    this.record(s, span, 'at the return: the postcondition must account for the whole heap', 'return');
    if (!r.ok) {
      if (r.reason.startsWith('left over')) this.error('leak', `Memory leak: when ${this.fn.name} returns, ${r.reason.replace('left over: ', '')} is still allocated but no longer described by the postcondition.`, span, true);
      else this.error('post', `The postcondition may not hold: ${r.reason}.`, span, false);
    }
  }

  private loop(st: A.Stmt & { k: 'while' }, s: HeapState): HeapState[] {
    const label = this.text(st.span);
    const inv = (state: HeapState) => {
      const h: SymHeap = { pure: [], atoms: [] };
      for (const i of st.spec.invariants) {
        const a = this.assertion(i.value, state);
        h.pure.push(...a.pure);
        h.atoms.push(...a.atoms);
      }
      return h;
    };
    // 1. On entry: the invariant, with a frame the loop does not touch.
    const entry = this.entail(s.h, inv(s), false);
    if (!entry.ok) {
      this.error('invariant', `The loop invariant may not hold on entry: ${entry.reason}.`, st.span, entry.definite);
      return [];
    }
    const frame = entry.frame;
    // 2. An arbitrary iteration: fresh values for the variables the loop assigns, the invariant's heap only.
    const assigned = assignedIn(st.body.stmts);
    const head: HeapState = { env: new Map(s.env), h: { pure: [...s.h.pure], atoms: [] }, freed: [...s.freed] };
    for (const x of assigned) {
      const old = head.env.get(x);
      if (old) head.env.set(x, this.fresh(x, old.sort.k === 'u' ? 'loc' : old.sort.k === 'bool' ? 'bool' : 'int'));
    }
    const ih = inv(head);
    head.h.pure.push(...ih.pure);
    head.h.atoms.push(...ih.atoms);
    this.record(head, st.span, `${label} — an arbitrary iteration starts from the invariant (the frame is set aside: ${frame.length ? frame.map(showAtom).join(' ∗ ') : 'emp'})`, 'loop');
    const c = this.expr(st.cond, head);
    const body = this.clone(head);
    body.h.pure.push(c);
    if (consistent(body.h)) {
      for (const end of this.block(st.body.stmts, [body])) {
        const back = this.entail(end.h, inv(end), true);
        if (!back.ok) this.error(back.reason.startsWith('left over') ? 'leak' : 'invariant', back.reason.startsWith('left over') ? `The loop body leaks: ${back.reason.replace('left over: ', '')} is not described by the invariant.` : `The loop invariant may not be preserved: ${back.reason}.`, st.span, back.definite);
      }
    }
    // 3. After the loop: the invariant, the negated condition, and the frame.
    const exit = this.clone(head);
    exit.h.pure.push(not(c));
    exit.h.atoms.push(...frame);
    if (!consistent(exit.h)) return [];
    this.record(exit, st.span, `${label} — after the loop: the invariant, the exit condition and the frame`, 'loop-exit');
    return [exit];
  }
}

function cmp(op: string, a: Term, b: Term): Term {
  return op === '<' ? lt(a, b) : op === '<=' ? le(a, b) : op === '>' ? gt(a, b) : ge(a, b);
}

function isHeap(e: A.Expr): boolean {
  if (e.k === 'emp') return true;
  if (e.k === 'call' && (e.callee === 'list' || e.callee === 'lseg')) return true;
  if (e.k === 'binary' && (e.op === '|->' || e.op === '**')) return true;
  if (e.k === 'binary' && e.op === '&&') return isHeap(e.left) || isHeap(e.right);
  if (e.k === 'old') return isHeap(e.arg);
  return false;
}

function assignedIn(stmts: A.Stmt[], out = new Set<string>()): Set<string> {
  for (const s of stmts) {
    if (s.k === 'assign' && s.target.k === 'var') out.add(s.target.name);
    if (s.k === 'let') out.add(s.name);
    if (s.k === 'if') {
      assignedIn(s.then.stmts, out);
      if (s.else) assignedIn('stmts' in s.else ? (s.else as A.Block).stmts : [s.else as A.Stmt], out);
    }
    if (s.k === 'while') assignedIn(s.body.stmts, out);
    if (s.k === 'block') assignedIn(s.body.stmts, out);
  }
  return out;
}

/** Does this function use the heap (references, heap assertions)? */
export function usesHeap(d: A.FnDecl): boolean {
  if (d.params.some((p) => p.type.k === 'ref') || d.result?.type.k === 'ref') return true;
  return [...d.spec.requires, ...d.spec.ensures].some((r) => isHeap(r.value));
}

export { Unsupported as HeapUnsupported };
