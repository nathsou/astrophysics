// The RV32I core of content/designs/rv32i.dcl on the board. The core has no memory of its own: it is handed the
// instruction at its program counter and the word that a load asks for, so this wrapper supplies both.
//
// The instructions are a ROM made of logic (a `match` on the word number), and the devices sit where the reference
// interpreter puts them, at the top of the address space: LEDS 0xFFFFFF08, SWITCHES 0xFFFFFF0C, BUTTONS
// 0xFFFFFF10 and HEX 0xFFFFFF14. Loads from anywhere else read 0, and stores there are dropped.
// Only word stores to the devices are modelled. The left two digits show the program counter.
//
// This file follows the core's source: `rv32BoardSource` in widgets/rv32-board.ts puts the two together.

/// The program: one instruction per word, from address 0. A word that is not listed is 0, an illegal instruction.
fn program(word: bits<6>) -> bits<32> {
  match word {
    _ => 0,
  }
}

/// The RV32I core on the board.
top module Rv32Board(
  clk: clock,
  btn: bits<4>,
  sw: bits<8>,
) -> (
  led: bits<8>,
  seg0: bits<7>,
  seg1: bits<7>,
  seg2: bits<7>,
  seg3: bits<7>,
  trap: bits<2>,
) {
  reg leds: bits<8> = 0
  reg hex: bits<16> = 0

  inst core: riscv32(clk: clk, instruction: program(core.pc_out[7:2]), memory_value: read_value)

  let address: bits<32> = core.memory_address
  let is_device: bit = address[31:8] == 0xffffff
  let read_value: bits<32> = if is_device {
    match address[7:0] {
      _ => 0,
      0x08 => zext(leds, 32),
      0x0c => zext(sw, 32),
      0x10 => zext(btn, 32),
      0x14 => zext(hex, 32),
    }
  } else {
    0
  }
  let device_write: bit = core.memory_write && is_device && core.memory_width == 2
  next leds = if device_write && address[7:0] == 0x08 { core.memory_data[7:0] } else { leds }
  next hex = if device_write && address[7:0] == 0x14 { core.memory_data[15:0] } else { hex }

  led = leds
  seg0 = digit(hex[3:0])
  seg1 = digit(hex[7:4])
  seg2 = digit(core.pc_out[3:0])
  seg3 = digit(core.pc_out[7:4])
  trap = core.trap_code
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
