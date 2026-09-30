/// Cleans up a bouncing push button or switch. The input is synchronised first; the output then changes
/// only after the input has held its new value for STABLE_CYCLES clock cycles in a row.
module Debouncer<STABLE_CYCLES: int>(clk: clock, raw: bit) -> (clean: bit) {
  const COUNT_WIDTH: int = clog2(STABLE_CYCLES + 1)

  inst sync: Synchronizer(clk: clk, d: raw)
  let level: bit = sync.q
  reg state: bit = 0
  reg count: bits<COUNT_WIDTH> = 0
  let differs: bit = level != state
  let settled: bit = count == STABLE_CYCLES - 1

  next count = if !differs || settled { 0 } else { count + 1 }
  next state = if differs && settled { level } else { state }
  clean = state
}

test "ignores bounces shorter than the window" {
  let d = sim Debouncer<4>(raw: 0)
  for i in 0..3 {
    d.raw = 1
    step 2
    d.raw = 0
    step 2
  }
  step 10
  expect d.clean == 0
}

test "follows a steady input after the window" {
  let d = sim Debouncer<4>(raw: 1)
  // Two cycles through the synchroniser, then four stable cycles.
  step 5
  expect d.clean == 0
  step
  expect d.clean == 1
  d.raw = 0
  step 6
  expect d.clean == 0
}
