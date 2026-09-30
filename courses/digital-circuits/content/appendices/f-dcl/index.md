---
number: F
title: DCL reference
summary: "The whole of the course’s hardware language in one place: lexical structure, types and widths, every operator with its result type, registers, memories, instances, tests, the standard library, what each construct becomes in gates, and every message the checker can give."
duration: Look things up
prerequisites: []
---

This appendix is the reference for **DCL**, the hardware language of Part VI. [Chapter 29](/chapters/describing-hardware/) teaches it; this page is what you keep open while you write it. It is complete: if a construct is not here, DCL does not have it. It is also checked: every `dcl` block on the page is a whole file that the real compiler accepts and whose tests pass, every result type in the operator and built-in tables was computed by the real checker, the costs were counted on the gates the real lowering builds, and the table of messages is compared with the checker’s source by a test. When the language changes and this page does not, a test fails.

Two conventions. *Compile-time* means the value is known when the compiler runs (a number, a `const`, a generic parameter, a loop variable): it costs no hardware. *Hardware* means the value is a wire that changes while the circuit runs. The examples use these names throughout: `a` and `b` are `bits<8>`, `s` and `u` are `signed<8>`, `c` and `d` are `bit`, and `i` is `bits<3>`.

## A module at a glance

A DCL file is a list of items: modules, functions, types, constants and tests. A module has inputs, outputs and a body of declarations in any order. Nothing in the body *runs*: each line is a piece of the circuit, all of it present at once.

::snippet-playground{id="glance" n="F.1" tab="run" caption="A counter with enable and a synchronous clear. Set enable to 1 and press Step clock: count goes up at each edge. The lines can be in any order: try moving the last line to the top. Read the Circuit tab to see the four flip-flops (the register) and the multiplexers (the two ifs)."}

| Part | Written as | Means |
|---|---|---|
| Ports | `clk: clock, enable: bit` | Inputs, read-only. A `clock` input is the only way a clock enters a design. |
| Outputs | `-> (count: bits<4>)` | Each output is assigned exactly once, with `name = expression`. |
| Register | `reg value: bits<4> = 0` | A flip-flop per bit, holding `0` from power-up. |
| Next value | `next value = …` | What the register holds after the next clock edge. Exactly one per register. |
| Wire | `let x: bit = …` | A named value. Assigned where it is declared, never again. |

## Lexical structure

### Source text

A file is UTF-8 text with the extension `.dcl`. Identifiers use ASCII only; other characters are allowed in comments and strings.

| Element | Rule |
|---|---|
| Comments | `// to the end of the line`; `/* … */`, which nest. |
| Doc comments | `///` immediately before an item or a port attaches to it and shows on hover in the editor. `////` is an ordinary comment. |
| Identifiers | A letter or `_`, then letters, digits and `_`. Case matters. |
| Integer literals | `42`, `0x2a`, `0b10_1010`. Digits may be separated by `_` anywhere. No octal, no fractions, no suffixes. Any size: a literal is checked against the type it lands in. |
| Strings | `"…"` on one line, with `\n` and `\t`; any other `\x` stands for `x`. Only test names and `print` take strings. |
| Statement end | A line break, or `;` (the formatter turns `;` into line breaks). See below. |

### Keywords

There are twenty-three, and they cannot be used as names.

| | | | | | |
|---|---|---|---|---|---|
| `module` | `top` | `fn` | `struct` | `enum` | `type` |
| `const` | `let` | `reg` | `mem` | `next` | `inst` |
| `for` | `in` | `if` | `else` | `match` | `on` |
| `test` | `sim` | `step` | `expect` | `print` | |

The type names `bit`, `bits`, `signed`, `clock` and `int` are not keywords, but wherever a type is expected they always mean the built-in types. The names of the built-in functions (`concat`, `zext` and the others under *Built-in functions*) are not reserved either; do not reuse them for your own.

### Names

Three styles, checked by the compiler as *warnings* (code `naming`), which the editor shows as a lint:

| Style | For |
|---|---|
| `snake_case` | ports, `let`, `reg`, `mem`, `inst`, functions, struct fields, loop variables |
| `PascalCase` | modules, structs, enums and their variants, type aliases |
| `SCREAMING_CASE` | `const`, generic parameters |

### Operators and punctuation

`->` `=>` `==` `!=` `<=` `>=` `<<` `>>` `&&` `||` `..` `+` `-` `*` `&` `|` `^` `!` `~` `<` `>` `=` `.` `,` `:` `;` `(` `)` `[` `]` `{` `}` `@`. After a type name or a module name, `<` and `>` are brackets around generic arguments, not comparisons; the parser knows from the context.

### Where a statement ends

There are no semicolons, so a line break ends a statement, unless the statement obviously goes on. A line continues onto the next one when

- it is inside an unclosed `(` or `[`;
- it ends with a binary or unary operator, `=`, `,`, `->`, `{`, `.`, `..`, `:`, `=>` or `@`;
- or the next line starts with a binary or unary operator, `.`, `)`, `]`, `}`, `,`, `..`, `:`, `=`, `->`, `=>` or `else`.

That is unambiguous because no statement is a bare expression: every statement starts with a keyword or with the name of an output. The catch is that `-`, `!` and `~` are operators, so **a line that starts with one continues the line above**. If you meant a new statement, give it a keyword or an output name.

```dcl
module Continued(a: bits<8>, b: bits<8>, c: bit) -> (y: bit) {
  let both: bit = a == b && c
  y = both || a == 0
}

test "a long condition continues on the next line" {
  let m = sim Continued(a: 3, b: 3, c: 1)
  expect m.y
  m.c = 0
  expect !m.y
  m.a = 0
  expect m.y
}
```

A missing closing bracket would swallow the rest of the file, so when a line inside an unclosed `(` or `[` starts with a keyword that only begins a statement (`let`, `reg`, `next`, `module`, and so on), the parser assumes the bracket was left open by mistake and ends the statement there.

