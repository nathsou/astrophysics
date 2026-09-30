import { describe, expect, test } from 'vitest';
import { FLASH, KINDS, inWindow, levelsFor, margin, program, readLevel, references, stepFor, windows, wobble } from './flash';

describe('windows and references', () => {
  test('2, 4, 8 and 16 levels; one fewer reference than levels', () => {
    for (const bits of [1, 2, 3, 4]) {
      expect(windows(bits)).toHaveLength(levelsFor(bits));
      expect(references(bits)).toHaveLength(levelsFor(bits) - 1);
    }
  });
  test('windows do not overlap, and fit between the erased and the top voltage', () => {
    for (const bits of [1, 2, 3, 4]) {
      const w = windows(bits);
      expect(w[0]!.lo).toBe(FLASH.erased);
      expect(w.at(-1)!.hi).toBeLessThanOrEqual(FLASH.top);
      for (let i = 1; i < w.length; i++) expect(w[i]!.lo).toBeGreaterThan(w[i - 1]!.hi);
    }
  });
  test('the margin shrinks as bits are added: about 1.6 V for SLC, 0.4 V for TLC, 0.2 V for QLC', () => {
    expect(margin(1)).toBeCloseTo(1.575, 2);
    expect(margin(2)).toBeCloseTo(0.7875, 3);
    expect(margin(3)).toBeCloseTo(0.394, 2);
    expect(margin(4)).toBeCloseTo(0.197, 2);
    expect(margin(1) / margin(4)).toBeCloseTo(8, 9);
  });
  test('a read compares with the references and gets each window right', () => {
    for (const bits of [1, 2, 3, 4]) for (const w of windows(bits)) {
      expect(readLevel(w.lo, bits)).toBe(w.level);
      expect(readLevel(w.hi, bits)).toBe(w.level);
      expect(readLevel((w.lo + w.hi) / 2, bits)).toBe(w.level);
    }
  });
});

describe('programming', () => {
  test('pulses raise Vt until it enters the window, and it never overshoots the window if the step is small enough', () => {
    for (const bits of [1, 2, 3, 4]) {
      for (const w of windows(bits)) {
        const p = program(FLASH.erased, w.level, bits, wobble);
        expect(p.vt).toBeGreaterThanOrEqual(w.lo);
        expect(inWindow(p.vt, w.level, bits)).toBe(true);
        expect(readLevel(p.vt, bits)).toBe(w.level);
        expect(p.trace.every((v, i) => i === 0 || v > p.trace[i - 1]!)).toBe(true);
      }
    }
  });
  test('the pulse gets smaller as the windows get narrower', () => {
    expect(stepFor(1)).toBe(0.3);
    expect(stepFor(4)).toBeLessThan(stepFor(3));
    expect(stepFor(3)).toBeLessThan(stepFor(2) + 1e-9);
  });
  test('the erased level needs no pulse; finer levels need more pulses', () => {
    expect(program(FLASH.erased, 0, 3).pulses).toBe(0);
    const top = (bits: number) => program(FLASH.erased, levelsFor(bits) - 1, bits).pulses;
    expect(top(1)).toBeLessThan(top(2) + 1);
    expect(top(4)).toBeGreaterThan(top(1));
  });
});

test('endurance falls as bits per cell rise', () => {
  expect(KINDS.map((k) => k.name)).toEqual(['SLC', 'MLC', 'TLC', 'QLC']);
  for (let i = 1; i < KINDS.length; i++) expect(KINDS[i]!.endurance).toBeLessThan(KINDS[i - 1]!.endurance);
});
