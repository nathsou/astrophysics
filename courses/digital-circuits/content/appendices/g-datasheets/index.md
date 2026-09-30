---
number: G
title: Virtual device datasheets
summary: "One datasheet for every virtual device of Part VI, in the style of the originals: features, block diagram, pins, fuse or configuration layout, timing and programming, with the numbers of the models themselves."
duration: Look things up
prerequisites: []
---

A datasheet is the page a manufacturer writes so that you can use a chip without asking anyone. This appendix has one for each virtual device of [Part VI](/chapters/programmable-logic/): the vPROM, the vPLA, the GAL22V10, the vCPLD-32, the three vFPGAs, and the virtual board they sit on. They follow the layout of the real ones (features, block diagram, pins, programming, timing), and every number in them is read from the models. The tables that quote the code are checked by tests against the code, and so are the drawings, which are drawn from the models rather than beside them.

Three things that a real datasheet would have are missing, on purpose, and the datasheets say so where it matters.

- **Electrical ratings.** The models are logic: 0, 1, X and Z. A virtual chip has no supply current, no output drive strength and no maximum voltage; the parts with ratings that can be exceeded are the analog engine’s (Appendix C).
- **Delays, for the fuse devices.** The vPROM, vPLA and GAL22V10 evaluate at zero delay. The vCPLD-32 and the vFPGAs have timing models, and the tables give them.
- **A package, for all but the GAL.** Only the GAL22V10 is a real part with pins in a numbered package. The others have named signals, drawn as a functional symbol.

Every device has a **Device Studio** link: the datasheet tells you what a bit does, the Studio lets you set one and watch.

## vPROM

*A 32 × 8 fuse-programmable read-only memory, after the bipolar PROMs of the 1970s.*

### Features

- Five address lines, eight data outputs: 32 words of 8 bits.
- One fuse for every stored bit: 256 in all, at the crossing of a word line and a bit line.
- **One-time programmable.** A blown fuse cannot be repaired: programming can only turn zeros into ones, and asking for a one to become a zero again is an error.
- A virgin device reads all zeros; blowing a fuse makes its bit read 1.
- Any function of five inputs and up to eight outputs is a table in it, and the device is the same size whether the function is simple or not: this is the reason PLAs exist (Chapter 25).

::package-drawing{device="prom" n="G.1" caption="The functional symbol. Address lines are named A4 (most significant) to A0, data outputs D7 (column 0, most significant) to D0. The model has no package and no supply pins."}

::block-diagram{device="prom" n="G.2" caption="Block diagram. The decoder selects one word line; every intact fuse on it reads as the virgin value, every blown fuse as the opposite."}

### Characteristics

| Parameter | Value |
|---|---|
| Address lines | 5 |
| Data outputs | 8 |
| Words | 32 |
| Fuses | 256 |
| A virgin fuse reads | 0 |
| A blown fuse reads | 1 |
| Largest device the model allows | 16 address lines, 32 outputs |
| Largest device the Studio builds | 6 address lines, 16 outputs |
| Timing | not modelled (zero delay) |

### Conventions

- The fuse of word *w*, column *c* is number *w* × 8 + *c*. Column 0 is the leftmost bit, D7, so the word is the binary number read left to right across the row, as in a printed fuse map.
- The address is the binary number A4 … A0. In equations the leftmost input is the most significant bit, as in a truth table.
- The Studio sizes the device to the design it is given: N address lines and M outputs for a function of N inputs and M outputs (up to the limits above). A design with more inputs is refused, with the explanation that a PROM needs 2ⁿ words for *n* inputs.

### Programming

| Step | What the model does |
|---|---|
| Plan | Compares the words wanted with the words stored and lists the fuses to blow, one programming pulse each. Refuses, naming the address and the output, if a bit would have to change from 1 back to 0. |
| Apply | Blows the fuses. A pulse on a fuse that is already blown does nothing. |
| Verify | Reads every word and reports the addresses where the stored word differs from the expected one. |

A programmed device is described by a **fuse map**, a JSON document. This is the map of a two-address-line, three-output device holding the words 1, 2, 5 and 7:

```json
{
  "device": "vPROM",
  "version": 1,
  "addressBits": 2,
  "width": 3,
  "words": 4,
  "blownReads": 1,
  "inputs": ["A1", "A0"],
  "outputs": ["D2", "D1", "D0"],
  "fuses": ["001", "010", "101", "111"],
  "data": [1, 2, 5, 7],
  "blown": 7
}
```

