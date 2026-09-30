---
number: 21
title: The datapath
summary: 'Registers hung on one shared bus, an ALU that adds and sets flags, and the twenty-four control lines that decide what moves in a clock cycle: Octet’s datapath, built from your own parts and run gate by gate, until you can be its control unit.'
duration: About 2 hours
prerequisites: [arithmetic, registers-and-counters, memory]
---

Here is the whole of what a processor does when it executes `ADD R1, R2`. It copies R1 to a holding place. It copies R2 to another. It tells the adder to add them. It copies the answer back into R1. There is nothing else: no arithmetic that is not a circuit from Chapter 14, no memory that is not a register from Chapter 18 or a RAM from Chapter 20. A CPU is **bytes moving between places, and a few places where they change on the way**. What makes it a computer is that something else decides, cycle by cycle, which moves happen.

This is the first chapter of Part V, in which you build such a machine: **Octet**, an 8-bit CPU with 256 bytes of memory, four registers and 21 instructions (the reference card is Appendix E). It comes in two halves. The half that holds the bytes and moves them, the :term[datapath]{id=datapath}, is this chapter. The half that decides what moves, the control unit, is the next. By the end of this one you will *be* the control unit: a bank of switches, one for each control line, and a clock button, and you will make the datapath add, push and fetch by setting the right switches in the right order.

:::history{year=1945 title="The First Draft" people="John von Neumann"}
*First Draft of a Report on the EDVAC*, a typescript dated 30 June 1945, was written by John von Neumann, who was consulting on the successor to ENIAC at the Moore School of the University of Pennsylvania.:cite[vonneumann1945] It described a computer as a handful of specialised parts, which he called *organs*, borrowing the vocabulary of biology: a central arithmetic part, CA, that adds and multiplies; a central control part, CC, that decides what happens next; a memory, M; and the input and output. The instructions of the program and the numbers they work on were to live in the same memory.

The draft was circulated with only von Neumann’s name on it, which is why the design is still called the von Neumann architecture, and why the Moore School engineers J. Presper Eckert and John Mauchly, who had worked on the same ideas, objected.:cite[godfrey1993] The division survives. Octet’s **datapath** is what the report called the arithmetic organ, the registers and the memory port with the wires between them, and its **control unit** is what the report called the control organ.
:::

## The map

Before any gate, here is the machine. Click any block to see what it is for.

::datapath-map{n="21.1" caption="Octet’s datapath. Everything hangs on one 8-bit bus in the middle. Blocks above the bus and below it are the registers and memory that can put a byte on it or take one from it; the ALU sits at the bottom right, with its two operand latches A and B beside it. Click a block for what it holds and which control lines work it."}

Read the picture like a road map. The **bus** is eight wires that pass every block. **Any block** may put its byte on the bus, and any number may listen, but the rule of the road is that **at most one may speak at a time**. Nothing moves unless a control line says so, and there are 24 such lines: seven that enable a driver onto the bus, seven that make a register listen, four for the counters, and the rest for memory writes and the ALU. Every byte movement in the whole machine is one driver enabled, one or more listeners told to listen, and then the clock edge. That is a :term[micro-operation]{id=micro-operation}, and one clock cycle does one.

:::programmer[A bus is a shared variable]
Think of the bus as a global variable that every part of the program reads and writes. On a single thread the rule “one writer at a time” is enforced by the order of statements; in hardware, statements happen at once, so the rule is enforced by *enable lines* that the control unit must never get wrong. Two writers at once is not a race condition that corrupts a value: it is a short circuit through two transistors, and it is the first bug you will make in the explorer below.
:::

## One bus, many drivers

A wire in a logic circuit is driven by exactly one gate output, so how can eight registers, the ALU and the memory all put bytes on the same eight wires? Chapter 10 gave the answer: the :term[tri-state]{id=tri-state} buffer. It copies its input to its output while its enable is 1, and otherwise *lets go* of the wire (high impedance, Z), as if it were not there. Put a tri-state buffer between every source and the bus, enable exactly one, and the bus carries that source’s byte; enable none, and it floats.

