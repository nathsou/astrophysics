---
number: 22
title: Control
summary: 'The circuit that turns each instruction into the twenty-four lines of the datapath, cycle after cycle, built twice, from gates and from a ROM you can edit, and shown to agree, instruction by instruction, with the reference interpreter.'
duration: About 2½ hours
prerequisites: [datapath, state-machines, memory]
---

Last chapter ended with your hands on 24 switches. To make the datapath add two registers you set three combinations of them, one per clock, and to run a program you would have to do that for every cycle of every instruction: a program of a hundred instructions is five hundred cycles, and the switches must be right every time. Something has to do it for you, faster than a hand, and never make a mistake.

That something is the :term[control unit]{id=control-unit}. It is a circuit whose inputs are the **instruction** that is being executed (the bits of IR), **which cycle** of it we are in, and the **flags**, and whose outputs are the 24 control lines. In other words it is a finite-state machine, of the kind Chapter 19 built: the step counter is its state, IR and the flags are its inputs, and the control lines are its outputs, and there is nothing else in it. A control unit does not compute anything. It *decides*.

There are two ways to build one, and they are the two big families of processor design. You can write the outputs as Boolean equations of the inputs and build the gates (:term[hardwired control]{id=hardwired-control}), or you can store the outputs in a memory, one word per cycle, and read them out (**microcoded** control, from :term[microcode]{id=microcode}). This chapter builds both for Octet, and then proves something that should surprise you: they are the *same machine*, and both are the same machine as the reference interpreter that runs Octet programs in software.

## Fetch, decode, execute

Every instruction takes the same first three cycles. In the first, the address of the next instruction goes from the program counter into MAR (`MAR ← PC`). In the second, the memory puts the byte on the bus, IR listens, and PC counts on to the next byte (`IR ← M[MAR]; PC ← PC + 1`). The third is **decode**: the control unit looks at what arrived in IR. Then come the instruction’s own cycles, from one to five of them.

| Instruction | Fetch | Decode | Execute | Cycles |
|---|---|---|---|---|
| `MOV R1, R2` | `MAR ← PC` · `IR ← M[MAR]; PC ← PC + 1` | decode | `Rd ← Rs` | 4 |
| `ADD R1, R2` | (the same two) | decode | `A ← Rd` · `B ← Rs` · `Rd ← A + B; flags` | 6 |
| `LD R1, [addr]` | (the same two) | decode | `MAR ← PC` · `MAR ← M[MAR]; PC ← PC + 1` · `Rd ← M[MAR]` | 6 |
| `CALL addr` | (the same two) | decode | `MAR ← PC; SP ← SP − 1` · `T ← M[MAR]; PC ← PC + 1` · `MAR ← SP` · `M[MAR] ← PC` · `PC ← T` | 8 |

Why a cycle for decode, when nothing moves in it? A hardwired unit could do without it: its lines are logic of IR, and they settle during the cycle in which IR arrives. The **microcoded** unit needs it: decode is the cycle in which the dispatch ROM is read and the micro-program counter is loaded with the address of the instruction’s routine. Octet’s two control units must take the same number of cycles (the ISA counts them), so both have the decode cycle, and the one that could skip it pays for the one that cannot. You can see the price in the table: no instruction takes fewer than four cycles, and in the next chapter we shall count what that does to a program’s speed.

The decoding is easy because of how instructions are encoded. An instruction is `oooo ddss`: four bits of opcode, two of destination register, two of source. The register fields do not need decoding at all. They go from IR straight to the register file (that was why the datapath’s read ports were driven by bits of IR), so the control unit only ever looks at the opcode and, for two groups, at the two low bits. And **there are no illegal instructions**: every one of the 256 byte values decodes to something, so the decoder needs no error case, and the machine cannot fail to decode.