::device-studio{device="prom" example="seven-segment" views="source,chip,bits" n="G.3" caption="The vPROM in the Device Studio, programmed as a BCD to seven-segment decoder. Open the Bits view, click a fuse to blow it, and read the word it changes."}

## vPLA

*An 8-input, 16-term, 8-output field-programmable logic array, after the Signetics 82S100 and scaled down.*

### Features

- Eight inputs, each available true and complemented; sixteen product terms; eight outputs.
- A programmable AND plane and a programmable OR plane: a product term is shared by every output that wants it.
- A polarity fuse on every output: active high, or inverted.
- 392 fuses in all: 256 in the AND plane, 128 in the OR plane and 8 for polarity.
- One-time programmable, like the vPROM: a fuse that is blown cannot be restored.
- A virgin device has every fuse intact, so every product term contains both a signal and its complement, is therefore 0, and every output reads 0 (active high).

::package-drawing{device="pla" n="G.4" caption="The functional symbol. Input and output names are I0 to I7 and O0 to O7 unless the design names them."}

::block-diagram{device="pla" n="G.5" caption="Block diagram. An intact AND fuse connects a literal to the term’s AND gate; an intact OR fuse connects the term to the output’s OR gate; the polarity fuse is in front of an exclusive-or."}

### Characteristics

| Parameter | Value |
|---|---|
| Inputs | 8 |
| Product terms | 16 |
| Outputs | 8 |
| AND-plane fuses | 256 |
| OR-plane fuses | 128 |
| Polarity fuses | 8 |
| Total fuses | 392 |
| Timing | not modelled: every path is the same delay in a real PLA, and the vPLA does not give it a number |

### Fuse conventions

| Plane | Fuse | Intact | Blown |
|---|---|---|---|
| AND | one per term and input, true form | the input is in the term | the input is not in the term |
| AND | one per term and input, complement | the complement is in the term | the complement is not in the term |
| OR | one per term and output | the term is in the output’s sum | the term is not in the sum |
| Polarity | one per output | the output is the sum (active high) | the output is the inverted sum |

A term with both forms of an input connected is the constant 0; a term with nothing connected is the constant 1. The fuse map lists each term as a pattern of one character per input: `1` (true form), `0` (complement), `-` (input not connected) or `x` (both connected: the term is 0).

Fuse numbers: the AND fuse of term *t*, input *i*, true form is (*t* × 8 + *i*) × 2, and the complement is the next one; the OR fuse of term *t*, output *o* is *t* × 8 + *o*; the polarity fuse of output *o* is *o*.

::device-studio{device="pla" example="full-adder" views="source,chip,logic,bits" n="G.6" caption="The vPLA in the Device Studio, programmed as a full adder. The product terms are shared by the two outputs where they can be."}

## GAL22V10

*A faithful model of the Lattice GAL22V10 and the Microchip ATF22V10: its pins, its 5,892-fuse map and its output macrocells. The JEDEC file it writes is the file a real programmer accepts.*

### Features

- 24-pin DIP. Twelve dedicated inputs, one of which (pin 1) is also the clock; ten input/output pins, each with an **output logic macrocell** (OLMC).
- A 44-column, 132-row AND array: 22 signals, each true and complemented. Every product term is a row of it.
- Each macrocell sums 8 to 16 product terms, in the pattern 8, 10, 12, 14, 16, 16, 14, 12, 10, 8 from pin 23 down to pin 14; its first row is the output-enable term.
- Each macrocell is programmable **registered or combinational**, and **active high or active low**.
- One asynchronous reset term (AR) for every register, one synchronous preset term (SP).
- Eight bytes of user signature.
- 5,892 fuses: 5,808 in the array, 20 macrocell configuration fuses and 64 signature fuses. Erasable and reprogrammable.

::package-drawing{device="gal22v10" n="G.7" caption="The GAL22V10, seen from above with the notch at the top. Pin 1 is at the top left; the numbers run down the left side and up the right."}

::block-diagram{device="gal22v10" n="G.8" caption="Block diagram, with one output macrocell in detail."}

### Pin descriptions

| Pin | Name | Description |
|---|---|---|
| 1 | CLK/I | The clock of every registered macrocell (rising edge), and an input to the AND array |
| 2–11 | I | Inputs to the AND array |
| 12 | GND | Ground |
| 13 | I | Input to the AND array |
| 14–23 | I/O/Q | Output macrocells. The pin is driven when the macrocell’s output-enable term is true, and otherwise is an input, whose level reaches the array through the macrocell’s feedback |
| 24 | VCC | Supply |

