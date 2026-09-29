import '../netlist/catalog';
import { defineComponents, getDef } from '../netlist/catalog';

/**
 * The dashed outline drawn around an opened-up gate. It has no pins and no behaviour: it is a
 * drawing aid that lives only in the `drawn` circuit of an expansion (never in the simulated one).
 * Registered on first use so that pages that never open a gate do not list it.
 */
export function registerFrame(): void {
  if (getDef('frame')) return;
  defineComponents([
    {
      type: 'frame',
      name: 'Gate outline',
      category: 'wiring',
      description: 'A dashed box around the transistors of an opened-up gate.',
      pins: [],
      bounds: (p) => ({ x0: 0, y0: 0, x1: Number(p.w ?? 1), y1: Number(p.h ?? 1) }),
      params: [
        { key: 'w', label: 'Width', kind: 'number', default: 10 },
        { key: 'h', label: 'Height', kind: 'number', default: 10 },
        { key: 'title', label: 'Title', kind: 'string', default: '' },
      ],
      engines: ['digital', 'switch', 'analog'],
    },
  ]);
}
