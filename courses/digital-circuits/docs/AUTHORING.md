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
| ` ```quiz `, ` ```parsons `, ` ```bug `, ` ```build `, ` ```debug `, ` ```golf `, ` ```measure `, ` ```asm `, ` ```hdl `, ` ```fit `, ` ```decode `, ` ```route `, ` ```place ` | exercises (YAML; see *Exercise blocks*) |

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
| `delayModel` | digital engine only: `delayModel="transport"` passes pulses shorter than a gate's delay; the default `"inertial"` swallows them (see below) | `inertial` |
| `seed` | `seed=3`: seed of everything random in the run (the power-up state of a loop of gates, metastability), for any engine | fixed |
| `dial`, `level` | `dial=true` adds the Logic · Switches · Analog control to the toolbar; `level="switch"` starts lower down | off, `logic` |

**Engine options.** `delayModel` and `seed` are handed to the simulation engine when the figure is created (and again
on Reset), so `::circuit{src="15-timing/circuits/pulse-chain.json" delayModel="transport" seed=3 …}` runs the circuit with
transport delay and a different power-up state of its latches and rings. They are merged with the options the
abstraction dial sets for its own level (unit delay at the switch level, fine steps at the analog level), which win
on a clash; `seed` reaches every level's engine, `delayModel` only the digital one, so `dial=true` keeps working and
`delayModel` simply has no effect on the transistor levels. A value that is not one of `"inertial"`/`"transport"`, or a
`seed` that is not a number, is shown in the figure's status line and ignored. Leave both out unless the figure is
about them: the defaults (inertial delay, a fixed seed) are what every other figure uses, and a fixed seed keeps
a figure's random power-up state the same for every reader.

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

## Exercise blocks

An exercise is a fenced YAML block in the chapter's *Exercises* section. The compiler (`tools/markdown/compile.ts`) turns it into a component of `src/lib/components/exercise/`, renders the Markdown fields (`prompt`, `hints`, `explain`, `hint`) at build time and passes every other field through as data. Solved exercises and drafts are remembered in `localStorage` (`src/lib/state/progress.svelte.ts`), by `id`: start it with the chapter's directory name (`29-describing-hardware/priority-encoder`), so the chapter's progress counts it, and never change an `id` once it is published.

| Kind | What the reader does | Checked by |
|---|---|---|
| `quiz`, `parsons`, `bug` | answer, order, or find the wrong step | the block itself |
| `build`, `debug`, `golf` | draw a circuit on the bench | `src/lib/sim/check`, through `exercise/circuit/spec.ts` |
| `measure` | read an instrument | `exercise/measure/probe.ts` |
| `asm` | write an Octet or RV32I program | `exercise/asm/run.ts` |
| `hdl` | write DCL to a specification | `exercise/hdl/check.ts`: hidden tests, then equivalence with a reference |
| `fit` | program a PLA, GAL22V10 or vCPLD-32 within its resources | `exercise/fit/check.ts`: the configured device, against the spec and a budget |
| `decode` | work out what a fuse map or bitstream does | `exercise/decode/model.ts`: equivalence with the configured device |
| `route` | connect nets on a vFPGA-S by choosing routing multiplexers | `exercise/route/model.ts`: legality, then the fabric simulator |
| `place` | place a small design's blocks on a vFPGA-S and beat the annealer | `exercise/place/model.ts`: the placer's wirelength cost |

**Every exercise has a working `solution` and a `start` that fails**, and `src/lib/components/exercise/fixture.test.ts` runs them: for each block of `tools/markdown/fixtures/exercises.md` and of every chapter, the `solution` must pass and the starting point must not. A block whose solution fails is a failing test, not a confused reader. Put a small example of a new kind in the fixture; put the real ones in the chapters.

Pitfalls common to all of them: `hints` is a list of Markdown strings, revealed one at a time; a field named `lines`, `text`, `label`, `note`, `options` or `success` is rendered as Markdown, so data must not be called that (the `hdl` editor height is `height` for this reason); DCL, equations and YAML specifications go in `|` block scalars, so their colons are harmless; and the page ships the solution and the hidden tests in its data, as every exercise does.

### `hdl`: write DCL to a specification

The reader edits DCL in the course's editor (diagnostics as they type, *Format*, their own visible `test` blocks under *Run my tests*) and presses *Check*. The check compiles the source, runs the hidden tests and compares the design with a reference.

```yaml
id: 29-describing-hardware/priority-encoder
title: Which request wins?
top: PriorityEncoder          # the module the reader writes; hidden tests and reference use this name
prompt: |
  Write a priority encoder: `index` is the number of the highest request that is set.
