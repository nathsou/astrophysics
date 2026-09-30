---
number: 31
title: CPUs on a chip
summary: Octet, drawn in Chapter 22, is described in about 280 lines of DCL, fitted on a vFPGA-M in 541 cells, and runs your assembly from the block RAMs of its bitstream; an RV32I core takes 4,735 cells of a vFPGA-L, two thirds of them one array of registers.
duration: About 3 hours
prerequisites: [control, describing-hardware, netlist-to-bitstream]
---

Chapter 22 ended with a computer you could pull apart. Octet was 3,604 gates, drawn, with a control unit whose equations fitted on one screen, and it ran every program of Chapter 23 as the interpreter said it should, cycle for cycle. Chapters 28 to 30 built the other half of the story: a chip that is nothing but memory, 1,152 small lookup tables and the wires between them, and the tools that turn a description into the bits that fill it.

This chapter puts one on the other. Octet is written once more, as text, in about 280 lines of DCL. The tools of Chapter 30 fit it on a vFPGA-M, and the virtual board runs it, not from the source but from the *bits*: you write assembly, the assembler makes bytes, the bytes go into the block RAMs of the bitstream, and the chip on the screen runs your program. Then the same is done for a real instruction set, RV32I, on the larger chip, where something surprising happens. The core is nine times the size of Octet, and two thirds of it is one array of registers.

## Octet, described

Everything in the drawn Octet has a line of text in the described one, and most of it has the same name.

| In Chapters 21 and 22 | In `octet.dcl` |
|---|---|
| Registers PC, SP, IR, MAR, A, B, T, R0 to R3 and the four flags: parts with a load line | A `reg` for each, and one `next` that says when it loads |
| A bus with seven tri-state drivers | Seven ANDs and an OR |
| The ALU part | `module Alu`, 18 lines |
| The hardwired control unit and its 24 lines | `module Control`: Chapter 22’s `OctetDecode`, unchanged |
| The 256-byte RAM part | `mem ram`, a block RAM |
| The devices in the top 16 addresses | A `match` on the address, and a register for each device |

The bus is the interesting one. A chip like the vFPGA has no tri-state drivers inside it (its wires are single-driver multiplexers, so that no configuration can make two outputs fight), and a bus of drivers is not what Chapter 22 needed anyway. What it needed was that *at most one* of the seven output-enable lines is on in any cycle, which Chapter 22’s exhaustive test showed: no term of the control unit has two of them. Then the bus is the OR of seven values, each ANDed with its own enable, and an AND with a 0 is 0:

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
/// Gate a byte with an enable: the AND that stands in for a tri-state driver.
fn drive(enable: bit, x: bits<8>) -> bits<8> {
  repeat(enable, 8) & x
}
```

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
  let bus_without_memory: bits<8> = drive(control.oe_rd, rd_value)
    | drive(control.oe_rs, rs_value)
    | drive(control.oe_pc, pc)
    | drive(control.oe_sp, sp)
    | drive(control.oe_alu, alu.y)
    | drive(control.oe_t, t)
  let bus: bits<8> = bus_without_memory | drive(control.oe_mem, mem_value)
```

(The bus is written in two lines for a reason that comes two subsections down.) Registers are the other half of the datapath, and each is one line: what it becomes at the next clock edge. The program counter can be loaded from the bus, or counted, or left alone; the :term[register file]{id=register-file} is four registers made by a loop; the flags load together when the control unit says `ld_flags`. `rst` is the board’s reset button, and it is a synchronous one, an ordinary input of the next-value logic:

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
  next pc = if rst { 0 } else if control.pc_ld { bus } else if control.pc_inc { pc + 1 } else { pc }
```

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
  for i in 0..4 {
    next r[i] = if rst { 0 } else if control.we_r && rd == i { bus } else { r[i] }
  }
  next z = if rst { 0 } else if control.ld_flags { alu.y == 0 } else { z }
  next c = if rst { 0 } else if control.ld_flags { alu.c } else { c }
  next n = if rst { 0 } else if control.ld_flags { alu.y[7] } else { n }
  next v = if rst { 0 } else if control.ld_flags { alu.v } else { v }
```

The ALU is one `match` over its operation code, and the whole subtlety of Octet’s flags fits in two lines. Subtraction is addition of the complement with a carry in, and a 9-bit sum keeps the carry out. Chapter 14 noted that the carry out of A + ¬B + 1 means *no* borrow, and that some processors, x86 among them, invert it into a borrow flag. Octet’s C is a borrow, so it is the carry out compared with whether we subtracted. Overflow is the signs rule of Chapter 14: the operands (with B complemented for a subtraction) have the same sign and the result has another.

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
module Alu(a: bits<8>, b: bits<8>, op: bits<3>) -> (y: bits<8>, c: bit, v: bit) {
  let subtract: bit = op == 1
  let addend: bits<8> = if subtract { ~b } else { b }
  let carry_in: bits<9> = if subtract { 1 } else { 0 }
  let wide: bits<9> = zext(a, 9) + zext(addend, 9) + carry_in
  let arithmetic: bit = op == 0 || op == 1
  let result: bits<8> = match op {
    _ => wide[7:0],
    2 => a & b,
    3 => a | b,
    4 => a ^ b,
    6 => a >> 1,
    7 => ~a,
  }
  y = result
  c = if arithmetic { wide[8] != subtract } else if op == 6 { a[0] } else { 0 }
  v = arithmetic && a[7] == addend[7] && result[7] != a[7]
}
```

Notice what is *not* there: no adder to instantiate, no carry chain to draw. `zext(a, 9) + zext(addend, 9) + carry_in` is three words of hardware, and Chapter 30’s tools will find a carry chain in it by themselves. The control unit is the module of Chapter 22, and the test of this chapter checks that it still is: the lines of its body are the same lines.

### Memory that answers a cycle late

Chapter 22’s RAM was a part whose data outputs showed the byte at its address at once, whenever the address changed. The :term[block RAM]{id=block-ram} of an FPGA does not: it takes its address at a clock edge, and the byte appears *after* that edge. That is a :term[synchronous read]{id=synchronous-read}. Octet’s fetch is `MAR ← PC` in one cycle and `IR ← M[MAR]` in the next, and every other instruction reads memory the same way, one cycle after MAR has been loaded.

```quiz
q: 'MAR is loaded at one clock edge, and Octet uses the byte M[MAR] in the very next cycle. A block RAM samples its address at a clock edge and shows the byte after that edge. If MAR is simply wired to the RAM’s address, when does the byte arrive, and what is the way to keep the ISA’s cycle counts (4 to 8 an instruction)?'
options:
  - text: 'On time; nothing needs to change.'
    why: 'The RAM sees MAR only at the edge after MAR has changed, so its byte is one cycle behind what the control unit expects: the instruction register would load the byte of the previous address.'
  - text: 'One cycle late; add a wait cycle after every load of MAR.'
    why: 'That works, and real cores do it. But it changes the table: every instruction that reads memory takes a cycle more (the fetch alone is one), and Octet would no longer be the machine that the interpreter, Chapter 22 and Chapter 23 count.'
  - text: 'One cycle late; give the RAM the value that MAR is about to have, so that the byte is ready when MAR has it.'
    correct: true
    why: 'The RAM’s address is the value at MAR’s input, not MAR’s output. The RAM then plays the part of the register: it holds the address inside, and shows its byte exactly one cycle after the load, which is where Chapter 22’s memory had it.'
  - text: 'One cycle early; nothing needs to change.'
    why: 'A synchronous read is never early: the data appears after the edge that takes the address.'
