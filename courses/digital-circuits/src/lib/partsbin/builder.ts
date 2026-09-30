/**
 * A small circuit builder with automatic layout, for the parts bin's reference implementations (and
 * for tests). You describe a circuit by nets and parts; `build()` places the parts in columns by logic
 * depth, routes the wires and returns an ordinary, drawable `Circuit`.
 *
 *   const b = new CircuitBuilder('Half adder');
 *   b.input('A'); b.input('B');
 *   b.gate('xor', ['A', 'B'], 'S');
 *   b.gate('and', ['A', 'B'], 'C');
 *   b.output('S'); b.output('C');
 *   const circuit = b.build();
 *
 * Nets are named by strings. A net all of whose sinks are in the next column is drawn with wires
 * (one channel per net, arranged so that no two different nets touch); any other net (a long
 * connection, or feedback) is drawn with net labels at the source and at each sink.
 */
import type { Circuit, Params, Placed, Wire } from '../sim/netlist/types';
import { defOf, placedPins, subResolver, type SubResolver } from '../sim/netlist/connect';
import { boundsOf, withDefaults } from '../sim/netlist/catalog';
import { textWidth } from '../bench/geometry';
import { simplify } from '../bench/geometry';

interface Node {
  id: string;
  type: string;
  params?: Params;
  /** pin name → net name */
  pins: Record<string, string>;
  role: 'in' | 'out' | 'comp';
  level: number;
  x: number;
  y: number;
  flip?: boolean;
  /** Pin offsets relative to the origin (pins of the unrotated component). */
  pinDefs: { name: string; dx: number; dy: number; dir: 'in' | 'out' }[];
  box: { x0: number; y0: number; x1: number; y1: number };
}

type Pt = [number, number];

export class CircuitBuilder {
  private readonly nodes: Node[] = [];
  private counter = 0;
  private auto = 0;
  private readonly resolve: SubResolver | undefined;

  constructor(
    readonly title: string,
    options: { parts?: SubResolver } = {},
  ) {
    this.resolve = options.parts ? subResolver({ version: 1, components: [], wires: [] }, undefined, options.parts) : undefined;
  }

  /** A fresh, unused net name. */
  net(prefix = 'n'): string {
    return `${prefix}${++this.auto}`;
  }

  /** A subcircuit input (an input port). The net has the same name. */
  input(name: string): string {
    this.addNode({ id: name, type: 'port', params: { name, dir: 'in' }, pins: { p: name }, role: 'in' });
    return name;
  }

  /** A subcircuit output (an output port) reading `net` (default: the net of the same name). */
  output(name: string, net = name): void {
    this.addNode({ id: `${name}`, type: 'port', params: { name, dir: 'out' }, pins: { p: net }, role: 'out' });
  }

  /** Inputs `prefix0 … prefix(n-1)`. */
  inputs(prefix: string, n: number): string[] {
    return Array.from({ length: n }, (_, i) => this.input(`${prefix}${i}`));
  }

  /** A constant 0 or 1. */
  constant(value: 0 | 1, out = this.net('k')): string {
    this.comp('const', { Y: out }, { value });
    return out;
  }

  /** A gate (`and`, `or`, `nand`, `nor`, `xor`, `xnor`, `not`, `buffer`): inputs in order, output net returned. */
  gate(type: string, ins: string[], out = this.net(), params: Params = {}): string {
    const names = ins.map((_, i) => String.fromCharCode(65 + i));
    const pins: Record<string, string> = { Y: out };
    ins.forEach((n, i) => (pins[names[i]!] = n));
    const p: Params = { ...params };
    if (type !== 'not' && type !== 'buffer' && ins.length !== 2) p.inputs = ins.length;
    this.comp(type, pins, p);
    return out;
  }

  /** Any component or part (`part:full-adder`, `dff`, `mux`, …) with its pins connected to nets by name. */
  comp(type: string, pins: Record<string, string>, params?: Params): string {
    return this.addNode({ id: `U${++this.counter}`, type, params, pins, role: 'comp' });
  }

  /** A parts-bin part by id. */
  part(id: string, pins: Record<string, string>): string {
    return this.comp(`part:${id}`, pins);
  }

