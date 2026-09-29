import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import type { Circuit } from '$lib/sim/netlist/types';
import { E_CHARGE } from './widgets/wire';

/**
 * Every live circuit of Chapter 1 must do what the text says: the ammeter reads the lamp's 50 mA, the
 * voltmeter its 6 V, five 1 V cells in series make 5 V, and 1 kΩ turns each volt into a milliampere.
 */

const dir = fileURLToPath(new URL('./circuits/', import.meta.url));
const load = (name: string): Circuit => JSON.parse(readFileSync(dir + name + '.json', 'utf8')) as Circuit;
const engine = (name: string): AnalogEngine => createAnalogEngine(flatten(load(name)));
const volts = (e: AnalogEngine, id: string) => Number(e.state(id).value ?? e.state(id).reading);

describe('the circuits load and run without messages', () => {
  for (const name of ['simple', 'volta', 'ohm-lab']) {
    test(name, () => {
      const e = engine(name);
      e.advance(0.5);
      expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
    });
  }
});

describe('battery, switch, lamp', () => {
  test('open: nothing flows and the lamp is dark; the voltmeter reads 0 V', () => {
    const e = engine('simple');
    e.setParam('S1', 'closed', false);
    e.advance(0.5);
    expect(Math.abs(e.current('A1', 0))).toBeLessThan(1e-9);
    expect(e.state('L1').brightness).toBeLessThan(0.01);
    expect(Math.abs(volts(e, 'V1'))).toBeLessThan(1e-3);
  });
  test('closed (as the figure starts): 6 V across the lamp, 50 mA through it (0.3 W at 6 V), and it glows', () => {
    const e = engine('simple');
    e.advance(1);
    expect(e.current('A1', 0)).toBeGreaterThan(0.048);
    expect(e.current('A1', 0)).toBeLessThan(0.0502);
    const vLamp = e.voltage(e.netlist.elements.find((x) => x.id === 'V1')!.pins[1]!);
    expect(vLamp).toBeGreaterThan(5.9);
    expect(vLamp).toBeLessThan(6);
    expect(e.state('L1').brightness).toBeGreaterThan(0.85);
  });
  test('the same current leaves the battery as passes the lamp (charge is not used up)', () => {
    const e = engine('simple');
    e.setParam('S1', 'closed', true);
    e.advance(1);
    const battery = e.current('B1', 1); // into +: negative when it delivers
    const lamp = e.current('L1', 0);
    expect(-battery).toBeCloseTo(lamp, 4);
    // 50 mA is 3.1×10¹⁷ electrons per second.
    expect(lamp / E_CHARGE / 1e17).toBeCloseTo(3.1, 1);
  });
});

describe("Volta's pile: voltages add", () => {
  const pileVolts = (closedBypasses: string[]) => {
    const e = engine('volta');
    for (const id of closedBypasses) e.setParam(id, 'closed', true);
    e.advance(1);
    return { e, v: volts(e, 'V1') };
  };
  test('five 1 V cells in series give nearly 5 V and light the lamp', () => {
    const { e, v } = pileVolts([]);
    expect(v).toBeGreaterThan(4.8);
    expect(v).toBeLessThan(5);
    expect(e.state('L1').brightness).toBeGreaterThan(0.85);
  });
  test('bypassing a cell takes one volt off, and the lamp dims', () => {
    let previous = pileVolts([]);
    const bypassed: string[] = [];
    for (const id of ['S1', 'S2', 'S3']) {
      bypassed.push(id);
      const now = pileVolts(bypassed);
      expect(previous.v - now.v).toBeGreaterThan(0.85);
      expect(previous.v - now.v).toBeLessThan(1.05);
      expect(now.e.state('L1').brightness as number).toBeLessThan(previous.e.state('L1').brightness as number);
      previous = now;
    }
    // Two cells left. (A "bypassed" cell is not quite gone: its 1 V still leaks about 0.02 V through the switch's 10 mΩ.)
    expect(previous.v).toBeGreaterThan(1.8);
    expect(previous.v).toBeLessThan(2.05);
    expect(previous.e.state('L1').brightness as number).toBeLessThan(0.1);
  });
  test('which cell is bypassed does not matter', () => {
    const a = pileVolts(['S1']).v;
    const b = pileVolts(['S5']).v;
    expect(a).toBeCloseTo(b, 2);
  });
});

describe('the lab: 1 kΩ turns each volt into a milliampere', () => {
  test('the current follows the voltage', () => {
    for (const v of [1.5, 3, 6, 9, 12]) {
      const e = engine('ohm-lab');
      e.setParam('B1', 'voltage', v);
      e.settle();
      const i = e.current('A1', 0);
      expect(i * 1000).toBeGreaterThan(v * 0.99);
      expect(i * 1000).toBeLessThan(v * 1.001);
      expect(v / i).toBeGreaterThan(1000);
      expect(v / i).toBeLessThan(1010);
    }
  });
  test('no part burns at 12 V', () => {
    const e = engine('ohm-lab');
    e.setParam('B1', 'voltage', 12);
    e.advance(3);
    expect(e.messages.filter((m) => m.level !== 'info')).toEqual([]);
  });
});
