---
number: C
title: The simulator and toolchain
summary: "What the three engines, the bench, the checkers and the DCL and programmable-logic toolchains model, how, with which numbers, and, just as important, what they leave out."
duration: Look things up
prerequisites: []
---

Everything that moves on these pages is computed by code written for the course: no third-party simulator, no server, nothing precomputed. That makes the code part of the subject, and it makes an honest list of its limits part of the course, because a simulator that does not say what it leaves out invites you to believe it puts everything in. This appendix is that list, together with a map of the machinery and the numbers that matter: the constants, the tolerances, the limits.

Like the other reference appendices it is checked. The constants quoted from the engines are compared with the source by a test; the behaviours described (a resistor that burns, a flip-flop that goes metastable, a budget for opening gates) are run by the same test. Where a sentence says “the engine does X”, a line of `src/lib/` does X.

## The map

Three engines share one circuit model and one interface. The **digital** engine simulates logic (0, 1, unknown and floating) with delays; the **switch-level** engine simulates transistors as switches with strengths; the **analog** engine solves the circuit’s equations for voltages and currents. The **abstraction dial** turns a circuit of gates into transistors, so that the same figure can be run at all three levels.

::pipeline-diagram{id="simulator" n="C.1"}

The DCL compiler and the tools for programmable logic sit beside them. Their outputs are ordinary netlists, so the digital engine and the bench run them too.

::pipeline-diagram{id="toolchain" n="C.2"}

::pipeline-diagram{id="plds" n="C.3"}

## The circuit model

A circuit has two forms, and the difference between them is the whole design.

- A **Circuit** is what people draw: components placed on a grid, wires as lists of grid points, notes, and subcircuits. It is the JSON file of every figure (`"version": 1`; the bench refuses any other version), and it keeps the geometry the renderer needs.
- A **FlatNetlist** is what the engines simulate: a list of elements whose pins are connected to numbered nets, with no geometry and no subcircuits.

Two functions turn the first into the second, and both are short enough to read.

**`connect`** decides which pins and wires are joined. Wires connect along their whole length, to every pin or wire end that touches one of their points, and to pins or wire ends that lie *on* a segment (a T-junction, drawn with a dot). Wires that merely cross do not connect. Beyond wires, three things are the same net without one: every `ground` symbol; every `rail` of the same voltage; and every `label` with the same name. It also reports the junctions to draw and the pins that are connected to nothing (drawn as open circles).

**`flatten`** inlines subcircuits. A component of type `sub:<name>` is a subcircuit defined inside the circuit; `part:<name>` is a part from the parts bin. Their ports join the nets of the parent’s pins; their other nets get fresh numbers; ground and rails are global. Element ids are hierarchical (`U1/X2/R3` is R3 inside X2 inside U1). `ground`, `label` and `port` only make connections, so they do not become elements. A subcircuit that ties a port to ground, to a rail or to another port merges nets that were numbered separately, and the result records the representative of each merged net in `alias`. Subcircuits nested more than 32 deep (or a subcircuit that contains itself) are refused.

The top level of a flattened circuit keeps `connect`’s net numbers, so a renderer can colour a wire from the value of its net without a translation table.

### The catalog

The **catalog** (`src/lib/sim/netlist/catalog/`) is data only: every component type’s pins, bounds and parameters. Behaviour lives in the engines, keyed by the type name, and drawings in `src/lib/bench/symbols`; this keeps the model free of rendering and the engines free of each other. There are 62 types:

| Category | Types |
|---|---|
| Wiring | `ground`, `label`, `rail`, `port` |
| Sources | `battery`, `supply` (bench supply with a current limit), `siggen` (function generator) |
| Passive | `resistor`, `capacitor`, `inductor`, `potentiometer`, `lamp` |
| Switches | `switch`, `spdt`, `pushbutton` |
| Electromechanical | `relay` |
| Semiconductors | `diode`, `led`, `npn`, `pnp`, `nmos`, `pmos`, `comparator` |
| Meters | `voltmeter`, `ammeter` |
| Inputs and outputs | `toggle`, `button`, `clock`, `const`, `indicator`, `probe`, `seven-seg`, `hex-display` |
| Gates | `not`, `buffer`, `tristate`, `and`, `or`, `nand`, `nor`, `xor`, `xnor` (1 to 8 inputs) |
| Sequential | `srlatch`, `dlatch`, `dff`, `dffr`, `dffe`, `jkff`, `tff` |
| Blocks | `mux`, `demux`, `decoder`, `encoder`, `priority-encoder`, `adder`, `magnitude-comparator`, `register`, `counter`, `shift-register`, `lfsr`, `ram`, `rom` |

Each type lists the engines that can simulate it. The digital engine has models for 41 types. The analog engine has 36: the sources, the passive parts, the switches and the relay, the semiconductors (including the comparator), the meters, the inputs and the indicator and probe, the gates `not`, `buffer`, `and`, `or`, `nand`, `nor`, `xor` and `xnor`, and `rail`; it has none for the tri-state buffer, the displays, the sequential parts or the blocks. The switch-level engine builds a switch network from `nmos`, `pmos`, `resistor`, `lamp`, `switch`, `pushbutton`, `spdt`, `relay` and `capacitor`, and takes `ground`, `rail`, `toggle`, `button`, `const` and `clock` as sources. Asking an engine to run a circuit that contains a part it has no model for does not fail: the part is left out, and the engine says so in a warning (the switch-level engine’s reads “does not simulate … it is left out”).

### Geometry

Geometry is in grid units (12 pixels on the page, scaled by 1.5). Two-terminal parts have pins at (0, 0) and (4, 0), gates have their inputs every 2 units on x = 0, and rotation is clockwise, applied after the left–right flip. None of this matters to an engine; it matters to the renderer, and to `connect`, which is what turns coincident points into connections.

## The engine interface

