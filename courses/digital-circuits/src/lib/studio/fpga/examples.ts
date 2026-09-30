/**
 * The designs the FPGA Studio offers: the reference designs of `content/designs/*.dcl` (counter, traffic light,
 * ALU, …), and a hexadecimal counter written for the virtual board. Chapters name them by id:
 * `::fpga-studio{design="counter"}`.
 */
import { designSource } from '../../widgets/dcl/designs';
import type { VFpgaSize } from './types';

export interface FpgaExample {
  id: string;
  title: string;
  blurb: string;
  source: string;
  /** The smallest device it fits (the flow picks S, M or L itself; this is what the widgets ask for). */
  size: VFpgaSize;
  /** Takes long enough to warn about (seconds, not milliseconds). */
  heavy?: boolean;
}

/** A 16-bit counter on the board's four 7-segment digits, with buttons to pause, count down and clear. */
export const HEX_COUNTER = `/// A 16-bit counter shown on the board's four hexadecimal digits.
/// Buttons: btn[0] pauses, btn[1] counts down, btn[2] clears, btn[3] counts 256 at a time.
/// The switch sw[0] chooses which byte the LEDs show. seg[0] is segment a … seg[6] is g.
fn hex(n: bits<4>) -> bits<7> {
  match n {
    _ => 0x71,
    0 => 0x3f,
    1 => 0x06,
    2 => 0x5b,
    3 => 0x4f,
    4 => 0x66,
    5 => 0x6d,
    6 => 0x7d,
    7 => 0x07,
    8 => 0x7f,
    9 => 0x6f,
    10 => 0x77,
    11 => 0x7c,
    12 => 0x39,
    13 => 0x5e,
    14 => 0x79,
  }
}

top module HexCounter(
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
) {
  reg count: bits<16> = 0

  let stride: bits<16> = if btn[3] { 256 } else { 1 }
  next count = if rst || btn[2] {
    0
  } else if btn[0] {
    count
  } else if btn[1] {
    count - stride
  } else {
    count + stride
  }

  led = if sw[0] { count[15:8] } else { count[7:0] }
  seg0 = hex(count[3:0])
  seg1 = hex(count[7:4])
  seg2 = hex(count[11:8])
  seg3 = hex(count[15:12])
}

test "counts in hexadecimal" {
  let c = sim HexCounter(rst: 0, btn: 0, sw: 0)
  step 17
  expect c.led == 17 && c.seg0 == 0x06 && c.seg1 == 0x06
}
`;

const fromFile = (src: string): string => designSource(src) ?? `// design ${src} not found\n`;

export const FPGA_EXAMPLES: FpgaExample[] = [
  { id: 'counter', title: 'Counter', blurb: 'A 4-bit counter with enable and clear: four flip-flops and a small adder.', source: fromFile('counter'), size: 'S' },
  { id: 'traffic-light', title: 'Traffic light', blurb: 'The British sequence as a finite-state machine.', source: fromFile('traffic-light'), size: 'S' },
  { id: 'hex-counter', title: 'Hex counter (board)', blurb: 'A 16-bit counter on the board’s four 7-segment digits, with buttons and switches.', source: HEX_COUNTER, size: 'M' },
  { id: 'alu', title: 'ALU (32-bit)', blurb: 'The RV32I core’s arithmetic and logic unit: adder, comparators, barrel shifter.', source: fromFile('alu'), size: 'M' },
  { id: 'regfile', title: 'Register file', blurb: '32 registers of 32 bits, two read ports and a write port, all flip-flops.', source: fromFile('regfile'), size: 'L', heavy: true },
  { id: 'rv32i', title: 'RV32I core', blurb: 'A multi-cycle RV32I processor for vFPGA-L. At present the router cannot finish it (the fit stops in routing and says so): the toolchain’s job to fix, kept here as the Chapter 31 goal.', source: fromFile('rv32i'), size: 'L', heavy: true },
];

export const fpgaExample = (id: string | null | undefined): FpgaExample | undefined => FPGA_EXAMPLES.find((e) => e.id === id);

/** The example a source came from, if it is unchanged. */
export const exampleOfSource = (source: string): FpgaExample | undefined => FPGA_EXAMPLES.find((e) => e.source === source);