Octet has seven sources (Rd, Rs, PC, SP, ALU, memory and T), so each of the eight bus wires has seven tri-state buffers on it: 56 in all. In the figure below there are three on a single wire, and one more gate in front of each, which we will need in Chapter 22.

::circuit{src="21-datapath/circuits/bus-window.json" title="Three drivers on one wire" n="21.2" mode="logic" speed=1e-6 caption="Flip OE 1 and see BUS follow Data 1. Then switch on OE 2 as well: Data 1 is 1 and Data 2 is 1, so the two drivers agree and nothing happens (a fight only matters when they disagree). Set Data 2 to 0 and the wire turns red and hatched: X, contention. Now switch BUSWIN off: whatever you enable, the wire floats (dashed). The window is how the control unit keeps drivers from ever overlapping in time."}

```quiz
q: 'Two tri-state drivers are enabled on the same wire. One drives 1 and the other drives 0. What does the wire carry?'
options:
  - text: 1, because a 1 is stronger than a 0.
    why: 'In the tri-state model there is no stronger. Real outputs are a pair of transistors, one pulling to the supply and one to ground, and if two fight, both conduct: a large current flows through both, and the voltage lands somewhere in the middle.'
  - text: 0, because the wire is pulled down when there is a fight.
    why: 'Not in a tri-state circuit: nothing “wins”. (A wired-AND with open-drain outputs and a pull-up, in Chapter 10, does have a winner, but that is a different scheme.)'
  - text: Unknown. The engine shows X, and a real chip would get hot.
    correct: true
    why: 'The digital engine resolves drivers exactly this way: if one drives 0 and another drives 1, the wire is X. It also prints a warning, because a chip that does this is short-circuiting its supply through its own output transistors.'
  - text: The wire floats (Z), because nothing is driving it any more.
    why: 'Z is what you get when *no* driver is enabled. Here there are two.'
```

:::lab[Break the bus]
1. Switch on OE 1 alone. BUS follows Data 1. Click Data 1 and watch the wire follow: one driver, one value.
2. Switch on OE 2 too, with both data at 1. Two drivers, but they agree: the wire is amber and clean. The danger is not two drivers, it is two drivers that disagree.
3. Set Data 2 to 0. The wire goes red and hatched (X). In the real chip both output stages would conduct at once.
4. Switch BUSWIN off. No driver can drive: BUS is a dashed grey line (Z). Switch it on again: the wire snaps back to X.
5. Now try to find a setting of OE 1, OE 2 and OE 3 that makes BUS 1 while Data 1 is 0 and Data 2 is 0. (There is none. The bus can only ever carry what one of the drivers puts there.)
:::

### The bus window

The AND gates in front of the drivers are how Octet keeps drivers from fighting *in time*. When a control unit switches from one source to another, the enable lines do not change at exactly the same moment: one is a few nanoseconds late. For a moment both drivers are on, and if their bytes differ the bus fights, briefly. Real designs prevent this by **break before make**: turn every driver off, wait, and turn the next one on. Octet does it with one extra signal, the :term[bus window]{id=bus-window} `BUSWIN`, which is the second half of the clock cycle with its start delayed: the drivers can only drive while it is high, so nothing drives while the enable lines are still settling. Chapter 22 builds that signal. In this chapter the window is simply a switch that is left on.

:::hood[How the simulator decides what a shared wire carries]
Every output pin of every element is a *driver* with its own value, and a net’s value is the resolution of its drivers. The rule is in `src/lib/sim/digital/engine.ts`:

```ts
private resolveMany(n: number, s: number, end: number): number {
  let has0 = false;
  let has1 = false;
  let hasX = false;
  for (let i = s; i < end; i++) {
    const v = this.drvValue[this.netDrvList[i]!];
    if (v === 0) has0 = true;
    else if (v === 1) has1 = true;
    else if (v === LX) hasX = true;
  }
  const contention = has0 && has1;
  …
  return hasX || contention ? LX : has0 ? 0 : has1 ? 1 : LZ;
}
```

