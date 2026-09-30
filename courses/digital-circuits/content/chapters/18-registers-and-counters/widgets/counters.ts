/**
 * Two ways to build a binary counter, run on the digital engine and read on a logic analyser.
 *
 * - **Ripple**: T flip-flops in a row; each stage is clocked by the previous stage's Q̄, so a carry has to
 *   travel down the chain, one clock-to-Q delay per stage.
 * - **Synchronous**: every flip-flop has the same clock; the next value comes from an incrementer (each bit
 *   toggles when all the bits below it are 1), so all the bits change together.
 *
 * `run` simulates a number of clock cycles and returns each bit's waveform, the value of the whole word at every
 * instant (including the wrong values a ripple counter shows for a moment), and an optional decoder that watches
 * for one count. `octaves` gives the frequency of each output for the sound.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';

export type Kind = 'ripple' | 'sync';

export interface CounterParams {
  kind: Kind;
  bits: number;
  /** Clock period, ns. */
  period: number;
  /** Clock-to-Q of every flip-flop, ns. */
  clkToQ: number;
  /** Count the decoder watches for (0 … 2^bits − 1), or -1 for no decoder. */
  watch: number;
  /** Clock cycles to simulate. */
  cycles: number;
}

export const DEFAULT_COUNTER: CounterParams = { kind: 'ripple', bits: 4, period: 100, clkToQ: 12, watch: 2, cycles: 20 };

export type Span = [from: number, to: number, value: number];
export type Segments = [number, number, number][];

export interface Run {
  end: number;
  clk: Segments;
  bits: Segments[];
  /** The decoder output, or empty. */
  hit: Segments;
  /** The value of the whole word over time (value −1: some bit unknown). */
  word: Span[];
  /** Spans in which the word showed neither the previous nor the next count. */
  transients: Span[];
  /** Times of the rising clock edges, ns. */
  edges: number[];
  /** Rising edges of the decoder output. */
  hitPulses: number;
  /** How many of them are the count really being 'watch' (one per lap). */
  hitLegit: number;
  /** Longest time from a clock edge to the last change of any bit, ns. */
  settle: number;
}

function segs(times: Float64Array, values: Float64Array, end: number): Segments {
  const out: Segments = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = times[i]! * 1e9;
    const t1 = i + 1 < times.length ? times[i + 1]! * 1e9 : end;
    const v = values[i]!;
    const last = out[out.length - 1];
    if (last && last[2] === v) last[1] = Math.max(t1, last[1]);
    else if (t1 > t0 || !last) out.push([t0, Math.max(t1, t0), v]);
  }
  return out;
}

