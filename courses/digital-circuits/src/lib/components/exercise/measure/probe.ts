/**
 * The value a `measure` exercise asks for: given in the block (`answer`), or read from the circuit with the
 * analog engine (`probe`), so the answer cannot drift from the drawing.
 */
import type { Circuit } from '$lib/sim/netlist/types';
import { flatten, topLevelNets } from '$lib/sim/netlist/flatten';
import { createAnalogEngine } from '$lib/sim/analog';
import { parseSI } from '$lib/bench/editor/units';

export interface Probe {
  /** Voltage of a net (by name) or a pin ("R1.2"), relative to ground. */
  voltage?: string;
  /** Voltage from the first net or pin to the second. */
  between?: [string, string];
  /** Current into pin 1 of a part (its first pin), in amperes. */
  current?: string;
  /** Power dissipated in a part (V × I), in watts. */
  power?: string;
}

export interface MeasureInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  /** The live circuit: inline, or a file relative to content/chapters (like `::circuit src`). */
  circuit?: Circuit;
  src?: string;
  /** The question above the answer box. */
  question?: string;
  /** The unit the answer is in, shown next to the box ("V", "mA"): the reader may type any prefix. */
  unit?: string;
  /** The expected value, in base units or as text ("4.7 k"). */
  answer?: number | string;
  probe?: Probe;
  /** Relative tolerance (0.05 = 5 %) or `{ rel, abs }`. Default 5 %. */
  tolerance?: number | { rel?: number; abs?: number };
  /** Seconds of simulated time before reading (default 0.5 s: long enough for RC circuits to settle). */
  settle?: number;
  /** Timing diagram traces, as for `::circuit`. */
  traces?: string;
  mode?: 'logic' | 'voltage' | 'plain';
  current?: boolean;
  speed?: number;
}

/** Read the probe from the circuit. */
export function probeValue(circuit: Circuit, probe: Probe, settle = 0.5): number {
  const flat = flatten(circuit);
  const conn = topLevelNets(circuit);
  const e = createAnalogEngine(flat);
  e.advance(settle);
  const net = (name: string): number => {
    let n: number | undefined = /^.+\.\w+$/.test(name) ? conn.pinNet.get(name) : undefined;
    if (n === undefined) {
      const i = conn.netNames.indexOf(name);
      if (i >= 0) n = i;
    }
    if (n === undefined) throw new Error(`no net or pin called ${name}`);
    return flat.alias?.[n] ?? n;
  };
  const current = (id: string) => {
    if (!flat.elements.some((x) => x.id === id)) throw new Error(`no part called ${id}`);
    return e.current(id, 0);
  };
  if (probe.voltage) return e.voltage(net(probe.voltage));
  if (probe.between) return e.voltage(net(probe.between[0])) - e.voltage(net(probe.between[1]));
  if (probe.current) return current(probe.current);
  if (probe.power) {
    const el = flat.elements.find((x) => x.id === probe.power);
    if (!el || el.pins.length < 2) throw new Error(`no two-terminal part called ${probe.power}`);
    return Math.abs((e.voltage(el.pins[0]!) - e.voltage(el.pins[1]!)) * e.current(el.id, 0));
  }
  throw new Error('a probe needs voltage, between, current or power');
}

/** The expected value of an exercise, in base units. */
export function expectedValue(input: MeasureInput, circuit?: Circuit): number {
  if (input.answer !== undefined) {
    const v = typeof input.answer === 'number' ? input.answer : parseSI(input.answer);
    if (v === undefined) throw new Error(`"${input.answer}" is not a number`);
    return v;
  }
  if (input.probe && circuit) return probeValue(circuit, input.probe, input.settle);
  throw new Error('a measure exercise needs an answer or a probe (with a circuit)');
}
