// Property-based tests of metatheoretic properties, on the course's engines.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import * as L from '../src/kernel/untyped/lambda.ts';
import { run } from './util.ts';
import { Stepper } from '../src/kernel/core/steps.ts';
import { TypeChecker } from '../src/kernel/core/typechecker.ts';
import { exprEq } from '../src/kernel/core/expr.ts';

const names = ['x', 'y', 'z'];
const termArb: fc.Arbitrary<L.U> = fc.letrec((tie) => ({
  term: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(...names).map((n) => L.V(n)),
    fc.tuple(fc.constantFrom(...names), tie('term')).map(([n, b]) => L.L(n, b as L.U)),
    fc.tuple(tie('term'), tie('term')).map(([f, a]) => L.A(f as L.U, a as L.U)),
  ),
})).term as fc.Arbitrary<L.U>;

describe('untyped λ-calculus', () => {
  it('printing and parsing round-trips up to α', () => {
    fc.assert(fc.property(termArb, (t) => L.alphaEq(L.parseTerm(L.print(t)), t)));
  });
  it('substitution does not capture', () => {
    fc.assert(
      fc.property(termArb, fc.constantFrom(...names), termArb, (t, x, s) => {
        const r = L.subst(t, x, s);
        const allowed = new Set([...[...L.freeVars(t)].filter((v) => v !== x), ...L.freeVars(s)]);
        return [...L.freeVars(r)].every((v) => allowed.has(v));
      }),
    );
  });
  it('normal forms do not depend on the strategy (confluence)', () => {
    fc.assert(
      fc.property(termArb, (t) => {
        const a = L.normalize(t, 'normal', undefined, 150, 400);
        const b = L.normalize(t, 'applicative', undefined, 150, 400);
        if (!a.normal || !b.normal) return true;
        return L.alphaEq(a.final, b.final);
      }),
      { numRuns: 300 },
    );
  });
  it('normal order finds a normal form whenever applicative order does', () => {
    fc.assert(
      fc.property(termArb, (t) => {
        const b = L.normalize(t, 'applicative', undefined, 100, 400);
        if (!b.normal) return true;
        return L.normalize(t, 'normal', undefined, 2000, 4000).normal;
      }),
      { numRuns: 300 },
    );
  });
});

describe('CIC terms', () => {
  const src = `
def double : Nat → Nat
  | 0 => 0
  | n + 1 => double n + 2
def fact : Nat → Nat
  | 0 => 1
  | n + 1 => (n + 1) * fact n
#check double 3
#check fact 3
#check List.length (1 :: 2 :: 3 :: List.nil)
#check (fun (f : Nat → Nat) (x : Nat) => f (f x)) (fun n => n + 1) 2
#check List.map (fun n => n * 2) (1 :: 2 :: List.nil)
#check (⟨1, Bool.true⟩ : Nat × Bool).1
#check Nat.rec (motive := fun _ => Nat) 0 (fun _ ih => ih + 3) 4
#check (fun (p q : Prop) (hp : p) (hq : q) => (And.intro hp hq).right)
`;
  const r = run(src);
  const terms = r.results.flatMap((x) => (x.output?.k === 'check' ? [x.output] : []));
  it('the examples elaborate', () => {
    expect(r.errors).toEqual([]);
    expect(terms.length).toBe(8);
  });
  it('every reduction step preserves the type (subject reduction)', () => {
    for (const t of terms) {
      const st = new Stepper(r.env);
      const tr = st.trace(t.expr, 400);
      const tc = new TypeChecker(r.env, t.lctx);
      for (const s of tr.steps) {
        const ty = tc.infer(s.after);
        expect(tc.isDefEq(ty, t.type)).toBe(true);
      }
    }
  });
  it('small-step reduction agrees with the kernel normaliser', () => {
    for (const t of terms) {
      const st = new Stepper(r.env);
      const tr = st.trace(t.expr, 2000);
      expect(tr.normal).toBe(true);
      const nf = new TypeChecker(r.env, t.lctx).normalize(t.expr);
      expect(exprEq(tr.final, nf)).toBe(true);
    }
  });
});