/** Build and run the counter. */
export function run(p: CounterParams, seed = 3): Run {
  const b = new NetlistBuilder();
  const clk = b.net('CLK');
  const q = b.nets(p.bits);
  const qn = b.nets(p.bits);
  b.add('clock', 'clk', { Y: clk }, { frequency: 1e9 / p.period });
  const ff = { clkToQ: p.clkToQ, setup: 0.5, hold: 0.2, tau: 1 };
  if (p.kind === 'ripple') {
    const one = b.net();
    b.add('const', 'one', { Y: one }, { value: 1 });
    for (let i = 0; i < p.bits; i++) b.add('tff', `T${i}`, { T: one, CLK: i === 0 ? clk : qn[i - 1]!, Q: q[i]!, Qn: qn[i]! }, ff);
  } else {
    // carry_i = Q0 · … · Q(i−1); D_i = Q_i XOR carry_i.
    let carry: number | undefined;
    for (let i = 0; i < p.bits; i++) {
      let d: number;
      if (i === 0) d = qn[0]!;
      else {
        d = b.net();
        carry = i === 1 ? q[0]! : (() => { const c = b.net(); b.add('and', `C${i}`, { A: carry!, B: q[i - 1]!, Y: c }); return c; })();
        b.add('xor', `X${i}`, { A: q[i]!, B: carry!, Y: d });
      }
      b.add('dff', `F${i}`, { D: d, CLK: clk, Q: q[i]!, Qn: i === 0 ? qn[0]! : b.net() }, ff);
    }
  }
  let hit = -1;
  if (p.watch >= 0) {
    hit = b.net('HIT');
    const ins = q.map((n, i) => {
      if ((p.watch >> i) & 1) return n;
      const inv = b.net();
      b.add('not', `I${i}`, { A: n, Y: inv });
      return inv;
    });
    b.add('and', 'DEC', Object.fromEntries([...ins.map((n, i) => [String.fromCharCode(65 + i), n]), ['Y', hit]]), { inputs: p.bits });
  }
  const engine = createDigitalEngine(b.build(), { seed });
  const watched = [clk, ...q, ...(hit >= 0 ? [hit] : [])];
  const rec = engine.watch(watched);
  const end = (p.cycles + 0.5) * p.period;
  engine.advance(end * 1e-9);
  const t = rec.times();
  const v = rec.values();
  rec.close();
  const clkSeg = segs(t, v[0]!, end);
  const bitSegs = q.map((_, i) => segs(t, v[1 + i]!, end));
  const hitSeg = hit >= 0 ? segs(t, v[1 + p.bits]!, end) : [];

  // The word over time: one span per row of the recording where it changes.
  const word: Span[] = [];
  for (let k = 0; k < t.length; k++) {
    let w = 0;
    for (let i = 0; i < p.bits; i++) {
      const x = v[1 + i]![k]!;
      if (x > 1) {
        w = -1;
        break;
      }
      w |= x << i;
    }
    const from = t[k]! * 1e9;
    const to = k + 1 < t.length ? t[k + 1]! * 1e9 : end;
    const last = word[word.length - 1];
    if (last && last[2] === w) last[1] = to;
    else if (to > from) word.push([from, to, w]);
    else if (!last) word.push([from, to, w]);
  }

  const edges = clkSeg2edges(clkSeg);
  const mod = 1 << p.bits;
  const transients: Span[] = [];
  let settle = 0;
  edges.forEach((e, n) => {
    const next = edges[n + 1] ?? end;
    // Edge n moves the count from n mod 2^bits to (n + 1) mod 2^bits (the counter powers up at 0).
    const from = n % mod;
    const to = (n + 1) % mod;
    let last = e;
    for (const [a, z, val] of word) {
      if (z <= e || a >= next) continue;
      if (val !== from && val !== to) transients.push([Math.max(a, e), Math.min(z, next), val]);
      if (val === to && a >= e) last = Math.max(last, a);
      else if (val !== from && a >= e) last = Math.max(last, a);
    }
    settle = Math.max(settle, last - e);
  });
  let hitPulses = 0;
  for (let i = 1; i < hitSeg.length; i++) if (hitSeg[i]![2] === 1 && hitSeg[i - 1]![2] === 0) hitPulses++;
  let hitLegit = 0;
  if (hit >= 0) for (let val = 1; val <= p.cycles; val++) if (val % mod === p.watch) hitLegit++;
  return { end, clk: clkSeg, bits: bitSegs, hit: hitSeg, word, transients, edges, hitPulses, hitLegit, settle };
}

function clkSeg2edges(c: Segments): number[] {
  const out: number[] = [];
  for (let i = 1; i < c.length; i++) if (c[i]![2] === 1 && c[i - 1]![2] === 0) out.push(c[i]![0]);
  return out;
}

/** The frequency of the clock and of each output, Hz: every stage halves it. */
export function octaves(clockHz: number, bits: number): number[] {
  return Array.from({ length: bits + 1 }, (_, i) => clockHz / 2 ** i);
}

/** The values a ripple counter shows on its way from n to n + 1: the bits that were 1 fall one after another, then the first 0 rises. */
export function rippleTransients(n: number, bits: number): number[] {
  const out: number[] = [];
  const to = (n + 1) % (1 << bits);
  let cur = n;
  for (let i = 0; i < bits; i++) {
    const was = (n >> i) & 1;
    cur ^= 1 << i;
    if (!was) break;
    out.push(cur);
  }
  if (out.length && out[out.length - 1] === to) out.pop();
  return out;
}