### The AND array

The array has 44 columns. The columns come in pairs, the true form of a signal and then its complement, and the 22 signals alternate between dedicated inputs and macrocell feedbacks. The column of a signal follows from its pin:

| Signal | Columns (true, complement) |
|---|---|
| Dedicated input, pin *p* from 1 to 11 | 4 × (*p* − 1) and the next one |
| Dedicated input, pin 13 | 42 and 43 |
| Macrocell, pin *p* from 14 to 23 | 2 + 4 × (23 − *p*) and the next one |

The 132 rows are, in order: the **AR** row (row 0); for each macrocell from pin 23 down to pin 14, its **output-enable** row and then its **product-term** rows; and the **SP** row (row 131).

| Pin | Output-enable row | First term row | Product terms |
|---|---|---|---|
| 23 | 1 | 2 | 8 |
| 22 | 10 | 11 | 10 |
| 21 | 21 | 22 | 12 |
| 20 | 34 | 35 | 14 |
| 19 | 49 | 50 | 16 |
| 18 | 66 | 67 | 16 |
| 17 | 83 | 84 | 14 |
| 16 | 98 | 99 | 12 |
| 15 | 111 | 112 | 10 |
| 14 | 122 | 123 | 8 |

The fuse at row *r*, column *c* is number 44 × *r* + *c*. **A fuse value of 0 connects the array input to the product term; 1 leaves it out.** A row of all 1s is therefore the constant 1 (nothing is required), a row with both columns of some signal at 0 is the constant 0, and a row of all 0s (the erased state) is 0 as well.

::gal-fuse-layout{n="G.9" caption="The fuse map to scale: 132 rows of 44 columns, coloured by macrocell. The bright row at the top of each group is its output-enable term; the red rows at the top and bottom are AR and SP. Below it, the 20 configuration fuses and the 64 signature fuses."}

### Macrocell configuration

After the array come 20 fuses, two for each macrocell from pin 23 down: fuse 5,808 + 2 × (23 − *p*) is **S0** of pin *p*, and the next one is **S1**.

| Fuse | Value 1 | Value 0 |
|---|---|---|
| S0 | active high: the pin is the sum (or Q) | active low: the pin is the inverse |
| S1 | combinational | registered |

Then the 64 signature fuses, fuses 5,828 to 5,891: eight bytes, most significant bit first.

### Macrocell behaviour

- **Combinational (S1 = 1).** The pin is the sum of the terms (inverted when active low). The feedback into the array is the pin itself, so a macrocell whose output enable is off is simply an input.
- **Registered (S1 = 0).** The sum is the register’s D input, loaded at the rising edge of pin 1. The pin is Q, inverted when active low. **The feedback is always the inverted register output**, whatever the polarity, and never the pin: in active-high mode the array therefore sees the complement of the pin. (Assemblers compensate for this.)
- **Output enable.** The pin is driven while the output-enable term is true, and floats otherwise.
- **AR.** While the AR term is true every register is reset to Q = 0, at once, without a clock. **SP.** When the SP term is true at a rising clock edge, every register is set to Q = 1 instead of loading D. AR wins over SP.
- **Power-up.** Every register is reset (Q = 0).
- **Timing.** Not modelled. A real GAL22V10 has one propagation delay for every path from a pin through the array and a macrocell to a pin (tPD), and a set-up and a clock-to-output time for registered paths; the speed grade of the part sets them (a GAL22V10-15 guarantees a tPD of at most 15 ns). The vGAL evaluates at zero delay.

### JEDEC file

The device is programmed by a JEDEC file (JESD3): the fuses, as text, with two checksums. A file of this device has these fields:

| Field | Meaning |
|---|---|
| `*QP24` | 24 pins |
| `*QF5892` | 5,892 fuses |
| `*F0` | fuses not listed are 0 |
| `*G0` | security fuse not blown |
| `*L<n> <bits>` | fuse states from decimal address *n* on: one field for each array row that is not all zeros, then the 20 configuration fuses, then the 64 signature fuses |
| `*C<hhhh>` | the fuse checksum: the 16-bit sum of the fuses read as bytes, fuse 0 in the least significant bit of the first byte |
| after the closing `*` | ETX, then four hexadecimal digits: the 16-bit sum of every character from STX to ETX |

