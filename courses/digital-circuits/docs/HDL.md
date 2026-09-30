# DCL — the course's hardware description language

*Working name: **DCL**, for Digital Circuits Language. Files end in `.dcl`.*

This is the design of the HDL used in Part VI (programmable logic) and wherever else the course describes
hardware as text. It records the decisions, the language and the compiler. The curriculum, the virtual
devices and the milestones are in [PLAN.md](PLAN.md).

## Decisions (agreed 2026-09-29)

| Topic | Decision | Notes |
|---|---|---|
| Language | A custom HDL instead of Verilog, used everywhere in the course | Verilog and VHDL appear only in history cards and in one *In industry* callout in Chapter 29, so readers recognise them when they meet them. |
| Syntax | Modern (Rust-like), **no semicolons** | Statements end at the end of a line. See *Statements and newlines*. |
| Types | **Strict static typing** | Every width is checked at compile time. No implicit extension, truncation or conversion. |
| Semantics | One semantics for simulation and synthesis | Latches, combinational loops, multiple drivers and gated clocks cannot be written. |
| Implementation | **TypeScript**, inside the course package | See *Implementation language*. The three hot kernels can move to Rust/WASM if the M7 benchmark requires it. |
| Real hardware | The compiler generates the interchange netlist for Yosys and nextpnr | Readers never write Verilog. |

## Goals

1. **Readable by programmers.** The syntax should feel familiar to anyone who knows Rust, Swift or
   TypeScript, without hiding that the code describes wiring, not a sequence of steps.
2. **Strict.** Mistakes that a Verilog flow reports only after synthesis (or never) are compile-time errors
   in DCL:
   - width mismatches;
   - missing cases;
   - unassigned outputs;
   - registers without a next value;
   - combinational loops;
   - clocks used as data;
   - reads across clock domains.
3. **Hardware by construction.** Every well-typed design is a synchronous circuit. Simulation and synthesis
   cannot disagree, because there is only one semantics.
4. **Visible.** Every expression becomes an identifiable piece of netlist, tagged with its source span and
   hierarchical path. The Device Studio can then go from a line of code to its gates, LUTs, routes and
   configuration bits, and back again.
5. **Small.** It can be learned in one chapter, yet it is complete enough for an RV32I core.

**Non-goals:**
- asynchronous logic and latches;
- tri-state signals inside a design (they are allowed only on top-level pins);
- delays outside tests;
- loops whose bounds are not known at compile time;
- floating point;
- pipelining constructs.

## A first look

A counter, with a test:

```dcl
/// A 4-bit counter with enable and synchronous clear.
module Counter(
  clk: clock,
  enable: bit,
  clear: bit
) -> (
  count: bits<4>,
  wrapped: bit
) {
  reg value: bits<4> = 0

  next value = if clear { 0 } else if enable { value + 1 } else { value }
  count = value
  wrapped = enable && value == 15
}

test "wraps after sixteen steps" {
  let c = sim Counter(enable: 1, clear: 0)
  step 15
  expect c.count == 15 && c.wrapped
  step
  expect c.count == 0
}
```

The Chapter 19 traffic light (British sequence), as a state machine:

```dcl
enum Light { Red, RedAmber, Green, Amber }

module TrafficLight(clk: clock, tick: bit) -> (red: bit, amber: bit, green: bit) {
  reg state: Light = Light.Red

  next state = if !tick { state } else {
    match state {
      Light.Red => Light.RedAmber,
      Light.RedAmber => Light.Green,
      Light.Green => Light.Amber,
      Light.Amber => Light.Red,
    }
  }
  red = state == Light.Red || state == Light.RedAmber
  amber = state == Light.RedAmber || state == Light.Amber
  green = state == Light.Green
}
```

The RV32I sample written during planning is valid DCL as written:

- its semicolons are accepted as separators, and the formatter removes them;
- its `match` arms put `_` first, which is fine because arm order does not matter (see *Expressions*);
- it uses `rd_write` before declaring it, which is fine because declarations are unordered.

It becomes the reference RV32I core in `content/designs/rv32i.dcl` (Chapter 31). The `top` keyword moves
from `RegFile` to `riscv32`, since `top` marks the module bound to the board.

## Syntax

### Lexical

- **Comments:** `//` and `/* */`. Doc comments `///` appear on hover and in the logic view.
- **Names:**
  - `snake_case` for values and ports;
  - `PascalCase` for modules, structs and enums;
  - `SCREAMING_CASE` for constants.

  The formatter enforces these as warnings.
