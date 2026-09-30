# Course plan — *Digital Circuits*

The living plan for the course: agreed decisions, curriculum, simulator and component inventory, and
milestones. Update it when decisions change or chapters land. The course's HDL is specified in
[HDL.md](HDL.md).

The course starts from a battery and a switch. It builds a working 8-bit CPU from parts the reader has
built and verified themselves, and then puts that CPU on a programmable chip. The chip is first a virtual
one, whose every fuse, lookup table and routing switch can be inspected, and optionally a real FPGA.
Everything on screen runs on a simulator and a toolchain written for the course.

## Decisions (agreed 2026-09-29)

| Topic | Decision | Notes |
|---|---|---|
| Title | **Digital Circuits** | Slug `digital-circuits`, published at `/digital-circuits/`. |
| Reader | **Software engineers** with no electronics background | Algebra and exponentials in the main text; calculus and linear algebra only in optional *Deeper* boxes and in *Under the hood*. |
| Aim | Understand how a computer works from electrons up, **build a working CPU** and **put it on a programmable chip** | Part V assembles a CPU from the reader's own parts bin. Part VI maps it, and an RV32I core, onto a virtual FPGA. |
| Analog scope | As much analog as digital needs, and no more | Ohm, Kirchhoff, RC timing, inductors only for relays, diodes, transistors as switches and as amplifiers (gain). No filters, op-amp circuits, AC power or radio. |
| Simulation | Our own engine in TypeScript, at three levels (analog, switch, logic) over one netlist model | No third-party simulator. See *The simulator*. |
| Programmable logic | **Part VI**: ROMs and PLAs, PALs and GALs, CPLDs, FPGAs, the HDL and the toolchain. Each has **virtual devices that are programmed interactively** | The Device Studio shows the logic view and the chip view side by side, linked element by element. Devices are simulated from their configuration bits. |
| HDL | **DCL** (working name): a course-specific HDL with modern syntax, no semicolons and strict typing | Spec in [HDL.md](HDL.md). It replaces Verilog everywhere in the course. Verilog and VHDL appear only in history cards and one *In industry* callout. |
| Compiler and toolchain | **TypeScript**, like the rest of the course | Rust/WASM was considered and rejected (HDL.md, *Implementation language*). The hot kernels can move to Rust/WASM if the M7 benchmark requires it. |
| Real hardware | Optional **Build it for real** track: a lab per chapter, a kit list and breadboard layouts | Low voltage only (5 V USB supply or 9 V battery). Part VI adds a GAL programmed with a universal programmer and an iCE40 board with the open toolchain. The CPUs run on the FPGA, not on breadboards. |
| Site | SvelteKit 2 + Svelte 5, `adapter-static`, the Markdown-with-directives compiler copied from Proofcraft | Single npm package (not a pnpm workspace). Output in `dist/`, base path from `BASE_PATH`. |
| TypeScript version | **TS 6**, as in Proofcraft and Language Models | `svelte-check` needs the TypeScript JS API, which TS 7 does not have. |
| Editor | CodeMirror 6 | DCL, Octet assembly and RV32I assembly. |
| Rendering | SVG for schematics; Canvas 2D for waveforms and instruments; WebGL2 for the voltage landscape, the CPU-scale view and large chip views | Synthesised netlists are laid out with ELK (elkjs, lazy-loaded in a worker). No three.js or charting libraries. Respect `prefers-reduced-motion`. |
| Sound | Web Audio: relays click, oscillators and counters can be heard | **Off by default**, one global toggle remembered in `localStorage`. |
| History images | US patent drawings (public domain); portraits only when clearly public domain, with attribution | Same attribution rules as astrophysics' `Portrait`. Die photographs only under a clear licence (e.g. CC BY). |
| Progress | `localStorage`: exercises, parts bin, bench circuits, DCL files; export/import as JSON | |
| Design | **"The Bench"**: a lab-bench identity distinct from SSA to Silicon's *Datasheet* | See *Look and feel*. Shares the collection's `theme` key. |
| Language | British English | |

## Through-lines

1. **The parts bin.** When the reader builds a part and it passes its checker (an inverter, a full adder, a
   flip-flop, a counter), the part goes into their parts bin as a black box with fixed pins.
   - Later chapters build from the bin. The CPU in Part V is made entirely of the reader's own parts, and
     Part VI puts that CPU on a programmable chip.
   - Every part also has a reference implementation. A *use my parts* toggle switches between the two, so
     skipping an exercise never blocks a later chapter.
   - This is the Elements workshop's unlocking, applied to hardware.
2. **Gain makes digital possible.** Digital works because amplifying stages restore degraded signals. The
   course builds up to this in Chapter 8 (the noise gauntlet). Every part then comes back to the analog
   layer underneath the logic: noise margins, delay, glitches, metastability, power, leaking DRAM.
3. **The abstraction dial.** Where the circuit is small enough, every live figure can be switched between:
   - **Logic:** gates and 0/1;
   - **Switches:** transistors as switches;
   - **Analog:** voltages over time.

   It plays the part that the depth slider plays in astrophysics. In Part VI the dial reaches inside the
   chip: a LUT opens down to its memory cells and multiplexer tree.
4. **Two views of one design.** From Part VI onwards, every design is shown twice, side by side and linked
   element by element:
   - the **logic view**: what you meant;
   - the **chip view**: what the device does.
5. **Programmer's view.** Short callouts map hardware ideas to software ones:
   - combinational logic is a pure function;
   - a register is a variable;
   - the clock is the tick of a loop;
   - metastability is a race condition;
   - a `match` is a parallel multiplexer, while an `if` chain is a priority chain;
   - an HDL describes wiring, not a sequence of steps.

## Chapter template

Hook (an everyday question or a history card) → 🔮 predict → explore (the flagship interactive) →
explain (hoverable equations, draggable numbers) → 🔬 lab on the bench or in the Studio →
🧑‍💻 programmer's view → ⚙️ under the hood (how the simulator or toolchain does it, with a code excerpt) →
🧩 build (adds a part to the bin) → 🐞 debug the board → 🔧 build it for real → what's next → further reading.

Standards per chapter:

- 2,500–5,000 words.
- One flagship interactive, plus 2–4 smaller figures.
- At least one *predict* question, placed where intuition is usually wrong.
- At least one lab, one history card, and one build, debug or device exercise.
- An *Under the hood* box wherever the simulator or toolchain does something non-trivial.
- A closing section that leads into the next chapter.

## Curriculum

### Prologue

| # | Chapter | Key ideas | Flagship interactive | Adds to the parts bin |
|---|---|---|---|---|
| 0 | What happens when you press a key? | The layers from keypress to silicon; the digital abstraction; course map; how to use the bench | Scroll-driven zoom: keyboard → board → chip → die → gate → transistor → silicon lattice | — |

### Part I — Electricity, just enough