This is the file the model writes, with the standard header, for a 3-to-8 line decoder with enables and active-low outputs (the model’s own example design). Only the beginning and the end are shown: the fields in the middle are one for each row that is not all ones.

```text
<STX>
Device: GAL22V10 (ATF22V10)
*F0
*G0
*QP24
*QF5892
*L0924 11111111111111111111111111111111111111111111
*L0968 01110111011101111011111111111111111111111111
*L1496 11111111111111111111111111111111111111111111
   ⋮
*L5808 00000101010101010101
*L5828 0100010001000101010000110011001101010100010011110011100000000000
*C59B6
*
<ETX>BD51
```

The layout is that of galette, an open-source assembler for GAL devices, and the model’s files are checked byte for byte against galette’s for its own test cases. What the fuses *do* once programmed follows the datasheet’s description of the macrocell as galette’s source states it; it has not been compared with a physical part.

::device-studio{device="gal22v10" example="traffic-light" views="source,chip,bits" n="G.10" caption="The GAL22V10 in the Device Studio, running a traffic-light controller. Open the Bits view: hover a fuse to see the row, the column, the pin it reads and the product term it belongs to, and download the JEDEC file."}

## vCPLD-32

*A small complex programmable logic device in the style of the Xilinx XC9500 and Altera MAX 7000, scaled down so that every bit can be shown on screen.*

### Features

- Four **function blocks** of eight **macrocells**: 32 macrocells and 32 I/O pins.
- A **global interconnect matrix**: each function block sees 24 signals, chosen from the 32 pins and the 32 macrocell outputs. A full crossbar: where a signal comes from never limits fitting, only the number of signals a block reads.
- In each block, an AND array of 40 product terms (five for each macrocell) of 48 literal columns, and a **product-term allocator**: a macrocell can borrow terms from its neighbours, at most 15 in all.
- A macrocell with a D or T flip-flop, an XOR gate for polarity, and an output buffer with four enable modes.
- **Non-volatile** configuration (flash-like): the device comes up already configured, with every flip-flop at its initial value. Programming can only set bits to 1; erasing clears everything.
- Global clock (GCLK), global set/reset (GSR) and global output enable (GOE).
- An IEEE 1149.1 **JTAG** port with boundary scan and in-system programming.
- 9,024 configuration bits, and a 32-bit USERCODE.

::package-drawing{device="cpld32" n="G.11" caption="The functional symbol. The model has no package: the 32 pads are IO0 to IO31, and pad i belongs to macrocell i (function block i ÷ 8). The bottom pins are the JTAG port."}

::block-diagram{device="cpld32" n="G.12" caption="Block diagram. The dashed lines are the macrocell feedbacks into the interconnect matrix."}

### Characteristics

| Parameter | Value |
|---|---|
| Function blocks | 4 |
| Macrocells per block | 8 |
| Macrocells | 32 |
| I/O pins | 32 |
| Inputs to each function block | 24 |
| Product terms per block | 40 |
| Product terms per macrocell | 5 |
| Most terms one macrocell can collect | 15 |
| Literal columns per term | 48 |
| Configuration bits | 9,024 |
| Configuration rows | 141 rows of 64 bits |

### The macrocell

The sum of a macrocell’s terms is XORed with the `xor` bit and goes either straight to the output (combinational) or into a flip-flop clocked by the rising edge of GCLK. The output, flip-flop or not, is also the macrocell’s feedback into the interconnect matrix, before the output buffer, so buried macrocells can feed back. The 16 configuration bits of a macrocell:

| Bits | Field | Meaning |
|---|---|---|
| 0 | `xor` | invert the sum |
| 1 | `reg` | 1: the output is a flip-flop; 0: combinational |
| 2 | `tff` | 1: a T flip-flop, which toggles when its input is 1; 0: a D flip-flop |
| 3 | `init` | the flip-flop’s value at power-up, and whenever GSR is 1 |
| 4, 5 | `oe` | output enable: 0 never drives the pin (an input pad, or a buried macrocell); 1 always; 2 while GOE is 1; 3 while product-term slot 4 is 1 |
| 6 to 15 | steering | two bits for each of the five term slots: 0 off, 1 to this macrocell, 2 to the macrocell above (m + 1), 3 to the one below (m − 1) |

GSR acts asynchronously on every flip-flop. A borrowed term is not passed on: steering is one hop, inside a block, with no wrap-around and no steering between blocks. A macrocell whose output enable is a product term spends its slot 4 on it.

