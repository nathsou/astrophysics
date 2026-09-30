---
number: 27
title: CPLDs
summary: Put several PALs on one chip, join them with a switch matrix, let a neighbour lend product terms, make the cells flash so the chip is ready the moment power arrives, and add a four-wire port that programs it in place and tests the board around it.
duration: About 1½ hours
prerequisites: [pals-and-gals]
---

A GAL22V10 has ten macrocells, and a designer who needs thirty has an obvious plan: put three of them on the board and wire them together. But every signal that goes from one GAL to another leaves a chip, crosses a track and enters a pin, so it is slow, it uses pins that the outside world needed, and the board is a design problem again.

The next plan is the subject of this chapter: **put the three PALs on the same die, and wire them inside.** A chip of this kind is a :term[CPLD]{id=cpld}, a complex programmable logic device. Building one is harder than it sounds, because the first thing you try does not scale.

## Why one big PAL does not scale

Suppose we simply make a PAL bigger: *M* macrocells with five product terms each, and every product term able to see every signal. The signals are the *M* pins and the *M* macrocell feedbacks, each needed true and complemented, so the array has 5*M* rows of 4*M* crosspoints: 20*M*² fuses. It is a full crossbar, every row crossing every column, and each product term is an AND gate of 4*M* inputs on a wire that runs the width of the array.

```quiz
q: 'A PAL-style array in which every product term sees every signal has 32 macrocells. A designer wants 64. How many more crosspoints does the array need?'
options:
  - text: Twice as many.
    why: 'That would be true if only the number of rows grew. But the number of columns doubles as well, because there are twice as many signals to look at.'
  - text: Four times as many.
    correct: true
    why: 'The array has 5M rows of 4M columns, which is 20M² crosspoints. Doubling M multiplies that by four: from 20,480 to 81,920. The fuses are not the only price: the wires get twice as long, so they are slower.'
  - text: Eight times as many.
    why: 'Eight times would be a cube. The array is a grid of rows and columns, so it grows as the square.'
```

A crossbar pays twice: the fuses grow as *M*², and the wires that cross the whole array get longer in proportion to *M*, and a long wire costs time. The way out is the way every large system deals with a crossbar: don’t build one. Give each group of macrocells a small array of its own, and let a **switch matrix** decide which of the chip’s signals each group can see.

::crossbar-scaling{n="27.1" caption="Slide the number of macrocells. On log–log axes a square law has slope two and a linear one slope one. At the vCPLD-32’s 32 macrocells a single array needs 20,480 crosspoints and 128-input AND gates; four blocks and a matrix need 8,256 bits and 48-input gates. At 8 macrocells the matrix is pure overhead; at 256 the single array needs 19 times as many bits."}

:::history{year=1984 title="The EP300, a PAL you can erase" people="Altera"}
Altera was founded in 1983, and its first product, in 1984, was the EP300: a CMOS chip of 8 macrocells, a plug-in replacement for the 20-pin bipolar PALs of Chapter 26.:cite[chm-ep300] Its configuration was in EPROM cells, erased by ultraviolet light through a quartz window in the package.:cite[altera-history] Altera called such a chip an EPLD, an *erasable* PLD: a PAL made reusable.
:::

## Blocks, a matrix and I/O

:::history{year=1988 title="MAX, the multiple array matrix" people="Altera"}
Altera’s MAX 5000 family of 1988, named for its *multiple array matrix*, is usually counted as the first CPLD: up to 5,000 gates and system speeds up to 40 MHz, still erased with ultraviolet light.:cite[altera-history] Each *logic array block* was a PAL-like array with its macrocells, and the blocks talked to each other and to the pins through a **programmable interconnect array** (PIA), a global bus fed by every input pin and every macrocell.:cite[altera-max5000] A small array of your own and a switch matrix for the rest: the idea of Figure 27.1. Every CPLD since has had the same three levels.
:::

- **Function blocks.** Each is a small PAL: in the vCPLD-32, 8 macrocells and a 48-column AND array of 40 product terms (five per macrocell). It is Chapter 26’s PAL with one difference: it sees only **24 signals** at a time.
- **The global interconnect matrix.** Each of a block’s 24 inputs is a multiplexer (6 configuration bits) that chooses one of the chip’s 64 signals: the 32 pins and the 32 macrocell outputs. Any 24 can be chosen, but the crossbar is made of multiplexers, not of a fuse at every crossing. A XC9500 block has 36 inputs and 18 macrocells (its matrix is FastCONNECT);:cite[xilinx-ds063] the MAX 7000’s PIA brings 36 signals to a block of 16.:cite[altera-max7000]
- **I/O blocks.** Each macrocell is paired with a pin, through an output buffer with an enable (Chapter 26’s tri-state) and an input buffer that feeds the matrix. A macrocell that drives its pin uses it up; a :term[buried macrocell]{id=buried-macrocell} feeds only the matrix and leaves its pin free as an input.

