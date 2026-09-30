/**
 * By hand: the small device configured bit by bit. `HandDevice` wraps a `FabricConfig` with what the panes need
 * (immutable-style edits, the multiplexer inputs of a node, undo), a **goal** (make an output pad show a function of
 * some input pads, checked by simulating the decoded bitstream) and the **recovered logic view**: the bits decode
 * to a netlist of pads, LUTs and flip-flops that is laid out in layers, so "what does this bitstream do?" can be
 * answered by looking at it.
 */
import { getVFpga, NK, type VFpgaDevice } from '../../pld/devices/vfpga';
import { FabricConfig, padOffset, readSelect, type LcConfig } from '../../pld/devices/vfpga-config';
import { createDigitalEngine } from '../../sim/digital';
import { attachTestbench, decodeBitstream } from '../../pld/fpga/decode';
import { dependsOn, lutExpression, LUT_NAMES } from './lut';

export interface MuxChoice {
  /** The select code that picks it (input k − 1 has code k). */
  code: number;
  node: number;
  name: string;
  selected: boolean;
}

export class HandDevice {
  readonly cfg: FabricConfig;
  private readonly undoStack: Uint8Array[] = [];
  private readonly redoStack: Uint8Array[] = [];
  /** Changes with every edit (a cheap dependency for views). */
  version = 0;

  constructor(
    readonly device: VFpgaDevice = getVFpga('S'),
    bits?: Uint8Array,
  ) {
    this.cfg = new FabricConfig(device, bits ? bits.slice() : undefined);
  }

  get bits(): Uint8Array {
    return this.cfg.bits;
  }

  private edit(f: () => void): void {
    const before = this.cfg.bits.slice();
    f();
    if (before.every((b, i) => b === this.cfg.bits[i])) return;
    this.undoStack.push(before);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack.length = 0;
    this.version++;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.cfg.bits.slice());
    this.cfg.bits.set(prev);
    this.version++;
  }
  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.cfg.bits.slice());
    this.cfg.bits.set(next);
    this.version++;
  }

  /** Erases the whole configuration. */
  clear(): void {
    this.edit(() => this.cfg.bits.fill(0));
  }

  load(bits: Uint8Array): void {
    this.edit(() => this.cfg.bits.set(bits));
  }

  toggleLutBit(x: number, y: number, k: number, row: number): void {
    this.edit(() => {
      const c = this.cfg.lc(x, y, k);
      this.cfg.setLut(x, y, k, c.lut ^ (1 << row));
    });
  }

  setLut(x: number, y: number, k: number, truth: number): void {
    this.edit(() => this.cfg.setLut(x, y, k, truth));
  }

  setFlag(x: number, y: number, k: number, flag: Exclude<keyof LcConfig, 'lut'>, value: boolean | 0 | 1): void {
    this.edit(() => this.cfg.setLc(x, y, k, { [flag]: value } as Partial<LcConfig>));
  }

  setTileClock(x: number, y: number, global: number, falling = false): void {
    this.edit(() => this.cfg.setTileClock(x, y, global, falling));
  }

  setPad(pad: number | string, output: boolean, pullup?: boolean): void {
    this.edit(() => this.cfg.setPad(pad, { output, ...(pullup === undefined ? {} : { pullup }) }));
  }

  /** The inputs a multiplexer can choose from, with the one it has chosen. Empty for nodes without a multiplexer. */
  muxChoices(node: number): MuxChoice[] {
    const d = this.device;
    if (d.cfgOffset[node]! < 0) return [];
    const sel = readSelect(d, this.cfg.bits, node);
    const out: MuxChoice[] = [];
    for (let i = d.inStart[node]!; i < d.inStart[node + 1]!; i++) {
      const from = d.inList[i]!;
      out.push({ code: i - d.inStart[node]! + 1, node: from, name: d.nodeName(from), selected: sel.input === from });
    }
    return out;
  }

  /** Make `node` read `from` (or nothing, with −1). */
  select(node: number, from: number): void {
    this.edit(() => (from < 0 ? this.cfg.clear(node) : this.cfg.select(node, from)));
  }

  /** Connect two nodes along a free shortest path (what a router would do). Returns false when there is none. */
  autoRoute(from: number, to: number): boolean {
    let ok = true;
    this.edit(() => {
      try {
        this.cfg.route(from, to);
      } catch {
        ok = false;
      }
    });
    return ok;
  }

  flip(index: number): void {
    this.edit(() => this.cfg.flip(index));
  }

  /** Nodes whose multiplexer is configured, for drawing the routing. */
  usedNodes(): number[] {
    const d = this.device;
    const out: number[] = [];
    for (let n = 0; n < d.nodeCount; n++) if (d.cfgOffset[n]! >= 0 && readSelect(d, this.cfg.bits, n).code !== 0 && readSelect(d, this.cfg.bits, n).input >= 0) out.push(n);
    return out;
  }
}

