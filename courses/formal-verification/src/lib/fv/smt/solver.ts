/**
 * The SMT solver (chapters 12–14, and the back end of the program verifier): DPLL(T), the architecture of Z3, CVC5
 * and Yices. The CDCL SAT solver of chapter 7 searches over the Boolean structure; whenever it has a partial
 * assignment, the theories check that the literals it chose are consistent:
 *
 *   - equality and uninterpreted functions by congruence closure (./euf.ts),
 *   - linear integer arithmetic by the general simplex plus branch and bound (./simplex.ts),
 *   - bit-vectors by bit-blasting into the SAT problem itself (./bv.ts),
 *   - arrays by read-over-write rewriting and lemmas, quantifiers by E-matching (./quant.ts).
 *
 * The theories cooperate by model-based theory combination (de Moura and Bjørner 2008): when the arithmetic model
 * gives two shared terms the same value, the solver asks the SAT solver to decide whether they are equal.
 *
 * Answers are certified. "sat" comes with a model that the trusted evaluator (logic/term.ts) checks against the
 * original formulas. "unsat" comes with a DRAT proof whose theory steps carry their own certificates (Farkas
 * multipliers, congruence explanations, instances), which ./check/certificate.ts re-checks independently.
 */
import { Q } from '../logic/rational';
import {
  add, defaultOf, eq, evaluate, FALSE, freeVars, freshVar, ge, le, mk, mul, mvKey, not, num, subst, subterms, TRUE,
  type MValue, type Model, type Term,
} from '../logic/term';
import { Solver, type ProofLine, type Theory, type TheoryResult } from '../sat/solver';
import { BitBlaster } from './bv';
import { Euf } from './euf';
import { formKey, linearize, normalize, type Constraint } from './linear';
import { Preprocessor } from './preprocess';
import { inferTriggers, Matcher } from './quant';
import { Simplex } from './simplex';

export type Justification =
  | { kind: 'farkas'; coeffs: [number, Q][] }
  | { kind: 'euf' }
  | { kind: 'int-split' }
  | { kind: 'row' }
  | { kind: 'instance'; quant: Term; subst: [Term, Term][]; instance: Term; encodedAs?: Term }
  | { kind: 'skolem'; quant: Term; skolems: Term[]; instance: Term; encodedAs?: Term }
  | { kind: 'ext'; skolem: Term }
  /** A lemma about one product of two terms (incremental linearisation), checked by interval reasoning. */
  | { kind: 'nla'; product: Term };

export interface SmtProof {
  /** The clauses of the encoded problem (assertions, definitions of Tseitin and bit-blasting variables). */
  input: number[][];
  lines: ProofLine[];
  /** Theory lemmas by clause key (sorted literals). */
  justifications: Map<string, Justification>;
  /** SAT variable → the atom it stands for. */
  atoms: Map<number, Term>;
  /** The variable that is always true. */
  trueVar: number;
  /** The encoded formulas, with the literal each was encoded to (for instance lemmas). */
  encoded: Map<Term, number>;
  /** Symbols the solver introduced (Skolem constants, definitions), which may not occur in the input. */
  freshNames: Set<string>;
}

export type SmtStatus = 'sat' | 'unsat' | 'unknown';

export interface SmtResult {
  status: SmtStatus;
  /** For sat: a model, checked against every quantifier-free assertion. For unknown: a candidate, if any. */
  model?: Model;
  /** Was the model checked against all assertions by the trusted evaluator? */
  modelChecked?: boolean;
  reason?: string;
  proof?: SmtProof;
  stats: Record<string, number>;
  /** The quantifier instances the solver made, in order. */
  instances?: { quant: Term; bindings: Term[]; round: number }[];
}

export interface SmtOptions {
  proof?: boolean;
  /** Milliseconds. */
  timeout?: number;
  signal?: AbortSignal;
  maxRounds?: number;
  maxInstances?: number;
  maxBranches?: number;
  conflictLimit?: number;
}

type AtomInfo =
  | { kind: 'arith'; term: Term; c: Constraint; sv: number }
  | { kind: 'eq'; term: Term; a: Term; b: Term; arith?: { c: Constraint; sv: number } }
  | { kind: 'pred'; term: Term }
  | { kind: 'bool'; term: Term }
  | { kind: 'quant'; term: Term };

interface Entry {
  lit: number;
  pos: number;
  mark: number;
}

const clauseKey = (c: readonly number[]) => [...c].sort((a, b) => a - b).join(' ');

