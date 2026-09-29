import { describe, expect, test } from 'vitest';
import { checkScenarios } from './scenarios';
import type { Circuit } from '../netlist/types';

/** Battery, resistor, LED in series; `flip` reverses the LED. */
const ledCircuit = (flip: boolean, withResistor = true): Circuit => ({
  version: 1,
  engine: 'analog',
  components: [
    { id: 'B1', type: 'battery', x: 4, y: 10, rot: 270, params: { voltage: 9 } },
    { id: 'S1', type: 'switch', x: 8, y: 2 },
    ...(withResistor ? [{ id: 'R1', type: 'resistor', x: 14, y: 2, params: { resistance: 470 } }] : []),
    { id: 'D1', type: 'led', x: 24, y: 4, rot: flip ? 270 : 90, params: { color: 'red' } },
    { id: 'G1', type: 'ground', x: 4, y: 12 },
  ],
  wires: [
    { points: [[4, 6], [4, 2], [8, 2]] },
    { points: [[12, 2], [14, 2]] },
    withResistor ? { points: [[18, 2], [24, 2], [24, 4]] } : { points: [[12, 2], [24, 2], [24, 4]] },
    { points: [[24, 8], [24, 12], [4, 12], [4, 10]] },
  ],
});

describe('scenarios', () => {
  const on = [{ name: 'switch closed', set: { S1: true }, expect: { D1: 'lit' as const } }, { name: 'switch open', set: { S1: false }, expect: { D1: 'unlit' as const } }];
  test('a working LED circuit passes', () => {
    const r = checkScenarios(ledCircuit(false), on);
    expect(r.problems).toEqual([]);
    expect(r.pass).toBe(true);
  });
  test('a reversed LED stays dark', () => {
    const r = checkScenarios(ledCircuit(true), on);
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toMatchObject({ scenario: 'switch closed', target: 'D1', expected: 'lit', got: 'dark' });
  });
  test('an LED without a resistor burns out', () => {
    const r = checkScenarios(ledCircuit(false, false), [{ set: { S1: true }, expect: { D1: 'ok' } }], { });
    expect(r.pass).toBe(false);
    expect(r.failures[0]!.got).toBe('burned out');
  });
  test('voltage ranges and unknown targets', () => {
    const r = checkScenarios(ledCircuit(false), [{ set: { S1: true }, expect: { 'R1.1': [8.9, 9.1], 'R1.2': [0, 1], nope: 'high' } }]);
    expect(r.failures.map((f) => f.target)).toEqual(['R1.2']);
    expect(r.problems.join()).toContain('nope');
  });
});
