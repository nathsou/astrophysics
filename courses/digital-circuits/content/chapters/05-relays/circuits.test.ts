import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';
import relayLamp from './circuits/relay-lamp.json';
import telegraphBare from './circuits/telegraph-bare.json';
import telegraphRepeater from './circuits/telegraph-repeater.json';
import rlCoil from './circuits/rl-coil.json';
import flybackBare from './circuits/flyback-bare.json';
import flybackDiode from './circuits/flyback-diode.json';
import { lineResistance } from './widgets/telegraph';

const engineFor = (c: unknown) => createAnalogEngine(flatten(c as Circuit));
type Eng = ReturnType<typeof engineFor>;

/** Net of a pin, through the flattened netlist. */
function netOf(e: Eng, pin: string): number {
  const [id, name] = pin.split('.');
  const el = e.netlist.elements.find((x) => x.id === id)!;
  return el.pins[el.pinNames!.indexOf(name!)]!;
}

describe('relay-lamp: a relay switches a lamp', () => {
  test('the lamp is dark, closing the switch lights it and opening the switch puts it out', () => {
    const e = engineFor(relayLamp);
    e.advance(0.05);
    expect(e.state('L1').brightness).toBeLessThan(0.01);
    expect(e.state('K1').nc).toBe(true);
    e.setParam('S1', 'closed', true);
    e.advance(0.3);
    expect(e.state('K1').energised).toBe(true);
    expect(e.state('L1').brightness as number).toBeGreaterThan(0.9);
    // 5 V across a 70 Ω coil: 71 mA.
    expect(e.state('K1').coilCurrent as number).toBeCloseTo(5 / 70, 2);
    e.setParam('S1', 'closed', false);
    e.advance(0.3);
    expect(e.state('K1').energised).toBe(false);
    expect(e.state('L1').brightness as number).toBeLessThan(0.01);
  });

  test('the load current comes from the lamp battery, not from the switch', () => {
    const e = engineFor(relayLamp);
    e.setParam('S1', 'closed', true);
    e.advance(0.3);
    const coil = Math.abs(e.current('S1', 0));
    const lamp = Math.abs(e.current('L1', 0));
    expect(coil).toBeCloseTo(0.0714, 2);
    // 6 V lamp, 0.3 W: 50 mA hot.
    expect(lamp).toBeGreaterThan(0.04);
    expect(lamp).toBeLessThan(0.06);
  });

  test('the lamp lights an operate time after the coil current builds up (about 5 ms + 2 ms)', () => {
    const e = engineFor(relayLamp);
    e.setParam('S1', 'closed', true);
    let closedAt = NaN;
    for (let i = 0; i < 4000 && Number.isNaN(closedAt); i++) {
      e.advance(5e-6);
      if (e.state('K1').closed) closedAt = e.time;
    }
    expect(closedAt).toBeGreaterThan(0.005);
    expect(closedAt).toBeLessThan(0.0085);
  });
});

