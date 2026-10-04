/**
 * TRUSTED. Re-checks an SMT solver's "unsat" answer without trusting the solver.
 *
 * The Boolean part is a DRAT proof (sat/check/drat.ts). Each theory step in it is a clause the solver claims is
 * valid in the theory, and comes with a justification this file checks on its own terms:
 *
 *   - farkas: the negated clause is a set of linear constraints; the given multipliers combine them into 0 < 0;
 *   - euf: the negated clause is a set of equalities, disequalities and predicate facts that a naive congruence
 *     closure (quadratic, no clever data structures) finds contradictory;
 *   - int-split: the clause's arithmetic literals, all over one linear form, cover every integer;
 *   - row: an instance of the read-over-write axioms of arrays;
 *   - instance: ¬(∀x. φ) ∨ φ[t/x] (or the dual for ∃), recomputed by substitution;
 *   - skolem / ext: introduce symbols that occur nowhere else (they preserve satisfiability);
 *   - nla: facts about x, y and the product x·y, each a bound on one of them, that interval reasoning about
 *     multiplication finds contradictory (equal values multiply to their product; signs multiply; a square is
 *     not negative).
 *
 * What remains trusted is the encoding of the formulas into clauses (Tseitin's transformation, the preprocessing
 * of ite, div and arrays, bit-blasting) and this file. The certificate says so.
 */
import { Q } from '../../logic/rational';
import { FALSE, freeVars, not, subst, subterms, TRUE, type Term } from '../../logic/term';
import { checkDrat } from '../../sat/check/drat';
import type { SmtProof } from '../solver';

export interface CertificateCheck {
  ok: boolean;
  message?: string;
  lemmas: Record<string, number>;
}

const key = (c: readonly number[]) => [...c].sort((a, b) => a - b).join(' ');

export function checkUnsatCertificate(p: SmtProof): CertificateCheck {
  const counts: Record<string, number> = {};
  let failure = '';
  const atom = (lit: number): { term: Term; positive: boolean } | undefined => {
    const t = p.atoms.get(Math.abs(lit));
    return t ? { term: t, positive: lit > 0 } : undefined;
  };
  const theory = (clause: number[]): boolean => {
    const j = p.justifications.get(key(clause));
    if (!j) {
      failure = `no justification for theory clause ${clause.join(' ')}`;
      return false;
    }
    counts[j.kind] = (counts[j.kind] ?? 0) + 1;
    // The facts the clause denies: the negation of each literal (drop the always-true literal).
    const facts = clause.filter((l) => l !== -p.trueVar).map((l) => atom(-l));
    if (facts.some((f) => !f)) {
      if (j.kind !== 'instance' && j.kind !== 'skolem') {
        failure = 'a theory clause mentions a variable that is not an atom';
        return false;
      }
    }
    let ok = false;
    switch (j.kind) {
      case 'farkas':
        ok = checkFarkas(clause, j.coeffs, atom);
        break;
      case 'euf':
        ok = checkEuf(facts as { term: Term; positive: boolean }[]);
        break;
      case 'int-split':
        ok = checkIntSplit(clause.map((l) => atom(l)!));
        break;
      case 'row':
        ok = checkRow(clause.map((l) => atom(l)!));
        break;
      case 'instance':
      case 'skolem': {
        // clause = [¬(asserted quantifier literal), encoding of the instance]
        const q = atom(clause[0]!);
        const instLit = clause[1];
        if (!q || q.term !== j.quant || instLit === undefined || clause.length !== 2) break;
        // The quantifier literal was asserted with the opposite sign of clause[0].
        const assertedTrue = !q.positive;
        const universal = (j.quant.op === 'forall') === assertedTrue;
        const matrix = assertedTrue ? j.quant.args[0]! : not(j.quant.args[0]!);
        const bound = j.quant.bound!;
        let sigma: Map<Term, Term>;
        if (j.kind === 'instance') {
          if (!universal || j.subst.length !== bound.length || !bound.every((b) => j.subst.some(([x]) => x === b))) break;
          sigma = new Map(j.subst);
        } else {
          if (universal || j.skolems.length !== bound.length) break;
          // Skolem constants must be new: declared fresh by the solver and absent from the quantified formula.
          if (!j.skolems.every((s) => s.op === 'var' && p.freshNames.has(s.name!) && !freeVars(j.quant).has(s))) break;
          sigma = new Map(bound.map((b, i) => [b, j.skolems[i]!]));
        }
        if (subst(matrix, sigma) !== j.instance) break;
        // The instance's literal is its encoding (after the trusted preprocessing).
        ok = p.encoded.get(j.encodedAs ?? j.instance) === instLit;
        break;
      }
      case 'ext':
        ok = p.freshNames.has(j.skolem.name!);
        break;
      case 'nla':
        ok = checkProduct(j.product, facts as { term: Term; positive: boolean }[]);
        break;
    }
    if (!ok && !failure) failure = `the ${j.kind} justification of theory clause ${clause.join(' ')} does not hold`;
    return ok;
  };
  const r = checkDrat(p.input, p.lines, theory);
  if (!r.ok) return { ok: false, message: failure || r.message, lemmas: counts };
  return { ok: true, lemmas: counts };
}