```quiz
q: 'CALL takes eight cycles, the most of any Octet instruction. How many bits does the control unit’s step counter need, if it counts the cycles of one instruction from 0?'
options:
  - text: 'Two, because there are four kinds of step: fetch, decode, execute and finish.'
    why: 'The steps are not kinds, they are cycles, numbered. The fetch alone is two of them, and CALL has five execute cycles after the decode.'
  - text: 'Three: it has to count 0 to 7.'
    correct: true
    why: 'Eight cycles are numbered 0 to 7, and three bits count 0 to 7: 2³ = 8. Octet’s longest instruction has eight cycles, so three bits are just enough; an instruction of nine would need a fourth bit.'
  - text: Four, one for each cycle of the shortest instruction.
    why: 'The counter has to be able to count as far as the *longest* instruction, not the shortest.'
  - text: Eight, one for each cycle, as a one-hot counter.
    why: 'A one-hot counter would have eight flip-flops, and it is a fair design (the outputs come ready decoded). But the question is about counting in binary, which needs only three, and a decoder turns them into eight one-hot lines.'
```

### One clock, and a window for the bus

The whole machine runs on the rising edge of one clock. At each edge every register whose load line is on listens to the bus, the memory stores if `MEM_WR` is on, and the control unit’s step counter counts. Then the new step and the new instruction make the control lines settle, and they have half a clock period, the whole of the first half of the cycle, to do so. The datapath does not need them to be right until the *next* edge, but the bus needs more: while the lines are still changing, two of the bus drivers might be enabled at the same moment, for a few nanoseconds, and that is contention.

So the control unit does one more thing, which you met last chapter as a switch: it produces `BUSWIN`, the **bus window**. It is high in the second half of the cycle, and only after a short delay; it goes low the moment the clock rises. Every bus driver’s enable is ANDed with it, so the drivers can drive only when the lines have settled. In the widget below there is a timing diagram of the clock, the window, a few control lines and a bus bit, and you can see the bus float in the first half of each cycle, and carry the byte in the second.

## Hardwired control

To build the unit from gates, write down for each control line *when* it is on. It is on in a set of (instruction, step) pairs: `OE_PC`, the line that puts the PC on the bus, is on in step 0 of every instruction (that is the first fetch cycle), and in step 3 of LDI, LD, ST, CALL and every jump (the first thing they do is `MAR ← PC` to read their operand), and in step 6 of CALL. Every one of those pairs is an AND gate (this instruction *and* this step), and the line is the OR of all of them. That is a sum of products (Chapter 11), a PLA-like structure with a name of its own: a **hardwired** control unit.

::circuit{src="22-control/circuits/pc-load.json" title="One control line: PC_LD" n="22.1" mode="logic" speed=1e-6 caption="PC_LD is the line that makes the program counter load from the bus. It is on in three cases: the fifth execute step of CALL (PC ← T), the second execute step of RET (PC ← M[MAR]), and the second execute step of a conditional jump when the jump is taken. Each case is one AND gate. Set RET and STEP4 to 1 and PC_LD lights; set JCC and STEP4 and then TAKEN and it lights only with TAKEN. Every other control line is an OR of AND terms like this one."}

The parts the equations need are few. A three-bit **step counter** counts the cycles from 0 to 7 and starts again at 0 when an instruction has done its last step (a line called END). A 3-to-8 decoder turns it into eight one-hot step lines. One AND gate per instruction, fed with the bits of IR and their inverses, turns the opcode into one-hot instruction lines (22 of them: PUSH, POP, CALL and RET share an opcode and are told apart by the two low bits, and so do SHL, SHR, NOT and INC). Then 54 AND gates, one for each micro-step of the 22 instruction routines, pair an instruction with a step, and an OR gate per control line collects its terms. **A conditional jump adds one twist**: in its second step the line that is on is `PC_LD` if the jump is taken and `PC_INC` if not, so the jump condition (below) is an input of two of the OR gates.

### The jump condition

The last four bits of a jump instruction are the condition: three of them choose one of eight tests of the flags (always, Z, C, N, V, N⊕V, C∨Z, Z∨(N⊕V)), and the lowest one inverts the result, so that the eight tests make sixteen conditions. In hardware that is an 8-to-1 multiplexer whose data inputs are the tests, and an XOR gate.

