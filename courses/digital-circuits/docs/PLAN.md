# Course plan — *Digital Circuits*

The living plan for the course: agreed decisions, curriculum, simulator and component inventory, and
milestones. Update it when decisions change or chapters land.

The course starts from a battery and a switch and ends with a working 8-bit CPU that the reader has
assembled from parts they built and verified themselves. Everything on screen runs on a circuit simulator
written for the course.

## Decisions (agreed 2026-09-29)

| Topic | Decision | Notes |
|---|---|---|
| Title | **Digital Circuits** | Slug `digital-circuits`, published at `/digital-circuits/`. |
| Reader | **Software engineers** with no electronics background | Algebra and exponentials in the main text; calculus and linear algebra only in optional *Deeper* boxes and in *Under the hood*. |
| Aim | Understand how a computer works from electrons up, and **build a working CPU** | Part V assembles a CPU from the reader's own parts bin. |
| Analog scope | As much analog as digital needs, and no more | Ohm, Kirchhoff, RC timing, inductors only for relays, diodes, transistors as switches and as amplifiers (gain). No filters, op-amp circuits, AC power or radio. |
| Simulation | Our own engine in TypeScript, at three levels (analog, switch, logic) over one netlist model | No third-party simulator. See *The simulator*. |
| Real hardware | Optional **Build it for real** track: a lab per chapter, a kit list and breadboard layouts | Low voltage only (5 V USB supply or 9 V battery). The full CPU is built on an FPGA from exported Verilog, not on breadboards. |
| Site | SvelteKit 2 + Svelte 5, `adapter-static`, the Markdown-with-directives compiler copied from Proofcraft | Single npm package (not a pnpm workspace). Output in `dist/`, base path from `BASE_PATH`. |
| TypeScript | **TS 6**, as in Proofcraft and Language Models | `svelte-check` needs the TypeScript JS API, which TS 7 does not have. |
| Rendering | SVG for schematics; Canvas 2D for waveforms and instruments; WebGL2 for the voltage landscape and the CPU-scale view | No three.js or charting libraries. Respect `prefers-reduced-motion`. |
| Sound | Web Audio: relays click, oscillators and counters can be heard | **Off by default**, one global toggle remembered in `localStorage`. |
| History images | US patent drawings (public domain); portraits only when clearly public domain, with attribution | Same attribution rules as astrophysics' `Portrait`. Die photographs only under a clear licence (e.g. CC BY). |
| Progress | `localStorage`: exercises, parts bin, bench circuits; export/import as JSON | |
| Design | **"The Bench"**, a lab-bench identity distinct from SSA to Silicon's *Datasheet* | See *Look and feel*. Shares the collection's `theme` key. |
| Language | British English | |

## Through-lines