export class SmtSolver implements Theory {
  readonly sat: Solver;
  private T: number;
  private input: number[][] = [];
  private encoded = new Map<Term, number>();
  /** Arithmetic atoms by normalised constraint, so that x < y and y > x share a variable. */
  private atomByKey = new Map<string, number>();
  private atoms = new Map<number, AtomInfo>();
  private atomTerms = new Map<number, Term>();
  private pre = new Preprocessor();
  private euf = new Euf();
  private eufTerms: Term[] = [];
  private simplex = new Simplex();
  private baseVar = new Map<Term, number>();
  private baseTerms: Term[] = [];
  private formVar = new Map<string, number>();
  private bb: BitBlaster;
  private justifications = new Map<string, Justification>();
  private assertions: Term[] = [];
  private freshNames = new Set<string>();
  // Theory state.
  private trail: Entry[] = [];
  private pos = 0;
  private assigned = new Map<number, boolean>();
  private eufDirty = false;
  private eqAtoms: number[] = [];
  // Final-check state.
  private pending: { clause: number[]; just: Justification; encode?: Term }[] = [];
  private instancesDone = new Set<string>();
  private skolemized = new Set<number>();
  private lemmaDone = new Set<string>();
  private incomplete = '';
  private branches = 0;
  private instances = 0;
  private opts: SmtOptions = {};

  constructor(opts: SmtOptions = {}) {
    this.opts = opts;
    this.sat = new Solver({ proof: opts.proof ?? false, theory: this });
    this.T = this.sat.newVar();
    this.addInput([this.T]);
    this.atomTerms.set(this.T, TRUE);
    this.bb = new BitBlaster({ newVar: () => this.sat.newVar(), addClause: (c) => this.addInput(c), T: this.T }, (t) => this.encode(t));
  }

  // ── Encoding ──

  private addInput(c: number[]): void {
    this.input.push(c);
    this.sat.addClause(c);
  }

  assert(t: Term): void {
    if (t.sort.k !== 'bool') throw new Error('assert: not a formula');
    this.assertions.push(t);
    const p = this.pre.run(t);
    const defs = this.pre.defs.splice(0);
    for (const n of this.pre.fresh.keys()) this.freshNames.add(n);
    for (const d of [p, ...defs]) this.assertTop(d);
  }

  private assertTop(t: Term): void {
    if (t.op === 'and') for (const a of t.args) this.assertTop(a);
    else if (t.op === 'or') this.addInput(t.args.map((a) => this.encode(a)));
    else this.addInput([this.encode(t)]);
  }

  /** Tseitin: the literal standing for formula t (adding the clauses that define it). */
  encode(t: Term): number {
    const m = this.encoded.get(t);
    if (m !== undefined) return m;
    const l = this.encodeNew(t);
    this.encoded.set(t, l);
    return l;
  }

  private encodeNew(t: Term): number {
    switch (t.op) {
      case 'true':
        return this.T;
      case 'false':
        return -this.T;
      case 'not':
        return -this.encode(t.args[0]!);
      case 'and':
      case 'or': {
        const xs = t.args.map((a) => this.encode(a));
        const x = this.sat.newVar();
        const s = t.op === 'and' ? 1 : -1;
        // and: x ⟹ each, all ⟹ x.  or: dual.
        for (const a of xs) this.addInput([-s * x, s * a]);
        this.addInput([s * x, ...xs.map((a) => -s * a)]);
        return x;
      }
      case 'imp': {
        const a = this.encode(t.args[0]!);
        const b = this.encode(t.args[1]!);
        const x = this.sat.newVar();
        this.addInput([-x, -a, b]);
        this.addInput([x, a]);
        this.addInput([x, -b]);
        return x;
      }
      case 'iff':
      case 'xor': {
        const a = this.encode(t.args[0]!);
        const b0 = this.encode(t.args[1]!);
        const b = t.op === 'xor' ? -b0 : b0;
        const x = this.sat.newVar();
        this.addInput([-x, -a, b]);
        this.addInput([-x, a, -b]);
        this.addInput([x, a, b]);
        this.addInput([x, -a, -b]);
        return x;
      }
      case 'ite': {
        if (t.sort.k !== 'bool') throw new Error('ite: non-Boolean if-then-else must be preprocessed');
        const c = this.encode(t.args[0]!);
        const a = this.encode(t.args[1]!);
        const b = this.encode(t.args[2]!);
        const x = this.sat.newVar();
        this.addInput([-x, -c, a]);
        this.addInput([-x, c, b]);
        this.addInput([x, -c, -a]);
        this.addInput([x, c, -b]);
        return x;
      }
      default:
        return this.atom(t);
    }
  }

  private newAtom(term: Term, info: AtomInfo): number {
    const x = this.sat.newVar();
    this.atoms.set(x, info);
    this.atomTerms.set(x, term);
    return x;
  }