```

Figure 31.1 shows the two behaviours with the same four words. The upper memory is Chapter 22’s: change the address and the word follows at once. The lower has a register in front of the address, which is what a block RAM has inside: change the address and nothing happens until the clock.

::circuit{src="31-cpus-on-a-chip/circuits/memory-read.json" n="31.1" title="Two ways to read a memory" mode="logic" speed=1e-6 traces="in_A0,in_A1,in_CLK,oa1,ob1" window=1e-5 caption="Flip the address switches A0 and A1: the upper memory shows its word at once (one lamp, the word’s position is the address). The lower one keeps showing the word of the address it saw at the last clock. Press Clock and it catches up. Set address 1 and watch the two traces at the bottom: D1 of the upper memory rises with the switch, D1 of the lower only with the clock."}

Octet’s way is the third option of the question. `address` is what MAR will hold after this edge: the bus if the control unit is loading it, otherwise MAR itself. The bus without the memory’s own driver is used for it, and that is why the bus was written in two lines:

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
  mem ram: [bits<8>; 240] = PROGRAM
  let address: bits<8> = if control.ld_mar { bus_without_memory } else { mar }
  let ram_byte: bits<8> = ram.read(address)
```

There is one instruction pair for which this is not enough, and it is the one with the most steps: `LD` and `ST` load MAR *from memory* (`MAR ← M[MAR]`, the byte after the opcode is the address) and then read at that address. The byte that has just arrived is the next address. A second read port, whose address is the first port’s output, has the answer ready in the next cycle, and a flip-flop remembers which port to listen to:

```dcl from="content/chapters/31-cpus-on-a-chip/designs/octet.dcl"
  let ram_indirect: bits<8> = ram.read(ram_byte)
  reg indirect: bit = 0
  next indirect = control.ld_mar && control.oe_mem
```

Two read ports on one memory is two block RAMs with the same contents, one write port shared. That is what the flow builds, and the report will say so.

### How we know it is Octet

The proof is the one Chapter 22 used, moved to the new machine. `octet.test.ts` runs the DCL on the RTL simulator beside the interpreter, both with the same program and the same switches, and after **every instruction** compares everything a program can see:

```ts from="content/chapters/31-cpus-on-a-chip/octet.test.ts"
    const cycles = ref.step();
    for (let k = 0; k < cycles; k++) {
      if (lines) checkLines(dcl, k, ir, OCTET_CONDITIONS[ir & 0xf]!.test(flags), `${label}: instruction ${instructions} at ${pc}`);
      dcl.cycle();
    }
    instructions++;
    const want = ref.snapshot();
    const diff = compareStates(want, dcl.snapshot(instructions, want), { timing: true });
```

The interpreter says how many clock cycles the instruction takes (Chapter 22’s table, 4 to 8), the DCL is clocked that many times, and then registers, flags, PC, SP, all 240 bytes of RAM, the LEDs, the hex register and the console must agree, *and the cycle count must be the ISA’s*, and the step counter must be back at zero. On the way, in a tenth of the programs, the 24 control lines of every cycle are compared with Chapter 22’s microprogram. The programs are every one of the 256 first bytes from random registers and flags, 200 random programs that jump, push, call, load and store, 100 more that also use the devices, and the course’s own: blink, count, multiply, Fibonacci, hello, sort and the reaction timer. Every one passes.

## Fitting Octet on a vFPGA-M

The flow of Chapter 30 takes about seven seconds of computation for Octet (a few seconds on the clock in a browser’s worker), and the Report tab of Figure 31.2 below has the numbers. They are worth reading against the drawing.

| | Drawn (Chapters 21 and 22) | Described, on a vFPGA-M |
|---|---|---|
| Size | 3,604 elements (gates, tri-state drivers, one RAM), or 334 built from the simulator’s blocks | 541 logic cells: 532 LUTs and 129 flip-flops, 9 of the cells on a carry chain; 2 block RAMs |
| Share of the chip | | 47 % of the cells, 68 of the 144 tiles |
| What you can say about speed | The simulator’s gates are 1 ns each and the tests clock it slowly | 43.3 MHz: a critical path of 23.1 ns |
| Cycles per instruction | 4 to 8 | 4 to 8: the same |
| Wires | Every one drawn | 12 routing iterations, no overused wire |

The elements of the drawing and the cells of the chip are not the same unit, and 3,604 against 541 is not a fair fight: a LUT holds a whole cone of gates, which is the point of Chapter 28. But it is the fair answer to a question a designer asks, *how much of the chip does my CPU take?*, and the answer is under half of the smallest device that holds it.

