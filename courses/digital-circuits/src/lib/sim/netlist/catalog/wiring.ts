import { defineComponents } from './registry';

/** Components that only make connections: ground, named labels, supply rails, subcircuit ports. */
defineComponents([
  {
    type: 'ground',
    name: 'Ground',
    category: 'wiring',
    description: 'The 0 V reference. Every ground symbol is the same net.',
    pins: [{ name: 'g', x: 0, y: 0 }],
    bounds: { x0: -1, y0: 0, x1: 1, y1: 2 },
    engines: ['analog', 'switch', 'digital'],
  },
  {
    type: 'label',
    name: 'Net label',
    category: 'wiring',
    description: 'Connects every label with the same name, without drawing a wire.',
    pins: [{ name: 'n', x: 0, y: 0 }],
    bounds: { x0: 0, y0: -1, x1: 4, y1: 1 },
    params: [{ key: 'name', label: 'Name', kind: 'string', default: 'A' }],
    engines: ['analog', 'switch', 'digital'],
  },
  {
    type: 'rail',
    name: 'Supply rail',
    category: 'wiring',
    description: 'A fixed supply voltage relative to ground (logic 1 in the digital engines when positive).',
    pins: [{ name: 'v', x: 0, y: 0 }],
    bounds: { x0: -1, y0: -2, x1: 1, y1: 0 },
    params: [{ key: 'voltage', label: 'Voltage', kind: 'number', default: 5, unit: 'V', min: -24, max: 24, step: 0.1 }],
    engines: ['analog', 'switch', 'digital'],
  },
  {
    type: 'port',
    name: 'Port',
    category: 'wiring',
    description: 'A pin of a subcircuit. Inputs appear on the left of the subcircuit block, outputs on the right, in order of height.',
    pins: [{ name: 'p', x: 0, y: 0 }],
    bounds: { x0: -3, y0: -1, x1: 0, y1: 1 },
    params: [
      { key: 'name', label: 'Name', kind: 'string', default: 'A' },
      { key: 'dir', label: 'Direction', kind: 'enum', default: 'in', options: ['in', 'out', 'io'] },
    ],
    engines: ['analog', 'switch', 'digital'],
  },
]);
