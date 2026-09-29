import type { ComponentDef, Params, PinDef } from '../types';
import { defineComponents } from './registry';

const n = (p: Params) => Math.max(1, Math.min(8, Number(p.inputs ?? 2)));

/** Gate geometry: inputs every 2 units on x = 0, output on x = 6 at mid-height. */
function gatePins(p: Params): PinDef[] {
  const k = n(p);
  const pins: PinDef[] = [];
  for (let i = 0; i < k; i++) pins.push({ name: String.fromCharCode(65 + i), x: 0, y: 2 * i, dir: 'in' });
  pins.push({ name: 'Y', x: 6, y: k - 1, dir: 'out' });
  return pins;
}
const gateBounds = (p: Params) => ({ x0: 0, y0: -1, x1: 6, y1: 2 * n(p) - 1 });
const inputsParam = { key: 'inputs', label: 'Inputs', kind: 'number' as const, default: 2, min: 2, max: 8, step: 1 };
const delayParam = { key: 'delay', label: 'Delay', kind: 'number' as const, default: 1, unit: 'ns', min: 0, max: 1000, step: 0.1 };

const gate = (type: string, name: string, description: string): ComponentDef => ({
  type,
  name,
  category: 'gate',
  description,
  pins: gatePins,
  bounds: gateBounds,
  params: [inputsParam, delayParam],
  engines: ['digital', 'analog'],
});

defineComponents([
  {
    type: 'not',
    name: 'NOT gate (inverter)',
    category: 'gate',
    description: 'Outputs 1 when its input is 0, and 0 when it is 1.',
    pins: [
      { name: 'A', x: 0, y: 0, dir: 'in' },
      { name: 'Y', x: 5, y: 0, dir: 'out' },
    ],
    bounds: { x0: 0, y0: -1, x1: 5, y1: 1 },
    params: [delayParam],
    engines: ['digital', 'analog'],
  },
  {
    type: 'buffer',
    name: 'Buffer',
    category: 'gate',
    description: 'Copies its input to its output, restoring a clean logic level.',
    pins: [
      { name: 'A', x: 0, y: 0, dir: 'in' },
      { name: 'Y', x: 5, y: 0, dir: 'out' },
    ],
    bounds: { x0: 0, y0: -1, x1: 5, y1: 1 },
    params: [delayParam],
    engines: ['digital', 'analog'],
  },
  {
    type: 'tristate',
    name: 'Tri-state buffer',
    category: 'gate',
    description: 'Copies A to Y while EN is 1; otherwise lets go of the wire (high impedance, Z).',
    pins: [
      { name: 'A', x: 0, y: 0, dir: 'in' },
      { name: 'EN', x: 2, y: -2, dir: 'in' },
      { name: 'Y', x: 5, y: 0, dir: 'out' },
    ],
    bounds: { x0: 0, y0: -2, x1: 5, y1: 1 },
    params: [delayParam],
    engines: ['digital'],
  },
  gate('and', 'AND gate', 'Outputs 1 only when every input is 1.'),
  gate('or', 'OR gate', 'Outputs 1 when at least one input is 1.'),
  gate('nand', 'NAND gate', 'NOT-AND: outputs 0 only when every input is 1.'),
  gate('nor', 'NOR gate', 'NOT-OR: outputs 1 only when every input is 0.'),
  gate('xor', 'XOR gate', 'Outputs 1 when an odd number of inputs are 1.'),
  gate('xnor', 'XNOR gate', 'Outputs 1 when an even number of inputs are 1.'),
]);