### Configuration memory

The 9,024 bits are 141 rows of 64. The four function blocks take 2,240 bits each (35 rows, so blocks are row-aligned), and the USERCODE is in the last row.

| Bits of a block (offset from its start) | Contents |
|---|---|
| 0 to 143 | Interconnect: input *k* of the block is a 64-to-1 multiplexer, 6 bits at 6*k*, least significant first. Sources 0 to 31 are the pin levels; 32 to 63 are the macrocell outputs |
| 144 to 2,063 | AND array: the true literal of input *k* in term *t* is bit 144 + 48*t* + 2*k*, its complement the next one; 1 connects the literal |
| 2,064 to 2,103 | Term enables, one for each of the 40 terms: an enabled term with no literal is 1, a disabled term is 0 |
| 2,104 to 2,231 | The eight macrocells, 16 bits each, at 2,104 + 16*m* |
| 2,232 to 2,239 | Reserved (0) |

The bits from 8,960 to 8,991 are the USERCODE, bit *i* at 8,960 + *i*; the last 32 bits are reserved. An erased device (all zeros) is inert: no term is enabled and no pin is driven.

### Timing

Every signal in a CPLD passes through the same interconnect matrix, AND array and macrocell, so the delay of a path depends only on its kind, and not on where the fitter put the logic. That is why CPLDs were the parts of choice for glue logic with guaranteed timing. The constants are those of a “-7” part of the XC9500 and MAX 7000 class, rounded.

| Symbol | Parameter | Value |
|---|---|---|
| tPD | Pin to pin, through combinational logic | 7.5 ns |
| tSU | Input pin set-up before the global clock edge, for a registered output | 4.5 ns |
| tH | Hold time of an input pin after the clock edge | 0 ns |
| tCO | Global clock edge to output pin | 4.5 ns |
| tPTA | Extra delay when a macrocell collects borrowed terms | 1 ns |
| tFB | Extra delay for each combinational macrocell a signal passes through on the way | 5 ns |
| tREG2REG | Register to register inside the device | 8 ns |

The highest clock frequency for register-to-register paths is 1 / tREG2REG = 125 MHz.

### JTAG

The port has four pins: **TCK** (clock), **TMS** (mode select), **TDI** (data in) and **TDO** (data out). The **TAP controller** is a 16-state machine that moves on each rising edge of TCK according to TMS; five cycles with TMS at 1 lead to Test-Logic-Reset from any state. The instruction register is 8 bits, shifted least significant bit first; Capture-IR loads `00000001` with status bits above the mandatory `01`: bit 2 says the device is in programming mode, bit 3 that a program or erase pulse is still running, bit 4 that a command was refused. Test-Logic-Reset loads IDCODE, and unassigned codes select BYPASS.

| Code | Instruction | Data register |
|---|---|---|
| `0x00` | EXTEST | boundary-scan register, 99 bits: pins driven from their latches |
| `0x01` | SAMPLE/PRELOAD | boundary-scan register, 99 bits: pins stay under the core |
| `0xC0` | ISC_DISABLE | bypass, 1 bit: leave programming mode and restart |
| `0xE9` | ISC_ENABLE | bypass, 1 bit: enter programming mode |
| `0xEA` | ISC_PROGRAM | row register, 72 bits: 64 data bits then an 8-bit address, written at Update-DR |
| `0xEC` | ISC_ERASE | bypass, 1 bit: bulk erase |
| `0xEE` | ISC_VERIFY | row register, 72 bits: read back |
| `0xFC` | HIGHZ | bypass, 1 bit: every pin off |
| `0xFD` | USERCODE | 32 bits: the user code |
| `0xFE` | IDCODE | 32 bits |
| `0xFF` | BYPASS | 1 bit |

**IDCODE** is 32 bits, least significant first with the least significant bit always 1: version in bits 31–28, part number in 27–12, manufacturer in 11–1. The vCPLD-32 has version 1, part number `0xC032` and manufacturer `0x0FF`, a code that belongs to no real vendor, so its IDCODE is `0x1C0321FF`.

**Boundary-scan register.** 99 cells: three for each of the 32 I/O pins (`3·io`: the input, capturing the level on the pin; `3·io + 1`: the output data, capturing the macrocell’s output and latching what EXTEST drives; `3·io + 2`: the control, capturing whether the output enable is true) and one input cell each for GCLK, GSR and GOE (cells 96, 97, 98). Cell 0 is nearest TDO.

