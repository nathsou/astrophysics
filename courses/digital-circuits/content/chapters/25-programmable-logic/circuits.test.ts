import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';

/** Every live circuit of Chapter 25 must show what the text says it shows. */
const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const engine = (name: string): AnalogEngine => createAnalogEngine(flatten(load(name)));
function run(e: AnalogEngine, seconds: number, frame = 0.01): void {
  const end = e.time + seconds;
  while (e.time < end - 1e-12) e.advance(Math.min(frame, end - e.time));
}

/** The four words of the diode ROM: the squares of 0 to 3 (bit 3 first). */
const WORDS = [0b0000, 0b0001, 0b0100, 0b1001];

/** Close the given word switches and read the four bit lines (volts and lit). */
function read(closed: number[]): { volts: number[]; lit: boolean[]; e: AnalogEngine } {
  const e = engine('diode-rom');
  closed.forEach((w) => e.setParam(`W${w}`, 'on', true));
  run(e, 0.1);
  const flat = flatten(load('diode-rom'));
  const netOf = (id: string, pin: number) => flat.elements.find((x) => x.id === id)!.pins[pin]!;
  const bits = [3, 2, 1, 0];
  return { volts: bits.map((b) => e.voltage(netOf(`R${b}`, 0))), lit: bits.map((b) => !!e.state(`B${b}`).lit), e };
}

describe('the diode ROM (Figure 25.1)', () => {
  test('it has one diode for each 1 in the table, and nothing for the 0s', () => {
    const diodes = load('diode-rom').components.filter((c) => c.type === 'diode').length;
    expect(diodes).toBe(WORDS.reduce((n, w) => n + w.toString(2).split('1').length - 1, 0));
    expect(diodes).toBe(4);
  });

  test('closing one word switch puts that word on the bit lines: the squares of 0 to 3', () => {
    WORDS.forEach((word, w) => {
      const { lit } = read([w]);
      const got = lit.reduce((v, b) => v * 2 + (b ? 1 : 0), 0);
      expect(got, `word ${w}`).toBe(word);
    });
  });

  test('a 1 is a diode drop below the 5 V word line, and a 0 is 0 V', () => {
    const { volts } = read([3]);
    // Word 3 = 1001: bit 3 and bit 0.
    expect(volts[0]!).toBeGreaterThan(4.2);
    expect(volts[0]!).toBeLessThan(4.6);
    expect(volts[3]!).toBeGreaterThan(4.2);
    expect(volts[1]!).toBeLessThan(0.01);
    expect(volts[2]!).toBeLessThan(0.01);
  });

  test('two words at once are ORed together (the diodes are an OR gate per bit line)', () => {
    const { lit } = read([1, 2]);
    expect(lit).toEqual([false, true, false, true]); // 0001 | 0100 = 0101
    const three = read([2, 3]).lit;
    expect(three).toEqual([true, true, false, true]); // 0100 | 1001 = 1101
  });

  test('with no word selected every bit line is 0', () => {
    expect(read([]).lit).toEqual([false, false, false, false]);
  });

  test('runs without messages', () => {
    const { e } = read([0]);
    for (const w of [0, 1, 2, 3]) {
      e.setParam(`W${w}`, 'on', true);
      run(e, 0.05);
      e.setParam(`W${w}`, 'on', false);
      run(e, 0.05);
    }
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});
