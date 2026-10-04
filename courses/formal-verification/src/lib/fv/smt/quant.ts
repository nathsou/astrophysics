/**
 * Quantifier instantiation by E-matching (Detlefs, Nelson and Saxe's Simplify, 2005; de Moura and Bjørner 2007):
 * a universally quantified fact ∀x. φ(x) comes with triggers — patterns such as a[x] or f(x, y) — and is
 * instantiated with the ground terms that match a trigger modulo the equalities currently known. When no trigger
 * applies, it falls back to instantiating with ground terms of the right sort (enumerative instantiation).
 *
 * Instantiation is incomplete in general: when no new instance appears and the formula still looks satisfiable,
 * the solver answers "unknown" (or hands a candidate model to the reference interpreter).
 */
import { freeVars, type Term } from '../logic/term';
import type { Euf } from './euf';

const ARITH = new Set(['add', 'sub', 'mul', 'neg', 'div', 'mod', 'le', 'lt', 'ge', 'gt', 'eq', 'not', 'and', 'or', 'imp', 'iff', 'ite', 'xor', 'distinct', 'forall', 'exists']);

const headKey = (t: Term) => `${t.op}:${t.name ?? ''}:${t.args.length}:${t.params?.join(',') ?? ''}`;

/** Choose triggers: application or array-read subterms mentioning bound variables, covering all of them. */
export function inferTriggers(bound: readonly Term[], body: Term): Term[][] {
  const vars = new Set(bound);
  const candidates: Term[] = [];
  const seen = new Set<Term>();
  const visit = (t: Term, insideArith: boolean) => {
    if (seen.has(t)) return;
    seen.add(t);
    if ((t.op === 'app' || t.op === 'select') && t.args.length) {
      const fv = [...freeVars(t)].filter((x) => vars.has(x));
      // Prefer patterns whose bound variables appear directly (not under arithmetic).
      const direct = fv.length > 0 && !hasArithOverVar(t, vars);
      if (direct) candidates.push(t);
    }
    for (const a of t.args) visit(a, insideArith || ARITH.has(t.op));
  };
  visit(body, false);
  // Single triggers covering every variable, smallest first.
  const covers = (ts: Term[]) => bound.every((b) => ts.some((t) => freeVars(t).has(b)));
  const size = (t: Term): number => 1 + t.args.reduce((s, a) => s + size(a), 0);
  candidates.sort((a, b) => size(a) - size(b));
  const singles = candidates.filter((c) => covers([c]));
  if (singles.length) {
    // Keep the minimal ones (not containing another single trigger).
    return singles.filter((s) => !singles.some((o) => o !== s && containsSub(s, o))).slice(0, 3).map((s) => [s]);
  }
  // A greedy multi-trigger.
  const multi: Term[] = [];
  for (const c of candidates) {
    if (covers(multi)) break;
    const adds = bound.some((b) => freeVars(c).has(b) && !multi.some((m) => freeVars(m).has(b)));
    if (adds) multi.push(c);
  }
  return covers(multi) && multi.length ? [multi] : [];
}

function containsSub(t: Term, s: Term): boolean {
  return t !== s && t.args.some((a) => a === s || containsSub(a, s));
}

function hasArithOverVar(t: Term, vars: Set<Term>): boolean {
  for (const a of t.args) {
    if (ARITH.has(a.op) && [...freeVars(a)].some((x) => vars.has(x))) return true;
    if ((a.op === 'app' || a.op === 'select') && hasArithOverVar(a, vars)) return true;
  }
  return false;
}

export type Subst = Map<Term, Term>;

export class Matcher {
  private byHead = new Map<string, Term[]>();
  constructor(private euf: Euf) {
    for (const n of euf.nodes) {
      const k = headKey(n);
      (this.byHead.get(k) ?? this.byHead.set(k, []).get(k)!).push(n);
    }
  }

  /** All substitutions making the (multi-)trigger match ground terms modulo equality. */
  matchAll(trigger: readonly Term[], bound: Set<Term>, limit = 2000): Subst[] {
    let results: Subst[] = [new Map()];
    for (const p of trigger) {
      const next: Subst[] = [];
      for (const s of results) {
        for (const g of this.byHead.get(headKey(p)) ?? []) {
          for (const r of this.matchArgs(p, g, s, bound)) {
            next.push(r);
            if (next.length >= limit) break;
          }
        }
      }
      results = next;
      if (!results.length) break;
    }
    return results;
  }

  private matchArgs(p: Term, g: Term, s: Subst, bound: Set<Term>): Subst[] {
    let res: Subst[] = [s];
    for (let i = 0; i < p.args.length; i++) {
      const next: Subst[] = [];
      for (const r of res) next.push(...this.match(p.args[i]!, g.args[i]!, r, bound));
      res = next;
      if (!res.length) break;
    }
    return res;
  }

  /** Match pattern p against the class of ground term g. */
  private match(p: Term, g: Term, s: Subst, bound: Set<Term>): Subst[] {
    if (bound.has(p)) {
      const b = s.get(p);
      if (b) return this.euf.find(b) === this.euf.find(g) ? [s] : [];
      const r = new Map(s);
      r.set(p, g);
      return [r];
    }
    if (![...freeVars(p)].some((x) => bound.has(x))) {
      if (p === g) return [s];
      return this.euf.has(p) && this.euf.find(p) === this.euf.find(g) ? [s] : [];
    }
    const out: Subst[] = [];
    const k = headKey(p);
    for (const m of this.euf.classOf(g)) {
      if (headKey(m) !== k) continue;
      out.push(...this.matchArgs(p, m, s, bound));
    }
    return out;
  }
}
