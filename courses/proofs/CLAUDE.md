# Project notes for Claude

Interactive course "Proofcraft: learning to prove, one great theorem at a time". Plan, decisions and
progress: docs/PLAN.md. Read it first. Lives in `courses/proofs/` of the Interactive Courses monorepo.

- Single npm package: SvelteKit 2 + Svelte 5 static site. Output in `dist/`. Base path: BASE_PATH, or
  COURSES_BASE_PATH + /proofs when built from the monorepo root.
- Chapters: `content/chapters/<nn>-<slug>/index.md` + `widgets/*.svelte`. Navigation: `content/outline.ts`.
  Glossary/timeline/bibliography are YAML in `content/` — add entries as chapters are written.
- Markdown compiler: `tools/markdown/compile.ts` (shared design with language-models). Directives:
  `:::theorem{name who year}` (also lemma/corollary/proposition/conjecture/claim), `:::proof[Title]`,
  `:::bio{name born died place}`, `::::zoom{levels="Idea, Sketch, Proof"}` + `:::level[…]`,
  `::::hints` + `:::hint[…]`, callouts (`:::key`, `:::question`, `:::warning`, `:::challenge`, …),
  `:::history{year title people}`, `::widget-name{props}`.
- Exercises are fenced YAML blocks: `step` (chain checked by the CAS; fields start/target/relation/defs/
  domains/assume/initial/hints/solution), `blanks` (text with [[id]] + blanks map), `parsons`
  (lines/distractors/swappable), `bug` (lines/wrong/why/notes), `prove` (prompt/hints/rubric/solution/tutor),
  `quiz`. Quote YAML strings that contain `: ` or start with `$`/`{`; single quotes for LaTeX backslashes.
- CAS: `src/lib/cas` (parser, exact canonical forms, sampling checker, TeX printer, derivatives).
  Logic: `src/lib/logic/prop.ts`. Number theory: `src/lib/nt`. Tests: `npm test`.
- Optional tutor: `src/lib/tutor` (browser-side Anthropic SDK with the learner's own key; claude-opus-5).
- Checks before finishing: `npm test`, `npm run check`, `npm run build`.
- Dev server: `npx vite dev --port 5200` in this directory, run from Bash (the preview launcher cannot
  access ~/Documents). Screenshots: `node ../language-models/scripts/cdp.mjs <url> <steps.json>`.
- British English. Design "Byrne" (after Oliver Byrne's Euclid): tokens in src/app.css (--bg --fg --mute --ac --pn, legacy names aliased; fixed primaries --fx-red/blue/yellow, widget primaries --byrne-*). Fonts (fontsource): Archivo 900 display, DM Sans UI, Newsreader prose, JetBrains Mono labels. Code themes: tools/markdown/render.ts.
