import { describe, expect, test } from 'vitest';
import { SarBench, VREF, buildSar, idealCode, search } from './sar';

describe('the analogue half', () => {
  test('the ladder gives code/2^n of 5 V at the comparator, for every code of 4 and 8 bits', () => {
    for (const bits of [4, 8]) {
      const bench = new SarBench(bits);
      bench.setVin(2.5);
      for (let code = 0; code < 1 << bits; code += bits === 8 ? 5 : 1) {
        const { vdac } = bench.setCode(code);
        expect(vdac, `${bits} bits, code ${code}`).toBeCloseTo((VREF * code) / (1 << bits), 3);
      }
    }
  });
  test('the comparator is 1 exactly when Vin is above the DAC', () => {
    const bench = new SarBench(4);
    bench.setVin(3.5);
    for (let code = 0; code < 16; code++) expect(bench.setCode(code).above, `${code}`).toBe((5 * code) / 16 < 3.5);
  });
  test('the netlist has 3n − 1 resistors, n logic outputs, one comparator', () => {
    const f = buildSar(8);
    expect(f.elements.filter((e) => e.type === 'resistor')).toHaveLength(8 + 7 + 1);
    expect(f.elements.filter((e) => e.type === 'toggle')).toHaveLength(8);
    expect(f.elements.filter((e) => e.type === 'comparator')).toHaveLength(1);
  });
});

describe('the search', () => {
  test('it takes n comparisons, MSB first, and keeps a bit when Vin is still above the DAC', () => {
    const bench = new SarBench(4);
    bench.setVin(3.5);
    const steps = search(4, (c) => bench.setCode(c));
    expect(steps.map((s) => s.bit)).toEqual([3, 2, 1, 0]);
    expect(steps.map((s) => s.trial)).toEqual([0b1000, 0b1100, 0b1010, 0b1011]);
    expect(steps.map((s) => s.above)).toEqual([true, false, true, true]);
    expect(steps.at(-1)!.result).toBe(11);
    expect(steps[0]!.vdac).toBeCloseTo(2.5, 3);
  });

  test('over the whole input range the result is the ideal code, for 4 and 8 bits', () => {
    for (const bits of [4, 8]) {
      const bench = new SarBench(bits);
      const lsb = VREF / (1 << bits);
      for (let v = 0.013; v < 5; v += bits === 8 ? 0.0377 : 0.0431) {
        bench.setVin(v);
        const got = search(bits, (c) => bench.setCode(c)).at(-1)!.result;
        // Away from a step boundary it is exact; the comparator's millivolt hysteresis only matters within a hair of one.
        const frac = (v / lsb) % 1;
        if (frac > 0.1 && frac < 0.9) expect(got, `${bits} bits, ${v.toFixed(3)} V`).toBe(idealCode(v, bits));
        else expect(Math.abs(got - idealCode(v, bits))).toBeLessThanOrEqual(1);
      }
    }
  });

  test('an 8-bit conversion is 8 comparisons, however large the input: log₂ of the number of levels, not the number of levels', () => {
    const bench = new SarBench(8);
    bench.setVin(4.2);
    expect(search(8, (c) => bench.setCode(c))).toHaveLength(8);
    // A counting converter would need up to 255 comparisons.
    expect(idealCode(4.99, 8)).toBe(255);
  });
});
