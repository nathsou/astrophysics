/**
 * The diagnostics tour: broken programs, the message the DCL checker really produces for each, and a fixed
 * version. The messages are rendered here, by the compiler, when the figure opens; nothing is typed in by hand.
 */
import { check, renderDiagnostic, type Diagnostic } from '$lib/hdl';

export interface TourStop {
  id: string;
  /** What is wrong, in a few words. */
  title: string;
  broken: string;
  fixed: string;
  /** The hardware bug the check prevents, and what a looser language does instead. */
  why: string;
}

export const STOPS: TourStop[] = [
  {
    id: 'width',
    title: 'A 12-bit value added to a 32-bit one',
    broken: `module Pc(clk: clock, imm: bits<12>) -> (out: bits<32>) {
  reg pc: bits<32> = 0
  next pc = pc + imm
  out = pc
}
`,
    fixed: `module Pc(clk: clock, imm: bits<12>) -> (out: bits<32>) {
  reg pc: bits<32> = 0
  next pc = pc + sext(imm, 32)
  out = pc
}
`,
    why: 'Verilog would quietly pad the short operand with zeros. A branch offset that should go back 4 bytes would go forward 4092. In DCL you must say which extension you mean.',
  },
  {
    id: 'literal',
    title: 'A constant too big for its wires',
    broken: `module Mask(a: bits<4>) -> (y: bits<4>) {
  y = a & 0x1f
}
`,
    fixed: `module Mask(a: bits<4>) -> (y: bits<4>) {
  y = a & 0xf
}
`,
    why: 'A constant that does not fit is nearly always a typo or a wrong width. A looser language drops the top bit and carries on, and the mask no longer masks what you meant.',
  },
  {
    id: 'signed',
    title: 'Signed plus unsigned',
    broken: `module Mix(a: signed<8>, b: bits<8>) -> (y: signed<8>) {
  y = a + b
}
`,
    fixed: `module Mix(a: signed<8>, b: bits<8>) -> (y: signed<8>) {
  y = a + signed(b)
}
`,
    why: 'The same 8 wires mean 200 or −56, depending on the type. Mixing them in one expression is where C-style rules turn a comparison upside down. Converting costs no hardware, so there is no excuse for doing it silently.',
  },
  {
    id: 'missing-next',
    title: 'A register that never changes',
    broken: `module Toggle(clk: clock, en: bit) -> (q: bit) {
  reg state: bit = 0
  q = state
}
`,
    fixed: `module Toggle(clk: clock, en: bit) -> (q: bit) {
  reg state: bit = 0
  next state = if en { !state } else { state }
  q = state
}
`,
    why: 'A flip-flop whose input nobody drew. Looser languages let it through (perhaps with a warning), and the flip-flop sits at its power-up value for ever.',
  },
  {
    id: 'unassigned',
    title: 'An output nobody drives',
    broken: `module Compare(a: bit, b: bit) -> (both: bit, either: bit) {
  both = a && b
}
`,
    fixed: `module Compare(a: bit, b: bit) -> (both: bit, either: bit) {
  both = a && b
  either = a || b
}
`,
    why: 'An unconnected output is a floating wire: high-impedance in a simulator, a random voltage on a chip. Here it is an error before the design leaves your editor.',
  },
  {
    id: 'double',
    title: 'Two drivers for one wire',
    broken: `module Both(a: bit, b: bit) -> (y: bit) {
  y = a && b
  y = a || b
}
`,
    fixed: `module Both(a: bit, b: bit) -> (y: bit) {
  y = if a { b } else { 1 }
}
`,
    why: 'Chapter 10’s contention: two gates fighting over one wire. Inside a DCL design there is no such thing, because every wire has exactly one driver, and you combine values with `if` or `match`.',
  },
  {
    id: 'no-else',
    title: 'An `if` with no `else`',
    broken: `module Hold(a: bit, data: bits<4>) -> (y: bits<4>) {
  y = if a { data }
}
`,
    fixed: `module Hold(a: bit, data: bits<4>) -> (y: bits<4>) {
  y = if a { data } else { 0 }
}
`,
    why: 'In Verilog, an `if` without an `else` in combinational code means “otherwise keep the old value”, so the tool builds a latch you never asked for. DCL does not have to guess: a value is always defined.',
  },
  {
    id: 'match-incomplete',
    title: 'A `match` that misses cases',
    broken: `module Alu(f3: bits<3>) -> (result: bits<8>) {
  result = match f3 {
    0 => 1,
    1 => 2,
    2 => 3,
    3 => 4,
    4 => 5,
  }
}
`,
    fixed: `module Alu(f3: bits<3>) -> (result: bits<8>) {
  result = match f3 {
    0 => 1,
    1 => 2,
    2 => 3,
    3 => 4,
    4 => 5,
    _ => 0,
  }
}
`,
    why: 'Three of the eight selector values would have no answer. A `case` without a `default` in Verilog is another way to grow a latch. The checker lists exactly the values that are missing.',
  },
  {
    id: 'loop',
    title: 'A loop with no register in it',
    broken: `module Latch(s: bit, r: bit) -> (q: bit) {
  let q_i: bit = !(s && q_n)
  let q_n: bit = !(r && q_i)
  q = q_i
}
`,
    fixed: `module SetReset(clk: clock, s: bit, r: bit) -> (q: bit) {
  reg state: bit = 0

  next state = if r { 0 } else if s { 1 } else { state }
  q = state
}
`,
    why: 'This is the cross-coupled pair of Chapter 16, and it works as a latch on a bench. It has no clock, so no timing analysis can vouch for it, and DCL leaves it out of the language. The registered version is what you write instead.',
  },
  {
    id: 'clock',
    title: 'A clock used as data',
    broken: `module Gated(clk: clock, en: bit) -> (q: bit) {
  reg r: bit = 0
  let gated: bit = clk & en
  next r = !r
  q = r
}
`,
    fixed: `module Gated(clk: clock, en: bit) -> (q: bit) {
  reg r: bit = 0
  next r = if en { !r } else { r }
  q = r
}
`,
    why: 'A gate on a clock line can glitch, and a glitch on a clock is a stray clock edge. FPGAs route clocks on their own network, which logic cannot enter. The safe pattern, an enable, is the only one that can be written.',
  },
  {
    id: 'domain',
    title: 'A register read across clock domains',
    broken: `module Cross(clk_a: clock, clk_b: clock) -> (y: bit) {
  reg x: bit = 0 on clk_a
  reg z: bit = 0 on clk_b
  next x = !x
  next z = x
  y = z
}
`,
    fixed: `module Cross(clk_a: clock, clk_b: clock) -> (y: bit) {
  reg x: bit = 0 on clk_a
  next x = !x
  inst sync: Synchronizer(clk: clk_b, d: x)
  y = sync.q
}
`,
    why: 'A value that changes just before the other clock’s edge breaks setup and hold (Chapter 17) and can leave the flip-flop metastable (Chapter 16). The standard library’s `Synchronizer` is the accepted fix.',
  },
  {
    id: 'unconnected',
    title: 'An input left unconnected',
    broken: `module Inner(a: bit, b: bit) -> (y: bit) {
  y = a && b
}

module Outer(a: bit) -> (y: bit) {
  inst gate: Inner(a: a)
  y = gate.y
}
`,
    fixed: `module Inner(a: bit, b: bit) -> (y: bit) {
  y = a && b
}

module Outer(a: bit) -> (y: bit) {
  inst gate: Inner(a: a, b: 1)
  y = gate.y
}
`,
    why: 'An input pin with nothing on it floats (Chapter 10, “An input nobody drives”), and the gate above it computes garbage. In Verilog a forgotten port connection is legal; here it is an error.',
  },
];

export interface Diagnosis {
  /** The compiler's messages, as `renderDiagnostic` prints them, separated by a blank line. */
  text: string;
  codes: string[];
  errors: number;
}

export function diagnose(source: string, file = 'broken.dcl'): Diagnosis {
  const { diagnostics } = check(source, { file });
  const shown: Diagnostic[] = diagnostics.filter((d) => d.span.file === file);
  return {
    text: shown.map((d) => renderDiagnostic(source, d)).join('\n\n'),
    codes: shown.map((d) => d.code),
    errors: shown.filter((d) => d.severity === 'error').length,
  };
}
