/**
 * A bouncing push button, and the DCL standard library's `Debouncer` cleaning it up.
 *
 * The button is a list of samples every 0.1 ms: it rests low, is pressed, bounces for a few milliseconds, is
 * released and bounces again. The design under test is the real `Debouncer<WINDOW>` of `src/lib/hdl/std/debouncer.dcl`,
 * compiled by the DCL front end and run on the RTL simulator, sampling the button at a 1 kHz clock: the output
 * changes only after the input has held its new value for WINDOW clock cycles (milliseconds) in a row.
 */
import { check, createRtlSim, elaborate } from '$lib/hdl';

/** Samples per millisecond in the button's waveform. */
export const RES = 10;
/** The debouncer's clock, one cycle per millisecond. */
export const CLOCK_HZ = 1000;

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Button {
  /** 0 or 1 every 0.1 ms. */
  raw: Uint8Array;
  /** Milliseconds. */
  length: number;
  pressAt: number;
  releaseAt: number;
}

/** A press at `pressAt` ms and a release at `releaseAt` ms, each followed by up to `bounceMs` of contact chatter. */
export function button(seed: number, bounceMs = 4, length = 60, pressAt = 8, releaseAt = 36): Button {
  const rand = rng(seed);
  const raw = new Uint8Array(length * RES);
  const set = (from: number, to: number, val: number) => {
    for (let k = Math.round(from * RES); k < Math.round(to * RES) && k < raw.length; k++) raw[k] = val;
  };
  // The contacts alternate new, old, new … an odd number of times, so the burst ends on the new value.
  // Each stay lasts at least a quarter of a millisecond, and together they fill `bounceMs`.
  const burst = (t0: number, final: 0 | 1) => {
    const most = Math.max(1, Math.floor(bounceMs / 0.25));
    const flips = Math.min(3 + 2 * Math.floor(rand() * 3), most % 2 === 1 ? most : most - 1);
    const weights = Array.from({ length: flips }, () => 0.5 + rand());
    const total = weights.reduce((x, y) => x + y, 0);
    let t = t0;
    weights.forEach((w, i) => {
      const d = (w / total) * bounceMs;
      set(t, t + d, i % 2 === 0 ? final : 1 - final);
      t += d;
    });
  };
  set(pressAt + bounceMs, releaseAt, 1);
  burst(pressAt, 1);
  burst(releaseAt, 0);
  return { raw, length, pressAt, releaseAt };
}

/** Number of level changes in a sample list. */
export const edges = (x: ArrayLike<number>): number => {
  let n = 0;
  for (let i = 1; i < x.length; i++) if (x[i] !== x[i - 1]) n++;
  return n;
};

export interface Cleaned {
  /** What the debouncer sees at each clock edge (the button sampled every ms). */
  sampled: Uint8Array;
  /** After the two-flip-flop synchroniser (`d.level`), and the clean output, one value per ms. */
  synced: Uint8Array;
  clean: Uint8Array;
}

const sources = new Map<number, ReturnType<typeof compile>>();
function compile(window: number) {
  const r = check(`module Top(clk: clock, raw: bit) -> (clean: bit) {\n  inst d: Debouncer<${window}>(clk: clk, raw: raw)\n  clean = d.clean\n}`);
  if (r.diagnostics.some((d) => d.severity === 'error')) throw new Error('Debouncer did not compile');
  return r.program;
}

/** Run `Debouncer<window>` over a button, one clock edge per millisecond. */
export function debounce(b: Button, window: number): Cleaned {
  const w = Math.max(2, Math.min(64, Math.round(window)));
  let prog = sources.get(w);
  if (!prog) sources.set(w, (prog = compile(w)));
  const sim = createRtlSim(elaborate(prog, 'Top'));
  const n = b.length;
  const sampled = new Uint8Array(n);
  const synced = new Uint8Array(n);
  const clean = new Uint8Array(n);
  for (let ms = 0; ms < n; ms++) {
    sampled[ms] = b.raw[ms * RES]!;
    sim.set('raw', sampled[ms]!);
    synced[ms] = sim.get('d.level');
    clean[ms] = sim.get('clean');
    sim.step();
  }
  return { sampled, synced, clean };
}

/** A sample list as timing-diagram segments [from, to, value], `step` time units per sample. */
export function segsOf(x: ArrayLike<number>, step: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < x.length; i++) {
    const last = out[out.length - 1];
    if (last && last[2] === x[i]) last[1] = (i + 1) * step;
    else out.push([i * step, (i + 1) * step, x[i]!]);
  }
  return out;
}