// ── Linear arithmetic ──

interface Lin {
  coeffs: Map<Term, bigint>;
  constant: bigint;
}

function lin(t: Term, scale: bigint, out: Lin): boolean {
  switch (t.op) {
    case 'num':
      out.constant += scale * t.value!;
      return true;
    case 'add':
      return t.args.every((a) => lin(a, scale, out));
    case 'sub':
      return lin(t.args[0]!, scale, out) && lin(t.args[1]!, -scale, out);
    case 'neg':
      return lin(t.args[0]!, -scale, out);
    case 'mul':
      if (t.args[0]!.op === 'num') return lin(t.args[1]!, scale * t.args[0]!.value!, out);
      if (t.args[1]!.op === 'num') return lin(t.args[0]!, scale * t.args[1]!.value!, out);
  }
  out.coeffs.set(t, (out.coeffs.get(t) ?? 0n) + scale);
  return true;
}

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const floorDiv = (a: bigint, b: bigint) => {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
};

/** An arithmetic fact as `form rel k`, normalised as the solver does (integer tightening is sound over ℤ). */
interface Fact {
  coeffs: Map<Term, bigint>;
  rel: 'le' | 'ge' | 'eq' | 'ne';
  k: bigint;
}

function arithFact(t: Term, positive: boolean): Fact | null {
  const ops = ['le', 'lt', 'ge', 'gt', 'eq'];
  if (!ops.includes(t.op) || (t.op === 'eq' && t.args[0]!.sort.k !== 'int')) return null;
  const l: Lin = { coeffs: new Map(), constant: 0n };
  if (!lin(t.args[0]!, 1n, l) || !lin(t.args[1]!, -1n, l)) return null;
  for (const [x, c] of l.coeffs) if (c === 0n) l.coeffs.delete(x);
  // form + constant  op  0   ⇒   form op −constant
  let k = -l.constant;
  let rel: Fact['rel'] = t.op === 'lt' ? 'le' : t.op === 'gt' ? 'ge' : (t.op as Fact['rel']);
  if (t.op === 'lt') k -= 1n;
  if (t.op === 'gt') k += 1n;
  if (!positive) {
    if (rel === 'le') [rel, k] = ['ge', k + 1n];
    else if (rel === 'ge') [rel, k] = ['le', k - 1n];
    else rel = 'ne';
  }
  let coeffs = [...l.coeffs].sort((a, b) => a[0].id - b[0].id);
  if (coeffs.length && coeffs[0]![1] < 0n) {
    coeffs = coeffs.map(([x, c]) => [x, -c]);
    k = -k;
    if (rel === 'le') rel = 'ge';
    else if (rel === 'ge') rel = 'le';
  }
  const g = coeffs.reduce((a, [, c]) => gcd(a, c), 0n);
  if (g > 1n) {
    coeffs = coeffs.map(([x, c]) => [x, c / g]);
    if (rel === 'le') k = floorDiv(k, g);
    else if (rel === 'ge') k = -floorDiv(-k, g);
    else if (k % g !== 0n) {
      // g·form = k has no integer solution: the equation is the false fact 0 ≤ −1, the disequation the true 0 ≥ −1.
      return { coeffs: new Map(), rel: rel === 'eq' ? 'le' : 'ge', k: -1n };
    } else k /= g;
  }
  return { coeffs: new Map(coeffs), rel, k };
}