The 129 flip-flops are exactly the registers of the programmer’s model and of the datapath, counted: 88 in PC, SP, IR, MAR, A, B, T and R0 to R3, 4 flags, 3 in the step counter, the devices’ registers (LEDs, HEX, the random generator, the console byte), and one for `indirect`. The memory is not among them, and that is the design’s biggest decision. Written as a `reg` array, 240 bytes would be 1,920 flip-flops, more than the 1,152 cells of the whole chip. As a `mem`, the flow gives it to the block RAMs, and takes nothing from the fabric at all.

Of the 541 cells, 97 are the ALU and 94 the control unit; the other 350 are the registers’ next-value logic, the bus and the devices. In the Studio the Logic view shows the same tree, with a count for every module. The critical path, the slowest 23.1 ns, starts at IR, goes through the decoder and the ALU’s carry chain onto the bus, and ends in the register of the RANDOM device (the test `bus != 0`, on the way to its next value) after 16 logic cells. Of the 23.1 ns, 14.6 are wires. It is Chapter 30’s lesson again: to make Octet faster, change the number of LUTs between IR and a register, not what is in them.

There is one line in the log that Chapter 30 explained in principle and that you can now see in a real design. The first placement did not route: after 60 iterations 11 routing nodes were still shared between two nets. The flow does what a real tool does, and places again with another seed. The second placement routed in 12 iterations. The result depends on the random seed, and that is why the numbers in this chapter are for the seed the course uses.

## Your program on the chip

Octet fits, and now it must run something. The program is the RAM’s initial contents, `PROGRAM`, a table of 240 bytes at the end of `octet.dcl`. Those bytes reach the chip as bits in the bitstream: each block RAM is configured 256 words by 16 bits wide (the first of the RAM’s width modes with room for 240 words) and its 4,096 initial-contents bits sit in the RAM’s tile, next to its clock selects. Word *a* is bits 16*a* to 16*a* + 15; Octet’s byte is the low eight.

That gives two ways to change what the chip runs:

- **Fit again.** Put the new bytes in the source’s table and run the flow. A few seconds, and a new placement and routing, which may have different timing.
- **Load the bits.** The program is *data*, and nothing else in the bitstream depends on it: no LUT is computed from it, no route goes anywhere because of it. Rewrite the bits of the two RAMs, and every other bit stays. It takes a few tens of milliseconds, and the real iCE40 flow has a tool for exactly this: IceStorm’s `icebram` replaces the contents of the block RAMs in an ASCII bitstream, and `icepack` writes the file again with new checksums.:cite[icebram]

Figure 31.2 does both. Write assembly in the box, press **Load into the chip**, and the assembler’s bytes go into the bits; the board runs the decoded bitstream. **Fit again** does it the slow way, so that you can feel the difference. The Source tab has the whole design and the table at its end; the Chip tab the placed cells; the Board the switches, buttons, LEDs and digits. The two left digits show the program counter, the two right the HEX register, and the console line at the bottom is what the program wrote to CONSOLE.

::octet-board{n="31.2" caption="The walking light of walk.asm is in the chip. Press Run on the Board (choose 1 kHz or max) and watch the LEDs and the program counter on the left digits. Then change WAIT in the assembly, from 8 to 2, and press Load into the chip: it is loaded in tens of milliseconds, with four configuration bits changed, all of them in the two block RAMs. Pick Fit again for the same program and compare the seconds. Hover a line of the design in the Source tab, for instance the one that starts next sp, and its cells light up on the Chip; select a cell on the chip and its line lights up in the source. That is cross-probing."}

:::lab[Walk, load, and find your program in the bits]
Use Figure 31.2. Wait for the fit (a few seconds after the figure first comes into view), open the Board tab and press Run at 1 kHz.

1. **The light.** One LED lights and walks to the left, then back. The right digits count the steps in hexadecimal, and the left digits are the program counter, and it spends most of its time between 1B and 1D, the delay loop of the subroutine `step`.
2. **The speed.** Change `.equ WAIT, 8` to `.equ WAIT, 2` and press *Load into the chip*. The light is four times faster. Note the report under the editor: how many bits changed? (Four: 0xF8 becomes 0xFE, which is two bits in each of the two RAMs.)
3. **The bits.** Open the Bits tab. Two frames, F4 and F11, are mostly empty with a few blue marks: the columns of the two block RAMs, and the marks are “block RAM contents”. Hover a mark to read what the bit is. The eight bits of the byte at address 0 are the first eight of the first RAM’s first word.
4. **Cross-probing.** In the Source tab hover the line `next pc = …`. The cells of the program counter’s flip-flops and the logic that feeds them light up on the chip. Now hover `let bus_without_memory`: the seven ANDs and their OR are spread over the chip, and the routing between them is why Octet’s critical path is mostly wire.
5. **Other programs.** Pick *Switches to LEDs* and load it: flip a switch on the Board and the LED follows; hold a button and see the number on the right digits change. Pick *Hello, world*, load it and run: the text appears under the board, and the halted pin lights.
6. **Break it.** Press *Fit again* with a program that has an error: the button is disabled, because nothing that does not assemble can be put in a table.
:::

:::hood[How the Studio binds your design to the board, and runs the bits]
The board has no wires that you draw. A top-level port is bound to a board resource *by its name and type*, and a port whose name is a board’s but whose shape is wrong is an error, as in a typed language. The rules are a table in `src/lib/studio/fpga/board.ts`:

```ts from="src/lib/studio/fpga/board.ts"
const RULES: Rule[] = [
  { names: ['clk'], dir: 'in', widths: [1], clock: true, resource: 'clk', what: 'the board clock (type clock)' },
  { names: ['rst', 'reset'], dir: 'in', widths: [1], clock: false, resource: 'rst', what: 'the reset button (type bit)' },
  { names: ['btn'], dir: 'in', widths: [4], clock: false, resource: 'btn', what: 'the 4 buttons (bits<4>)' },
  { names: ['sw'], dir: 'in', widths: [8], clock: false, resource: 'sw', what: 'the 8 switches (bits<8>)' },
  { names: ['led'], dir: 'out', widths: [8], resource: 'led', what: 'the 8 LEDs (bits<8>)' },
  { names: ['seg0', 'seg1', 'seg2', 'seg3'], dir: 'out', widths: [7, 8], resource: 'seg', what: 'a 7-segment digit (bits<7> or bits<8> with the dot)' },
```