height: 9                     # editor lines (optional)
start: |                      # what the editor starts with; it must compile, and its ports are the contract
  module PriorityEncoder(req: bits<8>) -> (valid: bit, index: bits<3>) {
    valid = 0
    index = 0
  }
reference: |                  # hidden; same module name and ports
  module PriorityEncoder(req: bits<8>) -> (valid: bit, index: bits<3>) { … }
tests: |                      # hidden `test` blocks, appended to the reader's source
  test "the highest request wins" { … }
equivalence: { exhaustiveBits: 8 }    # optional; `false` leaves it to the tests
solution: |
  module PriorityEncoder(…) { … }
```

- The ports may not change: the check compares names, widths and the clock with the reference's (or, without a reference, the starting code's).
- **Equivalence** is exhaustive when the data inputs total at most `exhaustiveBits` (16 by default), else `random` seeded vectors (4,096). A module with a clock is run from power-up on every input sequence of up to `depth` cycles while there are at most 2¹³ of them, then on `random` seeded runs of `cycles` cycles (defaults 64 and 48), comparing the outputs before and after every clock edge. Keep a reference's behaviour fully specified: there are no don't cares.
- A mismatch is shown as a table of inputs, expected outputs and what the design gave (for a clocked design, the last cycles before the first mismatch). A hidden test that fails shows its `expect` and the values it read.
- Write tests for the behaviours a reader would get wrong, and leave the exhaustive comparison to catch the rest. Test names are visible to the reader.

### `fit`: program a device within its resources

The reader works in the Device Studio's own panes (source, chip, report) on a PLA, a GAL22V10 or a vCPLD-32, and *Check the device* runs the **configured device** (the fuses or bits, through the Studio's `Runner`), not the text.

```yaml
id: 25-programmable-logic/excess-3
title: A code converter in seven terms
device: pla                   # pla, gal22v10 or cpld32
prompt: |
  Convert BCD to excess-3 in 7 product terms or fewer.
spec:                         # one of the three forms below
  truthTable:
    inputs: [D, C, B, A]
    outputs: [E3, E2, E1, E0]
    rows: ["0000 0011", "0001 0100", …]   # missing rows are don't cares
budget: { terms: 7 }          # terms, macrocells, registers, literals: any of them
start: |                      # the source pane's first text (optional)
  D C B A | E3 E2 E1 E0
  …
solution: |                   # source text that fits and works: fixture.test.ts programs it
  # @polarity auto
  …
```

- **Specifications.** `truthTable` or `expression` (as in `build`: `expression: 'P = A ^ B ^ C'`, with `inputs:` for the order): every input combination, `x` outputs skipped. `fsm:` (a state machine table, as in `build`): device and table run in lock step from power-up, on every input sequence of a few cycles and on random ones, compared before and after each clock edge. `steps:` (a script, for counters and registers): each step sets inputs (`set`), gives `clock` edges and reads outputs (`expect`; `z` means not driven); `buses: { Q: [Q3, Q2, Q1, Q0] }` lets a step write `Q: 9`.
- **Resources** are measured on the fit, so they mean the same on every device: `terms` (distinct product terms feeding outputs; a term shared by two outputs counts once), `macrocells` (outputs of the device, buried ones too), `registers` and `literals`. Terms and macrocells are always shown; a budget turns one into a goal. Choose budgets that only a technique from the chapter reaches (don't cares, polarity, buried macrocells), and check what the plain approach gives.
- A source that the fitter refuses is a fine `start`: the reader reads the fitter's message. A PLA can also begin as a virgin device with named pins, to be programmed by clicking crossings: `blank: true` (the Studio's By-hand mode for that device has generic pin names, so the exercise hides it).
- For the FPGA, `route`, `place` and `decode` are the exercises; there is no `fit` for it.

### `decode`: work out what a configuration does

A configuration is made from hidden source and shown as raw data; the answer is checked against what the configured *device* does, never against the source.

```yaml
id: 26-pals-and-gals/read-the-jedec
title: Read a JEDEC file
device: gal22v10              # prom, pla, gal22v10 or fpga
prompt: |
  The inputs are A (pin 2) … Which function does each output compute?
