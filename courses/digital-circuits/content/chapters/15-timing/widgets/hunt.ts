/**
 * The levels of the glitch hunt: which circuit, its fixed twin, what to trace, and how to describe what a flip did.
 */
import type { Circuit } from '$lib/sim/netlist/types';
import sopHazard from '../circuits/sop-hazard.json';
import sopFixed from '../circuits/sop-fixed.json';
import posHazard from '../circuits/pos-hazard.json';
import posFixed from '../circuits/pos-fixed.json';
import muxHazard from '../circuits/mux-hazard.json';
import muxFixed from '../circuits/mux-fixed.json';
import fourHazard from '../circuits/four-hazard.json';
import fourFixed from '../circuits/four-fixed.json';
import { bitsOf, pulses, type Hunt, type Transition } from './hazards';

export interface Level {
  id: string;
  name: string;
  /** The function, as the reader would write it. */
  expression: string;
  /** What the extra term is called in this level. */
  consensus: string;
  plain: Circuit;
  fixed: Circuit;
  inputs: string[];
  /** Name of the output signal in messages. */
  out: string;
  /** Waveforms to draw. */
  traces: string;
  intro: string;
}

const c = (x: unknown) => x as Circuit;

export const LEVELS: Level[] = [
  {
    id: 'sop',
    name: 'Sum of products',
    expression: 'F = A·B + A′·C',
    consensus: 'B·C',
    plain: c(sopHazard),
    fixed: c(sopFixed),
    inputs: ['A', 'B', 'C'],
    out: 'F',
    traces: 'A,A′,A·B,A′·C,F',
    intro: 'B and C are both 1, so F should be 1 whatever A does. Flip A.',
  },
  {
    id: 'pos',
    name: 'Product of sums',
    expression: 'F = (A + B)·(A′ + C)',
    consensus: 'B + C',
    plain: c(posHazard),
    fixed: c(posFixed),
    inputs: ['A', 'B', 'C'],
    out: 'F',
    traces: 'A,A′,A+B,A′+C,F',
    intro: 'The mirror image: a hazard in a product of sums hides where the function is 0. Set B and C to find it.',
  },
  {
    id: 'mux',
    name: 'Multiplexer',
    expression: 'Y = S′·A + S·B',
    consensus: 'A·B',
    plain: c(muxHazard),
    fixed: c(muxFixed),
    inputs: ['S', 'A', 'B'],
    out: 'Y',
    traces: 'S,S′,p,q,Y',
    intro: 'A two-way switch made of NAND gates (Chapter 13). S chooses A or B. When A and B agree, S should not matter.',
  },
  {
    id: 'four',
    name: 'Four inputs',
    expression: 'F = A·B + A′·C + B′·D',
    consensus: 'B·C and A·D',
    plain: c(fourHazard),
    fixed: c(fourFixed),
    inputs: ['A', 'B', 'C', 'D'],
    out: 'F',
    traces: 'A,B,A·B,A′·C,B′·D,F',
    intro: 'Sixty-four transitions and more than one hazard. Which pairs of terms hand over to each other?',
  },
];

export const hunt = (level: Level): Hunt => ({ inputs: level.inputs, output: 'lamp' });

/** The input state a circuit file starts in, as a number (inputs[0] is the top bit). */
export function initialState(circuit: Circuit, inputs: string[]): number {
  let s = 0;
  for (const id of inputs) {
    const p = circuit.components.find((x) => x.id === id);
    s = (s << 1) | (p?.params?.on ? 1 : 0);
  }
  return s;
}

export const cellKey = (level: string, state: number, input: number) => `${level}:${state}:${input}`;

const ns = (x: number) => `${+x.toFixed(1)} ns`;

/** One sentence about what the output did. */
export function verdict(t: Transition, level: Level): string {
  const flipped = level.inputs[t.input]!;
  const state = bitsOf(t.state, level.inputs.length).join('');
  const now = bitsOf(t.state ^ (1 << (level.inputs.length - 1 - t.input)), level.inputs.length).join('');
  const head = `${flipped} flipped (${state} → ${now}).`;
  const o = level.out;
  if (t.kind === 'steady') return `${head} ${o} stayed at ${t.before}, as the function says it should.`;
  if (t.kind === 'changes') return `${head} ${o} changed from ${t.before} to ${t.after}, once, as it should.`;
  const p = pulses(t)[0];
  const width = p ? ` for ${ns(p.width)}` : '';
  if (t.hazard === 'static-1') return `${head} ${o} should have stayed at 1, but dropped to 0${width} and came back: a static-1 hazard.`;
  if (t.hazard === 'static-0') return `${head} ${o} should have stayed at 0, but rose to 1${width} and fell back: a static-0 hazard.`;
  return `${head} ${o} should have changed once, from ${t.before} to ${t.after}, but bounced on the way (${t.edges.length} changes): a dynamic hazard.`;
}