**Programming.** In programming mode every output buffer is off and the flip-flops ignore the clock. The sequence is: ISC_ENABLE; ISC_ERASE (the device is busy for 8 TCK cycles in Run-Test/Idle, and commands during that time are refused); ISC_PROGRAM, then for each row a 72-bit scan (programming can only set bits, so erase first; each row keeps the device busy for 3 Run-Test/Idle cycles); ISC_VERIFY (an address is latched at one Update-DR and the row is captured at the next Capture-DR, so reading *N* rows takes *N* + 1 scans); ISC_DISABLE, which restarts the device from its new configuration.

::device-studio{device="cpld32" example="counter" views="source,chip,bits,jtag" n="G.13" caption="The vCPLD-32 in the Device Studio, running a 4-bit counter. The JTAG view drives the port by hand or plays a whole programming sequence, clock by clock."}

## vFPGA-S, vFPGA-M and vFPGA-L

*A family of three virtual FPGAs modelled on the Lattice iCE40: its logic cell, its span-4 and span-12 wires, its block RAM and its global clocks, scaled down so that a whole device can be simulated, drawn and, for the S, configured by hand.*

### Features

- A grid of **tiles**, ringed by I/O tiles. A **logic tile** holds 8 logic cells; a **block RAM tile** holds one 4-Kbit dual-port RAM; an **I/O tile** holds pads.
- Each **logic cell** is a 4-input LUT with a D flip-flop, a bypass multiplexer that picks the LUT or the flip-flop for the cell’s output, and carry logic.
- **Routing made of unidirectional, single-driver multiplexers**, as in modern FPGAs: every configuration decodes to a legal netlist, and contention cannot happen.
- Wires of span 1, 4 and 12 tiles (the S has only span 1).
- Global clock networks, each fed by a dedicated pad; every logic tile picks one, and its polarity.
- Configuration in **frames**, one for each tile column. The device is simulated from its decoded bitstream, not from the design that produced it.

::floor-plan{n="G.14" caption="The three floorplans to scale. The S is small enough to configure every bit by hand. The M has 12 × 12 logic tiles and two block RAM columns. The L has 32 × 32 logic tiles and two block RAM columns, and was sized so that a design of about 4,000 cells, the size of the RV32I core, uses half of it: at 4,608 cells the router could not finish such a design in reasonable time."}

### Sizes

| | vFPGA-S | vFPGA-M | vFPGA-L |
|---|---|---|---|
| Interior tiles (columns × rows) | 2 × 2 | 14 × 12 | 34 × 32 |
| Tiles with the I/O ring | 4 × 4 | 16 × 14 | 36 × 34 |
| Logic tiles | 4 | 144 | 1,024 |
| Logic cells | 32 | 1,152 | 8,192 |
| Block RAM tiles | 0 | 24 | 64 |
| Block RAM columns (interior x) | none | 4 and 11 | 9 and 26 |
| Block RAM (Kbit) | 0 | 96 | 256 |
| Pads | 16 | 208 | 528 |
| Pads per I/O tile | 2 | 4 | 4 |
| Global clocks | 4 | 8 | 8 |
| Clock select bits per tile | 2 | 3 | 3 |
| Wires per direction and tile: span 1, 4, 12 | 4, 0, 0 | 4, 4, 2 | 4, 4, 2 |
| Connection box: wires and local outputs a pin can select | 8 and 4 | 27 and 4 | 27 and 4 |
| Routing nodes | 332 | 13,976 | 90,296 |
| Routing multiplexer inputs (edges) | 2,436 | 243,720 | 1,663,664 |
| Configuration bits | 1,772 | 182,920 | 832,592 |
| Configuration frames (one per tile column) | 4 | 16 | 36 |

### The logic cell

A logic cell has 25 configuration bits: a 16-bit LUT and nine flags.

| Bits | Field | Meaning |
|---|---|---|
| 0–15 | `lut` | truth table: bit *r* is the output when I0 + 2·I1 + 4·I2 + 8·I3 = *r* |
| 16 | `i3_carry` | LUT input I3 comes from the carry input instead of the routing pin |
| 17 | `carry_chain` | the carry input is the previous cell’s carry output (otherwise the constant `carry_const`) |
| 18 | `carry_const` | the constant carry input when `carry_chain` is 0 |
| 19 | `ff` | the cell’s output is the flip-flop (bypass multiplexer); otherwise the LUT |
| 20 | `ce_en` | the flip-flop loads only while the tile’s clock-enable pin is 1 |
| 21 | `sr_en` | the tile’s set/reset pin resets or sets the flip-flop |
| 22 | `sr_val` | the value the set/reset forces: 0 resets, 1 sets |
| 23 | `sr_async` | set/reset acts at once; otherwise at the next clock edge, and then it has priority over the enable |
| 24 | `init` | power-up value of the flip-flop |