Every engine implements the same interface, in SI units throughout (seconds, volts, amperes; a gate’s delay parameter is in nanoseconds). Widgets, the bench and the instruments only talk to engines through it.

| Member | What it does |
|---|---|
| `advance(dt)` | Advance simulated time by `dt` seconds; the engine chooses its own internal steps. |
| `settle()` | Settle the circuit without advancing time (digital: process every zero-time event). |
| `reset()` | Back to the initial state; parameters keep their current values. |
| `logic(net)` | The logic value of a net: 0, 1, 2 (X) or 3 (Z). An analog engine derives it from the voltage. |
| `voltage(net)` | The voltage of a net relative to ground. The logic engines report 0 V or 5 V, and NaN for X and Z. |
| `current(id, pin)` | The current into a pin, in amperes. Zero in the logic engines. |
| `state(id)` | What an element looks like now: a switch’s position, a lamp’s brightness, an LED lit or burned, a relay’s contacts, a display’s segments, a register’s value. |
| `setParam(id, key, value)` | Change a parameter while running: flip a switch, press a button, turn a knob. |
| `watch(nets)` | A recorder of every change of the given nets (digital: every event; analog: every internal step), so that a glitch shorter than a frame is not lost. |
| `messages` | Problems the reader should know about: a failed convergence, an oscillation, a burned part. |

The logic values are the numbers 0 (low), 1 (high), 2 (X, unknown or in conflict) and 3 (Z, driven by nothing). An analog engine maps a voltage to a logic value with the thresholds of 5 V CMOS: below 1.5 V is 0, above 3.5 V is 1, and between them, X.

## The digital engine

*Event-driven logic simulation with four values.* Source: `src/lib/sim/digital/`.

### Values and nets

Nets carry 0, 1, X or Z. Every output pin is a **driver**, and the value of a net is the resolution of its drivers:

| Drivers on the net | Value |
|---|---|
| none | Z |
| one driven value, and any number of Z | that value |
| 0 and 1 together | X, and a **:term[contention]{id=bus-contention}** message |
| any X | X |

Ground is driven to 0 by the engine. Models treat Z at an input as unknown (a floating CMOS input), and the gates propagate unknowns as far as they honestly must, no further: an AND with any 0 input is 0 whatever the others are, an OR with any 1 is 1, and an XOR with any unknown input is unknown. (This is optimistic where a real circuit could still be undecided and pessimistic in reconvergent fanout; see the last section.)

### Time and events

Time is an integer number of **picoseconds**, held in a double, so it is exact up to 2⁵³ ps, about two and a half hours of simulated time. Output changes are events in a binary heap ordered by time and then by the order they were scheduled. Events at the same time are processed in **delta cycles**: first every change that is due now is applied to its net, then every element whose input changed is evaluated, which may schedule zero-delay changes for the next delta cycle.

- **Delay.** Every gate and block has a delay parameter in nanoseconds (default 1 ns). It is **:term[inertial]{id=inertial-delay}** by default: a new output value cancels the pending ones, so a pulse shorter than the delay vanishes, as it does in a real gate. The **:term[transport]{id=transport-delay}** option (`delayModel: 'transport'`) delivers every change.
- **Determinism.** Nothing is random except where it says so, and the random numbers are seeded, so a run is reproducible. Metastability and the power-up of loops use the seed (`seed`, default `0x5eed`).
- **Zero-delay loops.** A loop with no delay in it that is still changing after 10,000 delta cycles (`maxDeltaCycles`) is reported as an error naming the elements involved, and their outputs are forced to X, which is where such a loop ends up.
- **Power-up.** Every output starts at X, storage elements then drive their `init` value, and sources their parameter. A feedback loop of gates (a latch built from NANDs, a ring of inverters) would stay X for ever, which is not what hardware does, so with `powerUp: 'random'` (the default) the engine walks each loop once and gives every output that is still X a consistent value, picking a seeded random bit where the inputs do not decide it, and says so in a message. An odd ring then oscillates, and an even ring or a latch settles in one of its stable states.

### Flip-flops and metastability

Storage elements have parameters in nanoseconds:

| Parameter | Default | Meaning |
|---|---|---|
| `clkToQ` | 1 | Clock to output delay |
| `setup` | 0.5 | The data input must be stable this long before the rising edge |
| `hold` | 0.2 | … and this long after it |
| `tau` | 1 | Mean of the metastable resolution time |

If a data input (D, J, K, T or EN) changes less than `setup` before a rising edge, or less than `hold` after it, **Q and Q̄ go to X** at clock-to-Q and stay there for a random time drawn from an exponential distribution with mean `tau`, then settle to a random 0 or 1. A warning is posted for the violation, and an information message when the output resolves. An SR latch does the same when S and R leave the forbidden state S = R = 1 together. Edges are detected as the clock reaching 1 when its last known value was 0; a detour through X or Z in between still counts.

The blocks built from flip-flops (registers, counters, shift registers, RAM) are behavioural: they detect edges the same way but **do not check set-up and hold times**.

::appendix-circuit{name="metastable" n="C.4" traces="CK,BUF.Y,FF.Q" speed=1e-6 delayModel="transport" caption="The data is the clock delayed by 995 ns, so it changes 5 ns before every rising edge: inside the flip-flop’s set-up window, which is set here to 60 ns (with a 30 ns hold time), far wider than a real part’s. Every edge, Q goes to X for a random time with a mean of 100 ns, then settles to 0 or 1, and the engine posts a warning. The buffer needs transport delay: with inertial delay, a pulse shorter than its 995 ns would vanish."}

### What the digital engine keeps and drops

| Modelled | Not modelled |
|---|---|
| Four values, resolution, contention | Voltage levels, noise margins, slew rates |
| Per-gate inertial or transport delay | Wire delay, fan-out loading, the dependence of delay on load |
| Glitches, hazards and races that delays make | Delay variation between chips, temperature, supply |
| Set-up, hold and metastability of flip-flops | Set-up and hold of the blocks; clock skew and jitter |
| Zero-delay loops, detected | Analog behaviour of oscillation and of tri-state buses |

