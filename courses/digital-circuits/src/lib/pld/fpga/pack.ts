/**
 * Packing: cells into logic tiles, and the blocks placement and routing work with.
 *
 * A logic tile shares one clock (a global network, chosen per tile), one clock-enable pin and one set/reset pin
 * among its 8 cells: flip-flops in one tile must agree on them. Carry chains are laid out in a column:
 * cell i of the chain is cell i mod 8 of the tile i div 8 above the chain's first tile, so a chain is a **macro**
 * of vertically stacked tiles that placement moves as one. The unused cells of a chain's last tile are offered
 * to ordinary cells like any other tile's.
 *
 * Ordinary cells are grouped greedily: a seed, then the unclustered cell that shares the most nets with the
 * cluster and is compatible, until the tile is full or nothing is attracted to it. If that would need more
 * tiles than the device has, remaining small clusters are merged first-fit.
 */
import { FlowError } from './design';
import type { LcNetlist, LcSpec } from './lcnet';
import type { VFpgaDevice } from '../devices/vfpga';
import { LCS_PER_TILE } from '../devices/vfpga-arch';

export interface Cluster {
  id: number;
  /** Cell id in each of the 8 slots, −1 when empty. */
  slots: number[];
  /** Port index of the tile's clock (−1 while unset), enable net and set/reset net. */
  clk: number;
  ce: number;
  sr: number;
  /** Carry macro (−1 if none) and the tile's index within it (0 = bottom). */
  macro: number;
  macroIndex: number;
}

export interface Macro {
  id: number;
  clusters: number[];
}

/** A placeable block: a logic tile cluster, an I/O pad or a block RAM. */
export interface Unit {
  id: number;
  kind: 'logic' | 'io' | 'bram';
  label: string;
  cluster: number;
  port: number;
  ram: number;
}

export type SinkKind = 'lc' | 'ce' | 'sr' | 'pad' | 'ram';

export interface Sink {
  unit: number;
  kind: SinkKind;
  /** Cell slot (kind lc), RAM pin index (kind ram). */
  slot: number;
  /** For kind lc: index in the cell's `inputs` (its pin is fixed for chain cells, chosen by the router otherwise). */
  input: number;
}

export interface PNet {
  /** LcNet id. */
  net: number;
  name: string;
  driverUnit: number;
  /** Cell slot (logic), pad (io) or RAM data bit. */
  driverSlot: number;
  sinks: Sink[];
}

export interface Packed {
  netlist: LcNetlist;
  clusters: Cluster[];
  macros: Macro[];
  units: Unit[];
  nets: PNet[];
  /** Unit of each cell, cluster slot of each cell. */
  cellCluster: Int32Array;
  cellSlot: Int32Array;
  /** Unit index of each port and each RAM block. */
  portUnit: number[];
  ramUnit: number[];
  /** Global clock index of each clock port (−1 for others). */
  clockGlobal: number[];
  stats: { cells: number; clusters: number; macros: number; ffs: number; luts: number; carryCells: number; tilesNeeded: number };
}

const compatible = (c: Cluster, lc: LcSpec): boolean => {
  const f = lc.ff;
  if (!f) return true;
  if (c.clk >= 0 && c.clk !== f.clk) return false;
  if (f.ce >= 0 && c.ce >= 0 && c.ce !== f.ce) return false;
  if (f.sr >= 0 && c.sr >= 0 && c.sr !== f.sr) return false;
  return true;
};

const absorb = (c: Cluster, lc: LcSpec) => {
  const f = lc.ff;
  if (!f) return;
  c.clk = f.clk;
  if (f.ce >= 0) c.ce = f.ce;
  if (f.sr >= 0) c.sr = f.sr;
};

