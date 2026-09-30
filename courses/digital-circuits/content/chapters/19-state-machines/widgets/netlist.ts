/**
 * The synthesised machine as a circuit: the AND–OR logic of `synth.ts` drawn as gates, with a D flip-flop for
 * every state bit. It runs on the digital engine (switches for the inputs, a button for the clock, lamps for the
 * outputs and the state bits), and, with `ports`, it is a circuit an exercise checker can test against a table.
 *
 * The gates are laid out by Chapter 11's layered layout as one combinational network whose inputs are the
 * state bits and the machine's inputs, and whose outputs are the flip-flops' D inputs and the machine's outputs.
 * The state bits and D inputs are then closed into loops with *net labels* (two labels with the same name are one
 * wire) instead of wires that would have to run back across the whole drawing.
 */
import { getVar, ONE, ZERO } from '$lib/pld/twolevel';
import type { Circuit, Placed, Wire } from '$lib/sim/netlist/types';
import { layoutDag, type Dag, type DagGate } from '../../11-boolean-algebra/widgets/layout';
import type { Synthesis } from './synth';

/** Gates of at most this many inputs (the digital catalog allows 8). */
const MAX_FAN_IN = 6;

/** The combinational part as a gate network. Outputs are named as `Synthesis.functions`. */
export function toDag(s: Synthesis): Dag {
  const n = s.vars.length;
  const gates: DagGate[] = [];
  const nots = new Map<number, string>();
  const literal = (v: number, neg: boolean): string => {
    if (!neg) return s.vars[v]!;
    let id = nots.get(v);
    if (!id) {
      id = `not_${s.vars[v]}`;
      nots.set(v, id);
      gates.push({ id, kind: 'not', inputs: [s.vars[v]!] });
    }
    return id;
  };
  /** AND or OR of signals, in a tree when there are too many for one gate. */
  const tree = (kind: 'and' | 'or', id: string, signals: string[]): string => {
    let level = signals;
    let k = 0;
    while (level.length > MAX_FAN_IN) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += MAX_FAN_IN) {
        const chunk = level.slice(i, i + MAX_FAN_IN);
        if (chunk.length === 1) next.push(chunk[0]!);
        else {
          const g = `${id}_${k++}`;
          gates.push({ id: g, kind, inputs: chunk });
          next.push(g);
        }
      }
      level = next;
    }
    gates.push({ id, kind, inputs: level });
    return id;
  };
  // One signal per product term.
  const termSignal = new Map<number, string>();
  s.logic.terms.forEach((t, i) => {
    const lits: string[] = [];
    for (let v = 0; v < n; v++) {
      const x = getVar(t.cube, v);
      if (x === ONE) lits.push(literal(v, false));
      else if (x === ZERO) lits.push(literal(v, true));
    }
    termSignal.set(i, lits.length === 0 ? '1' : lits.length === 1 ? lits[0]! : tree('and', `and${i}`, lits));
  });
  const outputs = s.functions.map((name, j) => {
    const sigs = [...new Set(s.logic.terms.flatMap((t, i) => (t.outputs.includes(j) ? [termSignal.get(i)!] : [])))];
    const signal = sigs.length === 0 ? '0' : sigs.includes('1') ? '1' : sigs.length === 1 ? sigs[0]! : tree('or', `or${j}`, sigs);
    return { name, signal };
  });
  return { inputs: s.vars, gates, outputs };
}

export interface CircuitOptions {
  title?: string;
  /** Ports for the inputs, the clock and the outputs (an exercise's answer) instead of switches, a button and lamps. */
  ports?: boolean;
}

/** The whole machine: gates, flip-flops, clock, inputs and outputs. */
export function toCircuit(s: Synthesis, opts: CircuitOptions = {}): Circuit {
  const dag = toDag(s);
  const ports = !!opts.ports;
  const base = layoutDag(dag, { title: opts.title ?? s.fsm.title, ports });
  const k = s.codes.bits;
  const internal = new Set<string>([...s.codes.names, ...s.codes.names.map((q) => `D_${q}`)]);
  const components: Placed[] = [];
  const wires: Wire[] = base.wires.map((w) => ({ points: w.points.map((p) => [...p] as [number, number]) }));
  const label = (id: string, x: number, y: number, name: string, flip = false): Placed => ({ id, type: 'label', x, y, ...(flip ? { flip: true } : {}), params: { name }, label: '' });

  for (const c of base.components) {
    // The state bits come from the flip-flops, not from switches; the D inputs go to them, not to lamps.
    const inName = c.id.startsWith('in_') ? c.id.slice(3) : ports && c.type === 'port' && c.params?.dir === 'in' ? c.id : undefined;
    const outName = c.id.startsWith('out_') ? c.id.slice(4) : ports && c.type === 'port' && c.params?.dir === 'out' ? c.id : undefined;
    if (inName !== undefined && internal.has(inName)) {
      // A toggle's pin is 3 units right of its position; a port's pin is at its position.
      components.push(label(`Lq_${inName}`, c.type === 'toggle' ? c.x + 3 : c.x, c.y, inName, true));
    } else if (outName !== undefined && internal.has(outName)) {
      components.push(label(`Ld_${outName}`, c.x, c.y, outName));
    } else components.push(c);
  }

  // Flip-flops to the right of the logic, one row each.
  let maxX = 0;
  let minY = Infinity;
  for (const c of base.components) {
    maxX = Math.max(maxX, c.x + 8);
    minY = Math.min(minY, c.y);
  }
  for (const w of base.wires) for (const [x, y] of w.points) {
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
  }
  const x0 = maxX + 6;
  const y0 = Number.isFinite(minY) ? minY : 0;
  const resetCode = s.codes.code[s.fsm.states[0]!.name]!;
  s.codes.names.forEach((q, i) => {
    const y = y0 + i * 8;
    const bit = (resetCode >> (k - 1 - i)) & 1;
    components.push({ id: `FF_${q}`, type: 'dff', x: x0, y, params: { init: bit ? '1' : '0' }, label: q.replace(/^Q_/, '') });
    components.push(label(`Lfd_${q}`, x0 - 2, y, `D_${q}`, true));
    components.push(label(`Lfc_${q}`, x0 - 2, y + 2, 'CLK', true));
    wires.push({ points: [[x0 - 2, y], [x0, y]] }, { points: [[x0 - 2, y + 2], [x0, y + 2]] });
    // Q: to a lamp, and (through a label) back to the logic.
    components.push({ id: `Q_lamp_${q}`, type: 'indicator', x: x0 + 10, y, params: { color: 'amber' }, label: q.replace(/^Q_/, '') });
    components.push(label(`Lfq_${q}`, x0 + 8, y - 2, q));
    wires.push({ points: [[x0 + 6, y], [x0 + 10, y]] }, { points: [[x0 + 8, y - 2], [x0 + 8, y]] });
  });
  // The clock.
  const yc = y0 + k * 8 + 1;
  if (ports) components.push({ id: 'CLK', type: 'port', x: x0 - 8, y: yc, params: { name: 'CLK', dir: 'in' }, label: '' });
  else components.push({ id: 'CLK', type: 'button', x: x0 - 11, y: yc, label: 'clock' });
  wires.push({ points: [[x0 - 8, yc], [x0 - 6, yc]] });
  components.push(label('Lclk', x0 - 6, yc, 'CLK'));
  return { version: 1, title: opts.title ?? s.fsm.title, engine: 'digital', components, wires };
}
