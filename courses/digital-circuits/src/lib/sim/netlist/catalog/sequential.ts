import type { ComponentDef, ParamDef, PinDef } from '../types';
import { defineComponents } from './registry';

/**
 * Latches and flip-flops for the digital engine. Geometry follows the gates: inputs every 2 grid
 * units on x = 0, outputs on x = 6 (Q at the top, Q̄ at the bottom input row). Behaviour lives in
 * `sim/digital/models/sequential.ts`.
 *
 * Every storage element has an `init` parameter: the value Q takes at power-up and on reset
 * ('0', '1' or 'X' for "unknown", which the course uses to show an uninitialised register).
 */

function ffPins(inputs: string[]): PinDef[] {
  const pins: PinDef[] = inputs.map((name, i) => ({ name, x: 0, y: 2 * i, dir: 'in' as const }));
  pins.push({ name: 'Q', x: 6, y: 0, dir: 'out' });
  pins.push({ name: 'Qn', x: 6, y: 2 * Math.max(1, inputs.length - 1), dir: 'out' });
  return pins;
}
const ffBounds = (k: number) => ({ x0: 0, y0: -1, x1: 6, y1: 2 * Math.max(2, k) - 1 });

const ns = (key: string, label: string, value: number, max = 1000): ParamDef => ({ key, label, kind: 'number', default: value, unit: 'ns', min: 0, max, step: 0.1 });
const initParam: ParamDef = { key: 'init', label: 'Power-up value', kind: 'enum', default: '0', options: ['0', '1', 'X'] };
const tauParam: ParamDef = { key: 'tau', label: 'Metastability time constant τ', kind: 'number', default: 1, unit: 'ns', min: 0.01, max: 1000, log: true };
/** Parameters of every edge-triggered flip-flop. */
const edgeParams: ParamDef[] = [
  ns('clkToQ', 'Clock-to-Q delay', 1),
  ns('setup', 'Set-up time', 0.5, 100),
  ns('hold', 'Hold time', 0.2, 100),
  tauParam,
  initParam,
];

const ff = (type: string, name: string, inputs: string[], description: string, params: ParamDef[] = edgeParams): ComponentDef => ({
  type,
  name,
  category: 'sequential',
  description,
  pins: ffPins(inputs),
  bounds: ffBounds(inputs.length),
  params,
  engines: ['digital'],
});

defineComponents([
  ff('srlatch', 'SR latch', ['S', 'R'], 'S sets Q to 1, R resets it to 0; with both at 0 it remembers. S = R = 1 is forbidden: both outputs go to 0, and releasing both at once leaves the latch undecided (metastable).', [
    ns('delay', 'Delay', 1),
    tauParam,
    initParam,
  ]),
  ff('dlatch', 'D latch', ['D', 'EN'], 'While EN is 1, Q follows D (transparent); when EN falls, Q keeps the last value.', [ns('delay', 'Delay', 1), initParam]),
  ff('dff', 'D flip-flop', ['D', 'CLK'], 'Copies D to Q on each rising edge of CLK. D must be stable for the set-up time before the edge and the hold time after it.'),
  ff('dffr', 'D flip-flop with clear', ['D', 'CLK', 'CLR'], 'A D flip-flop whose CLR input forces Q to 0 at once, whatever the clock does.'),
  ff('dffe', 'D flip-flop with enable', ['D', 'EN', 'CLK'], 'A D flip-flop that only loads D on a rising edge while EN is 1; otherwise it keeps its value.'),
  ff('jkff', 'JK flip-flop', ['J', 'CLK', 'K'], 'On each rising edge: J sets, K resets, both toggle, neither holds.'),
  ff('tff', 'T flip-flop', ['T', 'CLK'], 'On each rising edge, Q toggles if T is 1.'),
]);