## Types and widths

Every value has a static type, and the compiler checks every width. There is no implicit extension, truncation or conversion of any kind.

| Type | Values | Width | Notes |
|---|---|---|---|
| `bit` | 0, 1 | 1 | The same type as `bits<1>`. Conditions must be `bit`. |
| `bits<N>` | unsigned vectors | N | Arithmetic wraps modulo 2ᴺ. |
| `signed<N>` | two’s complement | N | Signed comparison and arithmetic right shift; converted with `signed(x)` and `bits(x)`, which cost no hardware. |
| `clock` | none | 1 | Ports only. Cannot be read, computed, stored or compared. |
| `[T; N]` | N elements of type T | N × width of T | Element 0 is in the least significant bits. |
| `struct S { a: T, … }` | records | sum of the fields | The first field is the most significant. |
| `enum E { A, B, … }` | named states | see below | Only `==`, `!=`, `match` and `bits(x)` apply. |
| `type W = bits<32>` | alias | that of the target | Interchangeable with the target. |
| `int` | compile-time integers | none | Generics, constants, loop variables; unbounded. Never hardware. |

Widths and array sizes must be compile-time integers from 1 to 65,536 (`bits<0>` and `bits<65537>` are errors, code `bad-width`; `[T; 0]` is `bad-size`). A width can be any constant expression, including generic parameters and `clog2(N)`.

### Enums and their encodings

The compiler chooses how a state is stored. The default is binary, in ⌈log₂ n⌉ bits (at least one); an attribute overrides it. Changing the attribute changes the gates and nothing else in the design.

| Attribute | Code of the i-th variant | Width for n variants |
|---|---|---|
| none, or `@binary` | i | ⌈log₂ n⌉, at least 1 |
| `@onehot` | 2ⁱ | n |
| `@gray` | i XOR (i >> 1) | ⌈log₂ n⌉, at least 1 |

### Structs, arrays and aliases

```dcl
enum Light { Red, RedAmber, Green, Amber }

@onehot enum Phase { Idle, Run, Done }

@gray enum Level { L0, L1, L2, L3 }

struct Pixel { r: bits<5>, g: bits<6>, b: bits<5> }

type Word = bits<16>

const MASK: bits<8> = 0x0f

module Types(
  sel: bits<2>,
  px: Pixel,
  idx: bits<2>,
) -> (
  green: bits<6>,
  packed: Word,
  lit: bit,
  third: bits<8>,
  low: bits<8>,
) {
  let table: [bits<8>; 4] = [10, 20, 30, 40]
  let s: Light = match sel {
    0 => Light.Red,
    1 => Light.RedAmber,
    2 => Light.Green,
    3 => Light.Amber,
  }
  green = px.g
  packed = bits(px)
  lit = s == Light.Green
  third = table[idx]
  low = table[3] & MASK
}

test "layout and lookup" {
  let t = sim Types(sel: 2, px: Pixel { r: 1, g: 2, b: 3 }, idx: 2)
  expect t.green == 2
  expect t.packed == (1 << 11) | (2 << 5) | 3
  expect t.lit
  expect t.third == 30
  expect t.low == 8
}
```

- A struct literal names every field, in any order (a forgotten field is `missing-field`). Fields are read with `.`. Structs and arrays can be compared with `==` and `!=`, not ordered.
- `bits(x)` turns an enum, struct or array into its bit pattern. There is no conversion the other way: a number is not an enum (`type-mismatch`, with a hint to use a variant).
- An array literal is `[a, b, c]` or `[value; count]`. It is indexed by a constant, or by a value of type exactly `bits<⌈log₂ N⌉>` (at least one bit): a dynamic index becomes a multiplexer. A dynamic index past the end (in an array whose length is not a power of two) reads 0.
- A recursive type is an error (`recursive-type`): hardware has a fixed size.

## Literals and their types

An integer literal has no width of its own. It takes its type from where it lands, and the compiler pushes that type inward through `if`, `match`, and the arithmetic and bitwise operators.

| Context | Example | The literal becomes |
|---|---|---|
| A declared type | `let x: bits<12> = 5` | `bits<12>` |
| The other operand | `a + 1` | `bits<8>`, like `a` |
| A port | `sim M(a: 7)`, `inst u: M(a: 7)` | the port’s type |
| The other arm | `if c { a } else { 0 }` | `bits<8>` |
| A typed literal | `bits<12>(0)`, `signed<8>(-3)`, `bit(1)` | the named type |
| An array element or `next` | `next r = 0` | the register’s type |
| Nothing | `let x = 5` | an error: `literal-no-context` |

A literal that does not fit is an error (`literal-too-wide`): a negative number is not a bit pattern for `bits<N>`, so write `signed<N>(-3)`, or subtract from zero. A negative literal is legal only where the type is signed.

Expressions made only of literals, constants, generics and loop variables are computed as compile-time integers and converted once to the type they land in, so `WIDTH - 1` and `1 << 4` cost nothing.

## Expressions

### Operators

Binary operators are left-associative, and comparisons cannot be chained (`a < b < c` is a syntax error; write `a < b && b < c`). The unary operators `!`, `~` and `-` bind tighter than every binary one. **`&`, `^` and `|` bind tighter than `==`**, unlike C; use parentheses if you are not sure a reader will remember that. Arithmetic never widens: the result has the width of the operands, and `*` keeps only the low bits. To keep the full product, extend first with `zext(a, 16) * zext(b, 16)`.

