# Writing a chapter

This guide is for anyone (person or agent) writing a chapter of *Digital Circuits*. Read `CLAUDE.md`,
`docs/PLAN.md` (the chapter's row in the curriculum, the *Under the hood*, history-card and *Build it for
real* rows for your chapter) and, for Part VI, `docs/HDL.md`. The reference chapter is
`content/chapters/06-shannons-switches/`: match its tone, density and conventions.

## The reader

A software engineer. They are comfortable with code, binary, Boolean logic in `if` statements, and
algebra; they have no electronics background, and they have probably never held a multimeter. They are
impatient with hand-waving and with padding, and delighted by a good mechanism, a surprising number or
a story about how something was really invented.

- Explain *why*, not just *what*. Every rule of thumb gets its reason (why a pull-up, why a flyback
  diode, why setup time).
- Prefer concrete numbers to adjectives: "the electrons drift at about 0.02 mm/s", not "very slowly".
- Algebra and exponentials in the main text. Calculus, differential equations and linear algebra only
  in `:::deeper` boxes and in `:::hood`. Every chapter must read well with those boxes closed.
- Connect to software where it genuinely helps (`:::programmer`), never as a gimmick.
- British English (colour, behaviour, analyse, metre), SI units with a thin space before the unit
  in prose ("4.7 kΩ", "5 V", "20 mA"), en dashes for ranges.

## Shape of a chapter

Front matter:

```yaml
---
number: 6
title: Shannon’s switches
summary: One sentence, shown in the navigation and at the top of the chapter.
duration: About 1 hour
prerequisites: [relays]
---
```

Then, in roughly this order (see the template in PLAN.md):

1. **Hook** (no heading): an everyday question, a surprising fact, or the opening of a history card.
   Get to something the reader can *touch* within the first screen.
2. **Sections** (`##`, 4–7 of them, with `###` subsections as needed). Build the idea from first
   principles. Each section should contain at least one live figure or exercise; text walls of more than
   ~600 words without something to try are too long.
3. **Predict before you show.** Put a `quiz` (or a predict widget) *before* the figure that answers it,
   wherever intuition is usually wrong.
4. **Labs** (`:::lab[Title]`): a short guided experiment on a live circuit: what to do, what to look
   for, and why it happens.
5. **Under the hood** (`:::hood[Title]`): how the simulator or toolchain produces what the reader just
   saw, with a short excerpt of the real code (quote it from `src/lib/...`, don't paraphrase it).
6. **Build / debug** exercises (from M3 on, parts go into the parts bin).
7. **History** (`:::history{year title people}`) cards, placed where the idea appears, not piled at the
   end. Every date and claim cites a source (`:cite[key]` + `content/bibliography.yaml`).
8. **Build it for real** (`:::real{parts="74HC00, 2N3904"}`): optional, low voltage only.
9. **What's next** (`## What's next` or a closing paragraph) leading into the next chapter.

Length: 2,500–5,000 words of prose. One flagship interactive (usually wide), 2–4 smaller figures.

## Directives

| Directive | Use |
|---|---|
| `:::note`, `:::tip`, `:::warning`, `:::key`, `:::question`, `:::challenge` | callouts |
| `:::programmer[Title]` | a programmer's view |
| `:::hood[Title]` | under the hood, with a code excerpt |
| `:::deeper[Title]` | optional maths (collapsed) |
| `:::lab[Title]` | a guided experiment |
| `:::real{parts="…"}` | build it for real |
| `:::history{year=1937 title="…" people="…"}` | a history flip card: first paragraph is the front's hook |
| `:::bio{name="…" born=1916 died=2001}` | a short biography |
| `:::details[Summary]` | collapsible |
| `:::figure{caption="…"}` | a static figure with a caption |
| `:::equation{#id caption="…"}` + a ` ```terms ` block | a display equation with hoverable symbols |
| `::circuit{src="06-shannons-switches/circuits/staircase.json" title="…"}` | a live circuit (see below) |
| `::widget-name{props}` | a chapter widget, `./widgets/WidgetName.svelte` |
| `:sidenote[…]`, `:cite[key]`, `:term[word]{id=…}` | inline |
| ` ```quiz `, ` ```parsons `, ` ```bug ` | exercises (YAML) |

## Live circuits

*(Filled in when the renderer lands: JSON conventions, how to lay out a readable schematic, modes,
speed, traces.)*

## Chapter widgets

Write a chapter widget only when `::circuit` can't show the idea (an animated pn junction, a
voltage landscape, a K-map). Widgets:

- live in `content/chapters/<nn>-<slug>/widgets/*.svelte`, Svelte 5 runes, TypeScript;
- are wrapped in `Widget.svelte` (the instrument frame) with a title and a one-line caption telling the
  reader what to try;
- use the design tokens (`var(--sig-high)`, …; `src/lib/theme/signals.ts` for Canvas) — never
  hard-coded colours;
- render something meaningful during prerendering (no blank boxes), guard browser APIs, pause when
  off-screen, respect `prefers-reduced-motion`, work at 360 px wide, and are keyboard-operable;
- put their logic in `.ts` modules with tests.

## Accuracy

Numbers must be right. When a value depends on the part (an LED's forward voltage, a relay's operate
time), say so and give a typical range. When the simulator simplifies (level-1 MOSFETs, behavioural
gates), say so where it matters. History: dates and attributions from reliable sources (primary
sources, museum archives, IEEE/ACM histories, the Computer History Museum); no apocryphal anecdotes
unless labelled as such.

## Checklist before handing in

- [ ] `npm test`, `npm run check`, `npm run build` pass.
- [ ] The chapter reads well with every `:::deeper` and `:::hood` closed.
- [ ] Every live figure has a caption saying what to try; every circuit runs without messages you didn't intend.
- [ ] At least one predict question, one lab, one history card, one exercise.
- [ ] Every citation key exists in `content/bibliography.yaml`; new glossary terms added to `content/glossary.yaml`; timeline events added to `content/timeline.yaml`.
- [ ] Screenshots of the chapter in light and dark themes at 1280 and 390 px checked by eye.