A signal from one block to another leaves its macrocell, crosses the matrix and arrives, in the same time as a signal from a pin. The vCPLD-32 is modelled on the XC9500 and MAX 7000, scaled down until every configuration bit fits on the screen; the table gives real parts.

| Part | Macrocells | Structure | Supply | Notes |
|---|---|---|---|---|
| Altera MAX 7000 | 32 to 512 | blocks of 16, 5 terms each, PIA | 5 V, later 3.3 V | EEPROM, ISP, expanders:cite[altera-max7000] |
| Xilinx XC9500 | 36 to 288 | blocks of 18, 36 inputs, FastCONNECT | 5 V | flash, ISP, JTAG:cite[xilinx-ds063] |
| Xilinx XC9572XL | 72 | 4 blocks of 18, 54 inputs each | 3.3 V | 5 ns pin to pin, 10,000 erase cycles:cite[xilinx-ds054] |
| Xilinx CoolRunner-II | 32 to 512 | product terms and a matrix | 1.8 V core | low power, DataGATE:cite[xilinx-ds090] |
| Atmel/Microchip ATF1502AS | 32 | 5 terms each, expandable to 40 | 5 V | 44 pins, 7.5 ns, JTAG:cite[microchip-atf1502] |
| Altera MAX II (2004) | 240 to 2,210 logic elements | look-up tables | 1.8 V core | a small FPGA (see below):cite[altera-maxii-2004] |

## A macrocell that counts

The macrocell of Chapter 26 had a D flip-flop, a polarity XOR, an enable and a feedback. The CPLD’s has one more choice, and it is why CPLDs are good at counters: the flip-flop can be a **T flip-flop**, which toggles when its input is 1. A binary counter bit toggles exactly when all the lower bits are 1 (and the counter is enabled): a single AND. With D flip-flops the same bit needs an XOR with its own value, and the sum of products grows by a term for every bit up.

::circuit{src="27-cplds/circuits/t-counter.json" n="27.2" title="A counter is one product term per bit" mode="logic" speed=1e-6 caption="Flip EN, then press Clock. Each T flip-flop toggles when its T input is 1: bit 1 when EN and Q0 are on, bit 2 when EN, Q0 and Q1 are. Each AND gate is one product term; an AND and a T flip-flop make a macrocell."}

:::lab[Count with T flip-flops]
Use Figure 27.2.

1. Turn EN on and press Clock eight times: 1, 2, … 7, then 0. Bit 2 toggles only on the presses that follow Q0 and Q1 both being 1.
2. Turn EN off and press Clock. Nothing happens: every T input is 0. A count enable costs one literal per term.
3. The Studio’s fitter agrees. Fit its 4-bit counter with a clear: it chooses T flip-flops, **two** terms per bit. Add `# @ff Q0=D Q1=D Q2=D Q3=D` to the source to force D flip-flops and the bits need 2, 3, 4 and 5 terms.
:::

## Product-term steering

Five product terms is not many, and the GAL of Chapter 26 refused any output that needed more. A CPLD borrows. Each macrocell owns five term slots, and each slot has a two-bit switch, the :term[product-term steering]{id=product-term-steering}, that sends its term to the OR gate of its own macrocell, of the one above it in the block, of the one below it, or nowhere. A macrocell that needs eight terms takes its five and three unused slots of a neighbour. Nothing is passed on, so a macrocell collects at most its own five and the five of each neighbour: 15 in the vCPLD-32.

Real parts do the same with other names. In the MAX 7000 the borrowed terms are *parallel expanders*: three sets of five from neighbours, up to 20 product terms into one OR gate, besides *shareable expanders*, inverted terms that any macrocell of the block can use.:cite[altera-max7000] The XC9500 has a product-term allocator, and its data sheet advertises up to 90 terms in a macrocell, the whole of an 18-macrocell block’s worth.:cite[xilinx-ds063]

Borrowing has two prices: the lender has fewer terms of its own, and the borrower is slower, by a nanosecond in the course’s model. The first price is a puzzle for the fitter, because the chain has two ends.

```quiz
q: 'In a function block of eight macrocells in a chain, an output needs 12 product terms and its neighbours are idle. Where can the fitter put it?'
options:
  - text: In any macrocell.
    why: 'Almost. A macrocell at the end of the chain has only one neighbour to borrow from, so it can collect at most its own 5 and that neighbour’s 5.'
  - text: In any macrocell except the two at the ends of the block.
    correct: true
    why: 'A macrocell inside the chain has two neighbours, and can collect 5 + 5 + 5 = 15 terms. A macrocell at an end has one, and can collect only 10. So 12 fits anywhere from macrocell 1 to 6 but not in macrocell 0 or 7.'
  - text: Only in a macrocell whose neighbours are also full.
    why: 'The other way round: borrowing needs neighbours with spare slots. Full neighbours have nothing to lend.'
```

::allocator-lab{n="27.3" caption="Each row is a macrocell of one block; the buttons set how many product terms it needs. Amber slots are used by their own macrocell; copper slots with an arrow are lent to the macrocell the arrow points to (↓ the next row, ↑ the previous). The allocator is the course’s own, and minimises the terms borrowed. Try the scenarios, then “Let the fitter place them”."}

