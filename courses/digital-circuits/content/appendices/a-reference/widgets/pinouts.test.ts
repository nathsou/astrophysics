import { describe, expect, test } from 'vitest';
import { CHIPS, chipById, pinLabel, sides } from './pinouts';

const names = (id: string) => chipById(id).pins.map((p) => p.name);

describe('shape', () => {
  test('the eleven chips of the labs', () => {
    expect(CHIPS.map((c) => c.part)).toEqual(['74HC00', '74HC02', '74HC04', '74HC08', '74HC32', '74HC86', '74HC74', '74HC161', '74HC283', '74HC595', 'NE555']);
    expect(new Set(CHIPS.map((c) => c.id)).size).toBe(CHIPS.length);
  });
  test('package sizes', () => {
    for (const c of CHIPS) expect([8, 14, 16]).toContain(c.pins.length);
    expect(chipById('ne555').pins.length).toBe(8);
    expect(chipById('74hc74').pins.length).toBe(14);
    expect(chipById('74hc595').pins.length).toBe(16);
  });
  test('power on the corner pins: VCC at the last pin, GND opposite it', () => {
    for (const c of CHIPS) {
      const n = c.pins.length;
      expect(c.pins[n - 1]!.name, c.id).toBe('VCC');
      if (c.id !== 'ne555') expect(c.pins[n / 2 - 1]!.name, c.id).toBe('GND');
      else expect(c.pins[0]!.name).toBe('GND');
      expect(c.pins.filter((p) => p.role === 'power').length).toBe(1);
      expect(c.pins.filter((p) => p.role === 'ground').length).toBe(1);
    }
  });
  test('pin names are unique within a chip, apart from the 74’s Q and the inverse of Q', () => {
    for (const c of CHIPS) {
      const seen = new Set<string>();
      for (const p of c.pins) {
        const k = pinLabel(p);
        expect(seen.has(k), `${c.id} ${k}`).toBe(false);
        seen.add(k);
      }
    }
  });
});

describe('the 7400 layout', () => {
  const layout = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'];
  test.each(['74hc00', '74hc08', '74hc32', '74hc86'])('%s', (id) => expect(names(id)).toEqual(layout));
  test('the NOR gate does not follow it', () => {
    expect(names('74hc02')).toEqual(['1Y', '1A', '1B', '2Y', '2A', '2B', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC']);
  });
  test('hex inverter alternates input and output', () => {
    expect(names('74hc04')).toEqual(['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC']);
  });
});

describe('sequential and MSI parts', () => {
  test('74HC74', () => {
    expect(names('74hc74')).toEqual(['1CLR', '1D', '1CLK', '1PRE', '1Q', '1Q', 'GND', '2Q', '2Q', '2PRE', '2CLK', '2D', '2CLR', 'VCC']);
    const p = chipById('74hc74').pins;
    expect(p[5]!.low).toBe(true); // pin 6 is Q̄
    expect(p[4]!.low).toBeFalsy(); // pin 5 is Q
    expect(p[0]!.low && p[3]!.low && p[9]!.low && p[12]!.low).toBe(true);
  });
  test('74HC161', () => {
    expect(names('74hc161')).toEqual(['CLR', 'CLK', 'A', 'B', 'C', 'D', 'ENP', 'GND', 'LOAD', 'ENT', 'QD', 'QC', 'QB', 'QA', 'RCO', 'VCC']);
  });
  test('74HC283', () => {
    expect(names('74hc283')).toEqual(['Σ2', 'B2', 'A2', 'Σ1', 'A1', 'B1', 'C0', 'GND', 'C4', 'Σ4', 'B4', 'A4', 'Σ3', 'A3', 'B3', 'VCC']);
    // every bit has an A, a B and a sum
    for (const k of [1, 2, 3, 4]) for (const p of ['A', 'B', 'Σ']) expect(names('74hc283')).toContain(`${p}${k}`);
  });
  test('74HC595', () => {
    expect(names('74hc595')).toEqual(['QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH', 'GND', 'QH′', 'SRCLR', 'SRCLK', 'RCLK', 'OE', 'SER', 'QA', 'VCC']);
  });
  test('NE555', () => {
    expect(names('ne555')).toEqual(['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THRES', 'DISCH', 'VCC']);
  });
});

describe('sides of a DIP', () => {
  test('a 14-pin chip: 1–7 down the left, 14 at the top right, 8 at the bottom right', () => {
    const s = sides(chipById('74hc00'));
    expect(s.left.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.right.map((x) => x.n)).toEqual([14, 13, 12, 11, 10, 9, 8]);
    expect(s.right[0]!.pin.name).toBe('VCC');
    expect(s.left[6]!.pin.name).toBe('GND');
    expect(s.right[6]!.pin.name).toBe('3Y');
  });
  test('an 8-pin chip', () => {
    const s = sides(chipById('ne555'));
    expect(s.left.map((x) => x.pin.name)).toEqual(['GND', 'TRIG', 'OUT', 'RESET']);
    expect(s.right.map((x) => x.pin.name)).toEqual(['VCC', 'DISCH', 'THRES', 'CTRL']);
  });
});
