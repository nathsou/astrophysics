/**
 * Random-number helpers that make a batch independent of how it is split.
 *
 * Every event of a run gets its own generator, derived from the run seed and the event's index alone (`eventRng`), so event 1234
 * is the same event whether one worker or eight computed it, and whether it was computed first or last. Inside an event, each
 * stage takes its own stream from the event generator in a fixed order (`stageStreams`), so a stage that draws more or fewer
 * numbers (because the reader's code is installed, say) does not shift the random numbers of the stages after it.
 */
import { rng, type Rng } from '../random/index.ts';

/** A 32-bit mix of two integers (the MurmurHash3 finaliser applied to both), so that neighbouring seeds and indices give unrelated streams. */
export function mix32(a: number, b: number): number {
  let h = (a >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = (h ^ (b >>> 0) ^ 0x7f4a7c15) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x27d4eb2f) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

/** The generator of event number `index` in the run with seed `seed`. */
export function eventRng(seed: number, index: number): Rng {
  return rng(mix32(mix32(seed, index), index + 0x51ed270b));
}

export interface StageStreams {
  /** Number of pile-up collisions (machine). */
  machine: Rng;
  generator: Rng;
  detector: Rng;
  trigger: Rng;
}

/** The four random streams of one event, forked in a fixed order. */
export function stageStreams(r: Rng): StageStreams {
  return { machine: r.fork('machine'), generator: r.fork('generator'), detector: r.fork('detector'), trigger: r.fork('trigger') };
}

/**
 * Which sample event `index` belongs to, for samples with integer shares (a cycle of Σ shares events, for instance signal, then four background).
 * A function of the index alone, so every split of a run agrees.
 */
export function sampleIndexFor(index: number, shares: readonly number[]): number {
  let total = 0;
  for (const s of shares) total += s;
  let p = index % total;
  for (let k = 0; k < shares.length; k++) {
    if (p < shares[k]!) return k;
    p -= shares[k]!;
  }
  return shares.length - 1;
}
