/**
 * A flash cell is a transistor with a second gate, the *floating gate*, buried in insulator. Electrons pushed
 * onto it (by tunnelling through the oxide, with a high voltage) raise the transistor's threshold voltage Vt; they
 * stay for years. To read, apply a voltage to the control gate: the transistor conducts only if Vt is below it.
 *
 * With two levels (one bit per cell, SLC) one reference voltage between the erased and the programmed Vt is
 * enough. Store four, eight or sixteen levels (MLC, TLC, QLC) in the same cell and the windows get narrower, so
 * programming must be finer (many small pulses, each followed by a check: incremental step pulse programming),
 * and wear and time blur the levels more easily.
 *
 * The voltages are those of a textbook cell, not of any product.
 */

export const FLASH = {
  /** Vt of an erased cell (V). */
  erased: -2,
  /** The highest Vt used (V). */
  top: 5,
  /** The largest rise of Vt per programming pulse (V), used while the windows are wide. */
  step: 0.3,
} as const;

export interface Window {
  level: number;
  /** The cell counts as this level when Vt is within [lo, hi]. */
  lo: number;
  hi: number;
}

export const levelsFor = (bits: number): number => 1 << bits;

/** Evenly spaced windows for each level, with a guard band between neighbours. */
export function windows(bits: number): Window[] {
  const n = levelsFor(bits);
  const pitch = (FLASH.top - FLASH.erased) / n;
  return Array.from({ length: n }, (_, k) => {
    const lo = FLASH.erased + k * pitch;
    return { level: k, lo, hi: lo + pitch * 0.55 };
  });
}

/** The margin (V) between the top of one window and the bottom of the next: what noise and drift must not cross. */
export const margin = (bits: number): number => {
  const w = windows(bits);
  return w.length > 1 ? w[1]!.lo - w[0]!.hi : Infinity;
};

/** The read references: the voltages between the windows. A cell of 2ᵇ levels needs 2ᵇ − 1 of them. */
export const references = (bits: number): number[] => {
  const w = windows(bits);
  return w.slice(1).map((x, i) => (w[i]!.hi + x.lo) / 2);
};

/** Which level a cell reads as, by comparing its Vt with each reference in turn (the highest reference it stays under). */
export function readLevel(vt: number, bits: number): number {
  const refs = references(bits);
  let level = 0;
  for (const r of refs) if (vt >= r) level++;
  return level;
}

/** The pulse size (V): small enough that one pulse cannot jump over a window (at most 40 % of its width). */
export const stepFor = (bits: number): number => {
  const w = windows(bits)[0]!;
  return Math.min(FLASH.step, (w.hi - w.lo) * 0.4);
};

export interface Program {
  /** Vt after each pulse, starting with the erased value. */
  trace: number[];
  pulses: number;
  vt: number;
}

/**
 * Program a cell to a level. Each pulse raises Vt by about one step (a little more or less: the oxide is not
 * uniform), and after each pulse the cell is read against the bottom of the target window: stop when it passes.
 * Vt can only go up, so overshooting is fatal and the step must be smaller than the window is wide.
 */
export function program(fromVt: number, level: number, bits: number, jitter: (i: number) => number = () => 1): Program {
  const target = windows(bits)[level]!;
  const trace = [fromVt];
  let vt = fromVt;
  for (let i = 0; vt < target.lo && i < 200; i++) {
    vt += stepFor(bits) * jitter(i);
    trace.push(vt);
  }
  return { trace, pulses: trace.length - 1, vt };
}

/** True if the cell's Vt is within the window of `level` (so a read gets it right with margin to spare). */
export const inWindow = (vt: number, level: number, bits: number): boolean => {
  const w = windows(bits)[level]!;
  return vt >= w.lo && vt <= w.hi;
};

/** A deterministic wobble of ±20 % for the pulse-to-pulse variation. */
export const wobble = (i: number): number => 1 + 0.2 * Math.sin(i * 2.399963);

export interface Kind {
  bits: number;
  name: string;
  /** Typical program/erase cycles a cell survives before it can no longer be trusted, order of magnitude. */
  endurance: number;
}

export const KINDS: Kind[] = [
  { bits: 1, name: 'SLC', endurance: 100_000 },
  { bits: 2, name: 'MLC', endurance: 10_000 },
  { bits: 3, name: 'TLC', endurance: 3_000 },
  { bits: 4, name: 'QLC', endurance: 1_000 },
];
