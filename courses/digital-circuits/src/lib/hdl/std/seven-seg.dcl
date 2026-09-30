/// Hexadecimal digit to seven-segment pattern. Bit 0 is segment a, bit 6 is segment g
/// (the order `gfedcba`); a 1 lights the segment.
module SevenSeg(value: bits<4>) -> (segments: bits<7>) {
  segments = match value {
    0x0 => 0b011_1111,
    0x1 => 0b000_0110,
    0x2 => 0b101_1011,
    0x3 => 0b100_1111,
    0x4 => 0b110_0110,
    0x5 => 0b110_1101,
    0x6 => 0b111_1101,
    0x7 => 0b000_0111,
    0x8 => 0b111_1111,
    0x9 => 0b110_1111,
    0xa => 0b111_0111,
    0xb => 0b111_1100,
    0xc => 0b011_1001,
    0xd => 0b101_1110,
    0xe => 0b111_1001,
    0xf => 0b111_0001,
  }
}

test "draws the digits" {
  let s = sim SevenSeg(value: 0)
  expect s.segments == 0b011_1111
  s.value = 1
  expect s.segments == 0b000_0110
  s.value = 8
  expect s.segments == 0b111_1111
  s.value = 0xf
  expect s.segments == 0b111_0001
}
