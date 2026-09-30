/**
 * Appendix F's table of diagnostics: for every code the front end can emit, what it means, a small design
 * that provokes it, and the usual fix. The messages themselves are in `diagnostics.gen.ts`, extracted from the
 * compiler's source by `../extract.ts` (a test fails when they drift); the examples are run by the tests and
 * by the table itself.
 */
import { EMITTED } from './diagnostics.gen';

export type Stage = 'Lexer and parser' | 'Declarations and types' | 'Modules and instances' | 'Registers and memories' | 'Clocks and dataflow' | 'Expressions' | 'match' | 'Functions' | 'Tests';

export interface DiagnosticDoc {
  code: string;
  stage: Stage;
  /** What the code means. */
  meaning: string;
  /** A small file that provokes the code (a whole file; for tests, with the test in it). */
  example: string;
  /** How mistakes of this kind are usually fixed. */
  fix: string;
  /** The example is a test to run rather than a design to check. */
  test?: boolean;
  /** Other codes the example legitimately produces too. */
  also?: string[];
  /** Message templates that are not in the checker's source (the test runner's). */
  messages?: string[];
}

export const STAGES: Stage[] = ['Lexer and parser', 'Declarations and types', 'Modules and instances', 'Registers and memories', 'Clocks and dataflow', 'Expressions', 'match', 'Functions', 'Tests'];

const AND2 = `module And2(a: bit, b: bit) -> (y: bit) { y = a & b }\n`;

