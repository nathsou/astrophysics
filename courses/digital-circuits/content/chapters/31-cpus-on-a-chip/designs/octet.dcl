// Octet on a chip: the datapath of Chapter 21 and the hardwired control unit of Chapter 22, written as text.
//
// The memory is a block RAM, so the program is the RAM's initial contents: the table PROGRAM at the end of the
// file. The devices are the ones the virtual board has: 0xF8 LEDS, 0xF9 SWITCHES, 0xFA BUTTONS, 0xFB HEX,
// 0xFC CONSOLE (write only) and 0xFD RANDOM. The other device addresses read 0 and ignore writes.

/// Octet's ALU. Codes: 0 ADD, 1 SUB, 2 AND, 3 OR, 4 XOR, 6 SHR, 7 NOT. SHL is ADD a, a and INC is ADD a, 1.
/// `c` is the carry, or the borrow after a subtraction.
module Alu(a: bits<8>, b: bits<8>, op: bits<3>) -> (y: bits<8>, c: bit, v: bit) {
  let subtract: bit = op == 1
  let addend: bits<8> = if subtract { ~b } else { b }
  let carry_in: bits<9> = if subtract { 1 } else { 0 }
  let wide: bits<9> = zext(a, 9) + zext(addend, 9) + carry_in
  let arithmetic: bit = op == 0 || op == 1
  let result: bits<8> = match op {
    _ => wide[7:0],
    2 => a & b,
    3 => a | b,
    4 => a ^ b,
    6 => a >> 1,
    7 => ~a,
  }
  y = result
  c = if arithmetic { wide[8] != subtract } else if op == 6 { a[0] } else { 0 }
  v = arithmetic && a[7] == addend[7] && result[7] != a[7]
}