The carry output of a cell is always MAJ(I1, I2, carry input), as the iCE40’s SB_CARRY. The chain runs through the cells of a column, cell 0 to 7 and then into cell 0 of the tile above; it is a dedicated wire, not part of the routing graph.

A logic tile shares one clock (chosen from the global networks by `clk_sel`, with `clk_neg` selecting the falling edge), one clock-enable pin and one set/reset pin among its 8 cells.

### Block RAM

A block RAM tile holds 4,096 bits with one read port and one write port. The width is chosen by a 2-bit `mode`:

| Mode | Organisation |
|---|---|
| 0 | 256 × 16 |
| 1 | 512 × 8 |
| 2 | 1,024 × 4 |
| 3 | 2,048 × 2 |

The tile’s pins are RADDR0–10, WADDR0–10, WDATA0–15, RE and WE (40 in all), with 16 data outputs. Reads are synchronous by default (data one clock cycle after the address; on the same edge, the read gets the old word), or asynchronous when the `async` bit is set. The read and write clocks are each chosen from the global networks. The initial contents are 4,096 bits of the configuration.

### Routing

Every non-empty tile *starts* wires in each of the four directions. A wire has a span of 1, 4 or 12 tiles and one driver: the **switch-box** multiplexer of its starting tile. It can be tapped only at its far end (the iCE40’s wires can be tapped along their length; leaving that out keeps the graph small), and exists only if its far end is on the die. The multiplexer of a wire starting at tile *T* can select:

- the wires of the same direction that *arrive* at *T* (straight on, one for each span);
- the wires arriving from the two perpendicular directions (a turn, one for each span, on a neighbouring track so that tracks mix);
- four of the tile’s own outputs: logic cell outputs, block RAM data outputs or pad inputs.

The **connection box**, the multiplexer in front of a tile pin (a LUT input, clock enable, set/reset, a RAM pin or a pad output), selects among a fixed subset of the wires arriving at the tile, plus four local outputs. In the vFPGA-M and L a pin can pick 27 of the 40 wires that arrive at its tile. With 16 of the 40, a design of 740 cells (64 % of the M) sometimes did not route at all, and the RV32I core did not route on the L however long the router negotiated: once the packer fills tiles densely, the wires a pin can see are all taken by other nets. The configuration memory does not grow, since 27 wires and 4 local outputs still fit the 5 select bits.

A multiplexer with *n* inputs has ⌈log₂(*n* + 1)⌉ configuration bits. **Code 0 means nothing is selected** (the net is undriven, Z in the simulation); code *k* above 0 selects input *k* − 1; codes above *n* are reserved and also read as nothing.

The four inputs of an ordinary LUT are interchangeable, so a connection to such a cell may end at any of its four pins; the toolchain permutes the truth table to match.

### I/O and clocks

Pads are named P0, P1 and so on in ring order: along the top row from left to right, down the right column, along the bottom row from right to left, and up the left column. Each I/O tile has two configuration bits per pad: `output` (the pad drives the outside) and `pullup`. The global clock networks are fed by dedicated pads, spread along the top row:

| | Pads that feed the global clocks |
|---|---|
| vFPGA-S | P0, P1, P2, P3 |
| vFPGA-M | P0, P7, P14, P21, P28, P35, P42, P49 |
| vFPGA-L | P0, P17, P34, P51, P68, P85, P102, P119 |

Clock networks are ideal: every flip-flop sees the edge at the same time, and they are not part of the routing.

### Timing model

One table of delays is used everywhere: by the router as node costs, by static timing analysis, and by the fabric simulator as element delays, so the three agree. Every routing multiplexer a signal passes adds its switch delay, and a wire node adds its segment’s delay on top.

