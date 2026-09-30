/// Octet's register file: four bytes, one write port and two read ports that are always on.
module OctetRegs(
  clk: clock,
  write: bit,
  dst: bits<2>,
  data: bits<8>,
  ra: bits<2>,
  rb: bits<2>,
) -> (qa: bits<8>, qb: bits<8>) {
  reg r: [bits<8>; 4] = [0; 4]

  qa = r[ra]
  qb = r[rb]
  for i in 0..4 {
    next r[i] = if write && dst == i { data } else { r[i] }
  }
}

test "a write shows at both read ports after the clock edge" {
  let rf = sim OctetRegs(write: 1, dst: 2, data: 0x5a, ra: 2, rb: 3)
  expect rf.qa == 0
  step
  expect rf.qa == 0x5a && rf.qb == 0
  rf.write = 0
  rf.dst = 3
  rf.data = 0xff
  step
  expect rf.qb == 0
}

test "writing one register leaves the others alone" {
  let rf = sim OctetRegs(write: 1, dst: 0, data: 1, ra: 0, rb: 1)
  step
  rf.dst = 1
  rf.data = 2
  step
  expect rf.qa == 1 && rf.qb == 2
}
