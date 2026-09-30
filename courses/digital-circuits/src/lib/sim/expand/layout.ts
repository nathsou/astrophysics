/**
 * Drawing a CMOS cell: turns a `Cell` (stages of series–parallel networks) into placed transistors
 * and wires, in the style of a textbook schematic.
 *
 *  - Every stage is drawn upright: a +5 V rail symbol on top of the pull-up (pMOS) network, the
 *    output node in the middle, the pull-down (nMOS) network below and a ground symbol at the foot.
 *    A transistor is 3 units wide and 4 tall (pMOS: source on top; nMOS: drain on top), so a series
 *    stack needs no wire at all: the source of one sits on the drain of the next.
 *  - Series and parallel groups nest: a parallel group is a row of columns joined by a bus at the top
 *    and one at the bottom.
 *  - Signals travel on vertical *buses*. Inputs of the gate have buses on the left; the output of a
 *    stage that feeds a later stage gets a bus just to its right. Each transistor's gate is fed from
 *    a horizontal *rail* (one per signal, above the pull-up networks for the pMOS transistors and
 *    below the pull-down networks for the nMOS ones) by a vertical drop in a channel left of the
 *    transistor. Rails never run through a transistor, wires only cross where they do not connect.
 *  - The cell is laid out independently of where its pins will be: `place()` puts it in a box on the
 *    schematic and joins its input buses and its output to the given pin positions.
 */
import type { Note, Placed } from '../netlist/types';
import { depthOf, leavesOf, type Cell, type Net, type Stage } from './cells';

export type Pt = [number, number];

interface Leaf {
  sig: string;
  /** pMOS (true) or nMOS. */
  p: boolean;
  /** Position of the gate pin, in the block's own coordinates. */
  gx: number;
  gy: number;
}

interface Block {
  w: number;
  h: number;
  /** Terminals: where the network joins the rail (or the output node) and the output node (or ground). */
  top: Pt;
  bot: Pt;
  leaves: Leaf[];
  wires: Pt[][];
}

const shift = (pts: Pt[], dx: number, dy: number): Pt[] => pts.map(([x, y]) => [x + dx, y + dy]);

/**
 * Lay out one network. Every block has its terminals at x = M + 3, its transistors' gate pins at
 * x = M (so the M columns to their left are the channels of the gate-lead drops), and its top and
 * bottom terminals on its top and bottom edges.
 */
function block(net: Net, p: boolean, M: number): Block {
  const T = M + 3;
  if ('leaf' in net) return { w: T, h: 4, top: [T, 0], bot: [T, 4], leaves: [{ sig: net.leaf, p, gx: M, gy: 2 }], wires: [] };
  if ('series' in net) {
    const kids = net.series.map((k) => block(k, p, M));
    let y = 0;
    const out: Block = { w: 0, h: 0, top: kids[0]!.top, bot: [T, 0], leaves: [], wires: [] };
    for (const k of kids) {
      out.w = Math.max(out.w, k.w);
      out.leaves.push(...k.leaves.map((l) => ({ ...l, gy: l.gy + y })));
      out.wires.push(...k.wires.map((w) => shift(w, 0, y)));
      y += k.h;
    }
    out.h = y;
    out.bot = [T, y];
    return out;
  }
  const kids = net.parallel.map((k) => block(k, p, M));
  const hmax = Math.max(...kids.map((k) => k.h));
  const busBot = hmax + 2;
  const out: Block = { w: 0, h: busBot, top: [T, 0], bot: [T, busBot], leaves: [], wires: [] };
  let x = 0;
  const xs: number[] = [];
  for (const k of kids) {
    out.leaves.push(...k.leaves.map((l) => ({ ...l, gx: l.gx + x, gy: l.gy + 1 })));
    out.wires.push(...k.wires.map((w) => shift(w, x, 1)));
    out.wires.push([[x + T, 0], [x + T, 1]]);
    out.wires.push([[x + T, 1 + k.h], [x + T, busBot]]);
    xs.push(x + T);
    x += k.w;
  }
  out.w = x;
  out.wires.push([[xs[0]!, 0], [xs[xs.length - 1]!, 0]]);
  out.wires.push([[xs[0]!, busBot], [xs[xs.length - 1]!, busBot]]);
  return out;
}

