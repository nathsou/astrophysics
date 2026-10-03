/**
 * The verification-condition generator (chapters 17–20): turns a Vouch function and its contract into proof
 * obligations, each a formula the SMT solver must show valid.
 *
 * It executes the body symbolically, forwards, keeping a symbolic state (a symbolic value per variable) and a path
 * condition. Every place where the reference interpreter would check something — a precondition, an array index,
 * a division, a machine-integer operation, an assertion, a loop invariant, a termination measure, a postcondition —
 * becomes an obligation: "the path condition implies the check". After an obligation the check is assumed, as the
 * interpreter would have stopped otherwise.
 *
 *   - Branches are explored separately and merged at the join (values become if-then-else terms).
 *   - A loop is cut by its invariant (Floyd 1967; Hoare 1969): the invariant must hold on entry; then the
 *     variables the loop modifies are replaced by fresh ones about which only the invariant is known ("havoc"),
 *     one arbitrary iteration must re-establish the invariant and decrease the measure, and after the loop the
 *     invariant and the negated condition are all that is known.
 *   - A call to a function is replaced by its contract: check the precondition, havoc what the callee may modify,
 *     assume the postcondition. Predicates and pure functions are inlined, or axiomatised when recursive.
 *
 * Arithmetic in contracts (and in ghost code) is mathematical; machine integers in executable code overflow, and
 * the checker types such expressions accordingly.
 */
import type * as A from '../syntax/ast';
import { isBlock } from '../syntax/ast';
import type { Span } from '../syntax/lexer';
import type { Checked, FnInfo } from '../check/checker';
import { assignable, intBounds, isIntLike, type Ty } from '../check/types';
import type { Sym } from '../check/symbols';
import {
  add, and, app, arraySort, BOOL, bvbin, bvnum, bvun, div, eq, exists, forall, freshVar, ge, gt, iff, imp, INT, ite, le, lt, mul, neg,
  not, num, or, select, sub, TRUE, type Term,
} from '../../logic/term';
import {
  asTerm, defaultValue, eqS, freshValue, isScalarTy, joinS, scalar, seqConcat, seqContains, seqLiteral, seqSlice, seqStore, sortOf,
  typeFacts, Unsupported, type SVal,
} from './sval';

export type ObligationKind =
  | 'precondition'
  | 'postcondition'
  | 'invariant-entry'
  | 'invariant-preserved'
  | 'decreases'
  | 'assert'
  | 'bounds'
  | 'division'
  | 'overflow'
  | 'narrowing'
  | 'well-formed';

export interface Snapshot {
  label: string;
  vars: { name: string; value: SVal; ty: Ty }[];
}

export interface Obligation {
  kind: ObligationKind;
  span: Span;
  message: string;
  hyps: Term[];
  goal: Term;
  /** States worth showing when the obligation fails (entry, loop head, here). */
  snapshots: Snapshot[];
}

interface State {
  env: Map<number, SVal>;
  path: Term[];
  alive: boolean;
}

interface Cx {
  st: State;
  /** Facts that hold where the expression is evaluated (short-circuit guards, branch conditions in expressions). */
  guards: Term[];
  /** In a contract or ghost code: arithmetic is mathematical, no overflow obligations. */
  spec: boolean;
  /** Bound variables of enclosing quantifiers (obligations inside are quantified over them). */
  qvars: Term[];
  /** Values of quantifier binders, let-bound names and inlined parameters, by symbol id (shadowing env). */
  local: Map<number, SVal>;
  /** Evaluate in the entry state (inside old()). */
  inOld?: boolean;
  /** Do not record obligations (axioms, comprehension bodies evaluated lazily). */
  quiet?: boolean;
}

interface LoopCx {
  breaks: State[];
}

export interface FunctionVcs {
  fn: string;
  obligations: Obligation[];
  /** Axioms (definitions of recursive pure functions) to add to every obligation. */
  axioms: Term[];
  /** The symbolic values of the parameters at entry: counterexamples are read from them. */
  params: { sym: Sym; value: SVal }[];
  /** Loops without a `decreases` clause (their termination is assumed). */
  unmeasuredLoops: number;
}

export function generate(checked: Checked, info: FnInfo): FunctionVcs {
  return new VcGen(checked, info).run();
}

class VcGen {
  private obligations: Obligation[] = [];
  private axioms: Term[] = [];
  private axiomatised = new Set<string>();
  private entry = new Map<number, SVal>();
  private entrySnapshot: Snapshot = { label: 'entry', vars: [] };
  private loopHead: Snapshot | undefined;
  private loops: LoopCx[] = [];
  private unmeasured = 0;
  private recursive: Set<string>;
  private measureAtEntry: SVal[] | undefined;

  constructor(
    private checked: Checked,
    private info: FnInfo,
  ) {
    this.recursive = recursiveFns(checked);
  }

  run(): FunctionVcs {
    const d = this.info.decl;
    const st: State = { env: new Map(), path: [], alive: true };
    const params: { sym: Sym; value: SVal }[] = [];
    for (const p of this.info.params) {
      const v = freshValue(p.ty, p.name);
      st.env.set(p.id, v);
      this.entry.set(p.id, v);
      st.path.push(...typeFacts(p.ty, v));
      params.push({ sym: p, value: v });
    }
    this.entrySnapshot = { label: 'on entry', vars: params.map((p) => ({ name: p.sym.name, value: p.value, ty: p.sym.ty })) };
    for (const r of d.spec.requires) st.path.push(this.formula(r.value, this.cx(st, true)));
    if (d.spec.decreases) this.measureAtEntry = d.spec.decreases.map((e) => this.ex(e, this.cx(st, true)));
    if (this.info.result) st.env.set(this.info.result.id, defaultValue(this.info.result.ty));
    const body = d.body;
    if (!body) throw new Unsupported(`${d.name} has no body`);
    if (isBlock(body as A.Block | A.Stmt) && 'stmts' in body) {
      this.block(body as A.Block, st);
      if (st.alive) this.postconditions(st, d.nameSpan);
    } else {
      const v = this.ex(body as A.Expr, this.cx(st, d.flavour !== 'fn'));
      st.env.set(this.info.result!.id, v);
      this.postconditions(st, d.nameSpan);
    }
    return { fn: d.name, obligations: this.obligations, axioms: this.axioms, params, unmeasuredLoops: this.unmeasured };
  }

  private cx(st: State, spec: boolean): Cx {
    return { st, guards: [], spec, qvars: [], local: new Map() };
  }

  // ── Obligations ──

  private snapshot(st: State, label: string): Snapshot {
    const vars: Snapshot['vars'] = [];
    for (const [id, value] of st.env) {
      const s = this.checked.symbols[id - 1];
      if (s && (s.kind === 'local' || s.kind === 'param' || s.kind === 'result')) vars.push({ name: s.name, value, ty: s.ty });
    }
    return { label, vars };
  }

