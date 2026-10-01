# Authoring guide

How to write a chapter, a widget and an exercise. The reference chapter is
`content/chapters/02-relativity-for-particles/index.md`; read it, its widgets and the rendered page first.

## Voice and level

- The reader is a software engineer who knows nothing about particle physics or CERN. Explain in plain, exact prose. Use the
  second person sparingly; British English; no slogans or hype; no rhetorical filler.
- Introduce every named experiment, accelerator and software tool the first time it appears (one clause is enough).
- Algebra and calculus are used freely; every symbol is defined where it first appears. Derivations that would interrupt the flow
  go in `:::deeper[...]`.
- Each chapter is 3,000–6,000 words, with one flagship interactive and 2–4 smaller figures, at least one `predict`, one Fermi
  estimate, one history card, one exercise, and (where the plan says so) a `code` exercise that feeds the pipeline, an
  `:::experiments` box, a `:::programmer` box and a `:::hood` box. End with "What comes next" and "Further reading".
- Facts are checked. Masses, widths and lifetimes come from `hep/particles` (or are computed in a test). Dates and historical claims
  are cited with `:cite[key]` and have a bibliography entry. No invented quotations.

## File layout

```
content/chapters/<nn>-<slug>/index.md        the chapter (front matter: number, title, summary, duration, prerequisites: [slugs])
content/chapters/<nn>-<slug>/widgets/*.svelte   chapter-specific widgets; use as ::kebab-name{…}
content/{glossary,bibliography,terms,timeline}.d/<you>.yaml   your data (merged by the compiler)
src/lib/widgets/<area>.ts                     exports of shared widgets
```

## Markdown directives (see tools/markdown/compile.ts)

- Callouts: `:::note`, `:::tip`, `:::warning`, `:::key[Title]`, `:::question`, `:::challenge`, `:::lab[Title]`, `:::programmer`,
  `:::hood[Title]`, `:::deeper[Title]`, `:::real{parts="…"}`, `:::fermi[Title]` (a worked estimate in prose), `:::experiments[Title]`.
- `:::history{year=1908 title="…" people="…" source="…"}` a flip card (front: teaser, back: story). Cite sources with `:cite[key]`.
- `:::equation{#id caption="…"}` with `$$ … \term{id}{LaTeX} … $$` and a ```` ```terms ```` YAML block (label, what, why, effect)
  defining every `\term`: this is what makes every symbol hoverable.
- `:term[word]{id=glossary-id}` links a glossary term; `:cite[key1,key2]`; `:sidenote[text]`; `:::details[Summary]`; `:::figure{caption}`.
- Widgets: `::widget-name{prop=1 other="x" n="3.2" caption="…"}`. A widget is `./widgets/WidgetName.svelte` in the chapter, or an
  export of `src/lib/widgets/*.ts`. Wrap figures in `$lib/components/ui/Widget.svelte` (title, n, caption, controls, kind).
- Cross-links: `[Chapter 13](/chapters/quarks/)`, `[text](/appendix/units/)`. Links to the astrophysics course: `[...](/astrophysics/ch/fusion/)`.
- Fenced YAML exercises: `quiz`, `predict` (same shape as quiz; shown as "Predict, then reveal"), `numeric`, `fermi`, `parsons`, `code`,
  `reaction`, `diagram`, `scan`, `identify`, `cuts`, `trigger`, `lattice`, `fit`. Every exercise has a unique `id`. `numeric`/`fermi`:
  `answer`, `unit`, `tolerance` or `factor`, `explain`. `code`: `id, title, prompt, starter, tests, solution, hook?, hints?`
  (tests use `@pp/test` (`test`, `expect`, `describe`), import the reader's code from `'solution'` and the library from `'hep'`/`'hep/<module>'`;
  `tools/markdown/exercises.test.ts` checks that the solution passes and the starter fails).
- Math: `$…$` inline, `$$…$$` display (KaTeX). Code: ```` ```ts ````.

## Widgets

- Svelte 5 runes. Use `$lib/components/ui/{Widget,Slider,Toggle,Segmented,Button}.svelte`, `$lib/charts/{Plot,HepHist}.svelte`, colours from CSS
  variables (`--p-electron`, `--p-photon`, `--p-muon`, `--p-hadron`, `--p-jet`, `--p-neutrino`, `--p-boson`, `--p-higgs`, `--track`, `--series-1…8`, `--ok`, `--bad`, …)
  so both themes work. A screen that is always dark uses the `.screen` class. Never rely on colour alone.
- Every widget works with the keyboard, exposes live values to screen readers (aria-live or labels), respects `prefers-reduced-motion`, and is usable at 360 px width.
- Do not mutate `$state` inside `$derived`. Heavy work (generation, simulation) goes in a Web Worker or is chunked; never block a frame for long.
- Everything random is seeded; show the seed if the reader can re-roll.
- Text in widgets is British English and does not use the `.ui` class's uppercase on symbols (use `text-transform: none` for table headers containing Greek letters).

## Data files

`glossary.d/<you>.yaml`: `id: { term, definition, chapter }`. `bibliography.d/<you>.yaml`: `key: { authors, year, title, venue, url, note }`.
`timeline.d/<you>.yaml`: list of `{ year, title, people, chapter, text }`. `terms.d/<you>.yaml`: shared equation-term docs (rarely needed).

## YAML pitfalls

All the data files and exercise blocks are YAML. A value that contains `: ` (colon and space), starts with a quote, `[`, `{`, `*`, `&`, `!`, `|`, `>` or `%`, or contains ` #`, **must be quoted** (single quotes; double a literal `'` as `''`), or written as a block scalar (`|` or `>`). An unquoted colon is the most common cause of the build error "Nested mappings are not allowed in compact mappings". Run `NODE_OPTIONS=--experimental-strip-types npm run build` to find them: the error names the file and the YAML line.
