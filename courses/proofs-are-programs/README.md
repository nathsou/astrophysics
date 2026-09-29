# Proofs Are Programs

*The Curry–Howard correspondence, for programmers.* An interactive course in which readers write proofs as
programs, prove programs correct — an interpreter, a compiler, a type checker — and finish by building a small
kernel for dependent types of their own.

The course runs on the language and kernel of the CIC course (`packages/kernel`, shared by both), extended for
this course with tactics, `simp`, `omega`, type classes, `if`, compiled `#eval` and random testing (`#test`).

## Contents

| Part | Chapters |
|---|---|
| Prologue | A function you cannot write |
| I · Types as promises | 1. Programs · 2. What a type can promise · 3. Evidence: the sort Prop |
| II · Logic is a library | 4. Proofs as terms · 5. Quantifiers · 6. Equality · 7. What you cannot prove |
| III · Tactics | 8. From terms to tactics · 9. The toolbox · 10. Automation that leaves a proof behind |
| IV · Recursion is induction | 11. Induction · 12. Termination and consistency · 13. Inductive predicates and decidability |
| V · Verified programs | 14. Fast = correct · 15. Sorting · 16. An interpreter and an optimiser · 17. A compiler to a stack machine · 18. A typed language · 19. Reflection |
| VI · Build your own kernel | 20. A verified type checker · 21. A dependent type checker |
| Epilogue | Where to go next |

The plan and its rationale are in [`docs/PLAN.md`](docs/PLAN.md).

## The language

Everything the reader types is checked by the kernel in `packages/kernel/src/core`; everything else produces
terms that the kernel re-checks. The extensions used by this course live in the elaborator:

```
packages/kernel/src/
  elab/tactics.ts     tactic engine: goals, steps (for the goal view and the proof-term lens), the tactics
  elab/simp.ts        simp, rw, unfold: rewriting with congruence proofs
  elab/omega.ts       linear arithmetic, proved by reflection with the verified Omega library
  elab/instances.ts   type-class resolution (Decidable, DecidableEq, …)
  elab/deriving.ts    deriving DecidableEq
  elab/calc.ts        calc chains and h ▸ e
  eval/compile.ts     #eval: erasure and compilation to JavaScript closures (Nat as BigInt)
  eval/random.ts      #test: random values and counterexamples
  prelude/std.lean    the course's standard library (Decidable, if, Nat and List lemmas, Omega)
```

Definitions by pattern matching get equation lemmas `f.eq_1`, `f.eq_2`, … (proved by `rfl`), which `simp [f]`,
`rw [f]` and `unfold f` use.

## Develop

```bash
npm ci
npm run dev        # development server
npm test           # prelude, language regression files (tests/lean), every snippet in the chapters
npm run build      # type-check and build to dist/
```

`SCRATCH=path/to/file.lean npx vitest run tests/scratch.test.ts` checks a file and prints `#eval`/`#test` output.

## Bridges with the CIC course

Both courses are built into sibling directories of the same site. Chapters list the CIC chapters that explain
the theory they rely on (*Under the hood*), every playground can open its code in the CIC playground (⇄ CIC),
and the reference page *The CIC course, chapter by chapter* maps the two courses onto each other.
