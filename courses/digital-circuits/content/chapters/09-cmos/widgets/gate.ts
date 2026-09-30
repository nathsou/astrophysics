/**
 * From a compiled gate to a running circuit: draw its transistors with the same layout the abstraction
 * dial uses, and check every input row of the drawing on the switch-level engine.
 *
 * The check runs the *drawn* circuit (flattened exactly as the page does it), not the network the compiler
 * described, so it also proves that the drawing connects what the compiler meant.
 */
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import type { Circuit, Logic, Placed, Wire } from '$lib/sim/netlist/types';
import { L0, L1, LX, LZ } from '$lib/sim/netlist/types';
import { createSwitchEngine, type SwitchEngine, type StrengthKind } from '$lib/sim/switch';
import { conducts, type Net } from '$lib/sim/expand/cells';
import { registerFrame } from '$lib/sim/expand/frame';
import { layoutCell, placeCell, type CellLayout } from '$lib/sim/expand/layout';
import { rows, show, type Compiled } from './compiler';

export interface GateDrawing {
  /** What the engine simulates. */
  circuit: Circuit;
  /** The same plus the dashed outline of the gate: what to draw. Same nets, same numbering. */
  drawn: Circuit;
  /** Ids of the transistors, in the order of `transistorsOf(cell)`. */
  transistors: string[];
  /** Ids of the toggles (one per input, named after it) and of the output indicator. */
  toggles: string[];
  output: string;
  /** Height of the drawing in grid units (for sizing the figure). */
  width: number;
  height: number;
}

const OX = 8;

/**
 * Where to put the toggles. `placeCell` slides the drawing up and down inside its box to keep the input pins
 * off the rows that the gate's own leads and rails run along (a pin on such a row would touch them); it can
 * only do that if the box has room, so try taller boxes and other first rows until one works.
 */
function fit(layout: CellLayout, n: number): { h: number; first: number } {
  const used = new Set(layout.rows);
  for (let extra = 0; extra <= 12; extra++) {
    const h = Math.max(layout.h + 4, 4 * n + 2) + extra;
    const room = h - 4 - layout.h;
    for (let first = 3; first <= 9; first++) {
      const pins = Array.from({ length: n }, (_, i) => first + 4 * i);
      if (pins[n - 1]! > h - 1) continue;
      for (let d = 0; d <= room; d++) if (!pins.some((r) => used.has(r - 3 - d))) return { h, first };
    }
  }
  return { h: layout.h + 4, first: 3 };
}

/** The transistor drawing of a compiled gate with a toggle on every input and an indicator "Y" on the output. */
export function gateCircuit(c: Compiled): GateDrawing {
  registerFrame();
  const layout = layoutCell(c.cell);
  const n = c.inputs.length;
  const { h, first } = fit(layout, n);
  const width = layout.w + 1;
  const ports: Record<string, [number, number]> = {};
  c.inputs.forEach((v, i) => (ports[v] = [OX, first + 4 * i]));
  const out: [number, number] = [OX + width, Math.floor(h / 2)];
  const placed = placeCell(layout, 'gate', OX, 0, h, { inputs: ports, out });

  const components: Placed[] = [...placed.components];
  const wires: Wire[] = placed.wires.map((points) => ({ points }));
  c.inputs.forEach((v, i) => {
    const y = first + 4 * i;
    components.push({ id: v, type: 'toggle', x: 0, y });
    wires.push({ points: [[3, y], [OX, y]] });
  });
  components.push({ id: 'OUT', type: 'indicator', x: out[0] + 4, y: out[1], label: 'Y' });
  wires.push({ points: [out, [out[0] + 4, out[1]]] });
  const circuit: Circuit = { version: 1, title: `Y = ${show(c.expr)}`, engine: 'switch', components, wires, notes: placed.notes };
  const frame: Placed = { id: 'gate#outline', type: 'frame', x: OX, y: 0, params: { w: width, h, title: `Y = ${show(c.expr)}` } };
  return {
    circuit,
    drawn: { ...circuit, components: [frame, ...components] },
    transistors: placed.transistors,
    toggles: [...c.inputs],
    output: 'OUT',
    width: OX + width + 8,
    height: h,
  };
}

export interface RowResult {
  bits: number[];
  expected: number;
  /** What the switch-level engine settled to at the output: 0, 1, 2 (X) or 3 (Z). */
  got: Logic;
  strength: StrengthKind | undefined;
  /** Two drivers fought over the output (a path from the supply to ground). */
  contended: boolean;
  ok: boolean;
}

export interface Verification {
  ok: boolean;
  rows: RowResult[];
  /** In no row did the output float, go unknown or fight. */
  clean: boolean;
}

/** Run every input row through the switch-level engine and compare the output with the expression. */
export function verify(c: Compiled, drawing: GateDrawing = gateCircuit(c)): Verification {
  const flat = flatten(drawing.circuit);
  const engine: SwitchEngine = createSwitchEngine(flat);
  const outNet = flat.elements.find((e) => e.id === drawing.output)!.pins[0]!;
  const results: RowResult[] = rows(c).map((r) => {
    c.inputs.forEach((v, i) => engine.setParam(v, 'on', r.bits[i] === 1));
    engine.settle();
    const got = engine.logic(outNet);
    return {
      bits: r.bits,
      expected: r.expected,
      got,
      strength: engine.strengthKind(outNet),
      contended: engine.contended(outNet),
      ok: got === (r.expected ? L1 : L0),
    };
  });
  return { ok: results.every((r) => r.ok), rows: results, clean: results.every((r) => r.got !== LX && r.got !== LZ && !r.contended) };
}

/** Which of the main stage's two networks conduct for an input row: exactly one, in a static CMOS gate. */
export function mainStageConduction(c: Compiled, env: Record<string, number>): { up: boolean; down: boolean } {
  const value = (sig: string): number => {
    if (sig in env) return env[sig]!;
    if (sig.length === 2 && sig.endsWith('n') && sig[0]! in env) return 1 - env[sig[0]!]!;
    throw new Error(`no value for signal ${sig}`);
  };
  const net = (n: Net, p: boolean) => conducts(n, value, p);
  return { up: net(c.pun, true), down: net(c.pdn, false) };
}
