/**
 * Checking a `route` exercise: the cells and pads of a vFPGA-S are placed for the reader, who connects nets by
 * choosing what drives each routing multiplexer. The check has three parts, in order:
 *
 * 1. **Locked bits.** Cells, pads and clocks are pre-placed; only routing select fields may differ from the start.
 * 2. **Legality.** For every net, each sink is traced back through the multiplexers it reads to what finally drives it.
 *    It must be the net's source. A sink that reaches nothing is *open*; a sink that reaches another net's source is
 *    *shorted* to that net (in this fabric two nets cannot fight over a wire: each wire has one multiplexer, so a
 *    second net that needs the same wire simply ends up reading the first net's signal).
 * 3. **Function.** The configuration is decoded and simulated on the fabric simulator for every input combination, and
 *    each output pad must show its expression of the input pads.
 */
import { evalExpr, parseExpr, type Expr } from '$lib/pld/twolevel/expr';
import { device, buildFabric, lockedIntact, nodeLabel, nodeOf, simulateFabric, traceDriver, type FabricSpec } from '../fabric';

export interface RouteNet {
  name: string;
  from: string;
  to: string[];
}

export interface RouteInput {
  id: string;
  title?: string;
  prompt?: string;
  hints?: string[];
  explain?: string;
  /** The cells and pads that are already placed (and their LUTs). */
  fabric: Pick<FabricSpec, 'cells' | 'pads'>;
  /** The nets to route. */
  nets: RouteNet[];
  /** What each output pad must show, as an expression of the input pads: `{ P8: "P0 ^ P1" }`. */
  outputs?: Record<string, string>;
  /** Routes (source, sink) that make a working configuration. */
  solution?: [string, string][];
}

export interface SinkStatus {
  /** `LC(1,1,0).I0`, `P8`. */
  sink: string;
  state: 'ok' | 'open' | 'short' | 'loop';
  /** What the sink is driven by, when it is another net's source or something stray. */
  drivenBy?: string;
  /** The nodes from the sink back to its driver, for highlighting. */
  path: number[];
}

export interface NetStatus {
  name: string;
  from: string;
  sinks: SinkStatus[];
  done: boolean;
}

export interface FunctionRow {
  inputs: Record<string, string>;
  expected: Record<string, string>;
  got: Record<string, string>;
  differ: string[];
}

export interface RouteOutcome {
  pass: boolean;
  /** Pre-placed bits were changed. */
  locked: boolean;
  nets: NetStatus[];
  legal: boolean;
  /** Function check (only when the routing is legal). */
  functionOk?: boolean;
  rows: FunctionRow[];
  problems: string[];
}

/** The configuration the reader starts from: cells and pads, no routes. */
export function startBits(input: RouteInput): Uint8Array {
  return buildFabric(input.fabric, false).bits;
}

/** A configuration with the solution's routes. */
export function solutionBits(input: RouteInput): Uint8Array {
  return buildFabric({ ...input.fabric, routes: input.solution ?? [] }, true).bits;
}

/** The status of every net under a configuration (cheap: no simulation), for the live list beside the chip. */
export function netStatus(input: RouteInput, bits: Uint8Array): NetStatus[] {
  const dev = device();
  const sources = new Map<number, string>();
  for (const n of input.nets) sources.set(nodeOf(dev, n.from, 'source'), n.name);
  return input.nets.map((net) => {
    const src = nodeOf(dev, net.from, 'source');
    const sinks = net.to.map((to): SinkStatus => {
      const node = nodeOf(dev, to, 'sink');
      const t = traceDriver(dev, bits, node);
      if (t.loop) return { sink: to, state: 'loop', path: t.path };
      if (t.source < 0) return { sink: to, state: 'open', path: t.path };
      if (t.source === src) return { sink: to, state: 'ok', path: t.path };
      const other = sources.get(t.source);
      return { sink: to, state: 'short', drivenBy: other ? `net ${other} (${nodeLabel(dev, t.source)})` : nodeLabel(dev, t.source), path: t.path };
    });
    return { name: net.name, from: net.from, sinks, done: sinks.every((s) => s.state === 'ok') };
  });
}

const bitText = (v: boolean | 0 | 1): string => (v ? '1' : '0');

export function checkRoute(input: RouteInput, bits: Uint8Array): RouteOutcome {
  const dev = device();
  const problems: string[] = [];
  const locked = lockedIntact(dev, bits, startBits(input));
  const nets = netStatus(input, bits);
  if (!locked) problems.push('The cells and pads are already placed: only the routing multiplexers are yours to set. Use Undo, or Start again.');
  for (const n of nets)
    for (const s of n.sinks) {
      if (s.state === 'open') problems.push(`Net ${n.name}: ${s.sink} is not connected to anything yet.`);
      else if (s.state === 'short') problems.push(`Net ${n.name}: ${s.sink} is driven by ${s.drivenBy}, not by ${n.from}: two nets share a wire.`);
      else if (s.state === 'loop') problems.push(`Net ${n.name}: the route to ${s.sink} runs round in a circle.`);
    }
  const legal = locked && nets.every((n) => n.done);
  const outcome: RouteOutcome = { pass: false, locked, nets, legal, rows: [], problems };
  if (!legal || !input.outputs) {
    outcome.pass = legal && !input.outputs;
    return outcome;
  }
  // The function, for every input combination of the input pads.
  const exprs = new Map<string, Expr>();
  const inputs = new Set<string>();
  for (const [pad, text] of Object.entries(input.outputs)) {
    const e = parseExpr(text);
    exprs.set(pad, e);
  }
  for (const [pad, dir] of Object.entries(input.fabric.pads ?? {})) if (dir === 'in') inputs.add(pad);
  const inNames = [...inputs];
  const outNames = [...exprs.keys()];
  const sim = simulateFabric(dev, bits, inNames, outNames);
  problems.push(...sim.problems);
  const n = inNames.length;
  let bad = 0;
  sim.rows.forEach((got, v) => {
    const values = Object.fromEntries(inNames.map((p, i) => [p, (v >> (n - 1 - i)) & 1]));
    const want = outNames.map((o) => evalExpr(exprs.get(o)!, (name) => values[name] ?? 0));
    const differ = outNames.filter((_, i) => got[i] !== bitText(want[i]!));
    if (differ.length) {
      bad++;
      if (outcome.rows.length < 8) {
        outcome.rows.push({
          inputs: Object.fromEntries(inNames.map((p) => [p, String(values[p])])),
          expected: Object.fromEntries(outNames.map((o, i) => [o, String(want[i])])),
          got: Object.fromEntries(outNames.map((o, i) => [o, got[i]!.toUpperCase()])),
          differ,
        });
      }
    }
  });
  outcome.functionOk = bad === 0 && sim.problems.length === 0;
  outcome.pass = outcome.functionOk;
  return outcome;
}