/// Which control lines are on in step `stage` of the instruction in `ir`: Chapter 22's `OctetDecode`, unchanged.
/// Steps 0 and 1 fetch, step 2 decodes, steps 3 to 7 are the instruction's own micro-steps.
module Control(
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

  let f0: bit = stage == 0
  let f1: bit = stage == 1
  let x1: bit = stage == 3
  let x2: bit = stage == 4
  let x3: bit = stage == 5
  let x4: bit = stage == 6
  let x5: bit = stage == 7

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

/// Gate a byte with an enable: the AND that stands in for a tri-state driver.
fn drive(enable: bit, x: bits<8>) -> bits<8> {
  repeat(enable, 8) & x
}

/// Octet, on the board: `sw` and `btn` are the switches and buttons, `led` the LEDs. The left two digits show
/// the program counter, the right two the HEX register. `console` is the byte of the last write to CONSOLE.
top module Octet(
  clk: clock,
  rst: bit,
  btn: bits<4>,
  sw: bits<8>,
) -> (
  led: bits<8>,
  seg0: bits<7>,
  seg1: bits<7>,
  seg2: bits<7>,
  seg3: bits<7>,
  halted: bit,
  console: bits<8>,
  console_write: bit,
) {
  // The programmer's registers, and the datapath's own.
  reg pc: bits<8> = 0
  reg sp: bits<8> = 0xf0
  reg r: [bits<8>; 4] = [0; 4]
  reg z: bit = 0
  reg c: bit = 0
  reg n: bit = 0
  reg v: bit = 0
  reg ir: bits<8> = 0
  reg mar: bits<8> = 0
  reg a: bits<8> = 0
  reg b: bits<8> = 0
  reg t: bits<8> = 0
  reg stage: bits<3> = 0

  // The devices.
  reg leds: bits<8> = 0
  reg hex: bits<8> = 0
  reg lfsr: bits<8> = 1
  reg said: bits<8> = 0
  reg said_now: bit = 0

  let rd: bits<2> = ir[3:2]
  let rs: bits<2> = ir[1:0]

  // The jump condition: three bits of the instruction choose one of eight tests, the fourth inverts it.
  let holds: bit = match ir[3:1] {
    0 => 1,
    1 => z,
    2 => c,
    3 => n,
    4 => v,
    5 => n != v,
    6 => c || z,
    7 => z || n != v,
  }
  inst control: Control(stage: stage, ir: ir, taken: holds != ir[0])

  // Memory: a block RAM. It answers one cycle after it is given an address, so it is given the address that MAR
  // is about to have, and the byte arrives in the cycle in which Chapter 22's memory would have shown it.
  mem ram: [bits<8>; 240] = PROGRAM
  let address: bits<8> = if control.ld_mar { bus_without_memory } else { mar }
  let ram_byte: bits<8> = ram.read(address)
  // LD and ST load MAR from memory (MAR ← M[MAR]) and then read at that address. A second read port, addressed
  // by the first port's output, has that byte ready in the next cycle.
  let ram_indirect: bits<8> = ram.read(ram_byte)
  reg indirect: bit = 0
  next indirect = control.ld_mar && control.oe_mem
  let is_device: bit = mar[7:4] == 0xf
  ram.write(mar, bus, control.mem_wr && !is_device && !rst)

  let lfsr_step: bits<8> = if lfsr[0] { lfsr >> 1 ^ 0xb8 } else { lfsr >> 1 }
  let device_out: bits<8> = match mar[3:0] {
    _ => 0,
    8 => leds,
    9 => sw,
    10 => zext(btn, 8),
    11 => hex,
    13 => lfsr_step,
  }
  let mem_value: bits<8> = if is_device {
    device_out
  } else if indirect {
    ram_indirect
  } else {
    ram_byte
  }

  // The bus: one AND per driver, and an OR that merges them (the control unit turns on at most one).
  let rd_value: bits<8> = r[rd]
  let rs_value: bits<8> = r[rs]
  inst alu: Alu(
    a: a,
    b: if control.bsel_1 { 1 } else if control.bsel_a { a } else { b },
    op: control.alu_op,
  )
  let bus_without_memory: bits<8> = drive(control.oe_rd, rd_value)
    | drive(control.oe_rs, rs_value)
    | drive(control.oe_pc, pc)
    | drive(control.oe_sp, sp)
    | drive(control.oe_alu, alu.y)
    | drive(control.oe_t, t)
  let bus: bits<8> = bus_without_memory | drive(control.oe_mem, mem_value)

  next pc = if rst { 0 } else if control.pc_ld { bus } else if control.pc_inc { pc + 1 } else { pc }
  next sp = if rst {
    0xf0
  } else if control.sp_inc {
    sp + 1
  } else if control.sp_dec {
    sp - 1
  } else {
    sp
  }
  for i in 0..4 {
    next r[i] = if rst { 0 } else if control.we_r && rd == i { bus } else { r[i] }
  }
  next z = if rst { 0 } else if control.ld_flags { alu.y == 0 } else { z }
  next c = if rst { 0 } else if control.ld_flags { alu.c } else { c }
  next n = if rst { 0 } else if control.ld_flags { alu.y[7] } else { n }
  next v = if rst { 0 } else if control.ld_flags { alu.v } else { v }
  next ir = if control.ld_ir { bus } else { ir }
  next mar = if control.ld_mar { bus } else { mar }
  next a = if control.ld_a { bus } else { a }
  next b = if control.ld_b { bus } else { b }
  next t = if control.ld_t { bus } else { t }
  next stage = if rst {
    0
  } else if control.halt {
    stage
  } else if control.last {
    0
  } else {
    stage + 1
  }

  // Writes to the devices, and the read of RANDOM that steps its generator.
  let write_device: bit = control.mem_wr && is_device
  let read_random: bit = control.oe_mem && is_device && mar[3:0] == 13
  next leds = if rst { 0 } else if write_device && mar[3:0] == 8 { bus } else { leds }
  next hex = if rst { 0 } else if write_device && mar[3:0] == 11 { bus } else { hex }
  next lfsr = if rst {
    1
  } else if write_device && mar[3:0] == 13 && bus != 0 {
    bus
  } else if read_random {
    lfsr_step
  } else {
    lfsr
  }
  next said = if write_device && mar[3:0] == 12 { bus } else { said }
  next said_now = write_device && mar[3:0] == 12

  led = leds
  seg0 = digit(hex[3:0])
  seg1 = digit(hex[7:4])
  seg2 = digit(pc[3:0])
  seg3 = digit(pc[7:4])
  halted = control.halt
  console = said
  console_write = said_now
}

/// A hexadecimal digit as seven segments.
fn digit(value: bits<4>) -> bits<7> {
  match value {
    0x0 => 0x3f,
    0x1 => 0x06,
    0x2 => 0x5b,
    0x3 => 0x4f,
    0x4 => 0x66,
    0x5 => 0x6d,
    0x6 => 0x7d,
    0x7 => 0x07,
    0x8 => 0x7f,
    0x9 => 0x6f,
    0xa => 0x77,
    0xb => 0x7c,
    0xc => 0x39,
    0xd => 0x5e,
    0xe => 0x79,
    0xf => 0x71,
  }
}

test "SUB sets the borrow, ADD the overflow" {
  let alu = sim Alu(a: 3, b: 5, op: 1)
  expect alu.y == 0xfe && alu.c && !alu.v
  alu.a = 0x7f
  alu.b = 1
  alu.op = 0
  expect alu.y == 0x80 && !alu.c && alu.v
  alu.a = 0xff
  expect alu.y == 0 && alu.c && !alu.v
}

test "SHR puts the bit that falls off in the carry" {
  let alu = sim Alu(a: 0x81, b: 0, op: 6)
  expect alu.y == 0x40 && alu.c && !alu.v
  alu.a = 0x80
  expect alu.y == 0x40 && !alu.c
}

test "a light walks along the LEDs" {
  let cpu = sim Octet(rst: 0, btn: 0, sw: 0)
  step 23
  expect cpu.led == 0
  step
  expect cpu.led == 1
  step 125
  expect cpu.led == 2
  step 125
  expect cpu.led == 4
}

test "the hex display counts the steps, and the left digits show the program counter" {
  let cpu = sim Octet(rst: 0, btn: 0, sw: 0)
  step 35
  expect cpu.seg0 == 0x06 && cpu.seg1 == 0x3f
  expect cpu.seg3 == 0x06 && cpu.seg2 == 0x6f
}

test "reset starts the program again" {
  let cpu = sim Octet(rst: 0, btn: 0, sw: 0)
  step 200
  expect cpu.led != 0
  cpu.rst = 1
  step
  cpu.rst = 0
  expect cpu.led == 0 && cpu.seg0 == 0x3f
  step 24
  expect cpu.led == 1
}

/// The program: the bytes of walk.asm (Figure 31.3), from address 0, and zeros (HLT) after them.
const PROGRAM: [bits<8>; 240] = [
  0x24,
  0x00,
  0x20,
  0x01,
  0x72,
  0x14,
  0xe0,
  0xf5,
  0x04,
  0x20,
  0x40,
  0x72,
  0x14,
  0xe1,
  0xf5,
  0x0b,
  0x20,
  0x02,
  0xf0,
  0x04,
  0x40,
  0xf8,
  0xe7,
  0x44,
  0xfb,
  0x28,
  0xf8,
  0xeb,
  0xf3,
  0x1b,
  0x73,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
  0x00,
]