| Precedence | Operator | Operands | Example | Type of the example | What it does |
|---|---|---|---|---|---|
| unary | `!` | `bit` | `!c` | `bit` | Logical not. Not defined on vectors: use `~`, or compare with `== 0`. |
| unary | `~` | `bits<N>`, `signed<N>`, `bit` | `~a` | `bits<8>` | Bitwise not. |
| unary | `-` | `bits<N>`, `signed<N>` | `-s` | `signed<8>` | Two’s-complement negation; wraps. |
| 9 | `*` | two of the same type | `a * b` | `bits<8>` | Multiplication modulo 2ᴺ. A shift-and-add array: the gate count grows with N². |
| 8 | `+` `-` | two of the same type | `s + u` | `signed<8>` | Addition and subtraction modulo 2ᴺ. |
| 7 | `<<` `>>` | vector, and a shift amount | `a << i` | `bits<8>` | Shift. The amount is any unsigned `bits<M>` or a constant; an amount of N or more gives 0. |
| 7 | `>>` | `signed<N>` | `s >> i` | `signed<8>` | Arithmetic shift: fills with the sign bit, so an amount of N or more gives 0 or −1. |
| 6 | `&` | two of the same type | `a & b` | `bits<8>` | Bitwise and. On `bit` operands it is the logical and, without short-circuit. |
| 5 | `^` | two of the same type | `a ^ b` | `bits<8>` | Bitwise exclusive or. |
| 4 | `\|` | two of the same type | `c \| d` | `bit` | Bitwise or. |
| 3 | `==` `!=` | two of the same type | `a == b` | `bit` | Equality, on vectors, enums, structs and arrays. |
| 3 | `<` `<=` `>` `>=` | two of the same number type | `s < u` | `bit` | Ordering: unsigned for `bits<N>`, two’s complement for `signed<N>`. Not defined on enums, structs or arrays. |
| 2 | `&&` | two `bit`s | `c && d` | `bit` | Logical and. Both sides are hardware: nothing is skipped. |
| 1 | `\|\|` | two `bit`s | `c \|\| d` | `bit` | Logical or. |

Mixing `bits<8>` and `signed<8>` is a type error: convert explicitly with `signed(a)` or `bits(s)`. Mixing widths is a width error, and the message says which of `zext`, `sext` and `trunc` to write.

### `if` and `match`

`if c { x } else { y }` is an expression, not a statement. `else` is mandatory, `else if` chains are allowed, and the braces are required. The condition must be a `bit`. An `if` chain is a priority chain of two-way multiplexers: the first true condition wins.

`match x { p => e, … }` chooses by value. The scrutinee is a `bits<N>`, `signed<N>` or enum. A pattern is a constant, several alternatives `p | q`, or `_`. The arms must not overlap, and together they must cover every value, or contain `_` (`_` covers what is left wherever it is written, so **the order of the arms does not matter**). A `_` when everything is already covered is a warning (`unreachable-arm`). A `match` becomes one parallel multiplexer, where an `if` chain is a series of them.

Both branches of an `if` are always checked, even when the condition is a compile-time constant. Inside an unrolled loop that matters: `if i == 0 { d } else { regs[i - 1] }` is an error at `i = 0`, because `regs[-1]` does not exist, whichever branch is chosen. Split the loop, as the next example does.

```dcl
module Ops(
  a: bits<8>,
  b: bits<8>,
  s: signed<8>,
  u: signed<8>,
  n: bits<4>,
) -> (
  sum: bits<8>,
  prod: bits<8>,
  wide: bits<16>,
  shl: bits<8>,
  sar: signed<8>,
  slt: bit,
  ult: bit,
  masked: bit,
) {
  sum = a + b
  prod = a * b
  wide = zext(a, 16) * zext(b, 16)
  shl = a << n
  sar = s >> n
  slt = s < u
  ult = a < b
  masked = a & b == 0
}

test "arithmetic wraps, and over-long shifts give zero" {
  let o = sim Ops(a: 200, b: 100, s: signed<8>(-3), u: signed<8>(2), n: 9)
  expect o.sum == 44
  expect o.prod == 32
  expect o.wide == 20000
  expect o.shl == 0
  expect o.sar == signed<8>(-1)
  expect o.slt
  expect !o.ult
}

test "and binds tighter than equality" {
  let o = sim Ops(a: 0b1100, b: 0b0011, s: signed<8>(0), u: signed<8>(0), n: 0)
  expect o.masked
}
```

### Selecting parts of a value

| Form | Example | Type | Meaning |
|---|---|---|---|
| Slice | `a[3:0]` | `bits<4>` | Bits 3 down to 0. Both bounds are constants, `hi` first. |
| Bit | `a[3]`, `a[i]` | `bit` | A constant index (a wire), or a `bits<⌈log₂ N⌉>` one (a right shifter and its lowest bit). |
| Element | `x[i]` | the element type | On an array, a constant index is a wire and a `bits<⌈log₂ N⌉>` one a parallel multiplexer. |
| Field | `px.g` | the field’s type | A struct field: a slice, no hardware. |
| Variant | `Light.Red` | the enum | A constant. |
| Instance output | `u.count` | the port’s type | An output of an instance. |

### Built-in functions

Width arguments must be compile-time constants. The operand must have a known width, so a bare literal is not accepted.

