import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import matrix from './circuits/matrix.json';

const engine = () => createDigitalEngine(flatten(matrix as unknown as Circuit));
type Eng = ReturnType<typeof engine>;

function net(e: Eng, pin: string): number {
  const [id, name] = pin.split('.');
  const el = e.netlist.elements.find((x) => x.id === id)!;
  return el.pins[el.pinNames.indexOf(name!)]!;
}

/** Hold some keys and sample the scan lines and the columns every 10 ms for two seconds (four scan cycles). */
function scan(keys: string[]) {
  const e = engine();
  for (const k of keys) e.setParam(k, 'pressed', true);
  e.settle();
  const R0 = e.netlist.netNames.indexOf('R0');
  const R1 = e.netlist.netNames.indexOf('R1');
  expect(R0).toBeGreaterThanOrEqual(0);
  expect(R1).toBeGreaterThanOrEqual(0);
  const C0 = net(e, 'C0.Y');
  const C1 = net(e, 'C1.Y');
  const rows: { r0: number; r1: number; c0: number; c1: number }[] = [];
  // sample in the middle of each 10 ms step, away from the clock edges (which are 1 ns apart at R0 and R1)
  e.advance(0.005);
  for (let i = 0; i < 200; i++) {
    e.advance(0.01);
    rows.push({ r0: e.logic(R0), r1: e.logic(R1), c0: e.logic(C0), c1: e.logic(C1) });
  }
  return rows;
}

describe('matrix: the scanned keyboard', () => {
  test('exactly one row is driven at any moment, and the scan visits both rows', () => {
    const rows = scan([]);
    for (const s of rows) expect(s.r0 + s.r1).toBe(1);
    expect(rows.some((s) => s.r0 === 1)).toBe(true);
    expect(rows.some((s) => s.r1 === 1)).toBe(true);
  });

  test('a row is driven for a quarter of a second at 2 Hz (half a scan cycle)', () => {
    const rows = scan([]);
    let run = 0;
    const lengths: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      run++;
      if (rows[i]!.r0 !== rows[i - 1]!.r0) {
        lengths.push(run);
        run = 0;
      }
    }
    // interior runs: 25 samples of 10 ms
    for (const l of lengths.slice(1)) expect(Math.abs(l - 25)).toBeLessThanOrEqual(1);
  });

  test('no key pressed: both columns read 0 throughout', () => {
    for (const s of scan([])) {
      expect(s.c0).toBe(0);
      expect(s.c1).toBe(0);
    }
  });

  test('each key shows up in its column exactly while its row is driven', () => {
    const cases: [string, 'r0' | 'r1', 'c0' | 'c1'][] = [
      ['KQ', 'r0', 'c0'],
      ['KA', 'r1', 'c0'],
      ['KW', 'r0', 'c1'],
      ['KS', 'r1', 'c1'],
    ];
    for (const [key, row, col] of cases) {
      const other = col === 'c0' ? 'c1' : 'c0';
      for (const s of scan([key])) {
        expect(s[col]).toBe(s[row]);
        expect(s[other]).toBe(0);
      }
    }
  });

  test('the controller can tell which key by looking at the column in each row’s time slot', () => {
    // Q and S together: column 0 is high in row 0's slot, column 1 in row 1's slot
    for (const s of scan(['KQ', 'KS'])) {
      expect(s.c0).toBe(s.r0);
      expect(s.c1).toBe(s.r1);
    }
  });

  test('two keys in the same column keep it high in both slots (each is found by which row is driven)', () => {
    const rows = scan(['KQ', 'KA']);
    for (const s of rows) {
      expect(s.c0).toBe(1);
      expect(s.c1).toBe(0);
    }
  });

  test('releasing the key clears the column', () => {
    const e = engine();
    e.setParam('KQ', 'pressed', true);
    e.advance(0.3);
    e.setParam('KQ', 'pressed', false);
    e.advance(0.01);
    for (let i = 0; i < 100; i++) {
      e.advance(0.01);
      expect(e.logic(net(e, 'C0.Y'))).toBe(0);
    }
  });
});
