/**
 * Preprocessing: rewrite a formula into the fragment the DPLL(T) core handles, adding definitions for the fresh
 * symbols it introduces (each step preserves satisfiability):
 *
 *   - read over write: a[i ↦ v][j] becomes (if i = j then v else a[j]);
 *   - integer division and remainder by a numeral k: x div k becomes a fresh q with x = k·q + r, 0 ≤ r < |k|;
 *   - non-Boolean if-then-else: becomes a fresh constant c with (cond ⟹ c = a) ∧ (¬cond ⟹ c = b);
 *   - distinct and xor are expanded.
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
      case 'distinct': {
        const ps: Term[] = [];
        for (let i = 0; i < args.length; i++) for (let j = i + 1; j < args.length; j++) ps.push(not(eq(args[i]!, args[j]!)));
        return and(...ps);
      }
      case 'xor':
        return not(iff(args[0]!, args[1]!));
      default:
        return args.every((a, i) => a === t.args[i]) ? t : rebuild(t, args);
    }
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
