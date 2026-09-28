# Course plan — *Proofcraft: learning to prove, one great theorem at a time*

The living plan for the course: agreed decisions, curriculum, component inventory and progress.
Update it when decisions change or chapters land.

## Decisions (agreed 2026-09-27)

| Topic | Decision | Notes |
|---|---|---|
| Aim | Learn to **find and write proofs on paper**, by rebuilding interesting and historically important proofs | Techniques are learned *through* theorems; each chapter is centred on one theorem (occasionally two or three). |
| Emphasis | Logic, calculus/analysis and number theory get the most chapters | Combinatorics and geometry appear where they give the best examples of a technique. |
| Proof checking | **No proof assistant.** A small in-browser CAS checks *individual steps* | Algebraic identities (exact, over ℚ, with power/factorial rules), counterexample search for (in)equalities, propositional logic (truth tables, equivalence), exact number theory (BigInt). The CIC bridge was dropped. |
| Exercises | Step checks, fill-in-the-blank proofs, Parsons (order the lines), spot the bug, quizzes, and “write the proof” with a model proof and a self-check rubric | Authored as fenced YAML blocks in the chapter Markdown; progress saved in `localStorage`. |
| LLM tutor | Optional, bring-your-own Anthropic API key stored in the browser | Socratic hints and feedback on written proofs. The course works fully without it; every hint ladder is also written by hand. |
| Site | SvelteKit 2 + Svelte 5, `adapter-static`, the Markdown-with-directives compiler from *Language Models from Scratch* | Single npm package (not a pnpm workspace). Output in `dist/`, base path from `BASE_PATH`. |
| Visuals | Svelte + SVG/Canvas, no heavy libraries | Animations with `svelte/motion` and `requestAnimationFrame`; respect `prefers-reduced-motion`. |
| Portraits | No photographs; biography cards use typographic monograms | Avoids licensing questions. |
| Language | British English | |

## Chapter template

The story (who, when, why it mattered) → explore (an interactive experiment) → conjecture → guided
discovery of the proof → the proof, with a *zoom* from idea to full detail → other proofs and famous
failed ones → 💥 spot the bug → exercises → 🏔 challenge → biographies and history → further reading.

Every chapter names its **techniques** (shown as chips); the epilogue gathers them into an atlas.

## Curriculum

