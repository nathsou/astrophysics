# Proofcraft

*Learning to prove, one great theorem at a time.* An interactive course in 23 chapters: each one is built
around a theorem worth knowing — Euclid's primes, the irrationality of √2, Fermat's little theorem, Zagier's
one-sentence proof of the two-squares theorem, quadratic reciprocity, Cantor's diagonal, Gödel and Turing,
the ε–δ foundations of calculus, the irrationality of e and π, the five-colour theorem — and the proof
techniques it teaches. Chapters mix history and biographies, interactive figures and games, and exercises
checked in the browser.

- **Step checker.** A small computer algebra system (exact rationals, canonical rational functions, symbolic
  powers, roots, factorials, sums) proves algebraic steps, tests the rest on sampled values, and returns
  counterexamples. Appendix B explains exactly what it does and does not check.
- **Exercises.** Chains of (in)equalities, fill-in-the-blanks, Parsons problems (put the proof in order),
  spot-the-bug, multiple choice and written proofs with a self-assessment rubric.
- **Optional tutor.** Written proofs can be sent to Claude for Socratic feedback, with your own API key stored
  in this browser. Without a key, everything runs locally.

## Develop

```bash
npm ci
npm run dev
```

`npm test` runs the CAS, logic, number-theory and content-compilation tests, `npm run check` runs
svelte-check, and `npm run build` writes the static site to `dist/` (set `BASE_PATH` to serve it under a
sub-path). Chapters live in `content/chapters/<nn>-<slug>/index.md` with their widgets beside them; see
`CLAUDE.md` for the Markdown directives and exercise formats, and `docs/PLAN.md` for the curriculum.
