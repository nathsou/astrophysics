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
| `::::run-original{title="<card title>"}` | wraps the live figure that a history card with `run="Run the original"` opens (shared widget) |
| `:::bio{name="…" born=1916 died=2001}` | a short biography |
| `:::details[Summary]` | collapsible |
| `:::figure{caption="…"}` | a static figure with a caption |
| `:::equation{#id caption="…"}` + a ` ```terms ` block | a display equation with hoverable symbols |
| `::circuit{src="06-shannons-switches/circuits/staircase.json" title="…"}` | a live circuit (see below) |
| `::widget-name{props}` | a chapter widget, `./widgets/WidgetName.svelte` |
| `:sidenote[…]`, `:cite[key]`, `:term[word]{id=…}` | inline |
| ` ```quiz `, ` ```parsons `, ` ```bug ` | exercises (YAML) |

## Live circuits

A live circuit is a schematic that runs. The reader can flip its switches, hold its buttons, hover any wire or
part for numbers, and (for analogue circuits) watch the current move. You write it as a JSON file and place it
in the text with one line:

```markdown
::circuit{src="06-shannons-switches/circuits/staircase.json" title="Two-way switching" caption="Flip either switch. Which positions light the lamp?"}
```

`src` is relative to `content/chapters/`, so a chapter's own circuits live in
`content/chapters/<nn>-<slug>/circuits/<name>.json` and are referenced as `<nn>-<slug>/circuits/<name>.json`.
Every `::circuit` needs a `title` and a caption that says what to try (see the checklist). Attributes:

| Attribute | Meaning | Default |
|---|---|---|
| `src` | the circuit file, as above | required |
| `title`, `subtitle`, `caption` | the frame's title, a line under it, the caption below | title of the JSON |
| `n` | figure number shown in the frame, e.g. `n="6.2"` | none |
| `mode` | wire colouring: `logic`, `voltage` or `plain` | `voltage` for analogue circuits, `logic` otherwise |
| `speed` | simulated seconds per real second when the figure opens (the reader can change it) | `1` |
| `current` | `current=true` shows current as moving dots (analogue circuits only) | off |
| `traces` | a timing diagram under the schematic: `traces="A,B,Y"` | none |
| `window` | seconds of simulated time across the timing diagram | `4 × speed` |
| `highlight` | ids or net names to outline, e.g. `highlight="U1,CLK"` | none |
| `toolbar` | `toolbar=false` hides play, step and speed (for a figure that is only a picture that reacts) | shown |

### The JSON

```json
{
  "version": 1,
  "title": "An LED needs a resistor",
  "engine": "analog",
  "components": [
    {"id": "B1", "type": "battery", "x": 4, "y": 10, "rot": 270, "params": {"voltage": 9}},
    {"id": "R1", "type": "resistor", "x": 8, "y": 2, "params": {"resistance": 470}},
    {"id": "D1", "type": "led", "x": 18, "y": 4, "rot": 90, "params": {"color": "red"}},
    {"id": "V1", "type": "voltmeter", "x": 26, "y": 8, "rot": 270},
    {"id": "G1", "type": "ground", "x": 4, "y": 12}
  ],
  "wires": [
    {"points": [[4, 6], [4, 2], [8, 2]]},
    {"points": [[12, 2], [26, 2], [26, 4]]},
    {"points": [[18, 2], [18, 4]]},
    {"points": [[18, 8], [18, 12]]},
    {"points": [[26, 8], [26, 12], [4, 12], [4, 10]]}
  ],
  "notes": [{"x": 8, "y": 0, "text": "current limiter"}]
}
```

- `engine` is `"analog"` (voltages and currents: batteries, resistors, lamps, relays, transistors, meters),
  `"digital"` (gates, flip-flops, blocks and the logic switches, buttons and indicators; delays in nanoseconds) or
  `"switch"` (transistors as switches, for the CMOS chapters). It also chooses the default colouring.
