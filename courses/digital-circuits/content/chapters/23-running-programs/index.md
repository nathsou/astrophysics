---
number: 23
title: Running programs
summary: A program is bytes in memory, the assembler is a table lookup, and one three-step loop, fetch, decode, execute, runs everything from a countdown to a sorting routine. Watch it a cycle at a time, count what it costs, and write your own.
duration: About 2.5 hours
prerequisites: [control]
---

At eleven o’clock on the morning of 21 June 1948, in a laboratory in Manchester, a machine the size of a room began to run a program that was stored in its own memory. It took 52 minutes. The program was 17 instructions long, and it found the biggest number that divides 2<sup>18</sup> without being 2<sup>18</sup> itself: 131,072, or 2<sup>17</sup>, which any of us could have told the machine, but it had to try every candidate downwards to find out.:cite[sim-baby,manchester-baby] Nothing in it was new, except that the instructions were sitting in the same electronic memory as the numbers.

You have built that machine. Chapter 21 gave it a datapath and Chapter 22 a control unit that turns a byte into a sequence of transfers. A CPU with nothing to run is a very expensive space heater, so this chapter is about what goes into memory: the bytes, the tool that writes them, the loop that reads them, and how much time each of them takes. Start with one byte.

```quiz
q: 'Address 0 of Octet’s memory holds the byte 0x86. What is it?'
options:
  - text: 'An ADD instruction, because 0x86 is the code for ADD.'
    why: 'It is an ADD instruction if the CPU fetches it as one, which it does if the program counter points at it. But that is a fact about how the byte is used, not about the byte.'
  - text: 'The number 134, because a byte in memory is data.'
    why: 'It is the number 134 (or −122 if you read it as signed) if a load instruction reads it. Same problem: that is what the reader does with it, not something written on the byte.'
  - text: 'Either. The byte does not know which; the machine decides by what it does with it.'
    correct: true
    why: 'Octet is a von Neumann machine, with one memory for programs and data. If PC reaches 0x86 it is fetched, decoded and executed as ADD R1, R2. If LD reads it, it is 134. A program that runs off its end into data executes the data. That is the whole idea of the stored program.'
```

## Bytes that mean things

An Octet instruction is one byte, `oooo ddss`, plus at most one more byte for a constant or an address. The top four bits choose the instruction, and the bottom four say which registers it uses, or, for the instructions that need no register, which variant of the instruction it is. That is all of the :term[machine code]{id=machine-code}. The figure lets you write it in the machine’s own terms: click any of the eight bits and see the instruction they make.

::encode-explorer{n="23.1" caption="Click the bits of the first byte, or choose an instruction and its registers. The coloured groups are opcode (blue), the destination register dd (green), the source register ss (purple) and, for the instructions that share an opcode, fixed bits that say which one (copper). Dashed bits are ignored. Start from 0x86 and make it SUB R1, R2 by flipping one bit. Then find the byte for HLT, and see how many bytes are HLT."}

Two things about that table are worth noticing. **Every one of the 256 bytes is an instruction.** There are no illegal opcodes: bits that an instruction does not use are ignored, so the decoder never has to say “error”. A zero byte is HLT, so a program that falls off its end into empty memory stops instead of running amok. And **the machine has no idea what a “program” is**. It has a program counter that says where the next byte is, and a fetch that reads it.

:::programmer[Machine code is a serialisation format]
A compiler’s last step is to serialise its instructions to bytes, and a disassembler parses them back. Octet’s format is fixed-width in the first byte and has one optional operand byte, so it can be decoded with a single 256-entry table lookup (`DECODE_TABLE` in the course’s code): index by the byte, get the instruction. Real ISAs do the same thing, with more elaborate tables: RISC-V’s base instructions are always 32 bits and are read by looking at 7 bits of opcode; x86 instructions vary from 1 to 15 bytes, and finding where the next one starts is a hard problem in itself.
:::

:::history{year=1948 title="Programs in the memory" people="Tom Kilburn, Freddie Williams, Geoff Tootill" source="Sources: Science and Industry Museum; University of Manchester, Computer 50; Engineering and Technology History Wiki."}
On 21 June 1948 the Manchester “Baby” ran the first program ever held in an electronic memory.

The Small-Scale Experimental Machine, built by Freddie Williams, Tom Kilburn and Geoff Tootill at the University of Manchester, was a test bed for a new kind of memory, the Williams tube, which stores a bit as a spot of charge on a cathode-ray tube.:cite[ethw-baby] The machine had 32 words of 32 bits, 1,024 bits in all, and just seven kinds of instruction; it had no add instruction, since subtraction and negation were all its hardware could do, and addition was subtraction of a negative.:cite[manchester-baby] Kilburn wrote its first program, 17 instructions long, to find the highest proper factor of 2<sup>18</sup> by trying every smaller number in turn, and at 11 am on 21 June it ran for 52 minutes and stopped with the right answer.:cite[sim-baby]

The machine that had come before it, the ENIAC, was “programmed” by moving cables and switches. On the Baby the program was in the same memory as its data and could be changed in seconds, and, in principle, by itself. Octet has an add instruction, and no DEC, but the arrangement is the Baby’s: one memory, one bus, bytes that are instructions or numbers depending on who reads them.
:::

In 1975 the Altair 8800, the first microcomputer to sell in large numbers, had no keyboard or screen: the front panel had a row of toggle switches and a row of lamps, and you loaded a program by setting the switches to an address, pressing one, setting them to a byte and pressing another.:cite[nmah-altair] Every program began as a table of instructions and their hex codes, worked out by hand. That table lookup is what an *assembler* automates.