:::lab[Borrow product terms]
Use Figure 27.3.

1. Pick *One wide output*. MC3 needs 12 terms: its own five, three from MC2 and four from MC4. But MC2 and MC4 need two each, so they can spare only three, and MC4 borrows one from MC5. Eight terms are borrowed in all, and each macrocell that borrows takes 8.5 ns instead of 7.5.
2. Pick *12 terms at the end*. MC0 needs 12 and can collect only 10. Press *Let the fitter place them*: the output moves inside the chain and the block fits.
3. Pick *Crowded block* (40 terms in 40 slots): the allocator still finds an answer, by a long chain of borrowing. Press + on any macrocell and it cannot.
4. Try *4-input parity*: 8 terms whichever way round (Chapter 26), so one macrocell borrows three.
:::

## Fitting: from equations to a configuration

A CPLD’s :term[fitter]{id=fitter} has more to do than a PAL’s. Its input is still equations (Chapter 29 will replace them with a hardware description language, and the fitter will not notice), and its output is the 9,024 configuration bits. The steps:

1. **Minimise** every output in both polarities, and a registered one also for a T flip-flop, keeping the candidate with the fewest terms.
2. **Partition** the outputs among the four blocks. A block sees only 24 signals, so outputs that share signals should share a block. This is graph partitioning (see the box at the end).
3. **Place and allocate** inside each block: which macrocell for which output, and where to steer the term slots.
4. **Assign pins.** A macrocell and its pin are paired; inputs take pads whose macrocell drives nothing.
5. **Route the matrix**: set each block’s input multiplexers to the signals its terms read, and **write the bits**.

The trees below stand for a design’s hierarchy, which Chapter 29 will write as modules. The fitter flattens it, as every fitter does, but the widget remembers whose macrocell is whose.

::floorplan-map{n="27.4" design="bcd" caption="Hover or focus a module to light its macrocells; click a macrocell for its equation (the number on a cell is its product terms). “The fitter’s choice” is the real partitioning; “Spread over the blocks” pins consecutive outputs into different blocks: each block then reads many more signals, but the delays do not change. Buried macrocells are dashed."}

:::lab[Read the floorplan]
Use Figure 27.4.

1. In *BCD counter and display*, hover the *counter*: four flip-flops in FB0. The decoder’s segments are stored active low, as in Chapter 26. Eleven macrocells in two blocks, and the design reads **9** of the 96 signals the matrices could carry.
2. Switch to *Spread over the blocks*: four blocks, and **24** signals. The fitter’s partition cut the traffic through the matrix by more than half. *Worst pin to pin* and *Worst clock to output* are 7.5 ns and 4.5 ns both times.
3. Pick *8-bit adder*: sixteen macrocells, four blocks of six signals each (24), or 48 spread. Both show **42.5 ns** pin to pin. Hover *COUT*: it sits behind seven combinational macrocells, which is where the number comes from.
:::

## The lab bench: fit and program a vCPLD-32

Below is the whole device: the equations of a decade counter driving a seven-segment decoder (source), the four function blocks with their AND arrays and the matrix (chip), the two-level logic recovered *from the configuration bits* (logic: what the chip does is what the bits say), the bits themselves, and a report. (“Open in the Studio” adds a JTAG tab that programs the chip; Figure 27.6 below does the same.) The equations use Chapter 26’s syntax, with `.R` for a registered output and `Y.E` for an output enable.

::device-studio{device="cpld32" example="bcd-display" views="source,chip,logic,bits,report" n="27.5" caption="Set EN in the run bar and press Clock: the counter counts and the segments follow, in the chip and in the logic view, two views of the same bits. In the chip view zoom with + and − and drag to move: each block has its AND array (a mark is a connected literal), its macrocells and, in copper, the steering lines that carry a term to a neighbour. Select a macrocell in one pane and it lights in the others. The Source tab’s picker has the other examples."}

:::lab[Fit four designs]
Use Figure 27.5.

1. **The BCD display.** 11 macrocells, 28 of 160 product terms, none borrowed; FB0 is full (8 macrocells, 23 terms, 6 of 24 inputs). Q3 and Q0 are D flip-flops, Q2 and Q1 T flip-flops: the fitter chose per output. Set EN and clock nine times: the digit reaches 9. Then set CLR.
2. **The traffic light.** Ten terms in eight macrocells, all in FB0: the same ten as the GAL22V10 needed. RST, CAR and T are on pads of FB1, and FB0 reads them through the matrix: a pin need not be in the block that uses it.
3. **Parity.** Eight terms, three borrowed: the report says *Borrowed 3* and a worst pin to pin of 8.5 ns, against the counter’s 7.5.
4. **The bits.** The BCD display sets 193 of the 9,024 configuration bits, 12 of them the USERCODE, a signature that the designer writes into the chip and reads back over JTAG.
:::

