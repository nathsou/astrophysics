# Authoring guide

Every proposition of the Elements gets two things written for this edition:

1. **a figure**: `src/figures/b<BB>/p<NN>.ts`, a small program that builds the construction live, for example `src/figures/b01/p47.ts`;
2. **a modern version**: `content/modern/<B>/<N>.md`, for example `content/modern/1/47.md`.

Definitions, postulates and common notions get a modern version only: `content/modern/1/def.15.md`, `content/modern/1/post.5.md`, `content/modern/1/cn.1.md`. Book X's three groups of definitions use `def1.3.md`, `def2.1.md` and `def3.4.md`. Each book also has an introduction, `content/modern/<B>/intro.md`, which needs no title.

Heath's text is converted automatically and is never edited by hand. The exemplars are I.1 and I.47 (a figure plus a modern version each), VII.2 (numbers as rods) and XI.3 (a solid figure).

## Checking your work

```sh
cd courses/elements
BOOK=3 npx vitest run          # figures and modern versions of Book III
npx tsc --noEmit -p .          # type check
```

- **Figures test.** Every label in Heath's text must resolve to an object of the figure (or be listed in `unresolved` with a reason). Every claim must hold in the default configuration and in 50 random ones.
- **Modern test.** Each file needs a title, KaTeX must parse, every `[[id]]` must be a real item, every `@X` label must exist in the figure, and every widget must be registered.

To look at a page, use the dev server running at `http://localhost:5199` (it hot-reloads). If it is down, start your own on another port with `npx vite --port 52xx`. Take screenshots with:

```sh
PW=$(npm root -g)/playwright node /tmp/claude-0/-home-user-courses/19936190-2873-5684-99d1-f9b3781b39d9/scratchpad/shot.mjs "http://localhost:5199/#/3.20" /tmp/claude-0/-home-user-courses/19936190-2873-5684-99d1-f9b3781b39d9/scratchpad/<name>.png 1400 1000
```

Then open the PNG with the Read tool. Look at the figure: does it look like Heath's diagram, are the labels legible, is it in proportion? Byrne colours are on by default; to see the lettered figure too, add a fifth argument `"p.click('text=Byrne colours')"`.

## Figures

A figure is `export default figure({ build(g) { … } })`. `build` runs on every drag, so compute everything from the data.

### The data (what the reader can move)

| call | meaning |
|---|---|
| `g.free('A', x, y)` | a draggable point, initially at (x, y) |
| `g.glider('A', circle, t)` | a point dragged along a circle (`t` = angle in radians) |
| `g.glider('A', [P, Q], t)` | a point dragged along the segment PQ (`t` from 0 to 1); `{ line: true }` for the whole line |
| `g.param('n', 5, { min, max, step?, label? })` | a slider (numbers in VII–IX, ratios in V and X, angles and sizes for solids) |

### Computed points and drawing

| call | meaning |
|---|---|
| `g.point('C', v)` | a computed, labelled point; options `{ hidden, labelDir, from }` |
| `g.points({ D: v1, E: v2 })` | several at once |
| `g.segment(A, B, style?)` | a segment; `{ ticks: unit }` draws unit marks (numbers) |
| `g.path(A, B, C, style?)` | the segments AB and BC |
| `g.line(A, B)`, `g.ray(A, B)` | an infinite line, a ray, clipped to the figure |
| `g.circle(c, throughOrRadius, style?)` | returns `{ c, r }` for intersections |
| `g.arc(c, from, to, style?)` | counter-clockwise arc |
| `g.polygon([A, B, C], style?)` | triangles, parallelograms, squares; `{ fill: true }` shades it |
| `g.angle(A, B, C, { right? })` | marks the angle at B |
| `g.curve(pts, { closed? })` | a polyline (conics, spirals) |
| `g.circle3(c, normal, r)`, `g.sphere(c, r)` | circles and spheres in space (`dim: 3`) |
| `g.text(at, 'label')` | free text |

The style options are `{ name, aux, dashed, fill, colour: 'red'|'blue'|'yellow'|'black', from, text }`. `aux: true` draws a thin construction line. `name` is the name the text uses for an object that is not named by its points (see below); it may be an array when the text names one object in several ways.

### Geometry helpers

These are in `src/geometry/vec.ts`: `v, add, sub, mul, dot, cross, len, dist, unit, mid, lerp, rot, rotAbout, perp, polar, angle, deg, rad, area, signedArea, side, cc (circle∩circle), lc (line∩circle), ll (line∩line), foot, reflect, along, circumcircle, incircle, squareOn, regular, goldenCut, collinear`.

