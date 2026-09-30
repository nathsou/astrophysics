# Interactive courses

A collection of interactive textbooks. The [course index](site/index.html) links to:

| Course | Source | Published path |
| --- | --- | --- |
| The Cosmos, Computed | `courses/astrophysics/` | `/astrophysics/` |
| The Calculus of Inductive Constructions | `courses/cic/` | `/cic/` |
| SSA to Silicon | `courses/compiler-backends/` | `/compiler-backends/` |
| Language Models from Scratch *(in progress)* | `courses/language-models/` | `/language-models/` |
| Incompleteness and Computability *(in progress)* | `courses/incompleteness/` | `/incompleteness/` |
| Euclid’s Elements: an interactive edition | `courses/elements/` | `/elements/` |
| Proofcraft: learning to prove, one great theorem at a time | `courses/proofs/` | `/proofs/` |
| Digital Circuits | `courses/digital-circuits/` | `/digital-circuits/` |

## Build

Node.js 22 or later is required. Each course keeps its own dependencies and lockfile; language-models is a pnpm workspace (its site, its TypeScript library and a Python training lab), so it also needs [pnpm](https://pnpm.io).

```sh
npm ci --prefix courses/astrophysics
npm ci --prefix courses/cic
npm ci --prefix courses/compiler-backends
npm ci --prefix courses/incompleteness
npm ci --prefix courses/elements
npm ci --prefix courses/proofs
npm ci --prefix courses/digital-circuits
pnpm --dir courses/language-models install --frozen-lockfile
npm run build
```

The build creates `dist/index.html` and the eight course directories in `dist/`. For a local preview, serve `dist/` as the web root, for example with `python3 -m http.server 8000 -d dist`.

On GitHub Actions, the build derives the Pages project path from `GITHUB_REPOSITORY`. If hosting under a different path, set `COURSES_BASE_PATH` to that path (or to an empty string for a domain root). Relative links on the index and the two Vite courses adapt automatically; Astro uses this value for astrophysics links and assets, and the build passes `<base>/language-models` and `<base>/proofs` to the two SvelteKit courses as `BASE_PATH`.

Pushes that touch `courses/language-models/` also run its tests, type checks and Python lab checks (`.github/workflows/language-models.yml`); pushes that touch `courses/incompleteness/` run its conversion check, type check and tests (`.github/workflows/incompleteness.yml`).
Pushes that touch `courses/language-models/` also run its tests, type checks and Python lab checks (`.github/workflows/language-models.yml`); pushes that touch `courses/proofs/` run its tests, type checks and build (`.github/workflows/proofs.yml`); pushes that touch `courses/elements/` run its conversion check, type check and tests (`.github/workflows/elements.yml`); pushes that touch `courses/digital-circuits/` run its tests, type check and build (`.github/workflows/digital-circuits.yml`).

To install, build and preview everything locally in one step, run `npm run preview` (serves `dist/` at <http://localhost:8000>). It accepts `--skip-install`, `--skip-build` and `--port <n>`, for example `npm run preview -- --skip-install --port 3000`. If pnpm isn't installed, it runs the version pinned by language-models through `npx`.

Course-specific development and tests are documented in each course's README.
