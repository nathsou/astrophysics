/**
 * DCL programs that the chapter's playgrounds start from. They live here, not in the Markdown, so that
 * the tests can run them: the fix-the-test starting point must fail its tests and the solution must pass.
 * (`::snippet-playground{id="…"}` looks them up.)
 */
export interface Snippet {
  title: string;
  /** The module to simulate. */
  top: string;
  code: string;
  /** The corrected program, for the exercises with a fix. */
  solution?: string;
}

const DECADE_TESTS = `
test "counts to nine and wraps to zero" {
  let d = sim Decade(enable: 1)
  for i in 0..9 {
    expect d.digit == i && !d.carry
    step
  }
  expect d.digit == 9 && d.carry
  step
  expect d.digit == 0 && !d.carry
}

test "holds, and does not carry, while disabled" {
  let d = sim Decade(enable: 1)
  step 9
  d.enable = 0
  expect d.digit == 9 && !d.carry
  step 5
  expect d.digit == 9 && !d.carry
}
`;

const decade = (wrapAt: number, carry: string) => `/// One decimal digit of a counter: counts 0 to 9, then wraps to 0 and reports a carry for the next digit.
module Decade(clk: clock, enable: bit) -> (digit: bits<4>, carry: bit) {
  reg value: bits<4> = 0

  next value = if enable {
    if value == ${wrapAt} { 0 } else { value + 1 }
  } else {
    value
  }
  digit = value
  carry = ${carry}
}
${DECADE_TESTS}`;

const TICK_TESTS = `
test "one pulse every PERIOD cycles" {
  let t = sim TickGen<5>()
  for round in 0..3 {
    for i in 0..4 {
      expect !t.tick
      step
    }
    expect t.tick
    step
  }
}

test "a different period" {
  let t = sim TickGen<3>()
  expect !t.tick
  step 2
  expect t.tick
  step
  expect !t.tick
}
`;

export const SNIPPETS: Record<string, Snippet> = {
  'fix-the-test': {
    title: 'A decade counter that fails its tests',
    top: 'Decade',
    code: decade(10, 'value == 9'),
    solution: decade(9, 'enable && value == 9'),
  },
  'swap': {
    title: 'Two registers that swap',
    top: 'Swap',
    code: `/// Loads two registers, then swaps them at every clock edge.
module Swap(clk: clock, load: bit, a_in: bits<4>, b_in: bits<4>) -> (a: bits<4>, b: bits<4>) {
  reg first: bits<4> = 0
  reg second: bits<4> = 0

  next first = if load { a_in } else { second }
  next second = if load { b_in } else { first }
  a = first
  b = second
}

test "swaps at every edge" {
  let s = sim Swap(load: 1, a_in: 1, b_in: 2)
  step
  s.load = 0
  expect s.a == 1 && s.b == 2
  step
  expect s.a == 2 && s.b == 1
  step
  expect s.a == 1 && s.b == 2
}
`,
  },
  'tick-gen': {
    title: 'Write a tick generator',
    top: 'TickGen',
    code: `/// Pulses \`tick\` for one cycle in every PERIOD cycles: the heartbeat that the traffic light waits for.
module TickGen<PERIOD: int>(clk: clock) -> (tick: bit) {
  // Your turn: a counter that counts 0 .. PERIOD - 1, and a tick on the last count.
  tick = 0
}
${TICK_TESTS}`,
    solution: `/// Pulses \`tick\` for one cycle in every PERIOD cycles: the heartbeat that the traffic light waits for.
module TickGen<PERIOD: int>(clk: clock) -> (tick: bit) {
  reg count: bits<clog2(PERIOD)> = 0
  let last: bit = count == PERIOD - 1

  next count = if last { 0 } else { count + 1 }
  tick = last
}
${TICK_TESTS}`,
  },
};
