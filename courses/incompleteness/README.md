# Incompleteness and Computability — an executable edition

An interactive adaptation of **[Incompleteness and Computability](https://ic.openlogicproject.org/)** by [Richard Zach](https://richardzach.org/) and the [Open Logic Project](https://openlogicproject.org/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The goal is an executable textbook: readers construct a mathematical object (a formula, a substitution, a recursive function, a sentence $B(x)$), inspect how it behaves, understand why, and then find it inside the rigorous proof.

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # engine, conversion and property tests
npm run typecheck
npm run build          # conversion check + type check + production build into dist/
npm run convert        # regenerate src/content/source/ from upstream/
npm run upstream:sync -- --openlogic ../OpenLogic --ic ../incompleteness-computability
```

## What is in it

The whole book — chapters 1–9 and appendices A–D — is converted from its LaTeX source and can be read in **Formal** mode. Nearly every section also has **Intuition** (explanations written for this edition) and **Explore** (a workbench) modes; the biographies and a few sections where no computation would illustrate anything honestly are text-only.

| Chapter | Workbenches |
|---|---|
| 1 Introduction | the book’s test for induction axioms, step by step; a Δ0 toy version of the diagonal argument for undecidability |
| 2 Recursive functions | primitive recursion stepped row by row, composition, the book’s notations and their numbers, the library of official definitions down to zero/succ/projections, bounded minimization, primes, trees, course-of-values recursion, the g_n hierarchy and Ackermann, diagonalization, unbounded search, the halting diagonal |
| 3 Arithmetization of syntax | formula ⇄ symbols ⇄ codes ⇄ Gödel number with traces; substitution and capture; `hSubst` on Gödel numbers; derivations coded exactly as the book defines them, and decoded |
| 4 Representability in Q | a recursive-function builder; representing formulas linked to the computation; **checked** derivations in Q of both clauses, minimization included (with Q’s lemmas about `<` derived for the numbers needed); the β-function via Sunzi’s theorem; primitive recursion simulated with β; relations; Σ1 formulas and the Σ1-completeness argument |
| 5 Incompleteness | the fixed-point construction keeping formula / Gödel number / numeral apart, with a **checked** derivation; a dependency explorer for the first theorem; Rosser’s race; the second incompleteness theorem, Löb and Tarski **checked** line by line from P1–P3, and a proof editor for the book’s problems |
| 6 Computability and incompleteness | computation records with a decidable T and U (this edition’s coding), the normal-form search, s-m-n, the universal function, c.e. sets enumerated in stages, the race between a set and its complement, Craig’s trick, incompleteness via halting |
| 7 Models of arithmetic | satisfaction traces, models of Q (why no finite structure satisfies Q1 and Q2), isomorphism search, reducts, non-standard order types (illustration), computable models |
| 8 Second-order logic | second-order satisfaction on small domains (Inf, Fin, Count, identity, transitive closure), failure of compactness |
| 9 λ-calculus | the Lambda Lab: clickable redexes, four strategies with fuel-bounded status, capture-avoiding substitution with its trace, α-renaming, reduction graphs, Church encodings, λ-definability, fixpoints |
| A, C Derivations | an interactive natural deduction builder with the checker after every change, the book’s examples checked, a finite soundness lab, checked derivations in Q (both halves of Rosser’s argument) and in PA with induction axioms recognised by the book’s test |
| B First-order logic | formula anatomy, structures, assignments and x-variants, extensionality, countermodel search |

The object a section works with persists across modes (and visits), so the same formula can be followed from intuition to workbench to the formal definition where the text uses it: Formal mode attaches computed panels to specific definitions and proofs.

Small slips in the printed text are corrected in place (see *Corrections* below).

## What is computed, checked and proved

The course is explicit about how each claim is established:

- **Computed** — produced by the engine for the reader’s input. A computed example illustrates, it does not prove.
- **Checked** — every inference verified by a checker (natural deduction, or — for chapter 5’s metatheorems — the derivability conditions plus truth tables). A checked derivation is about one sentence, not the general theorem; the course says so wherever one appears.
- **Theorem** — a general result, proved in the text.

Every theorem-like block of the text links to its exact source lines at the pinned upstream commit.

## Architecture

```
upstream/                 pinned copies of the LaTeX sources (+ UPSTREAM.json: repos, commits, licence)
scripts/
  convert.ts              upstream LaTeX → src/content/source/*.json (committed; `--check` in the build)
  latex/macros.ts         reads macro definitions from open-logic-config.sty and ic-config.sty (xparse interpreter)
  latex/expand.ts         Open Logic macros → KaTeX-ready TeX
  latex/document.ts       text → blocks: environments, labels, references, numbering, source locations, bussproofs trees
  sync-upstream.ts        refreshes upstream/ from local checkouts
src/
  engine/                 the mathematics — pure TypeScript, no DOM, no React
    numbers/              exact symbolic naturals (sequence codes, runs, named numbers), magnitude estimates, primes
    syntax/               typed ASTs with stable node ids, parser, printers, analysis, substitution with traces
    coding/               symbol codes, Gödel numbering, decoding with traces, arithmetized substitution (hSubst)
    recursive/            recursive functions: arity checking, evaluation with call traces
    proof/                natural deduction checker (the book's rules, eigenvariable conditions), Q and its lemmas
    represent/            representing formulas as in the book, derivations of clauses (a) and (b)
    fixedpoint/           the fixed-point construction and its derivation
    provability/          proofs from the derivability conditions (P1–P3, truth tables), Rosser's case analysis
    computability/        the library of primitive recursive functions, β, Ackermann, indices, records, s-m-n, c.e. sets
    semantics/            structures, assignments, satisfaction with traces, models of Q, Σ1, second-order logic, isomorphisms
    lambda/               λ-terms, substitution with traces, reduction strategies, graphs, Church encodings
  content/                course plan, shared objects, exercises, section content (MDX) and formal annotations
    sections/<id>/        meta.ts (blurb, object), intuition.mdx, explore.mdx, formal.tsx — one directory per section
  formal/                 renderer for the converted text
  ui/                     formula views, inspector, stepper, proof debugger, number views
  workbench/              the workbenches; they only visualise engine results and traces
tests/                    vitest: engines, conversion, property tests
```

Design rules:

- The engine never depends on the UI. Operations return structured results and traces (substitution steps, decoding stages, evaluation call trees, derivation checks); the UI renders them.
- Formulas are typed trees, never strings of rendered LaTeX. Every node has an id; views mark elements with `data-n` so that hovering one occurrence highlights it — and its binder, and its symbols, codes and prime factors — in every view.
- Huge numbers are exact but symbolic: a Gödel number is a sequence code whose elements may be runs (numerals of huge numbers) or named numbers (such as the code of `D_diag(x, y)`). Equality is structural and sound; digits are computed only on request.
- Derivations are generated for concrete inputs and then *independently* checked; nothing is displayed as checked unless the checker accepted it. Derivations are generated for every basic function, composition and minimization (with Q's lemmas about `<` derived for the numbers needed); where the course shows something unchecked, it says so.

## The conversion pipeline

The converter follows the book’s driver `ic.tex` as LaTeX would: chapter and section imports, the book’s tags (`\iftag`, `\tagitem`), label qualification (`\olfileid`, `\ollabel`, `\olref`), and numbering per chapter. Macros are read from the upstream `.sty` files, so a notation change upstream flows through. A handful of macros defined with TeX primitives (`\gn`, `\pto`, `\mathbi`, …) are replaced explicitly in `scripts/latex/macros.ts`, each with its reason. Anything else unknown is an error in `src/content/source/report.json`, rendered visibly in the text, and fails `npm run build`.

### Corrections

Obvious slips in the book (a wrong index or equation reference, a misnamed function, a formula that does not say what the text means, typos) are corrected in the rendered text without comment. The corrections are applied to the LaTeX before conversion by `scripts/latex/errata.ts`, from `errata/<chapter>.json`: each entry gives the file, the exact passage, its replacement and a one-line reason. A passage must match exactly once; if an upstream change alters it (for instance because the slip was fixed there), conversion fails with `erratum-unmatched` and the entry can simply be deleted.

### Updating from upstream

1. `npm run upstream:sync -- --openlogic <OpenLogic checkout> --ic <incompleteness-computability checkout>`
2. `npm run convert` and review the diff of `src/content/source/` and `report.json`.
3. Annotations attach to blocks by label, by kind and position within a section (`inc.art.cod:defn:1`), or, for plain paragraphs, by block id (`sol.set.crd/p12`); check that they still sit where intended.

## Conventions added by this edition

The book leaves some choices open; this edition fixes them and says so on the About page:

- official symbols of arithmetic: `0 = c₀`, `′ = f¹₀`, `+ = f²₀`, `× = f²₁`, `< = P²₀`;
- variables `v₀, v₁, …` are displayed `x, y, z, u, w, x₀, y₀, …`; constants `c₁, c₂, …` (eigenvariables) as `a, b, …`;
- numerals are single nodes that *are* the terms `0′…′` for equality, substitution and coding.

## Roadmap

- The Rosser derivations still take the facts about Prf and Ref as hypotheses; deriving them from a concrete theory's proof predicate is out of reach at this size.
- A universal function written as a partial recursive definition, so that its index can be shown.