| Function | Arguments | Example | Type of the example | What it does |
|---|---|---|---|---|
| `concat` | one or more vectors | `concat(a, b)` | `bits<16>` | Joins them, the first as the most significant part. |
| `repeat` | a vector, a count of at least 1 | `repeat(a, 3)` | `bits<24>` | Copies the vector side by side. |
| `zext` | a vector, a width | `zext(a, 16)` | `bits<16>` | Zero extension. The width must not be smaller. |
| `sext` | a vector, a width | `sext(s, 16)` | `signed<16>` | Sign extension. The width must not be smaller. |
| `trunc` | a vector, a width | `trunc(a, 4)` | `bits<4>` | Keeps the low bits. The width must not be larger. |
| `reverse` | a vector | `reverse(a)` | `bits<8>` | Reverses the order of the bits. |
| `any` | a vector | `any(a)` | `bit` | 1 if any bit is 1 (the OR of all the bits). |
| `all` | a vector | `all(a)` | `bit` | 1 if every bit is 1 (the AND of all the bits). |
| `count_ones` | a vector | `count_ones(a)` | `bits<4>` | The number of ones, in ⌈log₂(N + 1)⌉ bits. |
| `signed` | a vector | `signed(a)` | `signed<8>` | Reinterprets the bits as two’s complement. No hardware. |
| `bits` | a vector, enum, struct or array | `bits(s)` | `bits<8>` | Reinterprets as an unsigned bit pattern. No hardware. |
| `bit` | a `bit` or a literal | `bit(1)` | `bit` | A one-bit literal. |
| `bits<N>` | a vector of N bits, or a literal | `bits<4>(a[3:0])` | `bits<4>` | A typed literal, or a same-width conversion. |
| `clog2` | a positive compile-time integer | `clog2(8)` | `int` | ⌈log₂ n⌉: the width of an index into n things. Compile-time only. |
| `random` | a type | `random(bits<8>)` | `bits<8>` | A seeded random value. Tests only. |

`zext` and `sext` keep the signedness of their operand, and an equal width is accepted. `count_ones(c)` of a single `bit` is a `bit`.

## Modules

```text
[top] module Name<G: int, …>(input: type, …) -> (output: type, …) { items }
```

- The output list `-> (…)` may be left out for a module with no outputs. Trailing commas are allowed everywhere.
- **Inputs** are read-only. **Outputs** are write-only inside the module: an output is assigned exactly once with `name = expression` (`unassigned-output`, `double-assignment`), and reading it back is `read-output`. To use a value and output it, compute it in a `let` and assign both.
- **Items are unordered.** A name can be used before it is declared. The compiler orders the dataflow itself, and reports any loop with its path (`comb-loop`). The module is a circuit, not a program.
- A **generic** parameter is a compile-time integer, `<WIDTH: int>`. It can be used in types, in constants and as a value. Modules with generics are checked once for every combination that is used. `top` modules cannot have generics.
- `top` marks the module that is bound to the virtual board (its ports are matched to the board by name and type: see Appendix G). At most one module per file is `top`.
- A module can instantiate other modules, but not itself, directly or through others (`recursive-module`).

### Items in a module body

| Item | Form | Notes |
|---|---|---|
| Wire | `let name: T = expr` | The type can be left out when the value has one; the editor then shows it as an inlay hint. |
| Constant | `const NAME: T = expr` | Compile-time. Also allowed at the top level. Without a type, the value is a compile-time integer. |
| Register | `reg name: T = init` | `init` is the power-up value, a constant. `T` can be any type except `clock` and `int`. |
| Next value | `next name = expr` | Exactly one per register, or one per element for an array register. |
| Memory | `mem name: [T; N] = init` | See *Memories*. |
| Instance | `inst name: Module<args>(port: expr, …)` | Every input is connected. Outputs are read as `name.port`. |
| Output | `name = expr` | Exactly once per output. |
| Write | `name.write(addr, data, enable)` | A memory’s write port. |
| Loop | `for i in a..b { items }` | Unrolled at compile time; `b` is not included. |

### Registers

A register is a flip-flop for every bit of its type. It holds its value until the clock edge, when it takes the value of its `next` expression, evaluated from the values just *before* the edge. All registers change together, so a swap works without a temporary. A register needs a `next`: to hold a value, say so explicitly with `next x = x`.

An array register can either have one `next` for the whole array, or one per element, in which case every element must be covered (`reg-array-coverage`). Loops make that natural.

```dcl
module Swap(clk: clock, load: bit, a_in: bits<4>, b_in: bits<4>) -> (a: bits<4>, b: bits<4>) {
  reg x: bits<4> = 0
  reg y: bits<4> = 0
  next x = if load { a_in } else { y }
  next y = if load { b_in } else { x }
  a = x
  b = y
}

module Bank(clk: clock, d: bits<4>) -> (taps: [bits<4>; 3]) {
  reg regs: [bits<4>; 3] = [0; 3]
  next regs[0] = d
  for i in 1..3 {
    next regs[i] = regs[i - 1]
  }
  taps = regs
}

test "registers swap at the edge" {
  let s = sim Swap(load: 1, a_in: 3, b_in: 9)
  step
  s.load = 0
  expect s.a == 3 && s.b == 9
  step
  expect s.a == 9 && s.b == 3
  step
  expect s.a == 3 && s.b == 9
}

test "a shift register passes a value along" {
  let b = sim Bank(d: 7)
  step
  expect b.taps[0] == 7 && b.taps[1] == 0
  step 2
  expect b.taps[2] == 7
}
```

### State machines

A register of an enum type, and a `match` on it, is a state machine: the register holds the state, the `match` is the next-state logic, and the outputs are functions of the state. The compiler chooses the encoding, so `@onehot` or `@gray` in front of the enum changes the flip-flops and the gates and nothing else.

::dcl-playground{src="designs/traffic-light.dcl" top="TrafficLight" n="F.2" tab="run" caption="The British traffic light of Chapter 19. Hold tick at 1 and press Step clock. Then put @onehot in front of the enum and open the Circuit tab: two flip-flops become four, and the outputs get simpler."}

### Instances, generics and loops

An instance connects every input of a module, by name. Clock inputs are connected to a clock input of the enclosing module: a clock cannot be computed, so a gated clock cannot be written (use an enable, which is a mux in front of the register). Outputs of instances are read as `name.port` and are ordinary wires.

Loops are unrolled: `for i in 0..8 { … }` is eight copies, and `i` is a compile-time integer in each. A loop may declare `let`s, `reg`s, `inst`s and `next`s; the copies are named after the iteration (`t#2`). A design may unroll at most 65,536 copies in all (`loop-too-long`).

