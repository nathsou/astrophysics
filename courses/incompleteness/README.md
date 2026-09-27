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

Every section of chapters 2–5 of the book is converted from its LaTeX source and can be read in **Formal** mode. The first vertical slice also has **Intuition** (explanations written for this edition) and **Explore** (workbench) modes:

| Section | Workbench |
|---|---|
| 2.11 Sequences | sequence codes, `len`, `(s)_i`, `append`, concatenation |
| 3.1–3.4 Arithmetization of syntax | formula ⇄ official symbols ⇄ symbol codes ⇄ Gödel number, step-by-step encoding, decoding with a trace; the symbol-code table; numerals and `num(n)` |
| 3.5 Substitution | free/bound occurrences, capture hazards, the book’s substitution vs capture-avoiding, and `hSubst` on Gödel numbers, checked against `#A[t/x]#` |
| 4.1, 4.5–4.7 Representability in Q | a recursive-function builder, evaluation traces, the representing formula built as in the book with every subformula linked to its function node, and **checked** natural-deduction derivations in Q of both representability clauses for the chosen input |
| 5.2 The fixed-point lemma | the diagonal construction for any `B(x)`, keeping formula / Gödel number / numeral apart; `diag(#E#) = #A#` verified by decoding and re-encoding; a **checked** derivation of `A ↔ B(⌜A⌝)` from the two representability hypotheses |
| 5.3 The first incompleteness theorem | a dependency explorer: switch hypotheses (consistency, ω-consistency, axiomatizability, extending Q) off and see which proof steps lose their justification |

The object a section works with persists across modes (and visits), so the same formula can be followed from intuition to workbench to the formal definition where the text uses it: Formal mode attaches computed panels to specific definitions and proofs.

## Provenance

Every piece of content says what it is:

- **Open Logic text** — converted from the upstream LaTeX; each theorem-like block links to its exact source lines at the pinned commit.
- **Added** — written for this edition.
- **Computed** — produced by the engine for the reader’s input. A computed example illustrates, it does not prove.
- **Checked** — every inference verified by the natural deduction checker. A checked derivation is about one sentence, not the general theorem; the course says so wherever one appears.
- **Theorem** — a general result, proved in the text.

The incompleteness dependency explorer is an *authored* analysis of the proofs and is labelled as such.

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
  content/                course plan, shared objects, exercises, section content (MDX) and formal annotations
  formal/                 renderer for the converted text
  ui/                     formula views, inspector, stepper, proof debugger, number views
  workbench/              the workbenches; they only visualise engine results and traces
tests/                    vitest: numbers, syntax, coding, proofs, representability, fixed point, conversion
```

Design rules:

- The engine never depends on the UI. Operations return structured results and traces (substitution steps, decoding stages, evaluation call trees, derivation checks); the UI renders them.
- Formulas are typed trees, never strings of rendered LaTeX. Every node has an id; views mark elements with `data-n` so that hovering one occurrence highlights it — and its binder, and its symbols, codes and prime factors — in every view.
- Huge numbers are exact but symbolic: a Gödel number is a sequence code whose elements may be runs (numerals of huge numbers) or named numbers (such as the code of `D_diag(x, y)`). Equality is structural and sound; digits are computed only on request.
- Derivations are generated for concrete inputs and then *independently* checked; nothing is displayed as checked unless the checker accepted it. Where derivations are not generated (minimization), the course says so.

## The conversion pipeline

The converter follows the book’s driver `ic.tex` as LaTeX would: chapter and section imports, the book’s tags (`\iftag`, `\tagitem`), label qualification (`\olfileid`, `\ollabel`, `\olref`), and numbering per chapter. Macros are read from the upstream `.sty` files, so a notation change upstream flows through. A handful of macros defined with TeX primitives (`\gn`, `\pto`, `\mathbi`, …) are replaced explicitly in `scripts/latex/macros.ts`, each with its reason. Anything else unknown is an error in `src/content/source/report.json`, rendered visibly in the text, and fails `npm run build`.

### Updating from upstream

1. `npm run upstream:sync -- --openlogic <OpenLogic checkout> --ic <incompleteness-computability checkout>`
2. `npm run convert` and review the diff of `src/content/source/` and `report.json`.
3. Annotations attach to blocks by label, or by kind and position within a section (`inc.art.cod:defn:1`); check that they still sit where intended.

## Conventions added by this edition

The book leaves some choices open; this edition fixes them and says so on the About page:

- official symbols of arithmetic: `0 = c₀`, `′ = f¹₀`, `+ = f²₀`, `× = f²₁`, `< = P²₀`;
- variables `v₀, v₁, …` are displayed `x, y, z, u, w, x₀, y₀, …`; constants `c₁, c₂, …` (eigenvariables) as `a, b, …`;
- numerals are single nodes that *are* the terms `0′…′` for equality, substitution and coding.

## Roadmap

Next, reusing this architecture: recursive functions (builder and evaluator are already in the engine), the β-function and representability of primitive recursion, Rosser’s theorem, the second incompleteness theorem and Löb’s theorem, models of arithmetic, and the lambda calculus (capture-avoiding substitution, α-renaming, β-reduction with selectable redexes and strategies).