| # | Chapter | Key ideas | Flagship interactive | Adds to the parts bin |
|---|---|---|---|---|
| 1 | Charge, voltage and current | Charge; current as flow; voltage as energy per charge; conventional vs electron current; drift speed vs signal speed; the water analogy and where it fails | Electrons in a wire: slow drift, fast field. 🔮 *How fast do electrons move?* (slower than a snail) | — |
| 2 | Resistance and Ohm's law | Ohm's law; power; series and parallel; dividers; Kirchhoff's laws; circuits as graphs; ratings | **Voltage landscape**: 3D view with potential as altitude, batteries as lifts, resistors as slopes. Exceed a rating and the part releases magic smoke | — |
| 3 | Interlude: the bench | Multimeter (V, I, Ω; how meters load a circuit); bench supply with current limit; oscilloscope (timebase, trigger, cursors); function generator; logic probe; ground | Guided bench tour: measure a divider, then find a fault | — |
| 4 | Capacitors and time | Stored charge; RC charging; τ; exponentials; every wire is a capacitor, hence delay; switch bounce and RC debouncing | RC lab: drag R and C and read τ with the scope cursors | — |
| 5 | Electromagnets and relays | Magnetism from current; inductance (it resists changes in current); relay anatomy; the flyback spike and the diode that absorbs it; telegraph repeaters | A long telegraph line fades the signal; a relay repeater restores it | relay |

### Part II — Switches that compute

| # | Chapter | Key ideas | Flagship interactive | Adds to the parts bin |
|---|---|---|---|---|
| 6 | Shannon's switches | Switches as logic: series = AND, parallel = OR, the two-way staircase switch = XOR; relay NOT; truth tables; a relay adder | Stibitz's Model K rebuilt, clicking; the staircase light | relay AND, OR, NOT (bench only) |
| 7 | Semiconductors, diodes and LEDs | Conductors, insulators, semiconductors; doping; the pn junction and depletion region; I–V curve; LEDs and bandgap; current-limiting resistors; diode logic and why it decays | Animated pn junction under bias; LED colour vs bandgap; a chain of diode gates losing the signal | — |
| 8 | The transistor | BJT: a small base current controls a large collector current. MOSFET: the gate voltage controls the channel. Cut-off, saturation, the active region; gain; regeneration; the RTL inverter | **Noise gauntlet**: a noisy signal through 20 stages, with and without gain. *Why digital works* | NOT (RTL) |
| 9 | CMOS | nMOS and pMOS; the CMOS inverter, NAND and NOR; pull-up/pull-down duality; complex gates; transmission gates; near-zero static power | **Gate compiler**: type `¬(A·(B+C))`, see the transistor networks drawn and conducting. First appearance of the abstraction dial | NOT, NAND, NOR |
| 10 | Real gates are analog | Transfer curve; logic levels and noise margins; fan-out; propagation delay and rise time; dynamic power CV²f and leakage; Dennard scaling and its end; open drain and pull-ups; tri-state and bus contention; logic families (RTL, DTL, TTL, ECL, CMOS) | Inverter transfer curve with draggable noise; fan-out slowing an edge; bus contention (smoke) | tri-state buffer, open-drain buffer |

### Part III — Logic

| # | Chapter | Key ideas | Flagship interactive | Adds to the parts bin |
|---|---|---|---|---|
| 11 | Boolean algebra | Laws and duality; De Morgan; sums of products and products of sums; canonical forms; NAND and NOR universality; truth table → circuit | Animated De Morgan bubble pushing; truth table → circuit synthesiser | AND, OR, XOR, XNOR |
| 12 | Simplifying logic | Karnaugh maps (2–4 variables); don't-cares; Quine–McCluskey; multi-level logic, and why real tools don't use K-maps | K-map playground (draw groups, the circuit updates live); **gate golf** | — |
| 13 | Building blocks | Multiplexers, demultiplexers, decoders, encoders, priority encoders, comparators, parity; the 7-segment decoder; a multiplexer is a lookup table, which Part VI builds on | Live 7-segment decoder; LUT explorer | MUX2/4/8, DEC2→4, DEC3→8, 7-segment decoder, comparator |
| 14 | Numbers and arithmetic | Binary and hex; unsigned and signed; two's complement; overflow; half and full adders; ripple carry vs carry lookahead; subtraction; shifters; shift-and-add multiplication | Two's-complement wheel; ripple carry in slow motion racing a lookahead adder | half adder, full adder, 8-bit adder/subtractor, shifter |
| 15 | Timing | Propagation and contamination delay; critical paths; static hazards and glitches; inertial vs transport delay | Glitch hunt on a timing diagram; critical-path highlighter | — |

### Part IV — Memory and time