A function, `fn`, is a pure combinational expression, inlined wherever it is called. Its generics are inferred from the widths of its arguments, from parameters of type `bits<G>` or `signed<G>`. A function cannot call itself.

```dcl
module Fold<W: int>(clk: clock, d: bits<W>) -> (q: bits<W>) {
  reg r: bits<W> = 0
  next r = r ^ d
  q = r
}

fn parity<W: int>(x: bits<W>) -> bit {
  count_ones(x)[0]
}

module Chain(clk: clock, d: bits<4>) -> (q: bits<4>, odd: bit) {
  inst f: Fold<4>(clk: clk, d: d)
  q = f.q
  odd = parity(f.q)
}

test "an instance, a function and a generic" {
  let c = sim Chain(d: 0b0101)
  step
  expect c.q == 0b0101 && !c.odd
  c.d = 1
  step
  expect c.q == 0b0100 && c.odd
}
```

## Memories

`mem name: [T; N]` declares a memory of N words of type T, with a **synchronous** read and write, like the block RAM of an FPGA. Initial contents are optional (`= [1, 2, 4, 8]`; the default is zero).

- `name.read(addr)` returns the word at `addr` **one clock cycle later**. The address is a `bits<⌈log₂ N⌉>`. A memory has at most two read ports (a third `read` is `too-many-reads`); reading into a `let` and reusing it costs nothing.
- `name.write(addr, data, enable)` stores `data` at the next edge when `enable` is 1. A memory has at most one write port (`too-many-writes`).
- In a cycle where a word is both read and written, the read gets the *old* value.
- Out-of-range reads give 0 and out-of-range writes are ignored (when N is not a power of two). That is what the RTL simulator does; the FPGA flow does not force reads beyond the depth to 0, so do not rely on it.
- A memory belongs to a clock like a register does: `mem m: [T; N] on other_clk` when the module has several.

```dcl
module Rom(clk: clock, addr: bits<3>) -> (data: bits<8>) {
  mem table: [bits<8>; 8] = [1, 2, 4, 8, 16, 32, 64, 128]
  data = table.read(addr)
}

module Ram(clk: clock, addr: bits<4>, din: bits<8>, we: bit) -> (dout: bits<8>) {
  mem store: [bits<8>; 16]
  store.write(addr, din, we)
  dout = store.read(addr)
}

test "the ROM answers one cycle after the address" {
  let r = sim Rom(addr: 3)
  expect r.data == 0
  step
  expect r.data == 8
  r.addr = 5
  expect r.data == 8
  step
  expect r.data == 32
}

test "the RAM reads the old word in the cycle it is written" {
  let m = sim Ram(addr: 2, din: 99, we: 1)
  step
  expect m.dout == 0
  m.we = 0
  step
  expect m.dout == 99
}
```

::snippet-playground{id="memory" n="F.3" tab="tests" caption="A register file with two read ports and one write port. Press Run tests: the second test shows that a read in the cycle of a write sees the old word. Change its last expectation to 33 and read the failure and the waveform."}

## Clocks and clock domains

- A module with registers or memories must have a `clock` input. With exactly one, everything uses it.
- With several, each register or memory names its clock: `reg x: bit = 0 on other_clk`. Leaving it out is an error (`clock-misuse`) that lists the clocks.
- A clock passes through ports only. It cannot be read, compared, stored, used in a `let`, output, or given to a function.
- **A register clocked by one clock cannot read a register clocked by another** (`clock-domain`): the value could change just before the edge and make the flip-flop metastable. The only way across is the standard library’s `Synchronizer`, one bit at a time.

```dcl
module Cross(fast: clock, slow: clock, pulse: bit) -> (seen: bit) {
  reg flag: bit = 0 on fast
  next flag = pulse
  inst sync: Synchronizer(clk: slow, d: flag)
  seen = sync.q
}

test "a flag crosses from the fast domain to the slow one" {
  let x = sim Cross(pulse: 1)
  step on fast
  expect x.seen == 0
  step 2 on slow
  expect x.seen == 1
}
```

## The top module and the virtual board

One module per file can be marked `top`. It is the module that goes onto the virtual board, and its ports are bound to the board **by name and type**: nothing is wired by hand. A port whose name is a board resource but whose direction or width is wrong is an error, so a typo cannot silently leave a switch unconnected. Any other port is *free*: an input gets a switch of its own, an output an LED.

| Port | Direction | Type | Board resource |
|---|---|---|---|
| `clk` | in | `clock` | the board’s clock |
| `rst` or `reset` | in | `bit` | the reset button (active high) |
| `btn` | in | `bits<4>` | the four push buttons |
| `sw` | in | `bits<8>` | the eight switches |
| `led` | out | `bits<8>` | the eight LEDs |
| `seg0` to `seg3` | out | `bits<7>` or `bits<8>` | the segments of digit 0 (right) to digit 3 (left); bit 0 is segment a, bit 6 is g, bit 7 the dot |
| `seg` with `an` | out | `bits<7>` or `bits<8>`, and `bits<4>` | one shared set of segments and a digit select: digit i shows `seg` while bit i of `an` is 1 |

Appendix G describes the board. A `top` module cannot have generics, and the file can have only one.

```dcl
top module Blinky(clk: clock, btn: bits<4>, sw: bits<8>) -> (led: bits<8>) {
  reg count: bits<24> = 0

  next count = count + 1
  led = if btn[0] { sw } else { count[23:16] }
}

test "a button shows the switches, otherwise the top of a counter" {
  let b = sim Blinky(btn: 0, sw: 5)
  step 3
  expect b.led == 0
  b.btn = 1
  expect b.led == 5
}
```

## Tests

A `test "name" { … }` block is the only place where code runs in order. It drives a simulated instance of a module on the RTL simulator, and tests are never part of a design: they are compiled for simulation only.