## The assembler is a table lookup

Writing `0x86` is hard to read and hard to change, so we write `ADD R1, R2`: a *mnemonic* for each instruction and names for the registers. A program in this notation is *assembly language*, and the program that turns it into bytes is the :term[**assembler**]{id=assembler}. It is much simpler than a compiler. Each line means one instruction, and what the assembler does with a line is look up the mnemonic in a table to get the opcode, look up the registers to get the two-bit fields, and glue them together. Reading it back, the disassembler uses the same table the other way.

There is one complication, and it is the reason for the word *two-pass*. Code refers to places by name:

```text
        JNZ  loop     ; jump back to where "loop:" is
        CALL pause    ; call the code at "pause:", which is further down
```

A jump needs the *address* of its target as its second byte, and that address is the sum of the sizes of everything before it. When the assembler reaches `CALL pause` it has not yet seen `pause:`, so it cannot know what number to write. There are two ways out: guess and patch later (what linkers do), or read the whole program twice. Octet’s assembler reads twice. **Pass 1** only measures: each line is an instruction of one or two bytes, or data, so it can keep a running address, and when it meets a label it writes down the address in the :term[*symbol table*]{id=symbol-table}. **Pass 2** goes back and emits the bytes, and now every label has a value.

::assembler-passes{n="23.2" caption="Step through the assembler, one line at a time. In pass 1 each line gets an address and the labels go into the table; where an operand names a label that has not been defined yet (pause, on line 5) the byte is a red hole. In pass 2 the table fills it in. Try Blink and find the forward reference in it, and Hello, where message is used before it is defined."}

:::hood[The two passes, in the real assembler]
This is the whole of pass 1 for a label (`src/lib/sim/cpu/octet/assembler.ts`). The address is a running counter, `pc`, and defining a label just records its value:

```ts
while (ts.peek().kind === 'ident' && ts.isPunct(':', 1) && !ts.peek().text.startsWith('.')) {
  const t = ts.next();
  ts.next();
  defineSymbol(t.text, t, line, 'label', { value: pc });
  const list = labelsAt.get(pc) ?? [];
  list.push(t.text);
  labelsAt.set(pc, list);
}
```

An instruction is measured and its first byte is already known, since it depends only on the mnemonic and the registers (`encodeFirstByte` is the table lookup). The operand is kept as an expression, unevaluated, and `pc` advances by the size of the instruction:

```ts
stmts.push({ kind: 'instr', line, addr: pc, spec, first: encodeFirstByte(spec, d, s), operand });
pc += spec.bytes;
```

Pass 2 goes through the saved statements. The expression of an operand can now use any label, because pass 1 has finished; it is evaluated, range-checked and written:

```ts
const v = final(st.operand.expr, st.addr);
if (st.operand.role === 'imm') {
  if (!inRange(v, -128, 255)) throw exprError(st.operand.expr, `value ${v} does not fit in a byte (−128 to 255)`);
} else if (!inRange(v, 0, 255)) throw exprError(st.operand.expr, `address ${v} is outside memory (0–255)`);
bytes.push(v & 0xff);
```

The first pass needs to know only the *size* of each line, never its value, which is why a `.space` directive must have a size the first pass can compute (“the size in .space must be known on the first pass: it cannot use labels defined further down” is a real error message). Everything the reader sees in the listing of the flagship figure comes from these two loops. The assembler collects every error with its line number, rather than stopping at the first, and for the instructions people expect but Octet does not have, it says what to write instead (`DEC` gets “use SUB with a register that holds 1”).
:::

## Fetch, decode, execute

Whatever the program, the CPU does the same three things over and over. It **fetches** the byte the program counter points at and advances the program counter; it **decodes** the byte to find out what it is; it **executes** it, which is one or more register transfers on the bus. Chapter 22 built the controller that sequences these (the whole instruction set is on the [reference card](/appendix/octet/)): on Octet, fetch takes two clock cycles (`MAR ← PC`, then `IR ← M[MAR]; PC ← PC + 1`), decode takes one, and execute takes from one to five, one bus transfer each, so an instruction takes between four and eight cycles.

This program adds the numbers from 5 down to 1 and shows the result on the LEDs:

```text
        LDI  R0, 0          ; R0 = the running total
        LDI  R1, 5          ; R1 = the number to add next
        LDI  R2, 1          ; R2 = the constant 1 (Octet has no DEC)
loop:   ADD  R0, R1         ; total = total + R1
        SUB  R1, R2         ; R1 = R1 - 1; Z is set when it reaches 0
        JNZ  loop           ; not zero yet: go round again
        ST   [LEDS], R0     ; 15 = 0000 1111 on the LEDs
        HLT                 ; stop the clock
```

It is 13 bytes long. The assembler puts `LDI R0, 0` at addresses 0 and 1, `LDI R1, 5` at 2 and 3, and so on; `loop` is at address 6, so the jump is `F3 06`. Before you run it, predict how long it takes.