## The switch-level engine

*Transistors as bidirectional switches (:term[switch-level simulation]{id=switch-level}), in the manner of Bryant’s MOSSIM.*:cite[bryant1984] Source: `src/lib/sim/switch/`.

Nets carry 0, 1 or X. An nMOS transistor conducts when its gate is 1, a pMOS when it is 0, and either *may* conduct when its gate is X. Resistors, lamps and relay coils always conduct, weakly; switch and relay contacts conduct like wires when closed.

### Strengths

A value has a **strength**, a small integer, and a signal along a path is as strong as the weakest thing on it: its source, or any link it crosses. A node takes the value of the strongest signals that reach it; if the strongest ones disagree, it is X. A stronger signal blocks weaker ones at the node. It is a widest-path problem, solved like Dijkstra’s algorithm with a bucket for each level.

| Strength | Rank (with no capacitors) | Where it comes from |
|---|---|---|
| Charge, small | 1 | A node cut off from every source keeps its value |
| Charge, normal | 2 | (the default size of a node) |
| Charge, large | 3 | A node touching a `capacitor`; larger capacitances are larger still |
| Weak | 4 | Resistors, lamps, relay coils: a pull-up resistor loses to any transistor |
| Transistor, weak | 5 | A transistor with `strength: 'weak'`, or relative width below 1 |
| Transistor, normal | 6 | The default |
| Transistor, strong | 7 | `strength: 'strong'`, or width 2 or more |
| Wire | 8 | A closed switch or relay contact |
| Supply | 9 | Rails, ground, toggles, buttons, clocks, constants |

When isolated nodes are joined (charge sharing), the larger node wins, and equal sizes that disagree give X. Transistor sizes decide **ratioed** circuits: a pseudo-nMOS load or a pull-up must be weaker than the pull-down network; an SRAM cell is written because its access transistors overpower its pull-ups, and read without upset because its pull-downs overpower the charged bit line. A transistor with an X gate is handled conservatively: the solver computes the definite strength of each node and the strongest 0, 1 and X that might reach it, and never claims a value that some combination of the unknown gates contradicts.

### Rounds

Simulation proceeds in **rounds**. A round re-evaluates every transistor whose gate changed in the previous round, then re-solves every channel-connected component that one of those changes touched. In the default **settle** mode, rounds run at the same instant until nothing changes; a circuit still changing after `maxRounds` (1,000, or four times the number of nets if larger) oscillates: the nodes still changing are set to X, and an error message says so. In **unit-delay** mode each round takes `unitDelay` (default 1 ns), so each transistor stage adds one delay and a change ripples through; rings oscillate and a figure can animate the ripple.

Power-up is as in the digital engine: every node starts X, and feedback loops still X after the first settle (latches, SRAM cells, rings) get a seeded random bit on one node at a time.

### What the switch-level engine keeps and drops

| Modelled | Not modelled |
|---|---|
| Transistors as switches, X gates | Any voltage: a value is 0, 1 or X |
| Ratioed logic, by strength class | Resistance values: a resistor is “weak”, and 1 kΩ and 1 MΩ are the same |
| Charge storage and sharing, by size class | Charge leakage over time, and the amount of charge |
| Unit-delay ripple | Real delays: every stage takes the same time, whatever the load |
| Pass transistors in both directions | The threshold-voltage drop of a real pass transistor: a 1 passes at full strength |

## The analog engine

*Modified nodal analysis with transient analysis and Newton–Raphson.* Source: `src/lib/sim/analog/`; the models are in `models/`, one file each for passive parts, sources, switches and relays, semiconductors, and the behavioural parts.

### The equations

The unknowns are the voltages of the nets that have element pins (ground is not an unknown), then the internal nodes and branch currents that devices ask for. At every time point the engine solves **A·x = b**, where every device **stamps** its linearised equations into the matrix: a device that draws a current *i*(*v*) from a node adds ∂*i*/∂*v* to that node’s row and moves the constant part to *b*. A node’s row sums the currents leaving it. Two conventions matter when you read a model: `current(pin)` is the current *into* the pin, and the branch current of a voltage source flows into its + pin, through the source and out of its − pin.

### Linear algebra

The matrix is **dense**, and it is solved by LU decomposition with partial pivoting (`lu.ts`). That is a choice for size: circuits stay below about a hundred unknowns, and at that size a dense factorisation is as fast as a sparse one and much simpler. Three details keep it accurate.

- **Row equilibration.** The rows of an MNA matrix mix units (amperes per volt, from 10⁻¹² to 10¹¹), and without scaling, partial pivoting is not backward stable. Each row is scaled by its largest entry before pivoting.
- **Iterative refinement.** One step of *x* += A⁻¹(*b* − A·*x*), with the residual computed in the original matrix, recovers the digits lost to the wide range of magnitudes, for O(*n*²) extra work.
- **Singular matrices.** A pivot that is tiny compared with its column (a floating group of nodes, two ideal sources in parallel) is replaced by a small value so that the solve still completes, and the column is remembered. If the right-hand side in that direction is not negligible, the equations contradict each other (5 V and 3 V sources in parallel): the engine posts the error “Ideal voltage sources are connected in parallel … with different voltages” and suggests a resistor. Two equal sources in parallel are harmless.

The factorisation is reused while the matrix is unchanged, so a linear circuit with a steady step costs only a forward and a back substitution per point.

### Newton–Raphson

Non-linear devices (diodes, LEDs, transistors, MOSFETs, the behavioural gates) make the equations non-linear, and each point is found by iterating: stamp, solve, and repeat until *x* stops moving.

