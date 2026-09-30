/**
 * A ripple-carry adder settling, on the digital engine: a = 11…1, b = 0, and the carry-in switches from 0 to 1.
 * The carry has to travel through every stage, and on the way the sum word passes through wrong numbers.
 */
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import { analyse, netlistOf, rippleAdder } from './timing';

export interface Adder {
  engine: DigitalEngine;
  bits: number;
  /** Names for the waveforms: carry-in, the carries, the top sum bit, and their nets. */
  traces: { name: string; net: number }[];
  /** Nets of s0 … s(n−1) and of the carry out, least significant first. */
  word: number[];
  /** Propagation delay of the network, ns. */
  tpd: number;
}

export function makeAdder(bits: number): Adder {
  const net = rippleAdder(bits);
  const { flat, wire } = netlistOf(net);
  const engine = createDigitalEngine(flat);
  const w = (id: string) => wire.get(id)!;
  const traces = [
    { name: 'cin', net: w('cin') },
    ...Array.from({ length: bits }, (_, i) => ({ name: `c${i + 1}`, net: w(`c${i + 1}`) })),
    { name: `s${bits - 1}`, net: w(`s${bits - 1}`) },
  ];
  const word = [...Array.from({ length: bits }, (_, i) => w(`s${i}`)), w(`c${bits}`)];
  return { engine, bits, traces, word, tpd: analyse(net).tpd };
}

/** Every input at rest: a all ones, b zero, carry-in 0. Runs until the outputs are steady. */
export function rest(a: Adder): void {
  for (let i = 0; i < a.bits; i++) {
    a.engine.setParam(`a${i}`, 'on', true);
    a.engine.setParam(`b${i}`, 'on', false);
  }
  a.engine.setParam('cin', 'on', false);
  a.engine.advance(200e-9);
}

/** The word on the outputs now (sum bits, then carry out), or undefined while any bit is unknown. */
export function readWord(a: Adder): number | undefined {
  let v = 0;
  for (let k = 0; k < a.word.length; k++) {
    const l = a.engine.logic(a.word[k]!);
    if (l > 1) return undefined;
    v += l * 2 ** k;
  }
  return v;
}

/**
 * The successive values of a word, from recorded rows (columns: the word's bits, least significant first): the value
 * at time `from`, then each later change.
 */
export function sequence(times: Float64Array, values: Float64Array[], from: number): { at: number; value: number }[] {
  const out: { at: number; value: number }[] = [];
  for (let r = 0; r < times.length; r++) {
    let v = 0;
    let known = true;
    values.forEach((col, k) => {
      const l = col[r]!;
      if (l > 1) known = false;
      else v += l * 2 ** k;
    });
    if (!known) continue;
    const before = times[r]! < from - 1e-15;
    if (before) {
      // The state when the flip happened: the last row before it.
      out.length = 0;
      out.push({ at: from, value: v });
    } else if (out.length === 0 || out[out.length - 1]!.value !== v) out.push({ at: times[r]!, value: v });
  }
  return out;
}