  /** The literal for an atom, registering it with the theories. */
  private atom(t: Term): number {
    switch (t.op) {
      case 'le':
      case 'lt':
      case 'ge':
      case 'gt': {
        const n = normalize(t.op, t.args[0]!, t.args[1]!);
        if (n.kind === 'const') return n.value ? this.T : -this.T;
        return this.arithAtom(t, n.c);
      }
      case 'eq': {
        const [a, b] = t.args as [Term, Term];
        if (a.sort.k === 'bv') return this.bb.predicate(t);
        if (a.sort.k === 'int') {
          const n = normalize('eq', a, b);
          if (n.kind === 'const') return n.value ? this.T : -this.T;
          const key = `eq|${formKey(n.c.coeffs)}|${n.c.k}`;
          const shared = this.atomByKey.get(key);
          if (shared !== undefined) return shared;
          this.addEuf(a);
          this.addEuf(b);
          const sv = this.formOf(n.c);
          const x = this.newAtom(t, { kind: 'eq', term: t, a, b, arith: { c: n.c, sv } });
          this.eqAtoms.push(x);
          this.atomByKey.set(key, x);
          return x;
        }
        this.addEuf(a);
        this.addEuf(b);
        const x = this.newAtom(t, { kind: 'eq', term: t, a, b });
        this.eqAtoms.push(x);
        return x;
      }
      case 'bvult':
      case 'bvule':
      case 'bvslt':
      case 'bvsle':
        return this.bb.predicate(t);
      case 'forall':
      case 'exists':
        return this.newAtom(t, { kind: 'quant', term: t });
      case 'var':
        return this.newAtom(t, { kind: 'bool', term: t });
      default:
        if (t.sort.k !== 'bool') throw new Error(`not a formula: ${t.op}`);
        this.addEuf(t);
        return this.newAtom(t, { kind: 'pred', term: t });
    }
  }

  private arithAtom(t: Term, c: Constraint): number {
    const key = `${c.rel}|${formKey(c.coeffs)}|${c.k}`;
    const shared = this.atomByKey.get(key);
    if (shared !== undefined) return shared;
    const sv = this.formOf(c);
    const x = this.newAtom(t, { kind: 'arith', term: t, c, sv });
    this.atomByKey.set(key, x);
    return x;
  }

  /** The atom for a normalised bound, with a term that states it (for the certificate checker). */
  private boundAtom(c: Constraint): number {
    const lhs = add(...c.coeffs.map(([t, k]) => mul(num(k), t)));
    return this.arithAtom(c.rel === 'le' ? le(lhs, num(c.k)) : ge(lhs, num(c.k)), c);
  }

  /** The simplex variable for a linear form (a base variable when the form is a single term). */
  private formOf(c: Constraint): number {
    if (c.coeffs.length === 1 && c.coeffs[0]![1] === 1n) return this.base(c.coeffs[0]![0]);
    const key = formKey(c.coeffs);
    let s = this.formVar.get(key);
    if (s === undefined) {
      s = this.simplex.define(c.coeffs.map(([t, k]) => [this.base(t), Q.of(k)]));
      this.formVar.set(key, s);
    }
    return s;
  }

  private base(t: Term): number {
    let v = this.baseVar.get(t);
    if (v === undefined) {
      v = this.simplex.newVar();
      this.baseVar.set(t, v);
      this.baseTerms.push(t);
      this.addEuf(t);
      // The factors of a product are arithmetic terms too: the product lemmas need their values.
      if (t.op === 'mul' && t.sort.k === 'int') for (const a of t.args) if (a.op !== 'num') for (const [x] of linearize(a).coeffs) this.base(x);
    }
    return v;
  }

  private addEuf(t: Term): void {
    if (this.euf.has(t)) return;
    for (const s of subterms(t)) if (s.op === 'forall' || s.op === 'exists') return;
    this.euf.add(t);
    this.eufTerms.push(t);
    // Integer arguments of applications and array accesses are shared with arithmetic.
    for (const s of subterms(t)) {
      if (s.op === 'app' || s.op === 'select' || s.op === 'store') {
        for (const a of s.args) if (a.sort.k === 'int') this.linearValueVars(a);
      }
    }
  }

  /** Make sure every arithmetic atom of an integer term has a simplex variable. */
  private linearValueVars(t: Term): void {
    for (const x of linearize(t).coeffs.keys()) if (!this.baseVar.has(x)) this.base(x);
  }

  // ── The theory interface (called by the SAT solver) ──

  backtrack(trailSize: number): void {
    let m = -1;
    while (this.trail.length && this.trail[this.trail.length - 1]!.pos >= trailSize) {
      const e = this.trail.pop()!;
      m = e.mark;
      this.assigned.delete(Math.abs(e.lit));
      const info = this.atoms.get(Math.abs(e.lit));
      if (info && info.kind !== 'arith' && info.kind !== 'bool') this.eufDirty = true;
    }
    if (m >= 0) this.simplex.undoTo(m);
    this.pos = trailSize;
  }

  check(newLits: number[], full: boolean): TheoryResult {
    const fresh: Entry[] = [];
    for (const lit of newLits) {
      const v = Math.abs(lit);
      const p = this.pos++;
      if (!this.atoms.has(v)) continue;
      const e = { lit, pos: p, mark: this.simplex.mark() };
      this.trail.push(e);
      this.assigned.set(v, lit > 0);
      fresh.push(e);
    }
    // After a backtrack, congruence closure is rebuilt from the remaining literals (including the new ones).
    const rebuilt = this.eufDirty;
    if (rebuilt) this.rebuildEuf();
    for (const e of fresh) {
      const r = this.apply(e.lit, !rebuilt);
      if (r) return r;
    }
    const ec = this.euf.conflict();
    if (ec) return this.conflict(ec, { kind: 'euf' });
    const sc = this.simplex.check();
    if (sc === 'gave-up') {
      this.incomplete = 'the simplex gave up';
      return {};
    }
    if (sc) return this.conflict(sc.lits.map((l) => l.lit), { kind: 'farkas', coeffs: sc.lits.map((l) => [l.lit, l.coeff]) });
    const implied = this.propagateEqualities();
    if (implied.length) return { implied };
    if (!full) return {};
    return this.finalCheck();
  }

