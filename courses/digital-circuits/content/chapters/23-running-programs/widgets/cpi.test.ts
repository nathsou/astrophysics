import { describe, expect, test } from 'vitest';
import { MEASURED, ips, measure, measureRv32, seconds } from './cpi';

describe('cycles per instruction', () => {
  const all = MEASURED.map((id) => measure(id));
  test('every program halts, and cycles = 3 × instructions + execute cycles', () => {
    for (const m of all) {
      expect(m.instructions, m.id).toBeGreaterThan(5);
      expect(m.overhead).toBe(3 * m.instructions);
      expect(m.overhead + m.execute).toBe(m.cycles);
      expect(Object.values(m.byGroup).reduce((a, b) => a + b, 0)).toBe(m.cycles);
      expect(Object.values(m.countByGroup).reduce((a, b) => a + b, 0)).toBe(m.instructions);
    }
  });
  test('CPI is between 4 and 8 for every program, and the fetch and decode are over half of it', () => {
    for (const m of all) {
      expect(m.cpi).toBeGreaterThanOrEqual(4);
      expect(m.cpi).toBeLessThanOrEqual(8);
      expect(3 / m.cpi, m.id).toBeGreaterThan(0.5);
    }
  });
  test('the numbers quoted in the chapter', () => {
    const by = Object.fromEntries(all.map((m) => [m.id, m]));
    expect(by.sum).toMatchObject({ instructions: 20, cycles: 110, bytes: 13 });
    expect(by.sum!.cpi).toBe(5.5);
    // The multiply program, 13 × 11.
    expect(by.multiply!.cycles).toBeGreaterThan(300);
    expect(by.multiply!.instructions).toBeGreaterThan(50);
    // Print out the values the text uses.
    const table = all.map((m) => `${m.id}: ${m.instructions} instr, ${m.cycles} cycles, CPI ${m.cpi.toFixed(2)}, ${m.bytes} bytes`);
    expect(table.length).toBe(6);
  });
  test('the iron law: time = instructions × CPI / f', () => {
    const m = measure('sum');
    expect(seconds(m.cycles, 1e6)).toBeCloseTo(110e-6, 12);
    expect(ips(1e6, m.cpi)).toBeCloseTo(181818.18, 1);
    expect(seconds(m.cycles, 1e6)).toBeCloseTo(m.instructions / ips(1e6, m.cpi), 12);
  });

  test('the same tasks on RV32I, the numbers of the comparison in the text', () => {
    const rows = ['multiply', 'sort'].map((id) => ({ id, octet: measure(id), rv32: measureRv32(id) }));
    const mul = rows[0]!;
    expect([mul.octet.bytes, mul.octet.instructions, mul.octet.cycles]).toEqual([49, 60, 329]);
    expect([mul.rv32.bytes, mul.rv32.instructions, mul.rv32.cycles]).toEqual([64, 29, 58]);
    const sort = rows[1]!;
    expect([sort.octet.bytes, sort.octet.instructions, sort.octet.cycles]).toEqual([38, 581, 2941]);
    expect([sort.rv32.bytes, sort.rv32.instructions, sort.rv32.cycles]).toEqual([68, 317, 634]);
    // RV32I's fixed 32-bit instructions cost code size; its wider registers and compare-and-branch cost fewer instructions.
    for (const r of rows) {
      expect(r.rv32.cpi).toBe(2); // fetch and execute: every instruction of the DCL core takes two cycles
      expect(r.rv32.cycles).toBe(2 * r.rv32.instructions);
      expect(r.octet.cpi).toBeGreaterThan(4.9);
    }
  });
});
