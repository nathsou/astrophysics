/// Octet's ALU and flag logic. `op` is the ALU code (0 add, 1 subtract, 2 and, 3 or, 4 xor, 6 shift right, 7 not),
/// and `b` is already the ALU's second input: B, or A for SHL, or the constant 1 for INC.
module OctetAlu(
  a: bits<8>,
  b: bits<8>,
  op: bits<3>,
) -> (
  y: bits<8>,
  z: bit,
  c: bit,
  n: bit,
  v: bit,
) {
  let subtract: bit = op == 1
  let arithmetic: bit = op == 0 || op == 1
  let addend: bits<8> = if subtract { ~b } else { b }
  let carry_in: bits<9> = if subtract { 1 } else { 0 }
  let wide: bits<9> = zext(a, 9) + zext(addend, 9) + carry_in
  let sum: bits<8> = wide[7:0]

  let result: bits<8> = match op {
    0 | 1 => sum,
    2 => a & b,
    3 => a | b,
    4 => a ^ b,
    6 => a >> 1,
    7 => ~a,
    _ => 0,
  }
  y = result
  z = result == 0
  n = result[7]
  // C is the carry out of an addition, the borrow (its inverse) after a subtraction, and the bit shifted out by SHR.
  c = if arithmetic { wide[8] ^ subtract } else if op == 6 { a[0] } else { 0 }
  // V: both operands (B inverted for a subtraction) have the same sign, and the result has the other one.
  v = arithmetic && a[7] == (b[7] ^ subtract) && result[7] != a[7]
}

test "adds and sets the carry and overflow flags" {
  let alu = sim OctetAlu(a: 0x7f, b: 0x01, op: 0)
  expect alu.y == 0x80 && alu.n && alu.v && !alu.c && !alu.z
  alu.a = 0xff
  expect alu.y == 0 && alu.z && alu.c && !alu.v
}

test "subtracts, and C is the borrow" {
  let alu = sim OctetAlu(a: 3, b: 5, op: 1)
  expect alu.y == 0xfe && alu.c && alu.n && !alu.v
  alu.a = 5
  expect alu.y == 0 && alu.z && !alu.c
  alu.a = 0x80
  alu.b = 1
  expect alu.y == 0x7f && alu.v && !alu.c
}

test "logic clears C and V; shift right puts the bit shifted out in C" {
  let alu = sim OctetAlu(a: 0xf0, b: 0x3c, op: 2)
  expect alu.y == 0x30 && !alu.c && !alu.v
  alu.op = 3
  expect alu.y == 0xfc
  alu.op = 4
  expect alu.y == 0xcc
  alu.op = 7
  expect alu.y == 0x0f && !alu.n
  alu.a = 0x03
  alu.op = 6
  expect alu.y == 0x01 && alu.c && !alu.n
}

test "SHL is ADD with both inputs the same, INC is ADD with a 1" {
  let alu = sim OctetAlu(a: 0x96, b: 0x96, op: 0)
  expect alu.y == 0x2c && alu.c && alu.v
  alu.a = 0x7f
  alu.b = 1
  expect alu.y == 0x80 && alu.v && !alu.c
}