  private rebuildEuf(): void {
    this.euf = new Euf();
    for (const t of this.eufTerms) this.euf.add(t);
    this.eufDirty = false;
    for (const e of this.trail) {
      const info = this.atoms.get(Math.abs(e.lit))!;
      if (info.kind === 'eq' || info.kind === 'pred') this.applyEuf(info, e.lit);
    }
  }

  private applyEuf(info: AtomInfo, lit: number): void {
    if (info.kind === 'eq') {
      if (lit > 0) this.euf.assertEq(info.a, info.b, lit);
      else this.euf.assertDiseq(info.a, info.b, lit);
    } else if (info.kind === 'pred') this.euf.assertEq(info.term, lit > 0 ? TRUE : FALSE, lit);
  }

  /** Apply one literal; returns a conflict if a bound crosses. */
  private apply(lit: number, euf: boolean): TheoryResult | null {
    const info = this.atoms.get(Math.abs(lit))!;
    if (euf && (info.kind === 'eq' || info.kind === 'pred')) this.applyEuf(info, lit);
    const ar = info.kind === 'arith' ? info : info.kind === 'eq' ? info.arith : undefined;
    if (!ar) return null;
    const { c, sv } = ar;
    const k = Q.of(c.k);
    const bound = (side: 'lo' | 'hi', value: Q) => this.simplex.assertBound(sv, side, value, lit);
    let ex = null;
    if (lit > 0) {
      if (c.rel !== 'ge') ex = bound('hi', k);
      if (!ex && c.rel !== 'le') ex = bound('lo', k);
    } else if (c.rel === 'le') ex = bound('lo', Q.of(c.k + 1n));
    else if (c.rel === 'ge') ex = bound('hi', Q.of(c.k - 1n));
    if (ex) return this.conflict(ex.lits.map((l) => l.lit), { kind: 'farkas', coeffs: ex.lits.map((l) => [l.lit, l.coeff]) });
    return null;
  }

  private conflict(lits: number[], just: Justification): TheoryResult {
    const clause = [...new Set(lits)].map((l) => -l);
    this.justifications.set(clauseKey(clause), just);
    return { conflict: clause };
  }

  /** Equality atoms whose sides congruence closure has already merged. */
  private propagateEqualities(): { lit: number; reason: number[] }[] {
    const out: { lit: number; reason: number[] }[] = [];
    for (const x of this.eqAtoms) {
      if (this.assigned.has(x)) continue;
      const info = this.atoms.get(x) as Extract<AtomInfo, { kind: 'eq' }>;
      if (this.euf.find(info.a) !== this.euf.find(info.b)) continue;
      const reason = this.euf.explain(info.a, info.b).map((l) => -l);
      this.justifications.set(clauseKey([x, ...reason]), { kind: 'euf' });
      out.push({ lit: x, reason });
    }
    return out;
  }

  // ── Final check: everything is assigned and consistent so far ──

  private finalCheck(): TheoryResult {
    const lemmas: number[][] = [];
    const lemma = (clause: number[], just: Justification) => {
      const k = clauseKey(clause);
      if (this.lemmaDone.has(k)) return;
      this.lemmaDone.add(k);
      this.justifications.set(k, just);
      lemmas.push(clause);
    };
    // 1. Integrality: branch on a base variable with a fractional value.
    for (const t of this.baseTerms) {
      const val = this.simplex.value[this.baseVar.get(t)!]!;
      if (val.isInt()) continue;
      if (++this.branches > (this.opts.maxBranches ?? 3000)) {
        this.incomplete = 'branch and bound did not converge';
        return {};
      }
      const f = val.floor();
      lemma([this.encode(le(t, num(f))), this.encode(ge(t, num(f + 1n)))], { kind: 'int-split' });
      return { lemmas };
    }
    // 2. Arithmetic disequalities the current values violate.
    for (const e of this.trail) {
      if (e.lit > 0) continue;
      const info = this.atoms.get(-e.lit)!;
      if (info.kind !== 'eq' || !info.arith) continue;
      const { c } = info.arith;
      if (!this.formValue(c).eq(Q.of(c.k))) continue;
      const x = -e.lit;
      const lo = this.boundAtom({ ...c, rel: 'le', k: c.k - 1n });
      const hi = this.boundAtom({ ...c, rel: 'ge', k: c.k + 1n });
      lemma([x, lo, hi], { kind: 'int-split' });
    }
    if (lemmas.length) return { lemmas };
    // 3. Theory combination over shared integer terms (before products: equalities it finds feed congruence).
    this.combination(lemma);
    if (lemmas.length) return { lemmas };
    // 4. Arrays: read over write for remaining writes; extensionality for array disequalities.
    this.arrays(lemma);
    if (lemmas.length) return { lemmas };
    // 5. Quantifiers: queue instances. If there are new ones, let them be asserted before any product lemma, so
    // that an unfolding the proof needs is not starved by product lemmas that chase values.
    const pendingBefore = this.pending.length;
    this.quantifiers();
    if (this.pending.length > pendingBefore) return {};
    // 6. Products of two non-constants: the linear solver treats x·y as an opaque atom. When its value disagrees
    // with the product of the factors' values, add a lemma that rules this out (incremental linearisation).
    this.products(lemma);
    if (lemmas.length || this.incomplete) return { lemmas };
    return {};
  }

