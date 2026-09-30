/**
 * Finding glitches by simulation.
 *
 * A *transition* is one input of a circuit flipping while the others hold. For each transition of a small
 * combinational circuit this module runs the digital engine (the same one that drives the figures), lets the
 * circuit settle, flips the input, and looks at every change of the output that follows. If the function
 * says the output should stay put and it does not, or should change once and changes several times, the
 * circuit has a hazard for that transition: a static-1 hazard, a static-0 hazard or a dynamic one.
 *
 * Nothing here is a formula. Whether a hazard shows up depends on the delays, and the engine knows the
 * delays: changing the inverter's delay or the delay model changes the answers, as it does in hardware.
 */
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import { createDigitalEngine, type DelayModel } from '$lib/sim/digital';
import type { Circuit } from '$lib/sim/netlist/types';

export type DelayModelName = DelayModel;

export interface HazardOptions {
  delayModel?: DelayModel;
  /** Delay of every inverter, ns (default: whatever the circuit says). */
  notDelay?: number;
}

export interface Hunt {
  /** The logic switches, in order (ids of the toggles, most significant first). */
  inputs: string[];
  /** Id of the indicator that shows the output. */
  output: string;
}

export type Kind = 'steady' | 'changes' | 'glitch';
export type HazardType = 'static-1' | 'static-0' | 'dynamic';

export interface Pulse {
  /** Time after the input flipped, ns. */
  at: number;
  /** How long the output stayed away from its settled value, ns. */
  width: number;
}

export interface Transition {
  /** Input values before the flip, as a number: inputs[0] is the top bit. */
  state: number;
  /** Which input flipped (index into `inputs`). */
  input: number;
  before: number;
  after: number;
  /** Times (ns after the flip) at which the output changed. */
  edges: number[];
  kind: Kind;
  hazard?: HazardType;
}

/** Input values of a state number. */
export const bitsOf = (state: number, n: number): number[] => Array.from({ length: n }, (_, i) => (state >> (n - 1 - i)) & 1);

/** A copy of the circuit with every inverter's delay set (ns). */
export function withNotDelay(circuit: Circuit, ns: number | undefined): Circuit {
  if (ns === undefined) return circuit;
  const c = structuredClone(circuit);
  for (const p of c.components) if (p.type === 'not') p.params = { ...p.params, delay: ns };
  return c;
}

const SETTLE = 200e-9;

/** Run one transition and describe what the output did. */
export function runTransition(circuit: Circuit, hunt: Hunt, state: number, input: number, opts: HazardOptions = {}): Transition {
  const c = withNotDelay(circuit, opts.notDelay);
  const flat = flatten(c);
  const e = createDigitalEngine(flat, { delayModel: opts.delayModel ?? 'inertial' });
  const lamp = flat.elements.find((x) => x.id === hunt.output);
  if (!lamp) throw new Error(`no indicator ${hunt.output}`);
  const net = lamp.pins[0]!;
  const values = bitsOf(state, hunt.inputs.length);
  hunt.inputs.forEach((id, i) => e.setParam(id, 'on', !!values[i]));
  e.advance(SETTLE);
  const rec = e.watch([net]);
  const t0 = e.time;
  const before = e.logic(net);
  e.setParam(hunt.inputs[input]!, 'on', !values[input]);
  e.advance(SETTLE);
  const after = e.logic(net);
  const times = rec.times();
  const vals = rec.values()[0]!;
  rec.close();
  const edges: number[] = [];
  let last: number = before;
  for (let i = 0; i < times.length; i++) {
    if (times[i]! < t0 || vals[i] === last || vals[i]! > 1) continue;
    edges.push(Math.round((times[i]! - t0) * 1e12) / 1e3);
    last = vals[i]!;
  }
  let kind: Kind;
  let hazard: HazardType | undefined;
  if (before === after) {
    kind = edges.length === 0 ? 'steady' : 'glitch';
    if (kind === 'glitch') hazard = before === 1 ? 'static-1' : 'static-0';
  } else {
    kind = edges.length <= 1 ? 'changes' : 'glitch';
    if (kind === 'glitch') hazard = 'dynamic';
  }
  return { state, input, before, after, edges, kind, hazard };
}

/** Every transition of the circuit: 2ⁿ states times n inputs. */
export function allTransitions(circuit: Circuit, hunt: Hunt, opts: HazardOptions = {}): Transition[] {
  const n = hunt.inputs.length;
  const out: Transition[] = [];
  for (let s = 0; s < 1 << n; s++) for (let i = 0; i < n; i++) out.push(runTransition(circuit, hunt, s, i, opts));
  return out;
}

/** The pulses of a glitching transition: pairs of edges. */
export function pulses(t: Transition): Pulse[] {
  const out: Pulse[] = [];
  const settled = t.before === t.after ? t.edges : t.edges.slice(0, t.edges.length - 1);
  for (let i = 0; i + 1 < settled.length; i += 2) out.push({ at: settled[i]!, width: settled[i + 1]! - settled[i]! });
  return out;
}
