/// The arithmetic and logic unit of the RV32I core: `f3` selects the operation, as in the instruction
/// encoding; `is_reg && ir30` turns addition into subtraction, and `ir30` makes `>>` arithmetic.
module Alu(
  rs1_value: bits<32>,
  b: bits<32>,
  f3: bits<3>,
  is_reg: bit,
  ir30: bit,
) -> (result: bits<32>) {
  let shift: bits<5> = b[4:0]
  let subtract: bit = is_reg && ir30
  let addend: bits<32> = if subtract { ~b } else { b }
  let carry: bits<32> = if subtract { 1 } else { 0 }
  let sum: bits<32> = rs1_value + addend + carry
  let less_unsigned: bit = rs1_value < b
  let less_signed: bit = if rs1_value[31] != b[31] { rs1_value[31] } else { less_unsigned }
  let shifted_right: bits<32> = rs1_value >> shift
    | (if ir30 && rs1_value[31] { ~(0xffffffff >> shift) } else { 0 })
  result = match f3 {
    _ => sum,
    1 => rs1_value << shift,
    2 => if less_signed { 1 } else { 0 },
    3 => if less_unsigned { 1 } else { 0 },
    4 => rs1_value ^ b,
    5 => shifted_right,
    6 => rs1_value | b,
    7 => rs1_value & b,
  }
}

test "adds and subtracts" {
  let alu = sim Alu(rs1_value: 7, b: 5, f3: 0, is_reg: 1, ir30: 0)
  expect alu.result == 12
  alu.ir30 = 1
  expect alu.result == 2
  alu.b = 9
  expect alu.result == 0xffff_fffe
}

test "compares signed and unsigned" {
  let alu = sim Alu(rs1_value: 0xffff_ffff, b: 1, f3: 2, is_reg: 1, ir30: 0)
  expect alu.result == 1
  alu.f3 = 3
  expect alu.result == 0
}

test "shifts" {
  let alu = sim Alu(rs1_value: 0x8000_0010, b: 4, f3: 5, is_reg: 0, ir30: 0)
  expect alu.result == 0x0800_0001
  alu.ir30 = 1
  expect alu.result == 0xf800_0001
  alu.f3 = 1
  expect alu.result == 0x0000_0100
}

test "logic" {
  let alu = sim Alu(rs1_value: 0b1100, b: 0b1010, f3: 4, is_reg: 1, ir30: 0)
  expect alu.result == 0b0110
  alu.f3 = 6
  expect alu.result == 0b1110
  alu.f3 = 7
  expect alu.result == 0b1000
}
