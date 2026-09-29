import type { ComponentDef, ParamDef, Params, PinDef } from '../types';
import { defineComponents } from './registry';

/**
 * Medium-scale building blocks for the digital engine: multiplexers, decoders, adders, registers,
 * counters, memories. Buses are separate pins, one per bit, named D0, D1, … with the least
 * significant bit first, every 2 grid units. Inputs are on x = 0 and outputs on the right edge, both
 * from y = 0 down, in the order listed in each description. Pin counts follow the parameters.
 * Behaviour lives in `sim/digital/models/blocks.ts`.
 *
 * Unconnected control inputs read as inactive (EN as 1; CLR, LOAD and WE as 0); unconnected data
 * inputs read as X.
 */

/** Clamp a numeric parameter to an integer range. */
export const intParam = (p: Params, key: string, lo: number, hi: number, dflt: number): number => {
  const v = Math.round(Number(p[key] ?? dflt));
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
};

const bus = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

function layout(inputs: string[], outputs: string[], width: number): PinDef[] {
  return [
    ...inputs.map((name, i) => ({ name, x: 0, y: 2 * i, dir: 'in' as const })),
    ...outputs.map((name, i) => ({ name, x: width, y: 2 * i, dir: 'out' as const })),
  ];
}

const delayParam: ParamDef = { key: 'delay', label: 'Delay', kind: 'number', default: 1, unit: 'ns', min: 0, max: 1000, step: 0.1 };
const bitsParam = (max: number, dflt = 4, key = 'bits', label = 'Bits', min = 1): ParamDef => ({ key, label, kind: 'number', default: dflt, min, max, step: 1 });

/** A block whose pins depend on its parameters. */
function block(
  type: string,
  name: string,
  description: string,
  params: ParamDef[],
  pins: (p: Params) => { inputs: string[]; outputs: string[] },
  width = 6,
): ComponentDef {
  return {
    type,
    name,
    category: 'block',
    description,
    params,
    pins: (p) => {
      const { inputs, outputs } = pins(p);
      return layout(inputs, outputs, width);
    },
    bounds: (p) => {
      const { inputs, outputs } = pins(p);
      return { x0: 0, y0: -1, x1: width, y1: 2 * Math.max(1, inputs.length, outputs.length) - 1 };
    },
    engines: ['digital'],
  };
}

/** Pin counts of each block, shared with the models so both agree. */
export const blockSizes = {
  select: (p: Params) => intParam(p, 'select', 1, 3, 1),
  decoderBits: (p: Params) => intParam(p, 'bits', 1, 4, 2),
  encoderBits: (p: Params) => intParam(p, 'bits', 1, 3, 2),
  bits: (p: Params) => intParam(p, 'bits', 1, 16, 4),
  lfsrBits: (p: Params) => intParam(p, 'bits', 2, 16, 4),
  addrBits: (p: Params) => intParam(p, 'addrBits', 1, 16, 4),
  dataBits: (p: Params) => intParam(p, 'dataBits', 1, 32, 8),
};
const S = blockSizes;

