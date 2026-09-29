/**
 * Everything static about a drawn circuit, computed once per circuit: connectivity, component
 * geometry and labels, wire paths, junctions, open pins, the current-flow graph and the view box.
 * The Schematic component renders this and then only updates colours and dots.
 */
import type { ComponentDef, Circuit, Connectivity, Params, PinDef, Placed } from '../sim/netlist/types';
import type { FlatNetlist } from '../sim/netlist/types';
import { connect, defOf, globalName, placedPins, subResolver, type SubResolver } from '../sim/netlist/connect';
import { boundsOf, pinsOf, withDefaults } from '../sim/netlist/catalog';
import { buildWireGraph, type WireGraph } from './currents';
import { componentTransform, G, placeLabel, polylineMidpoint, roundedPath, scaleBox, textWidth, transformBox, unionBox, type Box } from './geometry';
import { mainValue } from './format';
import { voltageRange } from './colour';

/** How a part reacts to the reader: a click flips it, or it is held down. */
export type Interaction = { kind: 'toggle'; key: string } | { kind: 'hold'; key: string } | { kind: 'throw'; key: string };

export const INTERACTIONS: Record<string, Interaction> = {
  toggle: { kind: 'toggle', key: 'on' },
  switch: { kind: 'toggle', key: 'closed' },
  spdt: { kind: 'throw', key: 'throw' },
  button: { kind: 'hold', key: 'pressed' },
  pushbutton: { kind: 'hold', key: 'pressed' },
};

/** Components drawn without a default label (they carry their own text, or gates in logic diagrams). */
const UNLABELLED_CATEGORIES = new Set(['wiring', 'gate']);
const WIRING = new Set(['ground', 'label', 'port']);

export const LABEL_SIZE = 10;
const LINE = LABEL_SIZE * 1.25;

export interface ModelLabel {
  id: string;
  value?: string;
  /** Anchor (px) of the first line; a second line (the value) sits LINE below when `stacked`. */
  x: number;
  y: number;
  stacked: boolean;
  box: Box;
}

export interface ModelComponent {
  c: Placed;
  def: ComponentDef;
  params: Params;
  pins: PinDef[];
  /** Net of each pin (top-level numbering). */
  pinNets: number[];
  /** Pin positions (grid). */
  pinPos: [number, number][];
  /** Bounds in the component's own px (for hit areas and focus rings). */
  local: Box;
  /** Bounds on the schematic (px). */
  box: Box;
  transform: string;
  interaction?: Interaction;
  label?: ModelLabel;
  /** A subcircuit block: its pins' currents are the sums over the elements inside. */
  isSub: boolean;
}

export interface ModelWire {
  d: string;
  net: number;
  segments: [[number, number], [number, number]][];
}

export interface ModelEdge {
  d: string;
  net: number;
  mid: { x: number; y: number; angle: number };
  length: number;
}

export interface SchematicModel {
  conn: Connectivity;
  comps: ModelComponent[];
  wires: ModelWire[];
  junctions: { x: number; y: number; net: number }[];
  open: { x: number; y: number }[];
  notes: { x: number; y: number; lines: string[] }[];
  graph: WireGraph;
  edges: ModelEdge[];
  viewBox: Box;
  voltageRange: number;
  resolve: SubResolver;
}

const px = (p: [number, number]): [number, number] => [p[0] * G, p[1] * G];

