/**
 * A layered layout for gate-level netlists (a small Sugiyama-style drawing), producing a `Circuit` that the
 * Schematic renderer draws.
 *
 * 1. **Layers.** Inputs are in column 0. Every other element is in the column after the deepest element that
 *    feeds it (its logic depth); registers cut the loops, so a register's output counts as depth 0 and the
 *    register itself sits after its next-state logic. Outputs are in the last column. A constant sits just
 *    before the element that reads it.
 *    All registers share one column, just before the outputs.
 * 2. **Long wires** get a dummy node (an empty lane) in every column they pass, so wires run between
 *    components and never through them. A register's output feeds logic in earlier columns, so it is not
 *    drawn as a wire at all: it is a named flag at the register and at every pin that reads it, as in
 *    a schematic that would otherwise be a tangle of feedback wires.
 * 3. **Order.** The elements of each column are ordered by the barycentre of their neighbours, a few sweeps in
 *    each direction (inputs and outputs keep the order of the ports).
 * 4. **Rows.** Each column is stacked, and every element is pulled toward the rows of the elements it connects
 *    to (isotonic regression, so the order and the gaps are kept).
 * 5. **Channels.** Each gap between columns is a routing channel. A connection is drawn vertical–horizontal–
 *    vertical: its source stub runs to a vertical in the channel's left zone, along a free row to the right
 *    zone, and down to its sinks. The rows are chosen where no stub runs, and the verticals of overlapping
 *    connections get different tracks, so wires of different nets never overlap or touch by accident.
 *    (`connect()` joins wires that share a point, so an accidental touch would be a short circuit;
 *    `layout.test.ts` checks the connectivity of every drawing against the netlist.)
 * 6. **Clocks** are drawn as net labels rather than wires: every clock pin gets a flag named after the port.
 */
import type { Circuit, FlatElement, FlatNetlist, PinDef, Placed, Wire } from '../../sim/netlist/types';
import { boundsOf, getDef, pinsOf } from '../../sim/netlist/catalog';
import { textWidth } from '../../bench/geometry';

export class LayoutError extends Error {}

export interface LayoutOptions {
  /** Give up on netlists with more elements than this (default 400). */
  maxElements?: number;
}

export interface LayoutResult {
  circuit: Circuit;
  /** Size of the drawing in grid units. */
  width: number;
  height: number;
  /** Elements per column, left to right. */
  columns: number[];
}

interface Node {
  key: string;
  col: number;
  el?: FlatElement;
  /** Width and height of the region the node occupies (grid units), offset of its bounds from its origin. */
  w: number;
  h: number;
  bx0: number;
  by0: number;
  pins: Map<string, { dx: number; dy: number; dir: string }>;
  order: number;
  /** Top of the region, and left edge of its column. */
  y: number;
  /** Dummy: the net whose lane this is. */
  lane?: number;
}

/** One connection in one channel: a source, and the sinks it reaches in the next column. */
interface Conn {
  net: number;
  channel: number;
  /** The source: a node pin, or a dummy lane. */
  src: { node: Node; pin?: string };
  dests: { node: Node; pin?: string }[];
  // Filled in by the router.
  yt?: number;
  left?: number;
  right?: number;
  ys?: number;
  yds?: number[];
  /** Number of tracks in the channel's left zone (for the position of the right zone). */
  nl?: number;
}

const CLOCK_PINS = new Set(['CLK']);
const SOURCE_TYPES = new Set(['toggle', 'const', 'clock', 'button']);

const GAP = 2;

