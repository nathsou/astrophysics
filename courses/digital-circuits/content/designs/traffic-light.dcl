/// The Chapter 19 traffic light, with the British sequence.
enum Light { Red, RedAmber, Green, Amber }

module TrafficLight(clk: clock, tick: bit) -> (red: bit, amber: bit, green: bit) {
  reg state: Light = Light.Red

  next state = if !tick {
    state
  } else {
    match state {
      Light.Red => Light.RedAmber,
      Light.RedAmber => Light.Green,
      Light.Green => Light.Amber,
      Light.Amber => Light.Red,
    }
  }
  red = state == Light.Red || state == Light.RedAmber
  amber = state == Light.RedAmber || state == Light.Amber
  green = state == Light.Green
}

test "follows the British sequence" {
  let t = sim TrafficLight(tick: 1)
  expect t.red && !t.amber && !t.green
  step
  expect t.red && t.amber && !t.green
  step
  expect !t.red && !t.amber && t.green
  step
  expect !t.red && t.amber && !t.green
  step
  expect t.red && !t.amber && !t.green
}

test "waits for the tick" {
  let t = sim TrafficLight(tick: 0)
  step 10
  expect t.red && !t.amber
}