## Timing that you can know in advance

Every signal in the vCPLD-32 crosses the matrix, goes through one AND array and OR gate, and goes through one macrocell. So the delay of a path depends on *what kind of path it is*, not on where the fitter put its parts. That is why CPLDs were the choice for glue logic and state machines that had to meet a datasheet: the delays could be read from it before the design began. In the vCPLD-32, rounded from a “-7” part of the XC9500 and MAX 7000 class:

| Path | Delay |
|---|---|
| Input pin to output pin, combinational (tPD) | 7.5 ns |
| Input pin to a register, setup before the clock (tSU) | 4.5 ns |
| Clock to output pin (tCO) | 4.5 ns |
| Extra, when the macrocell collects borrowed product terms | + 1.0 ns |
| Extra, for each combinational macrocell a signal passes through on the way | + 5.0 ns |

```quiz
q: 'The 4-bit adder of the Studio’s example list has three carries, C1, C2 and C3, each in a buried combinational macrocell, and COUT reads C3. What is the worst pin-to-pin delay to COUT?'
options:
  - text: 7.5 ns, as for every combinational output.
    why: 'That is the delay of a path that goes through the matrix and one array only. The carries are macrocells in the way: each one is another trip through the matrix and an array.'
  - text: 15 ns.
    why: 'That would be one extra macrocell. Count the carries the signal passes: C1, then C2, then C3.'
  - text: 22.5 ns.
    correct: true
    why: 'The path is A0 → C1 → C2 → C3 → COUT: the base 7.5 ns plus 5 ns for each of the three buried macrocells in the way, 7.5 + 3 × 5 = 22.5 ns. Select the adder in Figure 27.5 and read it in the report.'
  - text: It depends on where the fitter puts the carries.
    why: 'It does not. Every signal goes through the same matrix. That is the point of a CPLD.'
```

The 8-bit adder of Figure 27.4 needs seven buried carries: 7.5 + 7 × 5 = 42.5 ns, in the fitter’s placement *and* in the spread one. A ripple-carry adder is slow because of its structure (Chapter 14 showed the cure), and a CPLD tells you so before the fitter has run. In an FPGA (Chapter 28) a signal goes over wire segments and through switches that the placer and router choose, so the delay is known only after they have run.

The same structure gives the maximum clock: a register-to-register path is 8 ns here, 125 MHz whatever the design. The model’s 7.5 ns and 125 MHz are those of the fastest ATF1502AS grade; the XC9572XL is quicker, at 5 ns.:cite[microchip-atf1502]:cite[xilinx-ds054]

## Non-volatile, instant-on

A CPLD’s configuration cells are EEPROM or flash, the floating-gate cells of Chapter 25, so the design survives a power cut and the chip works the moment the supply is up, with no other chip to load it. The vCPLD-32 models that: only its flip-flops start again, at their power-up values. An *erased* part is inert, with no term enabled and no pin driven, which is what you want of a chip already soldered to a board and waiting to be programmed.

The price is endurance: the XC9500XL is rated for 10,000 program and erase cycles.:cite[xilinx-ds054] An SRAM-based FPGA (Chapter 28) has no such limit, and no non-volatility either: it is loaded from outside at every power-up.

## In-system programming and JTAG

A GAL22V10 is programmed in a socket on a bench programmer, then soldered. A CPLD in a fine-pitch package is soldered blank and programmed *in place*: :term[in-system programming]{id=in-system-programming}. What is needed is a way to get bits into a chip whose pins are already wired to a board, and that way exists for a reason that has nothing to do with programmable logic.

:::history{year=1990 title="JTAG: finding bad solder joints" people="The Joint Test Action Group, IEEE"}
By the mid-1980s the pins of a board’s chips were under them or too close for a probe, and most faults on manufactured boards were bad solder joints. Test engineers from Philips, British Telecom, GEC, Texas Instruments and others formed the *Joint Test Action Group* in 1985 to put a way of looking at every pin into the chips themselves.:cite[corelis-jtag] The result was IEEE Std 1149.1, ratified on 15 February 1990: four test pins (TDI, TMS, TCK, TDO, and an optional reset), a state machine that controls them, and a **boundary-scan cell** on every pin.:cite[ieee1149-1-1990] The name JTAG stuck.
:::

:::history{year=1995 title="Program it after you solder it" people="Xilinx"}
Xilinx introduced its XC9500 family at the end of 1995 with in-system programming through the JTAG port: manufacturers could assemble boards with blank CPLDs, configure them afterwards, build several products from one board and upgrade them in the field.:cite[xilinx-ds063] The MAX 7000S did the same.:cite[altera-max7000] The test port every chip already had proved the ideal programming port.
:::

