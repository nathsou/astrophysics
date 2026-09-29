import { describe, expect, test } from 'vitest';
import { PINS, capacity, fitOutput } from './polarity';

describe('the polarity demo uses the real fitter', () => {
  test('macrocell sizes', () => {
    expect(PINS.map(capacity)).toEqual([8, 10, 12, 14, 16]);
  });

  test('"System OK" needs 9 terms active high and 3 active low', () => {
    const r = fitOutput('ok', 19, 'high');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.terms).toBe(9);
      expect(r.highTerms).toBe(9);
      expect(r.lowTerms).toBe(3);
      expect(r.polarity).toBe('high');
    }
  });

  test('...so active high does not fit the 8-term macrocell on pin 23, and the error says why', () => {
    const r = fitOutput('ok', 23, 'high');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.needed).toBe(9);
      expect(r.capacity).toBe(8);
      expect(r.highTerms).toBe(9);
      expect(r.lowTerms).toBe(3);
      expect(r.message).toContain('pin 23 has only 8');
    }
  });

  test('...but active low fits it easily, and the fitter picks that by itself', () => {
    for (const choice of ['low', 'auto'] as const) {
      const r = fitOutput('ok', 23, choice);
      expect(r.ok, choice).toBe(true);
      if (r.ok) {
        expect(r.polarity).toBe('low');
        expect(r.terms).toBe(3);
        expect(r.stored).toBe('/Y = G + A * B * C + D * E * F');
      }
    }
  });

  test('"All clear" is the other way round: one term active high, four active low', () => {
    const hi = fitOutput('clear', 23, 'auto');
    expect(hi.ok && hi.polarity).toBe('high');
    expect(hi.ok && hi.terms).toBe(1);
    const lo = fitOutput('clear', 23, 'low');
    expect(lo.ok && lo.terms).toBe(4);
  });

  test('5-input parity is 16 terms either way: it fits only the two biggest macrocells', () => {
    expect(fitOutput('parity5', 19, 'auto').ok).toBe(true);
    const r = fitOutput('parity5', 20, 'auto');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.highTerms).toBe(16);
      expect(r.lowTerms).toBe(16);
      expect(r.capacity).toBe(14);
    }
  });
});