export function buildModel(circuit: Circuit, parts?: SubResolver): SchematicModel {
  const resolve = subResolver(circuit, undefined, parts);
  const conn = connect(circuit, resolve);

  const comps: ModelComponent[] = circuit.components.map((c) => {
    const def = defOf(c, resolve);
    const params = withDefaults(def, c.params);
    const pins = pinsOf(def, params);
    const pp = placedPins(c, resolve);
    const b = boundsOf(def, params);
    const local = scaleBox(b, G);
    return {
      c,
      def,
      params,
      pins,
      pinNets: pp.map((p) => conn.pinNet.get(`${c.id}.${p.pin}`) ?? -1),
      pinPos: pp.map((p) => [p.x, p.y] as [number, number]),
      local,
      box: scaleBox(transformBox(b, c), G),
      transform: componentTransform(c),
      interaction: INTERACTIONS[c.type],
      isSub: c.type.startsWith('sub:') || c.type.startsWith('part:'),
    };
  });

  const wires: ModelWire[] = circuit.wires.map((w, i) => ({
    d: roundedPath(w.points),
    net: conn.wireNet[i] ?? -1,
    segments: w.points.slice(1).map((p, j) => [px(w.points[j]!), px(p)] as [[number, number], [number, number]]),
  }));

  // Junction dots take the colour of their net.
  const netAt = new Map<string, number>();
  comps.forEach((m) => m.pinPos.forEach((p, k) => netAt.set(`${p[0]},${p[1]}`, m.pinNets[k]!)));
  circuit.wires.forEach((w, i) => w.points.forEach((p) => netAt.set(`${p[0]},${p[1]}`, conn.wireNet[i]!)));
  const junctions = conn.junctions.map(([x, y]) => ({ x: x * G, y: y * G, net: netAt.get(`${x},${y}`) ?? -1 }));

  const unconnected = new Set(conn.unconnected);
  const open: { x: number; y: number }[] = [];
  comps.forEach((m) =>
    m.pins.forEach((p, k) => {
      if (unconnected.has(`${m.c.id}.${p.name}`)) open.push({ x: m.pinPos[k]![0] * G, y: m.pinPos[k]![1] * G });
    }),
  );

  const notes = (circuit.notes ?? []).map((n) => ({ x: n.x * G, y: n.y * G, lines: n.text.split('\n') }));
  const noteBoxes: Box[] = notes.map((n) => ({
    x0: n.x,
    y0: n.y - 10,
    x1: n.x + Math.max(...n.lines.map((l) => l.length)) * 6.2,
    y1: n.y - 10 + n.lines.length * 14,
  }));

  // Labels: placed in order, each avoiding parts, wires, notes and the labels already placed.
  const segments = wires.flatMap((w) => w.segments);
  const placed: Box[] = [];
  for (const m of comps) {
    const text = labelText(m);
    if (!text) continue;
    const wide = m.box.x1 - m.box.x0 >= m.box.y1 - m.box.y0;
    const stacked = !wide && !!text.value;
    const w = stacked ? Math.max(textWidth(text.id, LABEL_SIZE), textWidth(text.value!, LABEL_SIZE)) : textWidth(text.value ? `${text.id} ${text.value}` : text.id, LABEL_SIZE);
    const h = stacked ? LINE * 2 : LINE;
    const obstacles = [...comps.filter((o) => o !== m).map((o) => o.box), ...placed, ...noteBoxes];
    const at = placeLabel(m.box, w, h, obstacles, segments);
    placed.push(at.box);
    m.label = { ...text, x: at.box.x0, y: at.box.y0 + LINE * 0.78, stacked, box: at.box };
  }

  // Current-flow graph; ground symbols, labels and ports are where a net's imbalance goes.
  const pinRefs = comps.flatMap((m) => m.pins.map((p, k) => ({ key: `${m.c.id}.${p.name}`, x: m.pinPos[k]![0], y: m.pinPos[k]![1], net: m.pinNets[k]! })));
  const roots = new Set(comps.filter((m) => WIRING.has(m.c.type) || globalName(m.c)).flatMap((m) => m.pins.map((p) => `${m.c.id}.${p.name}`)));
  const graph = buildWireGraph(circuit.wires, conn.wireNet, pinRefs, roots);
  const edges: ModelEdge[] = graph.edges.map((e) => ({
    d: roundedPath(e.points),
    net: e.net,
    mid: polylineMidpoint(e.points),
    length: e.points.slice(1).reduce((s, p, j) => s + Math.abs(p[0] - e.points[j]![0]) + Math.abs(p[1] - e.points[j]![1]), 0),
  }));

  const boxes: Box[] = [
    ...comps.map((m) => m.box),
    ...placed,
    ...noteBoxes,
    ...circuit.wires.flatMap((w) => w.points.map(([x, y]) => ({ x0: x * G, y0: y * G, x1: x * G, y1: y * G }))),
  ];
  const u = unionBox(boxes) ?? { x0: 0, y0: 0, x1: 10 * G, y1: 5 * G };
  const pad = G;
  const viewBox = { x0: Math.floor(u.x0 - pad), y0: Math.floor(u.y0 - pad), x1: Math.ceil(u.x1 + pad), y1: Math.ceil(u.y1 + pad) };

  return { conn, comps, wires, junctions, open, notes, graph, edges, viewBox, voltageRange: voltageRange(circuit), resolve };
}

function labelText(m: ModelComponent): { id: string; value?: string } | undefined {
  if (m.c.label !== undefined) return m.c.label === '' ? undefined : { id: m.c.label };
  if (UNLABELLED_CATEGORIES.has(m.def.category)) return undefined;
  if (m.c.type === 'probe') return { id: String(m.params.name || m.c.id) };
  return { id: m.c.id, value: mainValue(m.c.type, m.params) };
}

/**
 * Where each graph pin's current comes from in the engine: the element and pin index for ordinary
 * parts, every inside element touching the pin's net for subcircuit blocks, nothing for pure
 * wiring. Aligned with model.graph.pins.
 */
export function pinCurrentSources(model: SchematicModel, flat: FlatNetlist): { id: string; pin: number }[][] {
  const byKey = new Map<string, { m: ModelComponent; k: number }>();
  for (const m of model.comps) m.pins.forEach((p, k) => byKey.set(`${m.c.id}.${p.name}`, { m, k }));
  return model.graph.pins.map((gp) => {
    const hit = byKey.get(gp.key);
    if (!hit || WIRING.has(hit.m.c.type)) return [];
    if (!hit.m.isSub) return [{ id: hit.m.c.id, pin: hit.k }];
    const net = hit.m.pinNets[hit.k]!;
    const prefix = `${hit.m.c.id}/`;
    const out: { id: string; pin: number }[] = [];
    for (const e of flat.elements) if (e.id.startsWith(prefix)) e.pins.forEach((n, k) => n === net && out.push({ id: e.id, pin: k }));
    return out;
  });
}
