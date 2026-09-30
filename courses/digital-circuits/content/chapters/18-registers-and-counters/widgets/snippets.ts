/**
 * DCL programs that Chapter 18's playgrounds start from. They live here, not in the Markdown, so that the tests
 * can run them. (`::snippet-playground{id="…"}` looks them up.)
 */
export interface Snippet {
  title: string;
  /** The module to simulate. */
  top: string;
  code: string;
}

export const SNIPPETS: Record<string, Snippet> = {
  register: {
    title: 'A register with a load enable',
    top: 'Register',
    code: `/// A byte of storage: it keeps its value unless load is 1.
module Register(clk: clock, load: bit, d: bits<8>) -> (q: bits<8>) {
  reg value: bits<8> = 0

  next value = if load { d } else { value }
  q = value
}

test "loads only when told to" {
  let r = sim Register(load: 0, d: 0x5a)
  step
  expect r.q == 0
  r.load = 1
  step
  expect r.q == 0x5a
  r.load = 0
  r.d = 0xff
  step 3
  expect r.q == 0x5a
}
`,
  },
  counter: {
    title: 'A counter in DCL',
    top: 'Counter',
    code: `/// A 4-bit counter: one flip-flop per bit, and an adder in front of them.
module Counter(clk: clock, enable: bit) -> (count: bits<4>) {
  reg value: bits<4> = 0

  next value = if enable { value + 1 } else { value }
  count = value
}

test "counts and wraps" {
  let c = sim Counter(enable: 1)
  for i in 0..15 {
    expect c.count == i
    step
  }
  expect c.count == 15
  step
  expect c.count == 0
}

test "each bit runs at half the speed of the one below" {
  let c = sim Counter(enable: 1)
  step 2
  expect c.count[0] == 0 && c.count[1] == 1
  step 2
  expect c.count[1] == 0 && c.count[2] == 1
  step 4
  expect c.count[2] == 0 && c.count[3] == 1
}
`,
  },
  ripple: {
    title: 'Trying to write a ripple counter',
    top: 'Ripple',
    code: `/// A ripple counter clocks each flip-flop from the one before it.
module Ripple(clk: clock) -> (q0: bit, q1: bit) {
  reg a: bit = 0
  reg b: bit = 0 on a

  next a = !a
  next b = !b
  q0 = a
  q1 = b
}
`,
  },
  shift: {
    title: 'A shift register',
    top: 'Shift',
    code: `/// Serial in, parallel out: every clock the byte moves up one place and si enters at the bottom.
module Shift(clk: clock, si: bit) -> (q: bits<8>, so: bit) {
  reg word: bits<8> = 0

  next word = concat(word[6:0], si)
  q = word
  so = word[7]
}

test "four bits in, in order" {
  let s = sim Shift(si: 1)
  step
  s.si = 0
  step
  s.si = 1
  step
  s.si = 1
  step
  expect s.q == 0b1011
}

test "a bit reaches the far end after eight clocks" {
  let s = sim Shift(si: 1)
  step
  s.si = 0
  step 6
  expect s.so == 0
  step
  expect s.so == 1
  step
  expect s.so == 0
}
`,
  },
  lfsr: {
    title: 'An LFSR in DCL',
    top: 'Lfsr',
    code: `/// An 8-bit linear-feedback shift register with taps at bits 7, 5, 4 and 3.
module Lfsr(clk: clock) -> (q: bits<8>, out: bit) {
  reg state: bits<8> = 1

  let feedback: bit = state[7] ^ state[5] ^ state[4] ^ state[3]
  next state = concat(state[6:0], feedback)
  q = state
  out = state[7]
}

test "visits every non-zero state before it repeats" {
  let l = sim Lfsr()
  for i in 0..254 {
    step
    expect l.q != 1 && l.q != 0
  }
  step
  expect l.q == 1
}
`,
  },
};