// ── Goals ────────────────────────────────────────────────────────────────────────────────────────

export interface HandGoal {
  id: string;
  title: string;
  text: string;
  /** Input pads, and the output pad. */
  inputs: string[];
  output: string;
  /** The output for input levels. */
  expect: (inputs: boolean[]) => boolean;
  /** The logic cell the hint uses. */
  hint: string;
}

/** Make pad P2 show P0 XOR P1. */
export const XOR_GOAL: HandGoal = {
  id: 'xor',
  title: 'XOR two pins',
  text: 'Make pad P2 show P0 XOR P1: switch pins P0 and P1 and watch P2. You will need a LUT holding the XOR truth table, three routes (two into the LUT, one out of it) and a pad set to output.',
  inputs: ['P0', 'P1'],
  output: 'P2',
  expect: (v) => v[0] !== v[1],
  hint: 'A LUT of tile (1, 2) is next to the pads P0 and P1.',
};

export interface GoalCheck {
  ok: boolean;
  /** One line per input combination: the inputs, what the device gave, and what was wanted. */
  rows: { inputs: boolean[]; got: 0 | 1 | 'x' | 'z'; want: boolean; ok: boolean }[];
  /** What is wrong, when there is a plain reason ("pad P2 is not set to output"). */
  problems: string[];
}

/** Simulates the decoded bits for every input combination of a goal. */
export function checkGoal(dev: VFpgaDevice, bits: Uint8Array, goal: HandGoal): GoalCheck {
  const problems: string[] = [];
  const fab = decodeBitstream(dev, bits);
  const outNet = fab.fabric.padNets.get(goal.output);
  const inputPads = goal.inputs.filter((p) => fab.fabric.padNets.has(p));
  for (const p of goal.inputs) if (!fab.fabric.padNets.has(p)) problems.push(`nothing is connected to pad ${p} yet`);
  const outPadCfg = dev.pads.find((p) => p.name === goal.output);
  if (outPadCfg && !bits[padOffset(dev, outPadCfg.index)]) problems.push(`pad ${goal.output} is set to input, not output`);
  else if (outNet === undefined) problems.push(`pad ${goal.output} is not connected: connect the LUT's output to it`);
  const rows: GoalCheck['rows'] = [];
  if (outNet === undefined) {
    for (let v = 0; v < 1 << goal.inputs.length; v++) {
      const inputs = goal.inputs.map((_, i) => ((v >> i) & 1) === 1);
      rows.push({ inputs, got: 'x', want: goal.expect(inputs), ok: false });
    }
    return { ok: false, rows, problems };
  }
  attachTestbench(fab, inputPads);
  const eng = createDigitalEngine(fab, { powerUp: 'x' });
  for (let v = 0; v < 1 << goal.inputs.length; v++) {
    const inputs = goal.inputs.map((_, i) => ((v >> i) & 1) === 1);
    goal.inputs.forEach((p, i) => inputPads.includes(p) && eng.setParam(`TB:${p}`, 'on', inputs[i]!));
    eng.advance(200e-9);
    const l = eng.logic(fab.alias?.[outNet] ?? outNet);
    const got = l === 0 ? 0 : l === 1 ? 1 : l === 3 ? 'z' : 'x';
    const want = goal.expect(inputs);
    rows.push({ inputs, got, want, ok: got === (want ? 1 : 0) });
  }
  if (rows.some((r) => r.got === 'z')) problems.push(`pad ${goal.output} floats for some inputs: something in its route is not connected`);
  if (rows.some((r) => r.got === 'x') && !problems.length) problems.push('the output is unknown (X) for some inputs: an input of the LUT is not connected');
  return { ok: rows.every((r) => r.ok), rows, problems };
}

