/**
 * The circuit model shared by every engine, the bench, the Device Studio and DCL.
 *
 * Two forms:
 *  - a **Circuit** is what people draw: placed components and wires on a grid, possibly using
 *    subcircuits. It is what chapters commit as `circuits/*.json` and what the bench edits.
 *  - a **FlatNetlist** is what engines simulate: elements whose pins are connected to numbered
 *    nets, with subcircuits expanded. `connect.ts` and `flatten.ts` turn the first into the second.
 *
 * Geometry is in grid units. One grid unit is the pin pitch of the smallest symbols; the renderer
 * decides how many pixels it is (GRID_PX by default).
 */

export const GRID_PX = 12;

export type Rot = 0 | 90 | 180 | 270;
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;
export type EngineKind = 'analog' | 'switch' | 'digital';

/** A component placed on the grid. */
export interface Placed {
  /** Unique within its circuit, e.g. "R1", "U3". Shown as the default label. */
  id: string;
  /** Catalog key, e.g. "resistor", "nand", "relay"; or "sub:<name>" for a subcircuit. */
  type: string;
  /** Grid position of the component's origin (its (0, 0) in catalog coordinates). */
  x: number;
  y: number;
  /** Rotation, clockwise, applied after `flip`. */
  rot?: Rot;
  /** Mirror left–right (x → −x) before rotating. */
  flip?: boolean;
  /** Parameter values; missing ones take the catalog defaults. */
  params?: Params;
  /** Text shown next to the symbol; defaults to the id and main value. `""` hides it. */
  label?: string;
}

/** A wire: a polyline through grid points. Consecutive points must share an x or a y. */
export interface Wire {
  points: [number, number][];
}

/** A text annotation on the schematic (not electrical). */
export interface Note {
  x: number;
  y: number;
  text: string;
}

export interface Circuit {
  version: 1;
  title?: string;
  /** Which engine simulates this circuit by default. */
  engine?: EngineKind;
  components: Placed[];
  wires: Wire[];
  notes?: Note[];
  /** Subcircuits used by components of type "sub:<name>". */
  subcircuits?: Record<string, Circuit>;
}

/** Pin of a catalog component, at rotation 0 and without flip, relative to the origin. */
export interface PinDef {
  name: string;
  x: number;
  y: number;
  /** Direction for logic components; analog pins are 'io'. */
  dir?: 'in' | 'out' | 'io';
}

export interface ParamDef {
  key: string;
  label: string;
  kind: 'number' | 'string' | 'boolean' | 'enum';
  default: ParamValue;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Logarithmic slider (resistances, capacitances, frequencies). */
  log?: boolean;
  options?: string[];
}

export type Category =
  | 'wiring'
  | 'source'
  | 'passive'
  | 'switch'
  | 'electromechanical'
  | 'semiconductor'
  | 'gate'
  | 'sequential'
  | 'block'
  | 'io'
  | 'meter';

/**
 * A catalog entry: geometry and parameters only. Behaviour lives in the engines
 * (`analog/models`, `digital/models`, `switch/models`), drawing in `bench/symbols`, each keyed by
 * `type`. This keeps the model free of rendering and the engines free of each other.
 */
export interface ComponentDef {
  type: string;
  name: string;
  category: Category;
  /** Pins, possibly depending on parameters (e.g. the number of gate inputs). */
  pins: PinDef[] | ((params: Params) => PinDef[]);
  /** Bounding box at rotation 0 (grid units), used for hit-testing and layout. */
  bounds: { x0: number; y0: number; x1: number; y1: number } | ((params: Params) => { x0: number; y0: number; x1: number; y1: number });
  params?: ParamDef[];
  /** Engines that can simulate this component. */
  engines: EngineKind[];
  /** Short description for the bench palette and hover cards. */
  description?: string;
}

/** An element of a flat netlist. */
export interface FlatElement {
  /** Hierarchical id: "U1/X2/R3" for R3 inside X2 inside U1. */
  id: string;
  type: string;
  /** Complete parameters (catalog defaults filled in). */
  params: Params;
  /** Net index of each pin, in the order of the catalog's pin list. */
  pins: number[];
  /** Pin names, aligned with `pins`. */
  pinNames: string[];
}

export interface FlatNetlist {
  netCount: number;
  /** Human names of nets where known (labels, ports, ground), else undefined. */
  netNames: (string | undefined)[];
  elements: FlatElement[];
  /** The ground net (0 V reference), if any element or label defines one. */
  ground?: number;
}

/** Where each drawn thing ended up: used by the renderer to colour wires and pins by net. */
export interface Connectivity {
  netCount: number;
  netNames: (string | undefined)[];
  /** Net of each pin, keyed "componentId.pinName". */
  pinNet: Map<string, number>;
  /** Net of each wire (wires are connected along their whole length). */
  wireNet: number[];
  /** Grid points where three or more wire ends/pins meet on a net (drawn as junction dots). */
  junctions: [number, number][];
  /** Pins not connected to anything else (drawn as open circles; engines treat them as floating). */
  unconnected: string[];
}

/** Logic values of the digital and switch-level engines. */
export const L0 = 0;
export const L1 = 1;
/** Unknown: uninitialised or conflicting. */
export const LX = 2;
/** High impedance: nothing drives the net. */
export const LZ = 3;
export type Logic = 0 | 1 | 2 | 3;