1. **The parts bin.** When the reader builds a part and it passes its checker (an inverter, a full adder, a
   flip-flop, a counter), the part goes into their parts bin as a black box with fixed pins. Later chapters
   build from the bin, and the CPU in Part V is made entirely of the reader's parts. Every part also has a
   reference implementation, and a *use my parts* toggle switches between them, so skipping an exercise
   never blocks a later chapter. (This is the Elements workshop's unlocking, applied to hardware.)
2. **Gain makes digital possible.** Digital works because amplifying stages restore degraded signals. The
   course builds up to this moment in Chapter 8 (the noise gauntlet) and comes back to the analog layer
   underneath logic in every part: noise margins, delay, glitches, metastability, power, leaking DRAM.
3. **The abstraction dial.** Where the circuit is small enough, every live figure can be switched between
   **Logic** (gates, 0/1), **Switches** (transistors as switches) and **Analog** (voltages over time).
   The dial plays the part that the depth slider plays in astrophysics.
4. **Programmer's view.** Short callouts map hardware ideas to software ones: combinational logic is a pure
   function, a register is a variable, the clock is the tick of a loop, metastability is a race condition,
   an HDL describes wiring, not a sequence of steps.

## Chapter template

Hook (an everyday question or a history card) → 🔮 predict → explore (the flagship interactive) →
explain (hoverable equations, draggable numbers) → 🔬 lab on the bench → 🧑‍💻 programmer's view →
⚙️ under the hood (how the simulator does it, with a code excerpt) → 🧩 build (adds a part to the bin) →
🐞 debug the board → 🔧 build it for real → what's next → further reading.

Standards per chapter:

- 2,500–5,000 words.
- One flagship interactive, plus 2–4 smaller figures.
- At least one *predict* question, placed where intuition is usually wrong.
- At least one lab, at least one history card, and at least one build or debug exercise.
- An *Under the hood* box wherever the simulator does something non-trivial.
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
| 13 | Building blocks | Multiplexers, demultiplexers, decoders, encoders, priority encoders, comparators, parity; the 7-segment decoder; a multiplexer is a lookup table, hence FPGAs | Live 7-segment decoder; LUT explorer | MUX2/4/8, DEC2→4, DEC3→8, 7-segment decoder, comparator |
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

### Epilogue and appendices

| # | Chapter | Key ideas | Flagship interactive |
|---|---|---|---|
| 25 | From breadboard to billions | Integrated circuits; photolithography; Moore's law; FPGAs; HDLs; what to build next | Moore's law plot (transistor counts, log scale); the reader's Octet exported as Verilog |

Appendices:

- **A.** Reference: schematic symbols, units and prefixes, resistor colour code, number systems.
- **B.** Maths toolbox: exponentials and *e*, the RC differential equation, systems of linear equations.
- **C.** The simulator: what it models and what it does not (in the spirit of Proofcraft's appendix B).
- **D.** Build it for real: kit list, safety, breadboard basics, and each chapter's lab.
- **E.** Octet reference card: ISA, encoding, memory map.
- **F.** Glossary, timeline (the history-card deck) and bibliography.

## Under the hood

The reader is a programmer, so the simulator is part of the subject. Each *Under the hood* box explains the
algorithm behind the chapter's figures, with an excerpt of the real code.

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
| 25 | Netlist → structural Verilog |

## The simulator

One netlist model with three engines. The abstraction dial *expands* a netlist from one level to the next:
each gate becomes its CMOS transistor network (switch level), and each transistor becomes a device model
(analog). The dial is offered only where the expanded circuit stays within the analog engine's size budget.

### Netlist (`src/lib/sim/netlist`)

- Components with typed pins and parameters; wires; nets derived from connectivity; hierarchical
  subcircuits (the parts bin); flattening; a versioned JSON format.
- Circuits are drawn in the bench and exported as JSON into each chapter's `circuits/` directory (with an
  *export for chapter* command in development builds). Tests load every committed circuit.

### Analog engine (`src/lib/sim/analog`)

- Modified nodal analysis with dense LU and partial pivoting. Sparse LU only if profiling asks for it; the
  target is at most about 100 nodes.
- Transient analysis with companion models: backward Euler by default, trapezoidal as an option (Chapter 4
  shows the difference). Adaptive time steps, with breakpoints at source edges.
- Newton–Raphson for non-linear devices, with SPICE-style junction voltage limiting.
- Devices:
  - resistor, capacitor, inductor, potentiometer, lamp;
  - DC, pulse, square and sine sources; bench supply with a current limit;
  - switch, pushbutton (with a bounce model), relay (coil plus contacts with pull-in/drop-out hysteresis and
    switching time);
  - diode (Shockley with series resistance), LED (per-colour parameters, emits light in the view);
  - BJT (Ebers–Moll transport model), MOSFET (level 1, Shichman–Hodges with λ);
  - comparator (behavioural, for the 555 and the ADC).
- Ratings: each part has maximum power, current or voltage. Exceeding it for long enough makes the part
  fail: an animation (smoke), a note explaining why, and the part becomes open or short as appropriate.

### Switch-level engine (`src/lib/sim/switch`)

- Bryant-style (MOSSIM) model: transistors are bidirectional switches; node values 0, 1, X; strengths
  supply > driven > charged. Charge storage and charge sharing (dynamic nodes, DRAM, pass transistors).

### Digital engine (`src/lib/sim/digital`)

- Event-driven, with a time-wheel event queue. Four values (0, 1, X, Z) with a resolution function for
  shared nets (two drivers disagreeing → X, drawn as contention).
- Per-gate delays, inertial by default, transport as an option (Chapter 15). Deterministic.
- Probes and trace buffers feed timing diagrams and the logic analyser.
- Runs on the main thread for small widgets, and in a Web Worker for the CPU.
- For the CPU there is also an ISA-level **turbo** mode using the reference interpreter, for MHz speeds. The
  view states clearly that it has switched from gate-level to instruction-level simulation.

### Checkers (`src/lib/sim/check`)

- **Combinational:** exhaustive over all inputs, up to 16 inputs (65,536 vectors).
- **Sequential:** equivalence with the reference machine by breadth-first search over the product machine for
  small state spaces; directed and random stimulus beyond that.
- **Timing:** the measured waveform is compared with the specified one, within tolerances.
- **Analog labs:** the measured value must fall within a tolerance.

### Performance targets (to be measured with a benchmark in M0)

- Analog: 60 fps with at least 10 simulation steps per frame, for circuits up to 50 nodes.
- Digital, gate-level Octet: at least 1 kHz simulated clock with every wire animated, at least 10 kHz headless.
- ISA-level turbo mode: at least 1 MHz.

## The bench

A full-screen sandbox (`#/bench`), also embedded in compact form in chapters. Every live figure has an
**Open on the bench** button, and circuits can be shared by URL (JSON compressed with `CompressionStream`,
then base64url). The current bench circuit is autosaved to `localStorage`.

- **Schematic editor:** snap-to-grid placement, orthogonal wire routing, rotate and flip, labels, parts-bin
  blocks, undo/redo, keyboard operation.
- **Views:**
  - current as moving dots whose speed follows the current (Falstad's convention);
  - voltage as colour;
  - logic values in the signal colours;
  - hovering a node shows its voltage, hovering a part shows its current and power.
- **Instruments:**
  - multimeter (V, A, Ω, continuity);
  - bench supply with a current limit;
  - function generator;
  - 2–4 channel oscilloscope (timebase, trigger, cursors, phosphor persistence);
  - 8–16 channel logic analyser with UART, SPI and I²C decoders (Chapter 24);
  - logic probe.
- **Stretch goal:** an interactive breadboard view. Until then, the *Build it for real* labs use static
  breadboard illustrations.

## The course CPU: Octet (working name)

A sketch, to be finalised in M5. Constraints: small enough to follow wire by wire, big enough to run
interesting programs, and built only from parts-bin parts.

- 8-bit data, 8-bit addresses: 256 bytes of unified memory (von Neumann), so programs are visibly data.
- Registers R0–R3, PC, SP, IR, and flags Z, C, N, V.
- Instructions are one byte `oooo ddss` (4-bit opcode, destination and source registers), plus an optional
  second byte (an immediate or an address).
- Instruction groups: `MOV`, `LDI`; `LD`/`ST` (direct) and `LDR`/`STR` (register-indirect); `ADD`, `SUB`,
  `AND`, `OR`, `XOR`, `CMP`; a unary group (`SHL`, `SHR`, `NOT`, `INC`); conditional jumps (`JMP`, `JZ`,
  `JNZ`, `JC`, `JNC`, `JN`); `CALL`, `RET`, `PUSH`, `POP`; `HLT`.
- Multi-cycle microarchitecture on a single shared bus with tri-state drivers (paying off Chapter 10).
  Hardwired control (the FSM technique of Chapter 19) and microcoded control (Chapter 22) are
  interchangeable, and both must pass the same differential tests.
- Memory-mapped I/O in the top of the address space:
  - an 8 × 8 LED matrix (8 bytes of frame buffer);
  - 8 LEDs, 8 switches and a pushbutton;
  - two hexadecimal 7-segment digits;
  - a text console;
  - a random-number port (the Chapter 18 LFSR);
  - PWM and DAC outputs and an ADC input (Chapter 24).
- Clock: manual step (per cycle or per instruction), and a speed slider from 0.5 Hz up to the simulator's
  limit.
- Toolchain: a two-pass assembler (labels, `.org`, `.byte`), a disassembler, and a reference ISA
  interpreter used for turbo mode and for differential testing.
- Programs:
  - blink and count; shift-and-add multiplication; Fibonacci; "HELLO, WORLD" on the console;
  - a reaction-time game (button + LEDs);
  - sorting 8 bytes;
  - challenges: Pong, or the Game of Life on the 8 × 8 matrix.
- Chapter 23 compares Octet with RISC-V (RV32I) and points to SSA to Silicon and its pipeline simulator.

## History cards

`:::history` blocks render as **flip cards**.

- **Front:** a US patent drawing or a public-domain portrait, the year, and a one-line hook.
- **Back:** the story, why it matters for this chapter, sources, and where possible a **Run the original**
  button that loads a reconstruction into the simulator.
- **Collection:** the cards the reader has seen are collected in the timeline (appendix F), which is also
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
| 13 | Nixie tubes (1955); Freeman and the first FPGA, Xilinx XC2064 (1985) | — |
| 14 | Leibniz's binary arithmetic (1703); Babbage's anticipating carriage (1830s) | A carry-lookahead adder |
| 15 | Grace Hopper's nanosecond: a 30 cm wire | — |
| 16 | Eccles and Jordan's trigger relay, the first flip-flop (1918); Chaney and Molnar on metastability (1973) | The Eccles–Jordan circuit, with transistors instead of triodes |
| 17 | Cady's quartz oscillator (1921); Marrison's quartz clock (1927); Camenzind's 555 (1971) | The 555 from its block diagram |
| 18 | Wynn-Williams's scale-of-two counter (1932); Golomb's *Shift Register Sequences* (1967), and GPS codes from LFSRs | A scale-of-two counter |
| 19 | Huffman (1954), Mealy (1955), Moore (1956); Turing's machine (1936), see Incompleteness and Computability | — |
| 20 | The Williams tube (1947); mercury delay lines (EDSAC, 1949); Wang and Forrester's core memory; the AGC's core rope; Dennard's one-transistor DRAM (patent 1968); the Intel 1103 (1970); Masuoka's flash (1980s) | Dennard's 1T1C cell; a small core-rope ROM |
| 21–23 | Von Neumann's *First Draft* (1945); Wilkes's microprogramming (1951); the Intel 4004 (Faggin, Hoff, Mazor, Shima, 1971); the MOS 6502 (1975) and the Visual 6502 project (2010) | Wilkes's diode-matrix control store |
| 24 | Baudot's telegraph code (1870s), and the baud; Reeves's pulse-code modulation (1937) | A UART frame |
| 25 | Kilby (1958) and Noyce (1959); Moore's law (1965); Mead and Conway's VLSI revolution (1980); Verilog (1984) | — |

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
  - a cheap USB logic analyser (sigrok/PulseView);
  - a USB–UART adapter;
  - an iCE40 FPGA board with the open toolchain (Yosys, nextpnr) for Part V.
- **Safety:** low voltage only, never mains; current-limiting resistors; the flyback diode on relays; care
  with electrolytic polarity and with batteries.

| Ch | Lab |
|---|---|
| 2 | LED and resistor; measure a divider |
| 4 | Watch an LED fade through a big RC; measure τ |
| 5 | Drive a relay from a transistor with its flyback diode (the spike without the diode is shown in the simulator only: it can destroy the transistor) |
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
| 21–23 | One ALU bit-slice or the program counter on breadboards; the whole Octet on an FPGA from exported Verilog |
| 24 | PWM from a 555; R-2R DAC with resistors; UART from a USB adapter on the logic analyser |

## Look and feel: "The Bench"

- **Light theme:** lab-notebook paper with a faint grid, schematics in ink, copper accents.
- **Dark theme:** a lab at night: a deep blue-black page, phosphor-green oscilloscope traces.
- **Signal colours**, identical in every figure, in both themes, and never the only cue:
  - HIGH: warm amber glow (thicker stroke);
  - LOW: slate;
  - Z (floating): dashed grey;
  - X or contention: red, hatched, flickering (static under reduced motion).
- **Current:** moving dots (static arrows under reduced motion).
- **Type:** JetBrains Mono (shared with the collection) for values, pins and code. The display and prose faces
  are to be chosen with the mockups in M0 and must differ from the other courses'.
- **Collection index card:** a small oscilloscope trace with a square wave, and four LEDs counting in binary.
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
  - `::circuit{src level dial probes instruments}`: a live circuit, with the abstraction dial and *Open on the
    bench*;
  - `:::predict`: a question with choices, and the explanation revealed after answering;
  - `:::lab{title}`: goal, steps with live checks, what you should see, and why;
  - `:::programmer`: programmer's view callout;
  - `:::hood`: under the hood, with a code excerpt from the simulator;
  - `:::deeper`: optional maths;
  - `:::real{parts}`: build it for real;
  - `:::history{year title people image source run}`: flip card.
- **Exercises** (fenced YAML, as in Proofcraft):
  - `build`: spec as a truth table, expression, FSM or waveform; allowed parts; optional gate budget. On
    success, the part goes into the parts bin.
  - `debug`: a circuit with an injected fault (floating input, reversed LED, missing pull-up, contention,
    race); the fixed circuit must meet the spec.
  - `measure`: read a value with an instrument, within a tolerance.
  - `golf`: minimise gates or transistors against a par.
  - `asm`: write an Octet program; tests check the final memory, registers and I/O.
  - `quiz`, `predict`.

## Architecture

```
courses/digital-circuits/
  docs/PLAN.md
  content/            outline.ts; chapters/<nn>-<slug>/{index.md, widgets/*.svelte, circuits/*.json};
                      parts.ts (parts-bin specs and reference implementations); YAML glossary, timeline, bibliography
  src/lib/sim/
    netlist/          components, pins, nets, hierarchy, flattening, JSON format
    analog/           MNA, devices, Newton–Raphson, transient analysis, ratings
    switch/           switch-level engine
    digital/          event-driven engine, 0/1/X/Z, delays, traces
    expand/           gate → transistor → device expansion (the abstraction dial)
    synth/            truth table / expression / FSM → netlist; Quine–McCluskey
    check/            spec checkers
    cpu/              Octet: ISA, assembler, disassembler, reference interpreter, gate-level build
    export/           structural Verilog
    worker.ts         Web Worker host for large digital simulations
  src/lib/bench/      schematic editor, renderer (SVG), instruments (Canvas 2D), share links
  src/lib/audio/      Web Audio (relays, oscillators, counters)
  src/lib/components/ content blocks, exercises, layout, ui
  tools/markdown/     Markdown → Svelte compiler (from Proofcraft)
  tests/
```

## Testing

- **Analog:**
  - closed-form checks (dividers, series/parallel networks, RC and RL charging, diode operating point);
  - conservation checks (Kirchhoff's current law at every node, energy balance);
  - optional golden traces from ngspice, generated by a script outside CI and committed as fixtures (like SSA
    to Silicon's validation scripts).
- **Across levels:** property tests (fast-check) on random combinational circuits. Direct Boolean evaluation,
  the digital engine, the switch-level expansion and (for small circuits) the analog expansion must agree.
- **Parts bin:** every reference part passes its own checker. Every `debug` exercise's faulty circuit fails it.
- **CPU:** differential tests of the gate-level Octet, with hardwired and with microcoded control, against the
  reference interpreter on random programs and on every program in the course.
- **Content:** every chapter compiles; every committed circuit loads and settles; every exercise's reference
  solution passes.
- **Before finishing a change:** `npm test`, `npm run check`, `npm run build`.

## Integration with the collection

- Root `README.md`: add a row to the course table and the install line.
- `scripts/build.mjs`: build with `BASE_PATH=<base>/digital-circuits` and copy to `dist/digital-circuits/`.
- `.github/workflows/deploy.yml`: `npm ci` and the lockfile cache path.
- `.github/workflows/digital-circuits.yml`: tests, check and build on changes under `courses/digital-circuits/`.
- `site/index.html` and `site/styles.css`: the course card (marked *in progress* until M6), and the course
  count in the copy and meta description.
- Shared `theme` key in `localStorage`, so the theme follows the reader between courses.

## Milestones

- [ ] **M0 — Foundations.**
  - SvelteKit shell and Markdown compiler (from Proofcraft).
  - "The Bench" design tokens and mockups.
  - Netlist model, digital engine, analog engine (R, C, sources, switch, lamp, relay).
  - SVG schematic renderer with current dots and signal colours.
  - Engine benchmarks.
  - **Chapter 6 (Shannon's switches) as the reference chapter.** It exercises analog and logic, an exercise,
    history cards and sound.
- [ ] **M1 — Part I.**
  - Prologue and chapters 1–5.
  - Bench v1: editor, multimeter, supply, oscilloscope, function generator.
  - Voltage landscape (WebGL2); ratings and magic smoke.
  - Appendices A and B.
  - Wired into the collection as *in progress*.
- [ ] **M2 — Part II.**
  - Chapters 7–10.
  - Diode, LED, BJT and MOSFET models; Newton–Raphson.
  - Switch-level engine; the abstraction dial; the gate compiler; the parts bin.
- [ ] **M3 — Part III.**
  - Chapters 11–15.
  - Synthesis, K-maps, Quine–McCluskey; timing diagrams; gate golf.
  - `build`, `debug` and `golf` exercises.
- [ ] **M4 — Part IV.**
  - Chapters 16–20.
  - Metastability model; the FSM designer and FSM equivalence checker; memory models; the logic analyser.
- [ ] **M5 — Part V.**
  - Chapters 21–24.
  - Octet: final ISA, assembler, reference interpreter, gate-level build in a worker, turbo mode, I/O devices.
  - Differential tests; `asm` exercises; protocol decoders; appendix E.
- [ ] **M6 — Epilogue and finish.**
  - Chapter 25; Verilog export; appendices C, D and F (timeline deck); breadboard illustrations.
  - Accessibility, mobile and reduced-motion pass; review pass; *in progress* label removed.

## Open questions

- Final name of the CPU (*Octet* is a working name).
- Display and prose typefaces, and the final palette (with the M0 mockups).
- The interactive breadboard view (stretch, after M6).
- The FPGA board recommended for Part V (decided in M5).
