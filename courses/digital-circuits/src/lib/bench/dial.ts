/**
 * The abstraction dial of a live circuit, without the Svelte: which levels a figure offers, what
 * each level simulates, how the reader's switch settings travel from one level to the next, and how
 * a transistor's state becomes a colour. CircuitWidget puts a control on top of this.
 *
 *   logic     gates and 0/1                                 digital engine   (the circuit as drawn)
 *   switch    every gate opened up into its transistors     switch engine    (one stage per unit delay)
 *   analog    the same transistors as devices, in volts     analog engine    (nanoseconds: real delay)
 */
import type { EngineKind, FlatNetlist, Circuit, Params, ParamValue } from '../sim/netlist/types';
import type { ElementState } from '../sim/engine';
import type { SubResolver } from '../sim/netlist/connect';
import { flatten } from '../sim/netlist/flatten';
import { expandCheck, expandToAnalog, expandToSwitch, type ExpandCheck } from '../sim/expand';

export type DialLevel = 'logic' | 'switch' | 'analog';

export const DIAL_LEVELS: DialLevel[] = ['logic', 'switch', 'analog'];

export const DIAL_LABEL: Record<DialLevel, string> = { logic: 'Logic', switch: 'Switches', analog: 'Analog' };

export const DIAL_HELP: Record<DialLevel, string> = {
  logic: 'Gates and 0/1',
  switch: 'Every gate opened up into its transistors, each a switch',
  analog: 'The same transistors as devices: voltages, and real switching delay',
};

/** Simulated seconds per real second at each level (a stage of the switch engine takes 1 ns). */
export const DIAL_SPEED: Record<DialLevel, number | undefined> = { logic: undefined, switch: 4e-9, analog: 1e-9 };

/**
 * Levels a figure offers: `dial=true` all three, or a list such as "logic,switch" (also "switches",
 * "digital"). Anything else falls back to all three; `logic` is always first.
 */
export function parseDial(dial: boolean | string | undefined): DialLevel[] {
  if (dial === undefined || dial === false || dial === '') return [];
  if (dial === true) return [...DIAL_LEVELS];
  const named = String(dial)
    .toLowerCase()
    .split(/[\s,]+/)
    .map((s) => (s === 'switches' || s === 'switch-level' ? 'switch' : s === 'digital' || s === 'gates' ? 'logic' : s))
    .filter((s): s is DialLevel => (DIAL_LEVELS as string[]).includes(s));
  const set = new Set<DialLevel>(named.length ? named : DIAL_LEVELS);
  set.add('logic');
  return DIAL_LEVELS.filter((l) => set.has(l));
}

export function parseLevel(v: string | undefined): DialLevel | undefined {
  const s = v?.toLowerCase();
  return s === 'switches' || s === 'switch' ? 'switch' : s === 'analog' ? 'analog' : s === 'logic' || s === 'digital' ? 'logic' : undefined;
}

/** What each offered level can do with this circuit. */
export function availability(circuit: Circuit | undefined, levels: DialLevel[]): Record<DialLevel, ExpandCheck & { offered: boolean }> {
  const out = {} as Record<DialLevel, ExpandCheck & { offered: boolean }>;
  for (const l of DIAL_LEVELS) {
    const offered = levels.includes(l);
    out[l] = circuit && l !== 'logic' ? { ...expandCheck(circuit, l), offered } : { ok: true, transistors: 0, offered };
  }
  return out;
}

/** The reader's settings of the input parts (a switch's `on`, a button's `pressed`), by component id. */
export type Inputs = Record<string, Params>;

/** Keep the settings of the input parts when the circuit changes level. */
export function seed(circuit: Circuit, inputs: Inputs): Circuit {
  if (!Object.keys(inputs).length) return circuit;
  return { ...circuit, components: circuit.components.map((c) => (inputs[c.id] ? { ...c, params: { ...c.params, ...inputs[c.id] } } : c)) };
}

export function remember(inputs: Inputs, id: string, key: string, value: ParamValue): Inputs {
  return { ...inputs, [id]: { ...inputs[id], [key]: value } };
}

/** A level of a circuit, ready to draw and to simulate. */
export interface Active {
  level: DialLevel;
  /** What the schematic draws (transistor levels: with the gate outlines). It has the same nets as `netlist()`. */
  drawn: Circuit;
  /** The circuit without outlines: what the bench opens. */
  plain: Circuit;
  netlist(): FlatNetlist;
  kind: EngineKind;
  /** Engine options for this level. */
  options: Record<string, unknown>;
  /** Component ids of `drawn`, and which of them are transistors. */
  ids: string[];
  transistor: boolean[];
  /** Gate id → transistor ids (transistor levels). */
  map: Record<string, string[]>;
}

const TRANSISTORS = new Set(['nmos', 'pmos']);

/** Build one level of a circuit, with the reader's input settings applied. */
export function buildLevel(base: Circuit, level: DialLevel, inputs: Inputs = {}, parts?: SubResolver): Active {
  const seeded = seed(base, inputs);
  if (level === 'logic') {
    return finish({ level, drawn: seeded, plain: seeded, netlist: () => flatten(seeded, parts), kind: seeded.engine ?? 'digital', options: {}, map: {} });
  }
  const x = level === 'switch' ? expandToSwitch(seeded) : expandToAnalog(seeded);
  return finish({
    level,
    drawn: x.drawn,
    plain: x.circuit,
    netlist: () => x.netlist(),
    kind: level,
    // Switch level: one transistor stage per unit delay, so a change ripples through; analog: fine steps.
    options: level === 'switch' ? { mode: 'unit-delay', unitDelay: 1e-9 } : { step: 100e-12 },
    map: x.map,
  });
}

function finish(a: Omit<Active, 'ids' | 'transistor'>): Active {
  return { ...a, ids: a.drawn.components.map((c) => c.id), transistor: a.drawn.components.map((c) => TRANSISTORS.has(c.type)) };
}

/** Inputs to show on the timing strip of the analog level: the parts the reader flips, then what lights. */
export function autoTraces(circuit: Circuit, max = 6): string {
  const src = circuit.components.filter((c) => ['toggle', 'button', 'clock'].includes(c.type));
  const out = circuit.components.filter((c) => c.type === 'indicator' || c.type === 'probe');
  return [...src.slice(0, 3), ...out.slice(0, 3)]
    .slice(0, max)
    .map((c) => c.id)
    .join(',');
}

export type Conduction = 'on' | 'off' | 'x' | 'sat';

/** A transistor's state as the engines report it → how to draw it. */
export function conduction(state: ElementState): Conduction {
  if (typeof state.region === 'string') return state.region === 'off' ? 'off' : state.region === 'saturation' ? 'sat' : 'on';
  const on = Number(state.on);
  return on === 1 ? 'on' : on === 0 ? 'off' : 'x';
}
