/// Octet's hardwired control logic: which control lines are on in stage `stage` of the instruction in `ir`.
/// Steps 0 and 1 fetch, step 2 decodes, steps 3 to 7 are the instruction's own micro-steps.
module OctetDecode(
  stage: bits<3>,
  ir: bits<8>,
  taken: bit,
) -> (
  oe_rd: bit,
  oe_rs: bit,
  oe_pc: bit,
  oe_sp: bit,
  oe_alu: bit,
  oe_mem: bit,
  oe_t: bit,
  ld_mar: bit,
  ld_ir: bit,
  ld_a: bit,
  ld_b: bit,
  ld_t: bit,
  we_r: bit,
  ld_flags: bit,
  pc_ld: bit,
  pc_inc: bit,
  sp_inc: bit,
  sp_dec: bit,
  mem_wr: bit,
  alu_op: bits<3>,
  bsel_a: bit,
  bsel_1: bit,
  halt: bit,
  last: bit,
) {
  // One signal per instruction, from the bits of IR (the "AND gates" of the hardwired unit).
  let op: bits<4> = ir[7:4]
  let sub: bits<2> = ir[1:0]
  let hlt: bit = op == 0
  let mov: bit = op == 1
  let ldi: bit = op == 2
  let ld: bit = op == 3
  let st: bit = op == 4
  let ldr: bit = op == 5
  let str: bit = op == 6
  let push: bit = op == 7 && sub == 0
  let pop: bit = op == 7 && sub == 1
  let call: bit = op == 7 && sub == 2
  let ret: bit = op == 7 && sub == 3
  let alu2: bit = op >= 8 && op <= 12
  let cmp: bit = op == 13
  let shl: bit = op == 14 && sub == 0
  let shr: bit = op == 14 && sub == 1
  let not: bit = op == 14 && sub == 2
  let inc: bit = op == 14 && sub == 3
  let unary: bit = op == 14
  let jcc: bit = op == 15

  // One signal per step.
  let f0: bit = stage == 0
  let f1: bit = stage == 1
  let x1: bit = stage == 3
  let x2: bit = stage == 4
  let x3: bit = stage == 5
  let x4: bit = stage == 6
  let x5: bit = stage == 7

  // Each line is an OR of (instruction AND step) terms.
  oe_pc = f0 || (x1 && (ldi || ld || st || call || jcc)) || (x4 && call)
  oe_mem = f1 || (x2 && (ldi || ld || st || call || ldr || pop || ret || jcc)) || (x3 && ld)
  oe_rd = (x1 && (str || alu2 || cmp || unary)) || (x3 && (st || push))
  oe_rs = (x1 && (mov || ldr)) || (x2 && (str || alu2 || cmp))
  oe_sp = (x1 && (pop || ret)) || (x2 && push) || (x3 && call)
  oe_alu = (x3 && alu2) || (x2 && unary)
  oe_t = x5 && call
  ld_mar = f0
    || (x1 && (ld || st || ldi || ldr || str || pop || call || ret || jcc))
    || (x2 && (ld || st || push))
    || (x3 && call)
  ld_ir = f1
  ld_a = x1 && (alu2 || cmp || unary)
  ld_b = x2 && (alu2 || cmp)
  ld_t = x2 && call
  we_r = (x1 && mov) || (x2 && (ldi || ldr || pop || unary)) || (x3 && (ld || alu2))
  ld_flags = (x3 && (alu2 || cmp)) || (x2 && unary)
  pc_ld = (x5 && call) || (x2 && ret) || (x2 && jcc && taken)
  pc_inc = f1 || (x2 && (ldi || ld || st || call)) || (x2 && jcc && !taken)
  sp_inc = x2 && (pop || ret)
  sp_dec = (x1 && (push || call))
  mem_wr = (x3 && (st || push)) || (x2 && str) || (x4 && call)
  halt = hlt && x1
  last = (x1 && mov)
    || (x2 && (ldi || ldr || str || pop || ret || jcc || unary))
    || (x3 && (ld || st || push || alu2 || cmp))
    || (x5 && call)

  // The ALU's operation is the opcode minus 8 for ADD to XOR, and is only asked for while the ALU is in use.
  let in_alu: bit = (x3 && (alu2 || cmp)) || (x2 && unary)
  alu_op = if !in_alu {
    0
  } else if alu2 {
    op[2:0]
  } else if cmp {
    1
  } else if shr {
    6
  } else if not {
    7
  } else {
    0
  }
  bsel_a = in_alu && shl
  bsel_1 = in_alu && inc
}

/// The step counter: it counts on the clock and starts again after the last step of an instruction.
module OctetSequencer(clk: clock, last: bit, halt: bit) -> (stage: bits<3>) {
  reg count: bits<3> = 0
  next count = if halt { count } else if last { 0 } else { count + 1 }
  stage = count
}

test "ADD R1, R2 asks for exactly three transfers after the fetch" {
  let d = sim OctetDecode(stage: 3, ir: 0x86, taken: 0)
  expect d.oe_rd && d.ld_a && !d.oe_rs && !d.last
  d.stage = 4
  expect d.oe_rs && d.ld_b && !d.oe_rd
  d.stage = 5
  expect d.oe_alu && d.we_r && d.ld_flags && d.last && d.alu_op == 0
  d.stage = 6
  expect !d.oe_alu && !d.we_r && !d.last
}

test "a jump loads the PC only if it is taken" {
  let d = sim OctetDecode(stage: 4, ir: 0xf3, taken: 1)
  expect d.pc_ld && !d.pc_inc && d.oe_mem
  d.taken = 0
  expect !d.pc_ld && d.pc_inc
}

test "every fetch is the same, whatever IR holds" {
  let d = sim OctetDecode(stage: 0, ir: 0xff, taken: 1)
  expect d.oe_pc && d.ld_mar && !d.oe_mem
  d.ir = 0x00
  d.stage = 1
  expect d.oe_mem && d.ld_ir && d.pc_inc
}
