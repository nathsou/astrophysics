/**
 * A pulse sent through a chain of gates of different speeds, under both delay models of the digital engine.
 *
 * With inertial delay a gate ignores a pulse shorter than its own delay; with transport delay it passes every
 * change on, however short. The chain has four buffers with delays of 1, 2, 3 and 4 ns, so a pulse of a given
 * width travels as far as the first buffer that is slower than the pulse is long.
 */
import '$lib/sim/netlist/catalog';
import { flatten, topLevelNets } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DelayModel, type DigitalEngine } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';
import { resolveTraces, type Trace } from '$lib/bench/traces';

export const STAGES = ['B1', 'B2', 'B3', 'B4'];
export const DELAYS = [1, 2, 3, 4];
/** When the pulse starts, and how long the run lasts (ns). */
export const T_START = 8;
export const T_END = 38;
/** The diagram starts here, after the power-up transient (ns). */
export const T_VIEW = 6;

export interface Rig {
  engine: DigitalEngine;
  traces: Trace[];
}

export function makeRig(circuit: Circuit, delayModel: DelayModel): Rig {
  const engine = createDigitalEngine(flatten(circuit), { delayModel });
  const { traces } = resolveTraces(['IN', ...STAGES], circuit, topLevelNets(circuit));
  return { engine, traces };
}

/** Send one pulse of `widthNs` and run to T_END. */
export function sendPulse(engine: DigitalEngine, widthNs: number): void {
  engine.reset();
  engine.advance(T_START * 1e-9);
  engine.setParam('IN', 'on', true);
  engine.advance(widthNs * 1e-9);
  engine.setParam('IN', 'on', false);
  engine.advance((T_END - T_START - widthNs) * 1e-9);
}

export interface Stage {
  name: string;
  delay: number;
  /** The pulse came out of this stage. */
  passed: boolean;
  /** Width of the pulse at this stage, ns (NaN if it did not pass). */
  width: number;
}

/** What each stage output did, read from the recorded waveforms (rows: IN, B1 … B4). */
export function stages(times: Float64Array, values: Float64Array[]): Stage[] {
  return STAGES.map((name, k) => {
    const v = values[k + 1]!;
    let rise = NaN;
    let fall = NaN;
    for (let i = 1; i < times.length; i++) {
      if (v[i - 1] === 0 && v[i] === 1 && Number.isNaN(rise)) rise = times[i]!;
      else if (v[i - 1] === 1 && v[i] === 0 && !Number.isNaN(rise) && Number.isNaN(fall)) fall = times[i]!;
    }
    const passed = !Number.isNaN(rise) && !Number.isNaN(fall);
    return { name, delay: DELAYS[k]!, passed, width: passed ? Math.round((fall - rise) * 1e12) / 1e3 : NaN };
  });
}

/** One sentence: how far the pulse got. */
export function summary(list: Stage[], widthNs: number): string {
  const last = list.filter((s, i) => list.slice(0, i + 1).every((x) => x.passed)).length;
  const w = `${+widthNs.toFixed(2)} ns`;
  if (last === list.length) return `The ${w} pulse gets through all four buffers, still ${+list[list.length - 1]!.width.toFixed(2)} ns wide.`;
  if (last === 0) return `The ${w} pulse is swallowed by the first buffer, whose delay is ${list[0]!.delay} ns.`;
  return `The ${w} pulse gets through ${last === 1 ? 'the first buffer' : `the first ${last} buffers`} and is swallowed by ${list[last]!.name}, whose delay is ${list[last]!.delay} ns.`;
}