/** A transistor of a laid-out cell (position: its gate pin, relative to the cell's top-left). */
export interface LayoutTransistor {
  /** "MP1", "MN3", … unique within the gate (the gate's id is added by `placeCell`). */
  tag: string;
  p: boolean;
  /** Signal on the gate. */
  sig: string;
  stage: number;
  x: number;
  y: number;
}

interface Bus {
  sig: string;
  x: number;
  /** Rows the bus must reach (every wire that ends on it). */
  rows: number[];
  external: boolean;
}

export interface CellLayout {
  /** Size of the drawing. */
  w: number;
  h: number;
  transistors: LayoutTransistor[];
  /** Supply symbols: a '+5 V' rail and a ground, one pair per stage. */
  supplies: { tag: string; type: 'rail' | 'ground'; x: number; y: number }[];
  wires: Pt[][];
  buses: Bus[];
  /** Index into `wires` of the tap that leaves each stage's output node. */
  stageTap: number[];
  /** Signal each stage drives. */
  stageOut: string[];
  /** Where the last stage's output node leaves the drawing. */
  out: Pt;
  /** External inputs in bus order. */
  inputs: string[];
  /** Rows where horizontal wires run near the buses (rails and straight leads): input pins should avoid them. */
  rows: number[];
}

/** Lay out a cell in its own coordinates (origin at the top left). */
export function layoutCell(cell: Cell): CellLayout {
  const internal = new Set(cell.stages.map((s) => s.out));

  // External input buses, in order of first use.
  const order: string[] = [];
  for (const s of cell.stages) for (const sig of [...leavesOf(s.pun), ...leavesOf(s.pdn)]) if (!internal.has(sig) && !order.includes(sig)) order.push(sig);
  for (const i of cell.inputs) if (!order.includes(i)) order.push(i);
  const buses: Bus[] = order.map((sig, i) => ({ sig, x: 1 + i, rows: [], external: true }));
  const busOf = (sig: string) => buses.find((b) => b.sig === sig)!;

  // A first pass in "band" coordinates: y = 0 is the top of the pull-up networks, so nothing here depends on
  // how many rails there will be. Stages are placed left to right; each decides, leaf by leaf, whether the
  // gate can be fed by a straight lead from its bus (nothing in the way) or needs a drop from a rail.
  interface Body {
    x: number;
    y: number;
  }
  interface Placement {
    stage: Stage;
    M: number;
    P: Block;
    N: Block;
    xs: number;
    tapX: number;
    term: number;
    yN0: number;
    yM: number;
    yBot: number;
  }
  interface LeafInfo {
    sig: string;
    p: boolean;
    stage: number;
    gx: number;
    gy: number;
    /** Straight lead from the bus (no drop). */
    direct: boolean;
    dropX: number;
  }
  const bodies: Body[] = [];
  const wiresBand: Pt[][] = [];
  const segments: [number, number, number][] = []; // accepted straight leads: [y, x0, x1]
  const leaves: LeafInfo[] = [];
  const placements: Placement[] = [];
  let xcur = 1 + order.length + 1;

  const blocked = (y: number, x0: number, x1: number): boolean => {
    for (const b of bodies) if (Math.abs(b.y - y) <= 2 && b.x < x1 && b.x + 3 > x0) return true;
    for (const [sy, a, c] of segments) if (sy === y && a < x1 && c > x0) return true;
    for (const w of wiresBand)
      for (let i = 0; i < w.length; i++) {
        const [vx, vy] = w[i]!;
        if (vy === y && vx > x0 && vx < x1) return true;
        const prev = w[i - 1];
        if (prev && prev[1] === y && vy === y && Math.min(prev[0], vx) < x1 && Math.max(prev[0], vx) > x0) return true;
      }
    return false;
  };

  cell.stages.forEach((stage, j) => {
    const need = Math.max(depthOf(stage.pun), depthOf(stage.pdn)) + 1;
    for (let M = 1; M <= need; M++) {
      const P = block(stage.pun, true, M);
      const N = block(stage.pdn, false, M);
      const xs = xcur;
      const yN0 = P.h + 2;
      const mine: LeafInfo[] = [];
      const bodiesHere: Body[] = [];
      for (const [p, blk, y0] of [[true, P, 0], [false, N, yN0]] as const)
        for (const l of blk.leaves) {
          mine.push({ sig: l.sig, p, stage: j, gx: xs + l.gx, gy: y0 + l.gy, direct: false, dropX: 0 });
          bodiesHere.push({ x: xs + l.gx, y: y0 + l.gy });
        }
      const wiresHere = [...P.wires.map((w) => shift(w, xs, 0)), ...N.wires.map((w) => shift(w, xs, yN0))];
      bodies.push(...bodiesHere);
      wiresBand.push(...wiresHere);
      const added: [number, number, number][] = [];
      for (const l of mine) {
        const bx = busX(l.sig);
        l.direct = bx !== undefined && !blocked(l.gy, bx, l.gx);
        if (l.direct) {
          const seg: [number, number, number] = [l.gy, bx!, l.gx];
          segments.push(seg);
          added.push(seg);
        }
      }
      // Channels for the leaves that need a drop: a column's leaves take turns, nearest to their rail first.
      const groups = new Map<string, LeafInfo[]>();
      for (const l of mine) if (!l.direct) groups.set(`${l.p}:${l.gx}`, [...(groups.get(`${l.p}:${l.gx}`) ?? []), l]);
      let most = 0;
      for (const g of groups.values()) {
        g.sort((a, b) => (a.p ? a.gy - b.gy : b.gy - a.gy));
        g.forEach((l, k) => (l.dropX = l.gx - 1 - k));
        most = Math.max(most, g.length);
      }
      if (most <= M - 1 || M === need) {
        const w = Math.max(P.w, N.w);
        const tapX = xs + w + 1;
        const term = xs + M + 3;
        placements.push({ stage, M, P, N, xs, tapX, term, yN0, yM: P.h + 1, yBot: yN0 + N.h });
        wiresBand.push([[term, P.h], [term, yN0]], [[term, P.h + 1], [tapX, P.h + 1]]);
        leaves.push(...mine);
        if (j < cell.stages.length - 1) buses.push({ sig: stage.out, x: tapX, rows: [], external: false });
        xcur = tapX + 2;
        return;
      }
      // Try a wider margin: undo this attempt.
      bodies.length -= bodiesHere.length;
      wiresBand.length -= wiresHere.length;
      for (const seg of added) segments.splice(segments.indexOf(seg), 1);
    }
  });
  function busX(sig: string): number | undefined {
    return buses.find((b) => b.sig === sig)?.x;
  }

  // Rails: one per signal and zone, for the leaves that need a drop. The rail that reaches farthest right is
  // farthest from the network, so no drop has to cross a rail that stops short of it.
  const rails = (p: boolean) => {
    const reach = new Map<string, number>();
    for (const d of leaves) if (!d.direct && d.p === p) reach.set(d.sig, Math.max(reach.get(d.sig) ?? -Infinity, d.dropX));
    return [...reach.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([sig, x]) => ({ sig, x }));
  };
  const topRails = rails(true);
  const botRails = rails(false).reverse();
  const yP0 = topRails.length + 4;
  const topRow = new Map(topRails.map((r, i) => [r.sig, 1 + i]));
  const yG = yP0 + Math.max(...placements.map((q) => q.yBot));
  const botRow = new Map(botRails.map((r, i) => [r.sig, yG + 3 + i]));

  const transistors: LayoutTransistor[] = [];
  const supplies: CellLayout['supplies'] = [];
  const wires: Pt[][] = [];
  const stageTap: number[] = [];
  let np = 0;
  let nn = 0;

  placements.forEach((q, j) => {
    const yN0 = yP0 + q.yN0;
    for (const l of q.P.leaves) transistors.push({ tag: `MP${++np}`, p: true, sig: l.sig, stage: j, x: q.xs + l.gx, y: yP0 + l.gy });
    for (const l of q.N.leaves) transistors.push({ tag: `MN${++nn}`, p: false, sig: l.sig, stage: j, x: q.xs + l.gx, y: yN0 + l.gy });
    for (const w of q.P.wires) wires.push(shift(w, q.xs, yP0));
    for (const w of q.N.wires) wires.push(shift(w, q.xs, yN0));
    supplies.push({ tag: `VDD${j + 1}`, type: 'rail', x: q.term, y: yP0 });
    supplies.push({ tag: `GND${j + 1}`, type: 'ground', x: q.term, y: yG });
    if (yP0 + q.yBot < yG) wires.push([[q.term, yP0 + q.yBot], [q.term, yG]]);
    // The output node: the pull-up meets the pull-down, and a tap leads away to the right.
    wires.push([[q.term, yP0 + q.P.h], [q.term, yN0]]);
    stageTap.push(wires.length);
    wires.push([[q.term, yP0 + q.yM], [q.tapX, yP0 + q.yM]]);
    if (j < placements.length - 1) busOf(q.stage.out).rows.push(yP0 + q.yM);
  });

  for (const [p, list] of [[true, topRails], [false, botRails]] as const) {
    for (const r of list) {
      const row = (p ? topRow : botRow).get(r.sig)!;
      const bus = busOf(r.sig);
      bus.rows.push(row);
      wires.push([[bus.x, row], [r.x, row]]);
    }
  }
  for (const d of leaves) {
    const y = yP0 + d.gy;
    if (d.direct) {
      const bus = busOf(d.sig);
      bus.rows.push(y);
      wires.push([[bus.x, y], [d.gx, y]]);
    } else {
      const row = (d.p ? topRow : botRow).get(d.sig)!;
      wires.push([[d.dropX, row], [d.dropX, y], [d.gx, y]]);
    }
  }

  const last = placements[placements.length - 1]!;
  return {
    w: last.tapX + 1,
    h: yG + (botRails.length ? 3 + botRails.length + 1 : 3),
    transistors,
    supplies,
    wires,
    buses,
    stageTap,
    stageOut: placements.map((q) => q.stage.out),
    out: [last.tapX, yP0 + last.yM],
    inputs: order,
    rows: [...topRow.values(), ...botRow.values(), ...leaves.filter((l) => l.direct).map((l) => yP0 + l.gy)],
  };
}