export function pack(nl: LcNetlist, dev: VFpgaDevice): Packed {
  const lcs = nl.lcs;
  const clusters: Cluster[] = [];
  const macros: Macro[] = [];
  const newCluster = (): Cluster => {
    const c: Cluster = { id: clusters.length, slots: new Array(LCS_PER_TILE).fill(-1), clk: -1, ce: -1, sr: -1, macro: -1, macroIndex: 0 };
    clusters.push(c);
    return c;
  };
  const cellCluster = new Int32Array(lcs.length).fill(-1);
  const cellSlot = new Int32Array(lcs.length).fill(-1);
  const put = (c: Cluster, slot: number, lc: LcSpec) => {
    c.slots[slot] = lc.id;
    cellCluster[lc.id] = c.id;
    cellSlot[lc.id] = slot;
    absorb(c, lc);
  };

  // Carry chains.
  const maxChain = dev.spec.rows * LCS_PER_TILE;
  nl.chains.forEach((cells, ci) => {
    if (cells.length > maxChain) {
      throw new FlowError(`Carry chain ${ci} has ${cells.length} cells but a column of ${dev.name} holds ${maxChain}.`, 'packing', cells.map((i) => lcs[i]!.label));
    }
    const macro: Macro = { id: macros.length, clusters: [] };
    macros.push(macro);
    for (let base = 0; base < cells.length; base += LCS_PER_TILE) {
      const c = newCluster();
      c.macro = macro.id;
      c.macroIndex = macro.clusters.length;
      macro.clusters.push(c.id);
      for (let i = 0; i < LCS_PER_TILE && base + i < cells.length; i++) put(c, i, lcs[cells[base + i]!]!);
    }
  });

  // Ordinary cells.
  const free = lcs.filter((lc) => cellCluster[lc.id]! < 0);
  // Nets touching each cell (small nets only).
  const cellNets: number[][] = Array.from({ length: lcs.length }, () => []);
  const netCells = new Map<number, number[]>();
  const touch = (net: number, lc: number) => {
    if (net < 0) return;
    let l = netCells.get(net);
    if (!l) netCells.set(net, (l = []));
    if (!l.includes(lc)) l.push(lc);
  };
  for (const lc of lcs) {
    for (const n of lc.inputs) touch(n, lc.id);
    touch(lc.out, lc.id);
    if (lc.ff) {
      touch(lc.ff.ce, lc.id);
      touch(lc.ff.sr, lc.id);
    }
  }
  for (const [net, cells] of netCells) {
    if (cells.length > 12) continue;
    for (const c of cells) cellNets[c]!.push(net);
  }
  const unclustered = new Set(free.map((l) => l.id));
  const score = new Map<number, number>();
  const addCluster = (c: Cluster, lc: LcSpec) => {
    const slot = c.slots.indexOf(-1);
    put(c, slot, lc);
    unclustered.delete(lc.id);
    for (const net of cellNets[lc.id]!) {
      for (const other of netCells.get(net)!) if (unclustered.has(other)) score.set(other, (score.get(other) ?? 0) + 1);
    }
  };
  const grow = (c: Cluster) => {
    score.clear();
    for (const s of c.slots) {
      if (s < 0) continue;
      for (const net of cellNets[s]!) for (const other of netCells.get(net)!) if (unclustered.has(other)) score.set(other, (score.get(other) ?? 0) + 1);
    }
    while (c.slots.includes(-1)) {
      let best = -1;
      let bestScore = 0;
      for (const [id, sc] of score) {
        if (!unclustered.has(id) || !compatible(c, lcs[id]!)) continue;
        if (sc > bestScore || (sc === bestScore && id < best)) {
          best = id;
          bestScore = sc;
        }
      }
      if (best < 0) break;
      addCluster(c, lcs[best]!);
    }
  };
  // First, the free slots of chain tiles.
  for (const c of [...clusters]) if (c.slots.includes(-1)) grow(c);
  const order = free.filter((l) => unclustered.has(l.id)).sort((a, b) => cellNets[b.id]!.length - cellNets[a.id]!.length || a.id - b.id);
  for (const seed of order) {
    if (!unclustered.has(seed.id)) continue;
    const c = newCluster();
    score.clear();
    addCluster(c, seed);
    grow(c);
  }

  // Merge small clusters. Connectivity-driven growth stops when nothing is attracted to a tile, which leaves many
  // tiles with one or two cells; the design would then spread over the whole device (and, on a crowded device, be
  // forced into an arbitrary first-fit merge). Instead the smallest tiles are merged into the tile they share the
  // most nets with (any tile with room and a compatible control set if they share none), best fit first, so tiles
  // end up as full as the flip-flop control sets allow. Dense tiles leave the placer free space to work in, and
  // nets inside a tile need no routing at all.
  let logicTiles = 0;
  for (let t = 0; t < dev.tileKind.length; t++) if (dev.tileKind[t] === 1) logicTiles++;
  {
    const count = (c: Cluster) => c.slots.reduce((n, x) => n + (x >= 0 ? 1 : 0), 0);
    const cellsOf = (c: Cluster) => c.slots.filter((x) => x >= 0).map((x) => lcs[x]!);
    const small = clusters
      .filter((c) => c.macro < 0 && count(c) > 0 && count(c) < LCS_PER_TILE)
      .sort((a, b) => count(a) - count(b) || a.id - b.id);
    // Tiles that can still take cells: chain tiles with free slots and ordinary tiles.
    const open = new Set<Cluster>(clusters.filter((c) => count(c) > 0 && count(c) < LCS_PER_TILE));
    for (const a of small) {
      const cnt = count(a);
      if (cnt === 0) continue;
      const cells = cellsOf(a);
      // Tiles that share nets with `a`.
      const shared = new Map<Cluster, number>();
      for (const lc of cells) {
        for (const net of cellNets[lc.id]!) {
          for (const other of netCells.get(net)!) {
            const b = clusters[cellCluster[other]!]!;
            if (b !== a && open.has(b)) shared.set(b, (shared.get(b) ?? 0) + 1);
          }
        }
      }
      const fits = (b: Cluster): boolean => {
        if (LCS_PER_TILE - count(b) < cnt) return false;
        const probe: Cluster = { ...b, slots: [...b.slots] };
        return cells.every((lc) => compatible(probe, lc) && (absorb(probe, lc), true));
      };
      let target: Cluster | undefined;
      let bestShared = 0;
      for (const [b, sc] of shared) {
        if (sc > bestShared || (sc === bestShared && target && b.id < target.id)) {
          if (fits(b)) {
            target = b;
            bestShared = sc;
          }
        }
      }
      if (!target) {
        // Best fit: the fullest tile that still has room.
        let bestFree = LCS_PER_TILE + 1;
        for (const b of open) {
          if (b === a) continue;
          const f = LCS_PER_TILE - count(b);
          if (f < cnt || f > bestFree || (f === bestFree && target && b.id > target.id)) continue;
          if (fits(b)) {
            target = b;
            bestFree = f;
          }
        }
      }
      if (!target) continue;
      for (const lc of cells) put(target, target.slots.indexOf(-1), lc);
      a.slots.fill(-1);
      open.delete(a);
      if (count(target) === LCS_PER_TILE) open.delete(target);
    }
  }
  // Drop empty clusters, renumbering.
  const keep = clusters.filter((c) => c.slots.some((s) => s >= 0));
  const remap = new Map<number, number>();
  keep.forEach((c, i) => remap.set(c.id, i));
  keep.forEach((c, i) => (c.id = i));
  for (const m of macros) m.clusters = m.clusters.map((c) => remap.get(c)!);
  for (const c of keep) for (const s of c.slots) if (s >= 0) cellCluster[s] = c.id;

  if (keep.length > logicTiles) {
    throw new FlowError(`The design needs ${keep.length} logic tiles but ${dev.name} has ${logicTiles}.`, 'packing');
  }

  // Units.
  const units: Unit[] = [];
  for (const c of keep) units.push({ id: units.length, kind: 'logic', label: `tile${c.id}`, cluster: c.id, port: -1, ram: -1 });
  const portUnit: number[] = [];
  nl.ports.forEach((p, i) => {
    portUnit[i] = units.length;
    units.push({ id: units.length, kind: 'io', label: p.name, cluster: -1, port: i, ram: -1 });
  });
  const ramUnit: number[] = [];
  nl.rams.forEach((r, i) => {
    ramUnit[i] = units.length;
    units.push({ id: units.length, kind: 'bram', label: r.name, cluster: -1, port: -1, ram: i });
  });

  // Clocks.
  const clockGlobal: number[] = nl.ports.map(() => -1);
  let g = 0;
  const clocks = nl.ports.map((p, i) => (p.clock ? i : -1)).filter((i) => i >= 0);
  for (const i of clocks) {
    if (g >= dev.spec.globals) throw new FlowError(`The design has ${clocks.length} clocks but ${dev.name} has ${dev.spec.globals} global clock networks.`, 'packing', clocks.map((k) => nl.ports[k]!.name));
    clockGlobal[i] = g++;
  }

  // Nets between units.
  const pnets: PNet[] = [];
  const byNet = new Map<number, PNet>();
  const getNet = (id: number): PNet | undefined => {
    let p = byNet.get(id);
    if (p) return p;
    const n = nl.nets[id]!;
    let driverUnit = -1;
    let driverSlot = 0;
    if (n.driver.kind === 'lc') {
      const lcId = n.driver.lc;
      driverUnit = cellCluster[lcId]!;
      driverSlot = cellSlot[lcId]!;
    } else if (n.driver.kind === 'port') {
      driverUnit = portUnit[n.driver.port]!;
    } else {
      driverUnit = ramUnit[n.driver.ram]!;
      driverSlot = n.driver.bit;
    }
    p = { net: id, name: n.name, driverUnit, driverSlot, sinks: [] };
    byNet.set(id, p);
    pnets.push(p);
    return p;
  };
  const addSink = (net: number, s: Sink) => {
    if (net < 0) return;
    getNet(net)!.sinks.push(s);
  };
  for (const lc of lcs) {
    const cl = cellCluster[lc.id]!;
    const slot = cellSlot[lc.id]!;
    lc.inputs.forEach((n, i) => addSink(n, { unit: cl, kind: 'lc', slot, input: i }));
    if (lc.ff) {
      addSink(lc.ff.ce, { unit: cl, kind: 'ce', slot, input: -1 });
      addSink(lc.ff.sr, { unit: cl, kind: 'sr', slot, input: -1 });
    }
  }
  nl.ports.forEach((p, i) => {
    if (p.dir === 'out') addSink(p.net, { unit: portUnit[i]!, kind: 'pad', slot: 0, input: -1 });
  });
  nl.rams.forEach((r, i) => {
    const u = ramUnit[i]!;
    r.raddr.forEach((n, k) => addSink(n, { unit: u, kind: 'ram', slot: k, input: -1 }));
    r.waddr.forEach((n, k) => addSink(n, { unit: u, kind: 'ram', slot: 11 + k, input: -1 }));
    r.wdata.forEach((n, k) => addSink(n, { unit: u, kind: 'ram', slot: 22 + k, input: -1 }));
    addSink(r.re, { unit: u, kind: 'ram', slot: 38, input: -1 });
    addSink(r.we, { unit: u, kind: 'ram', slot: 39, input: -1 });
  });
  // Only nets with sinks are routed; ensure drivers exist for nets that are read.
  const nets = pnets.filter((p) => p.sinks.length > 0 && p.driverUnit >= 0);

  const ffs = lcs.filter((l) => l.ff).length;
  return {
    netlist: nl,
    clusters: keep,
    macros,
    units,
    nets,
    cellCluster,
    cellSlot,
    portUnit,
    ramUnit,
    clockGlobal,
    stats: {
      cells: lcs.length,
      clusters: keep.length,
      macros: macros.length,
      ffs,
      luts: lcs.filter((l) => l.kind === 'lut' || l.kind === 'const' || l.kind === 'invert').length,
      carryCells: nl.chains.reduce((s, c) => s + c.length, 0),
      tilesNeeded: Math.ceil(lcs.length / LCS_PER_TILE),
    },
  };
}