::circuit{src="22-control/circuits/condition.json" title="The jump condition unit" n="22.2" mode="logic" speed=1e-6 caption="The flags Z, C, N and V go in as data; K3, K2, K1 and K0 are the low four bits of the jump instruction. With K3 K2 K1 K0 = 0011 the multiplexer selects Z and K0 inverts it, which is JNZ: TAKEN is 1 whenever Z is 0. Try 1010 (JNC), 1101 (JGE, N ⊕ V inverted) and 0000 (JMP, which is always taken). Then find the condition that is never taken (JNEVER, 0001)."}

The multiplexer is not a design decision, it is a consequence of the encoding: because the condition is `cccc`, the low bit means “invert”, and the instruction set gets sixteen conditions for the price of eight tests and one XOR. That is the kind of thing you can only see when you know what the decoder will look like.

:::lab[Read a control line]
1. In Figure 22.1 set RET and STEP4 to 1. PC_LD lights: the second step of RET is `PC ← M[MAR]`.
2. Clear RET, set JCC and STEP4. PC_LD does not light; now set TAKEN. It does. Which AND gate is that? What does the *other* half of the same rule (PC_INC when the jump is not taken) look like?
3. In Figure 22.2, find the condition that is true after `CMP a, b` when *a* < *b* unsigned (JC: K3 K2 K1 K0 = 0100). Set C = 1: TAKEN. Find its inverse (JNC).
4. Find the condition that reads N ⊕ V (JLT, 1010) and set N = 1, V = 1. Why is it false? (A negative result that overflowed was really positive.)
:::

The whole of it fits in one screen of DCL. Here are the instructions, the steps, and a few of the lines of Octet’s hardwired decoder, as the DCL of Chapter 29 would write it. The full module, with all 24 lines, its tests and the step counter, is in this chapter’s `designs` folder:

```dcl
// One signal per instruction, from the bits of IR (the "AND gates" of the hardwired unit).
let op: bits<4> = ir[7:4]
let sub: bits<2> = ir[1:0]
let push: bit = op == 7 && sub == 0
let call: bit = op == 7 && sub == 2
let alu2: bit = op >= 8 && op <= 12
let jcc: bit = op == 15

// One signal per step.
let f0: bit = stage == 0
let x1: bit = stage == 3
let x5: bit = stage == 7

// Each line is an OR of (instruction AND step) terms.
oe_pc = f0 || (x1 && (ldi || ld || st || call || jcc)) || (x4 && call)
pc_ld = (x5 && call) || (x2 && ret) || (x2 && jcc && taken)
mem_wr = (x3 && (st || push)) || (x2 && str) || (x4 && call)
```

Look at `pc_ld`: it is the circuit of Figure 22.1, in one line. The chapter’s tests compile this module, run its own tests, and then check it exhaustively: in each of the 8 steps, for each of the 256 first bytes, with the jump taken or not, all 24 lines equal what the microprogram says. That is 4,096 cases. (It also checks the seven tri-state drivers can never be asked for two at a time, because the same instruction cannot drive the bus from two places in the same step: *no term has two OE lines*.)

```build
id: control/condition
title: The jump condition unit
spec:
  reference: 22-control/exercises/condition.json
allowed: [not, and, or, xor, xnor, nand, nor, part:mux8, part:mux4, part:mux2, mux]
prompt: |
  Build the **jump condition unit** of Octet. The inputs are the four flags **Z**, **C**, **N**, **V** and the four low bits of a jump instruction, **K3 K2 K1 K0**. **TAKEN** is 1 when the jump is taken. K3 K2 K1 choose one of eight tests: 000 always, 001 Z, 010 C, 011 N, 100 V, 101 N ⊕ V, 110 C or Z, 111 Z or (N ⊕ V). K0 inverts the result.
hints:
  - The eight tests are eight signals; some are one gate each (N ⊕ V, C or Z, Z or (N ⊕ V)), and “always” is a constant 1.
  - A multiplexer with K3 K2 K1 as its select lines picks one of the eight. Your MUX8 part does it (D0 is the input chosen by 000, and S0 is the lowest select bit).
  - K0 inverts the picked test: an XOR with K0.
explain: |
  Three gates to make the tests that are not already a flag, an 8-to-1 multiplexer to choose one, and an XOR to invert it. That is Figure 22.2, and the whole of the jump group’s decoding: sixteen conditions from eight tests and one gate.
solution: 22-control/exercises/condition.json
```