- **Integer literals:** `42`, `0x2a`, `0b10_1010`, with `_` separators. They are untyped (see *Literals*).
- **Keywords:** `module top fn struct enum type const let reg mem next inst for in if else match on test
  sim step expect print`.

### Statements and newlines

A statement ends at the end of its line, unless one of these continues it:

- it is inside an unclosed `(` or `[`;
- the line ends with a binary operator, `=`, `,`, `->` or `{`;
- the next line starts with a token that cannot begin a statement: a binary or unary operator, `.`, `)`,
  `]` or `else`.

These rules are unambiguous because DCL has **no expression statements**. Every statement starts with a
keyword (`let`, `reg`, `next`, `inst`, …) or with the name of an output being assigned. So a line starting
with an operator can only be a continuation, as in:

```dcl
  let rd_write: bit = execute && trap == 0
    && (is_reg || is_imm || is_load || is_jal || is_jalr)
```

- `;` is accepted as a separator, so several statements can share a line. The formatter splits such
  lines and removes the semicolons.
- Trailing commas are allowed everywhere.

### Modules

```
[top] module Name<generics>(inputs) -> (outputs) { items }
```

- **Ports:** inputs are read-only. Every output is assigned exactly once, with `name = expr`.
- **`top`:** marks the module bound to the virtual board. Its ports must match the board's resources by name
  and type (see PLAN.md, *The virtual board*).
- **Generics:** compile-time integers, as in `module Fifo<WIDTH: int, DEPTH: int>(…)`. They can be used in
  types (`bits<WIDTH>`) and in constant expressions.
- **Unordered items:** a name can be used before it is declared. The compiler orders the dataflow itself,
  and reports any combinational cycle with its path. This is a teaching point: the module is a circuit,
  not a program.

### Items

| Item | Meaning |
|---|---|
| `let name: T = expr` | A named wire. Assigned once. The type can be left out when the right-hand side determines it; the editor then shows it as an inlay hint. |
| `const NAME: T = expr` | A compile-time constant. |
| `reg name: T = init` | A register. `init` is its value at power-up, loaded with the configuration. |
| `next name = expr` | The register's value after the next clock edge. Every register needs exactly one. A register array can instead have one per element (`next x[i] = …`), and the compiler checks that every element is covered. Holding a value is written explicitly: `next x = x`. |
| `mem name: [T; N] = init` | A memory with synchronous reads: `name.read(addr)` returns the data one cycle later, like block RAM. At most two reads and one `name.write(addr, data, enable)`. Mapped to block RAM where the device has it, otherwise to flip-flops. |
| `inst name: Module<args>(port: expr, …)` | An instance. Every input must be connected. Outputs are read as `name.port`. |
| `output = expr` | Assigns an output. |
| `for i in a..b { items }` | Unrolled at compile time. `i` is a compile-time integer; the range excludes `b`. |
| `fn name(args) -> T { expr }` (top level) | A pure combinational function, inlined wherever it is used. |

**Clocks:**

- A module with registers or memories must have exactly one `clock` input, which clocks all of them.
- A design with several clocks writes `reg x: T = 0 on other_clk`.
- `clock` values can only be passed through ports. They cannot be computed, compared or combined, so a
  gated clock is impossible to write; an enable is used instead.
- Reading a register from another clock domain is an error, unless it goes through the standard
  library's `Synchronizer`.

### Types

| Type | Values | Notes |
|---|---|---|
| `bit` | 0, 1 | The same type as `bits<1>`. Conditions must be `bit`. |
| `bits<N>` | unsigned N-bit vectors | Arithmetic wraps modulo 2ᴺ. |
| `signed<N>` | two's-complement N-bit vectors | Signed comparison and arithmetic right shift. Converted with `signed(x)` and `bits(x)`, which cost no hardware. |
| `clock` | — | Allowed only on ports. |
| `[T; N]` | arrays | Indexed by a constant, or by a value of type exactly `bits<⌈log₂ N⌉>`. A dynamic index becomes a multiplexer. |
| `struct S { a: T, … }` | records | Laid out as the concatenation of the fields, in declaration order. |
| `enum E { A, B, … }` | states | The compiler chooses the encoding: binary by default, `@onehot` or `@gray` to override. Only `==`, `!=` and `match` apply. |
| `type Word = bits<32>` | aliases | |
| `int` | compile-time integers | Generics, constants, loop variables. |

### Expressions

- **`if c { a } else { b }`** is an expression.
  - `else` is mandatory, and `else if` chains are allowed.
  - An `if` chain is a priority chain of 2-way multiplexers.
