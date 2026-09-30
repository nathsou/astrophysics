/**
 * The noise gauntlet: a signal passes through a chain of stages, and every stage adds a little noise.
 *
 * A stage is a function from its input voltage to its output voltage. The three kinds of the figure:
 *  - `wire`: output = input. A perfect conductor (gain 1, no loss). Noise piles up.
 *  - `diode`: the diode stage of Chapter 7, measured on the analog engine (see vtc.ts). Its gain is a
 *    little below 1 and it loses about 0.65 V. The signal fades into the noise, and then into the floor.
 *  - `inverter`: the RTL inverter of Figure 8.6, measured on the analog engine. Its gain in the middle
 *    is about −15, so any error smaller than the noise margin is squashed at once, and each stage hands
 *    the next a clean level.
 *
 * Stage i receives the level of node i − 1 and produces node i: `f(level) + noise`, clamped to the
 * supply rails (0 V and 5 V), because nothing in the circuit can go beyond them. The noise is Gaussian
 * with standard deviation σ, drawn from a seeded generator so that a run can be repeated.
 */
import { VCC, diodeVtc, rtlVtc, transfer } from './vtc';

export type StageKind = 'wire' | 'diode' | 'inverter';

export const STAGES = 20;

export const STAGE_LABELS: Record<StageKind, string> = {
  wire: 'A plain wire (gain 1)',
  diode: 'Diode stage (gain < 1)',
  inverter: 'Inverter with gain',
};

/** The input–output function of a stage kind. */
export function stageFunction(kind: StageKind): (v: number) => number {
  if (kind === 'wire') return (v) => v;
  const table = kind === 'diode' ? diodeVtc() : rtlVtc();
  return (v) => transfer(table, v);
}

/** Does the stage flip the logic value it carries? */
export const inverts = (kind: StageKind): boolean => kind === 'inverter';

/** The threshold at which a receiver tells a 1 from a 0: half the supply. */
export const THRESHOLD = VCC / 2;

/** Small, fast, seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generator of standard normal numbers (Box–Muller) on top of a uniform one. */
export function gaussian(rand: () => number): () => number {
  let spare: number | undefined;
  return () => {
    if (spare !== undefined) {
      const s = spare;
      spare = undefined;
      return s;
    }
    const u = Math.max(1e-12, rand());
    const r = Math.sqrt(-2 * Math.log(u));
    const t = 2 * Math.PI * rand();
    spare = r * Math.sin(t);
    return r * Math.cos(t);
  };
}

export interface GauntletOptions {
  kind: StageKind;
  /** The bit sent: 1 is `high` volts, 0 is 0 V. */
  bit: 0 | 1;
  /** The voltage of a 1 at the input (a degraded 1 is below 5 V). */
  high?: number;
  /** Standard deviation of the noise added by every stage (V). */
  sigma: number;
  seed?: number;
  stages?: number;
}

export interface GauntletResult {
  /** Level at each node: index 0 is the input, index i is the output of stage i. */
  levels: number[];
  /** The same without noise. */
  clean: number[];
  /** What a receiver at each node should see for the bit sent (an inverter flips it at every stage). */
  expected: (0 | 1)[];
  /** What a receiver at each node actually reads (above or below half the supply). */
  read: (0 | 1)[];
  /** Whether each node reads as it should. */
  correct: boolean[];
}

export function runGauntlet(o: GauntletOptions): GauntletResult {
  const n = o.stages ?? STAGES;
  const f = stageFunction(o.kind);
  const normal = gaussian(rng(o.seed ?? 1));
  const start = o.bit ? (o.high ?? VCC) : 0;
  const levels = [start];
  const clean = [start];
  for (let i = 1; i <= n; i++) {
    const noisy = f(levels[i - 1]!) + o.sigma * normal();
    levels.push(Math.min(VCC, Math.max(0, noisy)));
    clean.push(Math.min(VCC, Math.max(0, f(clean[i - 1]!))));
  }
  const expected = levels.map((_, i) => (inverts(o.kind) && i % 2 === 1 ? 1 - o.bit : o.bit) as 0 | 1);
  const read = levels.map((v) => (v > THRESHOLD ? 1 : 0) as 0 | 1);
  return { levels, clean, expected, read, correct: read.map((r, i) => r === expected[i]) };
}

/** A word of bits sent one after the other through independent copies of the chain (independent noise). */
export function runWord(o: Omit<GauntletOptions, 'bit'>, bits: (0 | 1)[]): { results: GauntletResult[]; received: (0 | 1)[]; errors: number } {
  const results = bits.map((bit, i) => runGauntlet({ ...o, bit, seed: (o.seed ?? 1) * 1000 + i }));
  const received = results.map((r) => r.read[r.read.length - 1]!);
  const errors = results.filter((r) => !r.correct[r.correct.length - 1]).length;
  return { results, received, errors };
}

/** Out of `trials` independent bits (half ones, half zeros), how many are misread after the last stage? */
export function errorCount(o: Omit<GauntletOptions, 'bit'>, trials = 400): number {
  let bad = 0;
  for (let t = 0; t < trials; t++) {
    const r = runGauntlet({ ...o, bit: (t % 2) as 0 | 1, seed: (o.seed ?? 1) * 7919 + t });
    if (!r.correct[r.correct.length - 1]) bad++;
  }
  return bad;
}

/** The staircase of a noiseless signal between a stage's curve and the line out = in (a cobweb plot). */
export function cobweb(kind: StageKind, start: number, stages = STAGES): [number, number][] {
  const f = stageFunction(kind);
  const pts: [number, number][] = [[start, 0]];
  let x = start;
  for (let i = 0; i < stages; i++) {
    const y = Math.min(VCC, Math.max(0, f(x)));
    pts.push([x, y]);
    pts.push([y, y]);
    x = y;
  }
  return pts;
}

/** The first node that misreads, or undefined if every node reads correctly. */
export const firstError = (r: GauntletResult): number | undefined => {
  const i = r.correct.findIndex((c) => !c);
  return i < 0 ? undefined : i;
};

/** The most recent node before which everything read correctly, for the caption "signal lost at stage k". */
export const lostAt = (r: GauntletResult): number | undefined => {
  for (let i = r.correct.length - 1; i >= 0; i--) if (!r.correct[i]) return i;
  return undefined;
};
