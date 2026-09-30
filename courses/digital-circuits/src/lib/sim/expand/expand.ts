/**
 * The abstraction dial: expanding a circuit of gates one level down.
 *
 *   logic ──expandToSwitch──▶ every gate becomes its CMOS transistor network (switch-level engine)
 *   logic ──expandToAnalog──▶ the same transistors, each a level-1 MOSFET, with the small capacitances
 *                             that give switching a delay (analog engine)
 *
 * The result is an ordinary circuit: the parts that are not gates (toggles, indicators, probes,
 * clocks, constants, supply rails, grounds and net labels) and the wires between them are kept, and
 * every gate is replaced by its transistors, drawn inside a dashed outline that stands where the gate
 * stood. To make room the whole drawing is stretched (see `stretch.ts`): positions change, but
 * everything is still on the grid, wires are still straight, and every wire that ended on a gate's pin
 * still ends on the same pin of the opened-up gate (the left edge of the outline for inputs, the right
 * edge for the output).
 *
 * Why not one subcircuit block per gate? A block's pins sit where the subcircuit's ports say
 * (`subcircuitDef`), which cannot be the gate's own pin positions, and the schematic cannot draw the inside
 * of a block. The transistors are therefore placed in the circuit itself, with hierarchical-looking
 * ids ("U1/MP1"), and `map` says which belong to which gate. The same drawings are available as
 * standalone circuits (`cellCircuit`).
 */
import type { Circuit, FlatElement, FlatNetlist, Note, Placed, Wire } from '../netlist/types';
import { boundsOf, getDef, pinsOf, transformPoint, withDefaults } from '../netlist/catalog';
import { placedPins } from '../netlist/connect';
import { flatten, topLevelNets } from '../netlist/flatten';
import { cellFor, cellTransistors, gateInputs, isGateType, type GateType } from './cells';
import { registerFrame } from './frame';
import { layoutCell, placeCell, type CellLayout, type Pt } from './layout';
import { stretch, type Need } from './stretch';

export type ExpandLevel = 'switch' | 'analog';

/** Most transistors a circuit may have to be opened up at each level. */
export const TRANSISTOR_BUDGET: Record<ExpandLevel, number> = { switch: 400, analog: 48 };

/** Parts other than gates that survive expansion: each has a single pin. */
const KEPT = new Set(['toggle', 'button', 'clock', 'const', 'indicator', 'probe', 'ground', 'rail', 'label']);
const SOURCES = new Set(['toggle', 'button', 'clock', 'const']);

/** Analog device parameters (documented in `expandToAnalog`). */
export const ANALOG = {
  /** Transconductance of every transistor, A/V²: about 2.5 kΩ on-resistance at 5 V (R_on = 1 / (k (V_gs − V_t)) = 1 / (1e-4 × (5 − 1) V) = 2.5 kΩ). p-channel devices are drawn twice as wide, so both have the same k. */
  k: 1e-4,
  /** Capacitance of each transistor gate, on the net that drives it (F). */
  gate: 2e-15,
  /** Capacitance of a node inside a gate: the middle of a series stack, or a stage's output (F). */
  node: 10e-15,
  /** Extra capacitance of a gate's own output: wire and load (F). */
  out: 50e-15,
};

export interface Frame {
  /** The gate's id. */
  id: string;
  type: string;
  /** Box in grid units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Expansion {
  level: ExpandLevel;
  /** The circuit to simulate (gates replaced by transistors). Flattens with `flatten`; see `netlist()` for the analog extras. */
  circuit: Circuit;
  /** `circuit` plus the dashed outlines: what to draw. It has the same nets, numbered the same way. */
  drawn: Circuit;
  /** Gate id → ids of its transistors. */
  map: Record<string, string[]>;
  frames: Frame[];
  transistors: number;
  /** What the engine simulates: `flatten(circuit)`; at the analog level with the parasitic capacitances added. */
  netlist(): FlatNetlist;
}

