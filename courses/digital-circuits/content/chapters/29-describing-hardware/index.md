---
number: 29
title: Describing hardware
summary: DCL, the course’s hardware language. You write what a circuit is, in text, and a compiler builds the gates, from types and registers to instances, state machines and tests.
duration: About 2 hours
prerequisites: [state-machines, inside-an-fpga]
---

By the end of Chapter 28 you could configure an FPGA by hand: fill in the truth table of a LUT, set the switches of a routing box, clock the chip and watch it work. It is the best way to understand what is inside, and the worst way to use one. The RV32I core that Chapter 31 puts on a chip needs a few thousand LUTs, each with sixteen truth-table bits, and a routing choice for every wire between them. Nobody fills in tens of thousands of bits by hand, or draws a few thousand boxes and joins them with wires.

What we want is what programmers have had since the 1950s: a **language**. Write what the circuit should be, in text that can be read, searched, compared, reviewed, tested and reused, and let a program produce the bits. That language is **DCL**, which the course has used whenever a part or a design was shown as text. A hardware language looks like software and is not software, and the main thing to learn is where the resemblance stops. We start with the history, because it explains why the languages look the way they do.

## Why we stopped drawing

A schematic is a picture of a :term[netlist]{id=netlist}, a list of components and the wires between them. For a dozen gates it is the clearest description there is, and it stops working long before a computer is on the page. The numbers below are not from a textbook: they are what the DCL compiler builds.

- A 32-bit adder, written as `a + b`, becomes **154 gates**.
- The ALU of the RV32I core, thirty-odd lines of DCL, becomes **1,180 gates** (1,281 elements in all), with a longest path of 69 gates.
- The 32-entry register file of the same core becomes **992 flip-flops** and about 3,900 gates.

To draw the ALU you would place a thousand boxes and route thousands of wires, and the picture would say less than the thirty lines. It would have to be redrawn for a 64-bit version, and could be neither searched nor compared with last week’s. Text has all of these properties for free, and it can be **parameterised**: one description, any width. A schematic is a photograph of one particular circuit.

### Equations for programmable chips

The first people to need a language were programming PALs (Chapter 26), chips whose function is a set of sum-of-products equations blown into fuses. Drawing the fuse map by hand was hopeless, so within a few years every maker of programmable logic had a program that read the equations as text and produced the fuse pattern. Here is one bit of a counter, a flip-flop that toggles when `EN` is high, in three of them (the dialects vary a little between tool versions).

```text title="PALASM"
Q0 := /Q0 * EN + Q0 * /EN
```

```text title="ABEL"
Q0 := Q0 $ EN;
```

```text title="CUPL"
Q0.D = Q0 $ EN;
```

In each, `:=` or `.D` means “the value after the clock edge”, and `$` is exclusive-or (PALASM writes out the AND–OR form). Already the equation *is* the circuit. But these languages describe a **device**: the pins are numbered, the flip-flops are the chip’s macrocells, and a design that needs more product terms than the chip has is an error. You cannot name a sub-circuit and use it twice.

:::history{year=1983 title="Equations for fuses: PALASM, ABEL and CUPL" people="John Birkner, Russell de Pina, Bob Osann"}
In the early 1980s, programming a PAL meant writing its equations in a text file and running them through a compiler.

The first was PALASM, from Monolithic Memories, the company that had introduced the PAL in 1978. It was written by John Birkner, the PAL’s co-inventor, as a FORTRAN IV program, and Monolithic Memories gave the source away.:cite[wiki-palasm] Two commercial languages followed in 1983. ABEL, from Data I/O, a maker of chip programmers, grew from a compiler that Russell de Pina had written there in 1981, and offered equations, truth tables and state-machine descriptions in one language.:cite[wiki-abel,holley-abel] CUPL, from Assisted Technology, named the target chip at compile time, so the same equations could be compiled for more than one device.:cite[cupl-1983]

All three were tied to PAL-sized chips and designs of a few dozen equations. They taught a generation of engineers to write hardware as text.
:::

### Verilog and VHDL

The next step came from two directions at once, and neither began with programmable logic.

**Verilog** began with a start-up, Gateway Design Automation, founded by Prabhu Goel. In December 1983 its engineer Phil Moorby and Chi-Lai Huang specified a language for logic simulation, fault simulation and synthesis; Moorby wrote the simulator in 1984, and it was on sale by early 1985.:cite[flake2020] Its expressions borrow C’s operators, and its blocks are marked `begin … end`. **VHDL** began with the US Department of Defense, whose VHSIC programme for advanced chips needed one language in which its contractors could describe their designs. It was specified from 1983 by Intermetrics, IBM and Texas Instruments, and is modelled on Ada: strongly typed, verbose, precise.:cite[wiki-vhdl]

:::history{year=1984 title="Verilog" people="Phil Moorby, Prabhu Goel, Chi-Lai Huang"}
Verilog was a simulator’s language first. Phil Moorby, who had joined Gateway Design Automation by 1983, set out to create a language that could support logic simulation, fault simulation for test and logic synthesis. He specified it in December of that year with Chi-Lai Huang, and wrote the simulator in 1984.

By early 1985 the product was on sale, and a faster simulator, Verilog-XL, followed in 1987. Cadence bought Gateway in 1990, and the next year the language was opened to the public through Open Verilog International, which took it to the IEEE. It became IEEE Standard 1364 in 1995.:cite[flake2020]
:::

:::history{year=1987 title="VHDL" people="US Department of Defense (VHSIC programme), Intermetrics, IBM, Texas Instruments"}
The VHSIC programme (1980–1990) was the Pentagon’s effort to advance very-fast integrated circuits. In June 1981 a workshop at Woods Hole, Massachusetts, began the work of defining a hardware description language for it.

In July 1983 the contract went to a team of Intermetrics (language expertise), Texas Instruments (chip design) and IBM (system design). They released version 7.2 in August 1985, and after public review the IEEE adopted the language as Standard 1076 in December 1987.:cite[wiki-vhdl,ieee1076-1987] The name is a nested acronym: VHSIC Hardware Description Language.
:::

Notice what both languages were for: writing down what a chip does, running it, and checking it before anyone paid for silicon. Turning the same text into gates came later.

### Synthesis

Turning a description into gates is called :term[logic synthesis]{id=logic-synthesis}, and it changed what a hardware language was for. Instead of describing a circuit that somebody had already designed, the designer describes *behaviour at the register-transfer level*: which registers there are, and what is computed between them in each clock cycle. A program chooses the gates. That level of description is called :term[RTL]{id=register-transfer-level} for short (not to be confused with the resistor–transistor logic of Chapter 8), and it is what nearly every chip is designed in now. Chapter 30 follows the tool through its stages.

