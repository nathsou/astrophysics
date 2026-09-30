# Project notes for Claude

Interactive course "Particle Physics: from a cloud chamber to the Higgs boson, by building a mini-LHC".
Plan, decisions and progress: docs/PLAN.md. Authoring guide: docs/AUTHORING.md. Read both first. Lives in
`courses/particle-physics/` of the Interactive Courses monorepo.

- Single npm package: SvelteKit 2 + Svelte 5 (runes) static site, TypeScript 6. Output in `dist/`.
  Base path: BASE_PATH, or COURSES_BASE_PATH + /particle-physics when built from the monorepo root.
- Reader: a software engineer with no particle-physics background, who is **not** assumed to know CERN or its
  software (introduce every experiment, machine and tool on first use). British English. One text for everyone
  (no depth slider); engineering-school maths in the main text.
- Chapters: `content/chapters/<nn>-<slug>/index.md` + `widgets/*.svelte`. Appendices: `content/appendices/<a>-<slug>/index.md`.
  Navigation: `content/outline.ts` (slugs are fixed; do not rename). Glossary, bibliography, terms and timeline are YAML
  in `content/`: **write to your own files** `content/{glossary,bibliography,terms,timeline}.d/<yourname>.yaml`
  (the compiler merges them; never edit the shared `*.yaml` files, several agents work in parallel).
- Markdown compiler: `tools/markdown/compile.ts` (shared design with Digital Circuits). Syntax: docs/AUTHORING.md.
- The reference chapter is `content/chapters/02-relativity-for-particles/index.md`: copy its conventions.

## The library: src/lib/hep

The physics, as importable TypeScript. The reader's exercises import it as `hep` and `hep/<module>` (every directory
`src/lib/hep/<module>/index.ts` is exposed automatically).

- Conventions: natural units, GeV; lengths in mm, times in ns inside the detector model; metric (+,−,−,−); z along the
  beam; φ in (−π, π]; η = −ln tan(θ/2). A four-vector is a plain object `P4 = { E, px, py, pz }`.
- Core (done): `units`, `random` (seeded `rng`, samplers), `kinematics`, `particles` (table with decays),
  `event` (Truth/Detector/Reco/FullEvent, columnar `EventTable`), `hooks`, `data`.
- Stages (under construction): `gen`, `detector`, `reco`, `machine`, `trigger`, `analysis`. Each has a reference
  implementation; the reader's code can replace functions through `hook('stage.function', reference)`
  (src/lib/hep/hooks.ts, src/lib/code/mine.ts).
- **Every random number comes from a seeded `Rng`**; nothing in `hep` calls `Math.random`.
- No DOM, no Svelte and no Node-only APIs in `src/lib/hep` (it runs in workers and under Vitest).

## Working rules (several agents work in parallel)

- Only edit the files and directories your task assigns to you. Shared files (`src/app.css`, `tools/**`,
  `content/outline.ts`, `package.json`, `src/lib/hep/{index,hooks}.ts`, `src/lib/hep/{units,random,kinematics,particles,event}/**`,
  `src/lib/components/**` other than the file you own, `src/lib/widgets/index.ts`) belong to the orchestrator. If one has a real
  bug or lacks something you need, work around it locally and say so in your final report.
- Register widgets in **your own file** `src/lib/widgets/<area>.ts` (exports like
  `export { default as EventDisplay } from '$lib/display/EventDisplay.svelte'`). Widget names must be unique across areas.
- Do not install npm packages unless your task says so. Do not run `git commit`, `git push` or any other git command
  that changes history or the index; the orchestrator commits.
- Every module with logic has Vitest tests next to it (`*.test.ts`). Tests must be deterministic (fixed seeds).
- Run your own tests with `npx vitest run <path>`; the whole suite with `npm test`. `npm run check` (svelte-check) must
  report 0 errors for the files you touched; other agents' in-progress files may produce errors that are not yours.
  Before finishing, `NODE_OPTIONS=--experimental-strip-types npm run build` must succeed if you touched pages or chapters.
- Dev server: `NODE_OPTIONS=--experimental-strip-types npx vite dev --port <yours>` (pick a port from 5230–5299 that is
  not in use). Screenshots: `SHOTS_DIR=<dir> CHROME_FLAGS="--no-sandbox --disable-gpu" CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node ../language-models/scripts/cdp.mjs <url> <steps.json> [w] [h]`
  (steps: see that script's header; `{ "shot": "name", "widget": "figure title" }`). Look at your screenshots.
  Never `rm` through an unquoted shell variable.
- Facts: every number, date and claim must be correct and, where it is a historical or measured fact, cited in your
  bibliography file. If you are not sure of a number, say less, or compute it in a test. Do not invent citations or quotes.
