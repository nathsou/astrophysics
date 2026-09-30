import { describe, expect, test } from 'vitest';
import { symbolCircuit } from './symbol';
import { PARTS } from './parts';
import { placedPins } from '../sim/netlist/connect';
import { subResolver } from '../sim/netlist/connect';

describe('symbols', () => {
  test('every part, planned or not, has a block with its pins in order', () => {
    for (const p of PARTS) {
      const c = symbolCircuit(p);
      const pins = placedPins(c.components[0]!, subResolver(c)).map((x) => x.pin);
      expect(pins, p.id).toEqual([...p.pins.filter((x) => x.dir === 'in'), ...p.pins.filter((x) => x.dir === 'out')].map((x) => x.name));
    }
  });
});
