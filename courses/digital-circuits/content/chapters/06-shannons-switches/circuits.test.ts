import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';

/**
 * Every live circuit of Chapter 6 must compute what the text says it computes. Each test loads the
 * JSON exactly as the page does, flips the switches through `setParam` (as a click does), lets the
 * relays and the filament settle, and reads the lamp's brightness.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const engine = (name: string): AnalogEngine => createAnalogEngine(flatten(load(name)));

const SETTLE = 0.5; // seconds: relays take 5 ms, a filament about 50 ms
const LIT = 0.5;
const DARK = 0.05;

/**
 * Advance the way the page does: in frame-sized pieces (one call of `advance` is capped at 1000
 * internal steps, so a long jump is not guaranteed to reach its target time).
 */
function run(e: AnalogEngine, seconds: number, frame = 0.01): void {
  const end = e.time + seconds;
  while (e.time < end - 1e-9) e.advance(Math.min(frame, end - e.time));
}

function expectLamp(e: AnalogEngine, id: string, lit: boolean, what: string): void {
  const b = e.state(id).brightness as number;
  if (lit) expect(b, `${what}: ${id} should be lit, brightness ${b}`).toBeGreaterThan(LIT);
  else expect(b, `${what}: ${id} should be dark, brightness ${b}`).toBeLessThan(DARK);
}

/** All ordered pairs of input combinations, so every transition is exercised, not just every state. */
function transitions(): [number, number][] {
  const out: [number, number][] = [];
  for (let from = 0; from < 4; from++) for (let to = 0; to < 4; to++) out.push([from, to]);
  return out;
}

