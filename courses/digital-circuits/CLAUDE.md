# Project notes for Claude

Interactive course "Digital Circuits: from a battery and a switch to a CPU on a chip". Plan, decisions and
progress: docs/PLAN.md; the hardware language DCL: docs/HDL.md. Read both first. Lives in
`courses/digital-circuits/` of the Interactive Courses monorepo.

- Single npm package: SvelteKit 2 + Svelte 5 (runes) static site, TypeScript 6. Output in `dist/`.
  Base path: BASE_PATH, or COURSES_BASE_PATH + /digital-circuits when built from the monorepo root.
- Reader: software engineers with no electronics background. British English. Algebra in the main text,
  calculus only in optional boxes.
- Chapters: `content/chapters/<nn>-<slug>/index.md` + `widgets/*.svelte` + `circuits/*.json`.
  Navigation: `content/outline.ts` (slugs are fixed; do not rename). Glossary, timeline, bibliography and
  hoverable terms are YAML in `content/`.
- Markdown compiler: `tools/markdown/compile.ts` (shared design with Proofcraft and Language Models).
  Directives: callouts (`:::note`, `:::tip`, `:::warning`, `:::key`, `:::question`, `:::lab`,
  `:::challenge`, …), `:::history{year title people}`, `:::bio{name born died}`, `:::details[…]`,
  `:::figure{caption}`, `::::hints` + `:::hint[…]`, `:::equation` with a ```terms block,
  `::widget-name{props}` (resolved to `./widgets/WidgetName.svelte` or an export of `src/lib/widgets/index.ts`),
  `:sidenote[…]`, `:cite[key]`, `:term[word]{id=…}`. Exercises are fenced YAML blocks (`quiz`, `parsons`, `bug`, `build`, `debug`, `golf`, `measure`, `asm`, `hdl`, `fit`, `decode`, `route`, `place`; see docs/AUTHORING.md).

## The simulator (src/lib/sim)

- `netlist/types.ts`: the circuit model. A **Circuit** (what is drawn: placed components + wires on a
  grid, subcircuits) and a **FlatNetlist** (what engines simulate: elements with pins on numbered nets).
  `netlist/connect.ts` resolves wires to nets; `netlist/flatten.ts` expands subcircuits. The top level of a
  flattened circuit keeps `connect()`'s net numbers, so renderers can colour wires from engine values.
- `netlist/catalog/*.ts`: every component type's pins, bounds and parameters (data only). Behaviour is in
  the engines (`analog/`, `switch/`, `digital/`), keyed by `type`; drawings in `src/lib/bench/symbols`.
- `engine.ts`: the `Engine` interface every engine implements. SI units everywhere (seconds, volts,
  amperes); gate delay parameters are in nanoseconds.
- Geometry: grid units (GRID_PX pixels each). Two-terminal parts have pins at (0, 0) and (4, 0); gates
  have inputs every 2 units on x = 0. Rotation is clockwise, applied after the left–right flip.

## Working rules (several agents work in parallel)

- Only edit the files and directories your task assigns to you. Shared files (`src/lib/sim/netlist/**`,
  `src/lib/sim/engine.ts`, `src/app.css`, `tools/**`, `content/outline.ts`, `package.json`) belong to their
  owner in the task description; if one has a real bug or lacks something you need, work around it locally
  and say so in your final report.
- Do not install npm packages unless your task says so. Do not run `git commit`, `git push` or any other
  git command that changes history; the orchestrator commits.
- Every module with logic has vitest tests next to it (`*.test.ts`). Tests must be deterministic.
- Before finishing: `npm test`, `npm run check` (svelte-check, 0 errors) and, if you touched pages or
  components, `npm run build`.
- Dev server: `npx vite dev --port 5210`. Screenshots: `CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node ../language-models/scripts/cdp.mjs <url> <steps.json>`
  (Chromium is preinstalled; see that script's header for the steps format), or Playwright with
  `executablePath: '/opt/pw-browsers/chromium'` if present.