:::history{year=1987 title="Logic synthesis becomes a product" people="Aart de Geus, David Gregory, Bill Krieger"}
Synthesis started as research. A team at General Electric, led by Aart de Geus, built a rule-based system called SOCRATES that turned a description of logic into optimised gates.:cite[ethw-degeus] In 1986 de Geus and two other GE engineers, David Gregory and Bill Krieger, founded a company, Optimal Solutions, to sell the idea; it was renamed Synopsys in 1987.

Its early years were small: revenue was $130,000 in 1987 and $976,000 in 1988, when it chose Verilog as an input language for its synthesis tool, first called Logic Compiler and soon renamed Design Compiler. By 1992 Synopsys, then a $50 million company, had more than three quarters of the synthesis market.:cite[fundinguniverse-synopsys] After that, the description was the design and the gates were an output, like machine code from a compiler.
:::

The rest of this chapter follows the same route on a small scale: we describe hardware in DCL, and the compiler builds the gates, and every time we ask “what does that become?” we shall count them.

## A first module

Here is a counter. Read it as you would read a function, then run it. On a wide screen the code is on the left and the simulator beside it: set `enable` and `clear` with the switches, step the clock, and read the outputs. The *Circuit* tab draws the gates the compiler built.

::dcl-playground{src="designs/counter.dcl" top="Counter" n="29.1" caption="The counter of this section. Set enable to 1 and press Step clock: count goes up by one at each edge and wrapped lights on the step from 15. Then press Run tests, read a test, and try to break one by editing the code."}

A **module** is a circuit with a name, inputs and outputs: `Counter` has a `clock` input, two one-bit inputs, and two outputs, `count` (four bits) and `wrapped` (one). What is inside the braces is the circuit itself.

- `reg value: bits<4> = 0` declares a register: four flip-flops that power up holding 0.
- `next value = …` says what the register holds after the next clock edge: 0 if `clear`, else `value + 1` if `enable`, else itself.
- `count = value` connects an output to something inside. So does `wrapped = enable && value == 15`, an AND gate fed by a comparison.

Below the module, `test` blocks drive a simulated copy of it and check what comes out; they are not part of the circuit. There are no semicolons: a statement ends at the end of its line unless the line obviously carries on, and the first *Under the hood* box shows the exact rule.

:::note[In industry: the same counter in Verilog and VHDL]
You will meet Verilog and VHDL in any job that involves chips. Here is the counter above in both: the same structure of a port list, a register, a clocked update and two output assignments.

```verilog title="counter.v"
// A 4-bit counter with enable and synchronous clear.
module counter (
  input  wire       clk,
  input  wire       enable,
  input  wire       clear,
  output wire [3:0] count,
  output wire       wrapped
);
  reg [3:0] value = 4'd0;

  always @(posedge clk) begin
    if (clear)       value <= 4'd0;
    else if (enable) value <= value + 4'd1;
  end

  assign count   = value;
  assign wrapped = enable && (value == 4'd15);
endmodule
```

```vhdl title="counter.vhd"
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity counter is
  port (
    clk     : in  std_logic;
    enable  : in  std_logic;
    clear   : in  std_logic;
    count   : out std_logic_vector(3 downto 0);
    wrapped : out std_logic
  );
end entity;

architecture rtl of counter is
  signal value : unsigned(3 downto 0) := (others => '0');
begin
  process (clk)
  begin
    if rising_edge(clk) then
      if clear = '1' then
        value <= (others => '0');
      elsif enable = '1' then
        value <= value + 1;
      end if;
    end if;
  end process;

  count   <= std_logic_vector(value);
  wrapped <= '1' when enable = '1' and value = 15 else '0';
end architecture;
```

Three differences matter. In Verilog, `<=` (a non-blocking assignment) inside a clocked block is the register update, DCL’s `next`, while `=` is for combinational code; mixing them up is a classic bug. In DCL, holding a value has to be written out (`next value = value`), whereas the Verilog and VHDL above hold it *because the last `else` is missing*; the same omission in a combinational block builds an accidental latch (see the tour below). And VHDL needs a conversion (`std_logic_vector(value)`) where the other two just say what they mean.
:::

## A circuit, not a program

Everything in DCL that looks like software is a trap for a software engineer, so let us take the traps one by one.

### Items have no order

The lines inside a module are **not executed**. They are *all true at once*, like the wires of a schematic. This is why the order does not matter, and this module, with its lines back to front, is correct:

```dcl
module FullAdder(a: bit, b: bit, carry_in: bit) -> (sum: bit, carry_out: bit) {
  carry_out = generate | propagate & carry_in
  sum = propagate ^ carry_in
  let propagate: bit = a ^ b
  let generate: bit = a & b
}

test "one and one and one" {
  let f = sim FullAdder(a: 1, b: 1, carry_in: 1)
  expect f.sum == 1 && f.carry_out == 1
  f.carry_in = 0
  expect f.sum == 0 && f.carry_out == 1
}
```

`propagate` is used two lines above the line that defines it, and nobody minds. A schematic has no “above”: a wire is connected at both ends whether you drew the source first or the load. The compiler works out an evaluation order itself. What it insists on is that the wiring makes sense: if a value depends on itself through nothing but gates, there is no order to find, and the compiler reports the loop’s path (`q_i → q_n → q_i` for two cross-coupled NANDs, in the tour below). A loop through a `reg` is fine, because a register breaks the loop at the clock edge. The one place where order matters is inside a `test`, which runs step by step.

### `let` is a wire

