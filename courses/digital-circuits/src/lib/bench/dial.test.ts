import { describe, expect, test } from 'vitest';
import '../sim/netlist/catalog';
import type { Circuit } from '../sim/netlist/types';
import { createAnalogEngine } from '../sim/analog';
import { createSwitchEngine } from '../sim/switch';
import { createDigitalEngine } from '../sim/digital';
import { topLevelNets } from '../sim/netlist/flatten';
import { DIAL_SPEED, autoTraces, availability, buildLevel, conduction, parseDial, parseLevel, remember, seed } from './dial';

const nand: Circuit = {
  version: 1,
  title: 'NAND',
  engine: 'digital',
  components: [
    { id: 'A', type: 'toggle', x: 0, y: 0 },
    { id: 'B', type: 'toggle', x: 0, y: 4 },
    { id: 'U1', type: 'nand', x: 10, y: 0 },
    { id: 'Y', type: 'indicator', x: 20, y: 1 },
  ],
  wires: [
    { points: [[3, 0], [10, 0]] },
    { points: [[3, 4], [7, 4], [7, 2], [10, 2]] },
    { points: [[16, 1], [20, 1]] },
  ],
};

describe('the dial prop', () => {
  test('true offers all three levels; a list picks; logic is always there', () => {
    expect(parseDial(true)).toEqual(['logic', 'switch', 'analog']);
    expect(parseDial('logic,switches')).toEqual(['logic', 'switch']);
    expect(parseDial('analog')).toEqual(['logic', 'analog']);
    expect(parseDial('Logic, Switch, Analog')).toEqual(['logic', 'switch', 'analog']);
    expect(parseDial('nonsense')).toEqual(['logic', 'switch', 'analog']);
    expect(parseDial(false)).toEqual([]);
    expect(parseDial(undefined)).toEqual([]);
  });
  test('level names', () => {
    expect(parseLevel('Switches')).toBe('switch');
    expect(parseLevel('digital')).toBe('logic');
    expect(parseLevel('analog')).toBe('analog');
    expect(parseLevel('x')).toBeUndefined();
  });
});

describe('availability', () => {
  test('a NAND can be opened at both levels; a circuit with a resistor at neither', () => {
    const a = availability(nand, parseDial(true));
    expect(a.logic.ok && a.switch.ok && a.analog.ok).toBe(true);
    expect(a.analog.transistors).toBe(4);
    const r = availability({ ...nand, components: [...nand.components, { id: 'R1', type: 'resistor', x: 30, y: 0 }] }, parseDial(true));
    expect(r.switch.ok).toBe(false);
    expect(r.analog.reason).toMatch(/R1/);
  });
  test('levels that are not offered are marked', () => {
    const a = availability(nand, parseDial('logic,switch'));
    expect(a.analog.offered).toBe(false);
    expect(a.switch.offered).toBe(true);
  });
});

describe('inputs travel between levels', () => {
  test('seeding sets the toggles and leaves the rest alone', () => {
    const c = seed(nand, remember(remember({}, 'A', 'on', true), 'B', 'on', true));
    expect(c.components.find((p) => p.id === 'A')!.params).toEqual({ on: true });
    expect(nand.components.find((p) => p.id === 'A')!.params).toBeUndefined();
    expect(seed(nand, {})).toBe(nand);
  });

  test('a NAND with both switches on is low at every level', () => {
    const inputs = remember(remember({}, 'A', 'on', true), 'B', 'on', true);
    const logic = buildLevel(nand, 'logic', inputs);
    const sw = buildLevel(nand, 'switch', inputs);
    const an = buildLevel(nand, 'analog', inputs);
    expect([logic.kind, sw.kind, an.kind]).toEqual(['digital', 'switch', 'analog']);
    const engines = [createDigitalEngine(logic.netlist()), createSwitchEngine(sw.netlist(), sw.options), createAnalogEngine(an.netlist(), an.options)];
    const nets = [logic, sw, an].map((a) => topLevelNets(a.drawn).pinNet.get('Y.A')!);
    engines.forEach((e) => {
      e.settle();
      e.advance(10e-9);
    });
    expect(engines.map((e, i) => e.logic(nets[i]!))).toEqual([0, 0, 0]);
    // Turn A off: all three go high (the switch engine after its stages, the analog engine after a few gate delays).
    engines.forEach((e, i) => {
      e.setParam('A', 'on', false);
      e.advance(20e-9);
      expect(e.logic(nets[i]!), engines[i]!.kind).toBe(1);
    });
  });

  test('the drawn circuit has the outlines, the plain one does not, and their nets agree', () => {
    const sw = buildLevel(nand, 'switch');
    expect(sw.drawn.components.some((c) => c.type === 'frame')).toBe(true);
    expect(sw.plain.components.some((c) => c.type === 'frame')).toBe(false);
    expect(sw.map.U1!.length).toBe(4);
    expect(sw.ids.length).toBe(sw.drawn.components.length);
    expect(sw.ids.filter((_, i) => sw.transistor[i]).sort()).toEqual([...sw.map.U1!].sort());
  });

  test('the analog level runs in nanoseconds and the switch level a stage at a time', () => {
    expect(DIAL_SPEED.analog).toBe(1e-9);
    expect(buildLevel(nand, 'switch').options).toMatchObject({ mode: 'unit-delay' });
  });
});

describe('what to plot', () => {
  test('the inputs first, then the outputs', () => {
    expect(autoTraces(nand)).toBe('A,B,Y');
  });
});

describe('conduction', () => {
  test('switch and analog states', () => {
    expect(conduction({ on: 1 })).toBe('on');
    expect(conduction({ on: 0 })).toBe('off');
    expect(conduction({ on: 2 })).toBe('x');
    expect(conduction({ region: 'off', id: 0 })).toBe('off');
    expect(conduction({ region: 'linear', id: 1e-3 })).toBe('on');
    expect(conduction({ region: 'saturation', id: 1e-3 })).toBe('sat');
  });
});
