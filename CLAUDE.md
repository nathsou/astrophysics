# Project notes for Claude

Interactive course "Language Models from Scratch". Plan and agreed decisions: docs/PLAN.md. Read it first.

- Monorepo (pnpm): `course/` (SvelteKit static site), `packages/core` (`@lm/core`), `training/` (uv/Python).
- Chapters: `course/content/chapters/<nn>-<slug>/index.md` + `widgets/*.svelte` + `exercises/<id>/{starter,solution,solution.test,index}.ts`.
  Navigation comes from `course/content/outline.ts`. Bibliography/glossary/global terms are YAML in `course/content/`.
- Markdown compiler: `course/tools/markdown/compile.ts`. Widget directive names are kebab-case of the component name.
- Shared state linking equations ↔ widgets: `$lib/state/params.svelte.ts` (`params`, `focus`).
- Learner code swapped into widgets: `$lib/exercise/impl.svelte.ts` (`impl.get(key, reference)`).
- TypeScript 6 everywhere (TS 7 is native-only with no JS API, which svelte-check and the in-browser
  language service need). Plain `.ts` is checked from the repo root (`tsc -p tsconfig.json`);
  `.svelte`/`.svelte.ts` by svelte-check (course/tsconfig.json includes `content/` explicitly — keep it that way).
- Declare nullable/union state as `$state<T | null>(null)`, not `let x: T | null = $state(null)` (the latter narrows to `never`).
- Checks before finishing: `pnpm test`, `pnpm typecheck`, `pnpm build`, and `cd training && uv run pytest && uv run ruff check`.
- Parity tests: Python writes fixtures to `training/fixtures/`; Vitest compares the TypeScript results.
- British English in all prose. Charts use the palette tokens in course/src/app.css (--series-1…8).
- Dev server: run `npx vite dev --port 5199` in `course/` (the preview launcher cannot access ~/Documents).
  It restarts itself when `tools/markdown/` changes (the preprocessor is loaded once at startup).
- Appendix J is generated from `content/{glossary,timeline,bibliography}.yaml` via the `::all-glossary`,
  `::timeline` and `::all-references` directives — add entries there as chapters are written.
- GPU backend: `@lm/core/gpu` (WGSL kernels, `GpuContext`, `GpuTensor` with autograd). Kernel tests run in Node
  on Dawn via the `webgpu` package (`packages/core/src/gpu/node.ts`, skipped without an adapter). In Node, keep a
  reference to the `GPU` instance (GpuContext does) or it is garbage-collected and the process segfaults.
  Exercise tests that need a GPU use `gpuTest(name, async (gpu) => …)` from `@lm/test`.
- When the browser pane is hidden, screenshots come back blank. `scripts/cdp.mjs` drives headless Chrome
  (with WebGPU) over the DevTools protocol instead: `node scripts/cdp.mjs <url> <steps.json>`.