Intersections come back in a **stable order**. `cc(k1, k2)` returns `[left, right]` of the directed line from the first centre to the second. `lc(A, B, k)` returns its points in the order of the direction A→B. Choose the one that matches Heath's figure. A construction that is impossible in the current configuration throws `Degenerate`; the view then refuses the drag, which is correct behaviour.

### Claims and readouts

`g.equal('AC = BC', dist(A, C), dist(B, C))` states the proposition's conclusion (or a key step) numerically. The figure shows it live with a ✓, and the tests check it in random configurations. Use `g.claim('label', boolean)` for inequalities and incidences, and `g.show('label', value)` for readouts that are not claims (a gcd, an angle sum). Every theorem should have at least one claim, its conclusion. Every construction should claim that the constructed object has the required property.

### How the text finds objects

Heath's labels are matched to the figure automatically, using the word in front of each label:

- `A` is the point A, or an object you gave `name: 'A'` (a number or magnitude drawn as a rod, a named figure).
- `AB` is the segment AB, provided both points exist. It does not have to be drawn: if Heath mentions it, it is highlighted on hover. Draw what Heath's figure draws.
- "the angle `ABC`" is the angle at B (it does not need an `angle` element).
- "the triangle `ABC`" and "the parallelogram `ABCD`" match a polygon element with those vertices (in any order), or fall back to the polygon through the points.
- "the parallelogram `BL`" (named by a diagonal) matches a four-vertex polygon with B and L as opposite vertices. Otherwise give the polygon `name: 'BL'`.
- "the circle `ABC`" is a circle element passing through the named points. Points that do not exist yet are ignored if the others identify the circle. "the circumference `BC`" is the arc through those points.
- Solids: "the pyramid `ABCD`", "the sphere `ABC`" and the like match polygons, spheres and circles by their points; otherwise use `name`.

So **use Heath's letters exactly**, including every point the text names, even if it only names a circle (in I.1, D and E exist only so that "the circle BCD" and "the circle ACE" resolve). Points that exist only to name something can be `hidden: true`: they still resolve, but are neither drawn nor labelled.