Drivers that are Z are ignored, which is what lets a bus have many drivers; drivers that agree give their common value; a 0 and a 1 together give X, and the warning you saw is printed the first time a net does that. A net that everybody has let go of is Z. Two more lines make the tri-state buffer itself (`src/lib/sim/digital/models/gates.ts`): `const v = en === 1 ? input(sim.nets[this.a]!) : en === 0 ? Z : X`, so a buffer whose enable is unknown drives X, and one that is off drives Z. A register that listens to a floating bus loads unknown bits, and you will see that, too.
:::

## Registers that listen

A register that always follows the bus would be useless: the bus changes every cycle. Each register in Octet has an enable that says *now*: on the rising clock edge, if its load line is on, it takes the byte that is on the bus; otherwise it keeps what it has. That is the 8-bit register of Chapter 18, with `EN` wired to a control line. Octet has these:

| Register | Load line | What it is for |
|---|---|---|
| **MAR**, memory address register | `LD_MAR` | The address the memory sees. It must be loaded a cycle before the byte moves. |
| **IR**, instruction register | `LD_IR` | The instruction being executed. Its bits go to the control unit. |
| **A**, **B** | `LD_A`, `LD_B` | The ALU’s two operands, caught one at a time from the bus. |
| **T**, temporary | `LD_T` | One spare byte, used by CALL. |
| **R0–R3** | `WE_R` (for Rd) | The four general registers, in the register file. |
| **flags** Z C N V | `LD_FLAGS` | What the ALU said about its last result. |

Why do A and B exist? Because an ADD needs two bytes at once at the ALU’s inputs, and the bus carries one byte per cycle. So the first operand waits in A while the second one arrives in B. This is what a single shared bus costs: *time*. A CPU with several buses could feed the ALU directly, and finish an ADD in fewer cycles, for more wires and more drivers. Octet’s design pays in cycles so that you can follow every byte.

### The register file

The four general registers, R0 to R3, are grouped into a **register file**: four 8-bit registers, a 2-to-4 decoder that decides which one listens, and two 4-to-1 multiplexers per bit that decide which ones speak. It has one write port (the byte on the bus, the register named by the two bits of Rd, and `WE_R`) and *two read ports that are always on*: one addressed by Rd and one by Rs. The bits of Rd and Rs are bits 3–2 and 1–0 of the instruction register, so the register file needs no control line to know *which* registers: only the instruction does, and the control unit only has to say *when*.

::circuit{src="21-datapath/circuits/regfile.json" title="A register file, four registers of two bits" n="21.3" mode="logic" speed=1e-6 caption="The same circuit as Octet’s, two bits wide so that it fits. Set WA1 and WA0 to choose a register, put a value on WD1 and WD0, set WE to 1, and press CLK: the register you chose takes the value (the decoder opens only its enable). Then use RA1 and RA0 to read any register back on QA1 and QA0. Write to two different registers and read both."}

The DCL version of this circuit is shorter than the drawing, because the language describes the *behaviour* and lets the compiler choose the decoder and the multiplexers:

```dcl
module OctetRegs(
  clk: clock,
  write: bit,
  dst: bits<2>,
  data: bits<8>,
  ra: bits<2>,
  rb: bits<2>,
) -> (qa: bits<8>, qb: bits<8>) {
  reg r: [bits<8>; 4] = [0; 4]

  qa = r[ra]
  qb = r[rb]
  for i in 0..4 {
    next r[i] = if write && dst == i { data } else { r[i] }
  }
}
```

`r[ra]` is a 4-to-1 multiplexer (Chapter 13), and `write && dst == i` is one output of the decoder. The chapter’s tests run this module, and check every operation of the ALU below against the reference interpreter.

### The counters

