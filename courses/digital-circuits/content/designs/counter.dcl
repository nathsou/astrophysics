/// A 4-bit counter with enable and synchronous clear.
module Counter(
  clk: clock,
  enable: bit,
  clear: bit,
) -> (
  count: bits<4>,
  wrapped: bit,
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

test "holds when disabled and clears" {
  let c = sim Counter(enable: 1, clear: 0)
  step 5
  c.enable = 0
  step 3
  expect c.count == 5 && !c.wrapped
  c.clear = 1
  step
  expect c.count == 0
}
