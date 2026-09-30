/**
 * One-transistor, one-capacitor memory: how much a cell shows the bit line, how fast a stored 1 leaks away, and
 * what refreshing does about it. The numbers are round figures of the right order for a modern DRAM (a supply
 * of 1.2 V as in DDR4, a cell of about 20 fF on a bit line eight times bigger); the point is the ratios.
 *
 *   read:  the bit line is precharged to Vdd/2, the word line connects the cell to it, and the two share their
 *          charge:  V = (Cs·Vcell + Cbl·Vdd/2) / (Cs + Cbl).  The swing is only Cs/(Cs + Cbl) of what the cell
 *          held above or below the middle: tens of millivolts. A sense amplifier turns it into a 0 or a 1.
 *   leak:  a stored 1 is charge on Cs, and it drains through the off transistor and the junction: V(t) = Vdd·e^(−t/τ).
 *          It is a 1 as long as the swing it gives is still bigger than the sense amplifier can tell from noise.
 *   heat:  leakage grows with temperature; retention time roughly halves for every 10 °C.
 */

export const DRAM = {
  /** Supply (V). */
  vdd: 1.2,
  /** Storage capacitor (F). */
  cs: 20e-15,
  /** Bit line capacitance (F): a long wire touching thousands of transistors. */
  cbl: 160e-15,
  /** Smallest swing (V) the sense amplifier resolves reliably, allowing for its offset and for noise. */
  minSwing: 0.03,
  /** The temperature (°C) at which `retentionAt85` is given. */
  refTemp: 85,
  /** JEDEC's refresh window (s) and the number of refresh commands in it (DDR4). */
  window: 0.064,
  refreshCommands: 8192,
} as const;

/** Voltage of a bit line after sharing charge with a cell. */
export function chargeShare(vCell: number, vPre: number = DRAM.vdd / 2, cs: number = DRAM.cs, cbl: number = DRAM.cbl): number {
  return (cs * vCell + cbl * vPre) / (cs + cbl);
}

/** How far the bit line moves from its precharge level when it meets a cell at `vCell`. */
export const swing = (vCell: number, vPre: number = DRAM.vdd / 2, cs: number = DRAM.cs, cbl: number = DRAM.cbl): number => chargeShare(vCell, vPre, cs, cbl) - vPre;

/** The lowest cell voltage that a stored 1 may drain to before the swing is too small to sense. */
export function minCellVoltage(minSwing: number = DRAM.minSwing, cs: number = DRAM.cs, cbl: number = DRAM.cbl): number {
  return DRAM.vdd / 2 + (minSwing * (cs + cbl)) / cs;
}

/** Voltage of a leaking cell that started at `v0` after `t` seconds, with time constant `tau`. */
export const leak = (v0: number, t: number, tau: number): number => v0 * Math.exp(-t / tau);

/** The time constant that makes a stored 1 unreadable after `retention` seconds. */
export function tauFor(retention: number): number {
  return retention / Math.log(DRAM.vdd / minCellVoltage());
}

/** Retention scales with temperature: it halves for every 10 °C above the reference (doubles below). */
export const tempFactor = (celsius: number): number => 2 ** ((DRAM.refTemp - celsius) / 10);

// ── The array ──────────────────────────────────────────────────────────────────