  private nlaLemmas = 0;
  /**
   * Does the current assignment, with every product computed by real multiplication, satisfy all the (quantifier-
   * free) assertions? Then no product lemma is needed: the model is a model. Without this check, a satisfiable
   * formula can send the value lemmas chasing ever new values.
   */
  private modelSatisfiesAll(): boolean {
    if (this.assertions.some((a) => [...subterms(a)].some((t) => t.op === 'forall' || t.op === 'exists'))) return false;
    try {
      const m = this.buildModel();
      return this.assertions.every((a) => evaluate(a, m) === true);
    } catch {
      return false;
    }
  }

  private products(lemma: (c: number[], j: Justification) => void): void {
    if (this.modelSatisfiesAll()) return;
    // Congruence for products: two products whose factors currently have equal values must be equal when the
    // factors are (x₁ = x₂ ∧ y₁ = y₂ ⟹ x₁·y₁ = x₂·y₂). Without it, i = n would not give i·i = n·n, and the value
    // lemmas below would chase ever new values of n.
    const prods = [...this.baseTerms].filter((m) => m.op === 'mul' && m.args[0]!.op !== 'num' && m.args[1]!.op !== 'num');
    const before = this.lemmaDone.size;
    for (let i = 0; i < prods.length; i++) {
      for (let j = i + 1; j < prods.length; j++) {
        const [m1, m2] = [prods[i]!, prods[j]!];
        const v1 = this.simplex.value[this.baseVar.get(m1)!]!;
        const v2 = this.simplex.value[this.baseVar.get(m2)!]!;
        if (v1.eq(v2)) continue;
        const same = (a: Term, b: Term) => {
          const va = this.termValue(a);
          const vb = this.termValue(b);
          return !!va && !!vb && va.eq(vb);
        };
        if (!same(m1.args[0]!, m2.args[0]!) || !same(m1.args[1]!, m2.args[1]!)) continue;
        const lits = [eq(m1.args[0]!, m2.args[0]!), eq(m1.args[1]!, m2.args[1]!)].filter((t) => t.op !== 'true').map((t) => -this.encode(t));
        lemma([...lits, this.encode(eq(m1, m2))], { kind: 'euf' });
      }
    }
    if (this.lemmaDone.size > before) return;
    for (const m of this.baseTerms) {
      if (m.op !== 'mul' || m.args[0]!.op === 'num' || m.args[1]!.op === 'num') continue;
      const [x, y] = m.args as [Term, Term];
      const vm = this.simplex.value[this.baseVar.get(m)!]!;
      const vx = this.termValue(x);
      const vy = this.termValue(y);
      if (!vx || !vy || !vm.isInt() || !vx.isInt() || !vy.isInt()) continue;
      const a = vx.floor();
      const b = vy.floor();
      const p = vm.floor();
      if (p === a * b) continue;
      if (++this.nlaLemmas > (this.opts.maxBranches ?? 3000) / 10) {
        this.incomplete = 'non-linear arithmetic: the product lemmas did not converge';
        return;
      }
      const just: Justification = { kind: 'nla', product: m };
      const zero = num(0);
      const sign = (v: bigint) => (v > 0n ? 1 : v < 0n ? -1 : 0);
      const [sx, sy, sp] = [sign(a), sign(b), sign(p)];
      if (x === y && p < 0n) {
        lemma([this.encode(ge(m, zero))], just);
        continue;
      }
      if (sx === 0 || sy === 0) {
        const z = sx === 0 ? x : y;
        lemma([-this.encode(eq(z, zero)), this.encode(eq(m, zero))], just);
        continue;
      }
      const want = sx * sy;
      if (sp !== 0 && sp !== want) {
        const side = (t: Term, s: number) => this.encode(s > 0 ? ge(t, zero) : le(t, zero));
        lemma([-side(x, sx), -side(y, sy), want > 0 ? this.encode(ge(m, zero)) : this.encode(le(m, zero))], just);
        continue;
      }
      // Fix the value at this point: x = a ∧ y = b ⇒ x·y = a·b.
      lemma([-this.encode(eq(x, num(a))), -this.encode(eq(y, num(b))), this.encode(eq(m, num(a * b)))], just);
    }
  }

  private formValue(c: Constraint): Q {
    let s = Q.ZERO;
    for (const [t, k] of c.coeffs) s = s.add(Q.of(k).mul(this.simplex.value[this.baseVar.get(t)!]!));
    return s;
  }