export const DIAGNOSTICS: DiagnosticDoc[] = [
  {
    code: 'syntax',
    stage: 'Lexer and parser',
    meaning: 'The text is not DCL: a token in the wrong place, a missing bracket, an unfinished comment or string, a bad digit, a chained comparison, an `if` without `else`. The parser reports the error, skips to the end of the statement and carries on, so one run reports every independent mistake.',
    example: `module M(a: bit) -> (y: bit) {\n  y = if a { 1 }\n}\n`,
    fix: 'Follow the message: it says what was expected and, where it can, what to write. A line that starts with an operator continues the line above it.',
  },
  {
    code: 'duplicate',
    stage: 'Declarations and types',
    meaning: 'A name is declared twice in the same scope (an item, a port, a `let`, a field, a variant), or a field is given twice in a struct literal.',
    example: `module M(a: bit) -> (y: bit) {\n  let t: bit = a\n  let t: bit = !a\n  y = t\n}\n`,
    fix: 'Rename one of them. The second label points at the first declaration.',
  },
  {
    code: 'naming',
    stage: 'Declarations and types',
    meaning: 'Warning: a name breaks the convention (snake_case for values and ports, PascalCase for modules and types, SCREAMING_CASE for constants and generics).',
    example: `module counter(A: bit) -> (y: bit) {\n  y = A\n}\n`,
    fix: 'Rename it as the help suggests. The compiler still accepts the file.',
  },
  {
    code: 'multiple-top',
    stage: 'Declarations and types',
    meaning: 'More than one module is marked `top`. Only one module can be bound to the virtual board.',
    example: `top module A(a: bit) -> (y: bit) { y = a }\ntop module B(a: bit) -> (y: bit) { y = a }\n`,
    fix: 'Remove `top` from all but one. A `top` module also cannot have generics: wrap it in a module that fixes them.',
  },
  {
    code: 'recursive-type',
    stage: 'Declarations and types',
    meaning: 'A struct contains itself, directly or through other types. Hardware has a fixed size.',
    example: `struct Node { link: Node, value: bits<8> }\n`,
    fix: 'Use an index (a `bits<N>` into an array) instead of a reference.',
  },
  {
    code: 'empty-type',
    stage: 'Declarations and types',
    meaning: 'A struct with no fields or an enum with no variants.',
    example: `struct Nothing {}\n`,
    fix: 'Add a field or a variant, or delete the type.',
  },
  {
    code: 'unknown-type',
    stage: 'Declarations and types',
    meaning: 'A type name that is not declared: also a struct literal for something that is not a struct. A near miss is suggested.',
    example: `module M(a: Wrod) -> (y: bit) {\n  y = 0\n}\ntype Word = bits<8>\n`,
    fix: 'Declare the type, or fix the spelling.',
  },
  {
    code: 'bad-size',
    stage: 'Declarations and types',
    meaning: 'An array size outside 1 to 65,536, or an array literal with no element.',
    example: `type Table = [bit; 0]\n`,
    fix: 'Give the array at least one element.',
  },
  {
    code: 'bad-width',
    stage: 'Declarations and types',
    meaning: 'A width outside 1 to 65,536, or a `zext`, `sext` or `trunc` that goes the wrong way (`trunc` cannot widen, `zext` and `sext` cannot narrow).',
    example: `type Nothing = bits<0>\n`,
    fix: 'Use a positive width; for the conversions, use the one that goes your way.',
  },
  {
    code: 'bad-type',
    stage: 'Declarations and types',
    meaning: 'A type used where it makes no sense: an `int` as a wire, a port or an array element, a generic that is not `int`, a memory that is not an array, a wrong number of type arguments, a typed literal of something other than `bits` or `signed`.',
    example: `module M(a: bit) -> (y: bit) {\n  let n: int = 4\n  y = a\n}\n`,
    fix: 'Use `const` for a compile-time integer and `bits<N>` for a wire.',
  },
  {
    code: 'recursive-module',
    stage: 'Declarations and types',
    meaning: 'A module instantiates itself, directly or through other modules. Hardware is finite.',
    example: `module M(a: bit) -> (y: bit) {\n  inst m: M(a: a)\n  y = m.y\n}\n`,
    fix: 'Unroll the recursion with a `for` loop over a generic count.',
  },
  {
    code: 'unknown-module',
    stage: 'Declarations and types',
    meaning: 'An instance (or a `sim`) of a module that is neither declared in the file nor in the standard library. A near miss is suggested.',
    example: `module M(a: bit) -> (y: bit) {\n  inst x: Nope(a: a)\n  y = a\n}\n`,
    fix: 'Declare the module, or fix the spelling.',
  },
  {
    code: 'bad-generics',
    stage: 'Declarations and types',
    meaning: 'The wrong number of generic arguments in an instance or `sim`, or generics on a `top` module.',
    example: `module Inv<W: int>(a: bits<W>) -> (y: bits<W>) { y = ~a }\nmodule M(a: bits<4>) -> (y: bits<4>) {\n  inst i: Inv<4, 2>(a: a)\n  y = i.y\n}\n`,
    fix: 'Give exactly the generics the module declares, as the help shows.',
  },
  {
    code: 'cycle',
    stage: 'Declarations and types',
    meaning: 'A constant is defined in terms of itself.',
    example: `const A: int = B\nconst B: int = A\n`,
    fix: 'Break the loop: constants are computed by the compiler, in dependency order.',
  },
  {
    code: 'not-constant',
    stage: 'Declarations and types',
    meaning: 'Something that has to be known when the compiler runs depends on a signal: a width, an array size, a slice bound, a loop bound, a generic argument, a `const`, a register’s power-up value, a memory’s initial contents, a `match` pattern’s value.',
    example: `module M(a: bits<4>) -> (y: bit) {\n  let x: bits<a> = 0\n  y = 0\n}\n`,
    fix: 'Use literals, generics, constants and loop variables; for a value that changes, use a `let` (a wire) instead.',
  },
  {
    code: 'loop-too-long',
    stage: 'Declarations and types',
    meaning: 'The `for` loops of a module unroll into more than 65,536 copies in all. Every iteration becomes hardware.',
    example: `module M() -> (y: bit) {\n  for i in 0..70000 {\n    let t: bit = 0\n  }\n  y = 0\n}\n`,
    fix: 'Use a smaller range, or a register that walks through the values in time instead of space.',
  },
  {
    code: 'unassigned-output',
    stage: 'Modules and instances',
    meaning: 'An output is never assigned.',
    example: `module M(a: bit) -> (y: bit) {\n}\n`,
    fix: 'Assign it once in the body: `y = …`.',
  },
  {
    code: 'double-assignment',
    stage: 'Modules and instances',
    meaning: 'An output is assigned twice. An output is driven by exactly one piece of logic.',
    example: `module M(a: bit) -> (y: bit) {\n  y = a\n  y = !a\n}\n`,
    fix: 'Combine the two values with `if` or `match` in a single assignment.',
  },
  {
    code: 'bad-assignment',
    stage: 'Modules and instances',
    meaning: 'An assignment to something that is not an output (an input, a `let`, a register), or, in a test, to something that is not an input of a simulated instance or a test variable.',
    example: `module M(a: bit) -> (y: bit) {\n  a = 1\n  y = a\n}\n`,
    fix: 'Inputs are read-only, a `let` gets its value where it is declared, and a register changes with `next`.',
  },
  {
    code: 'read-output',
    stage: 'Modules and instances',
    meaning: 'An output is read inside the module. Outputs are write-only.',
    example: `module M(a: bit) -> (y: bit, z: bit) {\n  y = a\n  z = !y\n}\n`,
    fix: 'Compute the value in a `let`, and assign both the output and what needs it.',
  },
  {
    code: 'unconnected-input',
    stage: 'Modules and instances',
    meaning: 'An instance leaves an input of the child unconnected.',
    example: `${AND2}module M(a: bit) -> (y: bit) {\n  inst g: And2(a: a)\n  y = g.y\n}\n`,
    fix: 'Connect every input, by name: `port: value`.',
  },
  {
    code: 'double-connection',
    stage: 'Modules and instances',
    meaning: 'An input of an instance is connected twice.',
    example: `${AND2}module M(a: bit) -> (y: bit) {\n  inst g: And2(a: a, a: a, b: a)\n  y = g.y\n}\n`,
    fix: 'Remove one of the connections.',
  },
  {
    code: 'unknown-port',
    stage: 'Modules and instances',
    meaning: 'A port that the module does not have: connecting an output, reading an input, or a misspelt name (a near miss is suggested).',
    example: `${AND2}module M(a: bit) -> (y: bit) {\n  inst g: And2(a: a, c: a, b: a)\n  y = g.y\n}\n`,
    fix: 'Connect inputs with `port: value`, and read outputs as `instance.port`.',
  },
  {
    code: 'missing-next',
    stage: 'Registers and memories',
    meaning: 'A register has no `next` value.',
    example: `module M(clk: clock, d: bit) -> (q: bit) {\n  reg r: bit = 0\n  q = r\n}\n`,
    fix: 'Say what it holds after each edge; to hold its value, `next r = r`.',
  },
  {
    code: 'double-next',
    stage: 'Registers and memories',
    meaning: 'A register has more than one `next`, or an element of an array register does.',
    example: `module M(clk: clock, d: bit) -> (q: bit) {\n  reg r: bit = 0\n  next r = d\n  next r = !d\n  q = r\n}\n`,
    fix: 'Combine the values with `if` or `match` in one `next`.',
  },
  {
    code: 'bad-next',
    stage: 'Registers and memories',
    meaning: '`next` on something that is not a register (an output, an input), or with an index on a register that is not an array.',
    example: `module M(clk: clock, d: bit) -> (q: bit) {\n  next d = d\n  q = d\n}\n`,
    fix: 'Assign an output with `q = …`; `next` is for `reg`.',
  },
  {
    code: 'reg-array-coverage',
    stage: 'Registers and memories',
    meaning: 'An array register has per-element `next`s that do not cover every element.',
    example: `module M(clk: clock, d: bit) -> (y: bit) {\n  reg r: [bit; 2] = [0; 2]\n  next r[0] = d\n  y = r[1]\n}\n`,
    fix: 'Add `next r[i] = …` for the missing elements; `next r[i] = r[i]` holds one.',
  },
  {
    code: 'bad-write',
    stage: 'Registers and memories',
    meaning: '`name.write(…)` where `name` is not a memory.',
    example: `module M(clk: clock, a: bit) -> (y: bit) {\n  reg r: bit = 0\n  next r = a\n  r.write(0, a, a)\n  y = r\n}\n`,
    fix: 'Only a `mem` has a write port.',
  },
  {
    code: 'too-many-writes',
    stage: 'Registers and memories',
    meaning: 'A memory has two `write` statements. It has one write port.',
    example: `module M(clk: clock, a: bit) -> (y: bit) {\n  mem m: [bit; 2]\n  m.write(0, a, a)\n  m.write(1, a, a)\n  y = m.read(0)\n}\n`,
    fix: 'Combine the writes with `if` into a single `write`.',
  },
  {
    code: 'too-many-reads',
    stage: 'Registers and memories',
    meaning: 'A memory is read at three places. It has two read ports.',
    example: `module M(clk: clock, a: bits<2>) -> (y: bit) {\n  mem m: [bit; 4]\n  let x: bit = m.read(a)\n  let z: bit = m.read(a)\n  let w: bit = m.read(a)\n  y = x & z & w\n}\n`,
    fix: 'Read once into a `let` and reuse it.',
  },
  {
    code: 'clock-misuse',
    stage: 'Clocks and dataflow',
    meaning: 'A clock used as anything but a clock: as data, as an output, a field, an array element, a `let`, a constant, a function parameter; a register or memory with no clock, or with several to choose from; a clock connected to something that is not a clock input. It is how the language makes a gated clock impossible to write.',
    example: `module M(clk: clock) -> (y: clock) {\n}\n`,
    fix: 'Use an enable signal instead of gating a clock; with several clocks, say `on name`.',
  },
  {
    code: 'clock-domain',
    stage: 'Clocks and dataflow',
    meaning: 'A register, memory or instance reads a value from a register clocked by a different clock.',
    example: `module M(fast: clock, slow: clock, d: bit) -> (q: bit) {\n  reg a: bit = 0 on fast\n  reg b: bit = 0 on slow\n  next a = d\n  next b = a\n  q = b\n}\n`,
    fix: 'Pass the value through a `Synchronizer` clocked by the receiving clock.',
  },
  {
    code: 'comb-loop',
    stage: 'Clocks and dataflow',
    meaning: 'A combinational loop: a signal that depends on itself with no register in the way. It would hold state without a clock (a latch). The message gives the path round the loop.',
    example: `module M(s_n: bit, r_n: bit) -> (q: bit) {\n  let a: bit = !(s_n && b)\n  let b: bit = !(r_n && a)\n  q = a\n}\n`,
    fix: 'Put a `reg` in the loop.',
  },
  {
    code: 'cannot-infer',
    stage: 'Clocks and dataflow',
    meaning: 'The type of a `let` cannot be worked out because its value depends on itself, or a function’s generic cannot be inferred from its arguments.',
    example: `module M(a: bit) -> (y: bit) {\n  let p = q\n  let q = p\n  y = a\n}\n`,
    fix: 'Give the `let` a type; use the generic as the width of a parameter.',
    also: ['comb-loop'],
  },
  {
    code: 'literal-no-context',
    stage: 'Expressions',
    meaning: 'A number whose width cannot be inferred: nothing around it says how wide it is.',
    example: `module M(a: bit) -> (y: bit) {\n  let t = 5\n  y = a\n}\n`,
    fix: 'Give it a type: `bits<N>(5)`, or a `let` with a type, or a typed `const`.',
  },
  {
    code: 'literal-too-wide',
    stage: 'Expressions',
    meaning: 'A literal that does not fit its type: too big, or negative for an unsigned type.',
    example: `module M(a: bit) -> (y: bits<4>) {\n  y = 16\n}\n`,
    fix: 'Use a wider type, or `signed<N>` for negative numbers.',
  },
  {
    code: 'type-mismatch',
    stage: 'Expressions',
    meaning: 'The two sides are different types of the same width (`bits<8>` and `signed<8>`), a number is given for an enum, or an array literal has the wrong number of elements.',
    example: `module M(a: bits<8>, s: signed<8>) -> (y: bits<8>) {\n  y = a + s\n}\n`,
    fix: 'Convert explicitly with `signed(x)` or `bits(x)`, or use a variant of the enum.',
  },
  {
    code: 'width-mismatch',
    stage: 'Expressions',
    meaning: 'The two sides are different widths.',
    example: `module M(a: bits<8>, b: bits<4>) -> (y: bits<8>) {\n  y = a + b\n}\n`,
    fix: 'Extend with `zext` or `sext`, or truncate with `trunc` or a slice, as the help says.',
  },
  {
    code: 'bad-operand',
    stage: 'Expressions',
    meaning: 'An operator or function applied to a type it does not accept: `!` on a vector, `&&` on vectors, ordering an enum, a shift amount that is signed, a slice of something that is not a vector, matching on an array.',
    example: `module M(a: bits<8>) -> (y: bit) {\n  y = !a\n}\n`,
    fix: 'The help says: `~` for a bitwise not, `== 0` to compare, `bits(x)` to convert.',
  },
  {
    code: 'bad-condition',
    stage: 'Expressions',
    meaning: 'The condition of an `if` is not a `bit`.',
    example: `module M(a: bits<8>) -> (y: bit) {\n  y = if a { 1 } else { 0 }\n}\n`,
    fix: 'Compare it: `a != 0`.',
  },
  {
    code: 'bad-expression',
    stage: 'Expressions',
    meaning: 'Something that is not a value used as one: a module, a function, a type, a memory, an instance, a `_` outside a `match`, a string outside `print`, an empty array, `sim` outside a test, a `write` used as a value.',
    example: `module M(a: bit) -> (y: bit) {\n  let t: bit = _\n  y = a\n}\n`,
    fix: 'The help says what to write instead: `x.port` for an instance, `m.read(addr)` for a memory, a variant for an enum.',
  },
  {
    code: 'bad-slice',
    stage: 'Expressions',
    meaning: 'A slice whose bounds are reversed or outside the vector.',
    example: `module M(a: bits<8>) -> (y: bit) {\n  let t = a[9:2]\n  y = a[0]\n}\n`,
    fix: 'Write the high bound first, and stay within 0 to N − 1.',
  },
  {
    code: 'index-out-of-range',
    stage: 'Expressions',
    meaning: 'A constant index past the end of a vector or array, or of a register array in `next`.',
    example: `module M(a: bits<8>) -> (y: bit) {\n  y = a[8]\n}\n`,
    fix: 'Indices run from 0 to N − 1.',
  },
  {
    code: 'index-width',
    stage: 'Expressions',
    meaning: 'A dynamic index that is not exactly `bits<⌈log₂ N⌉>`. It becomes a multiplexer with one select line per index bit.',
    example: `module M(a: bits<8>, i: bits<2>) -> (y: bit) {\n  y = a[i]\n}\n`,
    fix: 'Extend with `zext(i, 3)`, or take the low bits with a slice.',
  },
  {
    code: 'unknown-name',
    stage: 'Expressions',
    meaning: 'A name that is not declared (a value or a function). A near miss is suggested.',
    example: `module M(a: bit) -> (y: bit) {\n  y = nope\n}\n`,
    fix: 'Declare it, or fix the spelling. Items can come in any order, but must be in the same module.',
  },
  {
    code: 'unknown-variant',
    stage: 'Expressions',
    meaning: 'An enum has no such variant.',
    example: `enum Light { Red, Green }\nmodule M(a: bit) -> (y: bit) {\n  let l: Light = Light.Blue\n  y = a\n}\n`,
    fix: 'Use one of the variants the message lists.',
  },
  {
    code: 'bad-field',
    stage: 'Expressions',
    meaning: 'A field that does not exist, a `.` on something with no fields, or a wrong field in a struct literal.',
    example: `struct Pixel { r: bits<8>, g: bits<8> }\nmodule M(p: Pixel) -> (y: bits<8>) {\n  y = p.b\n}\n`,
    fix: 'Use one of the struct’s fields.',
  },
  {
    code: 'missing-field',
    stage: 'Expressions',
    meaning: 'A struct literal that leaves fields out.',
    example: `struct Pixel { r: bits<8>, g: bits<8> }\nmodule M(a: bits<8>) -> (y: Pixel) {\n  y = Pixel { r: a }\n}\n`,
    fix: 'Give every field.',
  },
  {
    code: 'bad-call',
    stage: 'Expressions',
    meaning: 'A call with the wrong number or kind of arguments, an unknown method, a module called like a function, `random` outside a test.',
    example: `module M(a: bit) -> (y: bit) {\n  let t = concat()\n  y = a\n}\n`,
    fix: 'See the built-in functions table for what each takes.',
  },
  {
    code: 'recursive-fn',
    stage: 'Functions',
    meaning: 'A function calls itself. Functions are inlined into hardware.',
    example: `fn twice(x: bit) -> bit {\n  twice(x)\n}\n`,
    fix: 'Write the loop as a `for` over a compile-time count.',
  },
  {
    code: 'match-incomplete',
    stage: 'match',
    meaning: 'A `match` that does not cover every value, and has no `_` arm.',
    example: `module M(f: bits<2>) -> (y: bit) {\n  y = match f {\n    0 => 1,\n    1 => 0,\n  }\n}\n`,
    fix: 'Add the missing arms, or `_ => …`.',
  },
  {
    code: 'overlapping-arms',
    stage: 'match',
    meaning: 'The same value in two arms, or two `_` arms. The order of arms does not matter, so an overlap can never be a priority.',
    example: `module M(f: bits<2>) -> (y: bit) {\n  y = match f {\n    0 => 1,\n    0 => 0,\n    _ => 1,\n  }\n}\n`,
    fix: 'Remove the duplicate; for a priority, use an `if` chain.',
  },
  {
    code: 'bad-pattern',
    stage: 'match',
    meaning: 'A pattern that is not a constant.',
    example: `module M(f: bits<2>, g: bits<2>) -> (y: bit) {\n  y = match f {\n    g => 1,\n    _ => 0,\n  }\n}\n`,
    fix: 'Use `if` to compare with a signal.',
  },
  {
    code: 'unreachable-arm',
    stage: 'match',
    meaning: 'Warning: a `_` arm when every value is already matched.',
    example: `module M(f: bit) -> (y: bit) {\n  y = match f {\n    0 => 1,\n    1 => 0,\n    _ => 1,\n  }\n}\n`,
    fix: 'Delete the `_` arm.',
  },
  {
    code: 'bad-step',
    stage: 'Tests',
    meaning: '`step` in a test before any `sim`.',
    example: `test "steps nothing" {\n  step\n}\n`,
    fix: 'Create an instance first: `let c = sim Module(…)`.',
  },
  {
    code: 'test-error',
    stage: 'Tests',
    meaning: 'A test stopped: a value that does not fit its type, a negative `step`, more cycles than the limit, a variable with no value yet. (Not a checker message: the test runner reports it.)',
    example: `module Hold(clk: clock) -> (y: bit) {\n  reg r: bit = 0\n  next r = r\n  y = r\n}\n\ntest "cannot step backwards" {\n  let h = sim Hold()\n  step 0 - 1\n}\n`,
    fix: 'Read the message: it points at the statement.',
    test: true,
    messages: ['‹name› has no value yet', 'cannot step a negative number of cycles (‹n›)', 'the test ran for more than ‹n› cycles', 'value ‹v› does not fit ‹type›'],
  },
  {
    code: 'expect-failed',
    stage: 'Tests',
    meaning: 'An `expect` was false. The message shows the values the condition read, and a waveform of the instance’s ports around the failure. (Reported by the test runner.)',
    example: `module Hold(clk: clock) -> (y: bit) {\n  reg r: bit = 0\n  next r = r\n  y = r\n}\n\ntest "y starts high" {\n  let h = sim Hold()\n  step 2\n  expect h.y == 1\n}\n`,
    fix: 'Compare the waveform with what you meant.',
    test: true,
    messages: ['expectation failed: ‹condition›'],
  },
];

/** The codes the compiler emits, from its source (generated), with those of the runner. */
export const ALL_CODES: string[] = [...EMITTED.map((e) => e.code), 'test-error', 'expect-failed'];

export function docOf(code: string): DiagnosticDoc | undefined {
  return DIAGNOSTICS.find((d) => d.code === code);
}