| Statement | Meaning |
|---|---|
| `let x = sim M<args>(port: value, …)` | Create an instance with initial input values. Clock inputs are not connected: `step` drives them. Inputs left out are 0. |
| `x.port = value` | Change an input. The outputs settle at once. |
| `x.port` | Read an output or an input, in any expression. |
| `step`, `step n` | Pulse every clock of every simulated instance, once or n times. |
| `step on clk`, `step n on clk` | Pulse only that clock. |
| `expect condition` | Check a `bit`. A failure does not stop the test. |
| `print a, "text", b` | Write a line: values are shown in decimal (enums by name, wide vectors with their hexadecimal value), strings as they are. |
| `let n: T = value`, `n = value` | A test variable, which holds a run-time integer or vector. |
| `for i in a..b { … }` | A loop that really loops. `i` is a run-time integer. |
| `random(bits<N>)` | A seeded random value. |

- A failing `expect` is reported with its source line, the values of every signal it reads, and a waveform: every port of the instance for four cycles before the failure and three after.
- The random generator is seeded (with 1 by default), and each test has its own stream, so a run is reproducible and adding a test does not change the others.
- A test stops after 10,000,000 clock cycles, and reports at most ten failures.
- A test with an error is *skipped*, not passed: the runner says which error stopped it.

Exercises in the course are checked by hidden tests of this kind, plus an equivalence check against a reference design.

## The standard library

Any module below can be instantiated without declaring it. Each file has its own tests.

| Module | Generics | Inputs | Outputs | Behaviour |
|---|---|---|---|---|
| `Synchronizer` | none | `clk`, `d: bit` | `q: bit` | Two flip-flops in a row; `q` follows `d` two cycles later. The way to bring a signal from another clock, or from outside the chip, into a domain. One bit at a time. |
| `Debouncer` | `STABLE_CYCLES` | `clk`, `raw: bit` | `clean: bit` | Synchronises `raw`, then changes `clean` only after `raw` has held its new value for `STABLE_CYCLES` cycles in a row. |
| `EdgeDetect` | none | `clk`, `d: bit` | `rise`, `fall: bit` | One-cycle pulses when `d` goes 0 to 1 and 1 to 0. `d` must already be synchronous. |
| `Fifo` | `WIDTH`, `DEPTH` | `clk`, `push`, `data_in: bits<WIDTH>`, `pop` | `data_out`, `empty`, `full`, `count: bits<clog2(DEPTH + 1)>` | A queue of `DEPTH` ≥ 2 words held in registers. The oldest word is always on `data_out`. A push and a pop can happen in one cycle; a push when full and a pop when empty are ignored. |
| `SevenSeg` | none | `value: bits<4>` | `segments: bits<7>` | Hexadecimal digit to seven-segment pattern; bit 0 is segment a, bit 6 is g, a 1 lights the segment. |
| `UartTx` | `CLKS_PER_BIT` ≥ 2 | `clk`, `start: bit`, `data: bits<8>` | `tx`, `busy: bit` | 8N1 serial transmitter, least significant bit first. A pulse on `start` while not `busy` sends `data`. The line idles high. |
| `UartRx` | `CLKS_PER_BIT` ≥ 2 | `clk`, `rx: bit` | `data: bits<8>`, `valid: bit` | Receiver for the same format. Synchronises the line, samples in the middle of each bit; `valid` pulses for a cycle when a byte with a good stop bit arrives. |

::snippet-playground{id="std-debounce" n="F.4" tab="tests" caption="A button through the Debouncer and the EdgeDetect. Run the tests, then change the 4 in Debouncer<4> to 30 and run them again: the first test fails, because the press is not steady for long enough within its twenty cycles."}

## What each construct becomes

Elaboration turns every checked expression into a word-level **RTL cell**, tagged with its source span and hierarchical path. The RTL simulator runs the cells; the lowering to gates expands them into the course’s own gates, flip-flops and multiplexers, which the digital engine and the bench also run. The abstraction dial works on the result.

| RTL cell | Made by | Becomes, for N bits |
|---|---|---|
| `and` `or` `xor` `not` | `&` `\|` `^` `~`, `!`, `&&`, `\|\|` | one gate per bit |
| `add` `sub` `neg` | `+`, `-`, unary `-` | ripple-carry full adders, five gates per bit (XOR, XOR, AND, AND, OR); a constant operand folds them into half adders or wires; `sub` is a + ¬b + 1 |
| `mul` | `*` | shift-and-add: AND partial products summed by ripple adders (the low N bits) |
| `shl` `shr` | `<<` `>>`, a dynamic bit index | a barrel shifter: ⌈log₂ N⌉ stages of multiplexers, then a row that clears the result for larger amounts; a constant amount is only wiring |
| `eq` `ne` | `==` `!=` | XNOR (XOR) per bit, then an AND (OR) tree; against a constant, an AND of literals |
| `lt` `le` `gt` `ge` | `<` `<=` `>` `>=` | a chain from the least significant bit: XOR to see whether the bits differ, then a multiplexer picks the deciding bit |
| `mux` | `if` | one multiplexer per bit |
| `pmux` | every `match`, a dynamic array index | a decoder (an AND of literals per case) and an AND-OR per bit |
| `reduce_and` `reduce_or` `reduce_xor` | `all`, `any`, parity | a tree of gates with at most four inputs (XOR: two) |
| `popcount` | `count_ones` | a counter grown one bit at a time, of half adders |
| `slice` `concat` `repeat` `zext` `sext` | `[hi:lo]`, fields, `concat`, `repeat`, `zext`, `sext`, `trunc` | nothing: they only rename wires |
| `const` | literals, constants | nothing: constants fold into the gates that read them |
| `reg` | `reg` | one flip-flop per bit, with its power-up value |
| `mem` | `mem` | a RAM block of up to 32 bits per read port, and a flip-flop per read-data bit, so that reads are synchronous |