## Microcoded control

The hardwired unit is fast and small, and it is *frozen*: change one instruction and you re-derive the equations and redraw the gates. In 1951 Maurice Wilkes had a different idea, and it is the second family.

:::history{year=1951 title="Microprogramming" people="Maurice Wilkes"}
At the Manchester University Computer Inaugural Conference in July 1951, Maurice Wilkes of Cambridge presented a paper called “The best way to design an automatic calculating machine”.:cite[wilkes1951] The control units of the day were tangles of special-purpose logic, and he proposed something regular: the control unit would be a *tiny stored-program computer of its own*. Each instruction of the machine would be carried out by a short sequence of **micro-instructions**, each of which was just a row of bits, each bit switching one control line, read out of a matrix of diodes (a read-only memory, as we should now say) one row at a time.:cite[wilkes-stringer1953]

The idea took years to build: EDSAC 2, which Wilkes’s laboratory in Cambridge finished in 1958, was built with a microprogrammed control unit,:cite[wilkes-renwick-wheeler1958] and in the 1960s it became how IBM made the System/360 family: one instruction set, on machines of very different speeds, each with its own microcode. Microcode is why an instruction set could outlive the hardware.
:::

In a microcoded unit **the truth table is stored, not built**. Take the table of the hardwired unit: for each step of each instruction, which of the control lines are on. Write each row as a word, with one bit per control line, and put the words in a ROM. Then a **micro-program counter** (µPC) addresses the ROM, the ROM’s output *is* the control lines, and the counter counts through the routine of the instruction, one word per cycle. Two more things are needed. Something must say where a routine begins: a second ROM, the **dispatch ROM**, is addressed by IR and gives the address of the routine for that instruction, and the µPC loads it at the end of the decode cycle. And something must say where the routine *ends*: one bit of the word, END, sends the µPC back to the fetch at address 0.

Octet’s microinstruction is 24 bits wide. It packs the seven bus drivers into a *3-bit number* (0 for nothing, 1 for Rd, 2 for Rs and so on), decoded by a 3-to-8 decoder in front of the datapath, which means that **the microcode can never ask for two drivers at once**: the field cannot say it. The rest is one bit for each load line, the counters, the memory write, the flag load, the ALU operation, HALT, END and the dispatch bit.

| Bits | Field | Bits | Field |
|---|---|---|---|
| 0–2 | Bus driver (0 none, 1 Rd, 2 Rs, 3 PC, 4 SP, 5 ALU, 6 memory, 7 T) | 12 | CJ: `PC_LD` if the jump is taken, else `PC_INC` |
| 3–7 | Load: MAR, IR, A, B, T | 13–14 | `SP_INC`, `SP_DEC` |
| 8 | Write register Rd | 15 | `MEM_WR` |
| 9 | Load flags | 16–18 | ALU operation |
| 10 | `PC_LD` | 19–20 | ALU second input: A, or 1 |
| 11 | `PC_INC` | 21–23 | HALT, END, DISP (dispatch after decode) |

Octet’s microprogram is 57 words: 2 for the fetch, 1 for the decode and 54 for the 22 routines (all sixteen conditional jumps share one). The ROM holds 64, so there is room for seven more micro-steps: enough, as you will see, for a new instruction. The dispatch ROM has 256 entries, one for every byte value, because every byte value is an instruction.

::circuit{src="22-control/circuits/sequencer.json" title="A control store and a counter" n="22.3" mode="logic" speed=1e-6 caption="A microcoded control unit in miniature: a 2-bit counter (µPC) addresses a ROM of four words, and the ROM’s bits are the control lines (the last one is END). Press Clock once after switching RST on and off: the first word turns on OE_PC and LD_MAR (MAR ← PC), the second OE_MEM, LD_IR and PC_INC (IR ← M[MAR]; PC ← PC + 1), and the third is the decode cycle with only END on, which loads the counter with 0 and starts again. That is the fetch of every Octet instruction, and Octet’s ROM is this, with 57 words and 24 bits."}