function checkFarkas(clause: number[], coeffs: [number, Q][], atom: (l: number) => { term: Term; positive: boolean } | undefined): boolean {
  const negated = new Set(clause.map((l) => -l));
  const sum = new Map<Term, Q>();
  let constant = Q.ZERO;
  for (const [lit, mu] of coeffs) {
    if (!negated.has(lit)) return false;
    const a = atom(lit);
    if (!a) return false;
    const f = arithFact(a.term, a.positive);
    if (!f || f.rel === 'ne') return false;
    if (f.rel === 'le' && mu.sign() < 0) return false;
    if (f.rel === 'ge' && mu.sign() > 0) return false;
    for (const [x, c] of f.coeffs) sum.set(x, (sum.get(x) ?? Q.ZERO).add(mu.mul(Q.of(c))));
    constant = constant.add(mu.mul(Q.of(-f.k)));
  }
  for (const c of sum.values()) if (!c.isZero()) return false;
  // Σ μ(form − k) = constant must be ≤ 0 by the facts; a positive constant is the contradiction.
  return constant.sign() > 0;
}

function checkIntSplit(lits: { term: Term; positive: boolean }[]): boolean {
  const facts = lits.map((l) => (l ? arithFact(l.term, l.positive) : null));
  if (facts.some((f) => !f)) return false;
  const fs = facts as Fact[];
  const formKey = (f: Fact) => [...f.coeffs].map(([x, c]) => `${x.id}:${c}`).join(',');
  const k0 = formKey(fs[0]!);
  if (!fs.every((f) => formKey(f) === k0)) return false;
  // Does the union of the allowed sets cover ℤ?
  let maxLe = -Infinity as number | bigint;
  let minGe = Infinity as number | bigint;
  const points = new Set<bigint>();
  const holes: bigint[] = [];
  for (const f of fs) {
    if (f.rel === 'le' && (maxLe === -Infinity || f.k > (maxLe as bigint))) maxLe = f.k;
    if (f.rel === 'ge' && (minGe === Infinity || f.k < (minGe as bigint))) minGe = f.k;
    if (f.rel === 'eq') points.add(f.k);
    if (f.rel === 'ne') holes.push(f.k);
  }
  const covered = (n: bigint) => (maxLe !== -Infinity && n <= (maxLe as bigint)) || (minGe !== Infinity && n >= (minGe as bigint)) || points.has(n) || holes.some((h) => h !== n);
  if (holes.length) return holes.every((h) => covered(h));
  if (maxLe === -Infinity || minGe === Infinity) return false;
  for (let n = (maxLe as bigint) + 1n; n < (minGe as bigint); n++) {
    if (!points.has(n)) return false;
    if (n - (maxLe as bigint) > 10000n) return false;
  }
  return true;
}

// ── Congruence closure, the naive way ──

function checkEuf(facts: { term: Term; positive: boolean }[]): boolean {
  const nodes = new Set<Term>([TRUE, FALSE]);
  const eqs: [Term, Term][] = [];
  const diseqs: [Term, Term][] = [];
  for (const { term, positive } of facts) {
    if (term.op === 'eq') {
      (positive ? eqs : diseqs).push([term.args[0]!, term.args[1]!]);
      for (const s of subterms(term.args[0]!)) nodes.add(s);
      for (const s of subterms(term.args[1]!)) nodes.add(s);
    } else if (term.sort.k === 'bool' && !['and', 'or', 'not', 'imp', 'iff', 'le', 'lt', 'ge', 'gt', 'forall', 'exists'].includes(term.op)) {
      eqs.push([term, positive ? TRUE : FALSE]);
      for (const s of subterms(term)) nodes.add(s);
    } else return false;
  }
  for (const n of nodes) if (n.op === 'forall' || n.op === 'exists') return false;
  const parent = new Map<Term, Term>();
  for (const n of nodes) parent.set(n, n);
  const find = (t: Term): Term => (parent.get(t) === t ? t : find(parent.get(t)!));
  const union = (a: Term, b: Term) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return false;
    parent.set(ra, rb);
    return true;
  };
  for (const [a, b] of eqs) union(a, b);
  const list = [...nodes].filter((n) => n.args.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of list) {
      for (const b of list) {
        if (a === b || find(a) === find(b)) continue;
        if (a.op !== b.op || a.name !== b.name || a.args.length !== b.args.length || String(a.params) !== String(b.params)) continue;
        if (a.args.every((x, i) => find(x) === find(b.args[i]!)) && union(a, b)) changed = true;
      }
    }
  }
  if (find(TRUE) === find(FALSE)) return true;
  for (const [a, b] of diseqs) if (find(a) === find(b)) return true;
  // Two distinct numerals in one class.
  const values = new Map<Term, bigint>();
  for (const n of nodes) {
    if (n.op !== 'num' && n.op !== 'bvnum') continue;
    const r = find(n);
    const v = values.get(r);
    if (v !== undefined && v !== n.value) return true;
    values.set(r, n.value!);
  }
  return false;
}