Some labels have nothing to draw: a hypothetical object in a reductio that cannot exist, a magnitude from another proposition, a letter the text uses only in passing. List those in `unresolved: { G: 'the supposed greater common measure, which cannot exist' }` with a real reason. Better still, draw the impossible object dashed (see VII.2's G). The test rejects unresolved labels that are not listed.

### The step-through

Clicking a paragraph (or the play button, or a bar of the step track) builds the figure up paragraph by paragraph. An object appears at the first paragraph that mentions it. An unmentioned element appears when all its named points have appeared. Use `from: k` (a paragraph index) to override this when it goes wrong.

### Good figures

- **Follow Heath's figure**: same letters, similar layout, sensible proportions. The default configuration should be generic, not degenerate: no accidental right angles or isosceles triangles unless the hypothesis requires them.
- **Make the hypotheses the data.** For a theorem about any triangle, use three free points. For an isosceles triangle (I.5), make A free, B free, and C the reflection of B in a line through A, or put C on a glider on the circle centred at A through B. That way the hypothesis holds however the reader drags. For "if two circles touch", compute the second circle from the first so they always touch.
- **Constructions are constructions.** Build the object the way Euclid does, with circles and intersections. Do not place the answer directly, at least not for Books I–IV. The reader should be able to drag the givens and watch the construction follow.
- **Choose the jitter.** The test moves free points by 8% of the figure's size. If most random configurations are degenerate (because an intersection vanishes), make the configuration more robust or set `jitter: 0.03`.
- **Reductio proofs** ("for, if possible, let…") argue about impossible configurations. Draw what can be drawn: the given, and the impossible object dashed or with `aux`. List the rest in `unresolved`.
- **Several cases** ("let the angle at A be first acute…"): draw the case Heath draws first, and say in the modern version which configuration changes the case.
- **Numbers (VII–IX)** are rods: segments with `ticks: 1` and integer `param`s. **Magnitudes (V, X)** are segments with real `param`s. A ratio can be shown as two rods.
- **Solids (XI–XIII)** use `dim: 3`. Points have `z`, the reader turns the figure by dragging, and `param`s drive it (free points are not draggable in 3D). Faces are `polygon`s (translucent). Circles in space are `circle3`, spheres are `sphere`. Set a good initial `camera: { yaw, pitch }`.
- Keep figure files self-contained. A book-specific helper can go in `src/figures/b<BB>/lib.ts`. **Do not edit shared files** (`src/geometry/*`, `src/ui/*`, `src/pages/*`, tests). If the engine is missing something, work around it and say so in your final report.

## Modern versions

The reader is a **software engineer**: comfortable with rigour, functions, invariants and types, but who may not have done geometry since school. The modern version sits under Heath's text, so it should **not** paraphrase him sentence by sentence. It should say what is really going on.

### Format

```md
---
title: Short modern name (e.g. "Inscribed angle theorem", "Euclid's algorithm")
---
**Statement.** The proposition in modern terms, with notation: $\angle BAC = 2\angle BDC$ …

**Proof.** A faithful modern version of *Euclid's* argument: the same idea and the same key steps, with modern notation and without the ceremony. Cite with [[1.4]] etc.

:::gap Title (optional)
A real gap in Euclid's argument (betweenness, continuity, superposition, unstated case analysis), and how Hilbert or modern treatments fix it.
:::

:::code Title (optional)
A programmer's view: an algorithm (Euclid's algorithm in code), an invariant, a data structure, a type signature, a test.
:::

:::leads Where it leads (optional)
The connection to later mathematics: the law of cosines, the real numbers, RSA, Euler's formula, non-Euclidean geometry…
:::

:::history Title (optional)
:::
```

- `$…$` and `$$…$$` are KaTeX. `[[1.47]]` cites an item; the ids are `1.47`, `1.def.15`, `1.post.5`, `1.cn.1`, `10.def2.3`. `[[1.47|Pythagoras]]` shows other text.
- `@AB`, `@angle(ABC)`, `@triangle(ABC)`, `@circle(ABC)`, `@figure(BL)` and `@point(A)` are labels linked to the figure (hover highlights, Byrne colours). Use them in prose, not inside math. Only use labels that exist in the figure.
- `::figure{of="1.4"}` on its own line shows another proposition's figure inline. You may write a book-specific interactive widget as `src/widgets/b<BB>/<name>.widget.tsx` (default export: a React component taking string props; wrap it in `Widget` from `src/widgets/shared/Widget.tsx`) and use it as `::name{a="1"}`. Keep widgets for ideas a figure cannot show: a grid, an algorithm trace, a plot.

### Length and tone

- **Scale to importance.** A routine step-lemma needs a statement and a short proof, 80–200 words. A landmark (I.1, I.4, I.5, I.16, I.29, I.32, I.47, II.11, II.14, III.20, III.31, IV.11, V.Def.5, VI.2, VI.31, VII.1–2, VII.30, IX.20, IX.36, X.1, X.2, X.9, XII.2, XIII.18 and so on) deserves the callouts and 300–600 words.
- Say plainly where Euclid's "equal" means congruent and where it means equal in area. Translate "the rectangle AB, BC" as $AB \cdot BC$, "the square on AB" as $AB^2$, and "measures" as "divides". Use ratio notation $a : b = c : d$ in Books V–VI and X, and divisibility notation $a \mid b$ in VII–IX.
- Be accurate. Heath's notes (shown on each page under "Heath's notes on the text") and the text itself are your primary sources. Do not invent history. If you are not sure of a historical claim, leave it out.
- **Write original prose.** Heath's 1908 translation is public domain and is already shown verbatim. The modern versions must be *your own* explanations: do not copy or closely paraphrase modern copyrighted translations or commentaries (David Joyce's online edition, Fitzpatrick's translation, textbooks, Wikipedia).
- Use a plain, direct tone: no filler, no "it is worth noting", no exclamation marks. Prefer short sentences and formulas to long sentences.

### Definitions, postulates, common notions, introductions

- `def.N.md` has a title (the term, e.g. "Point", "Circle", "Same ratio (Eudoxus)"), a modern definition, and a comment where there is one to make (Def. I.1 "that which has no part" is not a usable definition; V Def. 5 needs a long explanation). 30–150 words, except the famous ones.
- `post.N.md` and `cn.N.md` are the same. Postulate 5 and Common Notion 4 ("things which coincide", i.e. superposition) need real discussion.
- `intro.md` introduces the book in 150–400 words: what it is about, how it fits in the Elements, the highlights to look out for, citing them with `[[…]]`. No title in the front matter.

## When you are done

Your book's tests must pass (`BOOK=<n> npx vitest run`) and `npx tsc --noEmit -p .` must be clean. Do not commit: the lead commits. Report which propositions have extra widgets, which labels you left unresolved and why, and anything the engine could not do.
