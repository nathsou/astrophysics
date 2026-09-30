import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { step } from './widgets/fsm';
import { TRAFFIC_LIGHT } from './widgets/presets';

/**
 * Every live circuit of Chapter 19 must do what the text says. Each test loads the JSON exactly as the page does,
 * drives switches and buttons through `setParam` (as a click does), clocks the flip-flops and reads the lamps.
 */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;

function bench(name: string) {
  const c = load(name);
  const flat = flatten(c);
  const e: DigitalEngine = createDigitalEngine(flat);
  e.advance(50e-9);
  return {
    c,
    e,
    lit: (id: string) => !!e.state(id).lit,
    /** Flip a switch and let the logic settle, well before the next clock edge (setup time). */
    on(id: string, v: boolean) {
      e.setParam(id, 'on', v);
      e.advance(20e-9);
    },
    /** Press and release the manual clock button: one rising edge. */
    edge() {
      e.setParam('CLK', 'pressed', true);
      e.advance(20e-9);
      e.setParam('CLK', 'pressed', false);
      e.advance(20e-9);
    },
  };
}

describe('the circuits load and run without messages', () => {
  for (const name of ['turnstile', 'traffic-light', 'edge-detector']) {
    test(name, () => {
      const b = bench(name);
      b.e.advance(1e-6);
      expect(b.e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('Figure 19.1: the turnstile', () => {
  // Power-up: the flip-flop starts at 0, so the turnstile is locked.
  test('it starts locked; a coin unlocks it at the next edge; a push locks it again', () => {
    const b = bench('turnstile');
    b.e.advance(50e-9);
    expect([b.lit('LOCKED'), b.lit('UNLOCKED')]).toEqual([true, false]);
    b.on('COIN', true);
    b.e.advance(20e-9);
    // Nothing happens until the clock edge.
    expect(b.lit('UNLOCKED')).toBe(false);
    b.edge();
    expect([b.lit('LOCKED'), b.lit('UNLOCKED')]).toEqual([false, true]);
    // More coins change nothing; the state is remembered with the coin gone.
    b.on('COIN', false);
    b.edge();
    expect(b.lit('UNLOCKED')).toBe(true);
    b.on('PUSH', true);
    b.edge();
    expect([b.lit('LOCKED'), b.lit('UNLOCKED')]).toEqual([true, false]);
  });
  test('pushing a locked turnstile does nothing, and a coin beats a push in the same cycle', () => {
    const b = bench('turnstile');
    b.on('PUSH', true);
    b.edge();
    expect(b.lit('LOCKED')).toBe(true);
    b.on('COIN', true);
    b.edge();
    expect(b.lit('UNLOCKED')).toBe(true);
    b.edge(); // coin and push together, while unlocked: the coin wins
    expect(b.lit('UNLOCKED')).toBe(true);
  });
  test('it is one flip-flop and two gates plus an inverter', () => {
    const types = load('turnstile').components.map((c) => c.type);
    expect(types.filter((t) => t === 'dff')).toHaveLength(1);
    expect(types.filter((t) => ['and', 'or', 'not'].includes(t)).sort()).toEqual(['and', 'not', 'or']);
  });
});

describe('Figure 19.3: the traffic light in two flip-flops', () => {
  const lamps = (b: ReturnType<typeof bench>) => ['RED', 'AMBER', 'GREEN'].map((id) => +b.lit(id)).join('');
  test('at 1 Hz it walks the British sequence, and the lamps match the diagram of the designer', () => {
    const b = bench('traffic-light');
    b.e.advance(0.25);
    let state = 'Red';
    // The clock rises at t = 0 (or 0.5 s); after each rising edge the lamps show the next state.
    const seen: string[] = [];
    const want: string[] = [];
    for (let i = 0; i < 9; i++) {
      seen.push(lamps(b));
      want.push(TRAFFIC_LIGHT.states.find((s) => s.name === state)!.out);
      state = step(TRAFFIC_LIGHT, state, [1]).next;
      b.e.advance(1);
    }
    expect(seen).toEqual(want);
    expect(new Set(seen)).toEqual(new Set(['100', '110', '001', '010']));
  });
  test('with tick off it holds', () => {
    const b = bench('traffic-light');
    b.on('TICK', false);
    b.e.advance(0.25);
    const first = lamps(b);
    b.e.advance(5);
    expect(lamps(b)).toBe(first);
  });
  test('it is the Gray-coded machine of the synthesiser: two enable flip-flops, one inverter, an XOR and an AND', () => {
    const types = load('traffic-light').components.map((c) => c.type);
    expect(types.filter((t) => t === 'dffe')).toHaveLength(2);
    expect(types.filter((t) => ['and', 'or', 'not', 'xor'].includes(t)).sort()).toEqual(['and', 'not', 'xor']);
  });
});

describe('Figure 19.2: Mealy and Moore', () => {
  /** Sample the two outputs just before each rising edge of the 10 MHz clock, for a given input sequence. */
  function run(bits: number[]) {
    const b = bench('edge-detector');
    const period = 100e-9;
    b.e.advance(period * 0.75);
    const mealy: number[] = [];
    const moore: number[] = [];
    for (const v of bits) {
      b.e.setParam('IN', 'on', !!v);
      b.e.advance(period * 0.2);
      mealy.push(+b.lit('MEALY'));
      moore.push(+b.lit('MOORE'));
      b.e.advance(period * 0.8);
    }
    return { mealy, moore };
  }
  test('the Mealy output pulses in the cycle the input rises; the Moore output one cycle later', () => {
    const { mealy, moore } = run([0, 0, 1, 1, 1, 0, 1, 0]);
    expect(mealy).toEqual([0, 0, 1, 0, 0, 0, 1, 0]);
    expect(moore).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
  });
});
