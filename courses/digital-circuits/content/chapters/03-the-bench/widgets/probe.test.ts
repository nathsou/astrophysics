import { describe, expect, test } from 'vitest';
import { classify, lamps } from './probe';

describe('logic probe', () => {
  test('two thresholds and a dead zone between them', () => {
    expect(classify(5)).toBe('high');
    expect(classify(3.5)).toBe('high');
    expect(classify(3.4)).toBe('between');
    expect(classify(2.5)).toBe('between');
    expect(classify(1.5)).toBe('low');
    expect(classify(0)).toBe('low');
  });

  test('static levels light one lamp; between and floating light none', () => {
    expect(lamps({ kind: 'level', volts: 5 }, 0)).toEqual({ high: 1, low: 0, pulse: 0 });
    expect(lamps({ kind: 'level', volts: 0 }, 0)).toEqual({ high: 0, low: 1, pulse: 0 });
    expect(lamps({ kind: 'level', volts: 2.5 }, 0)).toEqual({ high: 0, low: 0, pulse: 0 });
    expect(lamps({ kind: 'floating' }, 0)).toEqual({ high: 0, low: 0, pulse: 0 });
  });

  test('a fast clock lights PULSE and shares the light between HIGH and LOW by duty cycle', () => {
    const l = lamps({ kind: 'clock', hz: 1000, duty: 0.25 }, 0.123);
    expect(l).toEqual({ high: 0.25, low: 0.75, pulse: 1 });
  });

  test('a slow clock blinks, and PULSE is stretched for 100 ms after each edge', () => {
    const src = { kind: 'clock', hz: 1, duty: 0.5 } as const;
    expect(lamps(src, 0.01)).toEqual({ high: 1, low: 0, pulse: 1 });
    expect(lamps(src, 0.3)).toEqual({ high: 1, low: 0, pulse: 0 });
    expect(lamps(src, 0.55)).toEqual({ high: 0, low: 1, pulse: 1 });
    expect(lamps(src, 0.8)).toEqual({ high: 0, low: 1, pulse: 0 });
  });
});
