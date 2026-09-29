import { describe, expect, test } from 'vitest';
import { expectedValue, probeValue } from './probe';
import { checkMeasurement } from '$lib/sim/check';
import type { Circuit } from '$lib/sim/netlist/types';

/** 10 V across 1 kΩ + 1 kΩ: 5 V at the middle, 5 mA. */
const divider: Circuit = {
  version: 1,
  engine: 'analog',
  components: [
    { id: 'B1', type: 'battery', x: 4, y: 10, rot: 270, params: { voltage: 10 } },
    { id: 'R1', type: 'resistor', x: 8, y: 2, params: { resistance: 1000 } },
    { id: 'R2', type: 'resistor', x: 18, y: 4, rot: 90, params: { resistance: 1000 } },
    { id: 'G1', type: 'ground', x: 4, y: 12 },
    { id: 'G2', type: 'ground', x: 18, y: 12 },
  ],
  wires: [
    { points: [[4, 6], [4, 2], [8, 2]] },
    { points: [[4, 10], [4, 12]] },
    { points: [[12, 2], [18, 2], [18, 4]] },
    { points: [[18, 8], [18, 12]] },
  ],
};

describe('measure', () => {
  test('probes read the circuit', () => {
    expect(probeValue(divider, { voltage: 'R2.1' })).toBeCloseTo(5, 2);
    expect(probeValue(divider, { between: ['R1.1', 'R2.1'] })).toBeCloseTo(5, 2);
    expect(Math.abs(probeValue(divider, { current: 'R1' }))).toBeCloseTo(0.005, 4);
    expect(probeValue(divider, { power: 'R2' })).toBeCloseTo(0.025, 4);
    expect(() => probeValue(divider, { voltage: 'nowhere' })).toThrow(/nowhere/);
    expect(() => probeValue(divider, {})).toThrow();
  });
  test('the expected value and the reader’s answer', () => {
    expect(expectedValue({ id: 'm', answer: '4.7 k' })).toBe(4700);
    expect(expectedValue({ id: 'm', probe: { voltage: 'R2.1' } }, divider)).toBeCloseTo(5, 2);
    expect(() => expectedValue({ id: 'm' })).toThrow();
    const want = expectedValue({ id: 'm', probe: { current: 'R1' } }, divider);
    expect(checkMeasurement('5 mA', Math.abs(want), 0.05).pass).toBe(true);
    expect(checkMeasurement('5 A', Math.abs(want), 0.05).reason).toBe('wrong magnitude');
  });
});
