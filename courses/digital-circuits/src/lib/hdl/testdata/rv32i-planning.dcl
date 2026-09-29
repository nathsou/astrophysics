top module RegFile(clk: clock, rs1_address: bits<5>, rs2_address: bits<5>, rd_address: bits<5>, rd_write: bit, rd_value: bits<32>) -> (rs1_value: bits<32>, rs2_value: bits<32>) {
  reg x: [bits<32>; 32] = [0; 32];
  rs1_value = x[rs1_address];
  rs2_value = x[rs2_address];
  next x[0] = 0;
  for i in 1..32 { next x[i] = if rd_write && rd_address == i { rd_value } else { x[i] }; }
}
module Alu(rs1_value: bits<32>, b: bits<32>, f3: bits<3>, is_reg: bit, ir30: bit) -> (result: bits<32>) {
  let shift: bits<5> = b[4:0];
  let subtract: bit = is_reg && ir30;
  let addend: bits<32> = if subtract { ~b } else { b };
  let carry: bits<32> = if subtract { 1 } else { 0 };
  let sum: bits<32> = rs1_value + addend + carry;
  let less_unsigned: bit = rs1_value < b;
  let less_signed: bit = if rs1_value[31] != b[31] { rs1_value[31] } else { less_unsigned };
  let shifted_right: bits<32> = rs1_value >> shift | (if ir30 && rs1_value[31] { ~(0xffffffff >> shift) } else { 0 });
  result = match f3 { _ => sum, 1 => rs1_value << shift, 2 => if less_signed { 1 } else { 0 }, 3 => if less_unsigned { 1 } else { 0 }, 4 => rs1_value ^ b, 5 => shifted_right, 6 => rs1_value | b, 7 => rs1_value & b, };
}
module riscv32(clk: clock, instruction: bits<32>, memory_value: bits<32>) -> (pc_out: bits<32>, target_misaligned: bit, executing: bit, memory_address: bits<32>, memory_write: bit, memory_read: bit, memory_width: bits<2>, memory_data: bits<32>, trap_code: bits<2>) {
  reg pc: bits<32> = 0; reg ir: bits<32> = 0; reg execute: bit = 0;
  let rs1_address: bits<5> = ir[19:15]; let rs2_address: bits<5> = ir[24:20]; let rd_address: bits<5> = ir[11:7];
  inst register_file: RegFile(clk: clk, rs1_address: rs1_address, rs2_address: rs2_address, rd_address: rd_address, rd_write: rd_write, rd_value: rd_value,);
  let rs1_value: bits<32> = register_file.rs1_value; let rs2_value: bits<32> = register_file.rs2_value;
  const zero1: bit = 0; const zero12: bits<12> = 0;
  let opcode: bits<7> = ir[6:0]; let f3: bits<3> = ir[14:12]; let f7: bits<7> = ir[31:25];
  let sign20: bits<20> = if ir[31] { 0xfffff } else { 0 }; let sign19: bits<19> = if ir[31] { 0x7ffff } else { 0 }; let sign11: bits<11> = if ir[31] { 0x7ff } else { 0 };
  let imm_i: bits<32> = concat(sign20, ir[31:20]); let imm_s: bits<32> = concat(sign20, ir[31:25], ir[11:7]);
  let imm_b: bits<32> = concat(sign19, ir[31], ir[7], ir[30:25], ir[11:8], zero1); let imm_u: bits<32> = concat(ir[31:12], zero12);
  let imm_j: bits<32> = concat(sign11, ir[31], ir[19:12], ir[20], ir[30:21], zero1);
  let is_reg: bit = opcode == 0x33; let is_imm: bit = opcode == 0x13; let is_load: bit = opcode == 0x03; let is_store: bit = opcode == 0x23;
  let is_branch: bit = opcode == 0x63; let is_jal: bit = opcode == 0x6f; let is_jalr: bit = opcode == 0x67;
  let b: bits<32> = if is_reg { rs2_value } else { imm_i };
  inst arithmetic: Alu(rs1_value: rs1_value, b: b, f3: f3, is_reg: is_reg, ir30: ir[30],);
  let alu: bits<32> = arithmetic.result;
  let branch_less: bit = if rs1_value[31] != rs2_value[31] { rs1_value[31] } else { rs1_value < rs2_value };
  let taken: bit = match f3 { _ => zero1, 0 => rs1_value == rs2_value, 1 => rs1_value != rs2_value, 4 => branch_less, 5 => !branch_less, 6 => rs1_value < rs2_value, 7 => rs1_value >= rs2_value, };
  let sign_byte: bits<24> = if memory_value[7] && !f3[2] { 0xffffff } else { 0 };
  let sign_half: bits<16> = if memory_value[15] && !f3[2] { 0xffff } else { 0 };
  let loaded: bits<32> = match f3[1:0] { _ => memory_value, 0 => concat(sign_byte, memory_value[7:0]), 1 => concat(sign_half, memory_value[15:0]), };
  let valid_alu: bit = if is_reg { f7 == 0 || f7 == 0x20 && (f3 == 0 || f3 == 5) } else { f3 != 1 && f3 != 5 || f3 == 1 && f7 == 0 || f3 == 5 && (f7 == 0 || f7 == 0x20) };
  let valid: bit = match opcode { _ => zero1, 0x37 | 0x17 | 0x6f => 1, 0x67 => f3 == 0, 0x63 => f3 == 0 || f3 == 1 || f3 >= 4, 0x03 => f3 == 0 || f3 == 1 || f3 == 2 || f3 == 4 || f3 == 5, 0x23 => f3 <= 2, 0x13 | 0x33 => valid_alu, 0x0f => f3 == 0 || f3 == 1, 0x73 => ir == 0x00000073 || ir == 0x00100073, };
  let trap: bits<2> = if !valid { 1 } else if ir == 0x00000073 { 2 } else if ir == 0x00100073 { 3 } else { 0 };
  let next_pc: bits<32> = if is_jal { pc + imm_j } else if is_jalr { rs1_value + imm_i & 0xfffffffe } else if is_branch && taken { pc + imm_b } else { pc + 4 };
  next ir = if !execute { instruction } else { ir };
  next pc = if execute && trap == 0 { next_pc } else { pc };
  next execute = !execute;
  pc_out = pc; target_misaligned = next_pc[1]; executing = execute;
  let rd_write: bit = execute && trap == 0 && (is_reg || is_imm || is_load || is_jal || is_jalr || opcode == 0x37 || opcode == 0x17);
  let rd_value: bits<32> = match opcode { _ => alu, 0x03 => loaded, 0x37 => imm_u, 0x17 => pc + imm_u, 0x6f | 0x67 => pc + 4, };
  memory_address = rs1_value + (if is_store { imm_s } else { imm_i });
  memory_write = execute && is_store && valid; memory_read = execute && is_load && valid; memory_width = f3[1:0]; memory_data = rs2_value;
  trap_code = if execute { trap } else { 0 };
}
