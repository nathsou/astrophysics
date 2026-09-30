/**
 * Run a digital circuit and record some of its nets as signals, the way a logic analyser attached to the circuit would:
 * every change is kept, so a glitch shows up, and the result can be handed to a protocol decoder. The chapter's serial
 * figures and their tests use this to decode what the *circuits* put on their wires, not what a generator says they should.
 */
import '$lib/sim/netlist/catalog';
import { createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';
import { flatten, topLevelNets } from '$lib/sim/netlist/flatten';
import { resolveTraces } from '$lib/bench/traces';
import type { Circuit, FlatNetlist } from '$lib/sim/netlist/types';
import { signalsOf, type Signal } from '$lib/bench/instruments/protocols';

export interface Capture {
  engine: DigitalEngine;
  flat: FlatNetlist;
  /** One signal per requested name, in order. */
  signals: Signal[];
  /** The names that matched nothing. */
  missing: string[];
  /** Simulated time at the end of the capture. */
  end: number;
}

/** Names are net names (labels), pins ("U1.Y") or component ids, as for `traces=` in a `::circuit`. */
export function captureDigital(circuit: Circuit, names: string[], seconds: number, setup?: (engine: DigitalEngine) => void): Capture {
  const flat = flatten(circuit);
  const conn = topLevelNets(circuit);
  const { traces, missing } = resolveTraces(names, circuit, conn);
  const engine = createDigitalEngine(flat);
  setup?.(engine);
  engine.settle();
  const nets = traces.map((t) => flat.alias?.[t.net] ?? t.net);
  const rec = engine.watch(nets);
  engine.advance(seconds);
  const times = rec.times();
  const values = rec.values();
  rec.close();
  const byName = new Map(traces.map((t, i) => [t.name, i]));
  const all = signalsOf({ times, channels: values, names: traces.map((t) => t.name) });
  const signals = names.map((n) => (byName.has(n) ? all[byName.get(n)!]! : { t: [0], v: [3] }));
  return { engine, flat, signals, missing, end: engine.time };
}
