---
number: E
title: Octet reference card
summary: The instruction set, encoding, timing, flags and memory map of the course CPU, generated from the same data the assembler and the simulator use, with the reasons for its design.
duration: Look things up
prerequisites: []
---

:term[Octet]{id=octet} is the CPU you build in Part V: an 8-bit processor with 256 bytes of memory, four general-purpose registers and 21 instructions (37 counting each jump condition). It is small enough that every wire can be followed, and big enough to run a sorting routine, a reaction-time game and Conway’s Game of Life. [Chapter 21](/chapters/datapath/) builds its datapath, [Chapter 22](/chapters/control/) its control unit, and [Chapter 23](/chapters/running-programs/) writes programs for it; this appendix is the card you keep beside you while you do.

Nothing on this card is typed in by hand. The tables and diagrams are drawn from the machine-readable description of the instruction set (`src/lib/sim/cpu/octet/spec.ts`), which the assembler, the disassembler, the reference interpreter and the gate-level CPUs all read too. If the card and the machine ever disagreed, a test would fail.

## Programmer’s model

A program sees six registers and four flags. R0–R3 hold data; PC holds the address of the next instruction byte; SP holds the address of the last byte pushed on the stack. The :term[flags]{id=status-flags} Z, C, N and V record what the last arithmetic or logic instruction produced, so that a later jump can act on it. At reset PC is 0x00 (so the program starts at address 0), SP is 0xF0 (just above RAM, so the first push writes 0xEF), and everything else is 0.

::octet-card{part="registers" n="E.1"}

Data is 8 bits wide and addresses are 8 bits wide: 256 bytes of memory, addresses 0x00 to 0xFF, in one address space for program, data, stack and devices, as in a :term[von Neumann machine]{id=von-neumann-architecture}. All arithmetic is on bytes and wraps around: 255 + 1 is 0, with the carry flag saying so.

## Encoding

Every instruction is **one byte**, `oooo ddss`, optionally followed by a **second byte** holding an immediate value or an address. The upper four bits are the opcode, so there are 16 of them. The lower four say which registers are meant: with one register operand, its number (0–3) is in `dd`; with two, the first one written in the assembly text is in `dd` (the destination, for instructions that have one) and the second in `ss`. Instructions that share an opcode use the bits they do not need for a register to say which one they are: PUSH, POP, CALL and RET share opcode 7 and are told apart by `ss`; SHL, SHR, NOT and INC share opcode 14 and are told apart the same way; and the jump opcode 15 uses all four low bits as a *condition*.

::octet-card{part="encoding" n="E.2"}

**Every one of the 256 byte values is a valid instruction.** There are no illegal opcodes: bits an instruction does not use are simply ignored by the hardware, and the assembler always writes them as 0. So a program that runs into data by mistake executes it as some instruction rather than trapping, and the decoder needs no error case. (A zero byte is HLT, so empty memory halts the machine instead of running away.)

## Instructions

Rows group the instructions by what they do. The **Byte** column is the first byte with all register fields set to 0, as a quick way to recognise an instruction in a dump: ADD R1, R2 is 0x80 with `dd` = 01 and `ss` = 10 filled in, which makes 0x86. The **Cycles** column counts the clock cycles of the multi-cycle CPU, including the two of fetching and one of decoding; click a row to see the cycles one by one.

::octet-card{part="instructions" n="E.3"}

The four ways an instruction can name its data are a register (`R2`), a constant in the instruction (`LDI R0, 42`), a fixed address (`LD R0, [0x80]`) and an address held in a register (`LDR R0, [R1]`). There is nothing more complicated: no indexed addressing, no memory-to-memory moves, no way to add a constant directly. When you miss an instruction, the idioms below show how to say it with the ones there are.

::octet-card{part="idioms" n="E.4"}

## Jump conditions

A jump instruction is `1111 cccc`, then the target address. The four bits `cccc` are a *condition*: **three bits choose one of eight tests of the flags, and the lowest bit inverts the result.** So in hardware the condition is an 8-to-1 multiplexer picking a flag combination, followed by an XOR gate: the inversion bit costs one gate and doubles the number of conditions. The inverse of “always” is “never”: JNEVER is a two-byte no-op, kept because the rule has no exception.

::octet-card{part="conditions" n="E.5"}

The usual way to use them is to compare and then jump: `CMP a, b` subtracts *b* from *a*, throws the difference away and keeps the flags. Then:

