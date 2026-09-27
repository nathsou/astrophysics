# The Calculus of Inductive Constructions — an interactive course

An interactive textbook that builds the Calculus of Inductive Constructions (CIC) — the type theory behind Lean 4 — from the untyped λ-calculus upwards, one idea at a time. It is written for software engineers: no prior type theory is assumed.

Every example runs on a real kernel, written for the course in TypeScript and running in the browser. It covers the whole λ-cube (the simply typed λ-calculus, System F, Fω, λP, the Calculus of Constructions) and Lean 4's CIC: universe polymorphism, impredicative `Prop` with definitional proof irrelevance, inductive families, recursors, strict positivity, subsingleton elimination, η for functions and structures, and quotients.

## Contents

| Part | Chapters |
|---|---|
| Prologue | Why a calculus? Proof checking, kernels and the de Bruijn criterion |
| I · Computation | 1. The λ-calculus · 2. Names, binders and substitution |
| II · Types | 3. Simple types · 4. Propositions as types · 5. System F · 6. Fω · 7. Dependent types · 8. The λ-cube |
| III · The Calculus of Constructions | 9. CoC · 10. Universes |
| IV · Inductive constructions | 11. Inductive types · 12. Strict positivity · 13. Families and equality · 14. Prop · 15. Pattern matching and recursion · 16. Mutual, nested and well-founded |
| V · The whole system | 17. CIC on one page · 18. Metatheory · 19. Lean 4's type theory · 20. Beyond CIC |

Also included: a full-page playground where you can switch between calculi, a rule index, an interactive timeline, a glossary and a reading list.

## Interactive components

- **Playgrounds**: a CodeMirror editor with Lean-style syntax and Unicode input (`\lam`, `\to`, `\all`, …), live checking, hover types, goal display for `?holes`, and results panels. Each result can open a **derivation tree** (built by the kernel as it checks) or a **step-by-step reduction** (β, δ, ζ, ι).
- **λ-lab** (Part I): reduction under four strategies with clickable redexes, animated syntax trees (SVG), Tromp diagrams (Canvas) and complete reduction graphs (WebGL2, with a force-directed layout).
- **Binders**: arcs from variable occurrences to their binders, named terms and de Bruijn indices side by side, naive versus capture-avoiding substitution, and the kernel's locally nameless representation.
- **Proof builder** (Chapter 4): goal-directed natural deduction with the Curry–Howard proof term built alongside and sent to the kernel.
- **λ-cube** (Chapter 8): a rotatable WebGL cube; type a term to see which corners accept it.
- **Universe explorer**, **recursor anatomy**, **positivity checker**, **equation-compiler view**, **kernel trace**, and **break the kernel** (switch off a restriction and derive `False`).
- **Exercises**, checked automatically by the kernel or the λ-evaluator, with progress saved in the browser.

## Architecture

```
src/
  kernel/            the course's implementation of type theory
    core/            TRUSTED: levels, terms, environment, type checker, inductive types
    elab/            elaborator: metavariables, unification, pattern-matching compiler
    syntax/          lexer and parser (Lean-like syntax, extensible notation)
    frontend.ts      processes commands; every declaration is re-checked by the kernel
    prelude/core.lean  a fragment of Lean's core library, checked at startup
    untyped/         the untyped λ-calculus (Part I)
    logic/           propositional natural deduction (Chapter 4)
  viz/               interactive components (SolidJS; SVG, Canvas 2D, WebGL2)
  content/chapters/  the chapters, in MDX
  app/               application shell
build/               MDX plugins (KaTeX pre-rendering, live code blocks)
tests/               kernel, elaborator and property-based tests; every snippet in the chapters is checked
```

The kernel follows Lean 4's design: locally nameless terms, lazy δ-reduction by definitional height, recursors generated from inductive declarations (with fixed-index promotion, subsingleton elimination and K-like reduction), and no recursion in the kernel. Pattern matching and structural recursion are compiled to `casesOn`/`rec` by the elaborator, including dependent pattern matching with index unification (conflict, injection, substitution). Only `src/kernel/core` needs to be correct for soundness.

## Development

Requires Node.js 20.19 or later.

```bash
npm install
npm run dev        # development server
npm test           # kernel tests + checks every code snippet in the chapters
npm run build      # type-check with TypeScript 7 and build to dist/
```

Built with TypeScript 7, Vite 8, SolidJS, MDX, KaTeX and CodeMirror 6.

## Deployment

The site is static and uses hash-based routing, so it works from any path. The monorepo's root build includes it at `/cic/`, and the root GitHub Actions workflow deploys all three courses together.
