import { describe, expect, test } from 'vitest';
import '../../sim/netlist/catalog';
import { createAnalogEngine } from '../../sim/analog';
import type { Circuit } from '../../sim/netlist/types';
import { flatten } from '../../sim/netlist/flatten';
import { topLevelNets } from '../../sim/netlist/flatten';
import { autorange, measureResistance, readoutText } from './meter';

describe('autorange', () => {
  test.each([
    [0, 'V', '0.000', '', 3],
    [1.2345, 'V', '1.234', '', 3],
    [12.345, 'V', '12.35', '', 2],
    [123.45, 'V', '123.5', '', 1],
    [999.94, 'V', '999.9', '', 1],
    [999.96, 'V', '1.000', 'k', 3],
    [0.0047, 'A', '4.700', 'm', 3],
    [-0.0047, 'A', '-4.700', 'm', 3],
    [4.7e-6, 'A', '4.700', 'µ', 3],
    [4700, 'Ω', '4.700', 'k', 3],
    [2.2e6, 'Ω', '2.200', 'M', 3],
    [0.5, 'V', '500.0', 'm', 1],
    [1e-13, 'V', '0.100', 'p', 3],
    [1e-17, 'V', '0.000', '', 3],
  ])('%s %s reads %s %s', (value, unit, text, prefix, decimals) => {
    const r = autorange(value, unit);
    expect(r.text).toBe(text);
    expect(r.prefix).toBe(prefix);
    expect(r.decimals).toBe(decimals);
    expect(r.unit).toBe(unit);
    expect(r.overload).toBe(false);
  });

  test('a negative value that rounds to zero has no sign', () => {
    expect(autorange(-1e-17, 'V').text).toBe('0.000');
    expect(autorange(-0.00004999, 'V', 4).text).not.toContain('-0.000');
  });

  test('no number and overload', () => {
    expect(autorange(NaN, 'V').text).toBe('----');
    expect(autorange(Infinity, 'Ω')).toMatchObject({ text: 'OL', overload: true });
    expect(autorange(1e15, 'Ω').overload).toBe(true);
  });

  test('screen reader text', () => {
    expect(readoutText(autorange(-0.0047, 'A'))).toBe('−4.700 mA');
    expect(readoutText(autorange(NaN, 'V'))).toBe('no reading');
    expect(readoutText(autorange(Infinity, 'Ω'))).toBe('overload');
  });
});

describe('resistance by test source', () => {
  const make = (c: Circuit) => {
    const flat = flatten(c);
    const conn = topLevelNets(c);
    return { flat, net: (pin: string) => conn.pinNet.get(pin)! };
  };
  const base: Circuit = {
    version: 1,
    engine: 'analog',
    components: [
      { id: 'B1', type: 'battery', x: 0, y: 0, params: { voltage: 9 } },
      { id: 'R1', type: 'resistor', x: 8, y: 0, params: { resistance: 1000 } },
      { id: 'R2', type: 'resistor', x: 16, y: 0, params: { resistance: 2000 } },
      { id: 'C1', type: 'capacitor', x: 24, y: 0, params: { capacitance: 1e-6 } },
      { id: 'G1', type: 'ground', x: 30, y: 4 },
    ],
    wires: [
      { points: [[4, 0], [8, 0]] },
      { points: [[12, 0], [16, 0]] },
      { points: [[20, 0], [24, 0]] },
      { points: [[28, 0], [30, 0], [30, 4]] },
    ],
  };

  test('a resistor, a series pair, with a live battery in the circuit', async () => {
    const { flat, net } = make(base);
    const r1 = await measureResistance(flat, net('R1.1'), net('R1.2'), createAnalogEngine);
    expect(r1.ohms).toBeCloseTo(1000, 0);
    const series = await measureResistance(flat, net('R1.1'), net('R2.2'), createAnalogEngine);
    expect(series.ohms).toBeCloseTo(3000, 0);
  });

  test('a capacitor reads as an open circuit once it has charged', async () => {
    const { flat, net } = make(base);
    expect((await measureResistance(flat, net('R2.2'), net('C1.2'), createAnalogEngine)).ohms).toBe(Infinity);
  });

  test('the same net is 0 Ω, and diodes are flagged as nonlinear', async () => {
    const { flat, net } = make(base);
    expect((await measureResistance(flat, net('R1.2'), net('R2.1'), createAnalogEngine)).ohms).toBe(0);
    const withDiode: Circuit = { ...base, components: [...base.components, { id: 'D1', type: 'diode', x: 0, y: 8 }] };
    const m = make(withDiode);
    expect((await measureResistance(m.flat, m.net('R1.1'), m.net('R1.2'), createAnalogEngine)).nonlinear).toBe(true);
  });
});