  /** The arithmetic value of an integer term (linear in base variables). */
  private termValue(t: Term): Q | undefined {
    const l = linearize(t);
    let s = Q.of(l.constant);
    for (const [x, k] of l.coeffs) {
      const v = this.baseVar.get(x);
      if (v === undefined) return undefined;
      s = s.add(Q.of(k).mul(this.simplex.value[v]!));
    }
    return s;
  }

  private sharedTerms(): Term[] {
    const out = new Set<Term>();
    for (const n of this.euf.nodes) {
      if (n.op === 'app' || n.op === 'select' || n.op === 'store') {
        for (const a of n.args) if (a.sort.k === 'int') out.add(a);
        if (n.sort.k === 'int') out.add(n);
      }
    }
    for (const t of this.baseTerms) if (t.op === 'app' || t.op === 'select' || t.op === 'mul') out.add(t);
    return [...out];
  }

  private combination(lemma: (c: number[], j: Justification) => void): void {
    const shared = this.sharedTerms();
    const byValue = new Map<string, Term[]>();
    for (const t of shared) {
      const v = this.termValue(t);
      if (!v) continue;
      const k = v.toString();
      (byValue.get(k) ?? byValue.set(k, []).get(k)!).push(t);
    }
    // Equal values, different classes: let the SAT solver decide whether they are equal.
    for (const group of byValue.values()) {
      const first = group[0]!;
      for (const t of group.slice(1)) {
        if (this.euf.find(t) === this.euf.find(first)) continue;
        const e = eq(first, t);
        if (e.op !== 'eq') continue;
        const x = this.encode(e);
        if (Math.abs(x) === this.T) continue;
        const info = this.atoms.get(Math.abs(x));
        if (info?.kind !== 'eq' || !info.arith) continue;
        if (this.assigned.has(Math.abs(x))) continue;
        const c = info.arith.c;
        lemma([x, this.boundAtom({ ...c, rel: 'le', k: c.k - 1n }), this.boundAtom({ ...c, rel: 'ge', k: c.k + 1n })], { kind: 'int-split' });
      }
    }
    // Same class, different values: congruence closure knows something arithmetic does not.
    const byClass = new Map<Term, Term[]>();
    for (const t of shared) {
      const r = this.euf.find(t);
      (byClass.get(r) ?? byClass.set(r, []).get(r)!).push(t);
    }
    for (const [r, group] of byClass) {
      const members = [...group, ...this.euf.classOf(r).filter((m) => m.op === 'num')];
      const first = members[0]!;
      const v0 = this.termValue(first);
      for (const t of members.slice(1)) {
        const v = this.termValue(t);
        if (!v || !v0 || v.eq(v0)) continue;
        const e = eq(first, t);
        if (e.op === 'false') continue;
        const x = this.encode(e);
        lemma([x, ...this.euf.explain(first, t).map((l) => -l)], { kind: 'euf' });
      }
    }
  }

  private arrays(lemma: (c: number[], j: Justification) => void): void {
    const selects = this.euf.nodes.filter((n) => n.op === 'select');
    for (const s of this.euf.nodes) {
      if (s.op !== 'store' || s.sort.k !== 'array' || s.sort.elem.k === 'bool') continue;
      const [a, i, v] = s.args as [Term, Term, Term];
      const read = mk('select', [s, i], v.sort);
      this.addEuf(read);
      const x = this.encode(eq(read, v));
      if (Math.abs(x) !== this.T) lemma([x], { kind: 'row' });
      for (const sel of selects) {
        const arr = this.euf.find(sel.args[0]!);
        if (arr !== this.euf.find(s) && arr !== this.euf.find(a)) continue;
        const j = sel.args[1]!;
        if (this.euf.find(j) === this.euf.find(i)) continue;
        const rs = mk('select', [s, j], v.sort);
        const ra = mk('select', [a, j], v.sort);
        this.addEuf(rs);
        this.addEuf(ra);
        const same = this.encode(eq(rs, ra));
        if (Math.abs(same) === this.T) continue;
        lemma([this.encode(eq(i, j)), same], { kind: 'row' });
      }
    }
    for (const e of this.trail) {
      if (e.lit > 0) continue;
      const info = this.atoms.get(-e.lit)!;
      if (info.kind !== 'eq' || info.a.sort.k !== 'array' || this.skolemized.has(-e.lit)) continue;
      this.skolemized.add(-e.lit);
      const sort = info.a.sort;
      const k = freshVar('k', sort.idx);
      this.freshNames.add(k.name!);
      const ra = mk('select', [info.a, k], sort.elem);
      const rb = mk('select', [info.b, k], sort.elem);
      this.addEuf(ra);
      this.addEuf(rb);
      lemma([-e.lit, -this.encode(eq(ra, rb))], { kind: 'ext', skolem: k });
    }
  }

  /** Every quantifier instance made, in order (for the proof debugger). */
  instanceLog: { quant: Term; bindings: Term[]; round: number }[] = [];
  private round = 0;