| To jump if… | Unsigned | Signed |
|---|---|---|
| *a* = *b* | JZ (JEQ) | JZ (JEQ) |
| *a* ≠ *b* | JNZ (JNE) | JNZ (JNE) |
| *a* < *b* | JC (JLO) | JLT |
| *a* ≥ *b* | JNC (JHS) | JGE |
| *a* ≤ *b* | JLS | JLE |
| *a* > *b* | JHI | JGT |

The two columns differ because the same bit pattern means different numbers: 0xFF is 255 unsigned but −1 signed, so it is bigger than 3 in the first reading and smaller in the second. Choose the column that matches how your program thinks of the data.

## Flags

**Only the ALU group** (ADD, SUB, AND, OR, XOR, CMP, and SHL, SHR, NOT, INC) **writes the flags, and it always writes all four.** Loads, moves, stack operations and jumps leave them alone. That is what lets a program compute a result, then load or move other values, and then branch on the result; and it is why a flag cannot be tested “later”, after another ALU instruction has run.

::octet-card{part="flags" n="E.6"}

- **Z** is set if the result is zero, and **N** is bit 7 of the result.
- **C is the carry out of bit 7 after an addition, but the *borrow* after a subtraction**: it is 1 when the first operand is lower than the second, treating both as unsigned. So after `CMP a, b`, `JC` means “*a* < *b*”, which reads naturally. (In hardware: the adder’s carry out, inverted when it subtracts. Chapter 14 builds the adder and the subtractor.) The 6502 and the ARM do the opposite: their carry flag means “no borrow”.
- **V** is signed overflow: the result does not fit in a signed byte because the operands’ signs make the result’s sign impossible: two positives making a negative, or two negatives making a positive. `0x7F + 0x01` sets V and N but not C; `0xFF + 0x01` sets C and Z but not V.
- **Logic instructions** (AND, OR, XOR, NOT) clear C and V. **SHL** sets every flag exactly as `ADD Rd, Rd` would; **SHR** puts the bit shifted out in C and clears V.

## Memory map

::octet-card{part="memory" n="E.7"}

The **program** starts at address 0 and grows upwards; the **stack** starts at the top of RAM and grows downwards: a program that runs out of room sees the two collide long before anything else goes wrong. Above RAM are the devices. Reading or writing them is an ordinary load or store (:term[memory-mapped I/O]{id=memory-mapped-io}), which is why the CPU needs no I/O instructions (Chapter 24 shows how the address decoder does it).

::octet-card{part="io" n="E.8"}

Two of these registers have side effects on a *read*: CONSOLE consumes the character it returns, and RANDOM steps the pseudo-random generator, an 8-bit linear-feedback shift register (Chapter 18) that visits every non-zero value before repeating.

## Why it is built this way

A CPU design is a collection of trade-offs, and each one here was made to keep the machine small enough to follow. The reasons are worth knowing, because the alternatives are what real processors use.

**Why four registers?** The instruction byte is `oooo ddss`, and two bits name one of four registers. More registers would need more bits in every instruction, either by a longer instruction or by fewer opcodes. Four is enough for real programs, since anything that does not fit lives in memory (the sorting program keeps two pointers and two values in the four registers, and the eight bytes it sorts, and a flag, in memory). It also makes the register file tiny: four 8-bit registers, one 1-of-4 decoder for writing and two 4-to-1 multiplexers for reading, which you can draw on a page. The price is more loads and stores than a machine with 16 or 32 registers would need; that is the trade of a small instruction word.

**Why one memory for instructions and data (von Neumann)?** One address space, one address register and one bus make the datapath simplest, and there is nothing special about a program: it is bytes in the same RAM as its data, so the assembler’s output is loaded in exactly the way any data would be, a program can be written by a program, and the stack, the variables and the code share one supply of 240 bytes to divide as the program needs. The price is the “von Neumann bottleneck”: an instruction fetch and a data access cannot happen in the same cycle, because there is only one memory port. A Harvard machine, with separate memories, could overlap them.

**Why multi-cycle, not one cycle per instruction?** A single shared bus carries one byte per clock cycle, so an instruction is a short sequence of transfers: `MAR ← PC`, then `IR ← M[MAR]`, and so on (click a row of the instruction table to see them). The alternative, doing the whole instruction in one long cycle, would need a separate adder for the program counter, a second memory port, and a clock as slow as the slowest instruction. Multi-cycle reuses the one ALU, the one memory port and the one bus for everything, and the clock only has to be as slow as the slowest *step*. The price is that instructions take between 4 (MOV) and 8 (CALL) cycles; and it shows in the numbers of Chapter 23, where cycles per instruction and the clock rate are traded against each other. Pipelining, which real CPUs use to overlap the steps of different instructions, is the next step beyond, and the chapter compares Octet with the RISC-V RV32I, which is designed for it.

