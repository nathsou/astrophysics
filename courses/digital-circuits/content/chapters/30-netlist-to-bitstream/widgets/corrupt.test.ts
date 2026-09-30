import { describe, expect, test, vi } from 'vitest';
import { run, setup } from './corrupt';

vi.setConfig({ testTimeout: 120_000 });

describe('the chip from its bits (Figure 30.7)', () => {
  const s = setup();

  test('the counter fits the vFPGA-S in six cells: four with flip-flops and two plain LUTs', () => {
    expect(s.result.size).toBe('S');
    expect(s.cells.map((c) => c.kind).sort()).toEqual(['ff', 'ff', 'ff', 'ff', 'lut', 'lut']);
    expect(s.cells.map((c) => c.label).sort()).toEqual(['n10', 'n11', 'value[0]', 'value[1]', 'value[2]', 'value[3]']);
  });

  test('as fitted, the chip counts 1, 2, … 15, 0, … and agrees with the RTL simulator on every cycle', () => {
    const r = run(s, s.result.bits, 20);
    expect(r.fabric.slice(0, 16)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]);
    expect(r.fabric).toEqual(r.rtl);
    expect(r.firstMismatch).toBe(0);
    expect(r.mismatched).toEqual([]);
    expect(r.checked).toBe(5);
  });

  test('any single flipped bit of value[0]’s table is noticed within two clocks, as an unknown', () => {
    const c = s.cells.find((x) => x.label === 'value[0]')!;
    for (let row = 0; row < 16; row++) {
      const bits = s.result.bits.slice();
      bits[c.offset + row] = bits[c.offset + row]! ^ 1;
      const r = run(s, bits, 20);
      expect(r.firstMismatch, `row ${row}`).toBeGreaterThan(0);
      expect(r.firstMismatch, `row ${row}`).toBeLessThanOrEqual(2);
      expect(r.fabric[r.firstMismatch - 1], `row ${row}`).toBe('x');
    }
  });

  test('inverting the whole table of value[1] gives wrong numbers, not unknowns: 3, 6, 5, 4 …', () => {
    const c = s.cells.find((x) => x.label === 'value[1]')!;
    const bits = s.result.bits.slice();
    for (let b = 0; b < 16; b++) bits[c.offset + b] = bits[c.offset + b]! ^ 1;
    const r = run(s, bits, 20);
    expect(r.firstMismatch).toBe(1);
    expect(r.fabric.slice(0, 4)).toEqual([3, 6, 5, 4]);
    expect(r.rtl.slice(0, 4)).toEqual([1, 2, 3, 4]);
  });

  test('inverting a whole table always breaks the count, whichever of the six cells it is', () => {
    for (const c of s.cells) {
      const bits = s.result.bits.slice();
      for (let b = 0; b < 16; b++) bits[c.offset + b] = bits[c.offset + b]! ^ 1;
      const r = run(s, bits, 20);
      expect(r.firstMismatch, c.label).toBeGreaterThan(0);
    }
  });

  const census = (stimulus: 'held' | 'varied') => {
    const silent: string[] = [];
    for (const c of s.cells) {
      for (let b = 0; b < 16; b++) {
        const bits = s.result.bits.slice();
        bits[c.offset + b] = bits[c.offset + b]! ^ 1;
        if (!run(s, bits, 24, stimulus).firstMismatch) silent.push(`${c.label}:${b}`);
      }
    }
    return silent;
  };

  test('flipping one bit at a time in the six tables (96 bits): with the enable held high, 88 are noticed, and the 8 silent ones are all in n11', () => {
    const silent = census('held');
    expect(silent).toHaveLength(8);
    expect(silent.every((x) => x.startsWith('n11:'))).toBe(true);
    // The rows are the half of the table in which the enable is low, wherever the router put the enable: the row numbers
    // depend on the pins it chose, so only their number is checked.
  });

  test('drop the enable every third cycle and half of the silent ones are found: 4 remain, still all in n11', () => {
    const silent = census('varied');
    expect(silent).toHaveLength(4);
    expect(silent.every((x) => x.startsWith('n11:'))).toBe(true);
  });
});