- A **component** has an `id` (unique, shown as its label), a catalog `type`, a grid position `x`, `y` (where its
  first pin is), an optional `rot` (0, 90, 180, 270, clockwise), `flip` (mirror left to right, applied before
  rotating), `params` (only what differs from the catalog default) and `label`. A `label` replaces the default text
  (id and main value); `"label": ""` hides it. Look up types, pins and parameters in `src/lib/sim/netlist/catalog/`
  or in the symbol sheet at `/bench-gallery/`.
- A **wire** is a list of grid points; consecutive points must share an `x` or a `y`. Wires connect to every pin or
  wire end that touches one of their points, and to pins or wire ends that lie *on* a segment (a T-junction; the
  renderer draws the dot). Wires that merely cross do **not** connect. Two ground symbols are the same net, as are
  two rails of the same voltage and two `label` components with the same `name`, so you never need a wire for them.
- **notes** are italic annotations (`\n` starts a new line). They are for the reader, not electrical.
- Pins must land exactly on wire points. An open circle on a pin means nothing is connected there, which is
  usually a typo of one grid unit.

### Laying out a readable schematic

One grid unit is 12 px on the page, scaled by 1.5. Two-terminal parts are 4 units long; gates are 6 units wide.

1. **Flow left to right, high to low.** Put supplies on the left and the load on the right; put the positive rail at
   the top and ground at the bottom. Inputs of a logic diagram are on the left, outputs on the right.
2. **Draw a battery upright** with `"rot": 270`: the `+` plate is then on top (at `y − 4`) and `−` at `y`.
   `"rot": 90` puts `+` at the bottom. Lamps, LEDs and diodes drawn upright with `"rot": 90` have their arrow (anode
   to cathode) pointing down.
3. **Rectangles, not diagonals.** Route every wire with as few corners as you can (two or three). Corners are
   rounded on screen; a wire never needs more than one jog between two parts.
4. **Space parts about 2–4 units apart** so labels have room; the renderer puts each label beside its part where
   nothing else is, but it cannot make room. Leave a 2-unit margin around the whole circuit; the frame crops to what
   is drawn.
5. **Use ground symbols, not a return wire, wherever a chapter talks about voltage.** A circuit without a ground
   still runs (voltages are measured from the − of the first source and the figure says so), but readers learn that
   "voltage" needs a reference by seeing one. For a loop that is the point of the figure (current in a series
   circuit), draw the return wire.
6. **Junction dots only where they belong.** Do not end three wires at one point unless they are one net; break a
   long wire into two with a `label` (`"params": {"name": "CLK"}`) rather than routing across the diagram.
7. **Line things up.** Put parts of the same role on the same `y`, and give pins that must connect the same `x` or
   `y` so one straight wire does it. For gates, remember the inputs are 2 units apart, so a fan-out from a
   logic switch needs a short vertical run at `x = gate.x − 2` or so.
8. **Keep it small.** Above about 30 parts, use a subcircuit (`"type": "sub:name"`, defined under `subcircuits`) or
   split the figure in two. Small figures read better on a phone; the schematic scales down to fit the column.
9. **Make interactive parts obvious**: a `toggle`, `button`, `switch`, `spdt` or `pushbutton` is clickable (and
   focusable with Tab; Space or Enter flips it, and holds a button while pressed). Say in the caption which ones.

### Modes

- `logic` colours each wire by its logic value in the same way in every figure: HIGH amber, thicker and glowing;
  LOW slate; Z (nothing drives it) dashed grey; X (unknown, or a fight between drivers) red and hatched, and it
  flickers unless the reader asked for reduced motion. Colour is never the only cue.
- `voltage` colours wires on a scale from grey (0 V) to red-orange (the largest source in the circuit), with blue
  below zero, and shows a legend. Use it when the *amounts* matter (dividers, RC circuits).
- `plain` draws ink only. Use it for a figure where the reader should read the topology first.