| Element | Delay |
|---|---|
| LUT, any input to output | 0.5 ns |
| Flip-flop, clock to Q | 0.3 ns |
| Flip-flop set-up (D, CE, SR) | 0.2 ns |
| Flip-flop hold | 0.05 ns (reported; the fabric simulator does not check it) |
| Routing multiplexer (switch box or connection box) | 0.1 ns |
| Wire segment, span 1 | 0.2 ns |
| Wire segment, span 4 | 0.4 ns |
| Wire segment, span 12 | 0.8 ns |
| Carry, carry-in to carry-out | 0.1 ns |
| Carry, operand pins I1, I2 to carry-out | 0.3 ns |
| Input pad buffer | 0.5 ns |
| Output pad buffer | 0.8 ns |
| Block RAM, clock to data out | 1.2 ns |
| Block RAM, read address to data (asynchronous read) | 1.5 ns |
| Block RAM set-up | 0.4 ns |
| Global clock network | 0 ns |

The **critical path** is the slowest path from a start (a register output, an input pad, a RAM output) to an end (a register input, an output pad, a RAM input); the clock period cannot be shorter than it, and *f*max = 1000 / period, in MHz.

### The bitstream file

A configuration is a flat array of bits, organised in frames: one for each tile column, holding its tiles from y = 0 upwards. A tile holds, in order:

- a **logic tile**: `clk_sel`, `clk_neg`, its 8 logic cells of 25 bits, then the select fields of its multiplexers in node order (connection-box multiplexers first, then switch-box multiplexers);
- an **I/O tile**: two bits for each pad, then its multiplexers;
- a **block RAM tile**: `mode` (2 bits), `async` (1), the read and write clock selects, the 4,096 bits of initial contents, then its multiplexers.

The file is a header (the magic `VFPG`, the version 1, the device name, the total number of bits and the number of frames, the numbers in little-endian order), then for each frame its length in bits, its bits packed least significant bit first, and a CRC-32 of the packed bytes; and a final CRC-32 of everything before it. A file whose checksum does not match, or that is for another device, is refused.

### Differences from the iCE40

Wires can only be tapped at their end; there are no local-track stages, so a connection box selects straight from wires; an I/O tile has 4 pads (2 in the S), a logic tile has one clock that comes from a global network only; the block RAM occupies one tile; and the sizes are much smaller.

::block-diagram{device="fpga" n="G.15" caption="The die and one logic tile. Everything shaded in copper is configuration memory."}

::fpga-studio{size="S" design="counter" views="source,chip,bits,hand" n="G.16" caption="The vFPGA-S in the FPGA Studio. It is small enough to fit a 4-bit counter with room to spare: open the Bits view to see every configuration bit and what it controls, and the By hand view to set them yourself."}

## The virtual board

The vFPGA sits on a virtual development board. A `top` module is bound to the board by port name and type (Appendix F lists the names), and the device that runs is the **decoded bitstream**, not the source: a second copy of the design on the RTL simulator, fed the same inputs, checks it cycle by cycle.

::board-diagram{part="board" n="G.17" caption="The board’s resources. A port of the top module with the right name and width is wired to it; any other input gets a switch of its own and any other output an LED."}

| Resource | Port | Type |
|---|---|---|
| Clock | `clk` | `clock` |
| Reset button, active high | `rst` or `reset` | `bit` |
| Push buttons | `btn` | `bits<4>` |
| Switches | `sw` | `bits<8>` |
| LEDs | `led` | `bits<8>` |
| Seven-segment digits, digit 0 on the right | `seg0` to `seg3` | `bits<7>` or `bits<8>` |
| Multiplexed display | `seg` and `an` | `bits<7>` or `bits<8>`, and `bits<4>` |

The clock has a step button, a run button, and a rate: 1, 4, 16, 64, 256 Hz, 1 kHz, or as fast as the simulation goes. Between edges the fabric is given a half period of at least 100 ns and at least three times the design’s critical path, so the outputs always settle. A segment is lit by a 1; bit 0 of a digit is segment a and bit 6 is segment g, and bit 7, if the port has it, is the decimal point. For a multiplexed display, digit *i* shows the segments of `seg` at the moments when bit *i* of `an` is 1, and keeps its last pattern between them.

::board-diagram{part="segments" n="G.18" caption="The patterns of the sixteen hexadecimal digits, as the SevenSeg module of the standard library and the board’s decoder write them."}

**What the board does not have.** The plan for the course describes an 8 × 8 LED matrix, a text console and a memory subsystem with memory-mapped peripherals on the board. None of them is in the board of this version: a design that needs a display uses the digits, and one that needs a text output uses the LEDs; a design that needs memory has its own block RAM.