```quiz
q: 'The program above runs to HLT on Octet (LDI takes 5 cycles, ADD and SUB 6, a jump 5, ST 6 and HLT 4). How many clock cycles does it take?'
options:
  - text: 'About 22, one for each instruction executed.'
    why: 'That would be the answer for a machine that does one instruction per clock cycle. Octet takes 2 cycles just to fetch and 1 to decode every instruction, before it does anything.'
  - text: '110.'
    correct: true
    why: 'Three LDIs take 15 cycles. The loop body is ADD, SUB and a jump: 6 + 6 + 5 = 17 cycles a time, and five times round is 85. Then ST takes 6 and HLT takes 4: 15 + 85 + 6 + 4 = 110.'
  - text: 'About 500.'
    why: 'The program is short and the instructions take 4 to 8 cycles each. 20 instructions cannot take 500 cycles.'
```

::octet-computer{program="sum" n="23.3" title="Watch one instruction cycle by cycle" panels="registers,cycles,history" devices="leds" rate=1 caption="This is the machine: a program in memory, a program counter, and the clock. Press Cycle to run one clock cycle at a time, and follow the transfer in the box under the registers: the two fetch cycles (MAR ← PC; IR ← M[MAR] and PC ← PC + 1), the decode, then the execute cycles of LDI R0, 0. The register that a transfer writes turns amber; the one it reads from is outlined in blue. IR, MAR, A, B and T, with dashed borders, are the datapath’s own registers, which the programmer never names. Then press Run and use the Clock slider to slow it down or speed it up."}

:::lab[Follow the loop]
1. Press *Cycle* five times. `LDI R0, 0` has run: it took 5 cycles, and the history lists it. Look at PC: it is 2, not 1, because LDI is two bytes and its second fetch also advanced PC (`Rd ← M[MAR]; PC ← PC + 1`).
2. Step to the first `ADD R0, R1`. Its three execute cycles copy R0 into A, R1 into B, and then write A + B back to R0 and to the flags. Which registers glow on each cycle? (A, then B, then R0 and FLAGS.)
3. Click the dot beside the `JNZ loop` line to set a breakpoint, press *Run*, and watch it stop each time it gets there. R1 is 4, then 3, 2, 1, and finally 0. On the last stop the SUB has just set Z, so the jump is not taken and the program falls through to the `ST`.
4. Press *Reset*, drag the Clock slider to 1 MHz and run again: the whole thing is over in 110 µs, faster than the eye can see. The LEDs read 15. Change `LDI R1, 5` to another number in the editor and press Reset.
:::

Look at what the history and the counters say: 20 instructions took 110 cycles, so on average an instruction took 5.5. The two fetch cycles and the decode cycle, which do no useful work for the program, are three cycles of the 5.5. We shall come back to that number.

## Loops, flags and decisions

A loop is only a jump backwards, and a decision is a jump that sometimes does not happen. What decides is the **flags**. The ALU group of instructions (ADD, SUB, AND, OR, XOR, CMP and the shifts) sets Z (zero), C (carry or borrow), N (negative) and V (overflow) from its result, all four every time, and no other instruction touches them. The jump instructions then test them. In the countdown, SUB sets Z when R1 reaches zero and `JNZ` looks at that same flag; had an ADD come in between, it would have overwritten Z and the loop would have run on for ever. Loads and moves do not touch the flags, which is exactly why they can sit between the test and the jump.

To compare two numbers, `CMP a, b` subtracts and throws the answer away, keeping the flags. Then a jump can ask whether a was smaller. But *smaller* depends on what the bits mean. Chapter 14’s wheel showed that 0xFF is 255 as an unsigned number and −1 as a signed one, so is it below 3?

```quiz
q: 'CMP R0, R1 with R0 = 0xFF and R1 = 3. Which jumps are taken? (JC: jump if below, unsigned. JLT: jump if less than, signed.)'
options:
  - text: 'JC and JLT are both taken: 0xFF is less than 3 whichever way you read it.'
    why: 'Not quite: 255 is not less than 3, so as unsigned numbers R0 is not below R1.'
  - text: 'Neither is taken: 0xFF is bigger than 3.'
    why: 'It is bigger if 0xFF means 255. If it means −1, it is smaller than 3.'
  - text: 'JLT is taken and JC is not.'
    correct: true
    why: 'As unsigned numbers 255 ≥ 3, so no borrow: C = 0 and JC is not taken. As signed numbers −1 < 3: N ≠ V, so JLT is taken. The same subtraction sets the flags, and the jump you choose decides which reading of the bits you meant.'
  - text: 'JC is taken and JLT is not.'
    why: 'The other way round. C is the borrow: it is 1 only when the first operand is lower as an unsigned number, and 255 is not lower than 3.'
```

::octet-computer{program="compare" n="23.4" title="The same comparison, read two ways" panels="registers,history" devices="leds" rate=3 caption="Run the program: bit 0 of the LEDs is the unsigned answer to “is 0xFF less than 3?”, bit 1 the signed answer. It ends with LEDs 0000 0010: signed, yes; unsigned, no. Then change LDI R0, 0xFF to LDI R0, 2 and press Reset and Run: now both bits are set. Watch the flags after each CMP: C and N ≠ V are the two tests."}

How does a jump instruction pick among 16 conditions? The four low bits of the jump byte are the condition, and the hardware is as small as the encoding suggests: three of the bits choose one of eight tests of the flags with a multiplexer, and the fourth inverts the answer with an XOR gate. Five of the tests are just a flag; three need a gate of their own (N ⊕ V, C ∨ Z, and Z ∨ (N ⊕ V)) and one is “always”.