  private quantifiers(): void {
    const active = this.trail.filter((e) => this.atoms.get(Math.abs(e.lit))!.kind === 'quant');
    if (!active.length) return;
    let matcher: Matcher | undefined;
    const max = this.opts.maxInstances ?? 4000;
    for (const e of active) {
      const q = this.atoms.get(Math.abs(e.lit))!.term;
      const universal = (q.op === 'forall') === e.lit > 0;
      const body = q.args[0]!;
      const bound = q.bound!;
      // The formula the literal asserts, as ∀/∃ over `matrix`.
      const matrix = e.lit > 0 ? body : mkNot(body);
      if (!universal) {
        if (this.skolemized.has(e.lit)) continue;
        this.skolemized.add(e.lit);
        const sk = bound.map((b) => freshVar(`sk_${b.name}`, b.sort));
        for (const s of sk) this.freshNames.add(s.name!);
        const inst = subst(matrix, new Map(bound.map((b, i) => [b, sk[i]!])));
        this.pending.push({ clause: [-e.lit], just: { kind: 'skolem', quant: q, skolems: sk, instance: inst }, encode: inst });
        continue;
      }
      matcher ??= new Matcher(this.euf);
      const triggers = q.triggers?.length ? q.triggers : inferTriggers(bound, body);
      const bset = new Set(bound);
      const substs: Map<Term, Term>[] = [];
      for (const tr of triggers) substs.push(...matcher.matchAll(tr, bset));
      if (!triggers.length) substs.push(...this.enumerative(bound));
      for (const s of substs) {
        if (bound.some((b) => !s.has(b))) continue;
        // Keyed by the terms themselves, not their current classes: classes change when the search backtracks, and
        // an instance skipped because two terms were equal in one branch may be needed in another.
        const key = `${e.lit}|${bound.map((b) => s.get(b)!.id).join(',')}`;
        if (this.instancesDone.has(key)) continue;
        this.instancesDone.add(key);
        if (++this.instances > max) {
          this.incomplete = 'too many quantifier instances';
          return;
        }
        const inst = subst(matrix, s);
        if (this.instanceLog.length < 2000) this.instanceLog.push({ quant: q, bindings: bound.map((b) => s.get(b)!), round: this.round });
        this.pending.push({ clause: [-e.lit], just: { kind: 'instance', quant: q, subst: bound.map((b) => [b, s.get(b)!]), instance: inst }, encode: inst });
      }
    }
    if (!this.pending.length) this.incomplete ||= 'quantified formulas remain (instantiation is incomplete)';
  }

  /** Instantiate with ground terms of the right sorts (when a quantifier has no usable trigger). */
  private enumerative(bound: readonly Term[]): Map<Term, Term>[] {
    const pool = (b: Term) => {
      const reps = new Map<Term, Term>();
      for (const n of this.euf.nodes) if (n.sort.k === b.sort.k && freeVars(n).size <= 1 && !reps.has(this.euf.find(n))) reps.set(this.euf.find(n), n);
      return [...reps.values()].slice(0, 12);
    };
    let out: Map<Term, Term>[] = [new Map()];
    for (const b of bound) {
      const p = pool(b);
      out = out.flatMap((s) => p.map((t) => new Map(s).set(b, t)));
      if (out.length > 300) out = out.slice(0, 300);
    }
    return out;
  }

  // ── Solving ──

  solve(): SmtResult {
    const r = this.solveInner();
    if (this.instanceLog.length) r.instances = this.instanceLog;
    return r;
  }

  private solveInner(): SmtResult {
    const start = Date.now();
    const deadline = this.opts.timeout ? start + this.opts.timeout : Infinity;
    const stop = () => Date.now() > deadline || !!this.opts.signal?.aborted;
    const maxRounds = this.opts.maxRounds ?? 40;
    let rounds = 0;
    for (;;) {
      this.incomplete = '';
      const r = this.sat.solve({ shouldStop: stop, conflictLimit: this.opts.conflictLimit });
      if (r === 'unsat') return this.unsat(start, rounds);
      if (r === 'unknown') return { status: 'unknown', reason: stop() ? 'out of time' : 'conflict limit reached', stats: this.stats(start, rounds) };
      if (this.pending.length && rounds < maxRounds && !stop()) {
        rounds++;
        this.round = rounds;
        for (const p of this.pending.splice(0)) {
          const pre = this.pre.run(p.encode!);
          const defs = this.pre.defs.splice(0);
          for (const n of this.pre.fresh.keys()) this.freshNames.add(n);
          for (const d of defs) this.assertTop(d);
          if (p.just.kind === 'instance' || p.just.kind === 'skolem') p.just.encodedAs = pre;
          const clause = [...p.clause, this.encode(pre)];
          this.justifications.set(clauseKey(clause), p.just);
          if (this.sat.opts.proof) this.sat.proof.push({ kind: 't', lits: [...clause] });
          this.sat.addClause(clause);
        }
        continue;
      }
      if (this.pending.length) this.incomplete ||= 'too many instantiation rounds';
      return this.satResult(start, rounds);
    }
  }