  /** Record "path ∧ guards ⟹ goal"; then assume it. */
  private oblige(cx: Cx, goal: Term, kind: ObligationKind, span: Span, message: string): void {
    if (cx.quiet) return;
    const g = cx.qvars.length ? forall(cx.qvars, imp(and(...cx.guards), goal)) : goal;
    const hyps = cx.qvars.length ? [...cx.st.path] : [...cx.st.path, ...cx.guards];
    if (g.op !== 'true') {
      const snaps = [this.entrySnapshot, ...(this.loopHead ? [this.loopHead] : []), this.snapshot(cx.st, 'here')];
      this.obligations.push({ kind, span, message, hyps, goal: g, snapshots: snaps });
    }
    if (!cx.qvars.length) cx.st.path.push(cx.guards.length ? imp(and(...cx.guards), goal) : goal);
  }

  private postconditions(st: State, span: Span): void {
    const d = this.info.decl;
    for (const e of d.spec.ensures) {
      const cx = this.cx(st, true);
      const f = this.formula(e.value, cx);
      this.oblige(cx, f, 'postcondition', e.span, `The postcondition${e.label ? ` ${e.label}` : ''} of ${d.name}`);
    }
    void span;
  }

  // ── Expressions ──

  private sym(n: object): Sym {
    const s = this.checked.refs.get(n);
    if (!s) throw new Unsupported('an unresolved name');
    return s;
  }

  private ty(e: A.Expr): Ty {
    return this.checked.types.get(e) ?? { k: 'error' };
  }

  formula(e: A.Expr, cx: Cx): Term {
    return asTerm(this.ex(e, cx));
  }

  private term(e: A.Expr, cx: Cx): Term {
    return asTerm(this.ex(e, cx));
  }

  private lookup(s: Sym, cx: Cx): SVal {
    // old(p) is the parameter's value on entry (for a callee's postcondition: the argument at the call).
    if (cx.inOld && s.kind === 'param') {
      const v = this.entry.get(s.id);
      if (v) return v;
    }
    const l = cx.local.get(s.id);
    if (l) return l;
    const v = cx.st.env.get(s.id);
    if (!v) throw new Unsupported(`no value for ${s.name}`);
    return v;
  }

  ex(e: A.Expr, cx: Cx): SVal {
    switch (e.k) {
      case 'int':
        return scalar(num(e.value));
      case 'bool':
        return scalar(e.value ? TRUE : not(TRUE));
      case 'var': {
        const s = this.sym(e);
        if (s.kind === 'variant') return scalar(num(s.index!));
        if (s.kind === 'const') {
          if (typeof s.value === 'bigint') return scalar(num(s.value));
          if (typeof s.value === 'boolean') return scalar(s.value ? TRUE : not(TRUE));
          if (s.decl?.k === 'const') return this.ex(s.decl.value, { ...cx, local: new Map() });
        }
        return this.lookup(s, cx);
      }
      case 'unary':
        return this.unary(e, cx);
      case 'binary':
        return this.binary(e, cx);
      case 'chain': {
        const args = e.args.map((a) => this.term(a, cx));
        const parts = e.ops.map((op, i) => cmp(op, args[i]!, args[i + 1]!));
        return scalar(and(...parts));
      }
      case 'call':
        return this.call(e, cx);
      case 'index': {
        const t = this.ex(e.target, cx);
        if (t.k !== 'seq') throw new Unsupported('indexing a value that is not a sequence');
        const i = this.term(e.indices[0]!, cx);
        this.oblige(cx, and(le(num(0), i), lt(i, t.len)), cx.spec ? 'well-formed' : 'bounds', e.span, 'The index is within bounds');
        return t.at(i);
      }
      case 'slice': {
        const t = this.ex(e.target, cx);
        if (t.k !== 'seq') throw new Unsupported('slicing a value that is not a sequence');
        const lo = e.lo ? this.term(e.lo, cx) : num(0);
        const hi = e.hi ? this.term(e.hi, cx) : t.len;
        this.oblige(cx, and(le(num(0), lo), le(lo, hi), le(hi, t.len)), cx.spec ? 'well-formed' : 'bounds', e.span, 'The slice is within bounds');
        return seqSlice(t, lo, hi);
      }
      case 'update': {
        const t = this.ex(e.target, cx);
        if (t.k !== 'seq') throw new Unsupported('updating a value that is not a sequence');
        const i = this.term(e.index, cx);
        const v = this.ex(e.value, cx);
        this.oblige(cx, and(le(num(0), i), lt(i, t.len)), cx.spec ? 'well-formed' : 'bounds', e.span, 'The index is within bounds');
        return seqStore(t, i, v);
      }
      case 'field': {
        const tsym = this.checked.refs.get(e.target);
        if (tsym?.kind === 'type' && tsym.ty.k === 'enum') return scalar(num(tsym.ty.variants.findIndex((v) => v.name === e.name)));
        const t = this.ex(e.target, cx);
        if (t.k !== 'struct') throw new Unsupported('fields of objects on the heap are handled by the separation-logic verifier');
        return t.fields[t.ty.fields.findIndex((f) => f.name === e.name)]!;
      }
      case 'struct': {
        const ty = this.ty(e);
        if (ty.k !== 'struct') throw new Unsupported('struct literal');
        return { k: 'struct', ty, fields: ty.fields.map((f) => this.ex(e.fields.find((x) => x.name === f.name)!.value, cx)) };
      }
      case 'seqlit': {
        const ty = this.ty(e);
        const elemTy = ty.k === 'seq' ? ty.elem : { k: 'int' as const };
        return seqLiteral(elemTy, e.elems.map((x) => this.ex(x, cx)));
      }
      case 'setlit': {
        const ty = this.ty(e);
        const elemTy = ty.k === 'set' || ty.k === 'multiset' ? ty.elem : { k: 'int' as const };
        const items = e.elems.map((x) => this.term(x, cx));
        if (e.multi) return { k: 'mset', elemTy, count: (x) => add(num(0), ...items.map((y) => ite(eq(x, y), num(1), num(0)))) };
        return { k: 'set', elemTy, mem: (x) => or(...items.map((y) => eq(x, y))) };
      }
      case 'tuple':
        return { k: 'tuple', items: e.elems.map((x) => this.ex(x, cx)) };
      case 'quant':
        return scalar(this.quant(e, cx));
      case 'comprehension':
        return this.comprehension(e, cx);
      case 'if': {
        const c = this.formula(e.cond, cx);
        const a = this.ex(e.then, { ...cx, guards: [...cx.guards, c] });
        const b = this.ex(e.else, { ...cx, guards: [...cx.guards, not(c)] });
        return joinS(c, a, b);
      }
      case 'match': {
        const v = this.term(e.scrutinee, cx);
        let out: SVal | undefined;
        const conds: Term[] = [];
        const arms = e.arms.map((arm) => {
          const c = this.patternCond(arm.pattern, v, cx);
          const guard = and(...conds.map((x) => not(x)), c);
          conds.push(c);
          return { c, val: this.ex(arm.body, { ...cx, guards: [...cx.guards, guard] }) };
        });
        this.oblige(cx, or(...arms.map((a) => a.c)), cx.spec ? 'well-formed' : 'assert', e.span, 'Some case of the match applies');
        for (let i = arms.length - 1; i >= 0; i--) out = out ? joinS(arms[i]!.c, arms[i]!.val, out) : arms[i]!.val;
        return out!;
      }
      case 'block': {
        const local = new Map(cx.local);
        const inner = { ...cx, local };
        for (const l of e.lets) local.set(this.sym(l).id, this.ex(l.value, inner));
        return this.ex(e.body, inner);
      }
      case 'old':
        return this.ex(e.arg, { ...cx, inOld: true, spec: true });
      case 'cast': {
        const v = this.term(e.arg, cx);
        const to = this.ty(e);
        const from = this.ty(e.arg);
        if (isIntLike(to) && isIntLike(from)) {
          const [lo, hi] = intBounds(to);
          const fits = and(...(lo !== undefined ? [le(num(lo), v)] : []), ...(hi !== undefined ? [le(v, num(hi))] : []));
          this.oblige(cx, fits, 'narrowing', e.span, 'The conversion does not lose information');
          return scalar(v);
        }
        throw new Unsupported('conversions between integers and bit-vectors are not supported by the program verifier yet');
      }
      case 'emp':
      case 'null':
      case 'new':
        throw new Unsupported('heap programs are verified by the separation-logic verifier (chapter 22)');
      case 'at':
      case 'mult':
        throw new Unsupported('this construct belongs to systems and worlds');
    }
  }