The port has four wires: **TCK** is the clock, **TMS** the mode select, **TDI** data in and **TDO** data out. The chips of a board are chained, each TDO to the next TDI, so four wires reach every device. Inside each chip is a 16-state machine, the :term[TAP controller]{id=tap-controller}, that moves on every rising edge of TCK to one of two states, chosen by TMS: a finite-state machine like Chapter 19’s. Two states are resting places (*Test-Logic-Reset* and *Run-Test/Idle*), and the rest are two identical columns, one that moves data through a **data register** (DR) and one that moves an **instruction** through the instruction register (IR).

```quiz
q: 'The TAP is in Run-Test/Idle. You send TMS = 1, then 0, then 0, on three rising edges of TCK. Where is it?'
options:
  - text: In Shift-IR.
    why: 'The instruction column is reached with two ones: Run-Test/Idle, Select-DR-Scan, Select-IR-Scan, then Capture-IR and Shift-IR on zeros. Here there is only one 1.'
  - text: In Shift-DR.
    correct: true
    why: 'TMS = 1 goes to Select-DR-Scan, the first 0 to Capture-DR (where the register loads its value), and the second 0 to Shift-DR, where each further clock moves the register one place towards TDO.'
  - text: Still in Run-Test/Idle.
    why: 'Only TMS = 0 keeps the TAP idle. The first 1 takes it out.'
```

::jtag-tap{n="27.6" caption="Drive it: press the TMS buttons and follow the state (0, 1, 0, 0 leads from reset to Shift-DR; 0, 1, 1, 0, 0 to Shift-IR; five ones lead to reset from anywhere). Watch a programming run: the real sequence that programs a vCPLD-32 with a counter, clock by clock, with TMS, TDI and TDO as traces. Step it and jump between phases."}

:::lab[Program a chip over four wires]
Use Figure 27.6.

1. In *Drive it*, press *Reset* and reach Shift-DR with 0, 1, 0, 0. Leave through Exit1-DR and Update-DR to Run-Test/Idle: a scan costs three clocks to get in, one per bit, and two to get out.
2. Switch to *Watch a programming run*. The host sends five TMS = 1 clocks, then reads the **IDCODE**: 32 bits, `1C0321FF` for the vCPLD-32 (a code that belongs to no real manufacturer). The first thing any tool does with an unknown chip is read it.
3. Go through the phases: **ISC_ENABLE** starts programming mode (pins off, flip-flops frozen); **ISC_ERASE** clears every bit, and the chip is busy for eight idle clocks; **ISC_PROGRAM** shifts in each row, 64 data bits and an 8-bit address, and waits three idle clocks; **ISC_VERIFY** reads every row back; **ISC_DISABLE** ends programming mode and the chip restarts from its new configuration.
4. Count. The counter needs 10 of the 141 rows, so writing takes about 800 clocks; reading back all 141 takes about eleven thousand. (A real row’s programming pulse takes milliseconds, and then writing dominates.)
:::

The instruction register is 8 bits. Its instructions select which data register the next scan goes through:

| Instruction | Data register | What it does |
|---|---|---|
| `IDCODE` (0xFE) | 32 bits | the part number; selected by reset |
| `USERCODE` (0xFD) | 32 bits | the designer’s own signature, kept in the last row of the configuration |
| `BYPASS` (0xFF) | 1 bit | a one-bit shortcut, so that a chain of chips can be scanned past this one |
| `SAMPLE/PRELOAD` (0x01), `EXTEST` (0x00) | the 99 boundary cells | see below |
| `ISC_ENABLE`, `ISC_ERASE`, `ISC_PROGRAM`, `ISC_VERIFY`, `ISC_DISABLE` (0xE9, 0xEC, 0xEA, 0xEE, 0xC0) | 1 bit, or the 72-bit row register | programming |

The standard fixes the port, the TAP and the boundary scan, and leaves the programming instructions to each manufacturer. That is why a programming tool needs a description of the chip, and why open-source tools such as the ones in the last box had to work out each family’s instructions and fuse map.

## Boundary scan: looking at the pins

The standard’s own job is boundary scan. Between the logic and each pin sits a cell: the vCPLD-32 has three per pin (what is on the pin, what to drive, whether to drive it) and three for the clock, reset and output-enable inputs: 99, chained into one long shift register. With the right instruction a tester can **SAMPLE** every pin at one instant without disturbing the chip, or **EXTEST**: cut the logic off from the pins and drive them from the cells. Put both on two chips joined by a board and you can test the board without a probe: drive a pattern from U1 and capture on U2 what arrived. A net that delivers what was sent is fine; one that does not is broken, and the tester says which.

```quiz
q: 'Chip U1 drives a 1 onto a net whose solder joint at U2 is broken, so the net does not reach U2. What does the boundary-scan cell of U2’s pin capture?'
options:
  - text: 1, because U1 drove it.
    why: 'The 1 never arrives: the joint is open. What the cell captures is what is on U2’s pad.'
  - text: 'Whatever the floating pad happens to be (0, in the model here). Either way it is not the 1 that was sent.'
    correct: true
    why: 'An open input floats. In this model the floating pad reads 0, in real boards it is decided by a pull-up, a pull-down or noise. The tester does not need to know which: it compares what arrived with what was sent, and a net that fails to deliver a 1 is broken.'
  - text: The test cannot tell, because a chip cannot see its own pins.
    why: 'Looking at the pins is exactly what the input boundary cells are for.'
```