- **`match x { p => e, … }`**
  - Patterns are constants, alternatives `p | q`, or `_`.
  - Arms must not overlap, and together they must cover every value.
  - `_` covers the remaining values wherever it is written, so the order of arms does not matter.
  - A `match` compiles to one parallel multiplexer. The Studio shows it next to the equivalent `if` chain.
- **Operators**, with Rust's precedence, from tightest to loosest:
  - unary `!`, `~`, `-`;
  - `*`;
  - `+`, `-`;
  - `<<`, `>>`;
  - `&`;
  - `^`;
  - `|`;
  - comparisons (`==`, `!=`, `<`, `<=`, `>`, `>=`);
  - `&&`;
  - `||`.

  Unlike C, `&` binds tighter than `==`.
- **Operand rules:**
  - Arithmetic and bitwise operators need two operands of the same type, and return that type.
  - `&&`, `||` and `!` apply only to `bit`; `~` applies to `bits<N>`.
  - Comparisons return `bit`.
  - A shift amount can be any `bits<M>`.
- **Slices:**
  - `x[hi:lo]`, with constant bounds, has type `bits<hi − lo + 1>`;
  - `x[i]` is a `bit`, where `i` is a constant or has type `bits<⌈log₂ N⌉>`.
- **Built-ins:**
  - `concat(a, b, …)`, `repeat(x, n)`;
  - `zext(x, N)`, `sext(x, N)`, `trunc(x, N)`;
  - `reverse(x)`, `any(x)`, `all(x)`, `count_ones(x)`.

  Width arguments must be constants.

### Literals

- Integer literals are untyped. They take their type from context: a declared type, the other operand, a
  port, or the other branch of an `if` or `match`.
- Context flows through `if`, `match`, and the arithmetic and bitwise operators. For example, in
  `rs1_value >> shift | ~(0xffffffff >> shift)`, the literal is `bits<32>` because `rs1_value` is.
- A literal that does not fit its type is an error.
- A literal with no context is an error, and the fix is a typed literal, `bits<12>(0)`, or a `const`.
  Examples: an argument of `concat`, or both sides of a comparison.

### Tests

`test` blocks are the only place where code runs in order. They drive a simulated instance, and they are
compiled only for simulation.

```dcl
test "adds and subtracts" {
  let alu = sim Alu(rs1_value: 7, b: 5, f3: 0, is_reg: 1, ir30: 0)
  expect alu.result == 12
  alu.ir30 = 1
  expect alu.result == 2
}
```

- `sim M(…)` creates an instance with initial input values, and `x.port = v` changes an input.
- `step n` pulses the instance's clock n times.
- `expect` checks a condition, and `print` writes to the console.
- `for` loops and `random(bits<N>)` provide stimulus.
- When an `expect` fails, the waveform around the failure is shown.

Exercises are checked by hidden tests, plus an equivalence check against the reference design:

- exhaustive for up to 16 inputs;
- bounded sequential equivalence plus random stimulus beyond that.

### Diagnostics

Errors name the hardware problem and propose an explicit fix:

```
error: width mismatch
   ┌─ riscv32.dcl:58:36
58 │   let next_pc: bits<32> = pc + imm_12
   │                                ^^^^^^ bits<12>, expected bits<32>
   = help: extend it explicitly: sext(imm_12, 32) or zext(imm_12, 32)

error: this match does not cover every value of `f3: bits<3>`
   ┌─ alu.dcl:21:12
21 │   result = match f3 {
   │            ^^^^^ 5, 6 and 7 are missing
   = help: add the missing arms, or `_ => …`

error: combinational loop
   ┌─ latch.dcl:4:7
 4 │   let q: bit = !(s && q_n)
   │       ^ q → q_n → q
   = note: a loop without a register holds state without a clock (a latch); use `reg`
```

## Compiler

```
source → lexer → parser → AST → names → types → elaboration (generics, const, for, fn)
      → word-level RTL (cells tagged with source spans and hierarchical paths)
          ├─ RTL simulator (JavaScript generated per design)           tests, exercises, waveforms
          ├─ bit-level netlist (the course's netlist model)           logic view, bench, digital engine, abstraction dial
          ├─ two-level logic                                           PAL, GAL and CPLD fitters
          ├─ and-inverter graph → LUTs → pack → place → route         FPGA flow (PLAN.md, Programmable logic)
          └─ interchange netlist                                       Yosys and nextpnr, for the real iCE40 board
```

- **Incremental checking.** The front end runs in a worker, and each change re-checks only the modules it
  affects. The target is under 50 ms after a keystroke, for a 500-line design such as the RV32I core.
- **Values.** Values up to 32 bits are JavaScript numbers, using 32-bit bitwise operations. Wider values are
  stored in `Uint32Array` words. BigInt is used only for constant folding.
