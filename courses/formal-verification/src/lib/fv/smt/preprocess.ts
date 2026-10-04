/**
 * Preprocessing: rewrite a formula into the fragment the DPLL(T) core handles, adding definitions for the fresh
 * symbols it introduces (each step preserves satisfiability):
 *
 *   - read over write: a[i ↦ v][j] becomes (if i = j then v else a[j]);
 *   - integer division and remainder by a numeral k: x div k becomes a fresh q with x = k·q + r, 0 ≤ r < |k|;
 *   - non-Boolean if-then-else: becomes a fresh constant c with (cond ⟹ c = a) ∧ (¬cond ⟹ c = b);
 *   - distinct and xor are expanded;
 *   - products of non-constant integer terms are multiplied out into sums of monomials whose factors are in a
 *     canonical order, so that (i + 1)·(i + 2) and i·i + 3·i + 2 become the same linear combination of the same
 *     product atoms (polynomial normal form; the non-linear solver then sees each monomial as one atom).
 *
 * Quantified subformulas are left alone: their instances are preprocessed when they are created.
 */
import { add, and, eq, freshVar, ge, iff, imp, INT, ite, lt, mk, mul, not, num, rebuild, select, type Term } from '../logic/term';

export class Preprocessor {
  private memo = new Map<Term, Term>();
  /** Definitions of fresh symbols, to assert alongside. */
  defs: Term[] = [];
  /** Fresh symbols introduced (name → what they stand for), for explaining models. */
  fresh = new Map<string, Term>();

  run(t: Term): Term {
    const m = this.memo.get(t);
    if (m) return m;
    let out: Term;
    if (t.op === 'forall' || t.op === 'exists' || !t.args.length) out = t;
    else {
      const args = t.args.map((a) => this.run(a));
      out = this.rewrite(t, args);
    }
    this.memo.set(t, out);
    return out;
  }

  private rewrite(t: Term, args: Term[]): Term {
    switch (t.op) {
      case 'select':
        return this.readOverWrite(args[0]!, args[1]!);
      case 'div':
      case 'mod': {
        const [x, k] = args as [Term, Term];
        if (k.op !== 'num' || k.value === 0n) return mk(t.op, args, t.sort);
        const kk = k.value!;
        const q = freshVar('q', INT);
        const r = freshVar('r', INT);
        this.defs.push(and(eq(x, add(mul(num(kk), q), r)), ge(r, num(0)), lt(r, num(kk < 0n ? -kk : kk))));
        this.fresh.set(q.name!, mk('div', args, INT));
        this.fresh.set(r.name!, mk('mod', args, INT));
        // Share the pair between x div k and x mod k.
        this.memo.set(mk('div', args, INT), q);
        this.memo.set(mk('mod', args, INT), r);
        return t.op === 'div' ? q : r;
      }
      case 'ite': {
        const [c, a, b] = args as [Term, Term, Term];
        const built = ite(c, a, b);
        if (built.op !== 'ite' || built.sort.k === 'bool') return built;
        const k = freshVar('ite', built.sort);
        this.defs.push(and(imp(c, eq(k, a)), imp(not(c), eq(k, b))));
        this.fresh.set(k.name!, built);
        return k;
      }
      case 'mul': {
        const [a, b] = args as [Term, Term];
        if (t.sort.k !== 'int') break;
        if (a.op === 'num' || b.op === 'num') return canonical(rebuild(t, args));
        return expandProduct(a, b) ?? mk('mul', args, t.sort);
      }
      case 'add':
      case 'sub':
      case 'neg':
        // Integer sums in canonical form, so that (k + 1) − 1 and k are the same term (this matters inside
        // function arguments, where congruence closure compares terms syntactically).
        if (t.sort.k === 'int') return canonical(rebuild(t, args));
        break;
      case 'distinct': {
        const ps: Term[] = [];
        for (let i = 0; i < args.length; i++) for (let j = i + 1; j < args.length; j++) ps.push(not(eq(args[i]!, args[j]!)));
        return and(...ps);
      }
      case 'xor':
        return not(iff(args[0]!, args[1]!));
      default:
        break;
    }
    return args.every((a, i) => a === t.args[i]) ? t : rebuild(t, args);
  }

  private readOverWrite(a: Term, j: Term): Term {
    if (a.op === 'store') {
      const [base, i, v] = a.args as [Term, Term, Term];
      const c = eq(i, j);
      if (c.op === 'true') return v;
      const rest = this.readOverWrite(base, j);
      if (c.op === 'false') return rest;
      return this.run(ite(c, v, rest));
    }
    if (a.op === 'ite') {
      const [c, x, y] = a.args as [Term, Term, Term];
      return this.run(ite(c, this.readOverWrite(x, j), this.readOverWrite(y, j)));
    }
    return select(a, j);
  }
}

// ── Polynomial normal form for products ──

type Poly = Map<string, { f: Term[]; c: bigint }>;

function polyOf(t: Term): Poly {
  const p: Poly = new Map();
  const addTo = (q: Poly, key: string, f: Term[], c: bigint) => {
    const cur = q.get(key);
    const n = (cur?.c ?? 0n) + c;
    if (n === 0n) q.delete(key);
    else q.set(key, { f, c: n });
  };
  switch (t.op) {
    case 'num':
      if (t.value !== 0n) p.set('', { f: [], c: t.value! });
      return p;
    case 'add':
      for (const a of t.args) for (const [k, m] of polyOf(a)) addTo(p, k, m.f, m.c);
      return p;
    case 'sub':
      for (const [k, m] of polyOf(t.args[0]!)) addTo(p, k, m.f, m.c);
      for (const [k, m] of polyOf(t.args[1]!)) addTo(p, k, m.f, -m.c);
      return p;
    case 'neg':
      for (const [k, m] of polyOf(t.args[0]!)) addTo(p, k, m.f, -m.c);
      return p;
    case 'mul':
      if (t.sort.k === 'int') return polyMul(polyOf(t.args[0]!), polyOf(t.args[1]!));
  }
  p.set(String(t.id), { f: [t], c: 1n });
  return p;
}

function polyMul(a: Poly, b: Poly): Poly {
  const out: Poly = new Map();
  for (const x of a.values()) {
    for (const y of b.values()) {
      const f = [...x.f, ...y.f].sort((u, v) => u.id - v.id);
      const key = f.map((u) => u.id).join('*');
      const cur = out.get(key);
      const n = (cur?.c ?? 0n) + x.c * y.c;
      if (n === 0n) out.delete(key);
      else out.set(key, { f, c: n });
    }
  }
  return out;
}

/** A linear integer term as a canonical sum: monomials in a fixed order, constant last. */
function canonical(t: Term): Term {
  return fromPoly(polyOf(t)) ?? t;
}

function fromPoly(p: Poly): Term | undefined {
  if (p.size > 64) return undefined;
  const entries = [...p.entries()].sort(([x], [y]) => (x === '' ? 1 : y === '' ? -1 : x < y ? -1 : x > y ? 1 : 0));
  const terms = entries.map(([, m]) => {
    if (!m.f.length) return num(m.c);
    const mono = m.f.slice(1).reduce((acc, f) => mk('mul', [acc, f], INT), m.f[0]!);
    return m.c === 1n ? mono : mul(num(m.c), mono);
  });
  return terms.length ? add(...terms) : num(0);
}

/** a·b multiplied out, or undefined when it would be too large to be worth it. */
function expandProduct(a: Term, b: Term): Term | undefined {
  return fromPoly(polyMul(polyOf(a), polyOf(b)));
}