export interface ExpandCheck {
  ok: boolean;
  reason?: string;
  /** Transistors the expansion would have. */
  transistors: number;
}

const gateOf = (c: Placed) => (isGateType(c.type) ? (c.type as GateType) : undefined);

/** Can this circuit be opened up to `level`, and if not, why not? */
export function expandCheck(circuit: Circuit, level: ExpandLevel | 'logic'): ExpandCheck {
  const r = structure(circuit);
  if (level === 'logic') return { ok: true, transistors: r.transistors };
  const budget = TRANSISTOR_BUDGET[level];
  const reason = r.reason ?? (r.transistors > budget ? `${r.transistors} transistors is more than the ${level === 'analog' ? 'analog' : 'switch-level'} view can show (${budget})` : undefined);
  return { ok: !reason, reason, transistors: r.transistors };
}

function structure(circuit: Circuit): { reason?: string; transistors: number } {
  let transistors = 0;
  let gates = 0;
  let reason: string | undefined;
  for (const c of circuit.components) {
    const g = gateOf(c);
    if (g) {
      gates++;
      transistors += cellTransistors(cellFor(g, gateInputs(g, c.params)));
      if (c.rot || c.flip) reason ??= `${c.id} is rotated or mirrored`;
    } else if (!KEPT.has(c.type)) {
      reason ??= `${c.id} (${getDef(c.type)?.name ?? c.type}) has no transistor-level version`;
    }
  }
  if (Object.keys(circuit.subcircuits ?? {}).length) reason ??= 'it uses subcircuits';
  if (!gates) reason ??= 'there are no gates to open up';
  return { reason, transistors };
}

export const canExpand = (circuit: Circuit, level: ExpandLevel | 'logic'): boolean => expandCheck(circuit, level).ok;

export const expandToSwitch = (circuit: Circuit): Expansion => expand(circuit, 'switch');
export const expandToAnalog = (circuit: Circuit): Expansion => expand(circuit, 'analog');

const layouts = new Map<string, CellLayout>();
function layoutOf(type: GateType, inputs: number): CellLayout {
  const key = `${type}/${inputs}`;
  let l = layouts.get(key);
  if (!l) layouts.set(key, (l = layoutCell(cellFor(type, inputs))));
  return l;
}

const titleOf = (type: string, inputs: number) => (inputs > 1 && type !== 'tristate' ? `${type.toUpperCase()}${inputs}` : type === 'tristate' ? 'TRI-STATE' : type.toUpperCase());

/** Where each gate's stage outputs are, for the analog capacitances: global wire indices. */
interface GateMeta {
  stageWires: number[];
}