/** A configuration that meets the XOR goal: the worked answer the widget can show. */
export function xorSolution(dev: VFpgaDevice = getVFpga('S')): Uint8Array {
  const c = new FabricConfig(dev);
  const pad = (name: string) => dev.pads.find((p) => p.name === name)!.index;
  c.setPad('P2', { output: true });
  c.setLut(1, 2, 0, 0x6666);
  c.route(dev.padIn(pad('P0')), dev.lcIn(1, 2, 0, 0));
  c.route(dev.padIn(pad('P1')), dev.lcIn(1, 2, 0, 1));
  c.route(dev.lcOut(1, 2, 0), dev.padOut(pad('P2')));
  return c.bits;
}

// ── The recovered logic view ─────────────────────────────────────────────────────────────────────

export interface RecNode {
  id: string;
  kind: 'pad-in' | 'pad-out' | 'lut' | 'const';
  label: string;
  /** What a LUT computes, in terms of its drivers' names. */
  expression?: string;
  truth?: number;
  ff?: boolean;
  /** Driver (index in `nodes`) of each input, −1 where nothing is connected; pad-out has one input, LUTs four. */
  inputs: number[];
  /** Which inputs the LUT depends on. */
  used: number[];
  x?: number;
  y?: number;
  k?: number;
}

export interface Recovered {
  nodes: RecNode[];
  /** Combinational loops found in the recovered netlist (as node labels). */
  loops: string[];
}

/** Decodes a configuration to the netlist it implements: pads, LUTs (with their flip-flops) and constants. */
export function recover(dev: VFpgaDevice, bits: Uint8Array): Recovered {
  const fab = decodeBitstream(dev, bits);
  // Nets joined by routing multiplexers are one signal.
  const parent = new Map<number, number>();
  const find = (n: number): number => {
    let r = n;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of fab.elements) if (e.type === 'fpga-mux') union(e.pins[e.pinNames.indexOf('A')]!, e.pins[e.pinNames.indexOf('Y')]!);
  const pin = (e: (typeof fab.elements)[number], name: string): number => {
    const i = e.pinNames.indexOf(name);
    return i < 0 ? -1 : find(e.pins[i]!);
  };

  const nodes: RecNode[] = [];
  const driver = new Map<number, number>();
  const add = (n: RecNode, outNet: number) => {
    nodes.push(n);
    if (outNet >= 0) driver.set(outNet, nodes.length - 1);
    return nodes.length - 1;
  };
  const luts: { i: number; el: (typeof fab.elements)[number]; ff?: (typeof fab.elements)[number] }[] = [];
  for (const e of fab.elements) {
    if (e.type === 'fpga-pad') {
      const name = e.id.replace('PAD/', '');
      if (e.params.mode === 'in') add({ id: e.id, kind: 'pad-in', label: name, inputs: [], used: [] }, pin(e, 'IN'));
      else add({ id: e.id, kind: 'pad-out', label: name, inputs: [-1], used: [0] }, -1);
    } else if (e.type === 'const') {
      add({ id: e.id, kind: 'const', label: String(e.params.value), inputs: [], used: [] }, pin(e, 'Y'));
    }
  }
  for (const e of fab.elements) {
    if (e.type !== 'fpga-lut4') continue;
    const cell = e.id.replace('/lut', '');
    const ffEl = fab.elements.find((f) => f.id === `${cell}/ff`);
    const truth = Number(e.params.truth) & 0xffff;
    const [x, y, k] = /LC\((\d+),(\d+),(\d+)\)/.exec(cell)!.slice(1).map(Number) as [number, number, number];
    const i = add({ id: cell, kind: 'lut', label: cell, truth, ff: !!ffEl, inputs: [-1, -1, -1, -1], used: dependsOn(truth), x, y, k }, ffEl ? pin(ffEl, 'Q') : pin(e, 'O'));
    luts.push({ i, el: e, ff: ffEl });
  }
  for (const l of luts) {
    for (let p = 0; p < 4; p++) {
      const net = pin(l.el, `I${p}`);
      nodes[l.i]!.inputs[p] = driver.get(net) ?? -1;
    }
  }
  for (const e of fab.elements) {
    if (e.type === 'fpga-pad' && e.params.mode === 'out') {
      const n = nodes.find((x) => x.id === e.id)!;
      n.inputs[0] = driver.get(pin(e, 'OUT')) ?? -1;
    }
  }
  // Names: a LUT's expression in terms of what drives it.
  const nameOf = (i: number): string => (i < 0 ? '?' : nodes[i]!.kind === 'lut' ? `${nodes[i]!.label.replace('LC', '')}${nodes[i]!.ff ? '.q' : ''}` : nodes[i]!.label);
  for (const n of nodes) {
    if (n.kind !== 'lut') continue;
    n.expression = lutExpression(n.truth!, [0, 1, 2, 3].map((p) => (n.inputs[p]! >= 0 ? nameOf(n.inputs[p]!) : LUT_NAMES[p]!)));
  }
  // Loops among combinational LUTs (a flip-flop breaks a loop).
  const loops: string[] = [];
  const state = new Map<number, 1 | 2>();
  const visit = (i: number, stack: number[]) => {
    if (state.get(i) === 2) return;
    if (state.get(i) === 1) {
      const at = stack.indexOf(i);
      loops.push(stack.slice(at).map((j) => nodes[j]!.label).join(' → '));
      return;
    }
    state.set(i, 1);
    const n = nodes[i]!;
    if (n.kind === 'lut' && !n.ff) for (const p of n.used) if (n.inputs[p]! >= 0) visit(n.inputs[p]!, [...stack, i]);
    state.set(i, 2);
  };
  for (let i = 0; i < nodes.length; i++) visit(i, []);
  return { nodes, loops: [...new Set(loops)] };
}

