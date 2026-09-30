import type { Circuit } from '../sim/netlist/types';
import type { PartSpec } from './types';

/**
 * A circuit holding one block with the part's pins, for drawing its symbol (cards, the palette): the block
 * is a subcircuit made of ports, so it needs no reference implementation and works for planned parts too.
 */
export function symbolCircuit(part: Pick<PartSpec, 'id' | 'name' | 'pins'>): Circuit {
  const ins = part.pins.filter((p) => p.dir === 'in');
  const outs = part.pins.filter((p) => p.dir === 'out');
  return {
    version: 1,
    components: [{ id: part.id.toUpperCase().slice(0, 6), type: 'sub:part', x: 0, y: 0, label: '' }],
    wires: [],
    subcircuits: {
      part: {
        version: 1,
        title: part.name,
        components: [
          ...ins.map((p, i) => ({ id: `i${i}`, type: 'port', x: 0, y: 2 * i, params: { name: p.name, dir: 'in' } })),
          ...outs.map((p, i) => ({ id: `o${i}`, type: 'port', x: 10, y: 2 * i, params: { name: p.name, dir: 'out' } })),
        ],
        wires: [],
      },
    },
  };
}
