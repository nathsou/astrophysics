# Euclid’s Elements: an interactive edition

All thirteen books of the Elements in Thomas Heath’s translation (1908, public domain), reproduced word for word. Every item also has a modern version, and every proposition has a live figure.

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # figures in random configurations, modern texts, workshop levels
npm run typecheck
npm run build          # conversion check + type check + production build into dist/
npm run convert        # regenerate src/text/data/ from upstream/
```

## What is in it

- **The text.** All 13 books: 131 definitions, 5 postulates, 5 common notions and 465 propositions, with Heath’s notes on the translation.
- **Modern versions.** Written for this edition, for readers with a programming background. Each gives the statement in current notation and a faithful account of Euclid’s argument. Callouts cover gaps in rigour (and how Hilbert and others repaired them), a programmer’s view, and where the result leads.
- **Figures.** Each proposition’s figure is a small program that builds the construction from the given data. Drag the points, move the sliders, or turn a solid. The figure is linked to Heath’s text:
  - hovering a label highlights the object, and hovering an object highlights its label;
  - the play button (or ← →, or a click on a paragraph or a bar of the step track) builds the figure paragraph by paragraph;
  - **Byrne colours** (on by default) colour the objects the text mentions and replace the letters with small drawings, as in Oliver Byrne’s 1847 edition; switch them off to see the lettered figure.
- **The workshop** (`#/workshop`). Compass-and-straightedge puzzles from I.1 to VI.13. You start with Postulates 1–3, and each construction you solve unlocks a tool for later levels. A solution passes only if it still works after the givens are moved at random, and the construction is also shown as a program.
- **The dependency graph** (`#/graph`). Every citation Heath prints: what a proposition rests on, what rests on it, longest chains, and everything that depends on the parallel postulate.
- **Explorations** (`#/explore`):
  - three geometries (Euclidean, hyperbolic, spherical);
  - Euclid’s algorithm on lengths (anthyphairesis);
  - Eudoxus’ ratios;
  - Euclid’s algorithm on numbers;
  - exhaustion;
  - why there are only five regular solids.
- **Glossary** of Heath’s terms.
- **Navigation.** A top bar with a search field that opens a command palette (⌘K or Ctrl+K): type “I.47” to jump, or words to search the enunciations.

## Architecture

```
upstream/heath/          pinned Perseus TEI of Heath's translation (+ UPSTREAM.json: source, licence, scans)
errata/                  corrections to the encoding, applied before conversion (each must match exactly once)
scripts/convert.ts       TEI → src/text/data/book-NN.json and index.json (committed; --check in the build)
scripts/modern-meta.ts   Vite plugin: titles of the modern versions (virtual:modern-meta)
src/text/                types and loaders for the converted text
src/geometry/            the figure engine
  vec.ts                 vectors, the constructions of the postulates, intersections in a stable order
  figure.ts              the builder API figures use (free points, gliders, sliders, elements, claims)
  resolve.ts             Heath's labels → figure objects ("the angle ABC", "the circle BCD", "the parallelogram BL")
  reveal.ts              step-through reveal and Byrne colours
  FigureView.tsx         SVG view: dragging, highlighting, stepping, Byrne mode, 3D projection
  jitter.ts              random configurations (tests)
src/figures/bBB/pNN.ts   one figure per proposition
content/modern/B/*.md    one modern version per item (N.md, def.N.md, post.N.md, cn.N.md, intro.md)
src/widgets/**/*.widget.tsx   widgets embeddable in the modern texts with ::name{…}
src/workshop/            the workshop: construction engine, levels, checker, UI
src/graph/deps.ts        the dependency graph
tests/                   vitest: every figure, every modern text, every workshop level
```

`AUTHORING.md` describes how to write a figure and a modern version.

## What the tests check

- **Figures.**
  - Every label of Heath’s text resolves to an object of the figure, or is listed as unresolved with a reason.
  - Every claim (the proposition’s conclusion, stated numerically) holds in the default configuration and in 50 random ones.
  - These are numerical checks of the figures, not proofs.
- **Modern texts.**
  - Front matter is present, and KaTeX parses.
  - Every citation refers to a real item, every label exists in the figure, and every widget is registered.
- **Workshop.**
  - Euclid’s own solution to each level passes the checker.
  - Each solution uses only tools unlocked earlier.
  - A point placed by eye fails.

## Sources and licences

- Heath, *The Thirteen Books of Euclid’s Elements* (Cambridge University Press, 1908): public domain.
- TEI encoding: Perseus Digital Library, Tufts University, CC BY-SA 4.0 (see `upstream/UPSTREAM.json`).
- Everything else (modern versions, figures, workshop, explorations) was written for this edition.

## Design

The look follows the “Byrne redrawn” mockups: tokens in `src/styles/base.css` (`--paper`, `--panel`, `--ink`, `--red`, `--blue`, `--yellow`, in light and dark under `html[data-theme]`; older names such as `--accent` are aliases of them), DM Serif Display for display type, Newsreader for reading and DM Sans for the interface. Depth comes from panels with hairline borders rather than shadows, and springy or drawing transitions are wrapped in `prefers-reduced-motion: no-preference`.
