/**
 * DCL programs that Chapter 17's playgrounds start from. They live here, not in the Markdown, so that the tests
 * can run them. (`::snippet-playground{id="…"}` looks them up.)
 */
export interface Snippet {
  title: string;
  /** The module to simulate. */
  top: string;
  code: string;
}

export const SNIPPETS: Record<string, Snippet> = {
  toggle: {
    title: 'A flip-flop in DCL',
    top: 'Toggle',
    code: `/// Divides the clock by two: q changes at every rising edge.
module Toggle(clk: clock) -> (q: bit) {
  reg state: bit = 0

  next state = !state
  q = state
}

test "q flips at every clock edge" {
  let t = sim Toggle()
  expect t.q == 0
  step
  expect t.q == 1
  step
  expect t.q == 0
  step 5
  expect t.q == 1
}
`,
  },
  latch: {
    title: 'Trying to write a latch',
    top: 'Latch',
    code: `/// A transparent latch: q follows d while en is 1, and keeps its value while en is 0.
module Latch(en: bit, d: bit) -> (q: bit) {
  let held: bit = if en { d } else { held }
  q = held
}
`,
  },
  'press-toggle': {
    title: 'A button that toggles a lamp',
    top: 'PressToToggle',
    code: `/// A push button that flips a lamp: every press, however much it bounces, flips it once.
module PressToToggle(clk: clock, button: bit) -> (lamp: bit) {
  inst clean: Debouncer<4>(clk: clk, raw: button)
  inst press: EdgeDetect(clk: clk, d: clean.clean)
  reg lit: bit = 0

  next lit = if press.rise { !lit } else { lit }
  lamp = lit
}

test "one press flips the lamp once, however much the button chatters" {
  let t = sim PressToToggle(button: 0)
  step 4
  for i in 0..3 {
    t.button = 1
    step
    t.button = 0
    step
  }
  t.button = 1
  step 12
  expect t.lamp == 1
  t.button = 0
  step 12
  expect t.lamp == 1
  t.button = 1
  step 12
  expect t.lamp == 0
}
`,
  },
};
