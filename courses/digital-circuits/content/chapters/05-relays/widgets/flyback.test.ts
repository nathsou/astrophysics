import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';
import bare from '../circuits/flyback-bare.json';
import diode from '../circuits/flyback-diode.json';
import { closeSwitch, openSwitch } from './flyback';
import { envelope } from './scope';

const engine = (c: unknown) => createAnalogEngine(flatten(c as Circuit));

describe('flyback experiment', () => {
  test('without a diode: a spike of about 500 V lasting a few tens of microseconds', () => {
    const tr = openSwitch(engine(bare));
    expect(tr.peak).toBeGreaterThan(400);
    expect(tr.peak).toBeLessThan(600);
    expect(tr.messages.some((m) => /spike/.test(m))).toBe(true);
    // Before the switch opens the coil's end sits at 0 V.
    const cols = envelope(tr.t, tr.v, -1e-3, 0, 4);
    expect(cols[3]!.max).toBeLessThan(0.1);
    // After 100 µs the spike has decayed to well under 5 V above the supply (τ = L / 100·R ≈ 14 µs).
    const late = envelope(tr.t, tr.v, 100e-6, 200e-6, 2);
    expect(late[0]!.max).toBeLessThan(10);
  });

  test('with a diode: 0.6–0.9 V above the 5 V supply, and no warning', () => {
    const tr = openSwitch(engine(diode));
    expect(tr.peak).toBeGreaterThan(5.5);
    expect(tr.peak).toBeLessThan(5.95);
    expect(tr.messages.length).toBe(0);
  });

  test('the two peaks differ by a factor of about 100', () => {
    const a = openSwitch(engine(bare)).peak;
    const b = openSwitch(engine(diode)).peak;
    expect(a / b).toBeGreaterThan(50);
  });

  test('the experiment can be repeated after closing the switch', () => {
    const e = engine(bare);
    const first = openSwitch(e).peak;
    closeSwitch(e);
    const second = openSwitch(e).peak;
    expect(second).toBeGreaterThan(0.9 * first);
    expect(second).toBeLessThan(1.1 * first);
  });
});
