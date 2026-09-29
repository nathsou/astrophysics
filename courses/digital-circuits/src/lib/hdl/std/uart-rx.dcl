/// Serial receiver for UartTx's format (8N1, least significant bit first, CLKS_PER_BIT ≥ 2 cycles per
/// bit). The line is synchronised first, then sampled in the middle of each bit. `valid` pulses for one
/// cycle when a byte with a correct stop bit has arrived; `data` keeps the last byte.
module UartRx<CLKS_PER_BIT: int>(clk: clock, rx: bit) -> (data: bits<8>, valid: bit) {
  inst sync: Synchronizer(clk: clk, d: rx)
  let line: bit = sync.q

  reg receiving: bit = 0
  reg timer: bits<clog2(CLKS_PER_BIT)> = 0
  /// 0 is the start bit, 1 to 8 the data bits, 9 the stop bit.
  reg bit_index: bits<4> = 0
  reg shift: bits<8> = 0
  reg done: bit = 0
  let begin: bit = !receiving && !line
  let at_sample: bit = receiving && timer == 0
  let false_start: bit = bit_index == 0 && line

  next receiving = if begin { 1 } else if at_sample && (bit_index == 9 || false_start) { 0 } else { receiving }
  // Half a bit to the middle of the start bit, then a whole bit to the middle of each next one.
  next timer = if begin {
    (CLKS_PER_BIT >> 1) - 1
  } else if at_sample {
    CLKS_PER_BIT - 1
  } else if receiving {
    timer - 1
  } else {
    timer
  }
  next bit_index = if begin { 0 } else if at_sample { bit_index + 1 } else { bit_index }
  next shift = if at_sample && bit_index != 0 && bit_index != 9 { concat(line, shift[7:1]) } else { shift }
  next done = at_sample && bit_index == 9 && line
  data = shift
  valid = done
}

test "receives what UartTx sends" {
  let tx = sim UartTx<4>(start: 0, data: 0x5a)
  let rx = sim UartRx<4>(rx: 1)
  let got: bits<8> = 0
  let seen: bits<4> = 0
  step 3
  tx.start = 1
  for i in 0..100 {
    rx.rx = tx.tx
    got = if rx.valid { rx.data } else { got }
    seen = if rx.valid { seen + 1 } else { seen }
    step
    tx.start = 0
  }
  expect got == 0x5a && seen == 1
}

test "ignores a glitch on the line" {
  let rx = sim UartRx<8>(rx: 1)
  step 4
  rx.rx = 0
  step
  rx.rx = 1
  step 200
  expect !rx.valid && rx.data == 0
}