source: |                     # hidden: the device is fitted from it (not for fpga)
  # @pins A=2 B=3 C=4 D=5 Y=19 Z=18
  # @polarity Z=low
  Y = A & !B | C & D
  Z = !(A & B & C)
inputs: [A, B, C, D]          # the names the answer uses, in truth-table order
outputs: [Y, Z]
answers: [expression, table]  # forms offered: expression, table, dcl (default: expression, table)
solution: |                   # an expression answer; fixture.test.ts checks it, and the table form from the device
  Y = A & !B | C & D
  Z = !(A & B & C)
```

- **What is shown.** `prom`: the fuse map, one row per word (1 = blown). `pla`: the AND plane (a pair of fuses per input) and the OR plane of the terms in use, and the polarity row. `gal22v10`: the rows of the output pins in use (the array rows that are not all 0, each 44 fuses, with the pin of every column, the fuse number of the row), the macrocell bits S0 and S1, and the pin list (`show: { pins: [19] }` picks outputs). `fpga`: a `bitstream` of `pads`, `cells` (`at: [x, y, cell]`, `lut: "I0 ^ I1"` or a number) and `routes` (`[from, to]`: `P0`, `LC(1,2,0)`, `LC(1,2,0).I1`) is built on a vFPGA-S and shown as the LUT bits of the cells, the routing multiplexers that are set and the pads.
- **Answers.** An expression (one `Y = …` per output over the input names), a truth table (buttons, one row per input combination, at most a few inputs) or a DCL module named `Decoded` with one `bit` port per input and output, in lower case (`A` is `a`, `P0` is `p0`). A wrong answer returns a table of the input combinations that differ.
- A decode function should not be constant, and its map should be something a person can read: two or three terms per output, not a whole ALU.

### `route`: connect nets on a vFPGA-S by hand

The cells and pads of a vFPGA-S are placed; the reader sets routing multiplexers. The chip view is the by-hand machinery of `::fpga-by-hand` (the same `HandDevice`, the same configuration bits), and beside it is a list of the nets with the multiplexer of the selected sink: each of its inputs is labelled with the signal it carries now. Everything can be done from the list, by keyboard or touch; clicking a pin on the chip selects the same multiplexer.

```yaml
id: 28-inside-an-fpga/route-two-pairs
title: Wire up the placed cells
prompt: |
  Route the six nets so that P8 = P1 & (P0 | P2).
fabric:
  pads: { P0: in, P1: in, P2: in, P8: out }
  cells:
    - { at: [1, 1, 0], lut: "I0 & I1" }
    - { at: [1, 2, 0], lut: "I0 | I1" }
nets:
  - { name: a, from: P0, to: ["LC(1,1,0).I0"] }
  - { name: b, from: P1, to: ["LC(1,1,0).I1", "LC(2,1,0).I0"] }   # several sinks: a net with fan-out
outputs: { P8: "P1 & (P0 | P2)" }      # what each output pad must show, over the input pads
solution:                              # routes (source, sink), made with the auto-router in this order
  - [P0, "LC(1,1,0).I0"]
  - …
```

- **Legality.** Cells, pads and clocks are locked (changing one is refused). Each sink is traced back through the multiplexers to what drives it: it must be its net's source. A sink that reaches nothing is *open*; one that reaches another net's source is *shorted* to it. The fabric has single-driver wires, so two nets cannot fight: a second net that needs a wire simply reads the first one's signal, which is the short.
- **Function.** A legal routing is decoded and simulated on the fabric simulator for every input combination of the input pads, and each output pad must show its expression.
- vFPGA-S has 4 × 4 tiles (2 × 2 logic tiles), 16 pads and four span-1 tracks per direction. Each sink takes two to five multiplexers; six or seven nets are an exercise, twice that is a chore. The solution is built with `FabricConfig.route` in list order, so a solution that does not route in that order must be reordered.

### `place`: beat the annealer

A small DCL design is taken through the course's flow up to packing; the reader places its blocks (logic tiles, pad blocks) on the die, and their **wirelength cost** is compared with the annealer's (`src/lib/pld/fpga/place.ts`) on a given seed. The cost is the placer's own wirelength term: for every net of two or more blocks the half-perimeter of its bounding box, times the crossing-count factor for the net's size, added up (`model.test.ts` checks that it equals the annealer's `Placement.bb` exactly). The timing and congestion terms are not part of the score; the estimated critical paths are shown for both. Legality is the placer's `checkPlacement`.

```yaml
id: 30-netlist-to-bitstream/place-shift-register
title: Beat the annealer
seed: 5                        # the annealer's seed: its cost is the bar
prompt: |
  Place the other blocks so that your cost is lower.