Signals, `let`s and instance boundaries need no hardware of their own: a module is flattened into one netlist whose element names keep the hierarchy (`alu/add4/2.fa.xor1` is the first XOR of the full adder of bit 2 of the adder called `add4` in the instance `alu`).

The cost of the common constructs at eight bits, counted on the netlist the lowering builds (a `mux` is one multiplexer element per bit; every other element is a gate):

| Construct | Example (8 bits) | Elements |
|---|---|---|
| Bitwise and | `y = a & b` | 8 AND gates |
| Bitwise not | `y = ~a` | 8 inverters |
| Adder | `y = a + b` | 13 AND gates, 15 XOR gates, 6 OR gates |
| Subtractor | `y = a - b` | 13 AND gates, 15 XOR gates, 7 OR gates, 9 inverters |
| Add a constant | `y = a + 1` | 6 AND gates, 7 XOR gates, 1 inverter |
| Multiplier | `y = a * b` | 72 AND gates, 49 XOR gates, 15 OR gates |
| Variable shift | `y = a << s` (`s: bits<3>`) | 17 multiplexers, 7 AND gates, 3 inverters |
| Constant shift | `y = a << 3` | nothing |
| Equality | `y = a == b` | 3 AND gates, 8 XNOR gates |
| Equality with a constant | `y = a == 42` | 3 AND gates, 5 inverters |
| Comparison | `y = a < b` | 7 multiplexers, 1 AND gate, 8 XOR gates |
| Two-way choice | `y = if c { a } else { b }` | 8 multiplexers |
| Four-way `match` | `y = match sel { 0 => a, 1 => b, 2 => c, 3 => d }` | 36 AND gates, 8 OR gates, 2 inverters |
| Dynamic index | `y = x[i]` (four 8-bit elements) | 35 AND gates, 9 OR gates, 3 inverters |
| Any bit set | `y = any(a)` | 3 OR gates |
| Ones count | `y = count_ones(a)` | 18 AND gates, 22 XOR gates |
| Register | `reg r: bits<8> = 0` | 8 flip-flops |
| Counter | `next r = r + 1` | 6 AND gates, 7 XOR gates, 1 inverter, 8 flip-flops |
| Memory | `mem m: [bits<8>; 16]` | 1 RAM block, 8 flip-flops |

On an FPGA the same RTL takes a different road. A ripple adder written as full adders (which is what `+` is) is recognised by its *function* and mapped onto the carry chain of a column of logic cells. Registers become the flip-flops of logic cells, folding a hold-value multiplexer into the flip-flop’s clock-enable and a constant-selecting multiplexer into its set/reset. A `mem` becomes block RAM, one per read port. Everything else is mapped to four-input LUTs. Appendix C follows the road; Appendix G lists what is on the chip.

## Every message the checker can give

The compiler reports mistakes in the terms of the hardware, and proposes a fix. A message has a **code** (stable, for tools and for this table), a headline, a **label** on the source line, optional **notes** that give the hardware reason, and **help** that suggests an explicit fix. Here are five you will meet. The text under each is the compiler’s own output, and a test checks that it still is.

```dcl error
module Demo(a: bits<8>, b: bits<4>) -> (y: bits<8>) {
  y = a + b
}
```

```text
error: width mismatch
   ┌─ demo.dcl:2:11
 2 │   y = a + b
   │           ^ bits<4>, expected bits<8>
   = help: extend it explicitly: sext(b, 8) or zext(b, 8)
```

A width mismatch is the most common. The fix is always to say what you mean, `zext`, `sext` or `trunc`. A `match` must cover every value, so a missing arm is an error rather than a latch:

```dcl error
module Alu(f3: bits<3>, a: bits<8>, b: bits<8>) -> (result: bits<8>) {
  result = match f3 {
    0 => a + b,
    1 => a - b,
    2 => a & b,
    3 => a | b,
    4 => a ^ b,
  }
}
```

```text
error: this match does not cover every value of `f3: bits<3>`
   ┌─ demo.dcl:2:12
 2 │   result = match f3 {
   │            ^^^^^ 5, 6 and 7 are missing
   = help: add the missing arms, or `_ => …`
```

A loop with no register in it is a latch, and DCL has no latches. The message walks round the loop:

```dcl error
module Latch(s_n: bit, r_n: bit) -> (q: bit, q_n: bit) {
  let a: bit = !(s_n && b)
  let b: bit = !(r_n && a)
  q = a
  q_n = b
}
```

```text
error: combinational loop
   ┌─ demo.dcl:2:7
 2 │   let a: bit = !(s_n && b)
   │       ^ a → b → a
   = note: a loop without a register holds state without a clock (a latch); use `reg`
```

A register that never says what it holds next, and a value that crosses between clocks:

```dcl error
module Forgetful(clk: clock, d: bit) -> (q: bit) {
  reg r: bit = 0
  q = r
}
```

```text
error: register `r` has no `next` value
   ┌─ demo.dcl:2:7
 2 │   reg r: bit = 0
   │       ^ declared here
   = help: give its value after each clock edge: `next r = …` (to hold it, `next r = r`)
```

```dcl error
module Crossing(fast: clock, slow: clock, d: bit) -> (q: bit) {
  reg a: bit = 0 on fast
  reg b: bit = 0 on slow
  next a = d
  next b = a
  q = b
}
```

```text
error: register `b` is clocked by `slow` but reads a value clocked by `fast`
   ┌─ demo.dcl:5:12
 5 │   next b = a
   │            ^ crosses clock domains
   ├─ demo.dcl:3:7
 3 │   reg b: bit = 0 on slow
   │       ^ clocked by `slow`
   = note: a value from another clock domain can change just before the clock edge and make a flip-flop metastable
   = help: pass it through the standard library's `Synchronizer` (clocked by `slow`) first
```