  private patternCond(p: A.Pattern, v: Term, cx: Cx): Term {
    if (p.k === 'wild') return TRUE;
    if (p.k === 'lit') return eq(v, this.term(p.value, cx));
    const s = this.checked.refs.get(p);
    if (p.binds.length) throw new Unsupported('enums with fields are not supported by the program verifier yet');
    return eq(v, num(s?.index ?? 0));
  }

  private unary(e: A.Expr & { k: 'unary' }, cx: Cx): SVal {
    switch (e.op) {
      case '!':
        return scalar(not(this.formula(e.arg, cx)));
      case '-': {
        const t = this.ty(e);
        const a = this.term(e.arg, cx);
        if (t.k === 'bv') return scalar(bvun('bvneg', a));
        return scalar(this.fitArith(neg(a), t, cx, e.span));
      }
      case '~': {
        if (this.ty(e).k === 'bv') return scalar(bvun('bvnot', this.term(e.arg, cx)));
        throw new Unsupported('relational operators belong to worlds');
      }
      default:
        throw new Unsupported(`the operator ${e.op} is not supported in programs`);
    }
  }

  /** Overflow obligation for machine-integer arithmetic in executable code. */
  private fitArith(r: Term, t: Ty, cx: Cx, span: Span): Term {
    if (t.k === 'mach' && !cx.spec) {
      const [lo, hi] = intBounds(t);
      this.oblige(cx, and(le(num(lo!), r), le(r, num(hi!))), 'overflow', span, `The ${t.signed ? 'i' : 'u'}${t.bits} arithmetic does not overflow`);
    }
    return r;
  }

  private binary(e: A.Expr & { k: 'binary' }, cx: Cx): SVal {
    const op = e.op;
    if (op === '&&' || op === '==>' || op === '||' || op === '<==') {
      const l = this.formula(e.left, cx);
      const guard = op === '&&' || op === '==>' ? l : not(l);
      const r = this.formula(e.right, { ...cx, guards: [...cx.guards, guard] });
      return scalar(op === '&&' ? and(l, r) : op === '||' ? or(l, r) : op === '==>' ? imp(l, r) : or(l, not(r)));
    }
    if (op === '**' || op === '|->') throw new Unsupported('heap assertions are verified by the separation-logic verifier (chapter 22)');
    const lt0 = this.ty(e.left);
    const L = this.ex(e.left, cx);
    const R = this.ex(e.right, cx);
    switch (op) {
      case '<==>':
        return scalar(iff(asTerm(L), asTerm(R)));
      case '==':
        return scalar(eqS(L, R));
      case '!=':
        return scalar(not(eqS(L, R)));
      case '<':
      case '<=':
      case '>':
      case '>=':
        if (L.k === 'scalar' && R.k === 'scalar') {
          if (lt0.k === 'bv') {
            const [a, b] = op === '<' || op === '<=' ? [L.t, R.t] : [R.t, L.t];
            return scalar(bvbin(op === '<' || op === '>' ? 'bvult' : 'bvule', a, b));
          }
          return scalar(cmp(op, L.t, R.t));
        }
        return scalar(this.subset(op, L, R));
      case 'in':
      case '!in': {
        const m = this.member(L, R);
        return scalar(op === 'in' ? m : not(m));
      }
      case '++':
        if (L.k === 'seq' && R.k === 'seq') return seqConcat(L, R);
        throw new Unsupported('++ on values that are not sequences');
    }
    const t = this.ty(e);
    if (L.k !== 'scalar' || R.k !== 'scalar') return this.collectionOp(op, L, R);
    const a = L.t;
    const b = R.t;
    if (t.k === 'bv') {
      const bvop: Record<string, Parameters<typeof bvbin>[0]> = { '+': 'bvadd', '-': 'bvsub', '*': 'bvmul', '/': 'bvudiv', '%': 'bvurem', '&': 'bvand', '|': 'bvor', '^': 'bvxor', '<<': 'bvshl', '>>': 'bvlshr' };
      if ((op === '/' || op === '%') && !cx.spec) this.oblige(cx, not(eq(b, bvnum(0n, t.bits))), 'division', e.span, 'The divisor is not zero');
      return scalar(bvbin(bvop[op]!, a, b));
    }
    switch (op) {
      case '+':
        return scalar(this.fitArith(add(a, b), t, cx, e.span));
      case '-':
        return scalar(this.fitArith(sub(a, b), t, cx, e.span));
      case '*':
        return scalar(this.fitArith(mul(a, b), t, cx, e.span));
      case '/':
      case '%': {
        this.oblige(cx, not(eq(b, num(0))), cx.spec ? 'well-formed' : 'division', e.span, 'The divisor is not zero');
        const q = truncDiv(a, b);
        return scalar(this.fitArith(op === '/' ? q : sub(a, mul(b, q)), t, cx, e.span));
      }
    }
    throw new Unsupported(`the operator ${op} is not supported by the program verifier yet`);
  }

