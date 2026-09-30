# The course kernel

The implementation of type theory shared by two courses:

- [`courses/cic`](../../courses/cic) — *The Calculus of Inductive Constructions*, which explains how this kernel works;
- [`courses/proofs-are-programs`](../../courses/proofs-are-programs) — *Proofs Are Programs*, which uses it to write proofs and verified programs.

It is plain TypeScript with no runtime dependencies. The courses import it through the `@kernel/…` alias
(see their `vite.config.ts`, `vitest.config.ts` and `tsconfig.json`), so there is nothing to build or install here.

```
src/
  core/        TRUSTED: levels, terms, environment, type checker, inductive types
  elab/        elaborator: metavariables, unification, pattern-matching compiler, tactics
  syntax/      lexer and parser (Lean-like syntax, extensible notation)
  frontend.ts  processes commands; every declaration is re-checked by the kernel
  prelude/     core.lean, a fragment of Lean's core library
  untyped/     the untyped λ-calculus (used by the CIC course)
  logic/       propositional natural deduction (used by the CIC course)
```

Only `src/core` has to be correct for the checker to be sound: everything else produces terms that the core
re-checks before they enter the environment.

Both courses' test suites exercise the kernel; the `cic.yml` and `proofs-are-programs.yml` workflows run them
whenever this directory changes.