Two of the registers can also count. The :term[program counter]{id=program-counter} (PC) is Chapter 18’s counter with load: `PC_INC` adds one, `PC_LD` loads a new address from the bus. Every byte of an instruction that is fetched bumps it, and a jump loads it. The **stack pointer** (SP) needs to count *both* ways, so it is a plain register whose input comes from an adder: B is 0000 0001 for `SP_INC` and 1111 1111 (that is, −1) for `SP_DEC`, so the same adder does both, and the register’s enable is `SP_INC` or `SP_DEC`. On reset it loads 0xF0. Neither the SP nor the flags has a bus driver of its own: SP reaches the bus through `OE_SP`, and the flags never do.

## The ALU

The :term[arithmetic and logic unit]{id=alu} is the one place in the datapath where bytes change. Octet’s does seven things to A and B: add, subtract, AND, OR, XOR, shift A right, invert A. It is what you built in Chapter 14, an 8-bit adder/subtractor (subtraction is addition of the inverted B with a carry in), with the logic functions beside it and a multiplexer per bit to choose. The three bits `ALU_OP0–2` are the multiplexer’s select, and the codes are chosen so that ADD to XOR are the opcode’s low three bits: ADD is opcode 8, and ALU_OP 0.

Two instructions have no ALU operation of their own, and that is a trick worth seeing. **SHL is ADD with both inputs A**: A + A is A shifted left, and the carry out of the addition is the bit that fell off the top. **INC is ADD with a constant 1**. A small selector in front of the ALU’s second input picks B, or A (`BSEL_A`), or 1 (`BSEL_1`), and the ISA’s promise that “SHL sets every flag exactly as ADD Rd, Rd would” is not a design rule but a consequence: it *is* an ADD.

### The flags

The ALU also produces a result *about* the result. Four flip-flops, loaded by `LD_FLAGS`, remember it:

- **Z** is 1 when the result is 0: a NOR of the eight result bits.
- **N** is bit 7 of the result, the sign in two’s complement.
- **C** is the carry out of bit 7 after an addition, but the *borrow* after a subtraction. The adder’s carry out means “no borrow” when subtracting, so C is the carry out *inverted* for SUB and CMP. For SHR it is the bit that fell off the right end, A0; for logic operations it is 0.
- **V**, signed overflow, is the one that needs thought (Chapter 14 showed the rule in words). For an addition it is 1 when A and B have the same sign and the result has a different one. For a subtraction, A − B is A + ¬B + 1, so the same rule applies with B inverted: **V = arithmetic · (A₇ ⊙ (B₇ ⊕ SUB)) · (R₇ ⊕ A₇)**, where ⊙ is XNOR.

::circuit{src="21-datapath/circuits/flags.json" title="The flag logic" n="21.4" mode="logic" speed=1e-6 caption="The inputs are what the ALU’s multiplexer and adder give: the operation OP2 OP1 OP0 (000 add, 001 subtract, 110 shift right, others logic), the adder’s carry out COUT (which the ALU part makes 0 for every operation but add and subtract), the top bits of A, B and the result, the low bit of A, and YZ, which is 1 when the whole result is 0. Try 0111 1111 + 1: set OP to 000, A7 = 0, B7 = 0, Y7 = 1 (the result is 0x80). V lights, C does not. Now set OP to 001 (subtract): with COUT = 1 (no borrow) C stays dark, and with COUT = 0 it lights."}

```quiz
q: 'Octet computes 0x7F + 0x01 = 0x80. Which flags are set afterwards?'
options:
  - text: C only, because the result does not fit in 7 bits.
    why: 'C is the carry out of bit 7. 0x7F + 0x01 = 0x80 fits in 8 bits, so there is no carry out. (127 + 1 fits in a byte; it only fails to fit in a *signed* byte.)'
  - text: N and V.
    correct: true
    why: 'The result 0x80 has bit 7 set, so N = 1. As a signed number 127 + 1 should be +128, which does not fit, so V = 1. There is no carry out (C = 0) and the result is not zero (Z = 0). The same pattern is −128 to a signed reader and 128 to an unsigned one: only the flags say which reading went wrong.'
  - text: Z and C.
    why: 'That is what 0xFF + 0x01 gives: the result wraps to 0 (Z = 1) and there is a carry out (C = 1).'
  - text: 'None: the sum is correct.'
    why: 'As unsigned numbers it is (127 + 1 = 128), and C = 0 says so. But V = 1 says it is not correct as signed ones, and N = 1 says the result looks negative.'
```

