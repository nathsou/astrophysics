/// Pulses `rise` for one cycle when `d` goes from 0 to 1, and `fall` when it goes from 1 to 0.
/// `d` must already be synchronous to `clk`: pass a button through a Debouncer or a Synchronizer first.
module EdgeDetect(clk: clock, d: bit) -> (rise: bit, fall: bit) {
  reg last: bit = 0

  next last = d
  rise = d && !last
  fall = !d && last
}

test "one pulse per edge" {
  let e = sim EdgeDetect(d: 0)
  expect !e.rise && !e.fall
  e.d = 1
  expect e.rise && !e.fall
  step
  expect !e.rise && !e.fall
  step 3
  expect !e.rise
  e.d = 0
  expect e.fall && !e.rise
  step
  expect !e.fall
}