  private collectionOp(op: string, L: SVal, R: SVal): SVal {
    if (L.k === 'set' && R.k === 'set') {
      if (op === '+' || op === '|') return { k: 'set', elemTy: L.elemTy, mem: (x) => or(L.mem(x), R.mem(x)) };
      if (op === '-') return { k: 'set', elemTy: L.elemTy, mem: (x) => and(L.mem(x), not(R.mem(x))) };
      if (op === '&' || op === '*') return { k: 'set', elemTy: L.elemTy, mem: (x) => and(L.mem(x), R.mem(x)) };
    }
    if (L.k === 'mset' && R.k === 'mset') {
      if (op === '+') return { k: 'mset', elemTy: L.elemTy, count: (x) => add(L.count(x), R.count(x)) };
      if (op === '-') return { k: 'mset', elemTy: L.elemTy, count: (x) => { const d = sub(L.count(x), R.count(x)); return ite(le(d, num(0)), num(0), d); } };
    }
    throw new Unsupported(`the operator ${op} on these values is not supported by the program verifier yet`);
  }

  private member(x: SVal, coll: SVal): Term {
    if (coll.k === 'seq') return seqContains(coll, x);
    if (coll.k === 'set') return coll.mem(asTerm(x));
    if (coll.k === 'mset') return gt(coll.count(asTerm(x)), num(0));
    throw new Unsupported('membership in this kind of value');
  }

  private subset(op: string, L: SVal, R: SVal): Term {
    const [a, b] = op === '<' || op === '<=' ? [L, R] : [R, L];
    const strict = op === '<' || op === '>';
    if (a.k === 'set' && b.k === 'set') {
      const x = freshVar('x', sortOf(a.elemTy));
      const sub = forall([x], imp(a.mem(x), b.mem(x)));
      return strict ? and(sub, not(eqS(a, b))) : sub;
    }
    if (a.k === 'mset' && b.k === 'mset') {
      const x = freshVar('x', sortOf(a.elemTy));
      const sub = forall([x], le(a.count(x), b.count(x)));
      return strict ? and(sub, not(eqS(a, b))) : sub;
    }
    throw new Unsupported('ordering on these values');
  }

  private bindBinders(bs: A.Binder[], cx: Cx): { vars: Term[]; guards: Term[]; local: Map<number, SVal> } {
    const local = new Map(cx.local);
    const vars: Term[] = [];
    const guards: Term[] = [];
    for (const b of bs) {
      const s = this.sym(b);
      if (!isScalarTy(s.ty)) throw new Unsupported('quantifiers over compound values are not supported by the program verifier yet');
      const x = freshVar(b.name, sortOf(s.ty));
      vars.push(x);
      local.set(s.id, scalar(x));
      const inner = { ...cx, local, guards: [...cx.guards, ...guards], qvars: [...cx.qvars, ...vars] };
      if (b.range && 'set' in b.range) guards.push(this.member(scalar(x), this.ex(b.range.set, inner)));
      else if (b.range) {
        const lo = this.term(b.range.lo, inner);
        const hi = this.term(b.range.hi, inner);
        guards.push(le(lo, x), b.range.inclusive ? le(x, hi) : lt(x, hi));
      }
      guards.push(...typeFacts(s.ty, scalar(x)));
    }
    return { vars, guards, local };
  }

  private quant(e: A.Expr & { k: 'quant' }, cx: Cx): Term {
    const { vars, guards, local } = this.bindBinders(e.binders, cx);
    const inner: Cx = { ...cx, local, qvars: [...cx.qvars, ...vars], guards: [...cx.guards, ...guards] };
    const body = this.formula(e.body, inner);
    const triggers = e.triggers.map((tr) => tr.map((t) => this.term(t, { ...inner, quiet: true })));
    return e.q === 'forall' ? forall(vars, imp(and(...guards), body), triggers) : exists(vars, and(...guards, body), triggers);
  }

  private comprehension(e: A.Expr & { k: 'comprehension' }, cx: Cx): SVal {
    const b = e.binders[0]!;
    if (e.seq) {
      if (e.binders.length !== 1 || !b.range || 'set' in b.range) throw new Unsupported('sequence comprehensions over one integer range only');
      if (!(e.body.k === 'bool' && e.body.value)) throw new Unsupported('filtered sequence comprehensions are not supported by the program verifier yet');
      const lo = this.term(b.range.lo, cx);
      const hi0 = this.term(b.range.hi, cx);
      const hi = b.range.inclusive ? add(hi0, num(1)) : hi0;
      const s = this.sym(b);
      const ty = this.ty(e);
      const len = ite(le(lo, hi), sub(hi, lo), num(0));
      // Obligations of the element expression, once, for an arbitrary index in range.
      const k = freshVar(b.name, INT);
      const local = new Map(cx.local).set(s.id, scalar(k));
      this.ex(e.value!, { ...cx, local, qvars: [...cx.qvars, k], guards: [...cx.guards, le(lo, k), lt(k, hi)] });
      const value = e.value!;
      return {
        k: 'seq',
        elemTy: ty.k === 'seq' ? ty.elem : { k: 'int' },
        len,
        at: (i) => this.ex(value, { ...cx, quiet: true, local: new Map(cx.local).set(s.id, scalar(add(lo, i))) }),
      };
    }
    if (e.binders.length !== 1) throw new Unsupported('set comprehensions over one variable only');
    const s = this.sym(b);
    const ty = this.ty(e);
    return {
      k: 'set',
      elemTy: ty.k === 'set' ? ty.elem : s.ty,
      mem: (x) => {
        const local = new Map(cx.local).set(s.id, scalar(x));
        const inner = { ...cx, quiet: true, local };
        const range = b.range && 'set' in b.range ? this.member(scalar(x), this.ex(b.range.set, inner)) : b.range ? and(le(this.term(b.range.lo, inner), x), (b.range.inclusive ? le : lt)(x, this.term(b.range.hi, inner))) : TRUE;
        return and(range, this.formula(e.body, inner));
      },
    };
  }

  // ── Calls in expressions: builtins, predicates and pure functions ──