export function expand(circuit: Circuit, level: ExpandLevel): Expansion {
  const check = structure(circuit);
  if (check.reason) throw new Error(`cannot open this circuit up: ${check.reason}`);
  registerFrame();

  // Gates and their drawings.
  interface Gate {
    c: Placed;
    type: GateType;
    inputs: number;
    layout: CellLayout;
    /** Footprint in the original drawing (grid units, relative to the origin). */
    b: { x0: number; y0: number; x1: number; y1: number };
    pins: Record<string, Pt>;
  }
  const gates: Gate[] = [];
  const others: Placed[] = [];
  for (const c of circuit.components) {
    const type = gateOf(c);
    if (!type) {
      others.push(c);
      continue;
    }
    const def = getDef(c.type)!;
    const params = withDefaults(def, c.params);
    const inputs = gateInputs(type, params);
    const pins: Record<string, Pt> = {};
    for (const p of pinsOf(def, params)) pins[p.name] = transformPoint(p, c);
    gates.push({ c, type, inputs, layout: layoutOf(type, inputs), b: boundsOf(def, params), pins });
  }

  // Coordinates that must survive exactly, and the room each gate needs.
  const xs: number[] = [];
  const ys: number[] = [];
  const xNeeds: Need[] = [];
  const yNeeds: Need[] = [];
  for (const w of circuit.wires)
    for (const [x, y] of w.points) {
      xs.push(x);
      ys.push(y);
    }
  for (const c of others)
    for (const p of placedPins(c)) {
      xs.push(p.x);
      ys.push(p.y);
    }
  for (const g of gates) {
    const { c, b, layout } = g;
    for (const p of Object.values(g.pins)) {
      xs.push(p[0]);
      ys.push(p[1]);
    }
    xs.push(c.x + b.x0, c.x + b.x1);
    ys.push(c.y + b.y0, c.y + b.y1);
    xNeeds.push({ a: c.x + b.x0, b: c.x + b.x1, min: layout.w + 1 });
    yNeeds.push({ a: c.y + b.y0, b: c.y + b.y1, min: layout.h + 6 });
  }
  const fx = stretch(xs, xNeeds);
  const fy = stretch(ys, yNeeds);

  const components: Placed[] = [];
  const wires: Wire[] = circuit.wires.map((w) => ({ points: w.points.map(([x, y]) => [fx(x), fy(y)] as [number, number]) }));
  const notes: Note[] = (circuit.notes ?? []).map((n) => ({ ...n, x: fx(n.x), y: fy(n.y) }));

  // The parts that stay: moved so that their pin lands where the stretched wire ends.
  for (const c of others) {
    const p0 = placedPins(c)[0];
    const [dx, dy] = p0 ? [fx(p0.x) - p0.x, fy(p0.y) - p0.y] : [fx(c.x) - c.x, fy(c.y) - c.y];
    components.push({ ...c, x: c.x + dx, y: c.y + dy });
  }

  const map: Record<string, string[]> = {};
  const frames: Frame[] = [];
  const meta = new Map<string, GateMeta>();
  let transistors = 0;
  for (const g of gates) {
    const { c, b, layout } = g;
    const ox = fx(c.x + b.x0);
    const oy = fy(c.y + b.y0);
    const w = fx(c.x + b.x1) - ox;
    const h = fy(c.y + b.y1) - oy;
    const inputs: Record<string, Pt> = {};
    for (const name of layout.inputs) {
      const p = g.pins[name];
      if (p) inputs[name] = [fx(p[0]), fy(p[1])];
    }
    const out = g.pins.Y!;
    const placed = placeCell(layout, c.id, ox, oy, h, { inputs, out: [fx(out[0]), fy(out[1])] });
    if (level === 'analog') for (const p of placed.components) if (p.type === 'nmos' || p.type === 'pmos') p.params = { k: ANALOG.k };
    const base = wires.length;
    components.push(...placed.components);
    for (const pts of placed.wires) wires.push({ points: pts });
    notes.push(...placed.notes);
    map[c.id] = placed.transistors;
    transistors += placed.transistors.length;
    meta.set(c.id, { stageWires: placed.stageWires.map((i) => (i < 0 ? -1 : base + i)) });
    frames.push({ id: c.id, type: c.type, x: ox, y: oy, w, h });
  }

  const title = circuit.title ? `${circuit.title}, opened up` : undefined;
  const expanded: Circuit = { version: 1, ...(title ? { title } : {}), engine: level, components, wires, ...(notes.length ? { notes } : {}) };
  const frameComps: Placed[] = frames.map((f, i) => ({
    id: `${f.id}#outline`,
    type: 'frame',
    x: f.x,
    y: f.y,
    params: { w: f.w, h: f.h, title: `${f.id} · ${titleOf(f.type, gates[i]!.inputs)}` },
  }));
  const drawn: Circuit = { ...expanded, components: [...frameComps, ...components] };

  return {
    level,
    circuit: expanded,
    drawn,
    map,
    frames,
    transistors,
    netlist: () => {
      const flat = flatten(expanded);
      return level === 'analog' ? withParasitics(flat, expanded, meta) : flat;
    },
  };
}

/**
 * Add the capacitances that make analog switching take time: each transistor gate loads the net
 * that drives it (2 fF), each node inside a gate (the middle of a series stack, the output of a
 * stage that feeds another) holds 10 fF, and each gate's output net has 50 fF on top of that.
 * Nets driven by an ideal source (toggles, clocks) and the supply rails get none.
 */
