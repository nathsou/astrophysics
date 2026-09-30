/// Serial transmitter: 8 data bits, least significant first, no parity, one stop bit (8N1).
/// A pulse on `start` while not `busy` sends `data`; each bit lasts CLKS_PER_BIT clock cycles (≥ 2).
/// The line `tx` idles high.
module UartTx<CLKS_PER_BIT: int>(clk: clock, start: bit, data: bits<8>) -> (tx: bit, busy: bit) {
  const STOP: bit = 1
  const START: bit = 0

  // The frame being sent, least significant bit on the line: start bit, data, stop bit.
  reg frame: bits<10> = 0x3ff
  reg bits_left: bits<4> = 0
  reg timer: bits<clog2(CLKS_PER_BIT)> = 0
  let sending: bit = bits_left != 0
  let bit_done: bit = timer == CLKS_PER_BIT - 1
  let begin: bit = start && !sending

  next frame = if begin {
    concat(STOP, data, START)
  } else if sending && bit_done {
    concat(STOP, frame[9:1])
  } else {
    frame
  }
  next bits_left = if begin { 10 } else if sending && bit_done { bits_left - 1 } else { bits_left }
  next timer = if begin || !sending || bit_done { 0 } else { timer + 1 }
  tx = frame[0]
  busy = sending
}

test "sends a frame" {
  let u = sim UartTx<2>(start: 0, data: 0b1010_0011)
  expect u.tx == 1 && !u.busy
  u.start = 1
  step
  u.start = 0
  expect u.busy && u.tx == 0
  // Data bits, least significant first, two cycles each.
  let expected: bits<8> = 0b1010_0011
  for i in 0..8 {
    step 2
    expect u.tx == expected[i]
  }
  step 2
  expect u.tx == 1 && u.busy
  step 2
  expect u.tx == 1 && !u.busy
}