/** Remove repeated points and collinear middles; null when nothing is left to draw. */
export function tidy(points: Pt[]): Pt[] | null {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    const prev = out[out.length - 2];
    if (last && prev && ((prev[0] === last[0] && last[0] === p[0]) || (prev[1] === last[1] && last[1] === p[1]))) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out.length >= 2 ? out : null;
}

/** What `placeCell` returns: parts and wires in schematic coordinates. */
export interface PlacedCell {
  components: Placed[];
  wires: Pt[][];
  notes: Note[];
  /** Ids of the transistors, in order. */
  transistors: string[];
  /** Index (into `wires`) of the wire leaving each stage's output node: the net of that stage's output. */
  stageWires: number[];
}

export interface CellPorts {
  /** Pin positions of the gate's inputs, by cell input name ('A', 'B', 'EN'), and its output. */
  inputs: Record<string, Pt>;
  out: Pt;
}

/**
 * Put a laid-out cell on the schematic: its top left at (ox, oy), in a box of w × h whose left edge
 * carries the input pins and whose right edge carries the output pin (both in `ports`). The input
 * buses are joined to the pins and the output node to the output pin. `id` prefixes the ids of
 * the parts ("U1" → "U1/MP1").
 */
export function placeCell(layout: CellLayout, id: string, ox: number, oy: number, h: number, ports: CellPorts): PlacedCell {
  // The drawing sits inside the box, below the title. Where there is room to choose, keep the input
  // pins off the rows that rails and straight leads run along, so a pin's lead cannot touch them.
  const room = Math.max(0, h - 4 - layout.h);
  const centre = Math.floor(room / 2);
  const candidates = Array.from({ length: room + 1 }, (_, i) => i).sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
  const pinRows = Object.values(ports.inputs)
    .filter((p) => p[0] === ox)
    .map((p) => p[1] - oy);
  const used = new Set(layout.rows);
  const clash = (d: number) => pinRows.some((r) => used.has(r - 3 - d));
  const dyc = 3 + (candidates.find((d) => !clash(d)) ?? centre);
  const X = (x: number) => ox + x;
  const Y = (y: number) => oy + dyc + y;
  const components: Placed[] = [];
  const wires: Pt[][] = [];
  const notes: Note[] = [];
  const ids: string[] = [];
  const at = new Map<number, number>();

  for (const t of layout.transistors) {
    const tid = `${id}/${t.tag}`;
    ids.push(tid);
    components.push({ id: tid, type: t.p ? 'pmos' : 'nmos', x: X(t.x), y: Y(t.y), label: t.sig });
  }
  for (const s of layout.supplies) {
    components.push({ id: `${id}/${s.tag}`, type: s.type, x: X(s.x), y: Y(s.y), ...(s.type === 'rail' ? { params: { voltage: 5 } } : {}) });
  }
  const push = (pts: Pt[]) => {
    const t = tidy(pts);
    if (!t) return -1;
    wires.push(t);
    return wires.length - 1;
  };
  layout.wires.forEach((w, i) => at.set(i, push(w.map(([x, y]) => [X(x), Y(y)] as Pt))));

  // Input leads: from each pin to its bus; a bus reaches every row that ends on it.
  const busRows = new Map<string, number[]>(layout.buses.map((b) => [b.sig, b.rows.map(Y)]));
  for (const sig of layout.inputs) {
    const bus = layout.buses.find((b) => b.sig === sig)!;
    const pin = ports.inputs[sig];
    if (!pin) continue;
    const bx = X(bus.x);
    if (pin[0] === ox) {
      push([pin, [bx, pin[1]]]);
      busRows.get(sig)!.push(pin[1]);
    } else {
      // A pin on the top edge (the enable of a tri-state buffer): down into the box, then across.
      const yl = oy + 2;
      push([pin, [pin[0], yl], [bx, yl]]);
      busRows.get(sig)!.push(yl);
    }
  }
  for (const b of layout.buses) {
    const rows = busRows.get(b.sig)!;
    if (!rows.length) continue;
    const y0 = Math.min(...rows);
    const y1 = Math.max(...rows);
    push([[X(b.x), y0], [X(b.x), y1]]);
    notes.push({ x: X(b.x) - 0.3, y: y0 - 0.4, text: b.sig });
  }

  // The output: from the last stage's node to the pin, with a jog to the pin's row.
  const [tx, ty] = [X(layout.out[0]), Y(layout.out[1])];
  const xj = Math.min(tx + 1, ports.out[0] - 1);
  push([[tx, ty], [xj, ty], [xj, ports.out[1]], ports.out]);
  return { components, wires, notes, transistors: ids, stageWires: layout.stageTap.map((i) => at.get(i) ?? -1) };
}