That is why Octet’s top module is called with `clk`, `rst`, `btn`, `sw` and `led`, and why its digits are `seg0` to `seg3`; the ports `halted`, `console` and `console_write` are not on the board, so each gets a pin of its own (they appear as “pins out” on the Board tab, and the console line of the figure reads the last two). The board’s inputs then reach the *chip*, not the design: `FabricSim` drives the input pads of the decoded fabric, one switch to one pad, pulses the clock pad, and reads the output pads back:

```ts from="src/lib/studio/fpga/fabric-sim.ts"
  /** One full clock cycle: rising edge, settle, falling edge, settle. */
  clock(): void {
    if (this.clockPad) {
      this.engine.setParam(`TB:${this.clockPad}`, 'on', true);
      this.clockLevel = true;
      this.engine.advance(this.half);
      this.engine.setParam(`TB:${this.clockPad}`, 'on', false);
      this.clockLevel = false;
      this.engine.advance(this.half);
    } else this.engine.advance(2 * this.half);
    this.rtl?.tick();
```

The last line is the check: the RTL simulator of the *source* is clocked in step, and after every cycle the board compares every output bit of the fabric with it. The panel under the board that says “device agrees with the RTL simulator” is that comparison, made about a thousand times a second while Octet runs. The decoding of the bitstream itself, from the pads back through the multiplexers, is the code of Chapter 28’s box.
:::

:::hood[Changing the program without fitting again]
`setBram` in `src/lib/pld/devices/vfpga-config.ts` is the writer that the flow uses, and it shows where the program lives:

```ts from="src/lib/pld/devices/vfpga-config.ts"
    if (cfg.contents) {
      const mode = getBits(this.bits, o, 2);
      const w = BRAM_WIDTHS[mode]!;
      const init = bramInitOffset(d, x, y);
      for (let a = 0; a < BRAM_BITS / w; a++) setBits(this.bits, init + a * w, w, cfg.contents[a] ?? 0);
    }
```

The chapter’s loader (`widgets/octet-fpga.ts`) does the same to a finished configuration. It asks the decoder which block RAMs the design uses, then writes the program’s bytes into each, and leaves every other bit alone:

```ts from="content/chapters/31-cpus-on-a-chip/widgets/octet-fpga.ts"
  const out = bits.slice();
  const rams = usedRams(device, bits);
  for (const key of rams) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const w = BRAM_WIDTHS[readBram(device, bits, x, y).mode]!;
    // A block RAM is at least as wide as the byte; a wider one (Octet's are set to 256 × 16) holds it in its low bits.
    if (w < 8) throw new Error(`the RAM at ${key} is ${w} bits wide, and Octet's words are 8`);
    const init = bramInitOffset(device, x, y);
    for (let a = 0; a < BRAM_BITS / w; a++) setBits(out, init + a * w, w, a < OCTET_MEMORY.ramSize ? (image[a] ?? 0) & 0xff : getBits(bits, init + a * w, w));
  }
```

Loading multiply.asm in place of the walking light changes 352 of the vFPGA-M’s 182,920 configuration bits: 0.19 %. Then `encodeBitstream` computes the frames’ checksums again, because a bitstream file has one CRC-32 per frame and a loader rejects a file whose checksum is wrong, and the decoder builds a new circuit from the new bits. Everything the router decided is still valid, because the program did not change what is connected to what.
:::

## Why the RV32I core is bigger

RV32I is the base instruction set of RISC-V: 40 instructions, 32 registers of 32 bits, 32-bit addresses and 4-byte instructions. It is a *real* instruction set, one that compilers target and that Linux runs on, and the reference core of this course, `content/designs/rv32i.dcl`, is 175 lines of DCL, about a third fewer than Octet’s. Each instruction takes two cycles: one to fetch, one to execute.

:::history{year=2011 title="An instruction set that anybody may use" people="Andrew Waterman, Yunsup Lee, David Patterson, Krste Asanović"}
In 2010 a group at Berkeley wanted an instruction set for teaching and research, and the popular ones were either encumbered by licences or too complicated to teach. They wrote their own, and called it RISC-V, the fifth RISC design from Berkeley. The first public specification is the technical report *The RISC-V Instruction Set Manual, Volume I: Base User-Level ISA* of May 2011, by Andrew Waterman, Yunsup Lee, David Patterson and Krste Asanović.:cite[riscv-2011] The point was less the instructions than the licence: anyone may implement the instruction set without asking, which is why a graduate student’s core, a company’s microcontroller and a soft core on an FPGA can all be RISC-V. The RV32I of this chapter is the base set of that manual, in the version ratified in 2019.
:::

Fitted on the vFPGA-L (8,192 cells, 64 block RAMs), the core is another size altogether. Before you look, guess.

```quiz
q: 'Octet took 541 cells. RV32I has registers and an ALU four times as wide, 32 registers instead of 4, and more instructions. About how many cells does the RV32I core need?'
options:
  - text: 'About 1,500: three times Octet.'
    why: 'That would be about right for a datapath four times as wide with slightly more control. It is what the core needs if you take out one thing, which is the point of the next few paragraphs.'
  - text: 'About 4,700: nine times Octet.'
    correct: true
    why: '4,735 cells with the ROM and devices around it. The wider datapath and the decoder of a bigger instruction set account for about 1,500 of them. The other 3,200 are the register file.'
  - text: 'About 15,000: thirty times Octet.'
    why: 'That would not fit the vFPGA-L, which has 8,192 cells. The core uses 58 % of it.'