  private call(e: A.Expr & { k: 'call' }, cx: Cx): SVal {
    const s = this.checked.refs.get(e);
    if (!s) return this.builtin(e, cx);
    if (s.kind === 'variant') {
      if (e.args.length) throw new Unsupported('enums with fields are not supported by the program verifier yet');
      return scalar(num(s.index!));
    }
    const info = [...this.checked.fns.values()].find((f) => f.sym === s);
    if (!info) throw new Unsupported(`call of ${e.callee}`);
    const d = info.decl;
    if (d.flavour === 'fn' || d.flavour === 'lemma') throw new Unsupported(`${d.name} changes state: call it as a statement (\`let x = ${d.name}(…)\`)`);
    const args = e.args.map((a) => this.ex(a, cx));
    const frame = new Map<number, SVal>();
    info.params.forEach((p, i) => frame.set(p.id, args[i]!));
    const fcx: Cx = { st: cx.st, guards: [], spec: true, qvars: [], local: frame, quiet: true };
    // The callee's precondition, at the call.
    for (const r of d.spec.requires) {
      const pre = this.formula(r.value, fcx);
      this.oblige(cx, pre, cx.spec ? 'well-formed' : 'precondition', e.span, `The precondition of ${d.name}${r.label ? ` (${r.label})` : ''}`);
    }
    if (!d.body || isBlockBody(d.body)) throw new Unsupported(`${d.name} has no expression body`);
    if (!this.recursive.has(d.name)) return this.ex(d.body as A.Expr, fcx);
    // Recursive: an uninterpreted function with its definition as an axiom.
    if (this.info.decl.name === d.name && this.measureAtEntry && !cx.spec) this.checkMeasure(cx, d, args, e.span);
    return scalar(this.recursiveApp(info, args));
  }

  private checkMeasure(cx: Cx, d: A.FnDecl, args: SVal[], span: Span): void {
    const frame = new Map<number, SVal>();
    this.info.params.forEach((p, i) => frame.set(p.id, args[i]!));
    const now = d.spec.decreases!.map((m) => this.ex(m, { st: cx.st, guards: [], spec: true, qvars: [], local: frame, quiet: true }));
    this.oblige(cx, lexLess(now, this.measureAtEntry!), 'decreases', span, `The termination measure of ${d.name} decreases at the recursive call`);
  }

  /** Flatten a value into SMT terms (sequences become an array and a length) for uninterpreted applications. */
  private flatten(v: SVal, cx: Cx | undefined): Term[] {
    if (v.k === 'scalar') return [v.t];
    if (v.k === 'struct' || v.k === 'tuple') return (v.k === 'struct' ? v.fields : v.items).flatMap((f) => this.flatten(f, cx));
    if (v.k === 'seq') {
      if (v.arr) return [v.arr, v.len];
      if (!isScalarTy(v.elemTy)) throw new Unsupported('recursive functions over sequences of compound values');
      // Materialise: a fresh array equal to the sequence on its indices.
      const A = freshVar('seq', arraySort(INT, sortOf(v.elemTy)));
      const i = freshVar('i', INT);
      const def = forall([i], imp(and(le(num(0), i), lt(i, v.len)), eq(select(A, i), asTerm(v.at(i)))), [[select(A, i)]]);
      if (cx) cx.st.path.push(def);
      else this.axioms.push(def);
      return [A, v.len];
    }
    throw new Unsupported('recursive functions over sets and multisets');
  }

  private recursiveApp(info: FnInfo, args: SVal[], cx?: Cx): Term {
    const d = info.decl;
    const resTy = info.result?.ty ?? { k: 'bool' as const };
    if (!isScalarTy(resTy)) throw new Unsupported('recursive functions returning compound values are not supported by the program verifier yet');
    const name = `${d.name}`;
    const flat = args.flatMap((a) => this.flatten(a, cx));
    const out = app(name, flat, d.flavour === 'pred' ? BOOL : sortOf(resTy));
    if (!this.axiomatised.has(name)) {
      this.axiomatised.add(name);
      // ∀ params. requires ⟹ f(params) = body   (trigger: f(params))
      const frame = new Map<number, SVal>();
      const bound: Term[] = [];
      for (const p of info.params) {
        const v = freshValue(p.ty, `${d.name}_${p.name}`);
        frame.set(p.id, v);
        if (v.k === 'scalar') bound.push(v.t);
        else if (v.k === 'seq' && v.arr) bound.push(v.arr, v.len);
        else throw new Unsupported('recursive functions over compound parameters');
      }
      const st: State = { env: new Map(), path: [], alive: true };
      const fcx: Cx = { st, guards: [], spec: true, qvars: [], local: frame, quiet: true };
      const head = app(name, bound, out.sort);
      const pre = and(...d.spec.requires.map((r) => this.formula(r.value, fcx)));
      const body = asTerm(this.ex(d.body as A.Expr, fcx));
      const facts = info.params.flatMap((p) => typeFacts(p.ty, frame.get(p.id)!)).filter((f) => f.op !== 'forall');
      this.axioms.push(forall(bound, imp(and(...facts, pre), out.sort.k === 'bool' ? iff(head, body) : eq(head, body)), [[head]]));
    }
    return out;
  }

  private builtin(e: A.Expr & { k: 'call' }, cx: Cx): SVal {
    const args = e.args.map((a) => this.ex(a, cx));
    const a0 = args[0]!;
    switch (e.callee) {
      case 'len':
        if (a0.k === 'seq') return scalar(a0.len);
        break;
      case 'multiset':
        if (a0.k === 'seq') {
          if (a0.count) return { k: 'mset', elemTy: a0.elemTy, count: a0.count };
          const [A, n] = this.flatten(a0, cx);
          return { k: 'mset', elemTy: a0.elemTy, count: (x) => app(`count_${x.sort.k}`, [A!, n!, x], INT) };
        }
        if (a0.k === 'set') return { k: 'mset', elemTy: a0.elemTy, count: (x) => ite(a0.mem(x), num(1), num(0)) };
        break;
      case 'set':
        if (a0.k === 'seq') return { k: 'set', elemTy: a0.elemTy, mem: (x) => seqContains(a0, scalar(x)) };
        if (a0.k === 'mset') return { k: 'set', elemTy: a0.elemTy, mem: (x) => gt(a0.count(x), num(0)) };
        break;
      case 'min':
      case 'max': {
        const ts = args.map(asTerm);
        return scalar(ts.slice(1).reduce((m, x) => (e.callee === 'min' ? ite(le(m, x), m, x) : ite(ge(m, x), m, x)), ts[0]!));
      }
      case 'abs': {
        const x = asTerm(a0);
        return scalar(this.fitArith(ite(lt(x, num(0)), neg(x), x), this.ty(e), cx, e.span));
      }
      case 'reversed':
        if (a0.k === 'seq') return { k: 'seq', elemTy: a0.elemTy, len: a0.len, at: (i) => a0.at(sub(sub(a0.len, num(1)), i)), count: a0.count };
        break;
      case 'seq_of':
        return seqLiteral(this.ty(e.args[0]!), args);
    }
    throw new Unsupported(`${e.callee}(…) is not supported by the program verifier yet`);
  }

  // ── Statements ──

  private block(b: A.Block, st: State): void {
    for (const s of b.stmts) {
      if (!st.alive) return;
      this.stmt(s, st);
    }
  }

