// Two consequences of the representability clauses (a) and (b), derived for particular inputs:
//
// – Lemma "rep-q" (section Functions Representable in Q are Computable): if m ≠ f(n⃗) then
//   Q ⊢ ¬A_f(n̄⃗, m̄). From (b), ∀y (A_f(n̄⃗, y) → y = f(n⃗)̄) gives A_f(n̄⃗, m̄) → m̄ = f(n⃗)̄, and
//   Q ⊢ m̄ ≠ f(n⃗)̄ (Lemma "Q proves different numerals are different").
// – Theorem "representing relations": with A_R(x⃗) = A_χR(x⃗, 1̄), Q ⊢ A_R(n̄⃗) if R(n⃗) (clause (a)
//   with χR(n⃗) = 1), and Q ⊢ ¬A_R(n̄⃗) if not (the case above with m = 1, χR(n⃗) = 0).
//
// Each derivation is built for the given numbers and must then be checked (nd.ts `check`).

import * as A from '../syntax/ast.ts';
import type { Formula } from '../syntax/ast.ts';
import { subst } from '../syntax/subst.ts';
import { D, type Deriv } from '../proof/nd.ts';
import { deriveNeq, num } from '../proof/q.ts';
import { deriveClauses, instance, representing, type Representation } from './represent.ts';

export interface NotValue {
  /** f(n⃗) */
  value: bigint;
  rep: Representation;
  /** ¬A_f(n̄⃗, m̄) */
  target: Formula;
  deriv: Deriv;
  /** the derivation of clause (b) it starts from */
  clauseB: Deriv;
}

/** Q ⊢ ¬A_f(n̄⃗, m̄) for m ≠ f(n⃗): from clause (b) and m̄ ≠ f(n⃗)̄. */
export function deriveNotValue(f: Parameters<typeof deriveClauses>[0], args: bigint[], m: bigint): NotValue | { error: string } {
  const rep = representing(f);
  if ('error' in rep) return { error: rep.error };
  const cl = deriveClauses(f, args);
  if ('error' in cl) return { error: cl.error };
  if (cl.value === m) return { error: `${m} is the value f(${args.join(', ')}), so A_f(n̄⃗, m̄) is provable, not refutable` };
  const b = cl.b;
  if (b.concl.k !== 'forall') return { error: 'unexpected form of clause (b)' };
  const label = 1_000;
  const ins = args.map((a) => `${a}̄`).join(', ');
  const group = `refuting A_f(${ins}, ${m}̄)`;
  const inst = D.allE(b, num(m), { note: `Clause (b) with y := ${m}̄.`, group });
  const hyp = D.assume(A.cloneFresh(instance(rep, args, num(m))), label, { note: `Suppose A_f(${ins}, ${m}̄).`, group });
  const eq = D.impE(inst, hyp, { note: `Then ${m}̄ = ${cl.value}̄ by clause (b).`, group });
  const neq = deriveNeq(m, cl.value, { next: 2_000 }, `${m}̄ ≠ ${cl.value}̄`);
  const bot = D.notE(neq, eq, { note: `But Q proves ${m}̄ ≠ ${cl.value}̄: contradiction.`, group });
  const target = A.not(instance(rep, args, num(m)));
  const deriv = D.notI(bot, A.cloneFresh(instance(rep, args, num(m))), label, { note: 'Discharge the supposition.', group });
  return { value: cl.value, rep, target, deriv, clauseB: b };
}

export interface RelationDerivation {
  /** χ_R(n⃗) */
  chi: bigint;
  holds: boolean;
  /** A_R(x⃗) = A_χR(x⃗, 1̄) */
  formula: Formula;
  /** A_R(n̄⃗) or ¬A_R(n̄⃗) */
  target: Formula;
  deriv: Deriv;
  rep: Representation;
}

/** For a relation R given by its characteristic function χ_R: a derivation of A_R(n̄⃗) or of ¬A_R(n̄⃗). */
export function deriveRelation(chi: Parameters<typeof deriveClauses>[0], args: bigint[]): RelationDerivation | { error: string } {
  const rep = representing(chi);
  if ('error' in rep) return { error: rep.error };
  const formula = subst(rep.formula, rep.output, num(1));
  const cl = deriveClauses(chi, args);
  if ('error' in cl) return { error: cl.error };
  if (cl.value !== 0n && cl.value !== 1n) return { error: `χ(${args.join(', ')}) = ${cl.value}: a characteristic function only takes the values 0 and 1` };
  if (cl.value === 1n) {
    return { chi: 1n, holds: true, formula, target: cl.a.concl, deriv: cl.a, rep };
  }
  const nv = deriveNotValue(chi, args, 1n);
  if ('error' in nv) return nv;
  return { chi: 0n, holds: false, formula, target: nv.target, deriv: nv.deriv, rep };
}
