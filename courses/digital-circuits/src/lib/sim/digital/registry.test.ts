import { describe, expect, test } from 'vitest';
import { NetlistBuilder, createDigitalEngine, getDigitalModel, registerDigitalModel, type DigitalSim, type ModelInit } from './index';
import { allDefs, boundsOf, pinsOf, withDefaults } from '../netlist/catalog';
import type { FlatNetlist } from '../netlist/types';

describe('catalog and registry', () => {
  test('every catalog type that claims the digital engine has a digital model', () => {
    const missing = allDefs()
      .filter((d) => d.engines.includes('digital'))
      .filter((d) => !getDigitalModel(d.type))
      .map((d) => d.type);
    expect(missing).toEqual([]);
  });

  test('sequential and block pins: 2-unit pitch, inputs on x = 0, distinct positions, inside the bounds', () => {
    const variants: Record<string, Record<string, number>[]> = {
      mux: [{ select: 1 }, { select: 3 }],
      demux: [{ select: 2 }],
      decoder: [{ bits: 1 }, { bits: 4 }],
      adder: [{ bits: 1 }, { bits: 16 }],
      ram: [{ addrBits: 4, dataBits: 32 }],
    };
    for (const def of allDefs().filter((d) => d.category === 'sequential' || (d.category === 'block' && d.engines.includes('digital')))) {
      for (const params of variants[def.type] ?? [{}]) {
        const p = withDefaults(def, params);
        const pins = pinsOf(def, p);
        const box = boundsOf(def, p);
        const seen = new Set<string>();
        for (const pin of pins) {
          expect(pin.y % 2, `${def.type}.${pin.name}`).toBe(0);
          if (pin.dir === 'in') expect(pin.x).toBe(0);
          else expect(pin.x).toBe(box.x1);
          expect(pin.y).toBeGreaterThanOrEqual(box.y0);
          expect(pin.y).toBeLessThanOrEqual(box.y1);
          const key = `${pin.x},${pin.y}`;
          expect(seen.has(key), `${def.type} pins overlap at ${key}`).toBe(false);
          seen.add(key);
        }
        expect(new Set(pins.map((q) => q.name)).size).toBe(pins.length);
      }
    }
  });

  test('a model registered later is used by new engines', () => {
    // A made-up majority gate with its own pin directions, as the parts bin or DCL would add.
    registerDigitalModel(
      'test-majority',
      (init: ModelInit) => ({
        combinational: true,
        evaluate(sim: DigitalSim) {
          const [a, b, c] = [0, 1, 2].map((i) => sim.nets[init.nets[i]!]!);
          const ones = [a, b, c].filter((v) => v === 1).length;
          sim.drive(init.slots[3]!, ones >= 2 ? 1 : 0, 500);
        },
      }),
      { pinDirs: () => ['in', 'in', 'in', 'out'] },
    );
    const b = new NetlistBuilder();
    const ins = b.nets(3);
    ins.forEach((n, i) => b.add('const', `C${i}`, { Y: n }, { value: i === 1 ? 0 : 1 }));
    const y = b.net();
    const flat: FlatNetlist = b.build();
    flat.elements.push({ id: 'M', type: 'test-majority', params: {}, pins: [...ins, y], pinNames: ['A', 'B', 'C', 'Y'] });
    const e = createDigitalEngine(flat);
    e.advance(0.4e-9);
    expect(e.logic(y)).toBe(2);
    e.advance(0.1e-9);
    expect(e.logic(y)).toBe(1);
    expect(e.messages).toEqual([]);
  });

  test('elements without a digital model are reported and left out', () => {
    const b = new NetlistBuilder();
    b.add('capacitor', 'C1', [b.net(), b.net()]);
    const e = createDigitalEngine(b.build());
    expect(e.messages).toHaveLength(1);
    expect(e.messages[0]).toMatchObject({ level: 'warning', element: 'C1' });
  });
});