describe('the circuits load and run without messages', () => {
  for (const name of ['series', 'parallel', 'staircase', 'relay-not', 'relay-chain', 'model-k']) {
    test(name, () => {
      const e = engine(name);
      run(e, 0.2);
      // Flip every switch on and off again: nothing may burn, spike or fail to converge.
      for (const c of load(name).components) {
        if (c.type === 'switch') for (const closed of [true, false]) { e.setParam(c.id, 'closed', closed); run(e, 0.2); }
        if (c.type === 'spdt') for (const t of [1, 0]) { e.setParam(c.id, 'throw', t); run(e, 0.2); }
      }
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('series is AND', () => {
  test('the lamp is lit only when both switches are closed', () => {
    for (const [from, to] of transitions()) {
      const e = engine('series');
      const set = (v: number) => {
        e.setParam('A', 'closed', !!(v & 1));
        e.setParam('B', 'closed', !!(v & 2));
        run(e, SETTLE);
      };
      set(from);
      set(to);
      expectLamp(e, 'L1', to === 3, `series ${from}→${to}`);
    }
  });
});

describe('parallel is OR', () => {
  test('the lamp is lit when either switch is closed', () => {
    for (const [from, to] of transitions()) {
      const e = engine('parallel');
      const set = (v: number) => {
        e.setParam('A', 'closed', !!(v & 1));
        e.setParam('B', 'closed', !!(v & 2));
        run(e, SETTLE);
      };
      set(from);
      set(to);
      expectLamp(e, 'L1', to !== 0, `parallel ${from}→${to}`);
    }
  });
});

describe('the staircase light is XNOR (XOR with the travellers crossed)', () => {
  test('it starts lit, and every flip of either switch toggles the lamp', () => {
    const e = engine('staircase');
    run(e, SETTLE);
    expectLamp(e, 'L1', true, 'both switches at 0');
    let lit = true;
    // Flip the switches in a scrambled order: whichever one is flipped, the lamp toggles.
    for (const id of ['S1', 'S2', 'S2', 'S1', 'S1', 'S2', 'S1', 'S2', 'S2']) {
      const now = e.state(id).throw === 1 ? 0 : 1;
      e.setParam(id, 'throw', now);
      run(e, SETTLE);
      lit = !lit;
      expectLamp(e, 'L1', lit, `after flipping ${id}`);
    }
  });
  test('the full truth table: lit when the two switches agree', () => {
    for (const [from, to] of transitions()) {
      const e = engine('staircase');
      const set = (v: number) => {
        e.setParam('S1', 'throw', v & 1);
        e.setParam('S2', 'throw', (v >> 1) & 1);
        run(e, SETTLE);
      };
      set(from);
      set(to);
      const agree = (to & 1) === ((to >> 1) & 1);
      expectLamp(e, 'L1', agree, `staircase ${from}→${to}`);
    }
  });
});

describe('a relay NOT gate', () => {
  test('the lamp is on when the switch is open, and off when it is closed', () => {
    const e = engine('relay-not');
    run(e, SETTLE);
    expectLamp(e, 'L1', true, 'input open');
    e.setParam('A', 'closed', true);
    run(e, SETTLE);
    expect(e.state('K1').energised).toBe(true);
    expectLamp(e, 'L1', false, 'input closed');
    e.setParam('A', 'closed', false);
    run(e, SETTLE);
    expectLamp(e, 'L1', true, 'input open again');
  });
});

describe('three relays in a chain', () => {
  test('three inversions make one: the lamp is NOT A', () => {
    const e = engine('relay-chain');
    run(e, SETTLE);
    expectLamp(e, 'L1', true, 'A open');
    expect(e.state('K1').energised).toBe(false);
    expect(e.state('K2').energised).toBe(true);
    expect(e.state('K3').energised).toBe(false);
    e.setParam('A', 'closed', true);
    run(e, SETTLE);
    expectLamp(e, 'L1', false, 'A closed');
    expect(e.state('K1').energised).toBe(true);
    expect(e.state('K2').energised).toBe(false);
    expect(e.state('K3').energised).toBe(true);
    e.setParam('A', 'closed', false);
    run(e, SETTLE);
    expectLamp(e, 'L1', true, 'A open again');
  });

  test('the signal ripples down the chain: each stage waits for the one before', () => {
    const e = engine('relay-chain');
    run(e, SETTLE);
    e.setParam('A', 'closed', true);
    const at: Record<string, number> = {};
    for (let i = 0; i < 4000 && at.K3 === undefined; i++) {
      e.advance(2.5e-5);
      for (const k of ['K1', 'K2', 'K3']) if (at[k] === undefined && e.state(k).nc === (k === 'K2')) at[k] = e.time - SETTLE;
    }
    // Each relay's NC contact reaches its new state a few milliseconds after the one before it:
    // K1's NC opens, K2 lets go and its NC closes, and finally K3's NC opens.
    const [t1, t2, t3] = [at.K1!, at.K2!, at.K3!];
    expect(t1).toBeGreaterThan(0.002);
    expect(t1).toBeLessThan(0.01);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
    // The whole chain takes about 14 ms: three relays, one after the other.
    expect(t3).toBeGreaterThan(0.01);
    expect(t3).toBeLessThan(0.025);
  });
});

describe("Stibitz's Model K", () => {
  test('sum is A XOR B and carry is A AND B, for every transition', () => {
    for (const [from, to] of transitions()) {
      const e = engine('model-k');
      const set = (v: number) => {
        e.setParam('SA', 'closed', !!(v & 1));
        e.setParam('SB', 'closed', !!(v & 2));
        run(e, SETTLE);
      };
      set(from);
      set(to);
      const a = to & 1;
      const b = (to >> 1) & 1;
      const what = `Model K ${from}→${to} (A=${a}, B=${b})`;
      expectLamp(e, 'LS', a !== b, `${what} sum`);
      expectLamp(e, 'LC', a === 1 && b === 1, `${what} carry`);
    }
  });

  test('the relays follow their switches, two per switch', () => {
    const e = engine('model-k');
    e.setParam('SA', 'closed', true);
    run(e, SETTLE);
    expect(e.state('RA1').energised).toBe(true);
    expect(e.state('RA2').energised).toBe(true);
    expect(e.state('RB1').energised).toBe(false);
    expect(e.state('RB2').energised).toBe(false);
  });

  test('1 + 1 = 10 in binary: both lamps agree with the arithmetic', () => {
    const e = engine('model-k');
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      e.setParam('SA', 'closed', !!a);
      e.setParam('SB', 'closed', !!b);
      run(e, SETTLE);
      const sum = (e.state('LC').brightness! > LIT ? 2 : 0) + (e.state('LS').brightness! > LIT ? 1 : 0);
      expect(sum).toBe(a + b);
    }
  });
});
