import { describe, expect, test } from 'vitest';
import { createAnalogEngine } from './engine';
import { circuit } from './test-helpers';

/** A 5 V, 70 Ω, 100 mH relay (rated coil current 71 mA; pull-in 50 mA, drop-out 21 mA). */
function relayOnSupply(volts: number) {
  const c = circuit()
    .add('S', 'supply', { '-': 'gnd', '+': 'a' }, { voltage: volts, limit: 1 })
    .add('K', 'relay', { A: 'a', B: 'gnd', NO: 'no', COM: 'com', NC: 'nc' })
    .add('V', 'rail', { v: 'com' }, { voltage: 5 })
    .add('RNO', 'resistor', { '1': 'no', '2': 'gnd' })
    .add('RNC', 'resistor', { '1': 'nc', '2': 'gnd' });
  return { c, e: createAnalogEngine(c.build()) };
}

describe('relay', () => {
  test('pulls in above the pull-in current and not below; drops out with hysteresis', () => {
    const { c, e } = relayOnSupply(3.0); // 43 mA
    e.advance(0.05);
    expect(e.state('K').energised).toBe(false);
    expect(e.state('K').closed).toBe(false);
    expect(e.voltage(c.net('nc'))).toBeCloseTo(5, 3);
    expect(e.state('K').coilCurrent).toBeCloseTo(3 / 70, 4);

    e.setParam('S', 'voltage', 4.0); // 57 mA
    e.advance(0.05);
    expect(e.state('K').energised).toBe(true);
    expect(e.state('K').closed).toBe(true);
    expect(e.voltage(c.net('no'))).toBeCloseTo(5, 3);
    expect(e.voltage(c.net('nc'))).toBeLessThan(1e-6);

    // Hysteresis: 2 V (29 mA) is below pull-in but above drop-out: it stays in.
    e.setParam('S', 'voltage', 2.0);
    e.advance(0.05);
    expect(e.state('K').energised).toBe(true);
    expect(e.state('K').closed).toBe(true);
    e.setParam('S', 'voltage', 1.0); // 14 mA: drops out
    e.advance(0.05);
    expect(e.state('K').energised).toBe(false);
    expect(e.state('K').closed).toBe(false);
    expect(e.state('K').nc).toBe(true);
  });

  test('the contacts change an operate time after the coil current reaches pull-in, break before make', () => {
    const { e } = relayOnSupply(5);
    // Coil: τ = L/R = 1.43 ms; 70 % of the final current at τ·ln(1/0.3) = 1.72 ms; contacts 5 ms later.
    const pullIn = (0.1 / 70) * Math.log(1 / 0.3);
    let energisedAt = NaN;
    let ncOpenAt = NaN;
    let noMadeAt = NaN;
    let bothOpen = false;
    for (let i = 0; i < 400; i++) {
      e.advance(2.5e-5);
      const s = e.state('K');
      if (s.energised && Number.isNaN(energisedAt)) energisedAt = e.time;
      if (!s.nc && Number.isNaN(ncOpenAt)) ncOpenAt = e.time;
      if (s.closed && Number.isNaN(noMadeAt)) noMadeAt = e.time;
      if (!s.nc && !s.closed) bothOpen = true;
      expect(s.nc && s.closed).toBe(false);
    }
    expect(Math.abs(energisedAt - pullIn)).toBeLessThan(5e-5);
    expect(Math.abs(noMadeAt - (pullIn + 0.005))).toBeLessThan(1e-4);
    expect(ncOpenAt).toBeLessThan(noMadeAt);
    expect(bothOpen).toBe(true);
  });

  function flyback(withDiode: boolean) {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('K', 'relay', { A: 'vcc', B: 'coil' })
      .add('SW', 'switch', { '1': 'coil', '2': 'gnd' }, { closed: true });
    if (withDiode) c.add('D', 'diode', { A: 'coil', K: 'vcc' });
    const e = createAnalogEngine(c.build());
    e.advance(0.02);
    expect(e.state('K').energised).toBe(true);
    const rec = e.watch([c.net('coil')]);
    e.setParam('SW', 'closed', false);
    e.advance(0.02);
    return { e, peak: Math.max(...rec.values()[0]!) };
  }

  test('interrupting the coil current makes a large spike, and a flyback diode clamps it', () => {
    const bare = flyback(false);
    // 71 mA into 7 kΩ (100 × the coil resistance): about 500 V above the 5 V supply.
    expect(bare.peak).toBeGreaterThan(50);
    expect(bare.peak).toBeLessThan(1000);
    expect(bare.e.messages.some((m) => m.element === 'K' && /spike/.test(m.text))).toBe(true);
    expect(bare.e.state('K').energised).toBe(false);
    expect(bare.e.state('K').nc).toBe(true);

    const clamped = flyback(true);
    expect(clamped.peak).toBeGreaterThan(5.3);
    expect(clamped.peak).toBeLessThan(6);
    expect(clamped.e.messages.some((m) => /spike/.test(m.text))).toBe(false);
    // With the diode the current decays slowly (L/R), so the relay releases later.
    expect(clamped.e.state('K').energised).toBe(false);
  });

  test('driven by a transistor, with a flyback diode', () => {
    const c = circuit()
      .add('V', 'rail', { v: 'vcc' }, { voltage: 5 })
      .add('K', 'relay', { A: 'vcc', B: 'coil', NO: 'lamp', COM: 'vcc' })
      .add('D', 'diode', { A: 'coil', K: 'vcc' })
      .add('Q', 'npn', { B: 'b', C: 'coil', E: 'gnd' })
      .add('RB', 'resistor', { '1': 'in', '2': 'b' }, { resistance: 2200 })
      .add('IN', 'spdt', { C: 'in', '0': 'gnd', '1': 'vcc' })
      .add('L', 'lamp', { '1': 'lamp', '2': 'gnd' }, { ratedVoltage: 5, ratedPower: 0.5 });
    const e = createAnalogEngine(c.build());
    e.setParam('IN', 'throw', 1);
    e.advance(0.2);
    expect(e.state('Q').region).toBe('saturation');
    expect(e.state('K').closed).toBe(true);
    expect(e.state('L').brightness as number).toBeGreaterThan(0.9);
    e.setParam('IN', 'throw', 0);
    const rec = e.watch([c.net('coil')]);
    e.advance(0.2);
    expect(Math.max(...rec.values()[0]!)).toBeLessThan(6);
    expect(e.state('K').closed).toBe(false);
    expect(e.state('L').brightness as number).toBeLessThan(0.05);
    expect(e.stats.failures).toBe(0);
  });
});