  private stats(start: number, rounds: number): Record<string, number> {
    const s = this.sat.stats;
    return {
      decisions: s.decisions,
      conflicts: s.conflicts,
      propagations: s.propagations,
      atoms: this.atoms.size,
      'theory lemmas': this.justifications.size,
      pivots: this.simplex.pivots,
      instances: this.instances,
      rounds,
      ms: Date.now() - start,
    };
  }

  private unsat(start: number, rounds: number): SmtResult {
    const res: SmtResult = { status: 'unsat', stats: this.stats(start, rounds) };
    if (this.sat.opts.proof) {
      res.proof = {
        input: this.input,
        lines: this.sat.proof,
        justifications: this.justifications,
        atoms: this.atomTerms,
        trueVar: this.T,
        encoded: this.encoded,
        freshNames: this.freshNames,
      };
    }
    return res;
  }

  private satResult(start: number, rounds: number): SmtResult {
    const model = this.buildModel();
    let checked = true;
    let failed: Term | undefined;
    for (const a of this.assertions) {
      if ([...subterms(a)].some((s) => s.op === 'forall' || s.op === 'exists')) {
        checked = false;
        continue;
      }
      let ok = false;
      try {
        ok = evaluate(a, model) === true;
      } catch {
        ok = false;
      }
      if (!ok) {
        failed = a;
        break;
      }
    }
    const stats = this.stats(start, rounds);
    if (failed) return { status: 'unknown', model, modelChecked: false, reason: this.incomplete || 'the candidate model does not satisfy every formula (non-linear arithmetic or an incomplete theory)', stats };
    if (!checked || this.incomplete) return { status: 'unknown', model, modelChecked: false, reason: this.incomplete || 'quantified formulas remain (instantiation is incomplete)', stats };
    return { status: 'sat', model, modelChecked: true, stats };
  }

  /** A model of the current SAT assignment and theory states. */
  buildModel(): Model {
    const sm = this.sat.model;
    const vars = new Map<string, MValue>();
    const funs: Model['funs'] = new Map();
    const classValue = new Map<Term, MValue>();
    let freshInt = 0n;
    for (const t of this.baseTerms) {
      const v = this.simplex.value[this.baseVar.get(t)!]!;
      const f = v.floor();
      if (f >= freshInt) freshInt = f + 1n;
    }
    freshInt += 1000n;
    let uCount = 0;
    const valueOf = (t: Term): MValue => {
      if (t.sort.k === 'bool') {
        if (t.op === 'true') return true;
        if (t.op === 'false') return false;
        const l = this.encoded.get(t);
        if (l === undefined) return false;
        return l > 0 ? sm[l] === true : sm[-l] !== true;
      }
      if (t.sort.k === 'bv') return this.bb.value(t, sm);
      const r = this.euf.has(t) ? this.euf.find(t) : t;
      const cached = classValue.get(r);
      if (cached !== undefined) return cached;
      let v: MValue | undefined;
      if (t.sort.k === 'int') {
        for (const m of this.euf.has(t) ? this.euf.classOf(t) : [t]) {
          if (m.op === 'num') v = m.value!;
          else {
            const q = this.termValue(m);
            if (q) v = q.floor();
          }
          if (v !== undefined) break;
        }
        v ??= freshInt++;
      } else if (t.sort.k === 'u') v = { u: `${t.sort.name}!${++uCount}` };
      else if (t.sort.k === 'array') {
        const entries = new Map<string, MValue>();
        const arr = { arr: { def: defaultOf(t.sort.elem), entries } };
        classValue.set(r, arr);
        for (const n of this.euf.nodes) {
          if (n.op === 'select' && this.euf.find(n.args[0]!) === r) entries.set(mvKey(valueOf(n.args[1]!)), valueOf(n));
        }
        return arr;
      }
      classValue.set(r, v!);
      return v!;
    };
    const visit = new Set<Term>();
    for (const a of this.assertions) {
      for (const s of subterms(a)) {
        if (visit.has(s)) continue;
        visit.add(s);
        if (s.op === 'var') vars.set(s.name!, valueOf(s));
      }
    }
    for (const s of [...this.euf.nodes, ...this.bb.leaves.keys(), ...this.encoded.keys()]) {
      if (s.op === 'var' && !vars.has(s.name!)) vars.set(s.name!, valueOf(s));
      if (s.op !== 'app') continue;
      let f = funs.get(s.name!);
      if (!f) {
        f = { entries: new Map(), def: defaultOf(s.sort) };
        funs.set(s.name!, f);
      }
      f.entries.set(s.args.map((x) => mvKey(valueOf(x))).join(','), valueOf(s));
    }
    return { vars, funs };
  }
}

const mkNot = (t: Term): Term => not(t);

/** Convenience: check the satisfiability of a list of formulas. */
export function checkSat(assertions: Term[], opts: SmtOptions = {}): SmtResult {
  const s = new SmtSolver(opts);
  for (const a of assertions) s.assert(a);
  return s.solve();
}
