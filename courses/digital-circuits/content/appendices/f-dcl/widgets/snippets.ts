/**
 * DCL programs that Appendix F's playgrounds start from. They live here, not in the Markdown, so that the
 * tests can run them (`::snippet-playground{id="…"}` looks them up).
 */
export interface Snippet {
  title: string;
  /** The module to simulate. */
  top: string;
  code: string;
}

export const SNIPPETS: Record<string, Snippet> = {
  glance: {
    title: 'A counter with enable and clear',
    top: 'Counter',
    code: `/// A 4-bit counter with enable and synchronous clear.
module Counter(clk: clock, enable: bit, clear: bit) -> (count: bits<4>, wrapped: bit) {
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

test "clear beats enable" {
  let c = sim Counter(enable: 1, clear: 0)
  step 5
  c.clear = 1
  step
  expect c.count == 0
}
`,
  },
  memory: {
    title: 'A register file: one write port, two read ports',
    top: 'RegFile',
    code: `/// Eight words of eight bits. A read returns the word one clock cycle after its address.
module RegFile(
  clk: clock,
  wa: bits<3>,
  wd: bits<8>,
  we: bit,
  ra: bits<3>,
  rb: bits<3>,
) -> (a: bits<8>, b: bits<8>) {
  mem regs: [bits<8>; 8]

  regs.write(wa, wd, we)
  a = regs.read(ra)
  b = regs.read(rb)
}

test "two reads at once, one cycle after the address" {
  let r = sim RegFile(wa: 1, wd: 11, we: 1, ra: 0, rb: 0)
  step
  r.wa = 2
  r.wd = 22
  step
  r.we = 0
  r.ra = 1
  r.rb = 2
  expect r.a == 0
  step
  expect r.a == 11 && r.b == 22
}

test "a read in the cycle of a write sees the old word" {
  let r = sim RegFile(wa: 3, wd: 33, we: 1, ra: 3, rb: 3)
  step
  expect r.a == 0
  step
  expect r.a == 33
}
`,
  },
  'std-debounce': {
    title: 'A button through the standard library',
    top: 'Button',
    code: `/// A push button, cleaned up: \`held\` follows the button once it has been steady for four cycles,
/// and \`press\` pulses for one cycle at the moment it does.
module Button(clk: clock, raw: bit) -> (press: bit, held: bit) {
  inst db: Debouncer<4>(clk: clk, raw: raw)
  inst edge: EdgeDetect(clk: clk, d: db.clean)
  press = edge.rise
  held = db.clean
}

test "a steady press gives exactly one pulse" {
  let b = sim Button(raw: 1)
  let pulses: bits<8> = 0
  for i in 0..20 {
    pulses = if b.press { pulses + 1 } else { pulses }
    step
  }
  expect pulses == 1
  expect b.held
}

test "bounces shorter than the window are ignored" {
  let b = sim Button(raw: 0)
  let pulses: bits<8> = 0
  for i in 0..3 {
    b.raw = 1
    step 2
    b.raw = 0
    step 2
  }
  step 10
  expect !b.held
  expect pulses == 0
}
`,
  },
};
