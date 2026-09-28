// Eliminating primitive recursion (section "Computable Functions are Representable in Q"): each
// definition h = Rec(f, g) in a recursive function's definition is replaced, as in the Lemma of
// "Simulating Primitive Recursion", by
//   h(x⃗, y) = β(μd (β(d, 0) = f(x⃗) ∧ ∀i < y β(d, i + 1) = g(x⃗, i, β(d, i))), y),
// leaving only composition and regular minimization (and β, which is itself definable from
// +, × and χ= by composition and regular minimization). This produces the rewritten equations
// for display; it does not evaluate anything.

import { arity, rfTex, type RF } from '../recursive/rf.ts';

export interface Equation {
  name: string;
  /** the original definition, e.g. Rec(P^1_0, succ ∘ (P^3_2)) */
  original: string;
  /** the rewritten right-hand side, TeX */
  rewritten: string;
  /** TeX of the left-hand side, e.g. \mathrm{add}(x_0, y) */
  lhs: string;
  viaBeta: boolean;
}

/** A function term, parenthesised when it is a composition (so that application reads clearly). */
const fn = (f: RF) => (f.k === 'comp' ? `(${rfTex(f)})` : rfTex(f));

const xs = (k: number) => Array.from({ length: k }, (_, i) => `x_{${i}}`);

/** The named definitions in f (innermost first), each with its rewritten form. */
export function eliminateRecursion(f: RF): Equation[] {
  const out: Equation[] = [];
  const seen = new Set<string>();
  const visit = (g: RF) => {
    switch (g.k) {
      case 'def': {
        visit(g.body);
        if (seen.has(g.name)) return;
        seen.add(g.name);
        const ar = arity(g);
        const k = ar.ok ? ar.arity : 0;
        const body = g.body;
        if (body.k === 'rec') {
          const params = xs(k - 1);
          const vx = params.join(', ');
          const F = `${fn(body.f)}(${vx})`;
          const G = `${fn(body.g)}(${vx}${vx ? ', ' : ''}i, \\beta(d, i))`;
          out.push({
            name: g.name,
            lhs: `${g.tex}(${vx}${vx ? ', ' : ''}y)`,
            original: `\\mathrm{Rec}(${rfTex(body.f)}, ${rfTex(body.g)})`,
            rewritten: `\\beta\\bigl(\\mu d\\,[\\beta(d, 0) = ${F} \\land \\forall i < y\\ \\beta(d, i+1) = ${G}],\\ y\\bigr)`,
            viaBeta: true,
          });
        } else {
          const v = xs(k).join(', ');
          out.push({ name: g.name, lhs: `${g.tex}(${v})`, original: rfTex(body), rewritten: `${rfTex(body)}(${v})`, viaBeta: false });
        }
        return;
      }
      case 'comp':
        visit(g.f);
        g.gs.forEach(visit);
        return;
      case 'rec':
        visit(g.f);
        visit(g.g);
        return;
      case 'min':
        visit(g.f);
        return;
      default:
        return;
    }
  };
  visit(f);
  return out;
}