export interface RecLayout {
  /** Column of each node and its row within the column. */
  col: number[];
  row: number[];
  columns: number;
  rows: number;
}

/** Layers by logic depth: pads on the left, the outputs on the right, barycentre ordering within a column. */
export function layoutRecovered(rec: Recovered): RecLayout {
  const n = rec.nodes.length;
  const depth = new Array<number>(n).fill(-1);
  const level = (i: number, seen: Set<number>): number => {
    if (depth[i]! >= 0) return depth[i]!;
    const node = rec.nodes[i]!;
    if (node.kind === 'pad-in' || node.kind === 'const') return (depth[i] = 0);
    if (seen.has(i)) return 0;
    seen.add(i);
    let d = 0;
    const ins = node.kind === 'lut' ? node.used.map((p) => node.inputs[p]!) : node.inputs;
    for (const j of ins) if (j >= 0) d = Math.max(d, level(j, seen) + 1);
    seen.delete(i);
    return (depth[i] = node.kind === 'lut' && node.ff && d === 0 ? 1 : d || 1);
  };
  for (let i = 0; i < n; i++) level(i, new Set());
  let columns = Math.max(0, ...depth) + 1;
  // Output pads in the last column.
  rec.nodes.forEach((node, i) => {
    if (node.kind === 'pad-out') depth[i] = columns - 1;
  });
  if (rec.nodes.some((x) => x.kind === 'pad-out') && rec.nodes.some((x, i) => x.kind !== 'pad-out' && depth[i] === columns - 1)) {
    columns++;
    rec.nodes.forEach((node, i) => {
      if (node.kind === 'pad-out') depth[i] = columns - 1;
    });
  }
  const cols: number[][] = Array.from({ length: columns }, () => []);
  depth.forEach((d, i) => cols[d]!.push(i));
  const row = new Array<number>(n).fill(0);
  cols.forEach((c) => c.forEach((i, r) => (row[i] = r)));
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let c = 1; c < columns; c++) {
      const bary = (i: number) => {
        const node = rec.nodes[i]!;
        const ins = node.inputs.filter((j) => j >= 0);
        return ins.length ? ins.reduce((s, j) => s + row[j]!, 0) / ins.length : row[i]!;
      };
      cols[c]!.sort((a, b) => bary(a) - bary(b) || a - b);
      cols[c]!.forEach((i, r) => (row[i] = r));
    }
  }
  return { col: depth, row, columns, rows: Math.max(1, ...cols.map((c) => c.length)) };
}

export { NK };