Everything you need to read a microprogram is in the table above. Here is the routine of `ADD` in the ROM, one row per cycle:

| ROM address | Driver | Load | Other | Register transfer |
|---|---|---|---|---|
| 0x1D | Rd | A | | `A ← Rd` |
| 0x1E | Rs | B | | `B ← Rs` |
| 0x1F | ALU | Rd, flags | ALU op ADD, END | `Rd ← A + B; flags` |

The microprogram is *data*, and that makes it **inspectable and editable**. In the widget below, switch to the microcoded unit and the whole ROM is a table: click a cell, and the machine changes while it runs.

## The control unit at work

Here is the complete gate-level Octet: the datapath of Chapter 21, and either control unit, on the digital engine. Pick a program, and clock it one cycle at a time. The block diagram shows where the byte is going; the lit control lines are what the control unit is asking for; the row of chips is the cycle of the instruction (F1 and F2 fetch, D decodes, X1 to X5 execute). Switch between hardwired and microcoded and run the same program: **the lines are the same, cycle for cycle**, because both are built from the same table. In the microcoded view, the table of the ROM has the row that is being executed highlighted, and you can edit any cell.

::control-unit{n="22.4" caption="Press Clock to run one cycle, or Instruction to run to the end of the current one. The chips show which of the cycles of the instruction is next; the amber blocks drive the bus and the copper ones listen; the amber control lines are the ones on. Switch to Microcoded to see the ROM: the highlighted row is µPC, the row the machine is executing. Edit a cell (or switch off the ‘flags’ column of the ADD routine) and the machine changes at once; underneath, the same random programs that check the real circuit are run against the reference interpreter, and it says where they first disagree. The challenge at the bottom asks you to give Octet an instruction it does not have."}

:::lab[Watch a control unit work]
1. In the hardwired view, pick **Add** and press Clock until the chips show D, then X1, X2, X3. For each cycle, read the lit lines and match them with `A ← Rd`, `B ← Rs`, `Rd ← A + B; flags`. Which line is on in X3 that is not on in X1?
2. Pick **Loop**, and run the two-instruction loop (SUB, JNZ) a few times with the Instruction button. In the step where JNZ decides, look at PC_LD and PC_INC. The last time round, which of them is on?
3. Pick **Call**, and run to the CALL. Count its eight cycles. Which cycles put a byte in memory (`MEM_WR`)? Look at SP and at PC: after the return address is stored, PC gets the target from T.
4. Switch to **Microcoded** (the machine restarts). Run the same program and compare the lit lines with the ones you saw. Then open the timing diagram at the bottom and look at BUSWIN and the bus in the fetch cycles.
5. In the ROM, find the routine of ADD and clear the `flg` column in its third row. Run **Add** again. What happens to the flags, and what does the check underneath say? Restore the ROM.
:::

### Give Octet a new instruction

Octet has no `DEC`: to subtract one, you write `LDI R1, 1` and `SUB R0, R1`. But the ALU already knows how to subtract and to use 1 as its second input (INC uses the other half of the same trick). All that DEC needs is a *routine*: `A ← Rd`, then `Rd ← A − 1; flags`, two micro-steps that use only lines that exist. And there is room in the ROM (seven words) and in the byte space: bytes `0x01`–`0x0F` are all aliases of HLT, and `0x04`, `0x08` and `0x0C` are `0000 dd00` for dd = 1, 2, 3.

That is the challenge below the table in the widget: add a routine, point those three bytes at it, and the checker runs DEC on eighteen combinations (three registers, six values, including 0 and 0x80, where the flags are unusual). (There is no DEC R0: its byte, 0x00, is HLT, and it stays HLT. The encoding has an opinion about your instruction set.) Microcode is why real processors receive updates: a new routine and a changed entry in the dispatch table, and the chip has learned an instruction (or has lost the bug in an old one).