::boundary-scan{n="27.7" faults="3:open,5:stuck0" caption="Two vCPLD-32s joined by eight nets. Click a net to cycle its fault (good, open, short to ground, short to supply), then run the test: U1 drives a walking 1 and a walking 0 (16 patterns) with EXTEST, and U2 captures each with SAMPLE. A red cell did not arrive. An open net floats low in the model, so it looks stuck low: the test finds the net, and a second look finds the cause. The scans run on the course’s real JTAG code (a real board would chain the two chips)."}

:::lab[Find the broken nets]
Use Figure 27.7.

1. Run the test as it stands: N3 (open) and N5 (short to ground) are reported, and only those. Their columns are all zeros; the other six show a diagonal of ones in the top half.
2. Clear both faults (click a net until it shows no mark) and run: all sixteen patterns arrive. Now short only N2 to the supply: the eight patterns that send it a 0 catch it, and the eight that send a 1 pass. That is why the test walks a 0 as well as a 1.
3. The whole test is about 7,400 TCK cycles across the two chips: under a millisecond at 10 MHz.
:::

## Today’s CPLDs

CPLDs survive because they do what FPGAs do not: start instantly, with predictable delays, from one cheap chip, on a board with nothing else to configure them. They are the glue of a board: address decoding, level shifting, reset sequencing. The market is shrinking: AMD, which owns Xilinx, has announced the end of its XC9500 and CoolRunner families,:cite[eejournal-amd-eol] and the ATF1502AS of the lab below is one of the few 5 V parts left, so check that it is available before you order.

:::history{year=2004 title="MAX II, a CPLD that is really an FPGA" people="Altera"}
In March 2004 Altera announced MAX II, called a CPLD but built differently: an embedded-flash process, a **look-up-table** architecture instead of product terms, and channel-based routing.:cite[altera-maxii-2004] Like a CPLD it started by itself in a few milliseconds from on-chip flash; unlike one, its timing is not the same for every path. It is a small FPGA (Chapter 28 says what a LUT is) with its configuration memory built in, and many of today’s “CPLDs” are of that kind.
:::

The dividing line is the architecture, not the name. Product terms and a matrix, with the same delay for every path: a CPLD in this chapter’s sense. Look-up tables and a routed fabric, however small and however instant the start: an FPGA, and the next chapter opens one up.

## Under the hood

:::hood[Partitioning, allocation and the TAP]
The fitter is in `src/lib/pld/cpld/`. **Partitioning** (`partition.ts`) prices every candidate block: the signals it must read, 100 for each above 24, a large penalty if its terms cannot be allocated, and half a point per borrowed term:

```ts
const inputs = set.size;
let cost = inputs;
if (inputs > limit) {
  cost += INPUT_PENALTY * (inputs - limit);
  problem = 'inputs';
}
// ... too many macrocells, or more terms than the block has slots: a penalty of 1000 ...
arrangement = arrangeFb(members, reserved[fb]);
if (arrangement) cost += borrowWeight * arrangement.borrowed;
```

A greedy pass puts each output, largest support first, where the cost rises least (the block that already reads most of its signals). Then **Kernighan–Lin** passes make the best single move or swap even when it makes the cost worse, lock what they moved, and keep the prefix of moves that gained most. Accepting a worse move lets the search climb out of the local minima that stop plain hill-climbing. That is how the BCD display of Figure 27.4 came to read 9 signals, not 24.

**Allocation** (`allocator.ts`) is a transportation problem on a path. A slot lent from *i* to *i* + 1 and one lent the other way would cancel, so each of the seven links carries a net flow *f* from −5 to +5, and a dynamic programme over the chain, with the flow on the previous link as its state, finds the flows of least total |*f*| that give every macrocell its terms. At each macrocell it checks:

```ts
const own = need[i]! - ((g > 0 ? g : 0) + nf);
if (own < 0) continue;
if (own + pf + (g < 0 ? -g : 0) > cap[i]!) continue;
const cost = before + (f < 0 ? -f : f);
```

where `g` is the flow on the link below, `f` the flow above, `nf` and `pf` the negative and positive parts of `f`, and `cap[i]` is five (four when slot 4 is an output-enable term). The macrocell uses `own` slots itself and lends `pf` up and `−g` down, and the three must fit in `cap`. When there is no solution, a left-to-right greedy says where the chain runs out: that is the message *Macrocell 0 of the block needs 12 product terms but can collect only 10*. Because a demanding output wants idle neighbours, `arrangeFb` also searches over which macrocell each output sits in: hill-climbing, a second start with heavy outputs in the middle of the chain, and, if all that fails, every permutation.

The **TAP controller** (`jtag.ts`) is the state diagram of the standard as a table, with the next state for TMS = 0 first, and TMS = 1 second:

