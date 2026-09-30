import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import type { Circuit } from '$lib/sim/netlist/types';
import { createAnalogEngine } from '$lib/sim/analog';
import meterVoltage from './circuits/meter-voltage.json';
import meterCurrent from './circuits/meter-current.json';

const run = (c: unknown) => {
  const flat = flatten(c as Circuit);
  const e = createAnalogEngine(flat);
  e.advance(1e-3);
  return e;
};

describe('chapter 3 circuits', () => {
  test('the voltmeter across R2 of a 6 kΩ / 3 kΩ divider on 9 V reads 3 V', () => {
    const e = run(meterVoltage);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    expect(Number(e.state('V1').value)).toBeCloseTo(3, 2);
    // The meter is nearly invisible: R1 still carries about 1 mA.
    expect(e.current('R1', 0)).toBeCloseTo(1e-3, 5);
  });

  test('the ammeter in series reads the loop current, 1 mA', () => {
    const e = run(meterCurrent);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    expect(Number(e.state('A1').value)).toBeCloseTo(1e-3, 5);
  });
});
