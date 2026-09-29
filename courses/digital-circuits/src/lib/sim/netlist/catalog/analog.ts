import type { ComponentDef, ParamDef, PinDef } from '../types';
import { defineComponents } from './registry';

/**
 * Analog components: geometry and parameters. Two-terminal parts lie horizontally with pins at
 * (0, 0) and (4, 0); rotate them to stand upright. Models live in `sim/analog/models`.
 */

const two = (a: string, b: string): PinDef[] => [
  { name: a, x: 0, y: 0 },
  { name: b, x: 4, y: 0 },
];
const twoBounds = { x0: 0, y0: -1, x1: 4, y1: 1 };
const rating = (key: string, label: string, value: number, unit: string): ParamDef => ({ key, label, kind: 'number', default: value, unit, min: 0, log: true });

const defs: ComponentDef[] = [
  // Sources
  {
    type: 'battery',
    name: 'Battery',
    category: 'source',
    description: 'A voltage source with a small internal resistance. The long plate is +.',
    pins: two('-', '+'),
    bounds: twoBounds,
    params: [
      { key: 'voltage', label: 'Voltage', kind: 'number', default: 9, unit: 'V', min: 0, max: 48, step: 0.1 },
      { key: 'resistance', label: 'Internal resistance', kind: 'number', default: 0.2, unit: 'Ω', min: 0.001, max: 100, log: true },
    ],
    engines: ['analog'],
  },
  {
    type: 'supply',
    name: 'Bench power supply',
    category: 'source',
    description: 'A voltage source that limits its current: above the limit it becomes a current source and the CC light comes on.',
    pins: two('-', '+'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 2 },
    params: [
      { key: 'voltage', label: 'Voltage', kind: 'number', default: 5, unit: 'V', min: 0, max: 30, step: 0.1 },
      { key: 'limit', label: 'Current limit', kind: 'number', default: 0.5, unit: 'A', min: 0.001, max: 5, log: true },
    ],
    engines: ['analog'],
  },
  {
    type: 'siggen',
    name: 'Function generator',
    category: 'source',
    description: 'A periodic voltage: square, sine, triangle or pulse, with an offset.',
    pins: two('-', '+'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 2 },
    params: [
      { key: 'waveform', label: 'Waveform', kind: 'enum', default: 'square', options: ['square', 'sine', 'triangle', 'pulse'] },
      { key: 'frequency', label: 'Frequency', kind: 'number', default: 1000, unit: 'Hz', min: 0.01, max: 1e8, log: true },
      { key: 'amplitude', label: 'Amplitude (peak)', kind: 'number', default: 2.5, unit: 'V', min: 0, max: 20, step: 0.01 },
      { key: 'offset', label: 'Offset', kind: 'number', default: 2.5, unit: 'V', min: -20, max: 20, step: 0.01 },
      { key: 'duty', label: 'Duty cycle', kind: 'number', default: 0.5, min: 0.01, max: 0.99, step: 0.01 },
      { key: 'rise', label: 'Rise/fall time', kind: 'number', default: 1e-9, unit: 's', min: 1e-12, max: 1, log: true },
    ],
    engines: ['analog'],
  },

  // Passive
  {
    type: 'resistor',
    name: 'Resistor',
    category: 'passive',
    description: 'Opposes current: V = I·R. Turns electrical energy into heat.',
    pins: two('1', '2'),
    bounds: twoBounds,
    params: [
      { key: 'resistance', label: 'Resistance', kind: 'number', default: 1000, unit: 'Ω', min: 0.1, max: 1e8, log: true },
      rating('power', 'Power rating', 0.25, 'W'),
    ],
    engines: ['analog', 'switch'],
  },
  {
    type: 'capacitor',
    name: 'Capacitor',
    category: 'passive',
    description: 'Stores charge: Q = C·V. Current flows only while its voltage changes.',
    pins: two('1', '2'),
    bounds: twoBounds,
    params: [
      { key: 'capacitance', label: 'Capacitance', kind: 'number', default: 1e-6, unit: 'F', min: 1e-15, max: 10, log: true },
      rating('voltageRating', 'Voltage rating', 50, 'V'),
      { key: 'polarised', label: 'Electrolytic (pin 1 is +)', kind: 'boolean', default: false },
      { key: 'initial', label: 'Initial voltage', kind: 'number', default: 0, unit: 'V', min: -50, max: 50, step: 0.01 },
    ],
    engines: ['analog'],
  },
  {
    type: 'inductor',
    name: 'Inductor (coil)',
    category: 'passive',
    description: 'Resists changes in current: V = L·dI/dt.',
    pins: two('1', '2'),
    bounds: twoBounds,
    params: [
      { key: 'inductance', label: 'Inductance', kind: 'number', default: 0.01, unit: 'H', min: 1e-9, max: 100, log: true },
      { key: 'resistance', label: 'Winding resistance', kind: 'number', default: 1, unit: 'Ω', min: 0.001, max: 1e4, log: true },
    ],
    engines: ['analog'],
  },
  {
    type: 'potentiometer',
    name: 'Potentiometer',
    category: 'passive',
    description: 'A resistor with a sliding contact (the wiper W): a variable voltage divider.',
    pins: [
      { name: 'A', x: 0, y: 0 },
      { name: 'B', x: 4, y: 0 },
      { name: 'W', x: 2, y: -2 },
    ],
    bounds: { x0: 0, y0: -2, x1: 4, y1: 1 },
    params: [
      { key: 'resistance', label: 'Resistance', kind: 'number', default: 10000, unit: 'Ω', min: 1, max: 1e7, log: true },
      { key: 'position', label: 'Position', kind: 'number', default: 0.5, min: 0, max: 1, step: 0.001 },
    ],
    engines: ['analog'],
  },
  {
    type: 'lamp',
    name: 'Incandescent lamp',
    category: 'passive',
    description: 'A hot filament: glows when current flows. Its resistance rises as it heats up.',
    pins: two('1', '2'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 2 },
    params: [
      { key: 'ratedVoltage', label: 'Rated voltage', kind: 'number', default: 6, unit: 'V', min: 0.5, max: 250, step: 0.1 },
      { key: 'ratedPower', label: 'Rated power', kind: 'number', default: 0.3, unit: 'W', min: 0.01, max: 100, log: true },
    ],
    engines: ['analog', 'switch'],
  },

  // Switches
  {
    type: 'switch',
    name: 'Switch (SPST)',
    category: 'switch',
    description: 'Closed: a wire. Open: a gap. Click it to flip.',
    pins: two('1', '2'),
    bounds: twoBounds,
    params: [{ key: 'closed', label: 'Closed', kind: 'boolean', default: false }],
    engines: ['analog', 'switch'],
  },
  {
    type: 'spdt',
    name: 'Changeover switch (SPDT)',
    category: 'switch',
    description: 'Connects the common contact C to either contact 0 or contact 1. Click it to flip.',
    pins: [
      { name: 'C', x: 0, y: 0 },
      { name: '0', x: 4, y: 0 },
      { name: '1', x: 4, y: -2 },
    ],
    bounds: { x0: 0, y0: -2, x1: 4, y1: 1 },
    params: [{ key: 'throw', label: 'Position', kind: 'number', default: 0, min: 0, max: 1, step: 1 }],
    engines: ['analog', 'switch'],
  },
  {
    type: 'pushbutton',
    name: 'Pushbutton',
    category: 'switch',
    description: 'Closed only while pressed. Real contacts bounce for a few milliseconds.',
    pins: two('1', '2'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 1 },
    params: [
      { key: 'pressed', label: 'Pressed', kind: 'boolean', default: false },
      { key: 'bounce', label: 'Contact bounce', kind: 'boolean', default: false },
    ],
    engines: ['analog', 'switch'],
  },

  // Electromechanical
  {
    type: 'relay',
    name: 'Relay',
    category: 'electromechanical',
    description: 'A coil (A–B) that, when energised, pulls the common contact COM from NC (normally closed) to NO (normally open).',
    pins: [
      { name: 'A', x: 0, y: 0 },
      { name: 'B', x: 0, y: 4 },
      { name: 'NO', x: 8, y: 0 },
      { name: 'COM', x: 8, y: 2 },
      { name: 'NC', x: 8, y: 4 },
    ],
    bounds: { x0: 0, y0: -1, x1: 8, y1: 5 },
    params: [
      { key: 'coilVoltage', label: 'Coil voltage', kind: 'number', default: 5, unit: 'V', min: 1, max: 48, step: 0.1 },
      { key: 'coilResistance', label: 'Coil resistance', kind: 'number', default: 70, unit: 'Ω', min: 1, max: 1e4, log: true },
      { key: 'coilInductance', label: 'Coil inductance', kind: 'number', default: 0.1, unit: 'H', min: 1e-4, max: 10, log: true },
      { key: 'operateTime', label: 'Operate time', kind: 'number', default: 0.005, unit: 's', min: 1e-5, max: 0.1, log: true },
    ],
    engines: ['analog', 'switch'],
  },

  // Semiconductors
  {
    type: 'diode',
    name: 'Diode',
    category: 'semiconductor',
    description: 'Lets current flow from anode (A) to cathode (K) once about 0.6 V is across it; blocks it the other way.',
    pins: two('A', 'K'),
    bounds: twoBounds,
    params: [
      { key: 'saturation', label: 'Saturation current Is', kind: 'number', default: 2.5e-9, unit: 'A', min: 1e-18, max: 1e-6, log: true },
      { key: 'emission', label: 'Emission coefficient n', kind: 'number', default: 1.75, min: 1, max: 3, step: 0.01 },
      { key: 'seriesResistance', label: 'Series resistance', kind: 'number', default: 0.6, unit: 'Ω', min: 0, max: 100, step: 0.01 },
      rating('maxCurrent', 'Maximum current', 0.3, 'A'),
    ],
    engines: ['analog'],
  },
  {
    type: 'led',
    name: 'LED',
    category: 'semiconductor',
    description: 'A diode that emits light. Its forward voltage depends on its colour (the bandgap). Needs a resistor.',
    pins: two('A', 'K'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 1 },
    params: [
      { key: 'color', label: 'Colour', kind: 'enum', default: 'red', options: ['infrared', 'red', 'amber', 'yellow', 'green', 'blue', 'white'] },
      rating('maxCurrent', 'Maximum current', 0.03, 'A'),
    ],
    engines: ['analog'],
  },
  {
    type: 'npn',
    name: 'NPN transistor',
    category: 'semiconductor',
    description: 'A small current into the base B lets a current about β times larger flow from collector C to emitter E.',
    pins: [
      { name: 'B', x: 0, y: 0 },
      { name: 'C', x: 3, y: -2 },
      { name: 'E', x: 3, y: 2 },
    ],
    bounds: { x0: 0, y0: -2, x1: 3, y1: 2 },
    params: [
      { key: 'beta', label: 'Current gain β', kind: 'number', default: 100, min: 5, max: 1000, log: true },
      { key: 'saturation', label: 'Saturation current Is', kind: 'number', default: 1e-14, unit: 'A', min: 1e-18, max: 1e-9, log: true },
      rating('maxCurrent', 'Maximum collector current', 0.2, 'A'),
    ],
    engines: ['analog'],
  },
  {
    type: 'pnp',
    name: 'PNP transistor',
    category: 'semiconductor',
    description: 'The mirror image of the NPN: current flows out of the base, and from emitter to collector.',
    pins: [
      { name: 'B', x: 0, y: 0 },
      { name: 'C', x: 3, y: 2 },
      { name: 'E', x: 3, y: -2 },
    ],
    bounds: { x0: 0, y0: -2, x1: 3, y1: 2 },
    params: [
      { key: 'beta', label: 'Current gain β', kind: 'number', default: 100, min: 5, max: 1000, log: true },
      { key: 'saturation', label: 'Saturation current Is', kind: 'number', default: 1e-14, unit: 'A', min: 1e-18, max: 1e-9, log: true },
      rating('maxCurrent', 'Maximum collector current', 0.2, 'A'),
    ],
    engines: ['analog'],
  },
  {
    type: 'nmos',
    name: 'n-channel MOSFET',
    category: 'semiconductor',
    description: 'Conducts from drain D to source S when the gate G is a threshold voltage above the source.',
    pins: [
      { name: 'G', x: 0, y: 0 },
      { name: 'D', x: 3, y: -2 },
      { name: 'S', x: 3, y: 2 },
    ],
    bounds: { x0: 0, y0: -2, x1: 3, y1: 2 },
    params: [
      { key: 'threshold', label: 'Threshold voltage', kind: 'number', default: 1, unit: 'V', min: 0.1, max: 5, step: 0.01 },
      { key: 'k', label: 'Transconductance k', kind: 'number', default: 0.02, unit: 'A/V²', min: 1e-6, max: 10, log: true },
      { key: 'lambda', label: 'Channel-length modulation λ', kind: 'number', default: 0.01, unit: '1/V', min: 0, max: 0.5, step: 0.001 },
    ],
    engines: ['analog', 'switch'],
  },
  {
    type: 'pmos',
    name: 'p-channel MOSFET',
    category: 'semiconductor',
    description: 'Conducts from source S to drain D when the gate G is a threshold voltage below the source.',
    pins: [
      { name: 'G', x: 0, y: 0 },
      { name: 'S', x: 3, y: -2 },
      { name: 'D', x: 3, y: 2 },
    ],
    bounds: { x0: 0, y0: -2, x1: 3, y1: 2 },
    params: [
      { key: 'threshold', label: 'Threshold voltage (magnitude)', kind: 'number', default: 1, unit: 'V', min: 0.1, max: 5, step: 0.01 },
      { key: 'k', label: 'Transconductance k', kind: 'number', default: 0.01, unit: 'A/V²', min: 1e-6, max: 10, log: true },
      { key: 'lambda', label: 'Channel-length modulation λ', kind: 'number', default: 0.01, unit: '1/V', min: 0, max: 0.5, step: 0.001 },
    ],
    engines: ['analog', 'switch'],
  },
  {
    type: 'comparator',
    name: 'Comparator',
    category: 'semiconductor',
    description: 'Output high when + is above −, low otherwise (behavioural, powered from its own 0–5 V rails).',
    pins: [
      { name: '+', x: 0, y: 0 },
      { name: '-', x: 0, y: 2 },
      { name: 'Y', x: 6, y: 1 },
    ],
    bounds: { x0: 0, y0: -1, x1: 6, y1: 3 },
    params: [{ key: 'high', label: 'Output high', kind: 'number', default: 5, unit: 'V', min: 0, max: 15, step: 0.1 }],
    engines: ['analog'],
  },

  // Meters
  {
    type: 'voltmeter',
    name: 'Voltmeter',
    category: 'meter',
    description: 'Shows the voltage of + relative to −. Draws almost no current (10 MΩ).',
    pins: two('-', '+'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 2 },
    engines: ['analog'],
  },
  {
    type: 'ammeter',
    name: 'Ammeter',
    category: 'meter',
    description: 'Shows the current flowing through it, from + to −. Put it in series; it is almost a wire (0.1 Ω).',
    pins: two('+', '-'),
    bounds: { x0: 0, y0: -2, x1: 4, y1: 2 },
    engines: ['analog'],
  },
];

defineComponents(defs);