```ts
const TRANSITIONS: Readonly<Record<TapState, readonly [TapState, TapState]>> = {
  'Test-Logic-Reset': ['Run-Test/Idle', 'Test-Logic-Reset'],
  'Run-Test/Idle': ['Run-Test/Idle', 'Select-DR-Scan'],
  'Select-DR-Scan': ['Capture-DR', 'Select-IR-Scan'],
  'Capture-DR': ['Shift-DR', 'Exit1-DR'],
  'Shift-DR': ['Shift-DR', 'Exit1-DR'],
  // ...
```

The tests check all 32 entries against the standard’s diagram written out separately, and `JtagHost` finds the TMS sequence to any state with a breadth-first search (`tapPath`).

What the course has not done is check the vCPLD-32 against a physical part. It is modelled on the XC9500 and MAX 7000 architectures with rounded delays, and it is not a real device, so there is no JEDEC file for it. Only the lab below runs on a real chip.
:::

## Build it for real

:::real{parts="ATF1502AS-7AX44 (TQFP-44) or ATF1502AS-10JU44 (PLCC-44) CPLD, a TQFP or PLCC 44-pin breakout board or socket adapter (or a ready-made ATF1502 dev board), an FT232H USB breakout board as a JTAG adapter, 5 V USB supply module, 4 × 100 nF capacitors, 4 LEDs, 4 × 1 kΩ resistors, a pushbutton and a 10 kΩ resistor, breadboard and jumper wires"}
Read a real chip’s IDCODE, boundary-scan a pin and program it in place. The ATF1502AS (32 macrocells, 5 V) has an open-source toolchain.

1. Mount the CPLD on its breakout or socket. Every VCCINT pin goes to +5 V and every GND pin to ground, with a 100 nF capacitor near each supply pin; the VCCIO pins supply the output drivers, and the datasheet says which levels they select.:cite[microchip-atf1502] Four pins carry TCK, TMS, TDI and TDO (the pinout table says which).
2. Wire the FT232H’s ADBUS0 to 3 (TCK, TDI, TDO, TMS) to those pins, with a common ground. The FT232H’s I/O is 3.3 V: check that the CPLD’s input thresholds accept it, and set VCCIO to suit.
3. With OpenOCD, declare a scan chain with one TAP and run `scan_chain`. It reads the chip’s 32-bit IDCODE, whose fields (version, part, manufacturer) are those of Figure 27.6’s `1C0321FF`; the BSDL file that Microchip publishes for the part gives the value to expect. The chip is alive, and no bit has been written.
4. Boundary scan: put an LED on an I/O pin, and with OpenOCD’s `irscan` and `drscan` load EXTEST and shift a 1 into that pin’s output and enable cells (the BSDL file gives their positions). The LED lights, although the chip has never been programmed. It is what Figure 27.7 did on a board.
5. Program it. Project Bureau documents the ATF15xx fuse maps and programming algorithms:cite[prjbureau] and gives an open flow: write a 4-bit counter with enable and clear in Verilog (Figure 27.5’s, with its bits on four LEDs), synthesise it with Yosys and the `atf15xx_yosys` techmap to a JED file (Chapter 26’s format), convert it with `fuseconv` to an SVF file, and play that into the JTAG port with OpenOCD. The vendor route is Microchip’s ISP software and its ATDH1150USB cable.
6. Power the chip off and on: the counter runs again the moment the supply is up. Nothing loaded it.

The vCPLD-32 is not a real part, so the Studio cannot write a JED file for it: the design must be written again, in Verilog. Compare the real fitter’s report (macrocells, product terms) with the Studio’s 4 macrocells and 8 terms. If yours differ, write to the author: that comparison is the check the model needs.
:::

## Exercises

```quiz
q: 'An output reads 30 different signals. A function block can see 24. What can the designer do?'
options:
  - text: 'Nothing: no CPLD of this kind can implement it.'
    why: 'It can, by splitting the logic. The limit is on what one block can *read*, not on what the chip can compute.'
  - text: 'Compute part of it in a buried macrocell of another block, and use that macrocell’s output as one signal of the terms that need it.'
    correct: true
    why: 'A buried macrocell feeds the interconnect matrix and no pin, and any block can select its output as one of its 24 inputs. Six signals collapsed into one intermediate result leave 25; a bigger intermediate result would do more. (The fitter’s partitioner does not do this for you: it partitions outputs, not the logic inside one.)'
  - text: 'Put the output in the block with the most macrocells free.'
    why: 'Free macrocells do not help when the limit is the number of signals the block can look at.'
```

```quiz
q: 'You move an output of a fitted design from one function block to another (a pin constraint) and refit. What happens to its pin-to-pin delay?'
options:
  - text: 'It stays the same, unless the output now has to borrow product terms.'
    correct: true
    why: 'Every path crosses the interconnect matrix, one array and one macrocell. Where the macrocell is does not matter (Figure 27.4 changed the placement of the adder and its 42.5 ns stayed). Only borrowing adds 1 ns, and buried macrocells in the path 5 ns each.'
  - text: 'It grows, because the signal has to cross to another block.'
    why: 'Crossing blocks is what every signal does: the matrix connects all blocks to all signals, at one fixed delay.'
  - text: 'It depends on how far the two blocks are on the chip.'
    why: 'In the FPGA of Chapter 28, distance costs delay. In a CPLD the matrix hides distance, at the price of a slower fixed delay.'
```

