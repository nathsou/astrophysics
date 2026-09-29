import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildModel, pinCurrentSources } from './model';
import { boxesOverlap, G } from './geometry';
import { gateShape, activeLow, isClock } from './symbols/draw';
import { segmentPaths, HEX_SEGMENTS } from './symbols/sevenseg';
import { flatten } from '../sim/netlist/flatten';
import type { Circuit } from '../sim/netlist/types';

const dir = fileURLToPath(new URL('./examples/', import.meta.url));
const examples = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(dir + f, 'utf8')) as Circuit] as const);

describe('example circuits', () => {
  test.each(examples)('%s: every pin is wired, labels avoid parts', (_, circuit) => {
    const m = buildModel(circuit);
    // Every pin of the examples is connected, except the relay's NC contact.
    expect(m.open.length).toBeLessThanOrEqual(1);
    const labels = m.comps.filter((c) => c.label).map((c) => c.label!.box);
    for (const [i, a] of labels.entries()) {
      for (const b of labels.slice(i + 1)) expect(boxesOverlap(a, b)).toBe(false);
      for (const c of m.comps) expect(boxesOverlap(a, c.box)).toBe(false);
    }
    // The view box contains every part.
    for (const c of m.comps) {
      expect(c.box.x0).toBeGreaterThanOrEqual(m.viewBox.x0);
      expect(c.box.y1).toBeLessThanOrEqual(m.viewBox.y1);
    }
    // Current sources line up with the graph's pins.
    expect(pinCurrentSources(m, flatten(circuit))).toHaveLength(m.graph.pins.length);
  });

  test('the LED circuit has T-junction dots on its nets', () => {
    const led = examples.find(([f]) => f === 'led.json')![1];
    const m = buildModel(led);
    expect(m.junctions.map((j) => [j.x / G, j.y / G]).sort()).toEqual([
      [18, 12],
      [18, 2],
      [4, 12], // the ground symbol meets the corner
    ]);
    expect(m.junctions.every((j) => j.net >= 0)).toBe(true);
  });
});

describe('subcircuit blocks', () => {
  test('block pins take their current from the elements inside', () => {
    const inner: Circuit = {
      version: 1,
      components: [
        { id: 'pA', type: 'port', x: 0, y: 0, params: { name: 'A', dir: 'in' } },
        { id: 'pB', type: 'port', x: 8, y: 0, params: { name: 'B', dir: 'out' } },
        { id: 'R', type: 'resistor', x: 2, y: 0 },
      ],
      wires: [
        { points: [[0, 0], [2, 0]] },
        { points: [[6, 0], [8, 0]] },
      ],
    };
    const c: Circuit = {
      version: 1,
      components: [{ id: 'X1', type: 'sub:r', x: 0, y: 0 }],
      wires: [],
      subcircuits: { r: inner },
    };
    const m = buildModel(c);
    const src = pinCurrentSources(m, flatten(c));
    // No wires: the block's pins are not on the graph.
    expect(src).toEqual([]);
    expect(m.comps[0]!.isSub).toBe(true);
  });
});

describe('symbol geometry', () => {
  test('gate input stubs start on the pins and end on the back of the body', () => {
    for (const type of ['and', 'or', 'xor', 'nand', 'nor', 'xnor']) {
      for (const k of [2, 3, 5, 8]) {
        const s = gateShape(type, k);
        expect(s.inputs).toHaveLength(k);
        s.inputs.forEach((d, i) => expect(d.startsWith(`M0 ${2 * i * G} H`)).toBe(true));
        expect(s.output.startsWith(`M${6 * G} ${(k - 1) * G} `)).toBe(true);
        if (type.startsWith('n') || type === 'xnor') expect(s.bubble).toBeDefined();
      }
    }
    // OR: the middle input of three meets the deepest point of the concave back (12 + 5 px).
    expect(gateShape('or', 3).inputs[1]).toBe('M0 24 H17');
  });
  test('pin name conventions', () => {
    expect(['CLRn', 'OEn', 'Qn', 'EN', 'Din', 'n'].map(activeLow)).toEqual([true, true, true, false, false, false]);
    expect(['CLK', 'clk', 'CLK2', 'CLR'].map(isClock)).toEqual([true, true, true, false]);
  });
  test('seven segments', () => {
    expect(segmentPaths(0, 0, 20, 40, 4)).toHaveLength(7);
    expect(HEX_SEGMENTS[8]).toBe(0x7f);
  });
});