::circuit{src="23-running-programs/circuits/jump-unit.json" n="23.5" title="How a jump decides" mode="logic" speed=1e-6 caption="Set the flags Z, C, N, V and the four condition bits c3 c2 c1 c0 of a jump byte (the low nibble of 0xF3, JNZ, is 0011: c3 c2 c1 = 001 choose Z, and c0 = 1 inverts it). The lamp is lit when the jump would be taken. Set c3–c0 to 1011 (JGE) and toggle N and V: it is taken when they are equal. Then find the setting that never jumps, whatever the flags: c3–c0 = 0001 is JNEVER, a two-byte no-operation."}

:::lab[Choose a jump]
1. Set c3 c2 c1 c0 to 0011 (JNZ), then switch Z on and off: the jump is taken only when Z is off. Now change c0 to 0 (JZ): the opposite.
2. Set 0100 (JC / JNC territory: 0100 is JC). Toggle C. Then 0101, JNC.
3. Set 1010 (c3 c2 c1 = 101: the base test is N ⊕ V, and c0 = 0: this is JLT). Turn N on with V off, then V on with N off, then both on: the jump is taken in the first two and not in the third. Overflow flips the meaning of the sign bit, which is why signed comparison is N ⊕ V and not just N.
4. The chapter’s tests run all 256 combinations of the 16 conditions and 16 flag settings through this circuit and check the answer against the specification’s own table of conditions.
:::

## Bigger programs

With loops and decisions you can compute anything a byte-sized machine can, if slowly. Two examples from the course’s library show what a real program looks like.

**Multiplication** is the shift-and-add of Chapter 14, as a loop. To multiply x by y, look at each bit of y from the right: if it is 1, add x to the product; then shift x left, since the next bit is worth twice as much. The product of two bytes needs 16 bits, so the program keeps it in two bytes and adds with carry by hand, using the C flag left by the addition to bump the high byte.

```text
loop:   SHR  R2                 ; C = the next bit of y
        JNC  skip
        LD   R3, [lo]           ; product += R1:R0
        ADD  R3, R0
        ST   [lo], R3
        LD   R3, [hi]           ; loads leave the flags alone, so C is still
        JNC  nocarry            ; the carry out of the low byte
        INC  R3
nocarry: ADD R3, R1
        ST   [hi], R3
skip:   SHL  R1                 ; R1:R0 <<= 1: the bit leaving R0 enters R1
        SHL  R0
        JNC  more
        INC  R1
more:   OR   R2, R2             ; any 1 bits left in y?
        JNZ  loop
```

::octet-computer{program="multiply" n="23.6" title="13 × 11" panels="registers,history,memory" devices="leds,hex" rate=6 caption="Press Run. The product, 143, appears as 0x008F: the high byte on the hex display and the low byte on the LEDs. Set a breakpoint on the SHR line and step through it: each time round, R2 loses a bit to the carry flag (13 × 11 = 1011 × 1101). Try other numbers by editing the two .byte lines at the bottom (x and y), and Reset."}

The trick in the listing is worth a second look. `OR R2, R2` does nothing to R2, but it sets the flags from it, so Z says “nothing left to shift”. Octet has no instruction “test a register”, so programmers say it with an operation that leaves the value alone. Note also which instructions the loop uses in between: loads and stores do not touch the flags, so the carry from `ADD R3, R0` is still there three instructions later.

**Fibonacci** stops for a different reason. Each pass through the loop computes the next number, and the loop ends when the addition carries out of the byte: the carry flag is the loop condition, and the program has no counter at all. The last number that fits in a byte is 233, the 13th. **Hello, world** walks a pointer through a string in memory until it reads a zero byte, and writes each character to the console with a store: `ST [CONSOLE], R0`. Both are in the program list of the figure above, one click away.

## The stack and subroutines

A program of any length has code it wants to use from several places: print a number, wait a while, multiply. A :term[**subroutine**]{id=subroutine} is that code, and it needs two things a jump cannot give: a way to get *back* to wherever it was called from, and somewhere to keep that return address while the subroutine itself calls others. The answer is the :term[**stack**]{id=stack}, a region of memory managed with the stack pointer SP. `CALL addr` pushes the address of the instruction after it and jumps; `RET` pops that address into PC. `PUSH` and `POP` do the same for a register. The stack starts at the top of RAM (SP = 0xF0, so the first push writes 0xEF) and grows *down*, towards the program, so a program that pushes too much would eventually overwrite its own code.

```text
        LDI  R0, 5
        CALL quad           ; R0 = 4 * R0
        ST   [LEDS], R0     ; 20
        HLT

quad:   CALL double
        CALL double
        RET

double: SHL  R0             ; R0 = 2 * R0
        RET
```

```quiz
q: 'In the program above, what is the deepest the stack gets, and what does SP hold then?'
options:
  - text: 'One return address deep: SP = 0xEF.'
    why: 'That is the depth while quad is running, before it calls anything. But quad itself calls double.'
  - text: 'Two return addresses deep: SP = 0xEE.'
    correct: true
    why: 'CALL quad pushes the return address 0x04 at 0xEF. Then quad’s CALL double pushes another (0x09) at 0xEE, so SP = 0xEE while double runs. After double returns and is called again, the second call reuses 0xEE. Each RET pops one address and SP goes back up.'
  - text: 'Three deep: SP = 0xED.'
    why: 'There are only ever two calls in progress at once: quad, and double called from it. The second CALL double happens after the first has returned.'
```