```bug
title: 'POP in microcode'
prompt: 'A designer writes the microcode routine for POP Rd, which takes the top byte off the stack: the stack grows *down* from 0xEF, and SP points at the last byte pushed. The routine is below, one line per micro-step. Click the first line that makes it wrong.'
lines:
  - 'Step 1: SP ← SP + 1'
  - 'Step 2: MAR ← SP'
  - 'Step 3: Rd ← M[MAR]  (END)'
wrong: 0
why: 'POP reads the byte SP points at, *and then* moves SP up: `MAR ← SP` first, then `Rd ← M[MAR]; SP ← SP + 1`. Written the other way, the routine adds one first and reads the byte above the top of the stack, which is not the byte that was pushed (it is the one pushed before it, or nothing at all). The course’s POP is two micro-steps: `MAR ← SP` and `Rd ← M[MAR]; SP ← SP + 1`, the increment sharing the cycle with the read because PC-like counters can count in the same cycle as the bus does something else.'
notes:
  '1': 'Fine, if SP already holds the address of the byte to read.'
  '2': 'Fine: this is how a byte is read.'
```

```parsons
title: 'CALL, step by step'
prompt: 'Put the micro-steps of CALL addr in the order that the control unit executes them after the decode cycle. When they start, PC points at the address byte that follows the CALL opcode.'
lines:
  - 'MAR ← PC; SP ← SP − 1'
  - 'T ← M[MAR]; PC ← PC + 1'
  - 'MAR ← SP'
  - 'M[MAR] ← PC'
  - 'PC ← T'
distractors:
  - 'PC ← M[MAR]'
  - 'M[MAR] ← PC + 2'
```

## Hardwired or microcoded?

Both work, and they are used for opposite reasons.

| | Hardwired | Microcoded |
|---|---|---|
| Made of | Gates: an AND per (instruction, step), an OR per line | A ROM (here 64 × 24 bits, and 256 × 8 for the dispatch) and a counter |
| Speed | The lines are one or two gate levels from IR and the step | The lines wait for the ROM: an access time on top |
| Changing an instruction | Re-derive the equations and redraw the gates | Change a word |
| Long, irregular instructions | Grow the logic, and the risk | Add steps: a routine can be as long as you like |
| Fixing a bug after the chip is made | Only by a new chip | Sometimes by a microcode update |
| Typical use | Simple instruction sets, and the fast paths of others | Complex ones (x86, System/360, the 68000) |

The reason a **RISC** design (the subject of Chapter 23’s comparison) is usually hardwired is that its instructions are all short and regular, so the equations are small and the fast clock is worth having; a **CISC** design has instructions like “copy a block of memory” that are best written as a program, so a ROM is easier. Modern high-performance x86 processors do both: common instructions are decoded by gates into simple operations, and the rare, complicated ones are looked up in a microcode ROM, whose contents a firmware update can patch.

:::note[A hardwired unit you can look at]
The MOS 6502 of 1975, the processor of the Apple II and the BBC Micro, decodes its instructions with a large array of AND terms etched in the die, a hardwired control unit in the sense of this chapter. In 2010 the Visual 6502 project photographed the chip layer by layer, traced its 3,500 or so transistors and put a working simulation of the transistors in a web page, where you can watch which of its lines go high in each cycle of an instruction.:cite[visual6502] That is this chapter’s widget, for a real chip.
:::

## Prove it: the differential test

We have made two control units and a datapath from thousands of gates, and a table that they are both supposed to implement. How do we know that any of it is right?

The answer is the second implementation of Octet, the one that runs programs in software: the **reference interpreter** that comes with the assembler. It does not know about buses or cycles; it takes an instruction and applies its meaning. It was written from the ISA specification, and so was the microprogram. If the gate-level machine and the interpreter agree, on the same program, at every instruction, then a mistake would have to be *the same mistake in both*, written independently. The :term[differential test]{id=differential-testing} runs them in lockstep:

```ts
const cycles = ref.step();
…
for (let k = 0; k < cycles; k++) {
  const flags = cpu.flags();
  …
  cpu.cycle();
  // The lines that ran in this cycle are what the microprogram says for this step of this instruction.
  const want = referenceLines(k, irNow, conditionTaken(flags));
  …
}
const diff = compareStates(ref.snapshot(), cpu.state());
if (diff.length) throw new Error(`${label}: after instruction ${instructions} …: ${diff.join('; ')}`);
```