  private addNode(n: Pick<Node, 'id' | 'type' | 'params' | 'pins' | 'role'>): string {
    if (this.nodes.some((x) => x.id === n.id)) throw new Error(`${this.title}: two parts are called ${n.id}`);
    const placed: Placed = { id: n.id, type: n.type, x: 0, y: 0, params: n.params };
    const def = defOf(placed, this.resolve);
    const params = withDefaults(def, n.params);
    const pinsList = placedPins(placed, this.resolve).map((p) => ({ name: p.pin, dx: p.x, dy: p.y }));
    const defPins = typeof def.pins === 'function' ? def.pins(params) : def.pins;
    const pinDefs = pinsList.map((p, i) => ({ ...p, dir: (n.role === 'in' ? 'out' : n.role === 'out' ? 'in' : defPins[i]?.dir === 'out' ? 'out' : 'in') as 'in' | 'out' }));
    for (const name of Object.keys(n.pins)) if (!pinDefs.some((p) => p.name === name)) throw new Error(`${this.title}: ${n.type} ${n.id} has no pin ${name}`);
    this.nodes.push({ ...n, level: 0, x: 0, y: 0, pinDefs, box: boundsOf(def, params), flip: n.role === 'out' ? true : undefined });
    return n.id;
  }

  build(): Circuit {
    const nodes = this.nodes;
    // Who drives each net.
    const driver = new Map<string, Node>();
    const drivers = new Map<string, Node[]>();
    for (const n of nodes)
      for (const p of n.pinDefs)
        if (p.dir === 'out' && n.pins[p.name] !== undefined) {
          driver.set(n.pins[p.name]!, n);
          const list = drivers.get(n.pins[p.name]!) ?? [];
          if (!list.includes(n)) list.push(n);
          drivers.set(n.pins[p.name]!, list);
        }
    // A net with several drivers (a bus with tri-state buffers) is always drawn with labels.
    const shared = new Set([...drivers].filter(([, l]) => l.length > 1).map(([net]) => net));
    const feedback = new Set<string>();

    // Levels by depth from the inputs; a net that closes a loop is feedback.
    const state = new Map<Node, 'busy' | 'done'>();
    const levelOf = (n: Node): number => {
      if (state.get(n) === 'done') return n.level;
      state.set(n, 'busy');
      let lv = 0;
      let hasIn = false;
      for (const p of n.pinDefs) {
        if (p.dir !== 'in' || n.pins[p.name] === undefined) continue;
        hasIn = true;
        for (const d of drivers.get(n.pins[p.name]!) ?? []) {
          if (state.get(d) === 'busy') {
            feedback.add(n.pins[p.name]!);
            continue;
          }
          lv = Math.max(lv, levelOf(d) + 1);
        }
      }
      n.level = n.role === 'in' || !hasIn ? 0 : Math.max(1, lv);
      state.set(n, 'done');
      return n.level;
    };
    for (const n of nodes) if (n.role !== 'out') levelOf(n);
    const maxLevel = Math.max(0, ...nodes.filter((n) => n.role === 'comp').map((n) => n.level));
    for (const n of nodes) if (n.role === 'out') n.level = maxLevel + 1;
    for (const n of nodes) if (n.role === 'comp' && n.level === 0 && !n.pinDefs.some((p) => p.dir === 'in' && n.pins[p.name] !== undefined)) n.level = 0;

    // Sinks of each net.
    interface Sink {
      node: Node;
      pin: string;
    }
    const sinks = new Map<string, Sink[]>();
    for (const n of nodes)
      for (const p of n.pinDefs)
        if (p.dir === 'in' && n.pins[p.name] !== undefined) {
          const list = sinks.get(n.pins[p.name]!) ?? [];
          list.push({ node: n, pin: p.name });
          sinks.set(n.pins[p.name]!, list);
        }
    // Wired nets: a driver whose sinks are all in the next column. The rest use labels.
    const wired = new Set<string>();
    for (const [net, list] of sinks) {
      const d = driver.get(net);
      if (d && !shared.has(net) && !feedback.has(net) && list.every((s) => s.node.level === d.level + 1)) wired.add(net);
    }

    // Vertical placement, column by column, near the drivers.
    const columns: Node[][] = [];
    for (const n of nodes) (columns[n.level] ??= []).push(n);
    const pinY = (n: Node, name: string) => n.y + n.pinDefs.find((p) => p.name === name)!.dy;
    columns.forEach((col, lv) => {
      if (!col) return;
      if (lv === 0) {
        // Inputs in declaration order; other sources after them.
        col.sort((a, b) => (a.role === 'in' ? 0 : 1) - (b.role === 'in' ? 0 : 1));
      }
      const desired = new Map<Node, number>();
      col.forEach((n, i) => {
        const ys: number[] = [];
        for (const p of n.pinDefs) {
          if (p.dir !== 'in' || n.pins[p.name] === undefined) continue;
          const d = driver.get(n.pins[p.name]!);
          if (d && d.level < lv && !feedback.has(n.pins[p.name]!)) ys.push(pinY(d, d.pinDefs.find((q) => q.dir === 'out' && d.pins[q.name] === n.pins[p.name])!.name) - p.dy);
        }
        desired.set(n, ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : i * 4);
      });
      const order = lv === 0 || lv === maxLevel + 1 ? col : [...col].sort((a, b) => desired.get(a)! - desired.get(b)!);
      let cursor = -Infinity;
      for (const n of order) {
        const h = n.box.y1 - n.box.y0;
        const want = Math.round(desired.get(n)!);
        const min = cursor === -Infinity ? want : cursor + 1 - n.box.y0;
        n.y = lv === 0 || lv === maxLevel + 1 ? (cursor === -Infinity ? 0 : Math.max(min, cursor + 2 - n.box.y0)) : Math.max(want, Math.ceil(min));
        cursor = n.y + n.box.y0 + h;
        if (lv === 0 || lv === maxLevel + 1) cursor = Math.max(cursor, n.y + 1);
      }
    });

    // Horizontal placement: columns with gaps sized for their channels and labels.
    const flag = (name: string) => Math.ceil(Math.max(26, 14 + textWidth(name, 9)) / 12);
    const nColumns = columns.length;
    const colWidth: number[] = [];
    for (let lv = 0; lv < nColumns; lv++) colWidth[lv] = Math.max(1, ...(columns[lv] ?? []).map((n) => (n.role === 'out' ? 0 : n.box.x1)));
    const tracksOf = (lv: number) => [...wired].filter((net) => driver.get(net)!.level === lv);
    const labelSrc = (lv: number) => [...sinks.keys()].filter((net) => !wired.has(net) && (drivers.get(net) ?? []).some((d) => d.level === lv));
    const labelSink = (lv: number) => [...sinks.entries()].filter(([net, l]) => !wired.has(net) && l.some((s) => s.node.level === lv)).map(([net]) => net);
    const gapStart: number[] = [];
    const trackX = new Map<string, number>();
    let x = 3 + Math.max(0, ...(columns[0] ?? []).filter((n) => n.role === 'in').map((n) => flag(String(n.params?.name)))) * 0;
    const colX: number[] = [];
    for (let lv = 0; lv < nColumns; lv++) {
      const inPorts = lv === 0 ? Math.max(0, ...(columns[0] ?? []).filter((n) => n.role === 'in').map((n) => Math.ceil(Math.max(34, 16 + textWidth(String(n.params?.name), 9)) / 12))) : 0;
      if (lv === 0) x = inPorts + 1;
      colX[lv] = x;
      for (const n of columns[lv] ?? []) n.x = x;
      x += colWidth[lv]!;
      gapStart[lv] = x;
      if (lv < nColumns - 1) {
        const ls = labelSrc(lv);
        const sinkLabels = labelSink(lv + 1);
        const srcRegion = ls.length ? 2 + Math.max(...ls.map(flag)) : 0;
        const sinkRegion = sinkLabels.length ? 2 + Math.max(...sinkLabels.map(flag)) : 0;
        const tracks = tracksOf(lv);
        const start = x + srcRegion + 1;
        tracks.forEach((net, i) => trackX.set(net, start + i));
        x = start + tracks.length + sinkRegion + 1;
        x = Math.max(x, gapStart[lv]! + 4);
      }
    }
    // Channel order: net k must have a smaller track than net j when k's source row equals a sink row of j.
    for (let lv = 0; lv < nColumns - 1; lv++) {
      const nets = tracksOf(lv);
      if (nets.length < 2) continue;
      const srcY = (net: string) => {
        const d = driver.get(net)!;
        return d.y + d.pinDefs.find((p) => p.dir === 'out' && d.pins[p.name] === net)!.dy;
      };
      const sinkYs = (net: string) => sinks.get(net)!.map((s) => s.node.y + s.node.pinDefs.find((p) => p.name === s.pin)!.dy);
      const before = new Map<string, Set<string>>(nets.map((n) => [n, new Set<string>()]));
      for (const k of nets) for (const j of nets) if (k !== j && sinkYs(j).includes(srcY(k))) before.get(j)!.add(k); // k before j
      const start = Math.min(...nets.map((n) => trackX.get(n)!));
      const placed: string[] = [];
      const remaining = new Set(nets);
      while (remaining.size) {
        const ready = [...remaining].filter((n) => [...before.get(n)!].every((k) => !remaining.has(k)));
        if (!ready.length) {
          // A cycle: one of its nets goes by label instead.
          const victim = [...remaining][0]!;
          wired.delete(victim);
          remaining.delete(victim);
          continue;
        }
        // Higher sources take the tracks closer to the sink side (less crossing): sort by source row.
        ready.sort((a, b) => srcY(a) - srcY(b));
        const pick = ready[0]!;
        placed.push(pick);
        remaining.delete(pick);
      }
      placed.forEach((n, i) => trackX.set(n, start + i));
    }
    // (A net moved to labels changes the gap contents but not correctness; its track simply stays empty.)

    // Emit components.
    const components: Placed[] = nodes.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, ...(n.params ? { params: n.params } : {}), ...(n.flip ? { flip: true } : {}), ...(n.role !== 'comp' ? { label: '' } : {}) }));
    const wires: Wire[] = [];
    const pinPos = (n: Node, name: string): Pt => {
      const p = n.pinDefs.find((q) => q.name === name)!;
      return [n.x + (n.flip ? -p.dx : p.dx), n.y + p.dy];
    };
    // Portless-pins named nets are labels: unique label names per net.
    const labelName = (net: string) => net;
    const labelled = new Set<string>();
    for (const [net, list] of sinks) {
      const d = driver.get(net);
      if (!d) continue;
      if (wired.has(net)) {
        const outPin = d.pinDefs.find((p) => p.dir === 'out' && d.pins[p.name] === net)!;
        const s = pinPos(d, outPin.name);
        const tx = trackX.get(net)!;
        for (const sk of list) {
          const t = pinPos(sk.node, sk.pin);
          wires.push({ points: simplify([s, [tx, s[1]], [tx, t[1]], t]) });
        }
      } else labelled.add(net);
    }
    let labelId = 0;
    for (const net of labelled) {
      const lab = (at: Pt, flip: boolean): void => {
        components.push({ id: `L${++labelId}`, type: 'label', x: at[0], y: at[1], params: { name: labelName(net) }, ...(flip ? { flip: true } : {}), label: '' });
      };
      for (const d of drivers.get(net)!) {
        const outPin = d.pinDefs.find((p) => p.dir === 'out' && d.pins[p.name] === net)!;
        const s = pinPos(d, outPin.name);
        wires.push({ points: [s, [s[0] + 2, s[1]]] });
        lab([s[0] + 2, s[1]], false);
      }
      for (const sk of sinks.get(net)!) {
        const t = pinPos(sk.node, sk.pin);
        wires.push({ points: [[t[0] - 2, t[1]], t] });
        lab([t[0] - 2, t[1]], true);
      }
    }
    // Nets nobody reads (an output that is also a port name is fine): drivers with no sinks get nothing.
    return { version: 1, title: this.title, engine: 'digital', components, wires };
  }
}