export function layoutNetlist(netlist: FlatNetlist, title?: string, options: LayoutOptions = {}): LayoutResult {
  const els = netlist.elements;
  if (els.length > (options.maxElements ?? 400)) throw new LayoutError(`${els.length} elements are too many to draw (the limit is ${options.maxElements ?? 400})`);

  // ---------------------------------------------------------------- nodes and connectivity
  const nodes: Node[] = [];
  const byEl = new Map<string, Node>();
  for (const el of els) {
    const def = getDef(el.type);
    if (!def) throw new LayoutError(`no catalog entry for ${el.type}`);
    const pins = pinsOf(def, el.params);
    const b = boundsOf(def, el.params);
    const node: Node = {
      key: el.id,
      col: 0,
      el,
      w: b.x1 - b.x0,
      h: b.y1 - b.y0,
      bx0: b.x0,
      by0: b.y0,
      pins: new Map(pins.map((p: PinDef) => [p.name, { dx: p.x - b.x0, dy: p.y - b.y0, dir: p.dir ?? 'io' }])),
      order: nodes.length,
      y: 0,
    };
    nodes.push(node);
    byEl.set(el.id, node);
  }
  const driver = new Map<number, { node: Node; pin: string }>();
  const sinks = new Map<number, { node: Node; pin: string }[]>();
  const clockNets = new Set<number>();
  for (const node of nodes) {
    const el = node.el!;
    el.pinNames.forEach((pin, i) => {
      const net = el.pins[i]!;
      const dir = node.pins.get(pin)?.dir;
      if (CLOCK_PINS.has(pin) && (el.type === 'dff' || el.type === 'ram' || el.type === 'register' || el.type === 'counter')) {
        clockNets.add(net);
        return;
      }
      if (dir === 'out') driver.set(net, { node, pin });
      else if (dir === 'in') {
        const l = sinks.get(net) ?? [];
        l.push({ node, pin });
        sinks.set(net, l);
      }
    });
  }

  // ---------------------------------------------------------------- layers
  const layer = new Map<Node, number>();
  const visiting = new Set<Node>();
  const isReg = (n: Node) => n.el!.type === 'dff';
  /** Depth of the net a node reads: registers and sources count as 0. */
  const srcLayer = (net: number): number => {
    const d = driver.get(net);
    if (!d) return 0;
    if (isReg(d.node) || SOURCE_TYPES.has(d.node.el!.type)) return 0;
    return layerOf(d.node);
  };
  const layerOf = (n: Node): number => {
    const hit = layer.get(n);
    if (hit !== undefined) return hit;
    if (SOURCE_TYPES.has(n.el!.type)) {
      layer.set(n, 0);
      return 0;
    }
    if (visiting.has(n)) return 0;
    visiting.add(n);
    let m = 0;
    n.el!.pinNames.forEach((pin, i) => {
      if (n.pins.get(pin)?.dir === 'in' && !CLOCK_PINS.has(pin)) m = Math.max(m, srcLayer(n.el!.pins[i]!));
    });
    visiting.delete(n);
    layer.set(n, m + 1);
    return m + 1;
  };
  for (const n of nodes) if (n.el!.type !== 'indicator') layerOf(n);
  let last = 0;
  for (const n of nodes) if (n.el!.type !== 'indicator' && !isReg(n)) last = Math.max(last, layer.get(n) ?? 0);
  // Registers share one column, after all the logic.
  if (nodes.some(isReg)) {
    last += 1;
    for (const n of nodes) if (isReg(n)) layer.set(n, last);
  }
  // Constants go next to the element that reads them.
  for (const n of nodes) {
    if (n.el!.type !== 'const') continue;
    const out = driver.get(n.el!.pins[0]!);
    const ls = (out ? (sinks.get(n.el!.pins[0]!) ?? []) : []).map((s) => (s.node.el!.type === 'indicator' ? last + 1 : layer.get(s.node) ?? 1));
    layer.set(n, ls.length ? Math.max(0, Math.min(...ls) - 1) : 0);
  }
  const outputCol = last + 1;
  for (const n of nodes) if (n.el!.type === 'indicator') layer.set(n, outputCol);
  for (const n of nodes) n.col = layer.get(n) ?? 0;
  const ncols = outputCol + 1;

  // ---------------------------------------------------------------- dummies and per-channel connections
  const cols: Node[][] = Array.from({ length: ncols }, () => []);
  for (const n of nodes) cols[n.col]!.push(n);
  const dummies = new Map<string, Node>();
  const dummy = (net: number, col: number): Node => {
    const key = `${net}@${col}`;
    let d = dummies.get(key);
    if (!d) {
      d = { key: `~${key}`, col, w: 1, h: 2, bx0: 0, by0: 0, pins: new Map(), order: 1e6 + dummies.size, y: 0, lane: net };
      dummies.set(key, d);
      cols[col]!.push(d);
    }
    return d;
  };
  const conns: Conn[] = [];
  /** Nets drawn as named flags: the driver's flag, and one at every pin that reads the value in an earlier column. */
  const flagged = new Map<number, { name: string; readers: { node: Node; pin: string }[]; driver: { node: Node; pin: string }; wired: boolean }>();
  for (const [net, d] of driver) {
    const list = sinks.get(net);
    if (!list?.length) continue;
    const cd = d.node.col;
    const fwd = list.filter((s) => s.node.col > cd);
    const back = list.filter((s) => s.node.col <= cd);
    if (back.length) flagged.set(net, { name: netlist.netNames[net] ?? `n${net}`, readers: back, driver: d, wired: fwd.length > 0 });
    if (fwd.length) {
      const ms = Math.max(...fwd.map((s) => s.node.col));
      for (let c = cd; c < ms; c++) {
        const dests: Conn['dests'] = fwd.filter((s) => s.node.col === c + 1).map((s) => ({ node: s.node, pin: s.pin }));
        if (ms > c + 1) dests.push({ node: dummy(net, c + 1) });
        conns.push({ net, channel: c, src: c === cd ? { node: d.node, pin: d.pin } : { node: dummy(net, c) }, dests });
      }
    }
  }
  /** Flags: clock pins, register outputs, and the pins that read them. `w` is the flag's width in px. */
  interface Flag {
    node: Node;
    pin: string;
    side: 'left' | 'right';
    name: string;
    tap: boolean;
  }
  const flags: Flag[] = [];
  const clockName = (net: number) => netlist.netNames[net] ?? `clk${net}`;
  for (const n of nodes) {
    const el = n.el!;
    el.pinNames.forEach((pin, i) => {
      const net = el.pins[i]!;
      if (!clockNets.has(net)) return;
      if (CLOCK_PINS.has(pin)) flags.push({ node: n, pin, side: 'left', name: clockName(net), tap: false });
      else if (n.pins.get(pin)?.dir === 'out') flags.push({ node: n, pin, side: 'right', name: clockName(net), tap: false });
    });
  }
  for (const f of flagged.values()) {
    flags.push({ node: f.driver.node, pin: f.driver.pin, side: 'right', name: f.name, tap: f.wired });
    for (const r of f.readers) flags.push({ node: r.node, pin: r.pin, side: 'left', name: f.name, tap: false });
  }
  const flagUnits = (name: string) => Math.ceil(Math.max(26, 14 + textWidth(name, 9)) / 12);

  // ---------------------------------------------------------------- ordering
  const edges: { a: Node; ay: number; b: Node; by: number }[] = [];
  const pinDy = (n: Node, pin?: string) => (pin ? (n.pins.get(pin)?.dy ?? 0) : 1);
  for (const c of conns) {
    if (!c.src || !c.dests.length) continue;
    for (const d of c.dests) edges.push({ a: c.src.node, ay: pinDy(c.src.node, c.src.pin), b: d.node, by: pinDy(d.node, d.pin) });
  }
  const left = new Map<Node, typeof edges>();
  const right = new Map<Node, typeof edges>();
  for (const e of edges) {
    left.set(e.b, [...(left.get(e.b) ?? []), e]);
    right.set(e.a, [...(right.get(e.a) ?? []), e]);
  }
  for (const col of cols) col.sort((a, b) => a.order - b.order);
  const rank = new Map<Node, number>();
  const reindex = () => cols.forEach((col) => col.forEach((n, i) => rank.set(n, i)));
  reindex();
  const sweep = (c: number, dir: 'left' | 'right') => {
    const col = cols[c]!;
    const bary = new Map<Node, number>();
    for (const n of col) {
      const es = (dir === 'left' ? left : right).get(n) ?? [];
      const ranks = es.map((e) => rank.get(dir === 'left' ? e.a : e.b)!);
      bary.set(n, ranks.length ? ranks.reduce((s, x) => s + x, 0) / ranks.length : rank.get(n)!);
    }
    col.sort((a, b) => bary.get(a)! - bary.get(b)! || rank.get(a)! - rank.get(b)!);
    col.forEach((n, i) => rank.set(n, i));
  };
  for (let it = 0; it < 6; it++) {
    for (let c = 1; c < ncols - 1; c++) sweep(c, 'left');
    for (let c = ncols - 2; c >= 1; c--) sweep(c, 'right');
  }

  // ---------------------------------------------------------------- rows
  for (const col of cols) {
    let y = 0;
    for (const n of col) {
      n.y = y;
      y += n.h + GAP;
    }
  }
  const absY = (n: Node, pin?: string) => n.y + pinDy(n, pin);
  /** Isotonic regression: the closest positions to `want` that keep the order and the gaps. */
  const place = (col: Node[], want: number[]) => {
    const sep: number[] = [0];
    for (let i = 1; i < col.length; i++) sep.push(sep[i - 1]! + col[i - 1]!.h + GAP);
    // z_i = y_i − sep_i must be non-decreasing; pool adjacent violators.
    const blocks: { sum: number; n: number }[] = [];
    col.forEach((_, i) => {
      blocks.push({ sum: want[i]! - sep[i]!, n: 1 });
      while (blocks.length > 1) {
        const b = blocks[blocks.length - 1]!;
        const a = blocks[blocks.length - 2]!;
        if (a.sum / a.n <= b.sum / b.n) break;
        blocks.pop();
        a.sum += b.sum;
        a.n += b.n;
      }
    });
    let i = 0;
    for (const b of blocks) {
      const z = Math.round(b.sum / b.n);
      for (let k = 0; k < b.n; k++, i++) col[i]!.y = z + sep[i]!;
    }
    // Rounding can break a gap by one; repair from the top.
    for (let k = 1; k < col.length; k++) col[k]!.y = Math.max(col[k]!.y, col[k - 1]!.y + col[k - 1]!.h + GAP);
  };
  for (let it = 0; it < 10; it++) {
    const cs = it % 2 === 0 ? [...Array(ncols).keys()] : [...Array(ncols).keys()].reverse();
    for (const c of cs) {
      const col = cols[c]!;
      const side = it % 2 === 0 ? left : right;
      const want = col.map((n) => {
        const es = side.get(n) ?? [];
        if (!es.length) return n.y;
        // The row at which this node's pins line up with the pins it connects to.
        const t = es.map((e) => (it % 2 === 0 ? e.a.y + e.ay - e.by : e.b.y + e.by - e.ay));
        return t.reduce((s, x) => s + x, 0) / t.length;
      });
      place(col, want);
    }
  }
  const allNodes = [...nodes, ...dummies.values()];
  const minY = Math.min(...allNodes.map((n) => n.y));
  const maxY = Math.max(...allNodes.map((n) => n.y + n.h));

  // ---------------------------------------------------------------- channels: rows and tracks
  const byChannel: Conn[][] = Array.from({ length: Math.max(1, ncols - 1) }, () => []);
  for (const c of conns) byChannel[c.channel]!.push(c);
  const widths: number[] = [];
  const lms: number[] = [];
  /** How far the flags on the left of column c stick out (grid units). */
  const flagsLeft = (c: number) => Math.max(0, ...flags.filter((f) => f.side === 'left' && f.node.col === c).map((f) => flagUnits(f.name)));
  /** How far the flags on the right of column c stick out beyond the column (grid units). */
  const overhang = (c: number) => {
    const colWidth = Math.max(1, ...cols[c]!.map((n) => n.w));
    return Math.max(0, ...flags.filter((f) => f.side === 'right' && f.node.col === c).map((f) => (f.node.pins.get(f.pin)?.dx ?? 0) + (f.tap ? 1 : 0) + flagUnits(f.name) - colWidth));
  };
  for (let ch = 0; ch < byChannel.length; ch++) {
    const cs = byChannel[ch]!;
    const forbidden = new Set<number>();
    for (const c of cs) {
      c.ys = absY(c.src.node, c.src.pin);
      forbidden.add(c.ys);
      c.yds = c.dests.map((d) => absY(d.node, d.pin));
      for (const y of c.yds) forbidden.add(y);
    }
    // Choose the row of each connection's horizontal run.
    for (const c of cs) {
      if (c.yds!.length === 1 && c.yds![0] === c.ys) continue; // straight
      const all = [c.ys!, ...c.yds!].sort((a, b) => a - b);
      const target = all[Math.floor(all.length / 2)]!;
      let best = target;
      for (let d = 0; d < 1000; d++) {
        const cand = [target + d, target - d].find((y) => !forbidden.has(y) && y >= minY - 1);
        if (cand !== undefined) {
          best = cand;
          break;
        }
      }
      c.yt = best;
      forbidden.add(best);
    }
    // Tracks: interval colouring in each zone.
    const assign = (items: { c: Conn; lo: number; hi: number }[], set: (c: Conn, t: number) => void): number => {
      items.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
      const ends: number[] = [];
      for (const it of items) {
        let t = ends.findIndex((e) => e < it.lo);
        if (t < 0) {
          t = ends.length;
          ends.push(it.hi);
        } else ends[t] = it.hi;
        set(it.c, t);
      }
      return ends.length;
    };
    const lefts: { c: Conn; lo: number; hi: number }[] = [];
    const rights: { c: Conn; lo: number; hi: number }[] = [];
    for (const c of cs) {
      if (c.yt === undefined) continue;
      lefts.push({ c, lo: Math.min(c.ys!, c.yt), hi: Math.max(c.ys!, c.yt) });
      rights.push({ c, lo: Math.min(c.yt, ...c.yds!), hi: Math.max(c.yt, ...c.yds!) });
    }
    const nl = assign(lefts, (c, t) => (c.left = t));
    const nr = assign(rights, (c, t) => (c.right = t));
    // Zone layout: margin, left tracks, gap, right tracks, margin. The margins hold the flags that stick out of
    // the columns on either side.
    const lm = 1 + overhang(ch);
    const rm = 1 + flagsLeft(ch + 1);
    widths.push(Math.max(4, lm + nl + 1 + nr + rm));
    lms.push(lm);
    for (const c of cs) c.nl = nl;
  }

  // ---------------------------------------------------------------- x positions
  const colW = cols.map((col) => Math.max(1, ...col.map((n) => n.w)));
  const colX: number[] = [0];
  for (let c = 0; c < ncols - 1; c++) colX.push(colX[c]! + colW[c]! + widths[c]!);
  const shiftY = 2 - minY;

  const pinPoint = (n: Node, pin?: string, side: 'left' | 'right' = 'right'): [number, number] => {
    if (n.lane !== undefined) return [side === 'right' ? colX[n.col]! + colW[n.col]! : colX[n.col]!, n.y + 1 + shiftY];
    const p = n.pins.get(pin!)!;
    return [colX[n.col]! + p.dx, n.y + p.dy + shiftY];
  };
  const zoneX = (ch: number, zone: 'left' | 'right', track: number, nl: number) => colX[ch]! + colW[ch]! + lms[ch]! + (zone === 'left' ? track : nl + 1 + track);

  // ---------------------------------------------------------------- emit
  const wires: Wire[] = [];
  const wire = (...pts: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of pts) {
      const l = out[out.length - 1];
      if (l && l[0] === p[0] && l[1] === p[1]) continue;
      out.push(p);
    }
    if (out.length >= 2) wires.push({ points: out });
  };
  for (const c of conns) {
    const nl = c.nl ?? 0;
    const ch = c.channel;
    const start = pinPoint(c.src.node, c.src.pin, 'right');
    const ends = c.dests.map((d) => pinPoint(d.node, d.pin, 'left'));
    if (c.yt === undefined) {
      // Straight through the channel.
      wire(start, ends[0]!);
      continue;
    }
    const yt = c.yt + shiftY;
    const xl = zoneX(ch, 'left', c.left!, nl);
    const xr = zoneX(ch, 'right', c.right!, nl);
    wire(start, [xl, start[1]], [xl, yt], [xr, yt]);
    const ys = [yt, ...ends.map((e) => e[1])];
    wire([xr, Math.min(...ys)], [xr, Math.max(...ys)]);
    for (const e of ends) wire([xr, e[1]], e);
  }
  for (const d of dummies.values()) wire([colX[d.col]!, d.y + 1 + shiftY], [colX[d.col]! + colW[d.col]!, d.y + 1 + shiftY]);

  const components: Placed[] = [];
  for (const n of nodes) {
    const el = n.el!;
    components.push({
      id: el.id,
      type: el.type,
      x: colX[n.col]! - n.bx0,
      y: n.y + shiftY - n.by0,
      params: el.params,
    });
  }
  // Flags: a `label` component connects by name. A register's flag is tapped off one row above its pin, so that it
  // does not sit on the wire that may leave the pin too.
  let flagId = 0;
  for (const f of flags) {
    const [x, y] = pinPoint(f.node, f.pin);
    if (f.tap) {
      wire([x, y], [x + 1, y], [x + 1, y - 1]);
      components.push({ id: `~flag${flagId++}`, type: 'label', x: x + 1, y: y - 1, params: { name: f.name } });
    } else components.push({ id: `~flag${flagId++}`, type: 'label', x, y, ...(f.side === 'left' ? { flip: true } : {}), params: { name: f.name } });
  }

  let width = colX[ncols - 1]! + colW[ncols - 1]!;
  let height = maxY + shiftY;
  for (const w of wires) for (const [x, y] of w.points) {
    width = Math.max(width, x);
    height = Math.max(height, y);
  }
  height += 2;
  const circuit: Circuit = { version: 1, engine: 'digital', ...(title ? { title } : {}), components, wires };
  return { circuit, width, height, columns: cols.map((c) => c.filter((n) => n.lane === undefined).length) };
}