The table lists every code, in the order in which the compiler works (the lexer and parser, then the checker, then tests). Open a row for the messages of that code, a small design that provokes one, and what the compiler says about it. The messages are extracted from the compiler’s source, and the examples are run when the page is built.

::diagnostics-table{n="F.5"}

A test failure is reported as `expect-failed`, with the values the condition read and a waveform; an error that stops a test (a value that does not fit, more cycles than allowed, a negative `step`) is `test-error`.

## The compiler, in one paragraph

Source text goes through the lexer (which also decides where statements end), the parser (with error recovery, so one run reports every independent mistake), name resolution and type checking of each module *specialisation* (a module with its generic arguments bound; generics are checked once for each use, so every width is a plain number), and elaboration to word-level RTL. From there the RTL simulator (JavaScript generated for the design), the lowering to gates, and the FPGA flow all start from the same cells. Appendix C has the pipeline and the source files.

## Grammar

The grammar as the parser implements it. `?` is optional, `*` repetition, `|` a choice; newlines and `;` between statements are left out.

```text
file        = item*
item        = module | fn | struct | enum | alias | const | test
module      = 'top'? 'module' Name generics? '(' ports ')' ('->' '(' ports ')')? '{' mitem* '}'
generics    = '<' (Name ':' 'int') (',' Name ':' 'int')* ','? '>'
ports       = (Name ':' type) (',' Name ':' type)* ','?
fn          = 'fn' Name generics? '(' ports ')' '->' type '{' expr '}'
struct      = 'struct' Name '{' (Name ':' type) (','? Name ':' type)* ','? '}'
enum        = ('@' ('binary' | 'onehot' | 'gray'))? 'enum' Name '{' Name (','? Name)* ','? '}'
alias       = 'type' Name '=' type
const       = 'const' Name (':' type)? '=' expr
type        = Name ('<' expr (',' expr)* '>')? | '[' type ';' expr ']'
mitem       = 'let' Name (':' type)? '=' expr
            | 'const' Name (':' type)? '=' expr
            | 'reg' Name ':' type '=' expr ('on' Name)?
            | 'mem' Name ':' type ('=' expr)? ('on' Name)?
            | 'next' Name ('[' expr ']')? '=' expr
            | 'inst' Name ':' Name generic-args? '(' (Name ':' expr),* ')'
            | Name '=' expr
            | Name '.' 'write' '(' expr ',' expr ',' expr ')'
            | 'for' Name 'in' expr '..' expr '{' mitem* '}'
test        = 'test' String '{' tstmt* '}'
tstmt       = 'let' Name (':' type)? '=' (expr | 'sim' Name generic-args? '(' (Name ':' expr),* ')')
            | expr '=' expr
            | 'step' expr? ('on' Name)?
            | 'expect' expr
            | 'print' expr (',' expr)*
            | 'for' Name 'in' expr '..' expr '{' tstmt* '}'
expr        = unary (binop unary)*                       precedence as in the table of operators
unary       = ('!' | '~' | '-')* postfix
postfix     = primary ( '.' Name | '.' Name '(' args ')' | '[' expr ']' | '[' expr ':' expr ']' )*
primary     = Number | String | Name | Name '(' args ')' | Name '{' (Name ':' expr),* '}'
            | 'bits' '<' expr '>' '(' expr ')' | 'signed' '<' expr '>' '(' expr ')'
            | '(' expr ')' | '{' expr '}' | '[' args ']' | '[' expr ';' expr ']'
            | 'if' expr '{' expr '}' 'else' ('{' expr '}' | if-expr)
            | 'match' expr '{' (pattern ('|' pattern)* '=>' expr ','?)* '}'
pattern     = expr | '_'
```

Two details the grammar hides. A struct literal `Pixel { r: 1 }` is only recognised when the name starts with a capital letter and the brace is on the same line, so that `if x { … }` is not read as a struct. And in an `if`, `for` or `match` head, a struct literal is not allowed, for the same reason: wrap it in parentheses.

## The formatter

There is one style, used for every code block in the course and applied when you save in the editor. It never changes the meaning of a program (formatting twice gives the same text, and the tree is unchanged), and it keeps comments.

- Two-space indentation, no semicolons (statements sharing a line are split), lines of at most 100 columns.
- A list (ports, connections, arguments, match arms, fields) stays on one line if it fits and was written on one line; otherwise each element gets its own line with a trailing comma.
- A long chain of operators breaks *before* the operator, which continues the statement.
- `} else {` on one line. Blank lines are kept, at most one in a row, and top-level items are separated by one.

## Coming from Verilog or VHDL

| Verilog | DCL |
|---|---|
| `assign y = a & b;` | `y = a & b` |
| `wire [7:0] w = a + b;` | `let w: bits<8> = a + b` |
| `reg [7:0] r; always @(posedge clk) r <= d;` | `reg r: bits<8> = 0` and `next r = d` |
| `always @* case (s) … endcase` | `match s { … }` |
| `always @(posedge clk) if (en) r <= d;` | `next r = if en { d } else { r }` |
| `parameter W = 8` | `<W: int>` |
| `generate for` | `for i in 0..W { … }` |
| `initial r = 0;` | the `= 0` in `reg r: bits<8> = 0` |
| `$display` in a testbench | `print` in a `test` |
| `wire [15:0] y = a * b;` (widens silently) | `let y: bits<16> = zext(a, 16) * zext(b, 16)` |
| a latch from an incomplete `if` | not expressible: `if` needs `else`, and a loop needs a `reg` |

The differences that matter are in the last three rows. Where Verilog lets a width mismatch or a missing branch through and leaves synthesis to sort it out, DCL refuses to compile it. There is one semantics for simulation and for hardware, so the two cannot disagree.