::octet-computer{program="stack" n="23.7" title="Calls and returns" panels="registers,history,memory" devices="leds" rate=3 caption="Step through with Cycle and Instruction. Look at the stack in the memory grid (the green cells, from SP up to 0xEF) after each CALL: the return address appears at 0xEF, then 0xEE. RET does not erase them, it only moves SP, so the old values stay in memory as debris until something overwrites them. Watch the five cycles of CALL in the cycle box: it needs the temporary register T to hold the target while it pushes the return address."}

Subroutines make bigger things possible. Here is one that prints a byte in decimal on the console. Octet has no divide instruction, so dividing by 100 and by 10 is repeated subtraction, counting how many times the divisor goes in; the quotient is a digit and the remainder goes to the next round. Printing 137 is `1`, `3`, `7`.

::octet-computer{program="print-decimal" n="23.8" title="Print a number" panels="registers,history" devices="console" rate=7 caption="Run it: 137 appears on the console. The digit subroutine is called twice from print_dec, and it saves the remainder with PUSH while it prints a character, so the stack is three deep at its deepest: two return addresses and the pushed remainder. Change LDI R0, 137 to 5 or 200 and Reset: leading zeros are skipped by keeping a flag in R2. Then change the speed to 50 Hz and watch a subtraction go round."}

## How fast is it?

Every instruction pays two cycles to fetch and one to decode. Is that a lot? You can measure. The figure below ran six programs on the reference interpreter, counted the instructions and the clock cycles, and divided: the result is the :term[cycles per instruction]{id=cpi} (CPI).

::cpi-chart{n="23.9" caption="Cycles per instruction (CPI) of six programs. Each bar is 3 cycles of fetch and decode plus the average cycles of the instruction’s own work. Click a program, and move the Clock slider: the box shows how long it takes (instructions × CPI ÷ clock) at that speed."}

Every program lands between about 5 and 5.5. That is not a coincidence of these programs: all instructions take between 4 and 8 cycles, with most taking 5 or 6, so the average has nowhere else to go. More than half of the time (3 of every 5.5 cycles) goes on fetching and decoding rather than doing. It is a *cost of the design*: with one shared bus, the fetch cannot overlap the previous instruction’s execution, because the bus is busy. And it is the number that decides how fast the machine is:

**time = instructions × cycles per instruction × time per cycle.**