  private stmt(s: A.Stmt, st: State): void {
    switch (s.k) {
      case 'let': {
        const sym = this.sym(s);
        let v: SVal;
        if (s.init) {
          v = this.rhs(s.init, st, s.ghost);
          this.fitTo(v, this.ty(s.init), sym.ty, this.cx(st, s.ghost), s.init.span);
        } else v = defaultValue(sym.ty);
        st.env.set(sym.id, v);
        return;
      }
      case 'assign': {
        const cx = this.cx(st, this.isGhostTarget(s.target));
        let v = this.rhs(s.value, st, cx.spec);
        if (s.op !== '=') {
          const cur = this.term(s.target, cx);
          const t = this.ty(s.target);
          const r = asTerm(v);
          const res = s.op === '+=' ? add(cur, r) : s.op === '-=' ? sub(cur, r) : mul(cur, r);
          v = scalar(this.fitArith(res, t, cx, s.span));
        }
        this.assign(s.target, v, this.ty(s.value), st, cx.spec);
        return;
      }
      case 'multi': {
        const vals = s.values.map((x) => this.rhs(x, st, false));
        if (vals.length !== s.targets.length) throw new Unsupported('a call returning several values');
        s.targets.forEach((t, i) => {
          if (s.declare && t.k === 'var') st.env.set(this.sym(t).id, vals[i]!);
          else this.assign(t, vals[i]!, this.ty(s.values[i]!), st, false);
        });
        return;
      }
      case 'if': {
        const c = this.formula(s.cond, this.cx(st, false));
        const a: State = { env: new Map(st.env), path: [...st.path, c], alive: true };
        const b: State = { env: new Map(st.env), path: [...st.path, not(c)], alive: true };
        this.block(s.then, a);
        if (s.else) {
          if (isBlock(s.else)) this.block(s.else, b);
          else this.stmt(s.else, b);
        }
        this.joinInto(st, [a, b]);
        return;
      }
      case 'while':
        return this.loop(st, s, (at) => this.formula(s.cond, this.cx(at, false)), s.spec, s.body);
      case 'for': {
        const v = this.sym(s);
        const cx = this.cx(st, false);
        const lo = this.term(s.lo, cx);
        const hi0 = this.term(s.hi, cx);
        const hi = s.inclusive ? add(hi0, num(1)) : hi0;
        st.env.set(v.id, scalar(lo));
        // lo > hi: the loop does not run at all.
        const skip: State = { env: new Map(st.env), path: [...st.path, gt(lo, hi)], alive: true };
        const run: State = { env: new Map(st.env), path: [...st.path, le(lo, hi)], alive: true };
        const cur = (at: State) => asTerm(at.env.get(v.id)!);
        this.loop(run, s, (at) => lt(cur(at), hi), s.spec, s.body, {
          implicit: (at) => and(le(lo, cur(at)), le(cur(at), hi)),
          step: (at) => at.env.set(v.id, scalar(add(cur(at), num(1)))),
          index: v,
        });
        this.joinInto(st, [skip, run]);
        return;
      }
      case 'loop':
        return this.loop(st, s, () => TRUE, { invariants: [] }, s.body);
      case 'match': {
        const scr = this.term(s.scrutinee, this.cx(st, false));
        const states: State[] = [];
        const conds: Term[] = [];
        for (const arm of s.arms) {
          const c = this.patternCond(arm.pattern, scr, this.cx(st, false));
          const branch: State = { env: new Map(st.env), path: [...st.path, ...conds.map((x) => not(x)), c], alive: true };
          conds.push(c);
          this.block(arm.body, branch);
          states.push(branch);
        }
        const none: State = { env: new Map(st.env), path: [...st.path, ...conds.map((x) => not(x))], alive: true };
        const cx = this.cx(none, false);
        this.oblige(cx, not(TRUE), 'assert', s.span, 'Some case of the match applies');
        none.alive = false;
        this.joinInto(st, [...states, none]);
        return;
      }
      case 'return': {
        if (s.value && this.info.result) {
          const v = this.rhs(s.value, st, false);
          this.fitTo(v, this.ty(s.value), this.info.result.ty, this.cx(st, false), s.value.span);
          st.env.set(this.info.result.id, v);
        }
        this.postconditions(st, s.span);
        st.alive = false;
        return;
      }
      case 'break': {
        const l = this.loops[this.loops.length - 1];
        if (!l) throw new Unsupported('break outside a loop');
        l.breaks.push({ env: new Map(st.env), path: [...st.path], alive: true });
        st.alive = false;
        return;
      }
      case 'assert': {
        const cx = this.cx(st, true);
        const f = this.formula(s.cond, cx);
        this.oblige(cx, f, 'assert', s.span, `The assertion${s.label ? ` ${s.label}` : ''}`);
        return;
      }
      case 'assume':
        st.path.push(this.formula(s.cond, this.cx(st, true)));
        return;
      case 'expr':
        this.rhs(s.expr, st, false);
        return;
      case 'block':
        return this.block(s.body, st);
      case 'skip':
        return;
      case 'choose': {
        const sym = this.sym(s);
        const v = freshValue(sym.ty, s.name);
        st.env.set(sym.id, v);
        st.path.push(...typeFacts(sym.ty, v));
        if (s.where) st.path.push(this.formula(s.where, this.cx(st, true)));
        return;
      }
      default:
        throw new Unsupported(`\`${s.k}\` statements belong to systems or heap programs`);
    }
  }

  private isGhostTarget(t: A.Expr): boolean {
    let root = t;
    while (root.k === 'index' || root.k === 'field') root = root.target;
    return root.k === 'var' && !!this.checked.refs.get(root)?.ghost;
  }

  /** An assignment's right-hand side: an executable call, or an expression. */
  private rhs(e: A.Expr, st: State, spec: boolean): SVal {
    if (e.k === 'call') {
      const s = this.checked.refs.get(e);
      if (s?.kind === 'fn' && s.decl?.k === 'fn' && (s.decl.flavour === 'fn' || s.decl.flavour === 'lemma')) return this.callExec(e, st);
    }
    return this.ex(e, this.cx(st, spec));
  }

  /** Narrowing obligation when a value is stored into a smaller integer type. */
  private fitTo(v: SVal, from: Ty, to: Ty, cx: Cx, span: Span): void {
    if (v.k !== 'scalar' || !isIntLike(to) || assignable(from, to) !== 'checked') return;
    const [lo, hi] = intBounds(to);
    const fits = and(...(lo !== undefined ? [le(num(lo), v.t)] : []), ...(hi !== undefined ? [le(v.t, num(hi))] : []));
    this.oblige(cx, fits, 'narrowing', span, 'The value fits the type it is stored in');
  }