describe('telegraph: a relay restores a fading signal', () => {
  /** Lamp brightness and power after holding the key for a second, on a line of `km` kilometres. */
  function hold(c: unknown, km: number) {
    const e = engineFor(c);
    const r = lineResistance(km);
    e.setParam('R1', 'resistance', Math.max(0.01, r / 2));
    e.setParam('R2', 'resistance', Math.max(0.01, r / 2));
    e.setParam('S1', 'pressed', true);
    e.advance(1);
    return { e, brightness: e.state('L1').brightness as number, power: e.state('L1').power as number };
  }

  test('without a repeater the lamp fades as the line gets longer', () => {
    const b = [0, 40, 80, 120, 200].map((km) => hold(telegraphBare, km).brightness);
    expect(b[0]).toBeGreaterThan(0.9);
    for (let i = 1; i < b.length; i++) expect(b[i]!).toBeLessThan(b[i - 1]!);
    expect(hold(telegraphBare, 80).brightness).toBeGreaterThan(0.03);
    expect(hold(telegraphBare, 80).brightness).toBeLessThan(0.3);
    expect(hold(telegraphBare, 200).brightness).toBeLessThan(0.01);
  });

  test('the power reaching the lamp falls steeply with length', () => {
    expect(hold(telegraphBare, 0).power).toBeCloseTo(0.12, 1);
    expect(hold(telegraphBare, 80).power).toBeLessThan(0.08);
    expect(hold(telegraphBare, 200).power).toBeLessThan(0.04);
  });

  test('with a relay the lamp is as bright at 300 km as at 20 km, and the same power', () => {
    const near = hold(telegraphRepeater, 20);
    const far = hold(telegraphRepeater, 300);
    expect(near.brightness).toBeGreaterThan(0.95);
    expect(far.brightness).toBeGreaterThan(0.95);
    expect(far.power / near.power).toBeGreaterThan(0.98);
    expect(far.power / near.power).toBeLessThan(1.02);
    expect(far.e.state('K1').energised).toBe(true);
  });

  test('the relay needs only a few milliamps: it is more than twenty times more sensitive than the lamp', () => {
    const far = hold(telegraphRepeater, 300);
    const coil = far.e.state('K1').coilCurrent as number;
    expect(coil).toBeGreaterThan(0.0035);
    expect(coil).toBeLessThan(0.006);
    // coil power ≈ I²R = 5 mW against 120 mW at the lamp
    expect(coil * coil * 200).toBeLessThan(0.006);
    expect(far.power / (coil * coil * 200)).toBeGreaterThan(20);
  });

  test('beyond about 400 km even the relay gives up', () => {
    const tooFar = hold(telegraphRepeater, 500);
    expect(tooFar.e.state('K1').energised).toBe(false);
    expect(tooFar.brightness).toBeLessThan(0.01);
  });

  test('releasing the key puts the far lamp out, key up, both ways', () => {
    for (const c of [telegraphBare, telegraphRepeater]) {
      const { e } = hold(c, 20);
      e.setParam('S1', 'pressed', false);
      e.advance(1);
      expect(e.state('L1').brightness as number).toBeLessThan(0.01);
    }
  });
});

describe('rl-coil: a coil resists changes in current', () => {
  test('the resistor branch carries 100 mA at once; the coil branch takes tens of milliseconds', () => {
    const e = engineFor(rlCoil);
    e.setParam('S1', 'closed', true);
    e.advance(1e-3);
    const iR = Math.abs(e.current('R1', 0));
    const iL = Math.abs(e.current('L1', 0));
    expect(iR).toBeGreaterThan(0.095);
    expect(iL).toBeLessThan(0.01);
    // τ = L/R = 1 H / 60.2 Ω = 16.6 ms; after one τ the current is 63 % of its final value
    e.advance(0.0166 - 1e-3);
    expect(Math.abs(e.current('L1', 0)) / iR).toBeGreaterThan(0.6);
    expect(Math.abs(e.current('L1', 0)) / iR).toBeLessThan(0.66);
    e.advance(0.2);
    expect(Math.abs(e.current('L1', 0)) / iR).toBeGreaterThan(0.99);
  });
});

describe('flyback: the spike and the diode', () => {
  /** Peak voltage on the coil's switched end after the switch opens. */
  function open(c: unknown) {
    const e = engineFor(c);
    e.advance(0.03);
    expect(e.state('K1').energised).toBe(true);
    const net = netOf(e, 'SW.2');
    const rec = e.watch([net]);
    e.setParam('SW', 'closed', false);
    e.advance(0.02);
    const peak = Math.max(...rec.values()[0]!);
    rec.close();
    return { e, peak };
  }

  test('without a diode the coil’s end flies to hundreds of volts', () => {
    const { e, peak } = open(flybackBare);
    expect(peak).toBeGreaterThan(300);
    expect(peak).toBeLessThan(700);
    expect(e.messages.some((m) => /spike/.test(m.text))).toBe(true);
  });

  test('with a diode it stops less than a volt above the supply', () => {
    const { e, peak } = open(flybackDiode);
    expect(peak).toBeGreaterThan(5.4);
    expect(peak).toBeLessThan(6);
    expect(e.messages.some((m) => /spike/.test(m.text))).toBe(false);
  });

  test('the diode makes the relay let go later: the current decays through it', () => {
    const release = (c: unknown) => {
      const e = engineFor(c);
      e.advance(0.03);
      e.setParam('SW', 'closed', false);
      let t = NaN;
      const t0 = e.time;
      for (let i = 0; i < 4000 && Number.isNaN(t); i++) {
        e.advance(2e-5);
        if (!e.state('K1').energised) t = e.time - t0;
      }
      return t;
    };
    expect(release(flybackDiode)).toBeGreaterThan(release(flybackBare) * 3);
  });
});