The circuit above is what the parts bin’s ALU lacks and what Octet adds around it. In DCL the same unit is a single module: the adder is one line, the multiplexer a `match` on the operation, and each flag a line of algebra. Compare it with the schematic:

```dcl
let subtract: bit = op == 1
let arithmetic: bit = op == 0 || op == 1
let addend: bits<8> = if subtract { ~b } else { b }
let carry_in: bits<9> = if subtract { 1 } else { 0 }
let wide: bits<9> = zext(a, 9) + zext(addend, 9) + carry_in
…
// C is the carry out of an addition, the borrow (its inverse) after a subtraction, and the bit shifted out by SHR.
c = if arithmetic { wide[8] ^ subtract } else if op == 6 { a[0] } else { 0 }
// V: both operands (B inverted for a subtraction) have the same sign, and the result has the other one.
v = arithmetic && a[7] == (b[7] ^ subtract) && result[7] != a[7]
```

(`wide` is nine bits so that bit 8 is the carry out.) The chapter’s tests run this module for every A against nineteen chosen Bs, for each of the operations, and require the result and all four flags to equal what the reference interpreter gives.

:::lab[Read the flags]
Use the flag logic above (Figure 21.4).
1. **Overflow by hand.** Set OP = 000, A7 = 1, B7 = 1 (two negative numbers) and Y7 = 0 (a positive result): V lights. Two negatives made a positive. Now A7 = 1, B7 = 0, Y7 = 0: no overflow, since a negative plus a positive can never overflow.
2. **Subtraction inverts B.** Set OP = 001 (subtract), A7 = 0, B7 = 1 (a positive minus a negative, which is a big positive) and Y7 = 1: V lights. Check the sign rule: for SUB, B₇ is inverted before comparing with A₇, so this is the same case as adding two positives to get a negative.
3. **Borrow, not carry.** Set OP = 001 and COUT = 1: C stays off. COUT = 1 in a subtraction means “no borrow”, which is why 5 − 3 leaves C off and 3 − 5 turns it on.
4. **SHR.** Set OP = 110, COUT = 0 (the ALU part makes it 0 for every operation but add and subtract) and A0 = 1: C lights. Clear A0 and it goes out. The bit that fell off the right is the carry.
:::

### Build the parts

The parts bin already has an ALU, a register file and a bus, waiting for you: their checkers are the specifications above, but with a simpler flag (the bin’s ALU reports only the zero and carry flags; Octet’s flag logic goes around it). Build them from your own earlier parts: when they pass, they go into your bin, and the machine of the last section, and Chapter 22’s, will be made of them.

```build
id: datapath/bus
title: A shared bus
part: bus
allowed: [part:tri-state, tristate]
prompt: |
  Build a **bus** with two sources. Each of the eight bits of A and of B goes through a tri-state buffer; the buffers of A are enabled by **ENA** and the buffers of B by **ENB**; the outputs of the two buffers of each bit are joined into **BUS0** to **BUS7**. With only ENA on, the bus is A; with only ENB on, it is B. The checker only tests those two cases: what happens with both on, or neither, is up to the physics.
hints:
  - Sixteen tri-state buffers in all, two on each bus wire.
  - Two outputs may share a wire. Use a `label` (or wire the two outputs together) for each bit of the bus.
explain: |
  Sixteen tri-state buffers, two per wire, and nothing else. With one enable on, one buffer drives each wire and the other lets go. With both on the wires fight where A and B differ; with neither the bus floats. Octet’s bus is the same with seven sources.
solution: 21-datapath/exercises/bus.json
```

