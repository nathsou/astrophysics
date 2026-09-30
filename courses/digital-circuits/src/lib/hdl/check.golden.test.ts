import { describe, expect, it } from 'vitest';
import { check } from './check';
import { renderDiagnostic } from './diagnostics';

/** Every diagnostic of a source, rendered as in HDL.md, *Diagnostics*. */
function diag(src: string): string {
  const { diagnostics } = check(src, { file: 'test.dcl' });
  return '\n' + diagnostics.map((d) => renderDiagnostic(src, d)).join('\n\n') + '\n';
}

describe('golden diagnostics', () => {
  it('width mismatch (HDL.md example)', () => {
    expect(diag(`module Pc(clk: clock, imm_12: bits<12>) -> (out: bits<32>) {
  reg pc: bits<32> = 0
  let next_pc: bits<32> = pc + imm_12
  next pc = next_pc
  out = pc
}`)).toMatchInlineSnapshot(`
  "
  error: width mismatch
     ┌─ test.dcl:3:32
   3 │   let next_pc: bits<32> = pc + imm_12
     │                                ^^^^^^ bits<12>, expected bits<32>
     = help: extend it explicitly: sext(imm_12, 32) or zext(imm_12, 32)
  "
`);
  });

  it('non-exhaustive match (HDL.md example)', () => {
    expect(diag(`module Alu(f3: bits<3>) -> (result: bits<8>) {
  result = match f3 {
    0 => 1,
    1 => 2,
    2 => 3,
    3 => 4,
    4 => 5,
  }
}`)).toMatchInlineSnapshot(`
  "
  error: this match does not cover every value of \`f3: bits<3>\`
     ┌─ test.dcl:2:12
   2 │   result = match f3 {
     │            ^^^^^ 5, 6 and 7 are missing
     = help: add the missing arms, or \`_ => …\`
  "
`);
  });

  it('combinational loop (HDL.md example)', () => {
    expect(diag(`module Latch(s: bit, r: bit) -> (out: bit) {
  let q: bit = !(s && q_n)
  let q_n: bit = !(r && q)
  out = q
}`)).toMatchInlineSnapshot(`
  "
  error: combinational loop
     ┌─ test.dcl:2:7
   2 │   let q: bit = !(s && q_n)
     │       ^ q → q_n → q
     = note: a loop without a register holds state without a clock (a latch); use \`reg\`
  "
`);
  });

  it('literal without context', () => {
    expect(diag(`module M(a: bits<4>) -> (y: bits<8>, z: bit) {
  y = concat(1, a)
  z = 3 == 3
}`)).toMatchInlineSnapshot(`
  "
  error: this literal has no type
     ┌─ test.dcl:2:14
   2 │   y = concat(1, a)
     │              ^ its width cannot be inferred from the context
     = help: give it a type: \`bits<N>(value)\`, or declare a \`const\` with a type

  error: this literal has no type
     ┌─ test.dcl:3:7
   3 │   z = 3 == 3
     │       ^ its width cannot be inferred from the context
     = help: give one side a type: \`bits<N>(value)\`, or compare with a typed signal
  "
`);
  });

  it('literal too wide', () => {
    expect(diag(`module M() -> (y: bits<4>) {
  y = 16
}`)).toMatchInlineSnapshot(`
  "
  error: literal does not fit \`bits<4>\`
     ┌─ test.dcl:2:7
   2 │   y = 16
     │       ^^ 16 needs 5 bits
     = help: use a wider type, or a value below 16
  "
`);
  });

  it('&&, || and ! apply only to bit', () => {
    expect(diag(`module M(a: bits<4>, b: bit) -> (y: bit, z: bit) {
  y = a && b
  z = !a
}`)).toMatchInlineSnapshot(`
  "
  error: \`&&\` needs \`bit\` operands
     ┌─ test.dcl:2:7
   2 │   y = a && b
     │       ^ bits<4>
     = help: compare explicitly (\`a != 0\`), or use \`&\` for a bitwise operation

  error: \`!\` needs \`bit\` operands
     ┌─ test.dcl:3:8
   3 │   z = !a
     │        ^ bits<4>
     = help: use \`~\` for a bitwise not, or compare explicitly: \`a == 0\`
  "
`);
  });

  it('comparisons return bit', () => {
    expect(diag(`module M(a: bits<4>, b: bits<4>) -> (y: bits<2>) {
  y = a == b
}`)).toMatchInlineSnapshot(`
  "
  error: width mismatch
     ┌─ test.dcl:2:7
   2 │   y = a == b
     │       ^^^^^^ bit, expected bits<2>
     = help: extend it explicitly: zext(a == b, 2)
  "
`);
  });

  it('slices need constant, ordered, in-range bounds', () => {
    expect(diag(`module M(a: bits<8>, i: bits<3>) -> (y: bits<4>, z: bits<2>, w: bit) {
  y = a[9:6]
  z = a[0:1]
  w = a[i:0]
}`)).toMatchInlineSnapshot(`
  "
  error: slice out of range
     ┌─ test.dcl:2:7
   2 │   y = a[9:6]
     │       ^^^^^^ bits<8> has bits 7 to 0

  error: the slice bounds are reversed
     ┌─ test.dcl:3:7
   3 │   z = a[0:1]
     │       ^^^^^^ write [1:0]

  error: a slice bound must be a compile-time constant
     ┌─ test.dcl:4:9
   4 │   w = a[i:0]
     │         ^ this depends on signals
     = help: use literals, generic parameters, \`const\`s and loop variables
  "
`);
  });

  it('dynamic index width', () => {
    expect(diag(`module M(a: [bits<8>; 8], i: bits<4>) -> (y: bits<8>) {
  y = a[i]
}`)).toMatchInlineSnapshot(`
  "
  error: a dynamic index into 8 elements must have type \`bits<3>\`
     ┌─ test.dcl:2:9
   2 │   y = a[i]
     │         ^ bits<4>, expected bits<3>
     = note: a dynamic index becomes a multiplexer with one select line per index bit
     = help: use the low bits: i[2:0]
  "
`);
  });

  it('overlapping match arms and two `_`', () => {
    expect(diag(`module M(x: bits<2>) -> (y: bit) {
  y = match x {
    0 | 1 => 1,
    1 => 0,
    _ => 0,
    _ => 1,
  }
}`)).toMatchInlineSnapshot(`
  "
  error: match arms overlap
     ┌─ test.dcl:4:5
   4 │     1 => 0,
     │     ^ 1 is already matched
     ├─ test.dcl:3:9
   3 │     0 | 1 => 1,
     │         ^ first matched here
     = note: arm order does not matter in a \`match\`, so each value may appear in only one arm

  error: more than one \`_\` arm
     ┌─ test.dcl:6:5
   6 │     _ => 1,
     │     ^^^^^^ second \`_\`
     ├─ test.dcl:5:5
   5 │     _ => 0,
     │     ^^^^^^ first \`_\` here
  "
`);
  });

  it('if needs else', () => {
    expect(diag(`module M(c: bit) -> (y: bit) {
  y = if c { 1 }
}`)).toMatchInlineSnapshot(`
  "
  error: \`if\` needs an \`else\`
     ┌─ test.dcl:2:7
   2 │   y = if c { 1 }
     │       ^^ this \`if\` has no \`else\` branch
     = help: hardware always produces a value: add \`else { … }\` (to keep a register, write its current value)
  "
`);
  });

  it('outputs are assigned exactly once', () => {
    expect(diag(`module M(a: bit) -> (y: bit, z: bit) {
  y = a
  y = !a
}`)).toMatchInlineSnapshot(`
  "
  error: output \`z\` is never assigned
     ┌─ test.dcl:1:30
   1 │ module M(a: bit) -> (y: bit, z: bit) {
     │                              ^ declared here
     = help: assign it once in the module body: \`z = …\`

  error: output \`y\` is assigned twice
     ┌─ test.dcl:3:3
   3 │   y = !a
     │   ^ second assignment
     ├─ test.dcl:2:3
   2 │   y = a
     │   ^ first assigned here
     = note: an output is driven by exactly one piece of logic
     = help: combine the two values with \`if\` or \`match\` in a single assignment
  "
`);
  });

  it('registers need exactly one next, per element for arrays', () => {
    expect(diag(`module M(clk: clock, a: bit) -> (y: bit) {
  reg r: bit = 0
  reg s: bit = 0
  next s = a
  next s = !a
  reg arr: [bit; 8] = [0; 8]
  for i in 0..6 {
    next arr[i] = a
  }
  next arr[0] = a
  y = r
}`)).toMatchInlineSnapshot(`
  "
  error: register \`r\` has no \`next\` value
     ┌─ test.dcl:2:7
   2 │   reg r: bit = 0
     │       ^ declared here
     = help: give its value after each clock edge: \`next r = …\` (to hold it, \`next r = r\`)

  error: register \`s\` has more than one \`next\`
     ┌─ test.dcl:5:8
   5 │   next s = !a
     │        ^ another \`next\`
     ├─ test.dcl:4:8
   4 │   next s = a
     │        ^ first \`next\` here
     = note: a register has exactly one next value; an array register can instead have one per element

  error: not every element of register \`arr\` has a \`next\`
     ┌─ test.dcl:6:7
   6 │   reg arr: [bit; 8] = [0; 8]
     │       ^^^ elements 6 and 7 have no \`next\`
     = help: add \`next arr[i] = …\` for the missing elements (\`next arr[i] = arr[i]\` holds one)

  error: element 0 of register \`arr\` has more than one \`next\`
     ┌─ test.dcl:10:8
  10 │   next arr[0] = a
     │        ^^^^^^ another \`next\`
     ├─ test.dcl:8:10
   8 │     next arr[i] = a
     │          ^^^^^^ first \`next\` for this element
  "
`);
  });

  it('clock rules', () => {
    expect(diag(`module A(a: bit) -> (y: bit) {
  reg r: bit = 0
  next r = a
  y = r
}
module B(clk: clock, en: bit) -> (y: bit, c: clock) {
  y = clk
}
module C(clk: clock, en: bit) -> (y: bit) {
  inst b: B(clk: clk && en, en: en)
  y = b.y
}
module D(c1: clock, c2: clock, a: bit) -> (y: bit) {
  reg r: bit = 0
  reg s: bit = 0 on c2
  next r = a
  next s = r
  y = s
}`)).toMatchInlineSnapshot(`
  "
  error: register \`r\` needs a clock, but this module has no clock input
     ┌─ test.dcl:2:7
   2 │   reg r: bit = 0
     │       ^
     = note: a module with registers or memories must have exactly one \`clock\` input
     = help: add an input \`clk: clock\`

  error: an output cannot be a clock
     ┌─ test.dcl:6:46
   6 │ module B(clk: clock, en: bit) -> (y: bit, c: clock) {
     │                                              ^^^^^
     = note: clocks come into a design through its inputs; a generated clock would be a gated clock
     = help: output an enable signal instead

  error: a clock cannot be used as data
     ┌─ test.dcl:7:7
   7 │   y = clk
     │       ^^^ this is a clock
     = note: clocks can only be passed through ports, so a gated clock is impossible to write
     = help: use an enable signal instead

  error: the clock \`clk\` must be connected to a clock input
     ┌─ test.dcl:10:18
  10 │   inst b: B(clk: clk && en, en: en)
     │                  ^^^^^^^^^ not a clock input of this module
     = note: clocks cannot be computed, so a gated clock is impossible; use an enable signal instead

  error: this module has several clocks, so register \`r\` must say which one clocks it
     ┌─ test.dcl:14:7
  14 │   reg r: bit = 0
     │       ^
     = help: add \`on c1\` (the clocks are \`c1\`, \`c2\`)

  error: register \`s\` is clocked by \`c2\` but reads a value clocked by \`c1\`
     ┌─ test.dcl:17:12
  17 │   next s = r
     │            ^ crosses clock domains
     ├─ test.dcl:15:7
  15 │   reg s: bit = 0 on c2
     │       ^ clocked by \`c2\`
     = note: a value from another clock domain can change just before the clock edge and make a flip-flop metastable
     = help: pass it through the standard library's \`Synchronizer\` (clocked by \`c2\`) first
  "
`);
  });

  it('instance connections', () => {
    expect(diag(`module Add(a: bits<4>, b: bits<4>) -> (s: bits<4>) {
  s = a + b
}
module M(x: bits<4>) -> (y: bits<4>) {
  inst u: Add(a: x, a: x, c: x)
  y = u.sum
}`)).toMatchInlineSnapshot(`
  "
  error: input \`b\` is not connected
     ┌─ test.dcl:5:8
   5 │   inst u: Add(a: x, a: x, c: x)
     │        ^ instance of \`Add\`
     = help: connect every input: \`b: …\`

  error: input \`a\` is connected twice
     ┌─ test.dcl:5:21
   5 │   inst u: Add(a: x, a: x, c: x)
     │                     ^
     ├─ test.dcl:5:15
   5 │   inst u: Add(a: x, a: x, c: x)
     │               ^ first connected here

  error: \`Add\` has no input \`c\`
     ┌─ test.dcl:5:27
   5 │   inst u: Add(a: x, a: x, c: x)
     │                           ^
     = help: did you mean \`a\`?

  error: \`Add\` has no output \`sum\`
     ┌─ test.dcl:6:9
   6 │   y = u.sum
     │         ^^^
  "
`);
  });

  it('names, outputs and inputs', () => {
    expect(diag(`module M(input_value: bits<4>) -> (y: bits<4>, z: bits<4>) {
  y = input_valu
  z = y
  input_value = 3
}`)).toMatchInlineSnapshot(`
  "
  error: unknown name \`input_valu\`
     ┌─ test.dcl:2:7
   2 │   y = input_valu
     │       ^^^^^^^^^^ not declared
     = help: did you mean \`input_value\`?

  error: cannot read the output \`y\`
     ┌─ test.dcl:3:7
   3 │   z = y
     │       ^ outputs are write-only inside the module
     = help: compute the value in a \`let\` and assign both: \`let v = …\` then \`y = v\`

  error: cannot assign to \`input_value\`: it is an input
     ┌─ test.dcl:4:3
   4 │   input_value = 3
     │   ^^^^^^^^^^^
     = help: inputs are read-only
  "
`);
  });

  it('conditions must be bit', () => {
    expect(diag(`module M(a: bits<4>) -> (y: bit) {
  y = if a { 1 } else { 0 }
}`)).toMatchInlineSnapshot(`
  "
  error: a condition must be a \`bit\`
     ┌─ test.dcl:2:10
   2 │   y = if a { 1 } else { 0 }
     │          ^ bits<4>
     = help: compare it explicitly, for example \`a != 0\`
  "
`);
  });

  it('enums only have ==, != and match', () => {
    expect(diag(`enum E { A, B, C }
module M(e: E) -> (y: E, z: bit) {
  y = e + E.B
  z = e < E.C
}`)).toMatchInlineSnapshot(`
  "
  error: \`+\` needs bits operands
     ┌─ test.dcl:3:7
   3 │   y = e + E.B
     │       ^ E
     = help: only \`==\`, \`!=\` and \`match\` apply to enums

  error: \`<\` does not apply to enums
     ┌─ test.dcl:4:9
   4 │   z = e < E.C
     │         ^
     = help: only \`==\`, \`!=\` and \`match\` apply to enums
  "
`);
  });

  it('signed and unsigned do not mix', () => {
    expect(diag(`module M(a: signed<8>, b: bits<8>) -> (y: bits<8>) {
  y = a + b
}`)).toMatchInlineSnapshot(`
  "
  error: type mismatch
     ┌─ test.dcl:2:7
   2 │   y = a + b
     │       ^ signed<8>, expected bits<8>
     = help: convert it explicitly: bits(a)
  "
`);
  });

  it('memory ports', () => {
    expect(diag(`module M(clk: clock, a: bits<4>) -> (y: bits<8>) {
  mem m: [bits<8>; 16]
  let r0: bits<8> = m.read(a)
  let r1: bits<8> = m.read(a + 1)
  let r2: bits<8> = m.read(a + 2)
  m.write(a, r0, 1)
  m.write(a, r1, 1)
  y = r0 ^ r1 ^ r2
}`)).toMatchInlineSnapshot(`
  "
  error: memory \`m\` has at most two read ports
     ┌─ test.dcl:5:21
   5 │   let r2: bits<8> = m.read(a + 2)
     │                     ^^^^^^^^^^^^^ third read
     ├─ test.dcl:3:21
   3 │   let r0: bits<8> = m.read(a)
     │                     ^^^^^^^^^ read port 0
     ├─ test.dcl:4:21
   4 │   let r1: bits<8> = m.read(a + 1)
     │                     ^^^^^^^^^^^^^ read port 1
     = help: read into a \`let\` once and reuse the value

  error: memory \`m\` can have only one write port
     ┌─ test.dcl:7:3
   7 │   m.write(a, r1, 1)
     │   ^^^^^^^^^^^^^^^^^ second write
     ├─ test.dcl:6:3
   6 │   m.write(a, r0, 1)
     │   ^^^^^^^^^^^^^^^^^ first write here
     = help: combine the writes with \`if\` into a single \`write\`
  "
`);
  });

  it('generic arguments', () => {
    expect(diag(`module G<N: int>(a: bits<N>) -> (y: bits<N>) {
  y = a
}
module M(a: bits<4>) -> (y: bits<4>) {
  inst g: G(a: a)
  inst h: G<a>(a: a)
  y = g.y
}`)).toMatchInlineSnapshot(`
  "
  error: \`G\` takes 1 generic argument
     ┌─ test.dcl:5:11
   5 │   inst g: G(a: a)
     │           ^ 0 given
     = help: write \`G<N>(…)\`

  error: a generic argument must be a compile-time constant
     ┌─ test.dcl:6:13
   6 │   inst h: G<a>(a: a)
     │             ^ this depends on signals
     = help: use literals, generic parameters, \`const\`s and loop variables
  "
`);
  });

  it('recursive modules and functions', () => {
    expect(diag(`module R(a: bit) -> (y: bit) {
  inst r: R(a: a)
  y = r.y
}
fn f(x: bit) -> bit { f(x) }
module M(a: bit) -> (y: bit) {
  y = f(a)
}`)).toMatchInlineSnapshot(`
  "
  error: module \`R\` contains itself
     ┌─ test.dcl:2:11
   2 │   inst r: R(a: a)
     │           ^ recursive instance
     = note: hardware is finite: a module cannot contain an instance of itself

  error: function \`f\` calls itself
     ┌─ test.dcl:5:23
   5 │ fn f(x: bit) -> bit { f(x) }
     │                       ^ recursive call
     = note: functions are inlined into hardware, so they cannot be recursive
  "
`);
  });

  it('naming conventions (warnings)', () => {
    expect(diag(`module my_module(InPort: bit) -> (y: bit) {
  const small: int = 3
  let BadName: bit = InPort
  y = BadName
}`)).toMatchInlineSnapshot(`
  "
  warning: module \`my_module\` should be PascalCase
     ┌─ test.dcl:1:8
   1 │ module my_module(InPort: bit) -> (y: bit) {
     │        ^^^^^^^^^
     = help: rename it to \`MyModule\`

  warning: port \`InPort\` should be snake_case
     ┌─ test.dcl:1:18
   1 │ module my_module(InPort: bit) -> (y: bit) {
     │                  ^^^^^^
     = help: rename it to \`in_port\`

  warning: constant \`small\` should be SCREAMING_CASE
     ┌─ test.dcl:2:9
   2 │   const small: int = 3
     │         ^^^^^
     = help: rename it to \`SMALL\`

  warning: let \`BadName\` should be snake_case
     ┌─ test.dcl:3:7
   3 │   let BadName: bit = InPort
     │       ^^^^^^^
     = help: rename it to \`bad_name\`
  "
`);
  });

  it('loop bounds are constants', () => {
    expect(diag(`module M(n: bits<4>) -> (y: bit) {
  for i in 0..n {
    let t: bit = 1
  }
  y = 0
}`)).toMatchInlineSnapshot(`
  "
  error: a loop bound must be a compile-time constant
     ┌─ test.dcl:2:15
   2 │   for i in 0..n {
     │               ^ this depends on signals
     = help: use literals, generic parameters, \`const\`s and loop variables
  "
`);
  });

  it('syntax errors are reported with the rest', () => {
    expect(diag(`module M(a: bit -> (y: bit) {
  let = a
  y = a +
}
module N() -> (y: bit) {
  y = 1 2
}`)).toMatchInlineSnapshot(`
  "
  error: expected \`,\` or \`)\` in the port list, found \`->\`
     ┌─ test.dcl:1:17
   1 │ module M(a: bit -> (y: bit) {
     │                 ^^

  error: expected a name, found \`=\`
     ┌─ test.dcl:2:7
   2 │   let = a
     │       ^ expected a name

  error: expected an expression, found \`}\`
     ┌─ test.dcl:4:1
   4 │ }
     │ ^ expected an expression

  error: expected the end of the statement, found number \`2\`
     ┌─ test.dcl:6:9
   6 │   y = 1 2
     │         ^ expected a new line or \`;\` before this
     = help: put each statement on its own line, or separate them with \`;\`
  "
`);
  });

  it('shift, unary and conversion operands', () => {
    expect(diag(`enum E { A, B }
module M(e: E, a: bits<8>, s: signed<8>) -> (x: E, y: bits<8>, z: bits<4>) {
  x = ~e
  y = a << s
  z = bits(s)
}`)).toMatchInlineSnapshot(`
  "
  error: \`~\` needs a bits operand
     ┌─ test.dcl:3:8
   3 │   x = ~e
     │        ^ E

  error: a shift amount must be unsigned
     ┌─ test.dcl:4:12
   4 │   y = a << s
     │            ^ signed<8>
     = help: convert it explicitly: bits(s)

  error: width mismatch
     ┌─ test.dcl:5:7
   5 │   z = bits(s)
     │       ^^^^^^^ bits<8>, expected bits<4>
     = help: truncate it explicitly: trunc(bits(s), 4) or bits(s)[3:0]
  "
`);
  });

  it('a literal that needs a type, with the typed-literal fix', () => {
    expect(diag(`module M(a: bits<4>) -> (y: bits<16>) {
  let wide = 0
  y = concat(a, 0xfff)
}`)).toMatchInlineSnapshot(`
  "
  error: this literal has no type
     ┌─ test.dcl:2:14
   2 │   let wide = 0
     │              ^ its width cannot be inferred from the context
     = help: give it a type: \`let wide: bits<N> = …\`, or use \`const\`

  error: this literal has no type
     ┌─ test.dcl:3:17
   3 │   y = concat(a, 0xfff)
     │                 ^^^^^ its width cannot be inferred from the context
     = help: give it a type: \`bits<N>(value)\`, or declare a \`const\` with a type
  "
`);
  });

  it('types and names that do not exist', () => {
    expect(diag(`struct P { x: bits<4> }
module M(p: P, a: Bitz<4>) -> (y: bits<4>) {
  y = p.z + Q.X
}`)).toMatchInlineSnapshot(`
  "
  error: unknown type \`Bitz\`
     ┌─ test.dcl:2:19
   2 │ module M(p: P, a: Bitz<4>) -> (y: bits<4>) {
     │                   ^^^^
     = help: did you mean \`bit\`?

  error: \`P\` has no field \`z\`
     ┌─ test.dcl:3:9
   3 │   y = p.z + Q.X
     │         ^
     = help: did you mean \`x\`?

  error: unknown name \`Q\`
     ┌─ test.dcl:3:13
   3 │   y = p.z + Q.X
     │             ^ not declared
     = help: did you mean \`p\`?
  "
`);
  });

  it('clock domain crossing through logic', () => {
    expect(diag(`module M(fast: clock, slow: clock, a: bit) -> (y: bit) {
  reg r: bit = 0 on fast
  let mixed: bit = r && a
  reg t: bit = 0 on slow
  next r = a
  next t = mixed
  y = t
}`)).toMatchInlineSnapshot(`
  "
  error: register \`t\` is clocked by \`slow\` but reads a value clocked by \`fast\`
     ┌─ test.dcl:6:12
   6 │   next t = mixed
     │            ^^^^^ crosses clock domains
     ├─ test.dcl:4:7
   4 │   reg t: bit = 0 on slow
     │       ^ clocked by \`slow\`
     = note: a value from another clock domain can change just before the clock edge and make a flip-flop metastable
     = help: pass it through the standard library's \`Synchronizer\` (clocked by \`slow\`) first
  "
`);
  });
});
