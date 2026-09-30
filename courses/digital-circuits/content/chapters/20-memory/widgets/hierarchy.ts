/**
 * The memory hierarchy with round numbers for a typical desktop or server of the 2020s. Every figure is an order of
 * magnitude, not a datasheet: what matters is that each step down is ten to a hundred times slower and holds ten
 * to a thousand times more.
 */

export interface Level {
  id: string;
  name: string;
  /** How it is made. */
  tech: string;
  /** Transistors per bit (of the cell, not counting the surroundings). */
  cell: string;
  /** Typical access time (s). */
  latency: number;
  /** Typical capacity (bytes). */
  capacity: number;
  /** A sentence of detail. */
  note: string;
}

export const KB = 1024;
export const MB = 1024 ** 2;
export const GB = 1024 ** 3;
export const TB = 1024 ** 4;

export const LEVELS: Level[] = [
  { id: 'reg', name: 'Registers', tech: 'flip-flops in the core', cell: 'about 20', latency: 0.3e-9, capacity: 1 * KB, note: 'One clock cycle. 16 or 32 registers of 64 bits, plus vector registers.' },
  { id: 'l1', name: 'L1 cache', tech: 'SRAM', cell: '6', latency: 1e-9, capacity: 48 * KB, note: 'Split into instructions and data, per core; 4–5 cycles.' },
  { id: 'l2', name: 'L2 cache', tech: 'SRAM', cell: '6', latency: 4e-9, capacity: 1 * MB, note: 'Per core, or per pair of cores; about 14 cycles.' },
  { id: 'l3', name: 'L3 cache', tech: 'SRAM', cell: '6', latency: 15e-9, capacity: 32 * MB, note: 'Shared by all the cores on the chip; 40–70 cycles.' },
  { id: 'dram', name: 'Main memory', tech: 'DRAM', cell: '1 + a capacitor', latency: 80e-9, capacity: 32 * GB, note: 'On modules beside the chip; the row must be opened, read and written back.' },
  { id: 'ssd', name: 'Solid-state drive', tech: 'NAND flash', cell: '1 (floating gate)', latency: 80e-6, capacity: 2 * TB, note: 'Read a page of 4–16 KB at a time; writing needs an erased block.' },
  { id: 'hdd', name: 'Hard disk', tech: 'magnetic', cell: 'none', latency: 8e-3, capacity: 12 * TB, note: 'A head must move over a spinning platter: milliseconds.' },
];

/** The level with id `id`. */
export const levelOf = (id: string): Level => LEVELS.find((l) => l.id === id)!;

/** A latency scaled to human time, so that 1 ns becomes 1 s. */
export const humanSeconds = (latency: number): number => latency * 1e9;

/** A duration in words: 4 s, 1 min 20 s, 22 h, 93 days. */
export function words(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 100) / 100} s`;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds - 60 * m);
    return s ? `${m} min ${s} s` : `${m} min`;
  }
  if (seconds < 86400) return `${Math.round(seconds / 360) / 10} hours`;
  if (seconds < 86400 * 60) return `${Math.round(seconds / 8640) / 10} days`;
  return `${Math.round(seconds / 86400 / 3.04) / 10} months`.replace('.0 ', ' ');
}

/** Time in the units of a datasheet: 0.3 ns, 80 ns, 80 µs, 8 ms. */
export function time(s: number): string {
  const [v, u] = s < 1e-6 ? [s * 1e9, 'ns'] : s < 1e-3 ? [s * 1e6, 'µs'] : [s * 1e3, 'ms'];
  return `${v < 10 ? Math.round(v * 10) / 10 : Math.round(v)} ${u}`;
}

export function size(bytes: number): string {
  if (bytes >= TB) return `${bytes / TB} TB`;
  if (bytes >= GB) return `${bytes / GB} GB`;
  if (bytes >= MB) return `${bytes / MB} MB`;
  return `${bytes / KB} KB`;
}

/**
 * Average memory access time of a hierarchy: a level's hit time, plus the miss rate times the time of the level
 * below. `hit[i]` is the fraction of accesses that level i satisfies of those that reach it.
 * AMAT = t₁ + m₁ (t₂ + m₂ (t₃ + …)); the last level always hits.
 */
export function amat(times: readonly number[], hit: readonly number[]): number {
  let t = times[times.length - 1]!;
  for (let i = times.length - 2; i >= 0; i--) t = times[i]! + (1 - hit[i]!) * t;
  return t;
}

/** The levels of the AMAT figure: L1, L2, L3, then main memory. */
export const CACHED = ['l1', 'l2', 'l3', 'dram'] as const;

export const DEFAULT_HITS = [0.95, 0.8, 0.7];

/** Average access time for the cached levels, from the L1, L2 and L3 hit rates. */
export const cachedAmat = (hits: readonly number[] = DEFAULT_HITS): number => amat(CACHED.map((id) => levelOf(id).latency), hits);

/** Bits per second of a read stream that hits a level every `latency`, for 64-byte lines fetched one at a time (a rough ceiling, one access in flight). */
export const lineRate = (latency: number, line = 64): number => (line * 8) / latency;
