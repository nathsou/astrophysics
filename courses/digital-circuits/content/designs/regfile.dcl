/// The RV32I register file: 32 registers of 32 bits, two read ports and one write port.
/// Register x0 always reads as zero.
module RegFile(
  clk: clock,
  rs1_address: bits<5>,
  rs2_address: bits<5>,
  rd_address: bits<5>,
  rd_write: bit,
  rd_value: bits<32>,
) -> (rs1_value: bits<32>, rs2_value: bits<32>) {
  reg x: [bits<32>; 32] = [0; 32]

  rs1_value = x[rs1_address]
  rs2_value = x[rs2_address]
  next x[0] = 0
  for i in 1..32 {
    next x[i] = if rd_write && rd_address == i { rd_value } else { x[i] }
  }
}

test "writes and reads every register" {
  let rf = sim RegFile(rs1_address: 0, rs2_address: 0, rd_address: 0, rd_write: 1, rd_value: 0)
  for i in 0..32 {
    rf.rd_address = i
    rf.rd_value = i * 3 + 1
    step
  }
  rf.rd_write = 0
  for i in 0..32 {
    rf.rs1_address = i
    rf.rs2_address = 31 - i
    expect rf.rs1_value == (if i == 0 { 0 } else { i * 3 + 1 })
    expect rf.rs2_value == (if i == 31 { 0 } else { (31 - i) * 3 + 1 })
  }
}

test "x0 ignores writes" {
  let rf = sim RegFile(rs1_address: 0, rs2_address: 0, rd_address: 0, rd_write: 1, rd_value: 99)
  step
  expect rf.rs1_value == 0
}