```build
id: datapath/alu
title: An ALU
part: alu
allowed: [part:adder8, part:mux8, part:mux2, and, or, xor, not, nor, buffer]
prompt: |
  Build an **8-bit ALU**. The operation **OP0–OP2** chooses: 0 A + B, 1 A − B, 2 A AND B, 3 A OR B, 4 A XOR B, 5 A shifted left by one, 6 A shifted right by one, 7 NOT A. The outputs are **Y0–Y7**, **Z** (1 when Y is 0) and **C** (the carry out of an addition or subtraction, and 0 for the other operations). Use your **8-bit adder/subtractor** for the first two.
hints:
  - The adder/subtractor’s SUB input can be OP0: for operations 2 to 7 its output is simply not selected.
  - One multiplexer per bit chooses between eight candidates: the sum (twice, for OP 0 and 1), the three gates, the two shifted bits and the inverted bit.
  - A shifted left by one gives bit i the value of A(i−1); the lowest bit gets 0. Shifted right is the other way. A constant 0 is in the palette.
  - Z is the NOR of all eight result bits: two four-input NORs and an AND.
explain: |
  The adder/subtractor makes A + B and A − B; an AND, an OR, an XOR and a NOT per bit make the logic; the shifts are wiring; a 3-bit-select multiplexer per bit picks one, and the carry out is only allowed through when OP1 and OP2 are 0. Octet’s datapath puts a small selector in front of B and a flag unit behind, and otherwise uses exactly this.
solution: 21-datapath/exercises/alu.json
```

```build
id: datapath/register-file
title: A register file
part: register-file
allowed: [part:register, part:dec2-4, part:mux4, part:mux2]
prompt: |
  Build a **register file** of four 8-bit registers. One write port: **WD0–WD7** is stored in register **WA1 WA0** on the clock edge if **WE** is 1. Two read ports that are always on: **QA0–QA7** shows the register addressed by **RA1 RA0**, and **QB0–QB7** the one addressed by **RB1 RB0**. Use your **register** parts.
hints:
  - Which register listens? A 2-to-4 decoder on WA, enabled by WE, gives one enable per register.
  - The registers all listen to the same WD bus; only their enables differ. Their CLR inputs can be tied to a constant 0.
  - Each read port is eight 4-to-1 multiplexers, one per bit, all with the same two select lines.
explain: |
  Four registers with one decoder in front of their enables and two 4-to-1 multiplexers per bit behind them. It is the circuit of Figure 21.3 made eight bits wide, and it is what the datapath uses: the two read ports are what let Rd and Rs both be readable, one after the other, on the bus.
solution: 21-datapath/exercises/register-file.json
```

```build
id: datapath/overflow
title: The overflow flag
spec:
  expression: 'V = !(A7 ^ (B7 ^ SUB)) & (R7 ^ A7)'
  inputs: [A7, B7, R7, SUB]
allowed: [and, or, xor, xnor, not, nand, nor]
prompt: |
  Signed overflow is decided by three sign bits. **A7** and **B7** are the top bits of the two operands, **R7** the top bit of the result, and **SUB** is 1 for a subtraction. **V** must be 1 exactly when the result does not fit in a signed byte: the two operands (after inverting B7 for a subtraction, because A − B is A + ¬B + 1) have the same sign, and the result has a different one.
hints:
  - For a subtraction, B has to be inverted first: an XOR of B7 with SUB does it for both operations.
  - “Same sign” is an XNOR (1 when the bits are equal); “different” is an XOR.
  - V is the AND of the two.
explain: |
  V = (A7 ⊙ (B7 ⊕ SUB)) · (R7 ⊕ A7): three two-input gates and an AND. Check it on 127 + 1: A7 = 0, B7 = 0, R7 = 1 gives 1. On −128 − 1, which is 0x80 − 0x01 = 0x7F (a wrong answer, since −129 does not fit): A7 = 1, B7 = 0 and SUB = 1: B7 ⊕ SUB = 1, so A7 ⊙ 1 = 1, and R7 ⊕ A7 = 0 ⊕ 1 = 1, so V = 1 (−128 − 1 = −129 does not fit).
solution: 21-datapath/exercises/overflow.json
```

