import { describe, expect, test } from 'vitest';
import {
  DRAM, advance, cellsIn, chargeShare, createDram, firstFailure, leak, load, minCellVoltage, refreshInterval, refreshOverhead, refreshRow, retentions, sensed, swing, tally, tauFor, tempFactor, TRFC_NS,
} from './dram';

const ones = (n: number) => Array.from({ length: n }, () => Array<number>(n).fill(1));
const checker = (n: number) => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (r + c) % 2));

describe('charge sharing', () => {
  test('charge is conserved', () => {
    const v = chargeShare(1.2, 0.6);
    expect(v * (DRAM.cs + DRAM.cbl)).toBeCloseTo(1.2 * DRAM.cs + 0.6 * DRAM.cbl, 20);
  });
  test('a fresh 1 or 0 moves the bit line by ±67 mV, one ninth of the half-supply', () => {
    expect(swing(1.2)).toBeCloseTo(0.0667, 3);
    expect(swing(0)).toBeCloseTo(-0.0667, 3);
    expect(swing(0.6)).toBeCloseTo(0, 12);
    expect((DRAM.cs + DRAM.cbl) / DRAM.cs).toBe(9);
  });
  test('a bigger bit line shrinks the swing; a bigger cell grows it', () => {
    expect(swing(1.2, 0.6, DRAM.cs, 4 * DRAM.cbl)).toBeLessThan(swing(1.2));
    expect(swing(1.2, 0.6, 2 * DRAM.cs, DRAM.cbl)).toBeGreaterThan(swing(1.2));
  });
  test('a stored 1 stays readable down to 0.87 V, that is 72 % of the supply', () => {
    expect(minCellVoltage()).toBeCloseTo(0.87, 3);
    expect(sensed(0.88)).toBe(1);
    expect(sensed(0.86)).toBe(0);
    expect(sensed(0)).toBe(0);
  });
});

describe('leakage', () => {
  test('a cell of retention T is exactly at the sensing limit after T', () => {
    for (const T of [0.05, 0.16, 2]) expect(leak(DRAM.vdd, T, tauFor(T))).toBeCloseTo(minCellVoltage(), 9);
  });
  test('retention halves for every 10 °C', () => {
    expect(tempFactor(85)).toBe(1);
    expect(tempFactor(95)).toBe(0.5);
    expect(tempFactor(105)).toBe(0.25);
    expect(tempFactor(75)).toBe(2);
  });
  test('the retention times are log-normal around the median, with a tail of weak cells', () => {
    const r = retentions(2000, 3);
    const sorted = [...r].sort((a, b) => a - b);
    expect(sorted[1000]!).toBeGreaterThan(1.2);
    expect(sorted[1000]!).toBeLessThan(1.9);
    expect(sorted[0]!).toBeLessThan(0.15);
    expect(sorted[1999]!).toBeGreaterThan(6);
  });
  test('the default 8 × 8 array: the weakest cell holds for 159 ms at 85 °C and 40 ms at 105 °C', () => {
    const sim = createDram(8, 8);
    load(sim, ones(8));
    expect(firstFailure(sim, 85)).toBeCloseTo(0.159, 3);
    expect(firstFailure(sim, 105)).toBeCloseTo(0.0397, 3);
  });
});

describe('refresh', () => {
  test('without refresh, every stored 1 becomes unreadable in the end, and zeros are safe', () => {
    const sim = createDram(8, 8);
    load(sim, checker(8));
    advance(sim, 60, 85, null);
    expect(tally(sim)).toMatchObject({ ones: 32, readable: 0 });
    // Reading it now finds every 1 gone.
    for (let r = 0; r < 8; r++) refreshRow(sim, r);
    expect(tally(sim).lost).toBe(32);
    expect(sim.data.flat().filter(Boolean)).toHaveLength(0);
  });
  test('a refresh every 64 ms keeps all of it at 85 °C, for a minute', () => {
    const sim = createDram(8, 8);
    load(sim, ones(8));
    for (let i = 0; i < 600; i++) advance(sim, 0.1, 85, 0.064);
    expect(tally(sim)).toMatchObject({ lost: 0, ones: 64, readable: 64 });
    expect(sim.refreshes).toBeGreaterThan(8 * 900);
  });
  test('every 500 ms is too slow: cells are lost', () => {
    const sim = createDram(8, 8);
    load(sim, ones(8));
    for (let i = 0; i < 100; i++) advance(sim, 0.1, 85, 0.5);
    expect(tally(sim).lost).toBeGreaterThan(0);
  });
  test('at 105 °C the 64 ms refresh is too slow, and 32 ms (JEDEC’s extended-temperature rate) is enough', () => {
    const slow = createDram(8, 8);
    load(slow, ones(8));
    for (let i = 0; i < 100; i++) advance(slow, 0.1, 105, 0.064);
    expect(tally(slow).lost).toBeGreaterThan(0);
    const fast = createDram(8, 8);
    load(fast, ones(8));
    for (let i = 0; i < 100; i++) advance(fast, 0.1, 105, 0.032);
    expect(tally(fast).lost).toBe(0);
  });
  test('rows are refreshed in turn, once per interval', () => {
    const sim = createDram(8, 8);
    load(sim, ones(8));
    advance(sim, 0.064 * 3 - 1e-9, 85, 0.064);
    expect(sim.refreshes).toBe(8 * 3);
  });
  test('a refreshed cell is back at full charge', () => {
    const sim = createDram(2, 2);
    load(sim, ones(2));
    advance(sim, 0.05, 85, null);
    expect(sim.v[0]![0]!).toBeLessThan(DRAM.vdd);
    refreshRow(sim, 0);
    expect(sim.v[0]!.every((x) => x === DRAM.vdd || x === 0)).toBe(true);
  });
});

describe('refresh in numbers', () => {
  test('64 ms over 8192 commands is 7.8 µs apart', () => {
    expect(refreshInterval() * 1e6).toBeCloseTo(7.8125, 4);
  });
  test('a 8 Gbit DDR4 chip (350 ns per command) is refreshing 4.5 % of the time; a 16 Gbit chip 7 %', () => {
    expect(refreshOverhead(TRFC_NS[8]! * 1e-9)).toBeCloseTo(0.0448, 3);
    expect(refreshOverhead(TRFC_NS[16]! * 1e-9)).toBeCloseTo(0.0704, 3);
  });
  test('a 16 Gbit chip has 17 billion cells', () => {
    expect(cellsIn(16)).toBe(17179869184);
  });
});