`let propagate: bit = a ^ b` gives a name to a value, once. There is no reassigning: a name is one wire, driven by one thing. If you have met :term[SSA]{id=ssa} form in [SSA to Silicon](../../../compiler-backends/#/ch/ssa), you know the idea: every value has exactly one definition and any number of uses. A DCL module is written in that form already. It even has an answer to the question SSA asks about a name that has different definitions on different paths: the φ-function of SSA is a **multiplexer**, and `if c { a } else { b }` is how you write it.

### `reg` and `next`: the only state

A `reg` is the only way to hold a value. Everything else is a wire, which has a value only while something drives it. A register changes at one moment only, the clock edge, and all the registers change together. That has a consequence that software does not prepare you for. First a question.

```quiz
q: 'Two registers start with `first = 1` and `second = 2`. At each clock edge, `next first = second` and `next second = first`. What do they hold after one edge?'
options:
  - text: first = 2 and second = 2, because first takes second’s value, and then second takes first’s new value.
    why: 'That is what two assignments in a row would do in a program. But `next` lines are not in a row. They all describe the value after the same edge.'
  - text: first = 2 and second = 1. They swap, at every edge.
    correct: true
    why: 'Every register samples its `next` value from what all the registers hold *now*, and only then do they all change. So each takes the other’s old value. You do not need a temporary variable to swap two registers.'
  - text: first = 1 and second = 2. Each is a copy of the other, so nothing changes.
    why: 'Nothing would change if they held the same value. They do not: each is fed by the other, and the edge moves the values across.'
```

Software swaps two variables with a temporary, because assignments happen one after another. In hardware the two flip-flops are cross-wired, and a swap costs no logic at all. Try it on the module below: two registers that load from the inputs, then swap on every edge.

::snippet-playground{id="swap" n="29.2" tab="run" caption="Set load to 1, a_in to 3 and b_in to 9, step the clock once, then set load to 0 and step again: a and b trade places at every edge. Open the Circuit tab: eight flip-flops, each fed by a multiplexer that picks between the load value and the other register, and no gates at all between the two registers."}

This is the **two-phase update**: first every register’s next value is calculated from the current state, then all of them are committed together. It is what makes synchronous design work (Chapter 17): everything settles between edges, and the edge takes a photograph of the settled values.

:::programmer[`next` is a photograph, not an assignment]
The closest thing in software is *double buffering*: compute the whole next frame from the current one, then swap the buffers. `reg` is the current buffer, `next` fills the other, and the clock edge is the swap. A cellular automaton such as Life is written the same way, because if cells updated in place the result would depend on the order you visited them.
:::

## Types and widths

DCL is strictly typed, in a way that goes further than most software languages. A signal’s **width** is part of its type, and the compiler checks it at every operator.

| Type | What it is | Notes |
|---|---|---|
| `bit` | one wire, 0 or 1 | the type of conditions; the same as `bits<1>` |
| `bits<N>` | N wires, an unsigned number | arithmetic wraps modulo 2ᴺ |
| `signed<N>` | N wires, two’s complement | signed comparison, arithmetic right shift |
| `[T; N]` | N values of type T | indexed by a constant, or by exactly enough bits |
| `struct` | named fields, side by side | the wires of the fields, first field on top |
| `enum` | a set of names | the compiler picks the encoding |
| `clock` | a clock signal | only on ports; it cannot be computed with |

There is no implicit conversion. Adding a 12-bit value to a 32-bit one is an error, not a silent zero-extension, and so is comparing signed with unsigned. You choose the extension yourself (`zext`, `sext`, `trunc`, or a slice `x[hi:lo]`), and converting between `bits` and `signed` costs no hardware, since the same wires just get another meaning. Here is a module with every kind of type in it.

```dcl
type Word = bits<16>

struct Sample { valid: bit, value: signed<12> }

enum Mode { Idle, Run, Hold }

module Scale(sample: Sample, mode: Mode) -> (out: signed<16>) {
  let wide: signed<16> = sext(sample.value, 16)
  out = if sample.valid && mode == Mode.Run { wide + wide } else { 0 }
}
```

The sign extension `sext(sample.value, 16)` costs no gates: it copies the top wire to four more places. Slices, concatenations and extensions are only *wiring*, counted at zero. Bit fields such as those of a RISC-V instruction are cut with slices:

```dcl
module Fields(instruction: bits<32>) -> (opcode: bits<7>, rd: bits<5>, imm: signed<32>) {
  opcode = instruction[6:0]
  rd = instruction[11:7]
  imm = signed(sext(instruction[31:20], 32))
}

test "decodes addi x5, x0, -2" {
  let f = sim Fields(instruction: 0xffe00293)
  expect f.opcode == 0x13 && f.rd == 5 && f.imm == -2
}
```

Integer literals are untyped and take their width from the context: `value + 1` makes a 4-bit `1` because `value` is 4 bits, and a literal that does not fit is an error.

### Mistakes that cannot be written

Why the strictness? Because a hardware bug costs far more than a software bug, and many of the common ones are things a compiler can see. A looser language accepts some of them in silence, and then a chip is made that does not work. DCL takes them out of the language, or turns them into an error that names the *hardware* problem. The figure below cycles through twelve. The messages on the right are produced by the DCL checker when the figure opens; the playgrounds’ editors show the same text.

::diagnostics-tour{n="29.3" caption="Step through the twelve programs with the numbered buttons. On each one, read the message, then press Show the fix. Which of them would Verilog’s grammar have accepted? (All twelve; simulators and synthesis tools warn about some of them, and a separate program, a linter, about more, when a team runs one.)"}

:::hood[How the compiler reads lines, and where a width error comes from]
**Lines instead of semicolons.** The lexer (`src/lib/hdl/lexer.ts`) decides for each line break whether it ends a statement, and emits a `newline` token if so. Two sets of tokens decide it:

```ts
/** A line ending with one of these continues on the next line. */
const CONTINUE_AFTER = new Set([...BINARY_OPERATORS, ...UNARY_OPERATORS, '=', ',', '->', '{', '(', '[', '.', '..', ':', '=>', '@']);
/** A line starting with one of these continues the previous line. */
const CONTINUE_BEFORE = new Set([...BINARY_OPERATORS, ...UNARY_OPERATORS, '.', ')', ']', '}', ',', '..', ':', '=', '->', '=>']);
```

and the loop that applies them, at the first token of each line:

```ts
    if (prev && t.lineStart) {
      let significant = true;
      if (depth > 0) {
        if (t.kind === 'keyword' && STATEMENT_KEYWORDS.has(t.text)) depth = 0;
        else significant = false;
      }
      if (significant && isOp(prev) && CONTINUE_AFTER.has(prev.text)) significant = false;
      if (significant && ((t.kind === 'op' && CONTINUE_BEFORE.has(t.text)) || (t.kind === 'keyword' && t.text === 'else'))) significant = false;
      if (significant && t.kind !== 'eof') {
        tokens.push({ kind: 'newline', text: '\n', span: source.span(prev.span.end, prev.span.end), lineStart: false });
      }
    }
```

A line break inside an unclosed `(` or `[` never counts (`depth > 0`). A line ending in `+`, `=`, `,`, `->` or `{` continues, and so does a line *starting* with an operator, a `.`, a closing bracket or `else`. JavaScript’s automatic semicolon insertion is famous for going wrong, because a line can begin with `(` and be either a new statement or a call. DCL is safe because it has **no expression statements**: every statement starts with a keyword (`let`, `reg`, `next`, `inst`, …) or with the name of an output being assigned. A line that starts with an operator cannot begin a statement, so it can only be a continuation. The `depth > 0` branch also recovers from a forgotten `)`: a line that starts with `let` or `module` inside an open bracket closes it, so that the rest of the file is still checked.

**Where a width error comes from.** Every expression gets a type, and each operator asks whether its operands’ types agree. When they do not, the checker (`src/lib/hdl/check.ts`) builds the message from the types and *the text of the offending expression*, so the suggested fix can be pasted into the source:

```ts
const help =
  actual.w < expected.w
    ? actual.w === 1 && !actual.signed
      ? `extend it explicitly: zext(${text}, ${expected.w})`
      : `extend it explicitly: sext(${text}, ${expected.w}) or zext(${text}, ${expected.w})`
    : `truncate it explicitly: trunc(${text}, ${expected.w}) or ${text}[${expected.w - 1}:0]`;
return this.err('width-mismatch', 'width mismatch', e.span, `${typeToString(actual)}, expected ${typeToString(expected)}`, { help: [help] });
```

Stop 1 of the tour is made by this code.
:::

## `if` is a chain, `match` is a multiplexer

Chapter 13’s multiplexer picks one of several inputs by a selector. DCL has two ways to write it, and they build different circuits.

- **`if c { a } else { b }`** is an expression, and `else` is mandatory: a value must exist in every case. It becomes a 2-way multiplexer. An `else if` chain is a *priority chain*: the first condition that is true wins, so the later conditions are only consulted if the earlier ones were false, and in hardware that means the choice made by the last `else` passes through every multiplexer before it.
- **`match x { p => e, … }`** compares one value with several constants. The arms may not overlap, and together must cover every value (or end with `_`, which means “everything else”, wherever it is written). Because at most one arm can be true, there is no priority to respect, and all the arms are considered at once: a **parallel multiplexer**, a decoder and an AND–OR plane.

When the conditions really can overlap, a chain is the right thing, because priority is what you want. A fixed-priority arbiter, where the lowest-numbered request wins, is exactly that:

```dcl
/// A fixed-priority arbiter: the lowest-numbered request wins.
module Arbiter(req: bits<4>) -> (grant: bits<3>) {
  grant = if req[0] {
    1
  } else if req[1] {
    2
  } else if req[2] {
    3
  } else if req[3] {
    4
  } else {
    0
  }
}

test "the lowest request wins" {
  let a = sim Arbiter(req: 0b0000)
  expect a.grant == 0
  a.req = 0b1010
  expect a.grant == 2
  a.req = 0b1100
  expect a.grant == 3
  a.req = 0b0001
  expect a.grant == 1
}
```

But when they cannot overlap, as when you choose by the value of a selector, a chain is wasteful. It makes the hardware slower than it needs to be, and nothing in the source says the order is not important.

```quiz
q: 'You choose one of 16 inputs of 8 bits with a 4-bit selector, first as a chain of 15 `else if`s, then as a `match` with 16 arms. Which is faster, in the sense of a shorter path of gates from the selector to the answer?'
options:
  - text: 'The chain: each arm is just one comparison, and multiplexers are simple.'
    why: 'Each step is simple, but there are fifteen of them in a row. The value of the last arm passes through fifteen multiplexers to get to the output.'
  - text: The match, by a wide margin.
    correct: true
    why: 'A chain makes the last arm wait for all the others: depth grows by about one gate for every arm. A match looks at the selector once, decodes it, and combines the arms in a tree, so its depth grows with the logarithm of the number of arms.'
  - text: They are the same, because the compiler can see that only one condition is ever true.
    why: 'A cleverer synthesis tool might see it, but the source would still promise something it does not need. DCL’s compiler builds what you wrote. The point of `match` is that *you* can say the arms are exclusive, and the compiler holds you to it.'
```

Now let the compiler answer. The figure writes the same choice both ways (for 2, 4, 8 and 16 inputs of 8 bits), compiles both, lowers them to gates, and reads the numbers off the result.

::if-vs-match{n="29.4" caption="Slide the number of choices up to 16. The chain gets one gate deeper for every arm, so at 16 it is three times as deep as the match (18 gates against 6) and about a third bigger; at 2 and 4 choices the two are close. Whether a chain’s extra depth matters depends on the clock: Chapter 15 shows how the longest path sets it."}

## What the compiler builds

Every expression in DCL becomes a definite piece of hardware, and you can see which. The **inference viewer** below shows a design on the left and, as you type, the gates that the compiler builds on the right. Hover a line of code to light its gates, or a gate to mark the line that made it. Underneath, a table counts what each construct cost.

First, a prediction. The ALU of the RV32I core has a 32-bit adder in it.

```quiz
q: 'How many gates does a 32-bit `a + b`, with both operands variable, become? (The gates are AND, OR and XOR gates of two inputs.)'
options:
  - text: One. It is one operator, and there is an adder in the chip.
    why: 'There is no adder in a gate library, only gates. The compiler builds one, and you saw in Chapter 14 what one is made of.'
  - text: 'About 30: one gate per bit, roughly.'
    why: 'One per bit is what a bitwise AND costs. An adder has to pass a carry from bit to bit, and each bit needs a full adder.'
  - text: 'About 150: a full adder of five gates for each of the 32 bits.'
    correct: true
    why: 'A full adder is two XORs, two ANDs and an OR: five gates per bit, minus a few at the bottom bit, where there is no carry coming in: 154 in all. And the carry rippling through them makes the path long: 63 gates from the least significant input to the most significant sum bit.'
  - text: About 1,500.
    why: 'That would be 50 gates per bit. A ripple-carry adder is a slow design, but not that wasteful.'
```

::dcl-inference{src="designs/counter.dcl" n="29.5" title="The counter, and the gates it becomes" caption="Edit the code. Change bits<4> to bits<8> everywhere (and 15 to 255) and watch the register grow from four flip-flops to eight. Change value + 1 to value + 3, then to value * 3. Delete the clear and see the multiplexer go. Hover a line to light its gates."}

:::lab[Count the gates]
Use the viewer above. Before each change, predict what the readout will say; then make the change.

1. Read the *What it costs* table for the original counter. `reg value` is four flip-flops. `value + 1` is a 4-bit **incrementer**: two AND gates, three XOR gates and an inverter, because the compiler folds the constant into half adders. The two `if`s make two 4-bit multiplexers, and the one that chooses the constant 0 folds into four AND gates and an inverter. The `wrapped` line is two more AND gates.
2. Widen the counter to 8 bits (`bits<8>` in each place, and `== 255`). You get 8 flip-flops, and the incrementer grows from 5 gates to 13 (and an inverter). The depth goes from 5 to 9: that is the ripple carry again, so a longer counter is slower, and Chapter 14’s lookahead adders would be the fix.
3. Change `value + 1` to `value + 3`. The incrementer gains an OR gate and an inverter: a carry now enters at two bits, and the compiler had to build something bigger than a chain of half adders.
4. Change it to `value * 3` and compare. The compiler folds a multiplication by a constant into shifts and adds, so the total (19 gates) is about what `value + 3` cost.
5. Remove the clear (delete `if clear { 0 } else`). The four AND gates and the inverter of the clear disappear (17 gates become 12), and the depth drops by one.

What you write says *what* the circuit does. What it costs follows from that, and now you can read the bill line by line.
:::

Here is a design of another size: the ALU of the RV32I core. At more than a thousand elements it is too big to draw, but the readout still counts every construct.

::dcl-inference{src="designs/alu.dcl" n="29.6" title="An ALU, counted" subtitle="Too big to draw gate by gate: the readout still tells you what each line costs." caption="Find the biggest lines in the table. Which construct costs most: the adders, the shifters, or the match on f3 that chooses the result? (The match, at 304 elements; then the two adders together, at 217, the two right shifters, at 212, and the left shifter, at 160.) Then delete the arm 1 => rs1_value << shift, and watch the left shifter disappear from the table."}

Its eight functions are all computed **all the time**. A `match` on `f3` does not run the arm that is chosen: it builds all eight circuits and a multiplexer that selects one of their results. In software a branch you do not take costs nothing. In hardware every arm is silicon, used or not, and the choice is made by wires.

:::deeper[Why is the ripple-carry depth 63, not 32?]
Each bit of the adder passes the carry through two gates: the AND that combines it with the propagate signal, then the OR that merges the two possible sources (`generate | propagate & carry_in` in the full adder above). A carry that starts at bit 0 and ends at bit 31 therefore goes through about two gates per bit, and the longest path of the 32-bit adder is 63 gates, twice the width. A carry-lookahead adder computes the carries of groups of bits in parallel, so that its depth grows with log *n* instead of *n*, at the cost of more gates. DCL’s `+` builds the simple version.
:::

## Instances, generics and loops

A module is a component, and an **instance** places one inside another. `inst name: Module(port: value, …)` connects every input, and the outputs are read as `name.port`. Nothing runs when you instantiate a module: you have drawn a box on the schematic, and wired it up. The standard library (`Synchronizer`, `Debouncer`, `EdgeDetect`, `Fifo`, `SevenSeg`, `UartTx`, `UartRx`) is a set of ready-made boxes. This one turns a bouncing button into a single clean pulse, using two of them and the design of Chapter 4:

```dcl
module ButtonPulse<STABLE: int>(clk: clock, raw: bit) -> (pressed: bit) {
  inst clean: Debouncer<STABLE>(clk: clk, raw: raw)
  inst edge: EdgeDetect(clk: clk, d: clean.clean)
  pressed = edge.rise
}

test "one pulse per press" {
  let b = sim ButtonPulse<4>(raw: 0)
  step 3
  expect !b.pressed
  b.raw = 1
  step 5
  expect !b.pressed
  step
  expect b.pressed
  step
  expect !b.pressed
  step 10
  expect !b.pressed
}
```

The angle brackets are a **generic**: a number that the module takes at compile time, here how many clock cycles the button must be stable for. Generics can appear in types too (`bits<WIDTH>`), so a single description serves for every width. Each distinct set of generic arguments makes its own copy of the hardware: `Debouncer<4>` and `Debouncer<1000>` are different circuits.

The same machinery gives loops, and this is where the software habit is most dangerous.

```dcl
module Delay<STAGES: int>(clk: clock, d: bit) -> (q: bit) {
  reg stages: [bit; STAGES] = [0; STAGES]

  next stages[0] = d
  for i in 1..STAGES {
    next stages[i] = stages[i - 1]
  }
  q = stages[STAGES - 1]
}

test "arrives after STAGES edges" {
  let d = sim Delay<3>(d: 1)
  step 2
  expect d.q == 0
  step
  expect d.q == 1
}
```

:::key
A `for` loop in DCL is **not** a repetition in time. It is unrolled by the compiler, before anything runs, into as many copies of the hardware as there are iterations. The bounds must be known at compile time, and `i` is a constant in each copy.
:::

`Delay<3>` is a shift register of three flip-flops with no gates between them, and `Delay<8>` has eight. The loop writes out `next stages[1] = stages[0]`, `next stages[2] = stages[1]` and so on for you. Nothing happens once per iteration: every copy exists, and every copy works at once. The compiler plays the same trick when it builds an adder. This function of `src/lib/hdl/lower/builder.ts` lowers a word-level `+` into gates, and its loop is over *bits*, so it makes copies of a full adder:

```ts
add(a: Bit[], b: Bit[], cin: Bit = CONST0, role = 'fa'): { sum: Bit[]; cout: Bit } {
  const sum: Bit[] = [];
  let c = cin;
  for (let i = 0; i < a.length; i++) {
    this.bit(i);
    const x = this.xor2(a[i]!, b[i]!, `${role}.xor1`);
    sum.push(this.xor2(x, c, `${role}.xor2`));
    const g = this.and2(a[i]!, b[i]!, `${role}.and1`);
    const p = this.and2(x, c, `${role}.and2`);
    c = this.or2(g, p, `${role}.or`);
  }
  this.bit(undefined);
  return { sum, cout: c };
}
```

Those five gates per iteration are the 154 of the prediction: the loop is in the compiler, and the gates are in the chip.

## Memories

A register array is a collection of flip-flops: `reg x: [bits<32>; 32]` is 1,024 of them (992 in the RV32I register file, as the challenge below explains), with a 32-way multiplexer for each read port. That suits 32 words and not 32,000. For a large store you want the chip’s RAM (Chapter 20 opened one up, and Chapter 28 met the block RAMs of an FPGA), and DCL has a separate construct for it:

```dcl
module Rom(clk: clock, address: bits<3>) -> (data: bits<8>) {
  mem table: [bits<8>; 8] = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07]
  data = table.read(address)
}

test "answers one cycle later" {
  let r = sim Rom(address: 2)
  expect r.data == 0
  step
  expect r.data == 0x5b
  r.address = 7
  expect r.data == 0x5b
  step
  expect r.data == 0x07
}
```

The eight values are the seven-segment patterns of Chapter 13 for the digits 0 to 7. The important part is the test. A `mem` has **synchronous reads**: `table.read(address)` gives the word at that address *one clock edge later*, as the block RAM of an FPGA does. A `mem` can be written with `table.write(address, data, enable)`, and has at most two read ports and one write port. On a chip with block RAM the compiler maps it there; otherwise it becomes flip-flops, and the design behaves the same either way.

## State machines

Chapter 19 drew a traffic light as a state diagram, chose an encoding for its states, and derived the next-state gates by hand. DCL turns each step into a line of text.

- The **states** are an `enum`: `enum Light { Red, RedAmber, Green, Amber }`. You never see the numbers: the compiler picks a binary encoding, or one wire per state with `@onehot`, or Gray code with `@gray`. Only `==`, `!=` and `match` apply to an enum, so you cannot do arithmetic on a state by accident.
- The **state register** is a `reg` of that type.
- The **transitions** are a `match` on the state: one arm for each state, and the checker tells you if you forget one.
- The **outputs** are functions of the state: `red = state == Light.Red || state == Light.RedAmber`.

::dcl-playground{src="designs/traffic-light.dcl" top="TrafficLight" n="29.7" tab="run" caption="Hold tick at 1 and press Step clock: red, red with amber, green, amber, red again, the British sequence. Set tick to 0 and the light waits. Then put @onehot before the enum and open the Circuit tab: two flip-flops become four, and the gates change too."}

The compiled machine is small: two flip-flops (four states fit in two bits) and 13 gates and multiplexers. The `match` is built as a decoder feeding OR gates, the `if !tick { state } else { … }` around it is a pair of 2-way multiplexers that lets the machine wait, and the three lights are a few more gates. It is the machine of Chapter 19: state register, next-state logic and output logic.

## Tests

Hardware is tested in simulation before it is built, because a fault in silicon cannot be patched, and the tests are written in the same language. A `test` block is a small program that drives a simulated copy of a module, and the only place in DCL where things happen in order:

- `let x = sim Module<…>(input: value, …)` creates a copy, with the inputs set;
- `x.input = value` changes an input;
- `step n` gives the clock *n* rising edges (`step` alone gives one);
- `expect condition` checks that something is true, and `print` writes a value to the console;
- `for` loops and `random(bits<N>)` produce stimulus.

Tests never become hardware. When an `expect` fails, the playground shows the values at that moment and a waveform of the last few cycles, so you see how the design got there. Below is a decade counter (one digit of a decimal counter) with two bugs and two tests that catch them. Your job is to fix the design, not the tests.

::snippet-playground{id="fix-the-test" n="29.8" tab="tests" caption="Press Run tests. Two tests fail, and each shows a waveform. Fix the module until both pass, then read the waveform of the first test before you fix it: where does the count go wrong?"}

::::hints
:::hint[Hint 1: read the waveform]
The first test steps ten times and expects the count to be back at 0. Look at what `digit` does in the waveform after it reaches 9.
:::
:::hint[Hint 2: the wrap]
The counter wraps when `value == 10`. But a digit that counts 0 to 9 has ten values, and the last one is 9, so it must wrap *from* 9.
:::
:::hint[Hint 3: the carry]
The second test holds `enable` at 0 with the count at 9. Should `carry` be 1 then? A carry means “the next digit should count on the next edge”, and that depends on both `enable` and the value.
:::
::::

:::details[Show the fixed module]
```dcl
/// One decimal digit of a counter: counts 0 to 9, then wraps to 0 and reports a carry for the next digit.
module Decade(clk: clock, enable: bit) -> (digit: bits<4>, carry: bit) {
  reg value: bits<4> = 0

  next value = if enable {
    if value == 9 { 0 } else { value + 1 }
  } else {
    value
  }
  digit = value
  carry = enable && value == 9
}
```

Two changes: `value == 10` becomes `value == 9`, and `carry` becomes `enable && value == 9`. The first bug is an off-by-one, an old friend from software. The second only shows when the enable is *held* low: the carry is right whenever the counter is running.
:::

## Under the hood

You have seen what each construct becomes. Here is the compiler doing it, one stage after another.

:::hood[From source to gates to JavaScript]
DCL’s compiler is a pipeline of small passes, all in `src/lib/hdl/`. **Lexing and parsing** turn the text into tokens (with the line rules of the earlier box) and a syntax tree. **Checking** (`check.ts`) resolves every name, gives every expression a type, and reports the errors of the tour. **Elaboration** (`elaborate.ts`) binds generics, folds `const`s, unrolls `for` loops, inlines functions, and turns the tree into **word-level RTL**: a list of cells such as `add`, `mux`, `eq` and `reg`, on signals that are whole bit vectors, each tagged with the source span it came from (which is how hovering a line can light its gates). For the counter, `printRtl` shows the whole design:

```text
module Counter
  input clk: clock = %0(clk)
  input enable: 1 = %1(enable)
  input clear: 1 = %2(clear)
  output count: 4 = %3(value)
  output wrapped: 1 = %6
  %4:4 = const 15  @14:32
  %5:1 = eq(%3(value), %4)  @14:23
  %6:1 = and(%1(enable), %5)  @14:13
  %7:4 = const 1  @12:56
  %8:4 = add(%3(value), %7)  @12:48
  %9:4 = mux(%1(enable), %3(value), %8)  @12:36
  %10:4 = const 0  @12:27
  %11:4 = mux(%2(clear), %9, %10)  @12:16
  %3(value):4 = reg(%11, %0(clk))  @10:7
```

Every line is one cell. `%9 = mux(enable, value, %8)` is the inner `if enable { value + 1 } else { value }`, and `%11` is the outer `if clear`: two nested multiplexers, as the text said, with the `@12:36` at the end of a line giving each cell’s position in the source. There is no `if`, no order and no `next`: only cells, and a `reg` cell whose input (`%11`) is the next value.

**Lowering to gates** (`lower/`) expands each cell into elements of the course’s netlist model: `add` into full adders (the function quoted earlier), `mux` into a multiplexer per bit, `eq` against a constant into an AND of literals, `reg` into a flip-flop per bit, `slice` and `concat` into nothing at all. The table at the top of `lower/index.ts` is the cost model behind every count in this chapter. The netlist that comes out is the bench’s own model, which is why the *Circuit* tab can draw it and simulate it gate by gate.

**Simulating** is done on the word-level RTL, because that is far faster than gates: the RTL simulator (`rtlsim.ts`) *generates JavaScript* for each design, compiles it once with `new Function`, and lets V8 turn it into machine code. This is what it generates for the counter’s combinational logic, in the order the cells must be evaluated:

```js
"use strict";

function eval0() {
const s2 = V[2];
const s1 = V[1];
const s3 = V[3];
const s8 = ((s3 + 1) & 15);
const s9 = (s1 ? s8 : s3);
const s11 = (s2 ? 0 : s9);
V[11] = s11;
const s5 = (s3 === 15 ? 1 : 0);
const s6 = (s1 & s5);
V[6] = s6;
}
return function evalAll() { eval0(); };
```

`V` is a typed array with one slot per signal. Every signal is computed after those it depends on (possible only because the checker rejected combinational loops), the 4-bit add wraps with `& 15`, and each multiplexer is a conditional expression. The two-phase update is a separate function, generated for the clock:

```js
"use strict";

return function tick() {
const t0 = V[11];
V[3] = t0;
};
```

First every register’s next value is *sampled* into a temporary (`t0 = V[11]`, the input of the register), and then every register is *committed* (`V[3] = t0`). The function for the swap of Figure 29.2 has two samples and then two commits, so each register is loaded with the other’s old value. That is the whole trick.
:::

## Build it for real

:::real{parts="iCE40 FPGA board (optional)"}
There is nothing to wire up in this chapter: the compiler and simulator run in your browser, and the *Circuit* tabs are the gates it built. To build a design on a real chip, Chapter 31 sends the compiler’s output to the open-source tools Yosys and nextpnr and onto an iCE40 board, so that a design that passes its tests here can run on your desk. You never write, or read, Verilog to do it.
:::

## Exercises

```quiz
q: 'The lines inside the counter module are shuffled: `count = value` comes first, the `next value = …` line second, `reg value: bits<4> = 0` last. In which order must they be put back for the module to compile and work?'
options:
  - text: The `reg` must come first, then the `next`, then the outputs, as a variable is declared before it is used.
    why: 'That is the rule of a program, and DCL’s items are not a program. `count = value` may use `value` before its declaration, just like the `propagate` of the full adder above.'
  - text: 'The order does not matter: any of the orderings compiles, and builds exactly the same circuit.'
    correct: true
    why: 'Items are not executed in order. They are all facts about one circuit. Each of the orderings gives the same RTL, the same gates, and the same simulation. (This is the reason there is no Parsons puzzle here, the kind where you must put the lines in order: there is nothing to put in order.)'
  - text: The outputs must come before the register, because a wire has to exist before a register can be attached to it.
    why: 'A wire is neither before nor after: a circuit has no “before”. The compiler sorts the evaluation order out on its own.'
```

Which of these four modules compile?

```dcl error title="A"
module A(a: bits<4>, b: bits<4>) -> (y: bits<4>) {
  y = a + b
  y = a - b
}
```

```dcl title="B"
module B(clk: clock, d: bits<4>) -> (q: bits<4>) {
  reg r: bits<4> = 0
  next r = d
  q = r
}
```

```dcl error title="C"
module C(a: bits<4>, sel: bit) -> (y: bits<8>) {
  y = if sel { a } else { 0 }
}
```

```dcl error title="D"
module D(x: bit) -> (y: bit) {
  let t: bit = !u
  let u: bit = !t
  y = t
}
```

```quiz
q: 'Which of the modules A, B, C and D compile?'
options:
  - text: Only B.
    correct: true
    why: 'A assigns `y` twice: an output has one driver. C puts a 4-bit value in an 8-bit output: DCL will not extend it for you (`zext(a, 8)`). D is two inverters feeding each other with no register between them: a combinational loop.'
  - text: B and D, because names can be used before they are declared.
    why: 'They can, but D is not about order. `t` depends on `u`, and `u` on `t`, and no evaluation order exists. The register of B is what would have made a loop legal.'
  - text: B and C, because a small value can go into a big wire.
    why: 'Not in DCL: no implicit extension, ever. The compiler’s help line for C says `zext(a, 8)`, and that is the fix.'
  - text: All four.
    why: 'A, C and D are each rejected by a different check. The tour above has the message for each.'
```

What does this module become in hardware?

```dcl
module Decode(op: bits<2>, a: bits<8>, b: bits<8>) -> (y: bits<8>) {
  y = match op {
    0 => a + b,
    1 => a - b,
    2 => a & b,
    3 => a | b,
  }
}
```

```quiz
q: 'What does the `match` in `Decode` become in hardware?'
options:
  - text: A program that computes only the selected operation and skips the others.
    why: 'Hardware has no “skip”. There is nothing to run: all the circuits exist at all times.'
  - text: A multiplexer that chooses among four results, each computed all the time by its own adder, subtractor, AND or OR circuit.
    correct: true
    why: 'All four arms are built, and all four compute at every moment. The selector `op` picks which result reaches `y`. That is why the ALU in the viewer costs the sum of its eight operations, and why a design with a lot of operations is big.'
  - text: A chain of three 2-way multiplexers.
    why: 'That is what an `if … else if … else` would give (priority, deeper). A `match` makes one parallel multiplexer.'
  - text: A lookup table with four entries.
    why: 'A lookup table would hold constants. Here the four entries are results computed from `a` and `b`, so each one needs its own circuit, and only the choice is a multiplexer.'
```

:::challenge[How many flip-flops?]
The register file of the RV32I core is declared as `reg x: [bits<32>; 32]`, which suggests 32 × 32 = 1,024 flip-flops. The compiler builds 992. Where did 32 flip-flops go? Look at the two lines about `x[0]` and read the source of `content/designs/regfile.dcl` again.

*Answer.* `next x[0] = 0` and the register powers up as 0, so `x[0]` can never be anything else. The compiler folds a register that is always its own initial value into a constant, and builds flip-flops only for `x[1]` to `x[31]`: 31 × 32 = 992. This is exactly what the RISC-V specification asks for (register `x0` is hard-wired to zero), and what you would have to remember to do by hand in a schematic. Similarly `Fifo<8, 4>` in the standard library has 39: 32 for the four 8-bit slots, 2 + 2 for the two indices, and 3 for the count.
:::

Now write a module from scratch. The traffic light of the last section waits for a `tick`, and the tick has to come from somewhere: a counter that counts to a period, and pulses when it wraps. Write `TickGen`. The tests are already in the editor.

::snippet-playground{id="tick-gen" n="29.9" tab="tests" circuit=false caption="Replace the placeholder with a counter that counts from 0 to PERIOD - 1 and pulses tick on its last count, then press Run tests. clog2(PERIOD) is the number of bits needed to count PERIOD values. (A module with a generic cannot be driven by hand, so the tests are how you try it.)"}

:::details[Show a solution]
```dcl
/// Pulses `tick` for one cycle in every PERIOD cycles: the heartbeat that the traffic light waits for.
module TickGen<PERIOD: int>(clk: clock) -> (tick: bit) {
  reg count: bits<clog2(PERIOD)> = 0
  let last: bit = count == PERIOD - 1

  next count = if last { 0 } else { count + 1 }
  tick = last
}
```

The register is exactly wide enough for PERIOD values (`clog2(PERIOD)` is computed by the compiler, from the generic), `last` is a wire that says “this is the final count”, and the counter wraps on it. Wired to the `tick` input of `TrafficLight`, `TickGen<50_000_000>` on a 50 MHz clock gives the light a step once a second.
:::

Two modules to write, in the editor and with the compiler’s diagnostics as you type. Each is checked against hidden tests, and then against a reference design on the simulator, for every input (or, for a clocked design, every short sequence of inputs and thousands of random ones); a mismatch comes back as a table of inputs, expected outputs and what your design gave.

```hdl
id: 29-describing-hardware/priority-encoder
title: Which request wins?
top: PriorityEncoder
prompt: |
  Eight devices share a resource and each has a request line. Write a **priority encoder**: `req` is the eight request lines, and the outputs are `valid` (1 when any request is set) and `index`, the number (0 to 7) of the **highest-numbered** request that is set. When no request is set, `valid` is 0 and `index` is 0.

  The arbiter earlier in the chapter picked the *lowest* request and returned a code from 1; this one picks the highest and returns the line’s own number.
hints:
  - 'A chain of `else if` is exactly a priority chain: test `req[7]` first, then `req[6]`, and so on. The last `else` is the case where only request 0 is set or none is.'
  - '`valid` needs no chain: `any(req)` is 1 when at least one bit of `req` is 1.'
explain: |
  The `if` chain makes request 7 the first multiplexer’s select and request 0 the last branch: the priority is in the order of the tests. It is the right circuit here, because the conditions overlap and one of them has to win. (`match` would have been wrong: its arms may not overlap.)
height: 9
start: |
  /// The highest-numbered request that is set, and whether there is one.
  module PriorityEncoder(req: bits<8>) -> (valid: bit, index: bits<3>) {
    valid = 0
    index = 0
  }
reference: |
  module PriorityEncoder(req: bits<8>) -> (valid: bit, index: bits<3>) {
    valid = any(req)
    index = if req[7] {
      7
    } else if req[6] {
      6
    } else if req[5] {
      5
    } else if req[4] {
      4
    } else if req[3] {
      3
    } else if req[2] {
      2
    } else if req[1] {
      1
    } else {
      0
    }
  }
tests: |
  test "the highest request wins" {
    let e = sim PriorityEncoder(req: 0b0010_0110)
    expect e.valid == 1 && e.index == 5
    e.req = 0b1000_0001
    expect e.index == 7
  }

  test "no request: not valid, index 0" {
    let e = sim PriorityEncoder(req: 0)
    expect e.valid == 0 && e.index == 0
  }

  test "request 0 alone is valid" {
    let e = sim PriorityEncoder(req: 1)
    expect e.valid == 1 && e.index == 0
  }
equivalence: { exhaustiveBits: 8 }
solution: |
  /// The highest-numbered request that is set, and whether there is one.
  module PriorityEncoder(req: bits<8>) -> (valid: bit, index: bits<3>) {
    valid = any(req)
    index = if req[7] {
      7
    } else if req[6] {
      6
    } else if req[5] {
      5
    } else if req[4] {
      4
    } else if req[3] {
      3
    } else if req[2] {
      2
    } else if req[1] {
      1
    } else {
      0
    }
  }
```

```hdl
id: 29-describing-hardware/saturating-counter
title: A counter that stops
top: SatCounter
prompt: |
  The module in the editor is an up/down counter that *wraps*: counting up from 15 gives 0, counting down from 0 gives 15. A volume control must not do that. Make it **saturate**: at 15 it stays at 15 when told to count up, and at 0 it stays at 0 when told to count down.

  Ports: `clear` (synchronous; it beats everything), `en` (count when 1, hold when 0) and `up` (1 counts up, 0 counts down). Outputs: `count`, and two flags, `at_top` (count is 15) and `at_bottom` (count is 0). Keep the ports as they are.
hints:
  - 'The register’s `next` is a chain: `clear` first, then `en`, then the direction. The saturation belongs inside the direction branches: `if value == 15 { value } else { value + 1 }`.'
  - 'Holding a value is written out in DCL: the answer for a counter that has hit its limit is `value`, the same register.'
explain: |
  The two comparisons are two more gates on the existing adder’s path, and the holding is a multiplexer that picks `value` itself (the register’s own output) instead of the sum. Nothing saturates in the adder: `15 + 1` is still 0 there, as arithmetic in DCL always wraps. The circuit simply chooses not to use it. The check ran the design from power-up through every input sequence of 4 cycles (there are 4,096 of them) and then through random ones, against a reference that saturates.
height: 10
start: |
  /// A 4-bit up/down counter. It wraps at both ends: make it saturate.
  module SatCounter(clk: clock, clear: bit, en: bit, up: bit) -> (count: bits<4>, at_top: bit, at_bottom: bit) {
    reg value: bits<4> = 0

    next value = if clear {
      0
    } else if !en {
      value
    } else if up {
      value + 1
    } else {
      value - 1
    }
    count = value
    at_top = value == 15
    at_bottom = value == 0
  }
reference: |
  module SatCounter(clk: clock, clear: bit, en: bit, up: bit) -> (count: bits<4>, at_top: bit, at_bottom: bit) {
    reg value: bits<4> = 0

    next value = if clear {
      0
    } else if !en {
      value
    } else if up {
      if value == 15 { value } else { value + 1 }
    } else {
      if value == 0 { value } else { value - 1 }
    }
    count = value
    at_top = value == 15
    at_bottom = value == 0
  }
tests: |
  test "counts up and stops at 15" {
    let c = sim SatCounter(clear: 0, en: 1, up: 1)
    step 15
    expect c.count == 15 && c.at_top
    step 3
    expect c.count == 15
  }

  test "counts down and stops at 0" {
    let c = sim SatCounter(clear: 0, en: 1, up: 1)
    step 5
    c.up = 0
    step 9
    expect c.count == 0 && c.at_bottom
  }

  test "clear wins, and en low holds" {
    let c = sim SatCounter(clear: 0, en: 1, up: 1)
    step 4
    c.en = 0
    step 3
    expect c.count == 4
    c.en = 1
    c.clear = 1
    step
    expect c.count == 0
  }
solution: |
  /// A 4-bit up/down counter that saturates at both ends.
  module SatCounter(clk: clock, clear: bit, en: bit, up: bit) -> (count: bits<4>, at_top: bit, at_bottom: bit) {
    reg value: bits<4> = 0

    next value = if clear {
      0
    } else if !en {
      value
    } else if up {
      if value == 15 { value } else { value + 1 }
    } else {
      if value == 0 { value } else { value - 1 }
    }
    count = value
    at_top = value == 15
    at_bottom = value == 0
  }
```

## What’s next

We now have a language and know what it builds: modules and ports, wires that are `let` and state that is `reg`, multiplexers as `if` and `match`, hierarchy and generics, RAM as `mem`, state machines as enums, and tests that check a design before anything is built. Above all, the compiler shows its work: every line has a cost, and the cost has a name.

What the compiler has *not* done yet is put the result on a chip. The gates it builds are the ideal ones of Chapter 11, in a netlist with no place and no wires. Chapter 30 follows a netlist the rest of the way: optimised into a graph of AND gates and inverters, cut into LUTs, packed into logic cells, placed on the fabric by simulated annealing, routed through the switches of Chapter 28, timed, and turned into a bitstream. Then, in Chapter 31, the counter and the RV32I core go into the chip, and run.
