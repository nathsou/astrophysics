# Language Models from Scratch

Part of the [Interactive Courses](../../README.md) collection, published at `/language-models/`. The collection's `npm run build` (in the repository root) builds this course with the right base path; for development, work in this directory as below.

An interactive course that builds a GPT-style language model from nothing — text encoding, tokenisation,
tensors, autograd, WebGPU kernels, attention, training, sampling and inference — and then covers scaling
laws, mixture-of-experts, fine-tuning, preference learning, reasoning, tool use, evaluation,
interpretability and safety.

Each chapter combines prose with interactive equations (hover any symbol), live WebGPU visualisations,
in-browser TypeScript exercises that can replace the chapter's reference code, and labs in the repository.

See [`docs/PLAN.md`](docs/PLAN.md) for the curriculum, decisions and milestones.

## Layout

| Path | What |
|---|---|
| `course/` | The site: SvelteKit 2 + Svelte 5, Vite 8, static build for GitHub Pages |
| `course/content/chapters/<nn>-<slug>/` | A chapter: `index.md`, its `widgets/` and `exercises/` |
| `course/tools/markdown/` | Markdown → Svelte compiler (directives, KaTeX, Shiki, hoverable terms) |
| `course/src/lib/` | Shared components, charts, GPU renderers, exercise runner |
| `packages/core/` | `@lm/core`, the language-model library built chapter by chapter |
| `training/` | Python companion (uv): parity checks now, PyTorch training from Chapter 14 |

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:5173 (or: pnpm dev --port 5199)
pnpm test           # unit tests, exercise reference solutions, TS ↔ Python parity
pnpm typecheck      # tsc for .ts, svelte-check for .svelte
pnpm build          # static site in course/build
```

```bash
cd training
uv sync             # add --extra torch from Chapter 14 (CUDA on Linux, MPS on macOS)
uv run lmc ch01
uv run pytest
```

## Writing content

Chapters are Markdown with a few directives:

````md
:::equation{#zipf caption="Zipf's law"}
$$ f(r) = \frac{\term{C}{C}}{r^{\term{s}{s}}} $$
:::

```terms
s:
  label: "$s$ — Zipf exponent"
  what: How steeply frequency falls with rank.
  param: { key: zipf.s, min: 0.3, max: 2, step: 0.01, value: 1 }
```

::zipf-plot                     <!-- ./widgets/ZipfPlot.svelte -->
::exercise{id="fit-power-law"}  <!-- ./exercises/fit-power-law/ -->
:::history{year=1935 title="…"} … :::
Inline: :sidenote[…]  :cite[shannon1948]  :term[entropy]
````

`\term{id}{…}` makes a symbol hoverable. A `param` binds it to a shared slider, which widgets read with
`params.get('zipf.s', 1)`. Exercise tests import from `@lm/test`; in the browser that is a small harness, and
under Vitest it is Vitest itself, so every reference solution is tested in CI.
