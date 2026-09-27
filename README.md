# Interactive courses

A collection of interactive textbooks. The [course index](site/index.html) links to:

| Course | Source | Published path |
| --- | --- | --- |
| The Cosmos, Computed | `courses/astrophysics/` | `/astrophysics/` |
| The Calculus of Inductive Constructions | `courses/cic/` | `/cic/` |
| SSA to Silicon | `courses/compiler-backends/` | `/compiler-backends/` |

The language-models course is still in progress and is not part of this repository.

## Build

Node.js 22 or later is required. Each course keeps its own dependencies and lockfile.

```sh
npm ci --prefix courses/astrophysics
npm ci --prefix courses/cic
npm ci --prefix courses/compiler-backends
npm run build
```

The build creates `dist/index.html` and the three course directories in `dist/`. For a local preview, serve `dist/` as the web root, for example with `python3 -m http.server 8000 -d dist`.

On GitHub Actions, the build derives the Pages project path from `GITHUB_REPOSITORY`. If hosting under a different path, set `COURSES_BASE_PATH` to that path (or to an empty string for a domain root). Relative links on the index and the two Vite courses adapt automatically; Astro uses this value for astrophysics links and assets.

Course-specific development and tests are documented in each course's README.
