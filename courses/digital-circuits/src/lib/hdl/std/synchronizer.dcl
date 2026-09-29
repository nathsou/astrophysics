/// Brings a signal from another clock domain, or from outside the chip, into the domain of `clk`.
/// Two flip-flops in a row: the first may go metastable when `d` changes just before a clock edge,
/// and the second gives it a whole clock cycle to settle. `q` follows `d` two cycles later.
/// Use it for one bit at a time: the bits of a bus could arrive in different cycles.
module Synchronizer(clk: clock, d: bit) -> (q: bit) {
  reg first: bit = 0
  reg second: bit = 0

  next first = d
  next second = first
  q = second
}

test "follows the input two cycles later" {
  let s = sim Synchronizer(d: 1)
  expect s.q == 0
  step
  expect s.q == 0
  step
  expect s.q == 1
  s.d = 0
  step 2
  expect s.q == 0
}
