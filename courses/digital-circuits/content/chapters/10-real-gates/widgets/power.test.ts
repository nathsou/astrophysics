import { describe, expect, test } from 'vitest';
import { PRESETS, dynamicPower, energyPerCycle, heatFlux, powerAt, scale, staticPower, totalPower } from './power';
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from '../../03-the-bench/widgets/flat';

describe('dynamic power', () => {
  test('P = α·C·V²·f', () => {
    const g = PRESETS.gate.chip;
    expect(dynamicPower(g)).toBeCloseTo(15e-12 * 25 * 1e6, 9);
    // Double the voltage, four times the power; double the frequency, twice.
    expect(dynamicPower({ ...g, vdd: 10 }) / dynamicPower(g)).toBeCloseTo(4, 9);
    expect(dynamicPower({ ...g, f: 2e6 }) / dynamicPower(g)).toBeCloseTo(2, 9);
  });

  test('the billion-transistor chip draws about a hundred watts, and 5 V would be unthinkable', () => {
    const c = PRESETS.chip.chip;
    expect(dynamicPower(c)).toBeGreaterThan(80);
    expect(dynamicPower(c)).toBeLessThan(110);
    expect(staticPower(c)).toBeGreaterThan(5);
    expect(staticPower(c)).toBeLessThan(12);
    expect(totalPower(c)).toBeGreaterThan(90);
    expect(totalPower(c)).toBeLessThan(120);
    expect(powerAt(c, c.f, 5) / powerAt(c, c.f, 0.8)).toBeGreaterThan(30);
    expect(heatFlux(totalPower(c), 1.5)).toBeGreaterThan(50);
  });

  test('the engine agrees: a driver charging a capacitor from the supply draws C·V² per cycle', () => {
    // A 5 V square wave into 100 Ω and 100 pF: the average supply current times V is C·V²·f.
    const C = 100e-12;
    const f = 1e6;
    const c = netlist();
    c.add('G', 'siggen', { '-': 'gnd', '+': 'in' }, { waveform: 'square', frequency: f, amplitude: 2.5, offset: 2.5, rise: 1e-9 });
    c.add('R', 'resistor', { '1': 'in', '2': 'out' }, { resistance: 100 });
    c.add('CL', 'capacitor', { '1': 'out', '2': 'gnd' }, { capacitance: C });
    const e = createAnalogEngine(c.build(), { step: 2e-9 });
    // Energy delivered by the source over 5 periods, ∫ v·i dt, summed on the fly.
    let energy = 0;
    const dt = 1e-9;
    for (let i = 0; i < 2000; i++) e.advance(dt); // 2 periods to settle
    const t0 = e.time;
    for (let i = 0; i < 5000; i++) {
      e.advance(dt);
      energy += e.voltage(c.net('in')) * -e.current('G', 1) * dt;
    }
    const perCycle = energy / ((e.time - t0) * f);
    expect(Math.abs(perCycle)).toBeGreaterThan(0.85 * energyPerCycle(C, 5));
    expect(Math.abs(perCycle)).toBeLessThan(1.15 * energyPerCycle(C, 5));
  });
});

describe('Dennard scaling', () => {
  test('constant-field scaling keeps power density constant', () => {
    for (let g = 0; g <= 12; g++) {
      const s = scale(g, 'dennard');
      expect(s.powerDensity).toBeCloseTo(1, 9);
      expect(s.perTransistor).toBeCloseTo(2 ** -g, 9);
      expect(s.density).toBeCloseTo(2 ** g, 9);
      expect(s.frequency).toBeCloseTo(Math.SQRT2 ** g, 9);
    }
  });

  test('with the voltage stuck, power density doubles every generation; freezing the clock halves the growth', () => {
    expect(scale(10, 'voltage-stuck').powerDensity).toBeCloseTo(2 ** 10, 6);
    expect(scale(10, 'clock-frozen').powerDensity).toBeCloseTo(Math.SQRT2 ** 10, 6);
    expect(scale(10, 'clock-frozen').frequency).toBe(1);
  });
});