(`ref` is the interpreter, `cpu` the gates; the interpreter executes one instruction and says how many cycles it takes, and the gates are clocked that many times.)

After *every instruction* the registers, PC, SP, the four flags, all of memory and every output device must be identical, and the gate-level machine must be **exactly at the end of the instruction**, having used exactly the number of cycles that the ISA specification lists. On the way, each cycle’s control lines are compared with the microprogram’s, so the test also shows that the hardwired unit, the microcoded unit and the table are the same.

What programs? The interpreter’s test generator makes random ones: jumps that only go forward, loads and stores inside a window, balanced PUSH and POP, calls into subroutines, and, in half of them, reads and writes of the I/O devices. On top of these, the test runs **every one of the 256 possible first bytes**, from random register and flag states, so that the aliases and the ignored bits are checked too, and the course’s own programs (multiplication, Fibonacci, sorting, “HELLO, WORLD”). It runs all of this on both control units, and on two versions of the machine: one built from your parts bin’s parts (the 3,500 gates of the reference parts, or yours), and one of the simulator’s own building blocks, which is ten times faster. The tests are in `differential.test.ts` in this chapter’s folder. Every one passes.

:::hood[How the gate-level machine gets its memory]
The interpreter has memory and devices that do things when read: reading `CONSOLE` takes the character out of the input queue, and reading `RANDOM` steps a shift register. To compare like with like, the harness (`GateCpu` in `hardware/cpu.ts`) builds the machine *without* RAM (the datapath takes its memory byte from eight input pins) and plays the memory system itself, using the interpreter’s own memory map for the other machine. Just before each rising edge it looks at the control lines the machine is about to obey:

```ts
if (this.memory) {
  const addr = r.word('MAR');
  if (r.bit('OE_MEM') === 1 && addr !== undefined) {
    r.setWord('MD', this.memory.read(addr));
    r.run(this.half);
  }
  if (r.bit('MEM_WR') === 1 && addr !== undefined) {
    const v = r.word('BUS');
    if (v !== undefined) this.memory.write(addr, v);
  }
}
```

A read happens exactly when the gate-level machine asks for one (`OE_MEM`), and a write exactly when it stores (`MEM_WR`), so side effects such as consuming a console character happen once, at the same instruction, on both sides. And then the clock rises, `r.set('CLK', 1)`, and the gates do the rest. It never looks inside the machine to see what it should do.
:::

## Build it for real

:::real{parts="74HC161, SRAM or EEPROM (a 62256 or a 28C16), 4 × LED, 4 × 330 Ω resistors, 8 × DIP switch, pushbutton, 74HC04, 5 V USB supply module, breadboard, jumper wires"}
**A control store on a breadboard.** Take a 74HC161 (last chapter’s program counter) and let it be the µPC, and let a static RAM or an EEPROM be the control store. Connect the counter’s outputs Q0–Q2 to the memory’s address inputs A0–A2 and tie its other address inputs low; put an LED and a 330 Ω resistor on the memory’s data outputs D0–D3. Write the words 0001, 0010, 0100 and 1000 at addresses 0 to 3 and the word 10000 at address 4, with DIP switches (check the pinout and the write procedure on the datasheet: with an SRAM you hold the data on its pins and pulse write, with an EEPROM the write cycle takes a few milliseconds).:cite[ti-sn74hc-family] Press the clock button: the four LEDs walk in turn. That is a sequencer, and changing the words changes the *program*, without touching a wire. Now take data output D4 through an inverter to the counter’s parallel-load pin (active low), with the counter’s data inputs tied to 0000: when the counter reaches address 4 the word’s bit 4 is on, the counter loads 0 at the next edge, and the walk starts again. That bit is END, and it is how every routine of Octet’s microcode finishes.
:::

## What’s next

You now have a complete computer, made of your own parts: a datapath that moves bytes, a control unit that tells it what to do, in two versions, and a machine that, instruction for instruction, does exactly what the specification says. The next chapter writes programs for it. There is an assembler that turns text into bytes, programs that multiply and sort and print, and a clock that runs from one hertz, with every wire in view, up to full speed, where you will meet the numbers that decide how fast a computer is: cycles per instruction, and the clock rate.
