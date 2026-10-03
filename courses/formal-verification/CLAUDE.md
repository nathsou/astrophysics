# Project notes for Claude

Interactive course *For All Inputs: formal verification from SAT solvers to verified systems*. Plan, decisions
and progress: docs/PLAN.md. The language: docs/VOUCH.md (Vouch, its semantics and its language server). Authoring
guide: docs/AUTHORING.md. Read the plan first, then the document for your area. Lives in
`courses/formal-verification/` of the Interactive Courses monorepo.

- Single npm package: SvelteKit 2 + Svelte 5 (runes) static site, TypeScript 6. Output in `dist/`.
  Base path: BASE_PATH, or COURSES_BASE_PATH + /formal-verification when built from the monorepo root.
- Reader: a software engineer with no formal-methods or logic background. British English. Logic is taught as
  needed (appendix A is the primer). One text for everyone.
- Chapters: `content/chapters/<nn>-<slug>/index.md` + `widgets/*.svelte` (+ `*.vouch` files). Part openers (the
  *How we got here* essays): `content/parts/<n>-<slug>/index.md`. Appendices: `content/appendices/<a>-<slug>/index.md`.
  Navigation: `content/outline.ts` (slugs are fixed; do not rename).
- Data: glossary, bibliography, terms, timeline, lineage (tool family tree), museum (bug exhibits) and bios are
  YAML in `content/`. **Write to your own files** `content/<kind>.d/<yourname>.yaml`; the compiler merges them.
  Never edit the shared `content/<kind>.yaml` files (several agents work in parallel).
- Markdown compiler: `tools/markdown/compile.ts` (shared design with Particle Physics). Syntax: docs/AUTHORING.md.

## The toolchain: src/lib/fv

Pure TypeScript, no DOM, no Svelte, no Node-only APIs (it runs in Web Workers and under Vitest). Every module has
Vitest tests next to it (`*.test.ts`), deterministic (seeded `rng` from `src/lib/fv/util/random.ts`; nothing calls
`Math.random`).

- `logic/`: sorts, terms, formulas, printer, evaluator (**trusted**).
- `sat/`: CDCL solver with a step trace, DIMACS, DRAT output; `sat/check/` RUP/DRAT checker (**trusted**).
- `smt/`: DPLL(T) over `sat/`; theories `euf`, `lra`, `lia`, `nla`, `bv`, `arrays`, `quant`; certificates; `smt/check/` (**trusted**).
- `bdd/`, `explore/`, `ltl/`, `bmc/`, `ic3/` (with k-induction), `param/`, `symex/`, `heap/`, `absint/`, `relational/`: engines.
- `vouch/`: lexer, parser, type checker, interpreter (reference semantics, run-time contracts), VC generator,
  process → action compiler, encoders to SAT/SMT, and `vouch/lsp/` (the language server).
- `engines.ts`: the common `Engine` interface → `Verdict { badge, certificate, assumptions, stats, trace? }`.
- Every answer carries a certificate checked by a trusted checker; every counterexample is replayed by the
  interpreter before it is shown. Keep the trusted directories small and free of clever code.

## Working rules (the course is built by several agents in parallel)

- Only edit the files and directories your task assigns to you. Shared files (`src/app.css`, `src/lib/theme/**`,
  `tools/**`, `content/outline.ts`, `package.json`, `src/lib/fv/engines.ts`, `src/lib/fv/logic/**`,
  `src/lib/components/**` other than files you own, `src/lib/widgets/index.ts`) belong to their owner named in
  your task. If one has a real bug or lacks something you need, work around it locally and say so in your
  final report.
- Register widgets in **your own file** `src/lib/widgets/<area>.ts`. Widget names must be unique across areas.
- Do not install npm packages unless your task says so. Do not run `git commit`, `git push` or any other git
  command that changes history or the index; the orchestrator commits.
- Run your own tests with `npx vitest run <path>`; the whole suite with `npm test`. `npm run check`
  (svelte-check) must report 0 errors for the files you touched. Before finishing,
  `NODE_OPTIONS=--experimental-strip-types npm run build` must succeed if you touched pages, chapters or widgets.
- Dev server: `NODE_OPTIONS=--experimental-strip-types npx vite dev --port <yours>` (pick a free port in
  5300–5399). Screenshots: Playwright with `executablePath: '/opt/pw-browsers/chromium'` (or
  `../language-models/scripts/cdp.mjs`, see its header). Look at your screenshots, in both themes and at 360 px.
- Facts: every date, attribution, number and quotation must be correct and cited in your bibliography file.
  If you are not sure, say less. Never invent citations or quotations. Re-enactments of real bugs say what they
  simplify.
- Never `rm` through an unquoted shell variable.