```

::cell-budget{n="31.3" caption="Three fits on one scale. Octet is the small bar with the dashed mark at the size of the whole vFPGA-M. RV32I with the register file made of flip-flops is nine times as big, and 3,201 of its 4,735 cells are the register file. The same core with the registers in block RAM is 1,476 cells, faster (20.0 MHz against 12.9) and fitted in under six seconds instead of over thirty. Hover a segment for its size."}

The reference design’s register file is `reg x: [bits<32>; 32]`: 32 registers of 32 bits, 1,024 flip-flops in the flow’s count, with a 32-to-1 multiplexer for each of the 32 bits of each of the two read ports. The multiplexers are the bigger part: 32 bits × 2 ports × 31 two-way multiplexers is almost 2,000 LUTs. Standing alone, the register file is 3,138 cells and runs at 31.9 MHz. It is two thirds of the core, and, because everything in the core reads it, its multiplexers are also most of the core’s wiring, and so of its delay: the whole core’s 12.9 MHz.

Why does the flow not do something better by itself? Because a `reg` array is what you asked for. `reg` is flip-flops; the tools respect that, as a compiler respects your choice of a linked list. Memory that should live in a block RAM has its own construct, `mem`, which Chapter 29 introduced, and the flow maps every `mem` to the chip’s RAMs. A 32-word, 32-bit register file with two read ports and one write port is four block RAMs (each holds a 16-bit slice, and each read port needs its own copy), and the same register file written with `mem` is *two logic cells and four block RAMs*, at 138.9 MHz.

The price is the one Octet paid for its memory, and it is a pipeline’s price. The block RAM answers a cycle after it gets the address. The core has a cycle to spare: it is fetching in one cycle and executing in the next, and in the fetch cycle the instruction word is arriving, with its two register numbers in bits 19 to 15 and 24 to 20. So the core reads the registers *while it fetches*, from the arriving word instead of from its own instruction register, and the values are ready in the execute cycle. That is two lines of the core changed and the register file replaced by seven; the chapter’s `withBlockRamRegisters` does it, and the tests run 25 random chains of dependent instructions on the flip-flop core, on this one and on the interpreter, and all three agree. The result is Figure 31.3’s third bar: 1,476 cells, 4 block RAMs, 89 flip-flops, 20.0 MHz.

::rv32-board{n="31.4" caption="The RV32I core on the board, with the walking light as its program in a ROM of logic. Press Fit (about half a minute: this is the flip-flop register file, and the worker keeps the page usable), then Run on the Board. A browser simulates these 4,700 cells at tens of cycles a second, so a step of the light takes about a second; Step moves one cycle. The left digits are the program counter, the right ones count the steps. Now choose Block RAM under the assembly, press Fit again, and compare the report: about a third of the cells and a few seconds. Edit the program (the constant WAIT, or a shift of 2 instead of 1) and fit again."}

:::lab[Two cores, one program]
Use Figure 31.4.

1. Fit with the register file in **flip-flops**. Read the report: 4,735 cells (58 % of the device), 12.9 MHz, and a log with the placement’s temperatures and the router’s 14 iterations. In the Logic view open `core` and then `register_file`: the count beside it is 3,201.
2. Run the walking light. It takes about 40 cycles a step (Octet took about 125), because each RV32I instruction takes two cycles and there are 20 of them in a step.
3. Choose **Block RAM** and fit again. In the Report look at the block RAM row: four. Run the same program: the LEDs do the same, cycle by cycle, though the chip is a third of the size.
4. The Reset button does nothing: the core has none. Why does Octet’s `rst` work, and what would you add to the core to have one? (A synchronous reset on `pc` and `execute`, as for Octet’s registers.)
:::

Which of the two CPUs is the better one? On the jobs of Chapter 23 the answer depends on what you count. Multiplying 13 by 11 by shift and add takes Octet 60 instructions and 329 cycles; RV32I does it in 29 instructions, which is 58 cycles on the core of this chapter. At the clock rates of the fits, that is 7.6 µs on Octet at 43.3 MHz, 4.5 µs on the flip-flop RV32I at 12.9 MHz, and 2.9 µs with the register file in block RAM at 20 MHz. Octet’s program is 49 bytes and RV32I’s is 64. For Fibonacci the sums are 29 bytes and 474 cycles against 104 bytes and 192 cycles. The wider machine does more per instruction, and the narrower clocks faster and costs a ninth of the chip: the engineering trade of Chapter 23, with prices in cells.

## Soft cores, and hard ones

A CPU written in a hardware description language and then loaded into an FPGA is a :term[soft core]{id=soft-core}. Everything in this chapter has been one. The alternative is a :term[hard core]{id=hard-core}: a processor built into the silicon of the chip, fixed like any other circuit, beside the FPGA fabric. Both are sold in volume, and the choice is the one you can now see the numbers for.

:::history{year=2000 title="The processor becomes a file" people="Altera, Xilinx"}
On 12 June 2000 Altera introduced Nios, calling it the industry’s first general-purpose RISC processor core optimised for programmable logic: a 16-bit instruction set, a five-stage pipeline, and a size of about 1,000 logic cells, twice Octet’s 541.:cite[altera-nios-2000] Xilinx followed in 2002 with MicroBlaze, a 32-bit RISC core with a Harvard architecture and 32 general-purpose registers, delivered with its Embedded Development Kit.:cite[amd-microblaze] Until then, an embedded system on an FPGA had meant a separate processor chip beside it, or one of the few FPGAs with a processor in the silicon. Now the processor was a block of the design, configured with the rest, and a designer could change it as easily as any other block: add an instruction, drop a multiplier, or put four of them on one chip. The instruction sets were the vendors’ own, and so were the tools, which is a large part of why the open RISC-V cores of the last decade matter.
:::

| | What it is | Size and speed |
|---|---|---|
| **MicroBlaze**, Xilinx (2002) | 32-bit RISC soft core, Harvard architecture, 32 registers, in the vendor’s tools | A single-issue pipeline, configurable |
| **Nios II**, Altera (2004) | The 32-bit successor to Nios: three soft cores, all code compatible, one for the smallest size, one for speed, one between:cite[altera-niosii-2004] | Chosen by the designer |
| **PicoRV32**, Clifford Wolf | An RV32IMC core written for *small size*, open source (ISC licence) | 761 to 2,019 LUTs on Xilinx 7-series, about 4 cycles per instruction, 416 to 769 MHz there:cite[picorv32] |
| **VexRiscv**, Charles Papon | A 32-bit RISC-V core written in SpinalHDL, assembled from plugins, with pipelines from 2 to 5 or more stages:cite[vexriscv] | Chosen by the designer when the core is generated |
| **Zynq-7000**, Xilinx (2011) | A hard dual-core ARM Cortex-A9 processing system, hardwired, beside an FPGA fabric: the processor boots on its own and then configures the fabric:cite[amd-zynq7000] | The processor runs at silicon speed; the fabric is a co-processor |

PicoRV32’s numbers are the interesting ones next to this chapter’s. At 761 to 2,019 LUTs it is two to six times smaller than our RV32I core, and it spends cycles to save cells: about four clock cycles per instruction, where the DCL core takes two. A designer who has a few thousand LUTs and a UART to fit picks the small slow core. One who wants a Linux prompt picks a pipelined one with caches, and one who wants a processor that is just *there* picks a hard core.

The economics are the ones of Chapter 28, with this chapter’s figures. A soft core costs area and speed: our RV32I is 4,735 cells and 12.9 MHz, and the same core made of fixed gates would be, by the ratios Kuon and Rose measured for logic, about 35 times smaller and three to five times faster.:cite[kuon-rose] In exchange it costs nothing to change, and there can be as many of them as the chip has room for.

## FPGAs and ASICs

A CPU goes into an FPGA when the number of chips is small, when the design will change, when a mistake must be fixable in the field, or when the job is one that a general CPU does badly. It goes into an ASIC, a chip made to order, when the number is large enough to pay for the masks. Chapter 32 puts figures on that trade. The FPGA’s price is the one Chapter 28 measured, some 35 times the area for the same logic, and what it buys is that a design is a file.

:::history{year=2014 title="An FPGA in every server" people="Andrew Putnam, Doug Burger and colleagues, Microsoft"}
The last case has a famous example. In a paper at ISCA 2014, a team at Microsoft described Catapult: a bed of 1,632 servers, each with a Stratix V FPGA on a PCIe card, the FPGAs wired to each other in groups of 48 servers as a 6 × 8 torus. They ran a piece of the Bing search engine, the ranking of candidate documents, in the FPGAs. With the FPGAs, each server’s ranking throughput was 95 % higher at the same latency, or, at the same throughput, the tail latency was 29 % lower; the FPGA cards added 10 % to the power of a server.:cite[putnam2014] The argument of the paper is that a chip made to order cannot follow software that changes faster than a chip can be made, and that ordinary CPUs no longer speed up at their old rate. A piece of a search engine became wires.
:::

:::hood[How we know the chip runs what the source says]
The claim of the last two sections is that the configured chip and the source agree. No test looks inside the fabric to see what it *should* do: each one clocks the decoded bitstream beside the RTL simulator of the source and compares every output bit after every cycle, as the board does. The chapter’s `octet-fpga.test.ts` fits Octet on the vFPGA-M, checks the router’s result independently (`checkRouting`), and then runs the walking light:

```ts from="content/chapters/31-cpus-on-a-chip/octet-fpga.test.ts"
    for (let i = 0; i < 700; i++) {
      sim.clock();
      const cmp = sim.compare();
      mismatches += cmp.mismatches.length;
      checked = cmp.checked;
```

In the same loop, each time the fabric has clocked as many cycles as the interpreter says the next instruction takes, the LEDs are compared with the interpreter’s. Three other programs (multiply, Fibonacci and hello) are then loaded into the bitstream and run the same way to their `HLT`, and `rv32-fpga.test.ts` does all of it for both RV32I cores.
:::

## Build it for real

:::real{parts="an iCE40 board (an iCEBreaker is ideal: an UP5K with a USB–UART bridge on the board), a USB cable, the open-source tools Yosys, nextpnr-ice40 and Project IceStorm, a RISC-V compiler (riscv32-unknown-elf-gcc)"}
Put a RISC-V CPU on a real FPGA and talk to it over a serial port. The core is **PicoRV32**, and the design around it, **PicoSoC**, comes with the core: the CPU, a little RAM, a UART, and a controller that reads the program from the board’s flash memory.:cite[picosoc]

1. Get the source and go to the SoC:

   ```sh
   git clone https://github.com/YosysHQ/picorv32
   cd picorv32/picosoc
   ```

2. Before building, read the files. `icebreaker.v` is the top module: its ports are the board’s pins, the same idea as the virtual board’s names, and `icebreaker.pcf` says which pin is which. `picosoc.v` is the CPU with its memory and peripherals. `simpleuart.v` is the UART of Chapter 24, and `picorv32.v` is the core, a Verilog file many times as long as this chapter’s `rv32i.dcl`, because it has the multiplier, compressed instructions, interrupts and options that ours leaves out.

3. Build and load everything, with the board plugged in:

   ```sh
   make icebprog
   ```

   The Makefile runs the flow of Chapter 30 with the real tools: Yosys (`synth_ice40 -dsp -top icebreaker`) writes a netlist as JSON, `nextpnr-ice40 --freq 13 --up5k --package sg48` places and routes it, `icetime` reports the timing, and `icepack` writes the bitstream. The firmware, C in `firmware.c` and assembly in `start.s`, is compiled by the RISC-V compiler. Then `iceprog` writes the bitstream to the board’s flash, and the firmware one megabyte further on (`iceprog -o 1M`).

4. Open the board’s second serial port (on Linux usually `/dev/ttyUSB1`) in a terminal at 115,200 baud: `picocom -b 115200 /dev/ttyUSB1` or `screen /dev/ttyUSB1 115200`. The firmware divides the 12 MHz clock by 104, which is 115,385 baud, near enough. Press the board’s reset: a banner in ASCII art, *PicoSoC*, appears, with a menu. Press `e` and what you type is echoed back: a RISC-V core on a chip you can hold is reading characters from a UART and writing them again. Press `9` for the firmware’s benchmark, and `M` for its memory test.

5. Read the flow’s reports as you read the Studio’s: how many `SB_LUT4` and `SB_DFF` cells did Yosys’s statistics list, how many block RAMs and SPRAMs, and what maximum frequency did nextpnr report? Compare with the 761 to 2,019 LUTs of the core’s README, and with Figure 31.3.

6. Change the program, not the chip. Edit the banner in `firmware.c` and run `make icebprog_fw`. Only the firmware is written to the flash, one `iceprog -o 1M` and no place and route: the same idea as *Load into the chip* in Figure 31.2, on real hardware.

7. **Octet on the same chip.** The button *Yosys netlist* in Figure 31.2 downloads Octet, with the program that is in the chip, as a Yosys JSON netlist. It is what `write_json` writes (the course’s compiler checks it against the documented format, and its own evaluator runs it beside the RTL simulator for hundreds of cycles). With it, the flow is the second half of step 3:

   ```sh
   yosys -p "read_json octet.json; synth_ice40 -top Octet -json octet.synth.json"
   nextpnr-ice40 --up5k --package sg48 --json octet.synth.json --pcf octet.pcf --asc octet.asc
   icepack octet.asc octet.bin && iceprog octet.bin
   ```

   You write `octet.pcf` yourself: give `clk` the board’s 12 MHz clock pin and the eight bits of `led` the pins of eight LEDs (a PMOD with LEDs will do), and constrain or tie off the rest; `nextpnr-ice40 --help` has the option for ports that have no pin. At 12 MHz the walking light of Figure 31.2 is a blur, because a step takes a few hundred microseconds. Nest one more delay loop in `walk.asm` and it walks.
:::

## Exercises

Two programs for the board. Each is checked, as in Chapter 24, on the reference interpreter, and each also runs on the chip in Figure 31.2: paste your solution into the editor there and press *Load into the chip*.

```asm
id: chip/echo
title: The LEDs, or their inverse
isa: octet
prompt: |
  Show the switches on the LEDs, and keep showing them: the program never stops. While **BTN0** is held, show the *inverse* of the switches. Only BTN0 counts: the other buttons, and the comparator bit of BUTTONS, must not matter.
hints:
  - 'BUTTONS is a byte, and BTN0 is its lowest bit. Mask it with AND, and Z tells you whether it is set.'
  - 'NOT inverts a register. Read the switches into a register, decide, invert or not, and store.'
explain: |
  A loop that reads both devices every time round, masks the button byte to bit 0 (AND with 1, which sets Z), inverts the switches when it is not zero and stores them. Without the mask, BTN1 to BTN3 would also invert. On the board, hold a button and watch: the loop takes about 40 cycles, so the LEDs follow within a few milliseconds at 1 kHz.
start: |2
  ; LEDS <- SWITCHES, or NOT SWITCHES while BTN0 is held. Forever.
  loop:   JMP  loop
tests:
  - { name: "BTN0 up: the switches", setup: { switches: 0x5a, buttons: 0 }, expect: { leds: 0x5a, halted: false }, maxSteps: 80 }
  - { name: "BTN0 down: their inverse", setup: { switches: 0x5a, buttons: 1 }, expect: { leds: 0xa5, halted: false }, maxSteps: 80 }
  - { name: "only BTN1: not the inverse", setup: { switches: 0x0f, buttons: 2 }, expect: { leds: 0x0f, halted: false }, maxSteps: 80 }
  - { name: "all four buttons", setup: { switches: 0xc3, buttons: 15 }, expect: { leds: 0x3c, halted: false }, maxSteps: 80 }
solution: |2
  loop:   LD   R0, [SWITCHES]
          LD   R1, [BUTTONS]
          LDI  R2, 1
          AND  R1, R2
          JZ   show
          NOT  R0
  show:   ST   [LEDS], R0
          JMP  loop
```

```asm
id: chip/nibble-sum
title: Add the two halves of the switches
isa: octet
prompt: |
  Show on the hex display the sum of the two four-bit halves of the switches: for 0x3A it is 3 + 0xA = 0x0D. Keep doing it: the program never stops.
hints:
  - 'The low half is the byte ANDed with 0x0F. Octet has no way to shift by four in one instruction: SHR four times.'
  - 'Copy the switches with MOV before you destroy them.'
explain: |
  Two nibbles, each in a register: `AND` with 0x0F for the low one, four `SHR`s for the high one, then `ADD`. The largest sum is 15 + 15 = 30, which fits in the byte the hex display takes (0x1E).
start: |2
  ; HEX <- (SWITCHES >> 4) + (SWITCHES & 0x0F). Forever.
  loop:   JMP  loop
tests:
  - { name: "none", setup: { switches: 0x00 }, expect: { hex: 0x00, halted: false }, maxSteps: 80 }
  - { name: "all", setup: { switches: 0xff }, expect: { hex: 0x1e, halted: false }, maxSteps: 80 }
  - { name: "3A", setup: { switches: 0x3a }, expect: { hex: 0x0d, halted: false }, maxSteps: 80 }
  - { name: "91", setup: { switches: 0x91 }, expect: { hex: 0x0a, halted: false }, maxSteps: 80 }
solution: |2
  loop:   LD   R0, [SWITCHES]
          MOV  R1, R0
          LDI  R2, 0x0F
          AND  R0, R2
          SHR  R1
          SHR  R1
          SHR  R1
          SHR  R1
          ADD  R0, R1
          ST   [HEX], R0
          JMP  loop
```

```quiz
q: 'Octet’s memory is 240 bytes. Written as `reg ram: [bits<8>; 240]` instead of `mem`, could it have been fitted on a vFPGA-M, which has 1,152 logic cells?'
options:
  - text: 'Yes: 1,920 flip-flops is less than the 8,192 cells of a vFPGA-L, and the flow would pick that.'
    why: 'The flow does pick the smallest device that fits, but the question is about the vFPGA-M, and the flip-flops are only the start: the array also needs a 240-to-1 multiplexer for every bit of its read ports.'
  - text: 'No: 240 × 8 = 1,920 flip-flops, and each takes a logic cell of its own, so more cells than the whole chip has, before any of the multiplexers.'
    correct: true
    why: 'A logic cell has one flip-flop, and the vFPGA-M has 1,152 cells. The block RAM holds the whole memory in 2 of the 24 RAM tiles, and costs no logic cells.'
  - text: 'Yes, because block RAM is only an optimisation and the design is the same.'
    why: 'The design is the same in behaviour; its cost is not. That the same source can be either is the point of Chapter 29’s remark that a memory “becomes flip-flops” where the chip has no RAM.'
```

```quiz
q: 'Octet at 43.3 MHz runs ADD (6 cycles) and JMP (5 cycles) in turn, in a loop of just those two. About how many times a second does the loop go round?'
options:
  - text: 'About 43 million: the clock rate.'
    why: 'The clock rate is the number of cycles a second, not of instructions.'
  - text: 'About 3.9 million.'
    correct: true
    why: 'The loop takes 6 + 5 = 11 cycles, and 43.3 million ÷ 11 is 3.94 million times a second (7.9 million instructions a second). This is the CPI and the clock of Chapter 23’s iron law, at the clock rate of this fit.'
  - text: 'About 400,000.'
    why: 'That is what 43.3 MHz would give if each cycle took ten times longer. Check the sum: 43.3 million ÷ 11.'
```

```quiz
q: 'A design keeps its data in a `mem`, and needs to read three different words of it in the same cycle. What follows?'
options:
  - text: 'Nothing: a block RAM can be read at any number of addresses at once.'
    why: 'A block RAM of this family has one read port, and DCL allows a memory at most two.'
  - text: 'It needs three read ports, which DCL does not allow: use two memories, or flip-flops.'
    correct: true
    why: 'A `mem` has at most two read ports and one write port. Three simultaneous reads need a copy of the memory (which is what a second read port is: another block RAM with the same contents) or registers built from flip-flops.'
  - text: 'It must be written with `reg`, since `mem` cannot be read.'
    why: '`mem` has reads, and they are synchronous: the word arrives one cycle after the address.'
```

```parsons
title: 'From assembly to a running chip, without a new fit'
prompt: 'Put the steps of Load into the chip in order.'
lines:
  - 'The assembler turns each instruction into one or two bytes.'
  - 'The bytes become the initial contents of the RAM: 240 words.'
  - 'Each word is written into the configuration bits of every block RAM the design uses.'
  - 'The checksums of the frames that changed are computed again, and the bitstream file is complete.'
  - 'The bitstream is decoded into a netlist of LUTs, multiplexers and RAMs, as it always is.'
  - 'The clock runs, and the CPU fetches its first byte from address 0.'
distractors:
  - 'The router finds a new path for every net.'
  - 'The LUT truth tables of the control unit are recomputed from the program.'
```

```bug
title: 'What must the tools redo?'
prompt: 'A student changes `.equ WAIT, 8` to `.equ WAIT, 20` in walk.asm and reasons about what the tools have to redo to run it on a chip that has been fitted already. Click the first line that is wrong.'
lines:
  - 'The assembler turns `LDI R2, 0 - WAIT` into a different second byte: 0xF8 becomes 0xEC.'
  - 'That byte is part of the RAM’s initial contents, which are configuration bits of the two block RAMs.'
  - 'So the control unit’s LUTs no longer match the program, and the design must be mapped and routed again.'
  - 'Only those RAM bits change, so loading the program is enough; the placement and the routes stay as they are.'
wrong: 2
why: 'The control unit does not depend on the program: it decodes whatever bytes the RAM gives it. The program is data, in the RAM, and only the RAM’s bits change. The design’s LUTs, its placement and its routing stay valid, which is why the load takes milliseconds.'
notes:
  '0': 'Correct: 0 − 20 is 256 − 20 = 236 = 0xEC, and 0 − 8 is 0xF8.'
  '1': 'Correct: the program is the initial contents of the RAM, and the flow writes those into the RAM’s tile.'
```

:::challenge[Add an instruction to the DCL core]
Every one of the 256 first bytes of Octet is an instruction, but one opcode has room: `HLT`, opcode 0, ignores the low four bits of its byte, so 0x01 to 0x0F all halt. Give four of them a new meaning, **`DEC Rd`**, which subtracts one from a register and sets the flags as `SUB Rd, 1` would: the encoding is `0000 dd01` (0x01 for R0, 0x05 for R1, 0x09 for R2, 0x0D for R3), and every other byte with opcode 0 must still halt. The assembler does not know the new instruction, so write it with `.byte`.

You do not need a new module or a new register. Change only `Control`: it already sequences the unary group in two steps (A ← Rd, then Rd ← ALU), and the ALU already has a subtraction and a way of feeding it a constant 1 (that is how INC is done). Check it in Figure 31.2: edit the design in the Source tab, load a program that uses `.byte 0x01`, and press Fit.

:::details[The five changes]
```diff
-  let hlt: bit = op == 0
+  let hlt: bit = op == 0 && sub != 1
+  let dec: bit = op == 0 && sub == 1
...
-  let unary: bit = op == 14
+  let unary: bit = op == 14 || dec
...
   } else if not {
     7
+  } else if dec {
+    1
   } else {
     0
   }