This is the :term[*iron law*]{id=iron-law} of processor performance. There are three ways to run a program faster: fewer instructions (a better program, or an instruction set that does more per instruction), fewer cycles for each (a better microarchitecture), or shorter cycles (a faster clock, which Chapter 15’s critical path allows only if the slowest step gets shorter). They pull against each other. A single-cycle machine would have CPI 1, but its clock would have to be as slow as the slowest whole instruction. Octet’s multi-cycle design has a short clock, since each cycle is one bus transfer, but pays 5.5 of them per instruction. A *pipeline*, which overlaps the fetch of one instruction with the execution of the last, gets the CPI back to about 1 without lengthening the clock, at the price of hazards to manage. The next step beyond this course is [instruction scheduling and the pipeline simulator in SSA to Silicon](../../../compiler-backends/#/ch/scheduling).

:::history{year=1971 title="A CPU on a chip" people="Federico Faggin, Ted Hoff, Stan Mazor, Masatoshi Shima" source="Sources: Intel, Announcing a New Era of Integrated Electronics; Computer History Museum, The Silicon Engine; the Intel 4004 data sheet, as summarised in Wikipedia."}
On 15 November 1971 Intel ran a two-page advertisement in *Electronic News*, “A new era of integrated electronics”, for a chip set that included the 4004.:cite[intel-4004-vault]

It began as a contract: Busicom, a Japanese calculator company, wanted a set of custom chips, and Ted Hoff and Stan Mazor at Intel suggested a small general-purpose processor with the calculator’s work done in programs instead; Federico Faggin took over the design, and Masatoshi Shima, from Busicom, worked on it with him.:cite[chm-4004] The 4004 was a 4-bit processor of about 2,300 transistors with 46 instructions and a clock of at most 740 kHz.:cite[chm-4004,wiki-intel-4004] Its instruction cycle was 10.8 µs, which is eight clock periods:cite[wiki-intel-4004]: a CPI of 8 for a single-word instruction, against Octet’s 4 to 8. A 4004 executed at most about 92,000 instructions a second, and Octet at the same clock, with a CPI of 5.5, would manage about 135,000, on bytes instead of nibbles. The multi-cycle design of this chapter is the design of the first microprocessor; the CPU had become a component, sold by the thousand.
:::

### The same task on RISC-V

Chapter 31 builds a second CPU on the same virtual board: RV32I, the base of the RISC-V instruction set. It is a good contrast. RISC-V instructions are all 32 bits long, there are 32 registers of 32 bits (x0 is always zero), there is no flags register, and a branch compares two registers itself (`beq`, `blt`) instead of relying on an earlier CMP.:cite[riscv-spec] The course’s RV32I core also takes 2 or 3 cycles for every instruction, against Octet’s 4 to 8. Here are the same two programs on the two machines, from the course’s interpreters:

| Program | CPU | Bytes | Instructions | Cycles | CPI |
|---|---|---|---|---|---|
| 13 × 11 by shift-and-add | Octet | 49 | 60 | 329 | 5.48 |
| | RV32I | 64 | 29 | 69 | 2.38 |
| Sort 8 bytes | Octet | 38 | 581 | 2,941 | 5.06 |
| | RV32I | 68 | 317 | 847 | 2.67 |

The RISC-V core needs about half the instructions, because its registers are wide enough to hold the whole product and it compares and branches in one instruction; and about a third of the cycles, because each of its instructions is cheaper. But it uses more bytes, in these programs, since every instruction is four bytes to Octet’s one or two. There is no free lunch: a small instruction word gives a small program and a slow one. That is why instruction sets are designed by measuring what real programs do and spending the transistors where the time goes.

## Memory-mapped devices

One thing the programs above all used without comment is `ST [LEDS], R0`. Octet has no instruction to “output”; the top 16 bytes of its address space, 0xF0 to 0xFF, are not memory at all but the board’s devices, so writing to 0xF8 lights the LEDs, and reading 0xF9 reads eight switches. It is called :term[memory-mapped I/O]{id=memory-mapped-io}, and it costs the CPU nothing: a store is a store, and an address decoder decides that this one goes to a device instead of RAM. Chapter 24 opens the decoder up and shows what is behind each of these addresses, from PWM to serial ports.

Devices are read by :term[**polling**]{id=polling}: keep asking. The echo program below waits for a typed character by reading the console again and again until it gets something other than 0:

```text
loop:   LD   R0, [CONSOLE]  ; the next typed character, or 0
        OR   R0, R0
        JZ   loop           ; nothing yet: look again
        ST   [LEDS], R0
        ST   [CONSOLE], R0
        JMP  loop
```

## Write programs

Four programs to write, each in the editor below with tests that check the final registers, memory or devices. Press *Run* to try your code with the devices, and *Check* to run every test. The last two also set a limit on clock cycles, so the obvious solution is not enough.

```asm
id: run/sum-list
title: Sum a list
isa: octet
prompt: |
  The number of bytes in a list is at address `n` (0x80), and the bytes follow from address 0x81. Add them up **modulo 256** (the sum wraps like any byte), leave the sum in **R0**, and also store it at address `result` (0x90).
hints:
  - 'A pointer in a register walks the list: `LDR R3, [R1]` reads the byte it points to, and `INC R1` moves it on.'
  - 'How do you know when to stop? Either count down (you will need a 1 in a register for SUB), or work out where the list ends once, `list + n`, and compare the pointer with that.'
  - 'After `INC` and `ADD` the flags describe the result, so `CMP R1, R2` right before the jump is what a loop test looks at.'
explain: |
  The solution computes the end of the list once, `list + n`, and loops until the pointer reaches it. The empty list has to be tested before the loop, since the loop body always runs once. Note that ADD wraps: 200 + 100 + 50 is 350, and 350 − 256 = 94 is what the byte holds.
start: |2
  ; R0 = sum of the n bytes starting at list, mod 256.  Also store it at [result].
          HLT

          .org 0x80
  n:      .byte 0
  list:   .space 8
          .org 0x90
  result: .byte 0
tests:
  - { name: "empty list", setup: { mem: { "0x80": 0, "0x81": 99 } }, expect: { regs: { R0: 0 }, mem: { "0x90": 0 } } }
  - { name: "one byte", setup: { mem: { "0x80": 1, "0x81": 7 } }, expect: { regs: { R0: 7 }, mem: { "0x90": 7 } } }
  - { name: "1 to 8", setup: { mem: { "0x80": 8, "0x81": 1, "0x82": 2, "0x83": 3, "0x84": 4, "0x85": 5, "0x86": 6, "0x87": 7, "0x88": 8 } }, expect: { regs: { R0: 36 }, mem: { "0x90": 36 } } }
  - { name: "it wraps", setup: { mem: { "0x80": 3, "0x81": 200, "0x82": 100, "0x83": 50 } }, expect: { regs: { R0: 94 }, mem: { "0x90": 94 } } }
  - { name: "255 + 1", setup: { mem: { "0x80": 2, "0x81": 255, "0x82": 1 } }, expect: { regs: { R0: 0 }, mem: { "0x90": 0 } } }
solution: |2
          LD   R2, [n]
          LDI  R3, list
          ADD  R2, R3         ; R2 = end of the list
          LDI  R1, list       ; R1 = pointer
          LDI  R0, 0          ; R0 = sum
          CMP  R1, R2
          JZ   done           ; empty list
  loop:   LDR  R3, [R1]
          ADD  R0, R3
          INC  R1
          CMP  R1, R2
          JNZ  loop
  done:   ST   [result], R0
          HLT

          .org 0x80
  n:      .byte 0
  list:   .space 8
          .org 0x90
  result: .byte 0
```

```asm
id: run/max
title: The largest byte
isa: octet
prompt: |
  The list is laid out as before: its length `n` (at least 1) at 0x80 and the bytes from 0x81. Leave the **largest** of them, as an unsigned number, in **R0** and at `result` (0x90).
hints:
  - 'Keep the largest so far in R0. After `CMP R0, R3`, the carry flag C says that R0 < R3: then R3 is the new largest.'
  - '`JNC skip` jumps over the `MOV R0, R3` when R0 is already at least as big.'
  - 'MOV does not change the flags, so it is safe between the CMP and anything that tests them, but INC changes them, so do the loop test after it.'
explain: |
  CMP subtracts and keeps the flags: C is the borrow, so C = 1 means the first operand is *below* the second. The jump skips the copy when there is no borrow. Starting with R0 = 0 is safe, because 0 is the smallest unsigned value, so the first element can only make it bigger or leave it.
start: |2
  ; R0 = the largest of the n (>= 1) unsigned bytes starting at list.  Also store it at [result].
          HLT

          .org 0x80
  n:      .byte 1
  list:   .space 8
          .org 0x90
  result: .byte 0
tests:
  - { name: "one byte", setup: { mem: { "0x80": 1, "0x81": 9 } }, expect: { regs: { R0: 9 }, mem: { "0x90": 9 } } }
  - { name: "3 9 2", setup: { mem: { "0x80": 3, "0x81": 3, "0x82": 9, "0x83": 2 } }, expect: { regs: { R0: 9 }, mem: { "0x90": 9 } } }
  - { name: "unsigned: 255 beats 1", setup: { mem: { "0x80": 3, "0x81": 1, "0x82": 255, "0x83": 128 } }, expect: { regs: { R0: 255 }, mem: { "0x90": 255 } } }
  - { name: "all zero", setup: { mem: { "0x80": 4 } }, expect: { regs: { R0: 0 }, mem: { "0x90": 0 } } }
  - { name: "the largest is last", setup: { mem: { "0x80": 8, "0x81": 1, "0x82": 2, "0x83": 3, "0x84": 4, "0x85": 5, "0x86": 6, "0x87": 7, "0x88": 200 } }, expect: { regs: { R0: 200 }, mem: { "0x90": 200 } } }
solution: |2
          LD   R2, [n]
          LDI  R3, list
          ADD  R2, R3         ; R2 = end of the list
          LDI  R1, list       ; R1 = pointer
          LDI  R0, 0          ; R0 = largest so far
  loop:   LDR  R3, [R1]
          CMP  R0, R3         ; C = 1 if R0 < R3
          JNC  skip
          MOV  R0, R3
  skip:   INC  R1
          CMP  R1, R2
          JNZ  loop
          ST   [result], R0
          HLT

          .org 0x80
  n:      .byte 1
  list:   .space 8
          .org 0x90
  result: .byte 0
```

```asm
id: run/multiply
title: Multiply by shift and add
isa: octet
maxCycles: 700
prompt: |
  Multiply the bytes at `x` and `y` and leave the product in **R0**. The product will always fit in a byte. Octet has no multiply, and the obvious answer, adding x to itself y times, is too slow: each test may take at most **700 clock cycles**, and y can be 255. Use the shift-and-add of Chapter 14: for each bit of y, from the right, add x if the bit is 1; then double x.
hints:
  - 'Keep the product in one register, x in another and y in a third. `SHR` puts the lowest bit of a register in the carry flag (and shifts the rest right); `SHL` doubles.'
  - 'After `SHR R1`, `JNC skip` jumps over the addition when the bit was 0.'
  - 'Stop when y is 0, not after exactly 8 rounds: `OR R1, R1` sets Z from R1 without changing it.'
explain: |
  Eight rounds at most, whatever y is: each round is a shift of y, an optional addition and a shift of x. Adding x to itself 255 times would be about 250 rounds and would exceed the cycle limit. A loop that counts bits is the algorithm that the hardware multiplier of Chapter 14 unrolls into gates.
start: |2
  ; R0 = x * y  (the product fits in a byte)
          HLT

  x:      .byte 0
  y:      .byte 0
tests:
  - { name: "13 x 11", setup: { mem: { x: 13, y: 11 } }, expect: { regs: { R0: 143 } } }
  - { name: "zero", setup: { mem: { x: 0, y: 5 } }, expect: { regs: { R0: 0 } } }
  - { name: "times zero", setup: { mem: { x: 5, y: 0 } }, expect: { regs: { R0: 0 } } }
  - { name: "1 x 255 (too slow by repeated addition)", setup: { mem: { x: 1, y: 255 } }, expect: { regs: { R0: 255 } } }
  - { name: "3 x 85", setup: { mem: { x: 3, y: 85 } }, expect: { regs: { R0: 255 } } }
  - { name: "16 x 15", setup: { mem: { x: 16, y: 15 } }, expect: { regs: { R0: 240 } } }
solution: |2
          LD   R1, [x]
          LD   R2, [y]
          LDI  R0, 0          ; product
  loop:   SHR  R2             ; C = the next bit of y
          JNC  skip
          ADD  R0, R1
  skip:   SHL  R1             ; x doubles
          OR   R2, R2         ; any bits of y left?
          JNZ  loop
          HLT

  x:      .byte 0
  y:      .byte 0
```

```asm
id: run/bcd
title: A number on the seven-segment display
isa: octet
prompt: |
  The byte at `n` is a number from 0 to 99. Show it as **two decimal digits** on the hex display: 42 must show as the digits 4 and 2, which is `0x42` written to the HEX register. (The display shows each nibble as a hexadecimal digit, so you must build the packed value 0x42 yourself: it is not the number 42.)
hints:
  - 'Divide by ten by repeated subtraction, counting how many times ten goes in: the count is the tens digit and what is left is the ones digit.'
  - '`CMP R0, R1` with 10 in R1 sets C when R0 < 10: `JC done` ends the loop.'
  - 'The tens digit belongs in the high nibble. `SHL` four times moves it there, and `OR` puts the ones digit in the low nibble.'
explain: |
  The quotient is the tens digit and the remainder the ones digit. To pack them, shift the tens up by four places (four SHLs) and OR in the ones: 4 × 16 + 2 = 66 = 0x42. This is *binary-coded decimal* (BCD), what pocket calculators and the old seven-segment clocks used, so that a hex display reads as decimal.
start: |2
  ; Show the number at n (0-99) as two decimal digits on the HEX display.
          HLT

  n:      .byte 0
tests:
  - { name: "0", setup: { mem: { n: 0 } }, expect: { hex: 0x00 } }
  - { name: "7", setup: { mem: { n: 7 } }, expect: { hex: 0x07 } }
  - { name: "10", setup: { mem: { n: 10 } }, expect: { hex: 0x10 } }
  - { name: "42", setup: { mem: { n: 42 } }, expect: { hex: 0x42 } }
  - { name: "99", setup: { mem: { n: 99 } }, expect: { hex: 0x99 } }
solution: |2
          LD   R0, [n]
          LDI  R1, 10
          LDI  R2, 0          ; tens
  loop:   CMP  R0, R1
          JC   done           ; R0 < 10: R0 is the ones digit
          SUB  R0, R1
          INC  R2
          JMP  loop
  done:   SHL  R2
          SHL  R2
          SHL  R2
          SHL  R2             ; tens in the high nibble
          OR   R2, R0         ; ones in the low nibble
          ST   [HEX], R2
          HLT

  n:      .byte 0
```

:::challenge[The programs of the course]
The program picker in every figure above lists the course’s other programs. **Sort** bubble-sorts eight bytes with two pointers and a flag kept in memory. The **reaction timer** waits a random time (the RANDOM register is Chapter 18’s LFSR) and then times how long you take to press BTN0. **Pong** and **Game of Life** run on the 8 × 8 matrix, and both are around 100 instructions. Load the Game of Life, give it the speed slider’s top setting, and watch a glider cross the torus. Then read the source, and change the starting pattern. Which part of the program is harder to write for a machine with four registers, the neighbour count or the copying? Try writing the 3-neighbour test another way.
:::

:::hood[Two machines, one answer]
How do you know that the cycle-by-cycle CPU in Figure 23.3 does what the CPU of Chapter 22 would? By running both on the same programs and comparing everything. The instruction-level *interpreter* (`OctetMachine`, in `src/lib/sim/cpu/octet/machine.ts`) is the specification: it executes a whole instruction at a time, and it is what runs at the fast end of the Clock slider. The figure’s cycle-level model (`cycles.ts` in this chapter) executes the transfers of Chapter 22 one at a time, with the hidden registers MAR, IR, A, B and T. Both act on the same registers and memory, so you can switch between them at an instruction boundary; and the test that keeps them honest is small:

```ts
for (let i = 0; i < steps && !ref.halted; i++) {
  ref.step();                 // the interpreter: one whole instruction
  cpu.finishInstruction();    // the cycle-level CPU: its 4 to 8 cycles
  const diffs = compareStates(ref.snapshot(), dut.snapshot(), { timing: true });
  expect(diffs).toEqual([]);
}
```

`compareStates` compares every register, flag, byte of memory, device output and the cycle count. The test runs it on the course programs and on 300 random ones: `randomProgram(seed)` generates programs that are random but safe, in which every jump goes forward, every load and store stays in a data window and every CALL has a RET, so that any disagreement is a bug rather than chaos. The ALU is checked exhaustively as well: every pair of operands for ADD, SUB, AND, OR, XOR and CMP, and every operand of the four unary operations, is executed on both and the results and all four flags must agree. The same function is what compares a *gate-level* Octet, or the DCL version of Chapter 31, with the interpreter: **the interpreter is the reference, and everything else must agree with it.**
:::

## Build it for real

:::real{parts="74HC161, 62256 static RAM, 8-way DIP switch, 8 × LED, 8 × 330 Ω, 8 × 10 kΩ resistors, pushbutton, 5 V USB supply module, breadboard, jumper wires"}
**Deposit and examine, like an Altair.** A program counter and a memory are all you need to “run” a list of bytes, and you can build both on a breadboard with the parts of Chapters 18 and 20.

Wire a **74HC161** counter as the program counter: its four outputs Q0–Q3 (pins 14, 13, 12 and 11) go to the address inputs A0–A3 of the **62256** RAM, and the other address pins to ground. Give the counter a clock from a debounced pushbutton (Chapter 17); take MR̅, PE̅, CEP and CET (pins 1, 9, 7 and 10) high so that it counts. Put the eight data pins of the RAM through eight 330 Ω resistors to eight LEDs, and also to the DIP switch, with the switch’s other side to the supply and 10 kΩ pull-down resistors so that an open switch reads 0. Use the RAM’s output enable and write enable as you did in Chapter 20, with a switch on write enable.

To *deposit* a program, set the DIP switch to a byte, press write, and press the clock button to go to the next address, sixteen times if you like: the sixteen addresses of the counter are sixteen bytes. To *examine* it, put the switches high-impedance and release write, and step the counter round the loop: the LEDs show each byte in turn. The bytes you have written can be anything, and it is up to you to decide that some of them are instructions; try 0x20, 0x2A, 0x40, 0xF8, 0x00, which is `LDI R0, 0x2A`, `ST [LEDS], R0` and `HLT` in Octet’s machine code. Nothing here *executes* them: the counter and memory are the fetch half of a computer, and Chapter 31 puts the whole of Octet on a chip.
:::

## What’s next

We have a CPU that computes and a memory that holds its programs, and so far its only contact with the world has been eight LEDs and two hex digits, driven by stores to a handful of addresses. Chapter 24 opens those addresses up. How does a store to 0xF8 turn into a light? How can a program dim an LED with nothing but the ability to switch it fully on and off, or make a voltage, or read one? And how does a byte get from one chip to another when there are only one, two or three wires between them, as with the serial ports that connect almost everything? That is where the Octet meets the physical world.
