/**
 * The architecture of the virtual FPGAs (vFPGA-S, -M and -L): the numbers everything else is built from.
 *
 * The family is modelled on the Lattice iCE40 (its logic cell, its span-4 and span-12 wires, its block RAM
 * and global clocks), scaled down so that a whole device can be simulated, drawn and, for S, configured by
 * hand. What is different from the iCE40 is listed in `vfpga.ts`.
 *
 * ## Tiles
 *
 * The die is a grid of tiles, `cols + 2` wide and `rows + 2` high, with x to the right and y upwards:
 *
 * ```
 *   .  IO IO IO IO  .        y = rows + 1
 *   IO L  L  R  L  IO        R = block RAM column (M and L only)
 *   IO L  L  R  L  IO
 *   .  IO IO IO IO  .        y = 0     ('.' = empty corner)
 * ```
 *
 * - a **logic tile** holds 8 logic cells; every cell is a 4-input LUT with a D flip-flop, a bypass multiplexer
 *   that picks the LUT or the flip-flop for the cell's output, and carry logic;
 * - an **I/O tile** holds `padsPerTile` pads;
 * - a **block RAM tile** holds one 4 Kbit dual-port RAM (one read port, one write port);
 * - every non-empty tile also holds a **switch box**: the multiplexers that drive the wires starting in the tile,
 *   and the **connection box**: the multiplexers that feed the tile's pins from the wires arriving at it.
 *
 * ## Timing: the published delay model
 *
 * One table of delays (nanoseconds) is used everywhere: by the router as node costs, by static timing analysis,
 * and by the fabric simulator as element delays, so the three agree.
 */

export const LCS_PER_TILE = 8;
export const LUT_INPUTS = 4;
/** Configuration bits of one logic cell: 16 LUT bits and 9 flags (see `vfpga-config.ts`). */
export const LC_BITS = 25;
/** Block RAM capacity in bits. */
export const BRAM_BITS = 4096;
/** Widths a block RAM can be configured for (`mode` 0…3): 256×16, 512×8, 1024×4, 2048×2. */
export const BRAM_WIDTHS = [16, 8, 4, 2] as const;
export const BRAM_ADDR_PINS = 11;
export const BRAM_DATA_PINS = 16;

/** The delay model (ns). */
export const VFPGA_DELAYS = {
  /** Any LUT input to the LUT output. */
  lut: 0.5,
  /** Flip-flop clock to Q. */
  ffClkToQ: 0.3,
  /** Flip-flop set-up time (D, CE and SR pins). */
  ffSetup: 0.2,
  /** Flip-flop hold time (not modelled by the fabric simulator; reported as a constant). */
  ffHold: 0.05,
  /** Every routing multiplexer a signal passes (switch-box and connection-box multiplexers). */
  switch: 0.1,
  /** Wire segments, by span. A wire node's delay is its switch plus its segment. */
  span1: 0.2,
  span4: 0.4,
  span12: 0.8,
  /** Carry logic: carry-in to carry-out, and the operand pins I1, I2 to carry-out. */
  carryIn: 0.1,
  carryData: 0.3,
  /** I/O: input buffer (pad to fabric) and output buffer (fabric to pad). */
  padIn: 0.5,
  padOut: 0.8,
  /** Block RAM: clock to data out (synchronous read), read address to data (asynchronous mode), set-up. */
  bramClkToQ: 1.2,
  bramAsync: 1.5,
  bramSetup: 0.4,
  /** The global clock network is ideal: every flip-flop sees the clock edge at the same time. */
  gclk: 0,
} as const;

export type VFpgaSize = 'S' | 'M' | 'L';

export interface VFpgaSpec {
  name: 'vFPGA-S' | 'vFPGA-M' | 'vFPGA-L';
  size: VFpgaSize;
  /** Interior columns (logic and block RAM columns) and rows. */
  cols: number;
  rows: number;
  /** x of the block RAM columns (1-based interior coordinates). */
  bramCols: number[];
  padsPerTile: number;
  /** Wires per direction and tile, by span. */
  tracks: { s1: number; s4: number; s12: number };
  /** Connection box: how many arriving wires and local outputs each pin can select from. */
  cbWires: number;
  cbLocal: number;
  /** Number of global clock networks. */
  globals: number;
}

export const VFPGA_SPECS: Record<VFpgaSize, VFpgaSpec> = {
  S: {
    name: 'vFPGA-S',
    size: 'S',
    cols: 2,
    rows: 2,
    bramCols: [],
    padsPerTile: 2,
    tracks: { s1: 4, s4: 0, s12: 0 },
    cbWires: 8,
    cbLocal: 4,
    globals: 4,
  },
  // 12 × 12 logic tiles = 1,152 cells, plus two block RAM columns. Octet is meant to use about two thirds of it.
  // The connection boxes are rich: a pin can pick 27 of the 40 wires that arrive at its tile (Fc_in = 0.68; the
  // 27 + 4 local inputs still fit five select bits). With 16 of the 40 a design of 740 cells (64 % of M) sometimes
  // did not route at all: once the packer fills tiles densely, the wires a pin can see are all taken by other nets.
  M: {
    name: 'vFPGA-M',
    size: 'M',
    cols: 14,
    rows: 12,
    bramCols: [4, 11],
    padsPerTile: 4,
    tracks: { s1: 4, s4: 4, s12: 2 },
    cbWires: 27,
    cbLocal: 4,
    globals: 8,
  },
  // 32 × 32 logic tiles = 8,192 cells, plus two block RAM columns. The RV32I core (about 4,500 cells: 56 % of the
  // cells, 576 of the 1,024 logic tiles) is the design it is sized for. It has M's channels and M's connection boxes.
  // With 16-of-40 connection boxes the core does not route however long the router negotiates (it ends with a few
  // dozen overused nodes, or two nets fight over one node for dozens of iterations); with 27-of-40 it takes about a
  // dozen iterations. Widening the channels instead would need 6 span-4 and 3 span-12 wires per direction (13 wires
  // per tile and direction instead of 10, and about 30 % more wires on the die).
  L: {
    name: 'vFPGA-L',
    size: 'L',
    cols: 34,
    rows: 32,
    bramCols: [9, 26],
    padsPerTile: 4,
    tracks: { s1: 4, s4: 4, s12: 2 },
    cbWires: 27,
    cbLocal: 4,
    globals: 8,
  },
};