  /** target := v, rebuilding compound values functionally up to the root variable. */
  private assign(target: A.Expr, v: SVal, vty: Ty, st: State, spec: boolean): void {
    const cx = this.cx(st, spec);
    switch (target.k) {
      case 'var': {
        const s = this.sym(target);
        this.fitTo(v, vty, s.ty, cx, target.span);
        st.env.set(s.id, v);
        return;
      }
      case 'index': {
        const cur = this.ex(target.target, cx);
        if (cur.k !== 'seq') throw new Unsupported('assignment into a value that is not a sequence');
        const i = this.term(target.indices[0]!, cx);
        this.oblige(cx, and(le(num(0), i), lt(i, cur.len)), 'bounds', target.span, 'The index is within bounds');
        this.fitTo(v, vty, this.ty(target), cx, target.span);
        return this.assign(target.target, seqStore(cur, i, v), this.ty(target.target), st, spec);
      }
      case 'field': {
        const cur = this.ex(target.target, cx);
        if (cur.k !== 'struct') throw new Unsupported('fields of objects on the heap are handled by the separation-logic verifier');
        const k = cur.ty.fields.findIndex((f) => f.name === target.name);
        this.fitTo(v, vty, cur.ty.fields[k]!.ty, cx, target.span);
        const fields = [...cur.fields];
        fields[k] = v;
        return this.assign(target.target, { ...cur, fields }, this.ty(target.target), st, spec);
      }
      default:
        throw new Unsupported('this assignment target');
    }
  }

  /** Merge the live states into `st` (values as if-then-else on the branches' path conditions). */
  private joinInto(st: State, states: State[]): void {
    const live = states.filter((s) => s.alive);
    if (!live.length) {
      st.alive = false;
      return;
    }
    // The longest common prefix of the paths.
    let n = 0;
    while (live.every((s) => n < s.path.length && s.path[n] === live[0]!.path[n])) n++;
    const guards = live.map((s) => and(...s.path.slice(n)));
    const prefix = live[0]!.path.slice(0, n);
    const env = new Map<number, SVal>();
    const ids = new Set(live.flatMap((s) => [...s.env.keys()]));
    for (const id of ids) {
      const vals = live.map((s) => s.env.get(id));
      if (vals.some((x) => !x)) continue; // declared in one branch only: out of scope after the join
      let v = vals[vals.length - 1]!;
      for (let i = vals.length - 2; i >= 0; i--) v = vals[i] === v ? v : joinS(guards[i]!, vals[i]!, v);
      env.set(id, v);
    }
    st.env = env;
    st.path = [...prefix, or(...guards)];
    st.alive = true;
  }

  // ── Loops ──

  private loop(
    st: State,
    s: A.Stmt & { k: 'while' | 'for' | 'loop' },
    cond: (at: State) => Term,
    spec: A.LoopSpec,
    body: A.Block,
    forLoop?: { implicit: (at: State) => Term; step: (at: State) => void; index: Sym },
  ): void {
    const invs = spec.invariants;
    // 1. The invariant holds on entry (each conjunct may rely on the previous ones being well-formed).
    for (const inv of invs) {
      const cx = this.cx(st, true);
      this.oblige(cx, this.formula(inv.value, cx), 'invariant-entry', inv.span, `The loop invariant${inv.label ? ` ${inv.label}` : ''} on entry`);
    }
    // 2. Havoc what the loop modifies: only the invariant is known about it.
    const modified = modifiedIn(body, this.checked);
    if (forLoop) modified.whole.add(forLoop.index.id);
    for (const id of new Set([...modified.whole, ...modified.elements])) {
      const sym = this.checked.symbols[id - 1]!;
      const cur = st.env.get(id);
      if (!cur) continue;
      const keepLen = !modified.whole.has(id) && cur.k === 'seq' ? cur.len : undefined;
      const v = freshValue(sym.ty, `${sym.name}_loop`, keepLen);
      st.env.set(id, v);
      st.path.push(...typeFacts(sym.ty, v));
    }
    if (forLoop) st.path.push(forLoop.implicit(st));
    for (const inv of invs) st.path.push(this.formula(inv.value, { ...this.cx(st, true), quiet: true }));
    const outerHead = this.loopHead;
    this.loopHead = this.snapshot(st, 'at the loop head (an arbitrary iteration)');
    // 3. One arbitrary iteration.
    const c = cond(st);
    const it: State = { env: new Map(st.env), path: [...st.path, c], alive: true };
    const measure = spec.decreases?.map((m) => this.ex(m, { ...this.cx(it, true), quiet: true }));
    if (!spec.decreases && s.k !== 'loop') this.unmeasured++;
    this.loops.push({ breaks: [] });
    this.block(body, it);
    const lcx = this.loops.pop()!;
    if (it.alive) {
      forLoop?.step(it);
      for (const inv of invs) {
        const cx = this.cx(it, true);
        this.oblige(cx, this.formula(inv.value, cx), 'invariant-preserved', inv.span, `The loop invariant${inv.label ? ` ${inv.label}` : ''} after an iteration`);
      }
      if (measure) {
        const cx = this.cx(it, true);
        const after = spec.decreases!.map((m) => this.ex(m, cx));
        this.oblige(cx, lexLess(after, measure), 'decreases', spec.decreases![0]!.span, 'The termination measure decreases (and stays non-negative)');
      }
    }
    this.loopHead = outerHead;
    // 4. After the loop: the invariant and the negated condition, or a break.
    const exit: State = { env: new Map(st.env), path: [...st.path, not(c)], alive: s.k !== 'loop' };
    this.joinInto(st, [exit, ...lcx.breaks]);
  }

  // ── Calls of functions and lemmas (statements) ──

  private callExec(e: A.Expr & { k: 'call' }, st: State): SVal {
    const callee = [...this.checked.fns.values()].find((f) => f.sym === this.checked.refs.get(e))!;
    const d = callee.decl;
    const cx = this.cx(st, d.flavour === 'lemma');
    const args = e.args.map((a) => this.ex(a, cx));
    const pre = new Map<number, SVal>();
    callee.params.forEach((p, i) => pre.set(p.id, args[i]!));
    const fcx = (local: Map<number, SVal>): Cx => ({ st, guards: [], spec: true, qvars: [], local, quiet: false });
    for (const r of d.spec.requires) {
      const f = this.formula(r.value, { ...fcx(pre), quiet: true });
      this.oblige(cx, f, 'precondition', e.span, `The precondition of ${d.name}${r.label ? ` (${r.label})` : ''}`);
    }
    if (d.name === this.info.decl.name && this.measureAtEntry) this.checkMeasure(cx, d, args, e.span);
    // Havoc the inout parameters and the result; assume the postcondition.
    const post = new Map(pre);
    const outs: [number, SVal][] = [];
    if (d.flavour !== 'lemma') {
      callee.params.forEach((p, i) => {
        if (!p.inout) return;
        const v = freshValue(p.ty, `${p.name}_after_${d.name}`);
        post.set(p.id, v);
        st.path.push(...typeFacts(p.ty, v));
        outs.push([i, v]);
      });
    }
    let result: SVal = scalar(TRUE);
    if (callee.result) {
      result = freshValue(callee.result.ty, `${d.name}_result`);
      post.set(callee.result.id, result);
      st.path.push(...typeFacts(callee.result.ty, result));
    }
    // old(…) in the callee's postcondition refers to the arguments as they were at the call.
    const saved = this.entry;
    this.entry = pre;
    for (const q of d.spec.ensures) st.path.push(this.formula(q.value, { ...fcx(post), quiet: true }));
    this.entry = saved;
    for (const [i, v] of outs) this.assign(e.args[i]!, v, callee.params[i]!.ty, st, false);
    return result;
  }
}