| Constant | Value | Meaning |
|---|---|---|
| Relative tolerance | 10⁻⁶ | Part of the convergence test on each unknown |
| Voltage tolerance | 10⁻⁸ V | Absolute part of the test for voltages |
| Current tolerance | 10⁻¹¹ A | Absolute part of the test for branch currents |
| Iterations per point | 40 | 200 when settling the initial state |

**Junction voltage limiting.** The exponential of a junction, *I* = *I*ₛ(e^(*V*/*nV*ₜ) − 1), explodes when a Newton step overshoots. Above the junction’s critical voltage, a step that would raise the voltage by more than 2*nV*ₜ is replaced by a logarithmic one (SPICE’s `pnjlim`):cite[nagel1975] the iterate cannot leap up the curve, and the iteration is not declared converged while any junction was limited. MOSFETs use SPICE’s `fetlim` and `limvds` for the gate–source and drain–source voltages. Exponentials are also continued linearly above *x* = 80, so a wild iterate cannot overflow. The thermal voltage is a constant, *V*ₜ = 25.852 mV (300 K).

### Time steps

The default integration is **backward Euler**; the **trapezoidal** rule is an option (a fixed-step mode exists to show how the two methods behave, which Chapter 4 uses). Every reactive element becomes a **:term[companion model]{id=companion-model}**, a conductance in parallel with a current source that stands for its history: for a capacitor, *g* = *C*/*h* (Euler) or 2*C*/*h* (trapezoidal).

| Setting | Value |
|---|---|
| Largest step | 10 ms (a device may ask for less: a warming lamp, a sine source) |
| Growth | at most ×4 per step |
| Smallest step | 1 fs |
| Truncation tolerance | 10⁻⁴ (Euler) or 5 × 10⁻⁴ (trapezoidal), relative, plus 10 µV and 10 nA absolute |
| Fixed-step option | 1 µs, with the chosen method throughout |
| Steps per `advance()` call | at most 1,000, and at most 5 × 10⁷ multiply–adds (about 30 ms) |

**Adaptive steps.** Each step is checked against an estimate of its **local truncation error**: the difference between the solution and a polynomial predictor through the previous points (linear for Euler, quadratic for the trapezoidal rule), scaled by the method’s error constant. A step whose error is above tolerance is retried with a smaller one; otherwise the next step grows. The step never goes past a **breakpoint**: the edge of a source, a switch bounce, a relay contact change.

**After a breakpoint or a parameter change** the step restarts small, with a first step of backward Euler even when the method is trapezoidal, as SPICE does, so that the trapezoidal rule does not ring on the jump. How small is a recent change: the restart step is the smallest of 1 ns, 10⁻³ of the *fastest time constant of the circuit as it is now*, and 1/100 of the interval `advance()` was asked for, never below 1 fs. The time constants are estimated by assembling the matrix once with a probe step: each capacitor gets τ = *C*/*G*, where *G* is the largest conductance at its terminals not counting capacitors, and each inductor or relay coil *L*/(*R* + 1/*G*). A switch that has just closed counts, so a fast RC edge is resolved from its first step.

**Work caps.** When an `advance()` call reaches one of its caps before the requested time, the engine sets `lagging`, posts an information message, and simulated time falls behind the requested time: the figure simply runs slower than real time. The caps are deterministic. A UI loop may also pass a wall-clock budget, which is not, so tests do not use it.

### When Newton–Raphson fails

If a point does not converge, the step is divided by 8 and retried. At the smallest step, **gmin stepping** is tried: solve with a large conductance from every node to ground (10⁻² S), then reduce it by decades to 10⁻¹¹ S and then to zero, each solve starting from the last. It is expensive, so after a failure it is not tried again for the next 100 steps. If that fails too, the last iterate is accepted and a warning is posted: “The simulation did not converge … the results may be inaccurate.”

### Minimum conductances

| Constant | Value | Where |
|---|---|---|
| `GMIN` | 10⁻¹² S | From every node to ground, so that floating nets do not make the matrix singular |
| `GMIN_JUNCTION` | 10⁻¹⁰ S | In parallel with every pn junction (diode, LED, transistor junctions) |
| Closed contact | 10 mΩ (100 S) | Switches, relay contacts |
| Open contact | 1 TΩ (10⁻¹² S) | Switches, relay contacts, burned parts |

The junction value is larger than SPICE’s 10⁻¹² S on purpose. A junction behind a series resistance (a diode’s, a closed contact’s, an ammeter’s) whose other terminals float is a node held only by the junction’s own tiny conductance; the matrix entry 1/*R*ₛ + *g* cannot represent a *g* of 10⁻¹² to better than 10⁻⁴ next to a 0.5 S neighbour, so the node voltage was rounding noise and Newton–Raphson flipped between two values 10⁻⁵ V apart for ever (an LED behind an open switch took over 100,000 steps in 5 ms). With 10⁻¹⁰ S the noise is 10⁻⁶ and below the tolerance, and the leakage (0.5 nA at 5 V) is invisible next to any real current.

### The devices

| Part | Model |
|---|---|
| Resistor | Conductance. Rated power `power` (0.25 W by default). |
| Capacitor | Companion model. Polarised parts fail when reversed. |
| Inductor | Companion model with series resistance. |
| Diode | Shockley, *I* = *I*ₛ(e^(*V*/*nV*ₜ) − 1), in series with *R*ₛ through an internal node. Reverse breakdown is not modelled. |
| LED | The same, with a colour: forward voltage at 10 mA of 1.2 V (infrared), 1.85 V (red), 2.02 V (amber), 2.05 V (yellow), 2.1 V (green), 3.05 V (blue), 3.1 V (white), *n* = 2, series resistance 1 to 5 Ω. Brightness is the current relative to its maximum (30 mA by default). |
| Bipolar transistor | Ebers–Moll transport model, β_R = 1, no series resistances, β_F = 100 and *I*ₛ = 10⁻¹⁴ A by default. PNP is the same with every voltage and current negated. |
| MOSFET | Level 1 (Shichman–Hodges):cite[shichman1968] off, linear or saturation, with λ. Symmetric (drain and source swap when *V*ds < 0). The gate draws no current. |
| Lamp | A filament with a thermal lag (τ = 50 ms): its resistance follows its temperature, cold about a tenth of hot. |
| Relay | A coil (an inductor with its resistance and 100 × that resistance in parallel), and an armature that operates above 70 % of the rated current and releases below 30 %, after the operate time, break-before-make, with seeded contact bounce. |
| Pushbutton | A switch with an optional seeded bounce: a burst of 1 to 5 ms with 2 to 5 extra bounces. |
| Comparator | A Schmitt trigger with ±1 mV of hysteresis: the output jumps a whole swing through 10 Ω, and never rests half-way. The inputs draw nothing. |
| Sources | Battery (ideal source with internal resistance, 0.2 Ω by default), bench supply (constant voltage until its current limit, then constant current), function generator, rails. |
| Gates | A behavioural model: input a logistic function of voltage with a 50 mV width around 2.5 V, 5 pF input capacitance; output through 50 Ω, with a first-order lag that puts the 50 % crossing exactly at the gate’s delay. |
| Meters | Voltmeter 10 MΩ; ammeter 0.1 Ω; both read exactly zero below 1 µV or 1 nA, as a real meter would not resolve solver noise. |

### Ratings and burning

Each part has a maximum power, current or voltage, and **exceeding it for long enough destroys the part**: an animation plays, a message says why, and the part becomes an open or a short circuit, as it would.

| Part | Fails when | Becomes |
|---|---|---|
| Resistor | Power relative to its rating, filtered with τ = 0.5 s, reaches 2: after 0.35 s at 4× the rating, 0.11 s at 10× | open |
| Capacitor | Voltage above 1.1 × its rating, or a polarised part reversed by more than 1 V, for more than 10 ms | a short of 0.1 Ω |
| Lamp | Filament temperature above 1.45 × its rated temperature, which a steady 1.47 × the rated voltage reaches | open |
| Diode | Current relative to its maximum, filtered with τ = 100 ms, reaches 1.5 | open |
| LED | The same with τ = 20 ms | open |
| Bipolar transistor | Collector current relative to its maximum, filtered with τ = 50 ms, reaches 1.5 | open |

::appendix-circuit{name="led-direct" n="C.5" caption="A red LED straight across a 5 V battery, with a switch. Close the switch: the current is about 1.3 A, over forty times the LED’s 30 mA rating, and within a millisecond it burns out and the engine says why. The battery’s 0.2 Ω and the LED’s own few ohms are all that limit the current. Reset, and put a resistor in the circuit on the bench."}

### Recent changes to the engine

The engine was hardened in one revision; the changes explain some of the constants above.

- **Junctions have a floor of 10⁻¹⁰ S** in parallel (the passage above), so a floating LED node no longer stalls the solver. The node-to-ground conductance stays 10⁻¹² S.
- **Meters read exactly zero** below 1 nA and 1 µV, instead of showing picoamps of solver noise on an open circuit. `current()` and `voltage()` are not snapped: they remain the solver’s numbers.
- **The first step after a breakpoint** is sized from the circuit’s fastest time constant as it is then, so that a fast RC edge is resolved from its first step (the smallest step allowed also went from 10 fs to 1 fs).
- **The lamp’s brightness** follows a gentler curve: the glow starts near a quarter of the rated power, is a dull red at about 35 %, half bright at 72 % of the power, and full at 100 %.
- **Model registration is idempotent**, so a hot reload of a model file does not lose or duplicate models.

## The abstraction dial

`src/lib/sim/expand/` turns a circuit of gates into transistors, one level down at a time. `::circuit{dial=true}` puts the control on a figure. The dial never guesses: a level is offered only where the expansion is possible and small enough.

| Level | What is simulated | Engine and speed |
|---|---|---|
| Logic | The circuit as drawn | Digital |
| Switches | Every gate replaced by its CMOS transistor network | Switch-level, one stage per unit delay (1 ns); shown at 4 ns per second |
| Analog | The same transistors as level-1 MOSFETs, with small capacitances that give switching a real delay | Analog with 100 ps steps; shown at 1 ns per second |

A gate is a list of **stages**, each a complementary pair of a pull-up network of pMOS transistors and a pull-down network of nMOS transistors, built from series and parallel trees. The transistors it takes:

| Gate | Transistors | How |
|---|---|---|
| NOT | 2 | one stage |
| NAND *n*, NOR *n* | 2*n* | one stage |
| AND *n*, OR *n* | 2*n* + 2 | a NAND or NOR and an inverter |
| Buffer | 4 | two inverters |
| XOR, XNOR (2 inputs) | 12 | two inverters and one stage, restoring; the 8-transistor pass-gate form would pass its input through, which strengths and loading would show as a weaker output |
| Tri-state buffer | 8 | two inverters and a clocked inverter |

(The gate-golf cost of the checkers counts a two-input XOR as 8 transistors, the transmission-gate form, so its “transistors” differ from the dial’s for that one gate.)

**Limits.** A circuit can be opened to the switch level if it needs at most 400 transistors, and to the analog level at most 48. It can be opened only if everything in it is a gate or one of the parts that survives (toggles, buttons, clocks, constants, indicators, probes, ground, rails and labels), if no gate is rotated or mirrored, and if it uses no subcircuits. The analog level adds these parasitics:

| Constant | Value | Where |
|---|---|---|
| Transconductance *k* | 10⁻⁴ A/V² | Every transistor, both polarities (the source comment: about 5 kΩ on-resistance at 5 V, p-channel devices drawn twice as wide) |
| Gate capacitance | 2 fF | On the net that drives each transistor gate |
| Internal node | 10 fF | The middle of a series stack, or a stage’s output |
| Output load | 50 fF extra | A gate’s own output: wire and load |

::appendix-circuit{name="nand-dial" dial=true n="C.6" traces="A,B,Y" caption="A NAND gate at three levels. Flip A and B at Logic. Choose Switches, and the gate opens into its four transistors: watch the two series nMOS and the two parallel pMOS. Choose Analog, and the output becomes a voltage with a real switching delay."}

## The bench

The bench (`#/bench`) is a full-screen sandbox, and a compact form of it sits in every figure.

- **Editor.** Snap-to-grid placement, orthogonal wire routing (an L-shaped route that avoids components where it can, then adjustable by dragging its segments), rotate and flip, labels, undo and redo, copy and paste, and the parts bin’s blocks as parts.
- **Views.** Wires coloured by logic value, by voltage, or not at all (`mode`); current as moving dots, found by applying Kirchhoff’s current law along each net’s wires from the currents the engine reports at every pin.
- **Speed.** Simulated seconds per real second, on a 1–2–5 ladder from 10⁻⁹ to 10³. The default is chosen from the circuit: a period of the fastest clock or generator takes about two seconds; without one, analog circuits run in real time (1) and logic at a microsecond per second (10⁻⁶), since gate delays are nanoseconds. The speed can also follow an instrument’s timebase.
- **Instruments.**

| Instrument | Settings |
|---|---|
| Multimeter | Volts, amperes, ohms or continuity, with a red and a black probe placed on any wire or pin |
| Oscilloscope | Up to 4 channels, volts per division and position for each, a timebase (ten divisions across), a trigger (source, level, rising or falling, auto or normal), two time cursors and two voltage cursors, persistence |
| Logic analyser | 8 channels to start with and up to 16, a window, hold, two time cursors, and a hook for protocol decoders (none is registered in this version) |
| Logic probe | HIGH, LOW, Z or X of a net |

- **Saving and sharing.** The circuit in the editor is autosaved to the browser’s local storage under the key `dc-bench` (every access is guarded, since storage can be missing or full). A **share link** keeps the whole circuit in the URL, so nothing is stored on a server:

```text
…/bench/#c=<payload>
```

The payload is one format character followed by base64url text. `z` means the circuit as JSON compressed with the browser’s `CompressionStream` (raw deflate); `j` means the plain JSON, used where that does not exist. Decoding accepts both. The JSON is the Circuit, and may carry a `bench` property with the bench’s own state (instruments and their probes), which the circuit model ignores. Every live figure has an **Open on the bench** button that carries its circuit in exactly this form.

- **Figure options.** Besides its title and caption, a `::circuit` can set `mode`, `speed`, `current`, `traces`, `window`, `highlight`, `toolbar`, `dial`, `level`, and the engine options `delayModel` (`inertial` or `transport`) and `seed`.

## The parts bin and the checkers

The parts bin has 40 parts, added chapter by chapter, in six groups (transistors and gates; building blocks; arithmetic; memory and time; the computer; talking to the world). 32 have a **reference implementation**, a subcircuit built from simpler parts and checked against a specification; the other 8 are planned. A circuit uses a part as `part:<id>`, and `flatten` resolves it either to the reference or to the reader’s own version, whichever the reader has chosen. Parts whose reference is transistor-level (the CMOS gates) have a behavioural stand-in when placed inside other circuits, so that every reference runs on the digital engine.

### Checking a circuit

`checkPart` runs the part’s checker on a circuit (the reference, or the reader’s attempt). The circuit’s ports must be exactly the part’s pins; the checker finds the toggles and buttons (inputs) and indicators and probes (outputs) by name and drives the circuit as a black box: set inputs, settle, read outputs.

| Checker | How it works | Limits |
|---|---|---|
| Combinational | Every input row, on the circuit’s own engine (digital unless the circuit says otherwise), against a truth table, a Boolean expression or a reference circuit; “don’t care” rows are skipped | Exhaustive up to 16 inputs (65,536 rows); beyond that, corner cases and 3,000 seeded random rows; refuses more than 24 inputs |
| Sequential | Circuit and a reference circuit or an FSM table run in lock step. First, for at most 6 inputs, a breadth-first search of the *product machine* (replaying from reset to reach each state); then directed stimulus and 300 seeded random cycles | The search gives the shortest counterexample and, if it finishes within 150,000 machine cycles, a proof of equivalence over all input sequences |
| Waveform | A recorded waveform against expectations: a value at a time, a value held over an interval, an edge within a window | Tolerances given by the exercise |
| Measurement | A number the reader read off an instrument, with units and a tolerance | It says whether the digits are right and the power of ten wrong |
| Scenario | Set some switches, settle, and test what parts and nets look like (an LED that must light) | Any engine |

The checkers also report a **cost**: the number of gates, an estimate of the transistors in a static CMOS implementation, and the logic depth, which is what gate golf scores.

## The DCL toolchain

The language is in Appendix F; this is the machinery. Source: `src/lib/hdl/`.

- **Front end.** The lexer produces tokens and comments and decides where statements end. The parser has error recovery (it skips to the end of the statement, so one run reports every independent mistake). The checker works on module *specialisations*: a module with its generic arguments bound, so that every width is a plain number and the width rules are exact. It unrolls `for` loops, evaluates constants, inlines functions, and types every expression bidirectionally (expected types flow into literals). It reports 57 kinds of diagnostic (Appendix F lists them).
- **Elaboration to RTL.** Every checked expression becomes at most one **RTL cell**, tagged with the source span of the expression and its hierarchical path. RTL is plain data (safe to send to a worker; constants are BigInts), so the same cells serve the simulator, the lowering, and the FPGA flow. Arrays stay lists of element signals, so a register array becomes a register per element and a dynamic index a parallel multiplexer.
- **RTL simulator.** The design is flattened and turned into **JavaScript source, compiled once with `new Function`** (the approach of Verilator), which the browser’s engine then compiles to machine code. Signals of up to 32 bits are numbers in a `Uint32Array`; wider signals are arrays of 32-bit words, least significant first. Combinational logic is evaluated in topological order (the checker guarantees there are no loops). Registers and memories update in two phases at a clock edge: every next value is sampled first, then all are committed, so they change together. An **interpreted** mode on BigInt values gives the same semantics where `new Function` is not allowed (a strict content-security policy), and is what the compiled code is tested against.
- **Test runner.** Runs the `test` blocks on the RTL simulator, with seeded random values, and reports a failed `expect` with the values it read and a waveform.
- **Lowering to gates.** Each RTL cell becomes elements of the course’s own netlist: gates from the digital catalog, `mux` blocks, `dff`s and `ram` blocks (adders can be single `adder` blocks instead of gates). The result is a `FlatNetlist` that runs on the digital engine and agrees with the RTL simulator bit for bit (a test checks random designs and the reference designs). Every element records its RTL cell, path and source span, which is what the hover in the editor reads. Memories larger than 262,144 bits are refused as too large to draw or simulate as gates.
- **Editor.** CodeMirror, with diagnostics, completions, hover (type, doc comment, hardware cost) and formatting. The analysis runs in a worker. Highlighting uses the compiler’s own lexer, at build time in the Markdown compiler and live in the editor, so there is one grammar.

## Programmable-logic flows

Source: `src/lib/pld/` for the algorithms and `src/lib/studio/` for the Device Studio built on them.

### Two-level logic: PROM, PLA and GAL22V10

Truth tables and equations are parsed into cubes and covers (`twolevel/`). Minimisation is exact **Quine–McCluskey** with Petrick’s method for functions of few variables (the fitters use it up to 8 variables the function depends on) and an **Espresso**-style heuristic (expand, irredundant, reduce, last gasp, on the unate recursive paradigm) beyond. A PLA is minimised with product terms shared across outputs; a GAL or CPLD output is minimised in both polarities, since a macrocell can invert. The **GAL22V10 fitter** assigns pins (keeping those the design gives, largest demand first, inputs on the dedicated pins), checks the product-term capacity of each macrocell, and programs the fuses; it writes a **JEDEC file**:cite[jedec-jesd3] whose layout is that of galette.:cite[galette] A test compares the fitter’s JEDEC files byte for byte with galette’s own for galette’s test cases; it is skipped unless a built galette checkout is available (`GALETTE_DIR`). A finite-state machine (states, transitions with guards, Moore and Mealy outputs) can be turned into a GAL design, with the state bits as registered outputs stored so that the power-up state is the reset state. The devices are then simulated **from the fuses alone**.

The inputs are equations or truth tables, with `# @pragma` comment lines for pins, polarity, initial values and don’t cares. **DCL does not lower to these devices in this version**: the PROM, PLA, GAL and CPLD studios take equations, and only the FPGA flow takes DCL (through the RTL) or a gate netlist.

### The vCPLD-32

The fitter minimises every output in both polarities (and, for registered outputs, in a T flip-flop form, whose input is *f* XOR *Q*, so that a counter bit toggles on one term), then **partitions** the outputs into the four function blocks: a greedy construction (largest support first, into the block that already reads most of its signals) followed by Kernighan–Lin-style refinement of moves and swaps,:cite[kernighan1970] with a cost that counts each block’s distinct inputs, half a point for each borrowed term, and heavy penalties for a block that reads more than 24 signals or cannot be allocated. **Term allocation** in a block is a transportation problem on a path, solved by dynamic programming over the flow between neighbouring macrocells, so that as few terms as possible are borrowed (each adds delay, and the lender loses it). Timing is a table of constants (Appendix G): it does not depend on where the fitter put the logic. The **JTAG** model is a 16-state TAP controller and the programming protocol of Appendix G, driven by a host that records every clock.

### The FPGA flow

Everything runs in plain TypeScript, with typed arrays in the placer and the router, and each stage records a trace that the Studio replays. The stages, and what is real about them:

1. **Front end.** From DCL’s RTL (every cell lowered to an **and-inverter graph**, adders as full adders so the carry logic can be found; registers become flip-flops, folding a hold-value multiplexer into the clock enable and a constant-selecting one into set/reset; memories become block RAM) or from a gate-level netlist. Clocks must be input ports: a derived clock is refused.
2. **Synthesis.** The graph is structurally hashed and constant-propagated as it is built; a sweep removes what no output needs and two passes of **balancing** turn chains of ANDs into trees, lowering the depth the mapper starts from.
3. **Carry chains** are found by *function* on 3-input cuts (a majority node with its parity sibling), not by structure, and become a column of cells with the dedicated carry wire.
4. **LUT mapping** by cut enumeration with priority cuts (at most 4 leaves), a depth-optimal labelling in the manner of FlowMap:cite[cong1994] (found by the cut enumeration itself rather than by a max-flow computation), and area recovery by two passes of area flow and two of exact local area.
5. **Packing** groups cells into tiles that share a clock, a clock enable and a set/reset (8 cells a tile); a carry chain is a rigid vertical macro.
6. **Placement** by **:term[simulated annealing]{id=simulated-annealing}** in the manner of VPR:cite[betz1997] (bounding-box wirelength with the crossing-count correction, plus a timing term weighted by criticality; a schedule that follows the acceptance rate; a range limiter; seeded, so a run is reproducible).
7. **Routing** by **:term[PathFinder]{id=pathfinder}**:cite[mcmurchie1995] on the routing-resource graph: negotiated congestion, with node cost = base × history × present, an A* search per net, and re-routing only nets that touch an overused node; the four inputs of an ordinary LUT are interchangeable, so a connection may end at any of them.
8. **:term[Static timing]{id=static-timing-analysis}** with the published delay model (Appendix G), and the critical path and *f*max.
9. **:term[Bitstream]{id=bitstream}** generation, and its decoding back to a netlist of LUTs, flip-flops, carry cells, routing multiplexers, pads and block RAMs, which the digital engine runs on the virtual board: the device that runs is what the bits say, not what the source said.

**Not in this version.** The plan for the course includes writing an interchange netlist for Yosys and nextpnr, so that a design could go to a real iCE40 board. That export does not exist yet: the toolchain here targets the virtual devices only.

## What the simulator does not model

Every model is a choice about what to leave out. These are the choices, by engine, so that you know when to trust a figure and when a real part will disagree.

**Everywhere**

- **Temperature.** Nothing depends on it: the thermal voltage is fixed at 300 K, and resistors have no temperature coefficient.
- **Manufacturing variation.** Every part of a type is identical (except where a parameter is set by hand); there is no tolerance, no mismatch, no ageing.
- **Power supply.** A 5 V logic supply is assumed; supply noise, droop and decoupling do not exist.
- **Electromagnetics.** No crosstalk, no inductance of wires, no transmission lines, no radiation.

**Analog**

- **No small-signal or frequency-domain analysis.** Only DC and transient. The behaviour of an amplifier’s gain is found by running it, not by a Bode plot.
- **Ideal wires.** Zero resistance and zero capacitance, except in the dial’s parasitics.
- **Diodes** have no reverse breakdown, no junction capacitance, no reverse recovery. **Bipolar transistors** have no Early effect, no series resistances, no capacitances. **MOSFETs** are level 1: no body effect, no short-channel effects, no subthreshold conduction, and no gate capacitance in the model itself (the dial adds it outside).
- **Inductors** do not saturate; **capacitors** have no equivalent series resistance and no leakage beyond `GMIN`.
- **Logic gates** in the analog engine are behavioural (a smooth threshold and a lag), not transistors, unless the dial expands them.
- **Noise** is not modelled anywhere: a signal is exactly what the equations say.
- **The size limit.** A dense matrix: around a hundred unknowns is the design point, and a larger circuit runs slower than real time (the engine says so).

**Digital**

- No voltage, no thresholds, no analog behaviour of metastability beyond a random time to X and a random resolution.
- Delays are fixed numbers per gate: none depends on load, wiring or input slew.
- Set-up and hold are checked in flip-flops, not in blocks (registers, counters, RAM).
- X handling is the standard three-valued logic, which is pessimistic in reconvergent fanout: `A AND (NOT A)` is X when A is X, though a real circuit’s output is 0.
- Tri-state buses have no strengths: two enabled drivers that agree are fine, and two that disagree give X.

**Switch level**

- No voltages and no resistances; only strengths. Real delays do not exist, and the unit delay is the same for every stage.
- A pass transistor passes a 1 without the threshold drop.
- Dynamic nodes hold their charge for ever; there is no leakage.

**The bench and the checkers**

- A circuit is checked as a black box with named toggles and indicators; anything not connected through them (an internal net) is not checked.
- The combinational checker is exhaustive only up to 16 inputs, and the sequential one proves equivalence only for small state spaces (at most 6 inputs and 150,000 machine cycles of search); beyond that they sample, and a pass is evidence, not proof.

**DCL and the toolchain**

- DCL has no asynchronous logic, latches, gated clocks, tri-states inside a design, delays outside tests, unbounded loops or floating point, on purpose (Appendix F).
- The RTL simulator is zero-delay and cycle-based: it knows nothing about glitches, set-up or hold. Lowering to gates and running on the digital engine adds delays, but the delays are those of the abstract gates, not of any real technology.
- **FPGA:** the clock is ideal (no skew, no jitter), there is no power analysis, and the delay model is a published table, not extracted from layout. A design that passes timing analysis here says nothing about a real FPGA.
- **The DCL, GAL and CPLD paths are separate.** DCL does not reach the PROM, PLA, GAL or CPLD; those take equations.
- **No export to a real toolchain** (Yosys, nextpnr): a design made here cannot be sent to a real board by this toolchain.

## Where to look

| To learn about | Read |
|---|---|
| The circuit model | `src/lib/sim/netlist/types.ts`, `connect.ts`, `flatten.ts`, `catalog/` |
| The engine contract | `src/lib/sim/engine.ts` |
| Digital simulation | `src/lib/sim/digital/engine.ts` (the header comment is the specification), `queue.ts`, `models/` |
| Switch-level simulation | `src/lib/sim/switch/engine.ts`, `solve.ts` |
| Analog simulation | `src/lib/sim/analog/engine.ts`, `device.ts` (stamping helpers, limiting), `lu.ts`, `models/` |
| The dial | `src/lib/sim/expand/`, `src/lib/bench/dial.ts` |
| The bench | `src/lib/bench/` (`editor/`, `instruments/`, `share.ts`, `engines.ts`) |
| Parts and checkers | `src/lib/partsbin/`, `src/lib/sim/check/` |
| DCL | `src/lib/hdl/` (`lexer.ts`, `parser.ts`, `check.ts`, `elaborate.ts`, `rtl.ts`, `rtlsim.ts`, `lower/`, `testbench.ts`, `std/`) |
| Two-level logic and the GAL | `src/lib/pld/twolevel/`, `src/lib/pld/devices/gal22v10*.ts` |
| The CPLD | `src/lib/pld/devices/vcpld32*.ts`, `src/lib/pld/cpld/` |
| The FPGA | `src/lib/pld/devices/vfpga*.ts`, `src/lib/pld/fpga/` |
| The Device Studio | `src/lib/studio/` |

`docs/PLAN.md` says what was planned, and this appendix says what exists. Where they differ (the interchange netlist for Yosys and nextpnr is the one this appendix knows of), this appendix is right about the code.