defineComponents([
  block(
    'mux',
    'Multiplexer',
    'Connects one of the data inputs D0… to the output Y: the one whose number is on the select inputs S0…. Pins: D0…, S0… → Y.',
    [bitsParam(3, 1, 'select', 'Select bits'), delayParam],
    (p) => ({ inputs: [...bus('D', 1 << S.select(p)), ...bus('S', S.select(p))], outputs: ['Y'] }),
  ),
  block(
    'demux',
    'Demultiplexer',
    'Sends the input D to the output Y0… whose number is on S0…; the other outputs are 0. Pins: D, S0… → Y0….',
    [bitsParam(3, 1, 'select', 'Select bits'), delayParam],
    (p) => ({ inputs: ['D', ...bus('S', S.select(p))], outputs: bus('Y', 1 << S.select(p)) }),
  ),
  block(
    'decoder',
    'Decoder',
    'Sets the one output Y0… whose number is on A0… to 1, while EN is 1. Pins: A0…, EN → Y0….',
    [bitsParam(4, 2), delayParam],
    (p) => ({ inputs: [...bus('A', S.decoderBits(p)), 'EN'], outputs: bus('Y', 1 << S.decoderBits(p)) }),
  ),
  block(
    'encoder',
    'Encoder',
    'Outputs the number of the input D0… that is 1 (if several are, their numbers are ORed together); V is 1 when any input is 1. Pins: D0… → A0…, V.',
    [bitsParam(3, 2), delayParam],
    (p) => ({ inputs: bus('D', 1 << S.encoderBits(p)), outputs: [...bus('A', S.encoderBits(p)), 'V'] }),
  ),
  block(
    'priority-encoder',
    'Priority encoder',
    'Outputs the number of the highest-numbered input D0… that is 1; V is 1 when any input is 1. Pins: D0… → A0…, V.',
    [bitsParam(3, 2), delayParam],
    (p) => ({ inputs: bus('D', 1 << S.encoderBits(p)), outputs: [...bus('A', S.encoderBits(p)), 'V'] }),
  ),
  block(
    'adder',
    'Adder',
    'Adds two binary numbers and a carry in: S = A + B + CIN, with the carry out in COUT. Pins: A0…, B0…, CIN → S0…, COUT.',
    [bitsParam(16), delayParam],
    (p) => ({ inputs: [...bus('A', S.bits(p)), ...bus('B', S.bits(p)), 'CIN'], outputs: [...bus('S', S.bits(p)), 'COUT'] }),
  ),
  block(
    'magnitude-comparator',
    'Magnitude comparator',
    'Compares two unsigned binary numbers: EQ when A = B, LT when A < B, GT when A > B. Pins: A0…, B0… → EQ, LT, GT.',
    [bitsParam(16), delayParam],
    (p) => ({ inputs: [...bus('A', S.bits(p)), ...bus('B', S.bits(p))], outputs: ['EQ', 'LT', 'GT'] }),
  ),
  block(
    'register',
    'Register',
    'Loads D0… into Q0… on each rising edge of CLK while EN is 1. CLR clears it to 0 at once. Pins: D0…, CLK, EN, CLR → Q0….',
    [bitsParam(16), delayParam, { key: 'init', label: 'Power-up value', kind: 'number', default: 0, min: 0, max: 65535, step: 1 }],
    (p) => ({ inputs: [...bus('D', S.bits(p)), 'CLK', 'EN', 'CLR'], outputs: bus('Q', S.bits(p)) }),
  ),
  block(
    'counter',
    'Counter',
    'Counts up by one on each rising edge of CLK while EN is 1, wrapping to 0; LOAD loads D0… instead; CLR clears it at once. CO is 1 on the last count (all ones) while EN is 1. Pins: CLK, EN, CLR, LOAD, D0… → Q0…, CO.',
    [bitsParam(16), delayParam, { key: 'init', label: 'Power-up value', kind: 'number', default: 0, min: 0, max: 65535, step: 1 }],
    (p) => ({ inputs: ['CLK', 'EN', 'CLR', 'LOAD', ...bus('D', S.bits(p))], outputs: [...bus('Q', S.bits(p)), 'CO'] }),
  ),
  block(
    'shift-register',
    'Shift register',
    'On each rising edge of CLK while EN is 1, shifts SI into Q0 and every bit up by one; SO is the last bit (the one that falls out next). CLR clears it at once. Pins: CLK, SI, EN, CLR → Q0…, SO.',
    [bitsParam(16), delayParam, { key: 'init', label: 'Power-up value', kind: 'number', default: 0, min: 0, max: 65535, step: 1 }],
    (p) => ({ inputs: ['CLK', 'SI', 'EN', 'CLR'], outputs: [...bus('Q', S.bits(p)), 'SO'] }),
  ),
  block(
    'lfsr',
    'LFSR',
    'Linear-feedback shift register: on each rising edge, shifts left and feeds the XOR of the tapped bits into Q0. With the right taps it steps through every non-zero value. Pins: CLK → Q0….',
    [
      bitsParam(16, 4, 'bits', 'Bits', 2),
      { key: 'taps', label: 'Taps (bit mask)', kind: 'number', default: 12, min: 1, max: 65535, step: 1 },
      { key: 'init', label: 'Start value', kind: 'number', default: 1, min: 0, max: 65535, step: 1 },
      delayParam,
    ],
    (p) => ({ inputs: ['CLK'], outputs: bus('Q', S.lfsrBits(p)) }),
  ),
  block(
    'ram',
    'RAM',
    'Memory you can write: on a rising edge of CLK with WE at 1, stores DI0… at address A0…; DO0… always shows the word at A0… (asynchronous read). Pins: A0…, DI0…, WE, CLK → DO0….',
    [bitsParam(16, 4, 'addrBits', 'Address bits'), bitsParam(32, 8, 'dataBits', 'Data bits'), delayParam],
    (p) => ({ inputs: [...bus('A', S.addrBits(p)), ...bus('DI', S.dataBits(p)), 'WE', 'CLK'], outputs: bus('DO', S.dataBits(p)) }),
    8,
  ),
  block(
    'rom',
    'ROM',
    'Read-only memory: DO0… shows the word at address A0…. Contents are hexadecimal words separated by commas, from address 0. Pins: A0… → DO0….',
    [
      bitsParam(16, 4, 'addrBits', 'Address bits'),
      bitsParam(32, 8, 'dataBits', 'Data bits'),
      { key: 'contents', label: 'Contents (hex)', kind: 'string', default: '' },
      delayParam,
    ],
    (p) => ({ inputs: bus('A', S.addrBits(p)), outputs: bus('DO', S.dataBits(p)) }),
    8,
  ),
]);
