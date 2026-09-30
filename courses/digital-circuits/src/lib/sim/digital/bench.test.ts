import { describe, expect, test } from 'vitest';
import { NetlistBuilder, createDigitalEngine, type DigitalEngine } from './index';

/**
 * Throughput benchmarks, sized to run in well under a second each. The asserted minimum is far
 * below what a laptop reaches, so slow CI machines pass; the measured rate is printed.
 */

function measure(e: DigitalEngine, run: () => void): { events: number; seconds: number; rate: number } {
  const e0 = e.eventCount;
  const t0 = performance.now();
  run();
  const seconds = (performance.now() - t0) / 1000;
  const events = e.eventCount - e0;
  return { events, seconds, rate: events / seconds };
}

const MIN_RATE = 1e6;

describe('benchmarks', () => {
  test('a ring of 5 001 inverters', () => {
    const n = 5001;
    const b = new NetlistBuilder();
    const nets = b.nets(n);
    for (let i = 0; i < n; i++) b.add('not', `U${i}`, { A: nets[(i + n - 1) % n]!, Y: nets[i]! });
    const t0 = performance.now();
    // One call must run all 2 million events: lift the per-call cap that keeps a UI frame short.
    const e = createDigitalEngine(b.build(), { maxEventsPerAdvance: 1e9 });
    const build = performance.now() - t0;
    // Warm up, then measure 2 million gate delays (one event each).
    e.advance(200_000e-9);
    const m = measure(e, () => e.advance(2_000_000e-9));
    console.log(`ring of ${n} inverters: built in ${build.toFixed(0)} ms; ${(m.rate / 1e6).toFixed(2)} M events/s (${m.events} events in ${(m.seconds * 1000).toFixed(0)} ms)`);
    expect(m.events).toBeGreaterThanOrEqual(1_999_000);
    expect(m.rate).toBeGreaterThan(MIN_RATE);
  });

  test('a 64-bit ripple-carry adder of gates, with random inputs', () => {
    const bits = 64;
    const b = new NetlistBuilder();
    const A = b.nets(bits, 'A');
    const B = b.nets(bits, 'B');
    const S = b.nets(bits, 'S');
    let carry = b.net('C0');
    b.add('toggle', 'CIN', { Y: carry });
    for (let i = 0; i < bits; i++) {
      b.add('toggle', `TA${i}`, { Y: A[i]! });
      b.add('toggle', `TB${i}`, { Y: B[i]! });
      const [x, g, p, c] = b.nets(4);
      b.add('xor', `X1_${i}`, { A: A[i]!, B: B[i]!, Y: x! });
      b.add('xor', `X2_${i}`, { A: x!, B: carry, Y: S[i]! });
      b.add('and', `G_${i}`, { A: A[i]!, B: B[i]!, Y: g! });
      b.add('and', `P_${i}`, { A: x!, B: carry, Y: p! });
      b.add('or', `C_${i}`, { A: g!, B: p!, Y: c! });
      carry = c!;
    }
    const e = createDigitalEngine(b.build(), { delayModel: 'transport' });
    let seed = 1;
    const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) | 0) >>> 16) & 1;
    let checked = 0;
    // Time only the simulation of each new input pair (setting 128 switches is the test's cost).
    let events = 0;
    let ms = 0;
    for (let k = 0; k < 400; k++) {
      let a = 0n;
      let c = 0n;
      for (let i = 0; i < bits; i++) {
        const x = rand();
        const y = rand();
        e.setParam(`TA${i}`, 'on', x === 1);
        e.setParam(`TB${i}`, 'on', y === 1);
        a |= BigInt(x) << BigInt(i);
        c |= BigInt(y) << BigInt(i);
      }
      const m = measure(e, () => e.advance(200e-9));
      events += m.events;
      ms += m.seconds * 1000;
      if (k % 50 === 0) {
        let s = 0n;
        for (let i = 0; i < bits; i++) s |= BigInt(e.logic(S[i]!)) << BigInt(i);
        expect(s).toBe((a + c) & ((1n << 64n) - 1n));
        checked++;
      }
    }
    const rate = events / (ms / 1000);
    console.log(`64-bit ripple-carry adder (transport delay): ${(rate / 1e6).toFixed(2)} M events/s (${events} events in ${ms.toFixed(0)} ms)`);
    expect(checked).toBe(8);
    expect(rate).toBeGreaterThan(MIN_RATE);
  });
});