For analogue circuits the widget offers a Volts / Logic / Ink switch and a Current switch; `current=true` turns the
dots on from the start. Dots follow conventional current (from + round to −); their speed rises with the current on a
logarithmic scale, so a microamp and an amp are both visible. With reduced motion they become fixed arrows.

### Speed

`speed` is *simulated seconds per real second*. Pick it so the interesting event takes a few real seconds:

| Circuit | `speed` |
|---|---|
| lamps, LEDs, switches, meters | `1` |
| relays (operate in about 5 ms) | `1`; use `0.1` to watch the armature move |
| RC and RL charging with τ of milliseconds | `0.001` to `0.01` |
| logic that is clicked by hand (half adder, decoder) | `1e-6` (the outputs settle at once) |
| gate delays of nanoseconds (ring oscillator, race hazards) | `1e-9` to `5e-9` |
| flip-flop counters at 1 MHz | `1e-6` |

The reader can change it with the slider, in steps of 1, 2, 5 per decade; the frame also has Step (a tenth of a real
second) and Reset. The figure pauses when it scrolls off screen or the tab is hidden.

### Timing diagrams

`traces="A,B,Y"` adds a scrolling waveform for each name under the schematic. A name is, in order: a pin
(`U1.Y`, `X1.CLK`), a net name (a `label` or `port` name, `GND`, or a rail such as `+5V`), or the id of a component
with one pin or an output `Y` (a `toggle`, `clock`, `indicator`, `probe`, gate). Names that match nothing are listed in the
figure's status line, so you will see the typo. Set `window` to the simulated time across the width: for a ring
oscillator of three 1 ns inverters, `speed=4e-9 window=24e-9` fills the diagram in six seconds and shows four periods.
The diagram records every change from the engine, so a glitch shorter than a frame still appears.

### A worked example: the staircase light

Two changeover switches (SPDT) wired with two "travellers" between them, a battery and a lamp: either switch turns
the light on or off from either end. `spdt` has its common contact `C` at (0, 0) and its contacts `0` and `1` at
(4, 0) and (4, −2); flipping the second switch (`"flip": true`) mirrors it so that the contacts face each other.

```json
{
  "version": 1,
  "title": "Staircase light",
  "engine": "analog",
  "components": [
    {"id": "B1", "type": "battery", "x": 4, "y": 12, "rot": 270, "params": {"voltage": 6}},
    {"id": "S1", "type": "spdt", "x": 10, "y": 4, "label": "Downstairs", "params": {"throw": 0}},
    {"id": "S2", "type": "spdt", "x": 28, "y": 4, "flip": true, "label": "Upstairs", "params": {"throw": 0}},
    {"id": "L1", "type": "lamp", "x": 34, "y": 6, "rot": 90, "params": {"ratedVoltage": 6, "ratedPower": 0.3}},
    {"id": "G1", "type": "ground", "x": 4, "y": 16}
  ],
  "wires": [
    {"points": [[4, 8], [4, 4], [10, 4]]},
    {"points": [[14, 4], [24, 4]]},
    {"points": [[14, 2], [24, 2]]},
    {"points": [[28, 4], [34, 4], [34, 6]]},
    {"points": [[34, 10], [34, 16], [4, 16], [4, 12]]}
  ],
  "notes": [{"x": 13, "y": -1, "text": "two travellers"}]
}
```

Why it is laid out this way: the battery stands at the left with `+` on top, its wire runs up and right along the top
of the diagram to the first switch; the two travellers are parallel straight wires, so the reader can see there are
two paths; the lamp stands on the right and the return runs along the bottom to the ground symbol, which sits under
the battery's `−`. Only five wires, none longer than a jog. In the chapter:

```markdown
::circuit{src="06-shannons-switches/circuits/staircase.json" title="Two-way switching" caption="Click either switch. Which of the four combinations light the lamp? Write the truth table before you check." current=true}
```

With `current=true` the reader sees the dots run only when the lamp is lit; without it (`mode="logic"` in a digital
version of the same circuit) the wires turn amber and thick instead.

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
