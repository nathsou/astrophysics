import { describe, expect, test } from 'vitest';
import { OHMS_PER_KM, keyDownAt, lineResistance, morseSchedule } from './telegraph';

describe('telegraph helpers', () => {
  test('line resistance', () => {
    expect(OHMS_PER_KM).toBe(8);
    expect(lineResistance(100)).toBe(800);
  });
  test('SOS is three dots, three dashes, three dots: 27 units', () => {
    const { events, duration } = morseSchedule('SOS', 0.1);
    expect(events.length).toBe(18);
    expect(duration).toBeCloseTo(2.7, 9);
    // S: down 0.0–0.1, up, down 0.2–0.3 …; first dash of O starts after a 3-unit letter gap.
    expect(events[0]).toEqual({ t: 0, down: true });
    expect(events[1]!.t).toBeCloseTo(0.1, 9);
    expect(events[6]!.t).toBeCloseTo(0.8, 9);
    expect(events[7]!.t).toBeCloseTo(1.1, 9);
  });
  test('events alternate down/up and never go backwards', () => {
    const { events } = morseSchedule('HELLO WORLD');
    events.forEach((e, i) => expect(e.down).toBe(i % 2 === 0));
    for (let i = 1; i < events.length; i++) expect(events[i]!.t).toBeGreaterThan(events[i - 1]!.t);
  });
  test('keyDownAt', () => {
    const { events } = morseSchedule('K', 1); // -.-
    expect(keyDownAt(events, 0.5)).toBe(true);
    expect(keyDownAt(events, 3.5)).toBe(false);
    expect(keyDownAt(events, 4.5)).toBe(true);
    expect(keyDownAt(events, 6.5)).toBe(true);
    expect(keyDownAt(events, 100)).toBe(false);
  });
});