## What moves in one cycle

Each clock cycle the control unit presents 24 lines and the datapath does what they say. To move a byte from a source to a destination it is enough to turn on the source’s driver and the destination’s load line, and clock. To add, three cycles. That is all a CPU does, so we can write down what every instruction is, as a sequence of these micro-operations:

| Instruction | Micro-operations (one per cycle) |
|---|---|
| `MOV R1, R2` | `Rd ← Rs` |
| `LD R1, [addr]` | `MAR ← PC` · `MAR ← M[MAR]; PC ← PC + 1` · `Rd ← M[MAR]` |
| `ADD R1, R2` | `A ← Rd` · `B ← Rs` · `Rd ← A + B; flags` |
| `PUSH R1` | `SP ← SP − 1` · `MAR ← SP` · `M[MAR] ← Rd` |

and before every one of them, the same two cycles that fetch the instruction itself: `MAR ← PC`, then `IR ← M[MAR]; PC ← PC + 1`. The micro-operation is written as one line but it is the state of *several* lines: `IR ← M[MAR]; PC ← PC + 1` is `OE_MEM`, `LD_IR` and `PC_INC` together. Nothing stops the control unit from doing two things in a cycle as long as they use different parts of the machine: the bus is used once, but PC counts on its own.

```quiz
q: 'Octet’s datapath has one bus. How many clock cycles does the datapath need to do R1 ← R1 + R2, once the instruction is in IR? (The bus carries one byte per cycle, and the ALU output is on the bus too.)'
options:
  - text: 'One: the ALU adds, and the result goes straight into R1.'
    why: 'The ALU needs both operands at its inputs at the same moment, and R1 and R2 are both read through the bus (Rd and Rs are both drivers of the same bus) which carries one byte at a time. They cannot both be there in a cycle.'
  - text: 'Two: one to bring each operand.'
    why: 'Close: two cycles do bring the operands, into A and B. But the result then has to travel from the ALU to R1, and the ALU result is also a bus driver. So that is a third cycle.'
  - text: 'Three: A ← Rd, B ← Rs, then Rd ← A + B.'
    correct: true
    why: 'Two cycles to carry the two operands to the ALU’s latches, one to carry the result back. A machine with two buses (or separate read ports into the ALU) could do it in one; Octet trades cycles for wires.'
  - text: Four, one for each of R1, R2, the addition and the store.
    why: 'The addition is not a cycle of its own: the ALU is always computing, from whatever is in A and B, and the result is put on the bus in the same cycle it is written back.'
```

## Be the control unit

Here is the whole datapath, gate by gate: about 3,100 gates (from your own parts, if you have built them, and from the reference parts otherwise), running on the digital engine. Every one of the 24 control lines has a switch. The eight *panel switches* can put any byte you like on the bus. Set the lines for a cycle, press **Clock**, and every register whose load line is on listens to the bus at that edge. Then set the lines for the next cycle.

::datapath-explorer{n="21.5" caption="Start with Free play: turn on the panel driver and LD_A, set the eight panel switches to a value, and press Clock. Then try the five challenges (the buttons above the picture), each starting from a state that is loaded for you. Amber outlines drive the bus and copper ones listen. Turn on two drivers that disagree and watch the bus turn red. Load a register while nothing drives the bus, and it fills with question marks. The ‘Show me’ button plays a solution."}

:::lab[Be the control unit]
1. **Move.** Pick challenge 1. IR holds MOV R3, R1: Rd is R3 and Rs is R1. Which driver puts R1 on the bus, and which line writes into R3? One clock does it.
2. **Fetch.** Challenge 2: PC is 0 and memory holds 0x86. The two fetch cycles are always the same; do them, and notice that PC ends up as 1: the second cycle counted.
3. **Add.** Challenge 3. Three cycles. After the first, look at A; after the second, at B; the ALU block shows their sum all along, and only the third cycle carries it onto the bus and into R1. What are the flags afterwards? Why is that different from the flags of challenge 5?
4. **Double.** Challenge 5 has no shifter: set the ALU’s second input to A and add. R0 = 0x96 becomes 0x2C with carry and overflow set. Why does V light? (0x96 is −106 as a signed byte, and −212 does not fit.)
5. **Break it.** In free play, put the panel on the bus *and* turn on OE_PC. When the two disagree the bus goes red. Then turn on LD_A, press Clock, and read A.
:::

