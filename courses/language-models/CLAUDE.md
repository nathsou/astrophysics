# Project notes for Claude

Interactive course "Language Models from Scratch". Plan and agreed decisions: docs/PLAN.md. Read it first.

It lives in `courses/language-models/` of the Interactive Courses monorepo (github.com/nathsou/courses). The root
`scripts/build.mjs` builds every course into `dist/` (this one with `BASE_PATH=<base>/language-models`); deployment is
the root `.github/workflows/deploy.yml`, and `.github/workflows/language-models.yml` runs this course's checks. The
theme preference is the `theme` localStorage key shared by all courses (`light` / `dark` / `system`).

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
  CI has no PyTorch: tests that need it must skip without it (`pytest.importorskip("torch")`); check with
  `uv run python -c "import sys; sys.modules['torch']=None; import pytest; sys.exit(pytest.main(['-q']))"`.
- Commit to a branch and open a PR (`gh pr create -R nathsou/courses`); do not push to main.
- Parity tests: Python writes fixtures to `training/fixtures/`; Vitest compares the TypeScript results.
- British English in all prose. Charts use the palette tokens in course/src/app.css (--series-1…8).
- Dev server: run `npx vite dev --port 5199` in `course/` (the preview launcher cannot access ~/Documents).
  In dev, the Markdown compiler is loaded through Vite's module graph (`useDevServer` in
  `tools/markdown/preprocess.ts`), so edits to `tools/markdown/` apply live. Changes to `preprocess.ts` itself or
  to `svelte.config.js` need a full dev-server restart (Node caches them for the life of the process).
- Appendix J is generated from `content/{glossary,timeline,bibliography}.yaml` via the `::all-glossary`,
  `::timeline` and `::all-references` directives — add entries there as chapters are written.
- GPU backend: `@lm/core/gpu` (WGSL kernels, `GpuContext`, `GpuTensor` with autograd). Kernel tests run in Node
  on Dawn via the `webgpu` package (`packages/core/src/gpu/node.ts`, skipped without an adapter). In Node, keep a
  reference to the `GPU` instance (GpuContext does) or it is garbage-collected and the process segfaults.
  Exercise tests that need a GPU use `gpuTest(name, async (gpu) => …)` from `@lm/test`.
- When the browser pane is hidden, screenshots come back blank. `scripts/cdp.mjs` drives headless Chrome
  (with WebGPU) over the DevTools protocol instead: `node scripts/cdp.mjs <url> <steps.json>`.
- CourseGPT weights (`course/static/weights/{coursegpt,coursegpt-draft}.safetensors`, git-ignored) are fetched at build
  time by `scripts/weights.mjs` from the release listed in `course/content/weights.json`. To make them locally:
  `uv run lmc train --preset coursegpt --export` and copy `training/runs/coursegpt/model.safetensors` there.
  Browser code loads them through `$lib/models/coursegpt.ts`.
- Measured data in chapters: `uv run lmc chNN <measurement>` writes `training/runs/chNN/*.json`, and
  `uv run lmc chNN summary` gathers it into `course/content/chapters/<nn>-<slug>/data.json` (imported by `data.ts`).
- On Linux, headless Chromium only finds the NVIDIA WebGPU adapter with `--use-angle=vulkan --ignore-gpu-blocklist`
  (added by `scripts/cdp.mjs`); `CHROME_FLAGS` adds more.