function withParasitics(flat: FlatNetlist, circuit: Circuit, meta: Map<string, GateMeta>): FlatNetlist {
  const conn = topLevelNets(circuit);
  const net = (n: number) => flat.alias?.[n] ?? n;
  const gnd = flat.ground;
  const supply = new Set<number>(gnd === undefined ? [] : [gnd]);
  const driven = new Set<number>();
  for (const e of flat.elements) {
    if (e.type === 'rail') for (const n of e.pins) supply.add(n);
    if (SOURCES.has(e.type)) for (const n of e.pins) driven.add(n);
  }
  const outs = new Set<number>();
  for (const [, m] of meta) {
    const last = m.stageWires[m.stageWires.length - 1];
    if (last !== undefined && last >= 0) outs.add(net(conn.wireNet[last]!));
  }
  const cap = new Map<number, number>();
  const add = (n: number, f: number) => {
    if (supply.has(n) || driven.has(n)) return;
    cap.set(n, (cap.get(n) ?? 0) + f);
  };
  for (const e of flat.elements) {
    if (e.type !== 'nmos' && e.type !== 'pmos') continue;
    e.pinNames.forEach((name, i) => {
      const n = e.pins[i]!;
      if (name === 'G') add(n, ANALOG.gate);
    });
  }
  // Every net that a channel touches is inside a gate or its output.
  const channel = new Set<number>();
  for (const e of flat.elements)
    if (e.type === 'nmos' || e.type === 'pmos') e.pinNames.forEach((name, i) => name !== 'G' && channel.add(e.pins[i]!));
  for (const n of channel) add(n, outs.has(n) ? ANALOG.node + ANALOG.out : ANALOG.node);

  const capDef = getDef('capacitor')!;
  const extra: FlatElement[] = [];
  if (gnd !== undefined) {
    [...cap.entries()]
      .sort((a, b) => a[0] - b[0])
      .forEach(([n, f], i) => extra.push({ id: `Cp${i + 1}`, type: 'capacitor', params: withDefaults(capDef, { capacitance: f }), pins: [n, gnd], pinNames: ['1', '2'] }));
  }
  // A logic LED loads its net with 5 pF in the analog engine (a driver's input): a hundred times the
  // gate's own output. The dial shows a probe in its place: it reads the net without loading it.
  const elements = flat.elements.map((e): FlatElement => (e.type === 'indicator' ? { ...e, type: 'probe', params: withDefaults(getDef('probe')!, {}) } : e));
  return { ...flat, elements: [...elements, ...extra] };
}

/**
 * The transistor drawing of one gate as a circuit of its own: the gate's input pins on the left
 * (ports A, B, …), its output Y on the right. For the parts bin and for tests.
 */
export function cellCircuit(type: GateType, inputs = 2): Circuit {
  const cell = cellFor(type, type === 'not' || type === 'buffer' || type === 'tristate' ? 1 : inputs);
  const layout = layoutOf(type, gateInputs(type, { inputs }));
  const ports: Record<string, Pt> = {};
  cell.inputs.forEach((name, i) => (ports[name] = [0, 3 + i * 2]));
  const height = layout.h + 4;
  const width = layout.w + 1;
  const placed = placeCell(layout, 'X', 0, 0, height, { inputs: ports, out: [width, Math.floor(height / 2)] });
  const components: Placed[] = [...placed.components];
  const wires: Wire[] = placed.wires.map((points) => ({ points }));
  cell.inputs.forEach((name, i) => components.push({ id: `in${name}`, type: 'port', x: 0, y: 3 + i * 2, params: { name, dir: 'in' } }));
  components.push({ id: 'outY', type: 'port', x: width, y: Math.floor(height / 2), params: { name: 'Y', dir: 'out' } });
  return { version: 1, title: `${type} (CMOS)`, components, wires, notes: placed.notes };
}

export type { FlatNetlist };