:::note[Why the fetch is separate from the instruction]
The two fetch cycles happen for every instruction, whatever it is. Nothing in them depends on IR, because IR is what they are *loading*. That is why the control unit of Chapter 22 needs a step counter as well as the instruction: the steps 0 and 1 are the same for every instruction, and only from step 3 do the instructions differ.
:::

### The whole of the datapath in DCL and in gates

You have now seen every piece. The circuit you just ran is generated by `addDatapath`, in this chapter’s folder, which writes the machine down one part at a time. Its most interesting lines are the stack pointer (the adder that adds ±1 and the 0xF0 that a reset loads into a register with no load input) and the bus drivers:

```ts
// The stack pointer: SP + 1 or SP − 1 (B = 0000 0001 or 1111 1111) is the adder's own output; a reset loads 0xF0.
for (let i = 0; i < 8; i++) spPins[`B${i}`] = i === 0 ? hw.one : 'SP_DEC';
…
const spD = spSum.map((s, i) => (i < 4 ? hw.and([s, nrst]) : hw.or([s, rst])));
const spEn = hw.or(['SP_INC', 'SP_DEC', rst]);
hw.reg('SP', spD, { clk, en: spEn, clr: hw.zero, init: 0xf0 });
…
// A driver is on only while its OE line is 1 *and* the bus window is open.
for (const [src, en] of drivers) {
  const on = hw.and([en, 'BUSWIN']);
  src.forEach((n, i) => hw.tri(n, on, BUS[i]!));
}
```

Everything else in the datapath is a register, a multiplexer or a gate in a line or two: a decoder in front of four registers, a mux in front of each read port. That is the point. Once the parts exist, a datapath is *assembly*.

## Build it for real

:::real{parts="74HC161, 74HC00, 4 × LED, 4 × 330 Ω resistors, 4 × 10 kΩ resistors, 4 × DIP switch, 2 × pushbutton, 5 V USB supply module, breadboard, jumper wires"}
**A program counter.** The 74HC161 is a 4-bit synchronous counter with a parallel load, in a 16-pin package:cite[ti-sn74hc-family] — it is Octet’s PC, four bits wide. Its pins (check them against your datasheet): CP (the clock) is pin 2, MR̄ (reset, active low) pin 1, D0–D3 pins 3–6, PE̅ (parallel enable, active low: pulling it low loads D on the next clock edge) pin 9, CEP and CET (count enables, both high to count) pins 7 and 10, Q0–Q3 pins 14–11, ground pin 8 and +5 V pin 16.

Wire an LED with a 330 Ω resistor on each Q output, a 10 kΩ pull-down and a DIP switch on each D input, and tie MR̄, CEP and CET to +5 V. Use a pushbutton for CP (debounce it with a flip-flop, Chapter 17) and another for PE̅ (with a pull-up resistor: it is active low). Press the clock: the LEDs count in binary. Set the DIP switches to 1010 and press the load button, then the clock: the count goes from 1010 to 1011. That is `PC_INC` and `PC_LD`, and the DIP switches are the bus. In Chapter 22 a circuit presses both buttons for you.
:::

## What’s next

You now hold a machine with no will of its own. Every cycle, 24 wires decide what it does, and you have been holding them in your hand. That does not scale: a program is thousands of cycles long, and the lines must be right every time, for every instruction, at 5 MHz. Chapter 22 builds the thing that does this: a circuit that reads the instruction register and a step counter, and writes the 24 lines, cycle after cycle. It comes in two forms, one made of gates and one made of memory, and the second is Maurice Wilkes’s idea of 1951.