// ── Helpers ──

function isBlockBody(b: A.Block | A.Expr): b is A.Block {
  return 'stmts' in b;
}

function cmp(op: '<' | '<=' | '>' | '>=', a: Term, b: Term): Term {
  return op === '<' ? lt(a, b) : op === '<=' ? le(a, b) : op === '>' ? gt(a, b) : ge(a, b);
}

/** Truncating division (as in the interpreter and in C, Java, Rust), from SMT-LIB's Euclidean `div`. */
function truncDiv(a: Term, b: Term): Term {
  if (b.op === 'num') {
    const k = b.value!;
    const pos = k > 0n ? b : num(-k);
    const q = ite(ge(a, num(0)), div(a, pos), neg(div(neg(a), pos)));
    return k > 0n ? q : neg(q);
  }
  return app('tdiv', [a, b], INT);
}

/** Lexicographic "a < b" for termination measures (integers must also stay non-negative). */
function lexLess(a: SVal[], b: SVal[]): Term {
  const alts: Term[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = asTerm(a[i]!);
    const y = asTerm(b[i]!);
    const eqs = a.slice(0, i).map((v, k) => eq(asTerm(v), asTerm(b[k]!)));
    alts.push(and(...eqs, lt(x, y), le(num(0), y)));
  }
  return or(...alts);
}

/** Variables assigned in a block: wholly, or only through element updates (their length is unchanged). */
function modifiedIn(b: A.Block, checked: Checked): { whole: Set<number>; elements: Set<number> } {
  const whole = new Set<number>();
  const elements = new Set<number>();
  const target = (t: A.Expr) => {
    let root = t;
    let viaIndex = false;
    while (root.k === 'index' || root.k === 'field') {
      if (root.k === 'index') viaIndex = true;
      else viaIndex = false;
      root = root.target;
    }
    const s = root.k === 'var' ? checked.refs.get(root) : undefined;
    if (!s) return;
    if (t.k === 'index' && viaIndex) elements.add(s.id);
    else whole.add(s.id);
  };
  const callArgs = (e: A.Expr) => {
    if (e.k !== 'call') return;
    const s = checked.refs.get(e);
    if (s?.kind !== 'fn' || s.decl?.k !== 'fn') return;
    const info = [...checked.fns.values()].find((f) => f.sym === s);
    info?.params.forEach((p, i) => p.inout && info.decl.flavour === 'fn' && target(e.args[i]!));
  };
  const visit = (s: A.Stmt) => {
    switch (s.k) {
      case 'assign':
        target(s.target);
        callArgs(s.value);
        break;
      case 'multi':
        s.targets.forEach(target);
        s.values.forEach(callArgs);
        break;
      case 'let':
        if (s.init) callArgs(s.init);
        break;
      case 'expr':
        callArgs(s.expr);
        break;
      case 'if':
        s.then.stmts.forEach(visit);
        if (s.else) (isBlock(s.else) ? s.else.stmts : [s.else]).forEach(visit);
        break;
      case 'while':
      case 'loop':
      case 'block':
        (s.k === 'block' ? s.body : s.body).stmts.forEach(visit);
        break;
      case 'for': {
        const v = checked.refs.get(s);
        if (v) whole.add(v.id);
        s.body.stmts.forEach(visit);
        break;
      }
      case 'match':
        s.arms.forEach((a) => a.body.stmts.forEach(visit));
        break;
      case 'label':
        visit(s.stmt);
        break;
    }
  };
  b.stmts.forEach(visit);
  for (const id of whole) elements.delete(id);
  return { whole, elements };
}

/** Pure functions and predicates that can call themselves (directly or through others). */
function recursiveFns(checked: Checked): Set<string> {
  const calls = new Map<string, Set<string>>();
  for (const [name, info] of checked.fns) {
    const out = new Set<string>();
    const body = info.decl.body;
    const visit = (e: A.Expr) => {
      if (e.k === 'call') {
        const s = checked.refs.get(e);
        if (s?.kind === 'fn') out.add(s.name);
      }
    };
    if (body && !('stmts' in body)) walk(body as A.Expr, visit);
    for (const c of [...info.decl.spec.requires, ...info.decl.spec.ensures]) walk(c.value, visit);
    calls.set(name, out);
  }
  const rec = new Set<string>();
  for (const f of calls.keys()) {
    const seen = new Set<string>();
    const stack = [...(calls.get(f) ?? [])];
    while (stack.length) {
      const g = stack.pop()!;
      if (g === f) {
        rec.add(f);
        break;
      }
      if (seen.has(g)) continue;
      seen.add(g);
      stack.push(...(calls.get(g) ?? []));
    }
  }
  return rec;
}

function walk(e: A.Expr, f: (e: A.Expr) => void): void {
  f(e);
  const go = (x: A.Expr | undefined) => x && walk(x, f);
  switch (e.k) {
    case 'unary':
    case 'old':
    case 'mult':
    case 'cast':
      go(e.arg);
      break;
    case 'binary':
      go(e.left);
      go(e.right);
      break;
    case 'chain':
    case 'call':
      e.args.forEach(go);
      break;
    case 'index':
      go(e.target);
      e.indices.forEach(go);
      break;
    case 'slice':
      go(e.target);
      go(e.lo);
      go(e.hi);
      break;
    case 'update':
      go(e.target);
      go(e.index);
      go(e.value);
      break;
    case 'field':
      go(e.target);
      break;
    case 'struct':
    case 'new':
      e.fields.forEach((x) => go(x.value));
      break;
    case 'seqlit':
    case 'setlit':
    case 'tuple':
      e.elems.forEach(go);
      break;
    case 'quant':
    case 'comprehension':
      go(e.body);
      if (e.k === 'comprehension') go(e.value);
      break;
    case 'if':
      go(e.cond);
      go(e.then);
      go(e.else);
      break;
    case 'match':
      go(e.scrutinee);
      e.arms.forEach((a) => go(a.body));
      break;
    case 'block':
      e.lets.forEach((l) => go(l.value));
      go(e.body);
      break;
    case 'at':
      go(e.proc);
      break;
  }
}

export { Unsupported };