**Why is every byte an instruction?** Because a decoder that has to spot and reject illegal patterns is bigger than one that does not, and because a machine with no way to fail is easier to specify: whatever the byte, the interpreter and the hardware have one defined answer, and the two can be compared on programs chosen at random.

**Why do only some instructions set flags?** A separate compare instruction only works if a *move* between the compare and the jump does not destroy the result, and loads, moves and stack operations are what usually sit between them. The price is that every ALU instruction pays for a flag update whether or not anyone looks, which costs nothing in hardware, since the flags are computed alongside the result anyway.

**Why 256 bytes of address space?** An address that is one byte fits in one register, one bus and one second instruction byte, so a jump is two bytes, and no instruction needs more than two. It is enough for every program in the course, and small enough that the whole memory can be shown on the screen at once.

## An example program

Here is a complete program: it adds 5 + 4 + 3 + 2 + 1 and shows the total on the LEDs. Below, the page runs the course’s assembler over it, and lists for every line the address and the bytes it produced. (Change nothing here; the box after this one is editable.)

::assemble-box{example="sum" readonly=true title="Sum of 5 to 1, assembled" n="E.9" caption="The assembler’s listing. The label loop is at address 6, so JNZ loop is assembled as the jump byte followed by 06."}

Every byte has a reason. Reading the listing with the encoding rules in hand:

| Address | Bytes | Binary | Meaning |
|---|---|---|---|
| 0x00 | `20 00` | `0010 0000` , `00000000` | LDI: opcode 2; `dd` = 00, so R0; the second byte is the constant 0 |
| 0x02 | `24 05` | `0010 0100` , `00000101` | LDI: `dd` = 01, so R1; the constant 5 |
| 0x04 | `28 01` | `0010 1000` , `00000001` | LDI: `dd` = 10, so R2; the constant 1 |
| 0x06 | `81` | `1000 0001` | ADD: opcode 8; `dd` = 00 is R0, `ss` = 01 is R1: R0 ← R0 + R1 |
| 0x07 | `96` | `1001 0110` | SUB: opcode 9; `dd` = 01 is R1, `ss` = 10 is R2: R1 ← R1 − R2 |
| 0x08 | `F3 06` | `1111 0011` , `00000110` | jump: opcode 15; condition `0011` is JNZ (test Z, inverted); the target is 6 |
| 0x0A | `40 F8` | `0100 0000` , `11111000` | ST: opcode 4; `dd` = 00 is R0; the address is 0xF8, the LEDS register |
| 0x0C | `00` | `0000 0000` | HLT |

Thirteen bytes: three loads, the two-instruction loop body, a jump, a store and the halt. Run it and the LEDs show 15 (`0000 1111`), after 110 clock cycles: the three loads take 5 each, the loop body and jump take 6 + 6 + 5 = 17 each time and go round five times, then the store takes 6 and the halt 4. The loop works because `SUB` sets Z when R1 reaches zero, and the jump right after it tests that same flag; had another ALU instruction come in between, it would have overwritten Z.

## Assemble this

The box below is the same assembler, with the example loaded into an editable box. Change the program and the listing follows; press **Run it** to execute it on the reference interpreter and see the registers, flags and LEDs when it halts. Choose *A program with mistakes* to see how the assembler reports errors: it collects all of them, each with a line number, rather than stopping at the first, and where it can it says what to write instead. The course’s demonstration programs are in the list too.

::assemble-box{example="sum" n="E.10" caption="Try changing LDI R1, 5 to another number, or SUB R1, R2 to ADD R1, R2 and watch the loop run until it wraps round. Octet has no DEC: the assembler tells you so if you try."}

## The assembler

::octet-card{part="assembler" n="E.11"}

Octet source has one statement per line, and the assembler makes two passes over it, as Chapter 23 shows: the first assigns addresses and collects labels (so a jump can refer to a label defined further down), and the second turns every statement into bytes. It refuses to emit into the device region 0xF0–0xFF, past the end of memory, or twice into the same byte, and tells you which line it was.