| # | Chapter | Key ideas | Flagship interactive | Adds to the parts bin |
|---|---|---|---|---|
| 16 | Feedback | Loops of inverters: odd rings oscillate, even rings remember; bistability; the SR latch; metastability | Ring oscillator you can hear; the latch as a **ball in a double well**; metastability as the ball balanced on the hump | SR latch |
| 17 | The clock | D latch; edge-triggered D flip-flop (master–slave); setup, hold, clock-to-Q; synchronous design; maximum clock frequency from the critical path; crystals and the 555; synchronisers; debouncing | Violate setup/hold and watch metastability; raise the clock until the circuit fails | D latch, D flip-flop, 555 (built from comparators and an SR latch) |
| 18 | Registers and counters | Registers with load enable; ripple vs synchronous counters; frequency division; shift registers (serial-in/parallel-out and back); LFSRs | Hear a counter divide: each bit sounds an octave lower; LFSR sequence wheel | register, counter (the future program counter), shift register, LFSR |
| 19 | State machines | States and transitions; Moore vs Mealy; state encoding (binary, one-hot, Gray); synthesis; the FSM as a `switch` in a loop | **FSM designer**: draw the diagram, get the circuit, drive a traffic light, a combination lock or a vending machine | (the reader's own FSMs) |
| 20 | Memory | Register files; SRAM (6T cell); DRAM (1T1C cell, leakage, refresh, sense amplifiers); ROM; flash; address decoding; memory arrays; core and core rope | DRAM cells leaking in real time; an SRAM cell at transistor level; a small array addressed through a decoder | RAM (256 × 8), ROM |

### Part V — Build a computer

| # | Chapter | Key ideas | Flagship interactive | Adds to the parts bin |
|---|---|---|---|---|
| 21 | The datapath | The ALU and its flags; the register file; a shared bus with tri-state drivers; what moves in one clock cycle | The datapath with every control line as a switch: **you are the control unit** | ALU, register file, bus |
| 22 | Control | Instruction sets and encodings; fetch–decode–execute; multi-cycle control as an FSM; hardwired vs microcoded control | Step one instruction cycle by cycle with the control lines lighting up; a microcode ROM editor | control unit (hardwired and microcoded) |
| 23 | Running programs | The Octet ISA; the assembler; loops, multiplication, Fibonacci, printing; the stack and calls; CPI and clock rate; comparison with RISC-V, leading to SSA to Silicon | **Octet**: write assembly, then clock the CPU from 1 Hz (every wire visible) to full speed | Octet |
| 24 | Talking to the world | Memory-mapped I/O; GPIO; LEDs and buttons; multiplexed displays and persistence of vision; PWM; DACs (R-2R); ADCs (successive approximation with a comparator); serial (UART, SPI, I²C) | PWM dimmer; the SAR ADC's binary search; a UART frame decoded on the logic analyser | I/O ports, PWM generator, DAC, ADC |

### Part VI — Programmable logic

The devices are described in *Programmable logic* below, the HDL in [HDL.md](HDL.md).

| # | Chapter | Key ideas | Flagship interactive | Virtual devices |
|---|---|---|---|---|
| 25 | Logic you can program | Why programmable logic: boards of 7400 chips vs custom chips; a ROM is a truth table (diode matrices, fuse PROMs); the PLA's programmable AND and OR planes; the datasheet notation of crosses at crossings; programming technologies (fuse, antifuse, EPROM, EEPROM and flash, SRAM) and what each means for erasing, power-up and radiation | **vPLA** programmed by clicking fuses, each blown by its programming pulse; ROM vs PLA as the number of inputs grows | vPROM, vPLA |
| 26 | PALs and GALs | The PAL: programmable AND, fixed OR; the output macrocell (polarity, register, tri-state output, feedback); equations as short DCL modules; product-term limits and fitting, with the minimisation of Chapter 12; the GAL's erasable cells and configurable macrocells; JEDEC fuse files | **GAL22V10**: write equations or import an FSM from Chapter 19, and watch the fuse map fill in; hover a fuse to see its input and product term; download the JEDEC file | GAL22V10 (faithful model) |
| 27 | CPLDs | PAL-like function blocks joined by a global interconnect matrix; product-term allocators and expanders; I/O blocks; non-volatile, instant-on, predictable timing; partitioning and fitting; JTAG, in-system programming and boundary scan; why today's "CPLDs" are often small flash FPGAs | **vCPLD-32** in the Device Studio: the design hierarchy beside its function blocks and macrocells; the allocator borrowing product terms; the JTAG TAP controller (a 16-state FSM) stepping through a programming sequence | vCPLD-32 |
| 28 | Inside an FPGA | Freeman's bet: spend transistors on programmability; the LUT as a 2ᵏ-bit memory and a multiplexer tree; logic cells (LUT, flip-flop, carry); tiles; routing channels, wire segments, switch and connection boxes; I/O; clock networks and PLLs; configuration memory, frames and loading at power-up; antifuse and flash FPGAs; hard blocks (block RAM, DSP, SERDES, processors); why LUTs grew from 4 to 6 inputs; configuration upsets and scrubbing | **vFPGA-S by hand**: fill LUT truth tables, set routing switches, clock it; zoom from the die to a tile, a logic cell, a LUT's bits and its transistors; a cosmic ray flips one configuration bit | vFPGA-S |
| 29 | Describing hardware | Why HDLs; DCL: modules and ports, types and widths, `let`, `reg` and `next`, `if` and `match`, instances, generics, `for`, memories, enums for state machines, tests; code describes a circuit, not steps; what each construct becomes in hardware; an *In industry* callout on Verilog and VHDL | **Inference viewer**: edit DCL and watch the netlist update; hover a line to light its gates, click a gate to find its line; type errors explained in hardware terms | — (RTL simulator) |
| 30 | From netlist to bitstream | The toolchain stage by stage: elaboration; synthesis to an and-inverter graph; optimisation; technology mapping to LUTs (cuts, depth vs area); carry chains and block RAM; packing; placement (simulated annealing); routing (PathFinder's negotiated congestion); static timing analysis and fmax; bitstream generation; the same design fitted to a GAL, a CPLD and an FPGA | **Toolchain replay** on vFPGA-M: scrub through every stage, watch the annealer cool and the router settle congestion, see the critical path lit in both views; **beat the placer** | vFPGA-M |
| 31 | CPUs on a chip | Octet from the parts bin onto vFPGA-M; an RV32I core in DCL onto vFPGA-L; resource and timing reports; programs running on the configured fabric through the virtual board; the same designs on a real iCE40 board; FPGAs vs ASICs and gate arrays; where FPGAs are used | **Device Studio** at full scale: CPU → ALU → adder → full adder → gates beside the placed and routed chip, both animated while a program runs | vFPGA-M, vFPGA-L |

### Epilogue and appendices

| # | Chapter | Key ideas | Flagship interactive |
|---|---|---|---|
| 32 | From breadboard to billions | Integrated circuits; photolithography; Moore's law; the ASIC flow compared with the FPGA flow; what to build next | Moore's law plot (transistor counts, log scale); photolithography layer by layer |

Appendices:

- **A.** Reference: schematic symbols, units and prefixes, resistor colour code, number systems.
- **B.** Maths toolbox: exponentials and *e*, the RC differential equation, systems of linear equations.
- **C.** The simulator and toolchain: what they model and what they do not (in the spirit of Proofcraft's
  appendix B).
- **D.** Build it for real: kit list, safety, breadboard basics, and each chapter's lab.
- **E.** Octet reference card: ISA, encoding, memory map.
- **F.** DCL reference: syntax, types, built-ins, standard library.
- **G.** Virtual device datasheets: vPROM, vPLA, GAL22V10, vCPLD-32, vFPGA and the virtual board, in the
  style of the originals.
- **H.** Glossary, timeline (the history-card deck) and bibliography.

## Under the hood

The reader is a programmer, so the simulator and the toolchain are part of the subject. Each *Under the
hood* box explains the algorithm behind the chapter's figures, with an excerpt of the real code.

| Ch | Topic |
|---|---|
| 2 | Nodal analysis: a circuit as a linear system; stamping; LU decomposition |
| 4 | Transient analysis: companion models; backward Euler vs trapezoidal (and its ringing); time-step control |
| 5 | Modelling the inductor and the relay (coil, contacts, hysteresis, bounce) |
| 7 | Newton–Raphson on non-linear devices; junction voltage limiting; when convergence fails |
| 9 | Switch-level simulation: signal strengths, charge storage and sharing |
| 11 | Truth table → sum of products → gate netlist |
| 12 | Quine–McCluskey and Petrick's method; how gate golf scores a circuit |
| 15 | Event-driven simulation: the event queue, inertial delay, delta cycles |
| 17 | How the simulator models metastability (randomised resolution time) |
| 19 | FSM synthesis and state encoding; how exercises check an FSM (product-machine equivalence) |
| 20 | Behavioural vs gate-level memory: when and how the simulator switches models |
| 22–23 | The two-pass assembler; differential testing of the gate-level CPU against its ISA interpreter |
| 25 | How a fuse map encodes a PLA; programming and verifying fuses |
| 26 | Espresso-style two-level minimisation; fitting product terms to macrocells; the JEDEC format and its checksums |
| 27 | Partitioning logic across function blocks; product-term allocation; the JTAG state machine |
| 28 | The fabric simulator: decoding configuration bits into a netlist |
| 29 | The DCL compiler: parsing without semicolons, checking widths, elaboration, the code the RTL simulator generates |
| 30 | And-inverter graphs; cut enumeration and depth-optimal LUT mapping (FlowMap); simulated annealing; PathFinder; static timing analysis |
| 31 | Keeping the hierarchy through synthesis for cross-probing; comparing the results with Yosys and nextpnr |

## The simulator

One netlist model with three engines. The abstraction dial *expands* a netlist from one level to the next:
each gate becomes its CMOS transistor network (switch level), and each transistor becomes a device model
(analog). The dial is offered only where the expanded circuit stays within the analog engine's size budget.

### Netlist (`src/lib/sim/netlist`)

- **Model:** components with typed pins and parameters; wires; nets derived from connectivity; hierarchical
  subcircuits (the parts bin); flattening; a versioned JSON format.
- **Sources:**
  - circuits drawn on the bench are exported as JSON into each chapter's `circuits/` directory, with an
    *export for chapter* command in development builds;
  - DCL designs lower to the same model.

  Tests load every committed circuit and design.

### Analog engine (`src/lib/sim/analog`)

- **Solver:** modified nodal analysis with dense LU and partial pivoting. Sparse LU only if profiling asks
  for it; the target is at most about 100 nodes.
- **Transient analysis:** companion models, with backward Euler by default and trapezoidal as an option
  (Chapter 4 shows the difference). Adaptive time steps, with breakpoints at source edges.
- **Non-linear devices:** Newton–Raphson, with SPICE-style junction voltage limiting.
- **Devices:**
  - resistor, capacitor, inductor, potentiometer, lamp;
  - DC, pulse, square and sine sources; bench supply with a current limit;
  - switch, pushbutton (with a bounce model), relay (coil plus contacts with pull-in/drop-out hysteresis
    and switching time);
  - diode (Shockley with series resistance), LED (per-colour parameters, emits light in the view);
  - BJT (Ebers–Moll transport model), MOSFET (level 1, Shichman–Hodges with λ);
  - comparator (behavioural, for the 555 and the ADC).
- **Ratings:** each part has a maximum power, current or voltage. Exceeding it for long enough makes the
  part fail:
  - an animation plays (smoke);
  - a note explains why it failed;
  - the part becomes an open or a short circuit, as appropriate.

### Switch-level engine (`src/lib/sim/switch`)

- Bryant-style (MOSSIM) model: transistors are bidirectional switches; node values are 0, 1 and X;
  strengths are supply > driven > charged.
- Handles charge storage and charge sharing (dynamic nodes, DRAM, pass transistors).

### Digital engine (`src/lib/sim/digital`)

- **Values and events:** event-driven, with a time-wheel event queue. Four values (0, 1, X, Z), with a
  resolution function for shared nets: two drivers disagreeing give X, drawn as contention.
- **Delays:** per gate, inertial by default, transport as an option (Chapter 15). Deterministic.
- **Output:** probes and trace buffers feed timing diagrams and the logic analyser.
- **Where it runs:** on the main thread for small widgets, in a Web Worker for the CPUs.
- **Turbo mode:** for the CPUs, an ISA-level mode uses the reference interpreter for MHz speeds. The view
  states clearly when it has switched from gate-level to instruction-level simulation.

### Checkers (`src/lib/sim/check`)

- **Combinational:** exhaustive over all inputs, up to 16 inputs (65,536 vectors).
- **Sequential:**
  - equivalence with the reference machine, by breadth-first search over the product machine, for small
    state spaces;
  - directed and random stimulus beyond that.
- **Timing:** the measured waveform is compared with the specified one, within tolerances.
- **Analog labs:** the measured value must fall within a tolerance.
- **DCL exercises:** hidden `test` blocks, plus equivalence with the reference design (HDL.md, *Tests*).

### Performance targets (measured with benchmarks from M0, and in M7 for Part VI)

| What | Target |
|---|---|
| Analog engine | 60 fps with at least 10 simulation steps per frame, for circuits up to 50 nodes |
| Digital engine, gate-level Octet | At least 1 kHz simulated clock with every wire animated; at least 10 kHz headless |
| ISA-level turbo mode | At least 1 MHz |
| DCL | Re-checked within 50 ms of a keystroke, for a 500-line design |
| DCL RTL simulator, RV32I core | At least 1 MHz |
| Toolchain | Octet on vFPGA-M in under 10 s; RV32I on vFPGA-L in under 30 s (in a worker, on a recent laptop) |
| Fabric simulation | At least 1 kHz with both Studio views animated; at least 50 kHz headless |

## The bench

A full-screen sandbox (`#/bench`), also embedded in compact form in chapters.

- **Sharing:** every live figure has an **Open on the bench** button. Circuits can be shared by URL (JSON
  compressed with `CompressionStream`, then base64url). The current circuit is autosaved to `localStorage`.
- **Schematic editor:** snap-to-grid placement, orthogonal wire routing, rotate and flip, labels,
  parts-bin blocks and DCL modules as parts, undo/redo, keyboard operation.
- **Views:**
  - current as moving dots whose speed follows the current (Falstad's convention);
  - voltage as colour;
  - logic values in the signal colours;
  - hovering a node shows its voltage; hovering a part shows its current and power.
- **Instruments:**
  - multimeter (V, A, Ω, continuity);
  - bench supply with a current limit;
  - function generator;
  - 2–4 channel oscilloscope (timebase, trigger, cursors, phosphor persistence);
  - 8–16 channel logic analyser with UART, SPI and I²C decoders (Chapter 24);
  - logic probe.
- **Stretch goal:** an interactive breadboard view. Until then, the *Build it for real* labs use static
  breadboard illustrations.

## Programmable logic

### Virtual devices (`src/lib/pld/devices`)

| Device | Modelled on | Resources | Programmed by | Configuration |
|---|---|---|---|---|
| vPROM | Bipolar fuse PROMs | About 32 × 8 bits | Clicking fuses; truth tables | Fuse map |
| vPLA | The Signetics 82S100 FPLA, scaled down | About 8 inputs, 16 product terms, 8 outputs | Clicking fuses; DCL | Fuse map |
| GAL22V10 | Lattice GAL22V10 / Microchip ATF22V10 (**faithful model**) | 12 inputs (one doubles as the clock), 10 output macrocells, 5,892 fuses | DCL; FSMs from Chapter 19 | JEDEC file that programs a real ATF22V10 |
| vCPLD-32 | Xilinx XC9500 and Altera MAX 7000, scaled down | 4 function blocks × 8 macrocells, a global interconnect matrix, a JTAG port | DCL; schematics | Bitstream over virtual JTAG |
| vFPGA-S/M/L | Lattice iCE40 (logic cell and routing), scaled | Tiles of 8 logic cells, each a 4-input LUT with a flip-flop and carry logic; span-4 and span-12 wires; block RAM tiles (M and L); global clocks | By hand (S only); schematics; DCL | Configuration frames |

vFPGA sizes:

| Size | Tiles | Chosen so that |
|---|---|---|
| S | 2 × 2 | It is small enough to configure every bit by hand. |
| M | Sized in M7 | Octet uses 47 % of it (541 of 1,152 cells). |
| L | Sized in M7 | The RV32I core fits. |

- **Routing.** The vFPGA's routing is built from unidirectional, single-driver multiplexers, as in modern
  FPGAs. Every configuration therefore decodes to a legal netlist, and contention cannot happen. Chapter 28
  explains the older bidirectional pass-transistor routing and its hazards.
- **Simulated from the bits.** A configured device is simulated from its configuration bits, not from the
  source design, so what the reader sees running is what the bits say:
  - the bits decode into a netlist of LUTs, flip-flops, carry cells and routing multiplexers (or product
    terms and macrocells);
  - that netlist runs on the digital engine;
  - combinational loops created by configuring bits by hand are detected and shown.
- **Datasheets.** Each device has a datasheet in appendix G: pinout, block diagram, timing and
  configuration format.

### The virtual board

The vFPGA sits on a virtual development board with:

- a clock and a reset button;
- 4 buttons, 8 switches and 8 LEDs;
- four 7-segment digits and an 8 × 8 LED matrix;
- a text console (UART);
- a **fixed memory subsystem**: block RAM with an instruction port and a data port, plus memory-mapped
  peripherals (the devices above and a timer), wired to dedicated fabric pins.

A `top` DCL module binds to the board by port name and type, and a mismatch is a type error. Octet and the
RV32I core use the same board; only the memory map differs, and it is printed on the board.

### The Device Studio (`#/studio`)

A full-screen workspace for programmable devices, the bench's counterpart, also embedded in compact form in
chapters.

- **Source pane:** a bench schematic or parts-bin design, an FSM from the designer, or DCL in the editor.
- **Logic view:**
  - the design hierarchy as a tree and as a schematic, which the reader drills into: CPU → ALU → adder →
    full adder → gates;
  - designs drawn on the bench keep their drawings;
  - synthesised netlists are laid out with ELK's layered algorithm and orthogonal wires.
- **Chip view:**
  - the device floorplan: a fuse array, function blocks, or a grid of tiles;
  - semantic zoom: chip → tile or function block → logic cell or macrocell → LUT bits or fuses →
    transistors (through the abstraction dial);
  - Canvas 2D for small devices, WebGL2 for large ones.
- **Bits view:** the fuse map or the configuration frames, bit by bit, with the JEDEC export for the GAL.
- **Reports:** utilisation, timing (critical path, fmax), and the toolchain log.
- **Cross-probing:** one selection is shared by every pane. It can be a source line, a module, a gate, a
  LUT, a net or a bit:
  - a module colours its cells on the chip;
  - a LUT shows the gates it absorbed, its truth table and its configuration bits;
  - a net shows its route through the switch boxes;
  - a bit shows what it controls.

  Synthesis keeps each cell's hierarchical path and source span to make this possible.
- **Run:** stimulus comes from the virtual board. Signals animate in the logic view and the chip view at
  the same time.
- **Replay:** every toolchain stage records a trace, which a scrubber replays: placement moves, router
  iterations, the fitter's choices.
- **By hand:** on the small devices, fuses, LUT bits and routing switches can be set by clicking. The logic
  view is then recovered from the bits (bitstream → netlist → schematic). *What does this bitstream do?*
  becomes an exercise.

### The toolchain (`src/lib/pld`, `src/lib/hdl`)

- **DCL front end:** parser, type checker, elaboration, RTL simulator, and lowering to the bit-level
  netlist (see [HDL.md](HDL.md)).
- **Two-level logic (PROM, PLA, GAL):**
  - Espresso-style heuristic minimisation, with the exact Quine–McCluskey of Chapter 12 for small functions;
  - the PAL/GAL fitter: product-term limits, output polarity, macrocell modes;
  - a JEDEC writer and reader, with checksums.
- **CPLD:**
  - partitioning into function blocks;
  - product-term allocation;
  - interconnect-matrix routing;
  - the bitstream;
  - a JTAG TAP model and the programming sequence.
- **FPGA:**
  - synthesis from DCL's RTL to an and-inverter graph, with structural hashing and simple rewriting;
  - LUT mapping by cut enumeration (depth-optimal as in FlowMap, then area recovery);
  - carry-chain and block-RAM inference;
  - packing into logic tiles;
  - placement by simulated annealing (bounding-box wirelength plus a timing cost, with a VPR-style
    schedule);
  - routing by PathFinder on the routing-resource graph;
  - static timing analysis with a published delay model;
  - bitstream assembly and decoding (round-trip tested).
- **Where it runs:** everything runs in a Web Worker, and every stage emits a trace for replay.
- **Real hardware:** the compiler writes an interchange netlist for Yosys and nextpnr (Yosys JSON or
  structural Verilog, chosen in M7). The reader never has to write or read it.

## The course CPU: Octet (working name)

A sketch, to be finalised in M5. Constraints: small enough to follow wire by wire, big enough to run
interesting programs, and built only from parts-bin parts.

- **Memory:** 8-bit data and 8-bit addresses: 256 bytes of unified memory (von Neumann), so programs are
  visibly data.
- **Registers:** R0–R3, PC, SP, IR, and flags Z, C, N, V.
- **Encoding:** each instruction is one byte `oooo ddss` (4-bit opcode, destination and source registers),
  plus an optional second byte (an immediate or an address).
- **Instruction groups:**
  - `MOV`, `LDI`;
  - `LD`/`ST` (direct) and `LDR`/`STR` (register-indirect);
  - `ADD`, `SUB`, `AND`, `OR`, `XOR`, `CMP`;
  - a unary group (`SHL`, `SHR`, `NOT`, `INC`);
  - conditional jumps (`JMP`, `JZ`, `JNZ`, `JC`, `JNC`, `JN`);
  - `CALL`, `RET`, `PUSH`, `POP`;
  - `HLT`.
- **Microarchitecture:** multi-cycle, on a single shared bus with tri-state drivers (paying off
  Chapter 10). Hardwired control (the FSM technique of Chapter 19) and microcoded control (Chapter 22) are
  interchangeable, and both must pass the same differential tests.
- **Memory-mapped I/O** in the top of the address space:
  - an 8 × 8 LED matrix (8 bytes of frame buffer);
  - 8 LEDs, 8 switches and a pushbutton;
  - two hexadecimal 7-segment digits;
  - a text console;
  - a random-number port (the Chapter 18 LFSR);
  - PWM and DAC outputs and an ADC input (Chapter 24).
- **Clock:** manual step (per cycle or per instruction), and a speed slider from 0.5 Hz up to the
  simulator's limit.
- **Toolchain:** a two-pass assembler (labels, `.org`, `.byte`), a disassembler, and a reference ISA
  interpreter used for turbo mode and for differential testing.
- **Programs:**
  - blink and count; shift-and-add multiplication; Fibonacci; "HELLO, WORLD" on the console;
  - a reaction-time game (button and LEDs);
  - sorting 8 bytes;
  - challenges: Pong, or the Game of Life on the 8 × 8 matrix.
- **Links:** Chapter 23 compares Octet with RISC-V (RV32I) and points to SSA to Silicon and its pipeline
  simulator.
- **On a chip:** a reference Octet is also written in DCL. Chapter 31 maps both it and the reader's own
  Octet onto vFPGA-M. The reader's version is converted from the parts bin, keeping its hierarchy.

## The RV32I core (Chapter 31)

- **Design:** a multi-cycle RV32I core written in DCL. Fetch and execute alternate; the register file is
  made of flip-flops; decoding and arithmetic map to LUT4s. It starts from the sample written during
  planning, which becomes `content/designs/rv32i.dcl` (see HDL.md, *A first look*).
- **Board:** it connects to the virtual board's memory subsystem (instruction port, data port,
  memory-mapped peripherals). Illegal instructions, `ECALL` and `EBREAK` are reported on the board.
- **Programs:** a small RV32I assembler in the course, and the same demos as Octet, so the two CPUs can be
  compared on the same tasks (code size, cycles, LUTs, fmax).
- **Testing:**
  - differential tests against an RV32I reference interpreter, on random instruction streams and on every
    course program;
  - the RISC-V architectural tests (riscv-arch-test), in a validation script.
- **Link:** the chapter leads to SSA to Silicon, whose kiln backend targets the same ISA family (RV64; the
  chapter notes the differences).

## History cards

`:::history` blocks render as **flip cards**.

- **Front:** a US patent drawing or a public-domain portrait, the year, and a one-line hook.
- **Back:** the story, why it matters for this chapter, the sources, and where possible a **Run the
  original** button that loads a reconstruction into the simulator.
- **Collection:** the cards the reader has seen are collected in the timeline (appendix H), which is also
  plotted against transistor counts.

| Ch | Cards | Run the original |
|---|---|---|
| 1 | Galvani's frogs and Volta's pile (1800) | Cells stacked in series: voltages add |
| 2 | Ohm's *Die galvanische Kette* (1827), coldly received; Kirchhoff's laws (1845, as a student) | — |
| 3 | Braun's cathode-ray tube (1897), ancestor of the oscilloscope | — |
| 4 | The Leyden jar (1745–46) | — |
| 5 | Faraday's induction (1831); Henry's electromagnets and relay (1830s); Morse's telegraph (1844) | A telegraph line with and without a repeater |
| 6 | Peirce's letter to Marquand (1886) suggesting electrical switches for logic; Shannon's master's thesis (1937); Stibitz's Model K (1937); Zuse's Z3 (1941); the moth in the Harvard Mark II's relays (1947) | The Model K; a circuit from Shannon's thesis |
| 7 | Braun's crystal rectifier (1874); Fleming's valve (1904); Round's electroluminescence (1907); Ohl's pn junction (1940); Holonyak's red LED (1962); the blue LED (Akasaki, Amano, Nakamura, early 1990s) | — |
| 8 | De Forest's Audion (1906); Colossus (1944); the point-contact transistor (Bardeen and Brattain, December 1947) | An RTL inverter |
| 9 | Atalla and Kahng's MOSFET (1959); Wanlass's CMOS patent (1963) | Wanlass's complementary inverter, from the patent figure |
| 10 | The 7400 series (1960s); Dennard's scaling paper (1974) and the end of Dennard scaling | — |
| 11 | Boole's *Laws of Thought* (1854); De Morgan (1847); Sheffer's stroke (1913, see Proofcraft ch. 1); the Apollo Guidance Computer, whose logic was all 3-input NOR gates | The AGC's RTL NOR gate |
| 12 | Veitch (1952) and Karnaugh (1953); Quine (1952) and McCluskey (1956) | — |
| 13 | Nixie tubes (1955) | — |
| 14 | Leibniz's binary arithmetic (1703); Babbage's anticipating carriage (1830s) | A carry-lookahead adder |
| 15 | Grace Hopper's nanosecond: a 30 cm wire | — |
| 16 | Eccles and Jordan's trigger relay, the first flip-flop (1918); Chaney and Molnar on metastability (1973) | The Eccles–Jordan circuit, with transistors instead of triodes |
| 17 | Cady's quartz oscillator (1921); Marrison's quartz clock (1927); Camenzind's 555 (1971) | The 555 from its block diagram |
| 18 | Wynn-Williams's scale-of-two counter (1932); Golomb's *Shift Register Sequences* (1967), and GPS codes from LFSRs | A scale-of-two counter |
| 19 | Huffman (1954), Mealy (1955), Moore (1956); Turing's machine (1936), see Incompleteness and Computability | — |
| 20 | The Williams tube (1947); mercury delay lines (EDSAC, 1949); Wang and Forrester's core memory; the AGC's core rope; Dennard's one-transistor DRAM (patent 1968); the Intel 1103 (1970); Masuoka's flash (1980s) | Dennard's 1T1C cell; a small core-rope ROM |
| 21–23 | Von Neumann's *First Draft* (1945); Wilkes's microprogramming (1951); the Intel 4004 (Faggin, Hoff, Mazor, Shima, 1971); the MOS 6502 (1975) and the Visual 6502 project (2010) | Wilkes's diode-matrix control store |
| 24 | Baudot's telegraph code (1870s), and the baud; Reeves's pulse-code modulation (1937) | A UART frame |
| 25 | Wen Tsing Chow's PROM (1956); Frohman-Bentchkowsky's EPROM at Intel (1971); the first field-programmable logic arrays, Intersil's IM5200 and Signetics' 82S100 (1975) | A fuse PROM as a 7-segment decoder |
| 26 | Birkner, Chua and Chan's PAL at Monolithic Memories (1978) and PALASM; Lattice's GAL (1985) | A PAL traffic-light controller |
| 27 | Altera's EP300 (1984), erased by ultraviolet light through a quartz window; JTAG (IEEE 1149.1, 1990); in-system programming | The TAP controller |
| 28 | Freeman, Xilinx and the XC2064 (1985); Actel's antifuse FPGAs (1988); 6-input LUTs (Virtex-5, 2006) | — |
| 29 | ABEL and CUPL; Verilog (1984) and VHDL (IEEE 1076, 1987); logic synthesis becomes a product (Synopsys, late 1980s) | — |
| 30 | Simulated annealing (Kirkpatrick, Gelatt and Vecchi, 1983), applied to chip placement in the same paper; FlowMap (Cong and Ding, 1994); PathFinder (McMurchie and Ebeling, 1995); VPR (Betz and Rose, 1997) | — |
| 31 | Ferranti's ULA in the ZX81 and ZX Spectrum; Project IceStorm (2015), Yosys and nextpnr; Microsoft's Catapult (2014); vintage computers recreated in FPGAs | — |
| 32 | Kilby (1958) and Noyce (1959); Moore's law (1965); Mead and Conway's VLSI revolution (1980) | — |

Every date and claim on a card cites a source in the bibliography.

## Build it for real

Optional `:::real` boxes, collected in appendix D with breadboard illustrations.

- **Kit:**
  - breadboard, jumper wires, a 5 V USB supply module;
  - resistors, capacitors (including 1000 µF), LEDs in several colours, pushbuttons, DIP switches, a
    potentiometer;
  - 2N3904 and 2N7000/BS250 transistors, 1N4148 diodes, a 5 V relay, an NE555;
  - 74HC00, 02, 04, 08, 32, 86, 74, 161, 283, 595; a 7-segment display; a 62256 SRAM;
  - a multimeter.
- **Optional:**
  - a cheap USB logic analyser (sigrok/PulseView) and a USB–UART adapter;
  - for Part VI:
    - a universal device programmer (TL866 class), with ATF22V10 GALs and a 28C16 EEPROM;
    - an iCE40 board with at least 5k LUTs (e.g. iCE40UP5K or HX8K), used with Yosys, nextpnr and the
      IceStorm tools. The exact board is chosen in M7.
- **Safety:**
  - low voltage only, never mains;
  - current-limiting resistors;
  - the flyback diode on relays;
  - care with electrolytic polarity and with batteries.

| Ch | Lab |
|---|---|
| 2 | LED and resistor; measure a divider |
| 4 | Watch an LED fade through a big RC; measure τ |
| 5 | Drive a relay from a transistor, with its flyback diode (the spike without the diode is shown in the simulator only: it can destroy the transistor) |
| 6 | Staircase switch with two SPDT switches; relay AND and OR |
| 7 | Plot an LED's I–V curve by hand with a potentiometer |
| 8 | Transistor switch and RTL inverter |
| 9 | Discrete CMOS inverter (2N7000 + BS250) |
| 10 | 74HC04 transfer curve with a potentiometer; an open-drain wired-AND |
| 11 | XOR from four NANDs (74HC00) |
| 13 | 7-segment decoder from gates |
| 14 | 4-bit adder (74HC283) with DIP switches and LEDs |
| 16 | NAND SR latch; ring oscillator (slowed with RC to blink) |
| 17 | Debounced button toggling a 74HC74; 555 astable |
| 18 | 74HC161 counter on LEDs; 74HC595 driving 8 LEDs |
| 19 | Traffic-light FSM from flip-flops and gates |
| 20 | Read and write a 62256 SRAM by hand |
| 21–23 | One ALU bit-slice or the program counter on breadboards (the whole CPU runs on an FPGA in Chapter 31) |
| 24 | PWM from a 555; R-2R DAC with resistors; UART from a USB adapter on the logic analyser |
| 25 | A 28C16 EEPROM as a 7-segment decoder, programmed with the course's truth table |
| 26 | The Chapter 19 traffic light in one ATF22V10, from the course's JEDEC file |
| 27 | Optional: a small CPLD board; boundary-scan its pins over JTAG |
| 28 | Blink an LED on the iCE40 board, then find your LUT in its bitstream with the IceStorm tools |
| 29–30 | Build the chapter designs with Yosys and nextpnr, and compare utilisation and fmax with the course's toolchain |
| 31 | Octet and the RV32I core on the iCE40 board: LEDs, buttons, and the console over the USB UART |

## Look and feel: "The Bench"

- **Light theme:** lab-notebook paper with a faint grid, schematics in ink, copper accents.
- **Dark theme:** a lab at night: a deep blue-black page, phosphor-green oscilloscope traces.
- **Signal colours**, identical in every figure and in both themes, and never the only cue:
  - HIGH: warm amber glow (thicker stroke);
  - LOW: slate;
  - Z (floating): dashed grey;
  - X or contention: red, hatched, flickering (static under reduced motion).
- **Current:** moving dots (static arrows under reduced motion).
- **Chip view:** a die-like rendering, with dark silicon and metal-coloured routing. Configured bits glow,
  and a selected module is tinted the same colour in the logic view and the chip view.
- **Type:** JetBrains Mono (shared with the collection) for values, pins and code. The display and prose
  faces are chosen with the mockups in M0, and must differ from the other courses'.
- **Collection index card:** a small oscilloscope trace with a square wave, and four LEDs counting in
  binary.
- **Accessibility:**
  - every widget is keyboard-operable;
  - live values are exposed to screen readers;
  - colours meet WCAG contrast in both themes;
  - animation and sound are optional.

## Content and components

The Markdown compiler, layout and content components are copied from Proofcraft and adapted (the collection
keeps each course self-contained).

- **Reused directives:**
  - callouts (`:::key`, `:::question`, `:::warning`, `:::challenge`, …);
  - `:::bio`, hints, `quiz`;
  - equations with hoverable terms;
  - glossary terms, timeline, bibliography.
- **New directives:**
  - `::circuit{src level dial probes instruments}`: a live circuit, with the abstraction dial and *Open on
    the bench*;
  - `::device{kind src views}`: a compact Device Studio, with *Open in the Studio*;
  - `:::predict`: a question with choices, and the explanation revealed after answering;
  - `:::lab{title}`: goal, steps with live checks, what you should see, and why;
  - `:::programmer`: a programmer's view callout;
  - `:::hood`: under the hood, with a code excerpt from the simulator or toolchain;
  - `:::deeper`: optional maths;
  - `:::real{parts}`: build it for real;
  - `:::history{year title people image source run}`: a flip card.
- **DCL code blocks:**
  - ` ```dcl ` blocks are highlighted by the DCL lexer at build time and checked by the tests;
  - ` ```dcl live ` blocks are editable and runnable, with *Open in the Studio*.
- **Exercises** (fenced YAML, as in Proofcraft):
  - `build`: a spec (truth table, expression, FSM or waveform), the allowed parts, and an optional gate
    budget. On success, the part goes into the parts bin.
  - `debug`: a circuit with an injected fault (floating input, reversed LED, missing pull-up, contention,
    race). The fixed circuit must meet the spec.
  - `measure`: read a value with an instrument, within a tolerance.
  - `golf`: minimise gates or transistors against a par.
  - `asm`: write an Octet or RV32I program. Tests check the final memory, registers and I/O.
  - `hdl`: write DCL to a spec. Checked by hidden tests and by equivalence with the reference design.
  - `fit`: program a device (PLA, GAL, CPLD or FPGA) to a spec, within its resources.
  - `route`: route nets by hand on vFPGA-S.
  - `place`: beat the placer's cost.
  - `decode`: work out what a fuse map or bitstream does.
  - `quiz`, `predict`.

## Architecture

```
courses/digital-circuits/
  docs/PLAN.md, docs/HDL.md
  content/            outline.ts; chapters/<nn>-<slug>/{index.md, widgets/*.svelte, circuits/*.json, designs/*.dcl};
                      designs/ (Octet and RV32I in DCL); parts.ts (parts-bin specs and reference implementations);
                      YAML glossary, timeline, bibliography
  src/lib/sim/
    netlist/          components, pins, nets, hierarchy, flattening, JSON format
    analog/           MNA, devices, Newton–Raphson, transient analysis, ratings
    switch/           switch-level engine
    digital/          event-driven engine, 0/1/X/Z, delays, traces
    expand/           gate → transistor → device expansion (the abstraction dial)
    synth/            truth table / expression / FSM → netlist; Quine–McCluskey
    check/            spec checkers
    cpu/              Octet and RV32I: ISAs, assemblers, disassemblers, reference interpreters
    worker.ts         Web Worker host for large simulations
  src/lib/hdl/        DCL: lexer, parser, formatter, types, elaboration, RTL simulator (generated JS),
                      lowering to the netlist, editor support (CodeMirror extension, worker protocol)
  src/lib/pld/
    devices/          vPROM, vPLA, GAL22V10, vCPLD-32, vFPGA-S/M/L, the virtual board; bit decoders
    twolevel/         Espresso-style minimisation, PAL/GAL fitter, JEDEC
    cpld/             partitioning, product-term allocation, interconnect, JTAG
    fpga/             AIG, LUT mapping, packing, placement, routing, timing, bitstream
    interchange/      netlist for Yosys and nextpnr
  src/lib/bench/      schematic editor, renderer (SVG), instruments (Canvas 2D), share links
  src/lib/studio/     Device Studio: panes, cross-probing, chip view (Canvas 2D / WebGL2), replay
  src/lib/audio/      Web Audio (relays, oscillators, counters)
  src/lib/components/ content blocks, exercises, layout, ui
  tools/markdown/     Markdown → Svelte compiler (from Proofcraft), DCL highlighting via src/lib/hdl
  scripts/            validation against external tools (not run in CI)
  tests/
```

## Testing

- **Analog:**
  - closed-form checks (dividers, series/parallel networks, RC and RL charging, diode operating point);
  - conservation checks (Kirchhoff's current law at every node, energy balance);
  - optional golden traces from ngspice, generated by a script outside CI and committed as fixtures.
- **Across levels:** property tests (fast-check) on random combinational circuits. These must agree:
  - direct Boolean evaluation;
  - the digital engine;
  - the switch-level expansion;
  - the analog expansion (small circuits only).
- **Parts bin:** every reference part passes its own checker, and every `debug` exercise's faulty circuit
  fails it.
- **DCL:**
  - parser and formatter round-trip on every design and code block;
  - golden diagnostics;
  - fuzzing: random inputs never crash the checker, and every error has a span;
  - property tests on random well-typed designs. These must agree: the RTL simulator; the bit-level netlist
    on the digital engine; and the configured fabric of every device the design fits.
- **Programmable logic:**
  - legality of every fit, placement and route: no overused resource, every net routed;
  - timing reports consistent with the fabric simulator's delays;
  - bitstream encode/decode round trip;
  - JEDEC checksums.
- **CPUs:**
  - differential tests of the gate-level Octet (hardwired and microcoded) against its reference interpreter;
  - differential tests of the RV32I core against its reference interpreter;
  - on random programs and on every course program;
  - Octet and RV32I also run on the configured vFPGA.
- **Content:** every chapter compiles; every committed circuit and design loads and settles; every
  exercise's reference solution passes.
- **Validation scripts** (outside CI, like SSA to Silicon's):
  - `validate:gal`: JEDEC files compared with those of galette, an open-source GAL assembler, for the same
    equations;
  - `validate:yosys`: the course designs built with Yosys and nextpnr for iCE40, with utilisation and fmax
    recorded for Chapter 31's comparison;
  - `validate:rv32i`: riscv-arch-test on the RV32I core.
- **Before finishing a change:** `npm test`, `npm run check`, `npm run build`.

## Integration with the collection

- **Root `README.md`:** a row in the course table and the install line.
- **`scripts/build.mjs`:** build with `BASE_PATH=<base>/digital-circuits` and copy to
  `dist/digital-circuits/`.
- **`.github/workflows/deploy.yml`:** `npm ci` and the lockfile cache path.
- **`.github/workflows/digital-circuits.yml`:** tests, check and build on changes under
  `courses/digital-circuits/`.
- **`site/index.html` and `site/styles.css`:** the course card (marked *in progress* until M8), and the
  course count in the copy and meta description.
- **Theme:** the shared `theme` key in `localStorage`, so the theme follows the reader between courses.

## Milestones

- [x] **M0 — Foundations.**
  - SvelteKit shell and Markdown compiler (from Proofcraft).
  - "The Bench" design tokens and mockups.
  - Netlist model, digital engine, analog engine (R, C, sources, switch, lamp, relay).
  - SVG schematic renderer with current dots and signal colours.
  - Engine benchmarks.
  - **Chapter 6 (Shannon's switches) as the reference chapter.** It exercises analog and logic, an
    exercise, history cards and sound.
- [x] **M1 — Part I.**
  - Prologue and chapters 1–5.
  - Bench v1: editor, multimeter, supply, oscilloscope, function generator.
  - Voltage landscape (WebGL2); ratings and magic smoke.
  - Appendices A and B.
  - Wired into the collection as *in progress*.
- [x] **M2 — Part II.**
  - Chapters 7–10.
  - Diode, LED, BJT and MOSFET models; Newton–Raphson.
  - Switch-level engine; the abstraction dial; the gate compiler; the parts bin.
- [x] **M3 — Part III.**
  - Chapters 11–15.
  - Synthesis, K-maps, Quine–McCluskey; timing diagrams; gate golf.
  - `build`, `debug` and `golf` exercises.
- [x] **M4 — Part IV.**
  - Chapters 16–20.
  - Metastability model; the FSM designer and FSM equivalence checker; memory models; the logic analyser.
- [x] **M5 — Part V.**
  - Chapters 21–24.
  - Octet: final ISA, assembler, reference interpreter, gate-level build in a worker, turbo mode, I/O
    devices.
  - Differential tests; `asm` exercises; protocol decoders; appendix E.
- [x] **M6 — Programmable logic I.**
  - DCL front end: parser, formatter, type checker, elaboration, diagnostics.
  - The DCL editor, the RTL simulator, and lowering to the netlist.
  - The Device Studio: panes, cross-probing, simulation from the bits, replay.
  - Devices: vPROM, vPLA, GAL22V10 with JEDEC, vCPLD-32 with JTAG.
  - Chapters 25–27; `hdl`, `fit` and `decode` exercises; the first datasheets in appendix G.
- [x] **M7 — Programmable logic II.**
  - vFPGA-S/M/L and the virtual board.
  - The FPGA flow: synthesis, mapping, packing, placement, routing, timing, bitstream.
  - Chapters 28–31; Octet and RV32I in DCL; `route` and `place` exercises.
  - The interchange netlist and the iCE40 labs; validation scripts.
  - **Benchmark gate** for the TypeScript kernels (HDL.md, *Implementation language*).
  - Appendices F and G.
- [x] **M8 — Epilogue and finish.**
  - Chapter 32; appendices C, D and H (timeline deck); breadboard illustrations.
  - Accessibility, mobile and reduced-motion pass; review pass; *in progress* label removed.

## Open questions

- **Names:** the CPU (*Octet*), the HDL (*DCL*) and the virtual devices are working names.
- **Design:** the display and prose typefaces, and the final palette (with the M0 mockups).
- **Stretch:** the interactive breadboard view (after M8).
- **Hardware choices:** the iCE40 board (decided in M7); whether Chapter 27 gets a real CPLD lab.
- **More faithful devices:** whether to add a second one (GAL16V8) beside the GAL22V10.