// ── Arrays ──

function checkRow(lits: { term: Term; positive: boolean }[]): boolean {
  if (lits.some((l) => !l || !l.positive || l.term.op !== 'eq')) return false;
  if (lits.length === 1) {
    // select(store(a, i, v), i) = v
    const [l, r] = lits[0]!.term.args as [Term, Term];
    const check = (sel: Term, v: Term) => sel.op === 'select' && sel.args[0]!.op === 'store' && sel.args[0]!.args[1] === sel.args[1] && sel.args[0]!.args[2] === v;
    return check(l, r) || check(r, l);
  }
  if (lits.length !== 2) return false;
  // i = j ∨ select(store(a, i, v), j) = select(a, j)
  for (const [ij, rw] of [[lits[0]!, lits[1]!], [lits[1]!, lits[0]!]]) {
    const [i1, j1] = ij!.term.args as [Term, Term];
    const [l, r] = rw!.term.args as [Term, Term];
    for (const [s, b] of [[l, r], [r, l]]) {
      if (s!.op !== 'select' || b!.op !== 'select' || s!.args[0]!.op !== 'store') continue;
      const st = s!.args[0]!;
      const j = s!.args[1]!;
      if (b!.args[0] !== st.args[0] || b!.args[1] !== j) continue;
      const i = st.args[1]!;
      if ((i === i1 && j === j1) || (i === j1 && j === i1)) return true;
    }
  }
  return false;
}

// ── Products (non-linear lemmas) ──

/**
 * The facts bound x, y and m = x·y one variable at a time. Derive what multiplication says about m from the facts
 * on x and y, and check that it contradicts the facts on m.
 */
function checkProduct(m: Term, facts: { term: Term; positive: boolean }[]): boolean {
  if (m.op !== 'mul' || m.args.length !== 2) return false;
  const [x, y] = m.args as [Term, Term];
  type Iv = { lo?: bigint; hi?: bigint; ne: bigint[] };
  const iv = new Map<Term, Iv>([[x, { ne: [] }], [y, { ne: [] }], [m, { ne: [] }]]);
  for (const f of facts) {
    const a = arithFact(f.term, f.positive);
    if (!a || a.coeffs.size !== 1) return false;
    const [v, c] = [...a.coeffs][0]!;
    const b = iv.get(v);
    if (!b || c !== 1n) return false;
    if (a.rel === 'le' || a.rel === 'eq') b.hi = b.hi === undefined || a.k < b.hi ? a.k : b.hi;
    if (a.rel === 'ge' || a.rel === 'eq') b.lo = b.lo === undefined || a.k > b.lo ? a.k : b.lo;
    if (a.rel === 'ne') b.ne.push(a.k);
  }
  const X = iv.get(x)!;
  const Y = iv.get(y)!;
  const M = iv.get(m)!;
  // What multiplication allows for m.
  let lo: bigint | undefined;
  let hi: bigint | undefined;
  const exact = (b: Iv) => (b.lo !== undefined && b.lo === b.hi ? b.lo : undefined);
  const ex = exact(X);
  const ey = x === y ? ex : exact(Y);
  if (ex !== undefined && ey !== undefined) lo = hi = ex * ey;
  else if (ex === 0n || ey === 0n) lo = hi = 0n;
  else {
    const nonneg = (b: Iv) => b.lo !== undefined && b.lo >= 0n;
    const nonpos = (b: Iv) => b.hi !== undefined && b.hi <= 0n;
    if (x === y || (nonneg(X) && nonneg(Y)) || (nonpos(X) && nonpos(Y))) lo = 0n;
    else if ((nonneg(X) && nonpos(Y)) || (nonpos(X) && nonneg(Y))) hi = 0n;
    else return false;
  }
  // Contradiction with the facts on m?
  const mlo = M.lo;
  const mhi = M.hi;
  if (lo !== undefined && mhi !== undefined && mhi < lo) return true;
  if (hi !== undefined && mlo !== undefined && mlo > hi) return true;
  if (lo !== undefined && lo === hi && M.ne.includes(lo)) return true;
  return false;
}