- **RTL simulator.** Each design is compiled to a JavaScript function with `new Function` (the Verilator
  approach), which V8 then compiles to machine code. Registers update in two phases, so they all change
  together at the clock edge.
- **Lowering to bits.** Word-level cells expand into gates. Adders become full adders from the parts bin;
  multiplexers become gate trees; and so on. The result uses the same netlist model as the bench and the
  digital engine, so the abstraction dial also works on DCL designs.
- **Formatter.** There is one style, used for every code block in the course and applied on save.
- **Highlighting.** The compiler's own lexer does all the highlighting. The Markdown compiler calls it at
  build time for code blocks, instead of a TextMate grammar in Shiki. The CodeMirror editor uses it too.
  That leaves only one grammar to maintain.
- **Editor** (CodeMirror 6):
  - diagnostics, completions, go to definition, rename;
  - inlay hints for inferred types;
  - hovering shows the type, the doc comment and the hardware cost (for example, "32-bit adder: 32 LUT4s
    on the carry chain"), and highlights the matching cells in the logic and chip views.

### Interchange netlist

PLAN.md left the choice between Yosys JSON and structural Verilog to M7. The choice is **Yosys JSON**, the
format of Yosys's `write_json` and `read_json` (Yosys manual, *Yosys JSON netlist format*). It is data, so
the writer is a pure function of the word-level RTL (`src/lib/pld/interchange/`), and it needs no Verilog
printer, no escaping rules and no dialect. DCL therefore has no Verilog backend.

```
Counter.dcl → RTL → toYosysJson → counter.json
yosys -p "read_json counter.json; synth_ice40 -top Counter -json counter.synth.json"
nextpnr-ice40 --up5k --package sg48 --json counter.synth.json --pcf board.pcf --asc counter.asc
```

- **Level.** The netlist is word-level, like the RTL. Each RTL cell becomes one Yosys internal cell of the
  same width, and Yosys does its own optimisation, LUT mapping, carry-chain and block-RAM inference. The
  gate-level netlist and the course's own LUT mapping are not exported: comparing them with what Yosys
  makes of the same source is the point of Chapter 31's utilisation and fmax table.
- **File.** `{ creator, modules }`. A module has `attributes`, `ports` (direction and `bits`), `cells`
  (`hide_name`, `type`, `parameters`, `attributes`, `port_directions`, `connections`) and `netnames`
  (`hide_name`, `bits`, `attributes`). A bit is a net number (from 2, one per wire bit, least significant
  bit first) or `"0"`, `"1"`. Integer parameters are 32-bit binary strings, as Yosys writes them.
- **Hierarchy.** One module per DCL module specialisation, named like the RTL key with every run of
  characters outside `A-Za-z0-9_$` replaced by `_` (`Fifo<8, 4>` is `Fifo_8_4`, and the original is in the
  attribute `dcl_module`). An instance is a cell whose type is the child's module name, with the child's
  ports as connections. The top module has the attribute `top`. `flatten: true` inlines the hierarchy first
  (`flattenRtl`) and writes one module.
- **Names and provenance.** Ports are ports. Every named RTL signal (ports, `let`s, registers, register
  array elements, memory read ports) is a netname. Cells have automatic names (`$add$counter.dcl:12$4`,
  `hide_name` 1), except instances and memories. A cell's `src` attribute is its source span
  (`file:line.col-line.col`) and `dcl_path` its instance path.
- **Cell mapping.**

| RTL cell | Yosys |
|---|---|
| `add` `sub` `mul` `and` `or` `xor` `not` `neg` | `$add` `$sub` `$mul` `$and` `$or` `$xor` `$not` `$neg` |
| `shl`; `shr` (`signed` or not) | `$shl`; `$sshr` or `$shr` |
| `eq` `ne`; `lt` `le` `gt` `ge` | `$eq` `$ne`; `$lt` `$le` `$gt` `$ge` (`A_SIGNED` and `B_SIGNED` from `signed`) |
| `mux` | `$mux` (`Y = S ? B : A`, as in the RTL) |
| `pmux` | one `$eq` per matched value, a `$reduce_or` over the values of a case, and a `$pmux` whose one-hot select is the cases' hits |
| `reduce_and` `reduce_or` `reduce_xor` | `$reduce_and` `$reduce_or` `$reduce_xor` |
| `popcount` | a chain of `$add` |
| `reg` | `$dff` (rising edge); the power-up value is the `init` attribute of its netnames |
| `mem` | one `$mem_v2`: clocked reads, no enable or reset, not transparent (a read sees the word from before the edge's write), at most one write port |
| `const` `slice` `concat` `repeat` `zext` `sext` | no cell: constant bits and rearranged bits |

- **Differences.** The RTL reads 0 from an out-of-range memory address and ignores an out-of-range write;
  Yosys leaves both undefined. This matters only for a memory whose depth is not a power of two. Yosys
  optimises across the module boundaries only after `flatten`, which `synth_ice40` does.
- **Testing.** `src/lib/pld/interchange/` has a validator for the documented format (shape, parameters and
  port widths of every internal cell, one driver per net, the hierarchy) and a simulator that reads only the
  JSON. The tests run every course design and random modules using every cell kind on the RTL simulator and
  on the JSON side by side, and compare a golden file for the Counter. `validate:yosys`
  (`docs/AUTHORING.md`, *Validation*) sends the same files through Yosys and nextpnr.

## Implementation language: TypeScript

We compared writing the compiler and toolchain in Rust (compiled to WebAssembly) with writing them in
TypeScript.

| | Rust → WASM | TypeScript |
|---|---|---|
| Editor and Studio | ASTs, spans, diagnostics, hover data and toolchain traces cross a serialisation boundary | The Svelte views and the CodeMirror extension read the compiler's data structures directly |
| Netlist model | The simulators, bench and checkers either move to Rust too, or two models are kept in sync | One model, shared by DCL, the bench, the three engines and the checkers |
| Hot loops (placement, routing, simulation) | Typically 1.5–3× faster | Data-oriented code over typed arrays, in workers |
| Simulation | An interpreter, or WASM generated at run time (complex) | JavaScript generated per design and compiled by V8, usually faster than a generic interpreter in either language |
| Build and CI | rustup and wasm-bindgen/wasm-pack in CI and for every contributor; a second toolchain in a Node-only monorepo | Nothing new: Node, Vite, Vitest |
| Tests | Cargo and JavaScript tests, with differential tests across the boundary | Vitest and fast-check, as in the other courses |
| *Under the hood* excerpts | Rust next to TypeScript elsewhere in the course | One language across the course |
| Precedent in the repo | None | CIC's kernel, SSA to Silicon's kiln (~9k lines), Incompleteness's engine |

**Decision: TypeScript.**

- **Most of the work touches the UI.** The front end runs on every keystroke, and synthesis records
  cross-probing metadata and replay traces for the Studio. All of that is simplest in the same language as
  the views.
- **The heavy work is fast enough in TypeScript:**
  - the designs are small (an RV32I core is a few thousand LUT4s);
  - placement, routing and simulation run in workers over typed arrays;
  - the simulator runs JavaScript generated for each design.

**Escape hatch.** The three hot kernels (placer, router and fabric simulator) take and return typed
buffers (struct of arrays) through narrow interfaces. The M7 benchmark checks two targets:

- the RV32I core is placed and routed on vFPGA-L in under 30 s on a recent laptop;
- the fabric simulation runs at 1 kHz or more with both views animated.

If a target is missed, only the kernel responsible moves to Rust/WASM. The front end and the rest of the
toolchain stay in TypeScript.

## Prior art

DCL borrows from recent HDLs:

- **Spade:** Rust-inspired syntax and strong types; the closest in spirit.
- **Veryl:** a modern syntax over SystemVerilog.
- **Chisel** and **SpinalHDL** (Scala), **Amaranth** (Python), **Clash** (Haskell): hardware generated by a
  program written in a host language.
- **Bluespec:** strong types and guarded rules.

DCL is a standalone language rather than a library inside a host language, for three reasons:

- there is no host language to learn first;
- the compiler can give precise, hardware-specific errors;
- every cell traces back to a source span, which the Studio's cross-probing needs.

## Where DCL appears in the course

| Where | Use |
|---|---|
| Chapters 26–28 | GAL, CPLD and small FPGA designs are written as short DCL modules that read like the PAL equations of the 1980s |
| Chapter 29 | The language itself, with an *In industry* callout showing one module in Verilog and VHDL |
| Chapters 30–31 | The toolchain, and the capstones (Octet and the RV32I core) |
| Parts bin | Every part has a *View as DCL* tab, generated from its netlist; every DCL module can be placed on the bench as a part |
| Real hardware | The generated interchange netlist for Yosys and nextpnr, which the reader never has to write or read |

## Open questions

- **Name:** DCL is a working name.
- **Signed values:** is `signed<N>` worth having, or are `sext` plus signed comparison operators enough?
- **Buses:** interfaces or bundles with directions, after M7.
- **Standard library:** synchroniser, FIFO, UART, debouncer, 7-segment driver. The final list is decided
  in M7.