| # | Chapter | Centrepiece theorem(s) | Techniques | Signature interactive |
|---|---|---|---|---|
| 0 | What is a proof? | Pythagoras (Euclid I.47, Bhāskara, Garfield) | direct proof, dissection | Draggable dissection proofs; Plimpton 322 |
| **I** | **Logic, the grammar of proof** | | | |
| 1 | Truth and consequence | Every truth table is a formula; NAND is enough (Sheffer, 1913) | truth tables, construction | Truth-table lab; Wason card task; knights and knaves |
| 2 | For all, there exists | Density of ℚ and of the irrationals; the drinker paradox | quantifier games, negation | ∀∃ game against the computer |
| 3 | The irrationality of √2 | √2 ∉ ℚ; √n is irrational unless n is a square | contradiction, parity, descent | Tennenbaum’s shrinking squares |
| 4 | Infinitely many primes | Euclid IX.20 and five other proofs | construction, contradiction | Euclid machine; prime sieve |
| **II** | **Induction** | | | |
| 5 | Climbing the ladder | Sums, Bernoulli’s inequality, trominoes (Golomb, 1954), Hanoi | induction, strengthening | Tromino tiler; Hanoi; the horses paradox |
| 6 | Unique factorisation | Fundamental theorem of arithmetic; Bézout; Euclid’s algorithm | strong induction, well-ordering | Euclid’s rectangle; Hilbert numbers |
| 7 | Fermat’s descent | Pythagorean triples; no right triangle has square area | parametrisation, infinite descent | Rational points on the circle |
| **III** | **Arithmetic’s gems** | | | |
| 8 | Fermat’s little theorem | aᵖ ≡ a (mod p) | counting orbits, bijection | Necklace counter; toy RSA |
| 9 | Sums of two squares | p = x² + y² ⇔ p = 2 or p ≡ 1 (mod 4) (Zagier, 1990) | involutions, parity of fixed points | Windmills |
| 10 | Quadratic reciprocity | Gauss’s golden theorem (Eisenstein’s proof) | lattice-point counting | Eisenstein’s lattice |
| **IV** | **Infinity and self-reference** | | | |
| 11 | Sizes of infinity | ℚ is countable, ℝ is not; Cantor’s theorem | bijection, diagonalisation | Hilbert’s hotel; Calkin–Wilf tree; diagonaliser |
| 12 | The limits of proof | Russell’s paradox, the halting problem, Gödel’s incompleteness (sketch) | self-reference | Gödel numbering; the contrarian machine |
| **V** | **Calculus made rigorous** | | | |
| 13 | The ε–δ revolution | Limits of sums and products; 0.999… = 1 | ε-management | ε–N and ε–δ games |
| 14 | Completeness | Intermediate value theorem (Bolzano, 1817) | bisection, suprema | Bisection hunter; antipodal temperatures |
| 15 | The fundamental theorem of calculus | EVT → Rolle → MVT → FTC | chains of lemmas | Riemann sums; MVT tangent slider |
| 16 | Infinite series | Harmonic divergence (Oresme), Basel (Euler, 1734), Σ1/p diverges | comparison, telescoping | Partial sums; Euler’s sine product |
| 17 | e and π are irrational | Fourier (1815) for e; Niven (1947) for π; Liouville numbers | contradiction via integers in (0, 1) | Niven’s shrinking integrand |
| 18 | Monsters | Weierstrass’s function; Thomae’s function; e^{−1/x²} | counterexamples | Infinite zoom |
| **VI** | **Combinatorial gems** | | | |
| 19 | Pigeonholes | Dirichlet approximation; Erdős–Szekeres; R(3,3) = 6 | pigeonhole | Ramsey game; best approximations |
| 20 | Invariants | Königsberg; the 15-puzzle; MU; Conway’s soldiers | invariants, monovariants | Playable puzzles with invariant tracker |
| 21 | Euler’s formula and five colours | V − E + F = 2; five-colour theorem (Heawood, 1890) | counterexamples (Lakatos), Kempe chains | Rotating polyhedra; Kempe chain swapper |
| 22 | Epilogue: how to find proofs | Pólya’s heuristics; machines and proofs | — | Technique atlas |

Appendices: A. Logic and set notation · B. The step checker (what it can and cannot check) ·
C. Reference (glossary, timeline, bibliography).

## Architecture

```
courses/proofs/
  content/            outline.ts, chapters/<nn>-<slug>/{index.md, widgets/*.svelte}, YAML (glossary, timeline, bibliography, terms)
  src/lib/cas/        expression parser, exact rationals, polynomials, identity checker, calculus helpers, TeX printer
  src/lib/logic/      propositional formulas: parser, truth tables, equivalence, normal forms
  src/lib/nt/         number theory on BigInt: gcd, modular arithmetic, primality, factorisation, continued fractions
  src/lib/components/ content blocks (theorem, proof, bio, zoom, exercises), layout, ui
  src/lib/tutor/      optional LLM tutor (bring your own key)
  tools/markdown/     Markdown → Svelte compiler (shared design with language-models)
```

## Progress

- [x] M0 — site shell, CAS/logic/NT libraries with tests, exercise components
- [x] M1 — Prologue and Part I (chapters 0–4)
- [x] M2 — Parts II and III (chapters 5–10)
- [x] M3 — Parts IV and V (chapters 11–18)
- [x] M4 — Part VI, epilogue, appendices
- [x] M5 — wired into the collection (root build, deploy, `.github/workflows/proofs.yml`, index card)