```quiz
q: 'Why does the configuration of a CPLD survive a power cut, while the configuration of most FPGAs does not?'
options:
  - text: 'A CPLD stores it in EEPROM or flash cells; most FPGAs store it in SRAM, which forgets when the power goes.'
    correct: true
    why: 'That is Chapter 25’s table of programming technologies again. The flash cell keeps its charge without power and limits the endurance (about ten thousand cycles); the SRAM cell can be rewritten without limit and must be loaded at every power-up.'
  - text: 'A CPLD is programmed over JTAG, and an FPGA is not.'
    why: 'Many FPGAs are programmed over JTAG too. How the bits are *written* does not decide whether they are *kept*.'
  - text: 'A CPLD has fewer configuration bits.'
    why: 'The vCPLD-32 has 9,024, which is tiny, but even a huge flash device would keep its bits. The technology decides.'
```

```parsons
title: 'Programming a CPLD in place'
prompt: 'Put the steps of a JTAG programming run in order.'
lines:
  - 'Send five clocks with TMS = 1: the TAP is in Test-Logic-Reset. Read the IDCODE.'
  - 'Load ISC_ENABLE: programming mode starts, the pins go off.'
  - 'Load ISC_ERASE and wait for the device to finish (eight idle clocks).'
  - 'Load ISC_PROGRAM and scan in each non-blank row: 64 data bits, then its address.'
  - 'Load ISC_VERIFY and read every row back, comparing it with the file.'
  - 'Load ISC_DISABLE: the chip leaves programming mode and starts from its new configuration.'
distractors:
  - 'Program the rows first: programming can only set bits, so the erase can come after.'
  - 'Copy the bits from a serial flash chip into the array every time the power comes on.'
```

```bug
title: 'What a stuck-looking net means'
prompt: 'A test technician runs the walking-1 and walking-0 interconnect test and reads the result. Click the first line of the reasoning that goes further than the test can justify.'
lines:
  - 'U1 drives each pattern onto nets N0 to N7 with EXTEST, and U2 captures it with SAMPLE.'
  - 'N5 shows 0 in all sixteen patterns, including the ones in which U1 drove it high.'
  - 'So N5 does not deliver a 1: it is faulty, and the test has found it.'
  - 'So N5 is shorted to ground, and the fix is to look for solder bridging N5 to a ground pad.'
wrong: 3
why: 'A net that reads 0 whatever is sent is either shorted to ground or open: an open input floats, and in this model floats low (on a real board it depends on a pull-up or pull-down). The test proves that the net is faulty and which net it is. Which fault it is takes a second look, at the joint under a microscope or with another measurement.'
notes:
  '0': 'A fair description of the interconnect test.'
  '1': 'True: the net never delivers what was sent.'
  '2': 'Justified: a good net would have agreed in every pattern.'
```

:::challenge[The cost of a verify]
Reading a row back with ISC_VERIFY takes one scan of the 72-bit row register: three clocks from Run-Test/Idle to Shift-DR, 72 clocks of shifting (the last with TMS = 1), then Update-DR and a return to Run-Test/Idle: two more. Verify is pipelined, so reading *N* rows takes *N* + 1 scans. How many TCK cycles does it take to verify all 141 rows of the vCPLD-32, and how long is that at a TCK of 1 MHz? Compare with writing the 10 non-blank rows of the counter, which needs a scan and three idle clocks for each.

*Answer.* A scan is 3 + 72 + 2 = 77 clocks. Verifying 141 rows takes 142 scans: 142 × 77 = 10,934 clocks, which is 10.9 ms at 1 MHz. Writing the counter’s 10 rows is 10 × (77 + 3) = 800 clocks, under a millisecond: verification is about fourteen times the writing, which is what the programming run of Figure 27.6 showed. Real programmers often verify only the rows they wrote, or use a checksum, for this reason. (The model’s row pulse takes 3 idle clocks; a real flash row takes milliseconds, and then writing dominates.)
:::

## What’s next

A CPLD is a small number of large blocks, each a sum-of-products, joined by a matrix in which every path costs the same. That is why it is predictable, and it is also why it stops at a few hundred macrocells: the blocks get wider, the matrix gets bigger, and a sum of products is not the way to build a large adder or a multiplier, however many terms you can borrow. Chapter 28 takes the opposite bet. It gives up the AND–OR array entirely and fills the chip with thousands of tiny look-up tables, each a 16-bit memory that computes any function of four inputs, and with wires and switches that a program will have to route. The delays will no longer be the same for every path, and that is the price of the freedom: a chip in which the design decides where the wires go.