design: |                      # DCL; `top:` names the module (default: the last one)
  module Lfsr(clk: clock, …) -> (…) { … }
pins: { "seed[0]": P12, "q[0]": P4 }    # ports that are fixed, as on a board (the clock is fixed to its global pad anyway)
start: { "tile 0": "1,1", clk: P0 }     # optional: where the blocks begin (default: first free site)
goal: 1                        # the bar as a factor of the annealer's cost (default 1: strictly below)
solution:                      # block → "x,y" (a logic tile) or a pad name
  tile 0: "2,2"
  en: P5
```

- Blocks are named `tile 0`, `tile 1`, … and by their port (`en`, `seed[1]`). The device is vFPGA-S, the only one small enough to drag blocks about on a phone; designs with carry chains (adders) and block RAM are refused.
- Pick the `seed` and the `pins` so that the annealer is beatable but not trivially: `search()` in `place/model.ts` (wirelength-only annealing over several seeds, then pair swaps) finds a good placement for the `solution`, and `fixture.test.ts` checks that the `solution` beats the annealer and that the default start does not.
- Dragging, and Enter or Space on a block and then on a site, move a block; a block dropped on another of its kind swaps with it.

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

## Validation

Three scripts compare the course with real, external tools. They are not part of CI and not part of
`npm test`. Each one prints `skipped: <tool> not found — install … or set …` and exits 0 when its tool is
missing, and exits 1 on a real mismatch (2 on a bad argument). The entry point is `scripts/validate.mjs`; the
logic is in `tools/validate/` (TypeScript, loaded through Vite, with unit tests on fixtures and fake tools).

| Script | Tool | What it checks |
|---|---|---|
| `npm run validate:gal` | [galette](https://github.com/simon-frankau/galette): `GALETTE=/path/to/galette`, or `galette` on PATH, or `GALETTE_DIR=/path/to/checkout` (built with `cargo build --release` if it has no binary) | Every GAL22V10 example (the Studio's, Chapter 26's fixtures and the polarity demo's presets): galette's JEDEC file must equal, byte for byte, the course's galette-style file and the one the `.pld` assembler writes, and have the fuse map of the Studio's download. With a checkout it also runs galette's own `testcases/`. |
| `npm run validate:yosys` | Yosys (`YOSYS`, default `yosys`) and nextpnr-ice40 (`NEXTPNR`, default `nextpnr-ice40`) | Every design of `content/designs/` and `content/chapters/*/designs/` is exported as Yosys JSON (`src/lib/pld/interchange`), validated, read by Yosys, synthesised (`synth_ice40`) and placed and routed for each part. Yosys must accept it and keep its ports. The report `docs/validation/yosys.json` has Yosys's cell counts, nextpnr's resource use and fmax. |
| `npm run validate:rv32i` | [riscv-arch-test](https://github.com/riscv-non-isa/riscv-arch-test): `RISCV_ARCH_TEST=/path/to/checkout`, with precompiled `.elf` files or a RISC-V toolchain (`RISCV_PREFIX`, or `riscv64-unknown-elf-gcc` and friends on PATH) | The signatures of the RV32I tests, run on the reference interpreter and on the DCL core (`content/designs/rv32i.dcl`) on the RTL simulator, against the tests' `reference_output` files. |

Options of `validate:yosys` (after `--`, or as environment variables): `--parts up5k:sg48,hx8k:ct256`
(`ICE40_PARTS`; designs with wide ports may not fit the smaller part, which the report records as
`does-not-fit`), `--freq 12` (`ICE40_FREQ`, the clock constraint in MHz), `--seed 1` (`ICE40_SEED`),
`--only counter,alu`, `--out file`, `--work dir` (keeps the intermediate files). Without nextpnr it runs Yosys only.
Options of `validate:rv32i`: `--only regexp`, `--skip regexp` (default `misalign|ecall|ebreak`, which need trap
handlers), `--no-core`, `--max-steps n`. Example: `npm run validate:yosys -- --parts hx8k:ct256 --only rv32i`.

The interchange netlist itself has ordinary tests (`src/lib/pld/interchange/`): a validator for the
documented JSON format, a simulator that reads only the JSON and is compared with the RTL simulator on every
course design, and a golden file (`UPDATE_GOLDEN=1 npx vitest run src/lib/pld/interchange` rewrites it).