...
-  bsel_1 = in_alu && inc
+  bsel_1 = in_alu && (inc || dec)
```
`dec` is one more line of decoding, a member of the unary group, and it asks the ALU for a subtraction (code 1) with the constant 1. `hlt` must give up the encodings that `dec` takes. Everything else, the sequencer, the flags, the register write, is the machinery INC already uses.
:::
:::

:::challenge[The same job, in fewer cells]
The RV32I core of Figure 31.4 with the register file in block RAM is 1,476 cells, and 667 of them are the ALU, which has a barrel shifter for `sll`, `srl` and `sra`. Rewrite the shifter in DCL so that it shifts by one bit each cycle, and takes as many cycles as the shift amount. How many cells do you save, and what does it do to a program that shifts by 31 every time? (The core’s designers made the same choice in PicoRV32: its “small” variants have no barrel shifter.)
:::

## What’s next

You have built the whole chain: a machine drawn from gates in Chapters 21 and 22, the same machine described in 280 lines and fitted into 541 cells, a program turned into bytes and then into bits and run from a bitstream, and a real instruction set that filled more than half of a chip because of one array. And you have seen where the next number comes from: the block RAM that gave one design its memory and another its registers.

Chapter 32 steps back and asks where those cells come from. The vFPGA’s tiles are drawn from millions of transistors, and the transistors from a story that begins with a single one in 1947 and goes through the integrated circuit, Moore’s law, and the fabs that make everything in this course: how a chip like the one you have been configuring is actually made, and what it costs.