export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal numbers from a uniform generator (Box–Muller). */
export function gaussian(rand: () => number): () => number {
  return () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

export interface CellOptions {
  /** The median retention (s) at 85 °C. */
  median: number;
  /** The spread: retention is log-normal with this σ of ln(t). */
  sigma: number;
}

export const DEFAULT_CELLS: CellOptions = { median: 1.5, sigma: 0.9 };

/**
 * Retention times at 85 °C of `n` cells: log-normal, because leakage paths add up as products of many
 * small factors. Real retention distributions have a long tail of weak cells (the ones that set the refresh
 * interval), which this reproduces.
 */
export function retentions(n: number, seed: number, o: CellOptions = DEFAULT_CELLS): number[] {
  const g = gaussian(prng(seed));
  return Array.from({ length: n }, () => o.median * Math.exp(o.sigma * g()));
}

export interface DramSim {
  rows: number;
  cols: number;
  /** What was written: the bits that should be read back. */
  data: number[][];
  /** The voltage on each storage capacitor. */
  v: number[][];
  /** What each cell would show at 85 °C: how long (s) a stored 1 stays readable. */
  retention: number[][];
  /** Cells whose bit has been lost. */
  lost: boolean[][];
  time: number;
  refreshes: number;
  /** The row refreshed next, and the time (s) at which it is due. */
  nextRow: number;
  nextDue: number;
}

export function createDram(rows: number, cols: number, seed = 7, o: CellOptions = DEFAULT_CELLS): DramSim {
  const r = retentions(rows * cols, seed, o);
  return {
    rows,
    cols,
    data: Array.from({ length: rows }, () => Array<number>(cols).fill(0)),
    v: Array.from({ length: rows }, () => Array<number>(cols).fill(0)),
    retention: Array.from({ length: rows }, (_, i) => r.slice(i * cols, (i + 1) * cols)),
    lost: Array.from({ length: rows }, () => Array<boolean>(cols).fill(false)),
    time: 0,
    refreshes: 0,
    nextRow: 0,
    nextDue: 0,
  };
}

/** Write a whole pattern (fully charged 1s, empty 0s) and forget any earlier losses. */
export function load(sim: DramSim, pattern: number[][]): void {
  for (let r = 0; r < sim.rows; r++)
    for (let c = 0; c < sim.cols; c++) {
      const bit = pattern[r]?.[c] ? 1 : 0;
      sim.data[r]![c] = bit;
      sim.v[r]![c] = bit ? DRAM.vdd : 0;
      sim.lost[r]![c] = false;
    }
  sim.time = 0;
  sim.refreshes = 0;
  sim.nextRow = 0;
}

/** The sense amplifier's verdict on a cell: 1 only while it still swings the bit line enough. */
export const sensed = (vCell: number): number => (swing(vCell) >= DRAM.minSwing ? 1 : 0);

/** Read a row and write it back at full strength (what a refresh does). Returns the number of bits lost by it. */
export function refreshRow(sim: DramSim, row: number): number {
  let lostNow = 0;
  for (let c = 0; c < sim.cols; c++) {
    const bit = sensed(sim.v[row]![c]!);
    if (bit !== sim.data[row]![c] && !sim.lost[row]![c]) {
      sim.lost[row]![c] = true;
      lostNow++;
    }
    sim.v[row]![c] = bit ? DRAM.vdd : 0;
    if (sim.lost[row]![c]) sim.data[row]![c] = bit;
  }
  sim.refreshes++;
  return lostNow;
}

/**
 * Let `dt` seconds pass at `celsius`. Every stored 1 drains; if `interval` (s) is given, the rows are refreshed
 * in turn, one every `interval / rows`, so that each is refreshed once per interval; `null` never refreshes.
 */
export function advance(sim: DramSim, dt: number, celsius: number, interval: number | null): void {
  const factor = tempFactor(celsius);
  const end = sim.time + dt;
  const gap = interval === null ? Infinity : interval / sim.rows;
  const drain = (span: number) => {
    if (span <= 0) return;
    for (let r = 0; r < sim.rows; r++)
      for (let c = 0; c < sim.cols; c++) {
        const v = sim.v[r]![c]!;
        if (v > 0) sim.v[r]![c] = leak(v, span, tauFor(sim.retention[r]![c]! * factor));
      }
  };
  let t = sim.time;
  while (interval !== null && sim.nextDue <= end) {
    drain(sim.nextDue - t);
    t = sim.nextDue;
    refreshRow(sim, sim.nextRow);
    sim.nextRow = (sim.nextRow + 1) % sim.rows;
    sim.nextDue += gap;
  }
  drain(end - t);
  sim.time = end;
  if (interval === null) sim.nextDue = end;
}

/** How many cells have lost their bit, and how many stored ones are still readable. */
export function tally(sim: DramSim): { lost: number; ones: number; readable: number } {
  let lost = 0;
  let ones = 0;
  let readable = 0;
  for (let r = 0; r < sim.rows; r++)
    for (let c = 0; c < sim.cols; c++) {
      if (sim.lost[r]![c]) lost++;
      if (sim.data[r]![c]) {
        ones++;
        if (sensed(sim.v[r]![c]!)) readable++;
      }
    }
  return { lost, ones, readable };
}

/** The time (s) at which the weakest stored 1 becomes unreadable, at a temperature, with no refresh. */
export function firstFailure(sim: DramSim, celsius: number): number {
  let m = Infinity;
  for (let r = 0; r < sim.rows; r++) for (let c = 0; c < sim.cols; c++) if (sim.data[r]![c]) m = Math.min(m, sim.retention[r]![c]! * tempFactor(celsius));
  return m;
}

// ── Refresh in numbers ─────────────────────────────────────────────────────────

/** The time (s) between refresh commands for a window and a number of commands: 64 ms / 8192 = 7.8 µs. */
export const refreshInterval = (window: number = DRAM.window, commands: number = DRAM.refreshCommands): number => window / commands;

/** The fraction of time a chip spends refreshing itself, when each command keeps it busy for `tRFC` seconds. */
export const refreshOverhead = (tRFC: number, tREFI: number = refreshInterval()): number => tRFC / tREFI;

/** DDR4's refresh cycle time by chip density (Gbit → ns), from the JEDEC standard. */
export const TRFC_NS: Record<number, number> = { 2: 160, 4: 260, 8: 350, 16: 550 };

/** Cells in a chip: a DRAM of `gbit` gigabits (2³⁰ bits). */
export const cellsIn = (gbit: number): number => gbit * 2 ** 30;
