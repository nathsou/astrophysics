/**
 * Placement by simulated annealing, in the manner of VPR.
 *
 * - **Blocks**: logic clusters (tiles), I/O pads and block RAMs, each on sites of its own kind. A carry chain is a
 *   rigid vertical macro; a move shifts the whole macro and evicts single tiles from its new footprint into the
 *   footprint it left.
 * - **Cost**: bounding-box wirelength of every net with the q(n) crossing-count correction (nets with more than
 *   `bigNet` blocks, reset- and enable-like nets, are left out), plus a **congestion** term (below), plus a
 *   timing term, the sum over connections of (estimated delay) × criticality^exponent. The wirelength and timing
 *   terms are normalised by their values at the previous temperature and combined with weight λ.
 * - **Congestion**: wirelength alone packs a design into a compact blob, and on a device with room to spare that
 *   blob is where the routing runs out (RV32I on vFPGA-L fills 56 % of the cells but, placed for wirelength alone,
 *   needs more wires in the middle than the channels there hold: a few nodes stay overused however long the router
 *   negotiates). In the spirit of the channel-occupancy cost functions of early VPR, every net puts its wirelength
 *   estimate into the coarse bins (3 × 3 tiles) its bounding box covers, and a bin whose demand is above `spreadAt`
 *   × the average is charged `spread × excess² / threshold` (in wirelength units, so it adds to the wirelength
 *   term). It is tracked incrementally from each net's bin box and rebuilt at every temperature. The design ends up
 *   spread over the die (its busiest bin carries about 1.8 times the average demand instead of 3), at the price of
 *   about 10 % more wirelength.
 * - **Schedule**: initial temperature 20 × the standard deviation of the cost over N random moves accepted
 *   unconditionally; N^(4/3) × `innerNum` moves per temperature; the cooling factor depends on the acceptance
 *   rate (0.5 above 96 %, 0.9 above 80 %, 0.95 above 15 %, 0.8 below); the range limiter follows
 *   rlim ← rlim × (1 − 0.44 + rate); the criticality exponent rises from 1 to 8 as rlim shrinks; the loop ends
 *   when T < 0.005 × cost / nets, after a final quench at T = 0.
 * - **Determinism**: a seeded generator, no other source of randomness.
 *
 * ## Trace (for the replay view)
 *
 * `trace.steps` has one entry per temperature (temperature, normalised cost, wirelength cost, timing cost,
 * acceptance rate, range limit, moves); `trace.snapshots` has up to `snapshots` copies of every block's
 * position (`x`, `y` per unit, pad index for I/O) taken at evenly spaced steps, the first random and the last
 * final.
 */
import type { VFpgaDevice } from '../devices/vfpga';
import { TILE_BRAM, TILE_LOGIC } from '../devices/vfpga';
import { FlowError } from './design';
import type { Packed } from './pack';
import { analyse, buildTimingGraph, type TimingGraph } from './sta';

export interface PlaceOptions {
  seed?: number;
  /** Moves per temperature = innerNum × N^(4/3) (default 1). */
  innerNum?: number;
  timing?: boolean;
  lambda?: number;
  /** Port name → pad name ("P12"). */
  pins?: Record<string, string>;
  maxTemps?: number;
  snapshots?: number;
  /** Nets with more blocks than this do not count in the cost. */
  bigNet?: number;
  /** Weight of the congestion term (default 2; 0 turns it off; see the header). */
  spread?: number;
  /** Bins are penalised above this multiple of the average wire demand per bin (default 1.1). */
  spreadAt?: number;
}

export interface PlaceStep {
  iter: number;
  temp: number;
  cost: number;
  bb: number;
  timing: number;
  acceptRate: number;
  rlim: number;
  moves: number;
  critExp: number;
}

export interface PlaceSnapshot {
  iter: number;
  bb: number;
  x: Int16Array;
  y: Int16Array;
  pad: Int16Array;
}

export interface PlaceTrace {
  steps: PlaceStep[];
  snapshots: PlaceSnapshot[];
  initial: { bb: number; timing: number };
  moves: number;
}

export interface Placement {
  unitX: Int16Array;
  unitY: Int16Array;
  /** Pad index of I/O units (−1 for others). */
  unitPad: Int16Array;
  /** Wirelength cost (q-corrected HPWL, tiles) and timing cost at the end. */
  bb: number;
  timing: number;
  /** Estimated critical path delay after placement (ns). */
  estPeriod: number;
  trace: PlaceTrace;
  seed: number;
}

/** VPR's crossing-count correction for nets with n terminals. */
const CROSS = [1, 1, 1, 1.0828, 1.1536, 1.2206, 1.2823, 1.3385, 1.3991, 1.4493, 1.4974, 1.5455, 1.5937, 1.6418, 1.6899, 1.7304, 1.7709, 1.8114, 1.8519, 1.8924, 1.9288, 1.9652, 2.0015, 2.0379, 2.0743, 2.1061, 2.1379, 2.1698, 2.2016, 2.2334, 2.2646, 2.2958, 2.3271, 2.3583, 2.3895, 2.4187, 2.4479, 2.4772, 2.5064, 2.5356, 2.561, 2.5864, 2.6117, 2.6371, 2.6625, 2.6887, 2.7148, 2.741, 2.7671, 2.7933];
export const crossing = (terminals: number): number => (terminals <= 50 ? CROSS[Math.max(0, terminals - 1)]! : 2.7933 + 0.02616 * (terminals - 50));

/** Estimated routing delay between two tiles (ns): greedy use of span-12, span-4 and span-1 wires, plus the connection box. */
export function estimateDelay(dx: number, dy: number): number {
  const seg = (d: number) => {
    const n12 = Math.floor(d / 12);
    d -= n12 * 12;
    const n4 = Math.floor(d / 4);
    d -= n4 * 4;
    return n12 * 0.9 + n4 * 0.5 + d * 0.3;
  };
  return 0.1 + seg(Math.abs(dx)) + seg(Math.abs(dy)) + (dx !== 0 && dy !== 0 ? 0.1 : 0);
}

/** Congestion estimate: bin size (tiles), weight and threshold (see `PlaceOptions`). */
const BIN = 3;
const SPREAD = 2;
const SPREAD_AT = 1.1;

const CLS_LOGIC = 0;
const CLS_IO = 1;
const CLS_BRAM = 2;

export function place(p: Packed, dev: VFpgaDevice, opts: PlaceOptions = {}): Placement {
  const seed = (opts.seed ?? 1) >>> 0;
  let rs = seed || 0x9e3779b9;
  const rnd = (): number => {
    // xorshift32
    rs ^= rs << 13;
    rs >>>= 0;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    rs >>>= 0;
    return rs / 4294967296;
  };
  const rint = (n: number) => Math.floor(rnd() * n);
  const NU = p.units.length;
  const useTiming = opts.timing !== false;
  const lambda = useTiming ? (opts.lambda ?? 0.5) : 0;
  const bigNet = opts.bigNet ?? 64;

  // Sites.
  const W = dev.width;
  const H = dev.height;
  const siteX: Int16Array[] = [];
  const siteY: Int16Array[] = [];
  const siteAt = [new Int32Array(W * H).fill(-1), new Int32Array(0), new Int32Array(W * H).fill(-1)];
  for (const cls of [CLS_LOGIC, CLS_BRAM]) {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        if (dev.tileKind[dev.tid(x, y)] === (cls === CLS_LOGIC ? TILE_LOGIC : TILE_BRAM)) {
          siteAt[cls]![dev.tid(x, y)] = xs.length;
          xs.push(x);
          ys.push(y);
        }
      }
    }
    siteX[cls] = Int16Array.from(xs);
    siteY[cls] = Int16Array.from(ys);
  }
  siteX[CLS_IO] = Int16Array.from(dev.pads.map((q) => q.x));
  siteY[CLS_IO] = Int16Array.from(dev.pads.map((q) => q.y));
  const occ = [new Int32Array(siteX[0]!.length).fill(-1), new Int32Array(siteX[1]!.length).fill(-1), new Int32Array(siteX[2]!.length).fill(-1)];
  const clsOf = new Uint8Array(NU);
  p.units.forEach((u, i) => (clsOf[i] = u.kind === 'logic' ? CLS_LOGIC : u.kind === 'io' ? CLS_IO : CLS_BRAM));
  const nLogic = p.units.filter((u) => u.kind === 'logic').length;
  const nBram = p.units.filter((u) => u.kind === 'bram').length;
  const nIo = p.units.filter((u) => u.kind === 'io').length;
  if (nBram > siteX[CLS_BRAM]!.length) throw new FlowError(`The design needs ${nBram} block RAMs but ${dev.name} has ${siteX[CLS_BRAM]!.length}.`, 'placement');
  if (nIo > siteX[CLS_IO]!.length) throw new FlowError(`The design has ${nIo} I/O ports but ${dev.name} has ${siteX[CLS_IO]!.length} pads.`, 'placement');
  if (nLogic > siteX[CLS_LOGIC]!.length) throw new FlowError(`The design needs ${nLogic} logic tiles but ${dev.name} has ${siteX[CLS_LOGIC]!.length}.`, 'placement');

  const usite = new Int32Array(NU).fill(-1);
  const ux = new Int16Array(NU);
  const uy = new Int16Array(NU);
  const fixed = new Uint8Array(NU);
  const setSite = (u: number, s: number) => {
    const c = clsOf[u]!;
    usite[u] = s;
    ux[u] = siteX[c]![s]!;
    uy[u] = siteY[c]![s]!;
    occ[c]![s] = u;
  };

  // Entities: single blocks and carry macros.
  const entUnits: number[][] = [];
  const entOf = new Int32Array(NU).fill(-1);
  for (const m of p.macros) {
    const e = entUnits.length;
    entUnits.push([...m.clusters]);
    for (const c of m.clusters) entOf[c] = e;
  }
  for (let u = 0; u < NU; u++) {
    if (entOf[u]! < 0) {
      entOf[u] = entUnits.length;
      entUnits.push([u]);
    }
  }
  const macroOfUnit = (u: number) => (p.units[u]!.kind === 'logic' ? p.clusters[p.units[u]!.cluster]!.macro : -1);

  // Fixed I/O: clock pads and constrained pins.
  const padByName = new Map(dev.pads.map((q) => [q.name, q.index]));
  p.netlist.ports.forEach((port, i) => {
    const u = p.portUnit[i]!;
    let pad = -1;
    const wanted = opts.pins?.[port.name];
    if (wanted !== undefined) {
      pad = padByName.get(wanted) ?? -1;
      if (pad < 0) throw new FlowError(`Pin constraint ${port.name} → ${wanted}: no such pad on ${dev.name}.`, 'placement', [port.name]);
    }
    if (p.clockGlobal[i]! >= 0) {
      const g = dev.gbPads[p.clockGlobal[i]!]!;
      if (pad >= 0 && pad !== g) throw new FlowError(`Clock ${port.name} must sit on global clock pad ${dev.pads[g]!.name}, not ${wanted}.`, 'placement', [port.name]);
      pad = g;
    }
    if (pad >= 0) {
      if (occ[CLS_IO]![pad]! >= 0) throw new FlowError(`Pad ${dev.pads[pad]!.name} is used by two ports.`, 'placement', [port.name]);
      setSite(u, pad);
      fixed[u] = 1;
    }
  });

  // Initial random placement.
  const freeSites = (cls: number) => {
    const list: number[] = [];
    for (let s = 0; s < occ[cls]!.length; s++) if (occ[cls]![s] === -1) list.push(s);
    return list;
  };
  const shuffle = (a: number[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rint(i + 1);
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  for (const cls of [CLS_IO, CLS_BRAM]) {
    const free = shuffle(freeSites(cls));
    for (let u = 0; u < NU; u++) if (clsOf[u] === cls && usite[u]! < 0) setSite(u, free.pop()!);
  }
  // Macros first (they need contiguous free tiles), then single tiles.
  const rows = dev.spec.rows;
  for (const m of p.macros) {
    const h = m.clusters.length;
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const s = rint(siteX[CLS_LOGIC]!.length);
      const x = siteX[CLS_LOGIC]![s]!;
      const y = siteY[CLS_LOGIC]![s]!;
      if (y + h - 1 > rows) continue;
      let ok = true;
      for (let i = 0; i < h && ok; i++) ok = siteAt[CLS_LOGIC]![dev.tid(x, y + i)]! >= 0 && occ[CLS_LOGIC]![siteAt[CLS_LOGIC]![dev.tid(x, y + i)]!] === -1;
      if (!ok) continue;
      m.clusters.forEach((c, i) => setSite(c, siteAt[CLS_LOGIC]![dev.tid(x, y + i)]!));
      placed = true;
    }
    for (let x = 0; x < W && !placed; x++) {
      for (let y = 1; y + h - 1 <= rows && !placed; y++) {
        let ok = true;
        for (let i = 0; i < h && ok; i++) ok = siteAt[CLS_LOGIC]![dev.tid(x, y + i)]! >= 0 && occ[CLS_LOGIC]![siteAt[CLS_LOGIC]![dev.tid(x, y + i)]!] === -1;
        if (!ok) continue;
        m.clusters.forEach((c, i) => setSite(c, siteAt[CLS_LOGIC]![dev.tid(x, y + i)]!));
        placed = true;
      }
    }
    if (!placed) throw new FlowError(`No room for a carry chain of ${h} tiles in ${dev.name}.`, 'placement');
  }
  {
    const free = shuffle(freeSites(CLS_LOGIC));
    for (let u = 0; u < NU; u++) if (clsOf[u] === CLS_LOGIC && usite[u]! < 0) setSite(u, free.pop()!);
  }

  // Cost nets: unique blocks per net.
  const nNets = p.nets.length;
  const nuStart = new Int32Array(nNets + 1);
  const nuList: number[] = [];
  const isCost = new Uint8Array(nNets);
  const qf = new Float64Array(nNets);
  p.nets.forEach((net, ni) => {
    const set = new Set<number>([net.driverUnit]);
    for (const s of net.sinks) set.add(s.unit);
    nuStart[ni] = nuList.length;
    if (set.size >= 2 && set.size <= bigNet) {
      isCost[ni] = 1;
      qf[ni] = crossing(set.size);
      for (const u of set) nuList.push(u);
    }
  });
  nuStart[nNets] = nuList.length;
  const nuArr = Int32Array.from(nuList);
  // Block → cost nets.
  const unCount = new Int32Array(NU + 1);
  for (let ni = 0; ni < nNets; ni++) for (let k = nuStart[ni]!; k < nuStart[ni + 1]!; k++) unCount[nuArr[k]! + 1]!++;
  for (let u = 0; u < NU; u++) unCount[u + 1] = unCount[u + 1]! + unCount[u]!;
  const unArr = new Int32Array(nuArr.length);
  {
    const fill = unCount.slice(0, NU);
    for (let ni = 0; ni < nNets; ni++) for (let k = nuStart[ni]!; k < nuStart[ni + 1]!; k++) unArr[fill[nuArr[k]!]!++] = ni;
  }

  // Timing.
  const tg: TimingGraph | undefined = useTiming ? buildTimingGraph(p) : undefined;
  const nConn = tg ? tg.connections.length : 0;
  const connDelay = new Float64Array(nConn);
  const critPow = new Float64Array(nConn);
  const netDrv = Int32Array.from(p.nets.map((n) => n.driverUnit));
  const sinkUnits = p.nets.map((n) => Int32Array.from(n.sinks.map((s) => s.unit)));
  const netTime = new Float64Array(nNets);
  const netBB = new Float64Array(nNets);

  let bbx0 = 0;
  let bbx1 = 0;
  let bby0 = 0;
  let bby1 = 0;
  const bbOf = (ni: number): number => {
    let xmin = 1e9;
    let xmax = -1;
    let ymin = 1e9;
    let ymax = -1;
    for (let k = nuStart[ni]!; k < nuStart[ni + 1]!; k++) {
      const u = nuArr[k]!;
      const x = ux[u]!;
      const y = uy[u]!;
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    bbx0 = xmin;
    bbx1 = xmax;
    bby0 = ymin;
    bby1 = ymax;
    return qf[ni]! * (xmax - xmin + (ymax - ymin));
  };

  // Congestion estimate: the wire demand of every net (its q-corrected half-perimeter) is spread evenly over the
  // bins its bounding box touches; a bin above a threshold adds a penalty growing with the square of the excess.
  const gamma = opts.spread ?? SPREAD;
  const alpha = opts.spreadAt ?? SPREAD_AT;
  const NBX = Math.ceil(W / BIN);
  const NBY = Math.ceil(H / BIN);
  const binD = new Float64Array(NBX * NBY);
  const netRect = new Int16Array(nNets * 4);
  let theta = 1e18;
  let totalCong = 0;
  const pen = (d: number): number => (d > theta ? (gamma * (d - theta) * (d - theta)) / theta : 0);
  const binUndo: number[] = [];
  const binUndoD: number[] = [];
  const binOfX = Int16Array.from({ length: W }, (_, x) => Math.floor(x / BIN));
  const binOfY = Int16Array.from({ length: H }, (_, y) => Math.floor(y / BIN));
  /** The demand each net has put into the bins (it is refreshed when the net's bin box changes, and at every temperature). */
  const netDem = new Float64Array(nNets);
  /** Moves net ni's demand from its old bins to the bin box (bx0..bx1, by0..by1) with demand dem; returns the penalty change. */
  const rebin = (ni: number, bx0: number, bx1: number, by0: number, by1: number, dem: number): number => {
    const ox0 = netRect[ni * 4]!;
    const ox1 = netRect[ni * 4 + 1]!;
    const oy0 = netRect[ni * 4 + 2]!;
    const oy1 = netRect[ni * 4 + 3]!;
    let d = 0;
    const oldShare = netDem[ni]! / ((ox1 - ox0 + 1) * (oy1 - oy0 + 1));
    const newShare = dem / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
    for (let bx = ox0; bx <= ox1; bx++) {
      for (let by = oy0; by <= oy1; by++) {
        const b = bx * NBY + by;
        const before = binD[b]!;
        const after = before - oldShare;
        d += pen(after) - pen(before);
        binD[b] = after;
        binUndo.push(b);
        binUndoD.push(-oldShare);
      }
    }
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let by = by0; by <= by1; by++) {
        const b = bx * NBY + by;
        const before = binD[b]!;
        const after = before + newShare;
        d += pen(after) - pen(before);
        binD[b] = after;
        binUndo.push(b);
        binUndoD.push(newShare);
      }
    }
    return d;
  };
  const revertBins = () => {
    for (let i = binUndo.length - 1; i >= 0; i--) binD[binUndo[i]!]! -= binUndoD[i]!;
    binUndo.length = 0;
    binUndoD.length = 0;
  };
  const timeOf = (ni: number): number => {
    if (!tg) return 0;
    const base = tg.netConn[ni]!;
    const d = netDrv[ni]!;
    const su = sinkUnits[ni]!;
    let t = 0;
    for (let j = 0; j < su.length; j++) {
      const dx = ux[su[j]!]! - ux[d]!;
      const dy = uy[su[j]!]! - uy[d]!;
      t += estimateDelay(dx, dy) * critPow[base + j]!;
    }
    return t;
  };
  let totalBB = 0;
  let totalT = 0;
  const recomputeAll = () => {
    totalBB = 0;
    totalT = 0;
    binD.fill(0);
    for (let ni = 0; ni < nNets; ni++) {
      if (!isCost[ni]) continue;
      netBB[ni] = bbOf(ni);
      netTime[ni] = timeOf(ni);
      totalBB += netBB[ni]!;
      totalT += netTime[ni]!;
    }
    totalCong = 0;
    if (gamma > 0) {
      theta = Math.max(1e-9, (alpha * totalBB) / (NBX * NBY));
      for (let ni = 0; ni < nNets; ni++) {
        if (!isCost[ni]) continue;
        bbOf(ni);
        const bx0 = binOfX[bbx0]!;
        const bx1 = binOfX[bbx1]!;
        const by0 = binOfY[bby0]!;
        const by1 = binOfY[bby1]!;
        netRect[ni * 4] = bx0;
        netRect[ni * 4 + 1] = bx1;
        netRect[ni * 4 + 2] = by0;
        netRect[ni * 4 + 3] = by1;
        netDem[ni] = netBB[ni]!;
        const share = netBB[ni]! / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
        for (let bx = bx0; bx <= bx1; bx++) for (let by = by0; by <= by1; by++) binD[bx * NBY + by]! += share;
      }
      for (let b = 0; b < binD.length; b++) totalCong += pen(binD[b]!);
    }
  };
  let estPeriod = 0;
  const updateCriticality = (exp: number) => {
    if (!tg) return;
    for (let ni = 0; ni < nNets; ni++) {
      const base = tg.netConn[ni]!;
      const d = netDrv[ni]!;
      const su = sinkUnits[ni]!;
      for (let j = 0; j < su.length; j++) connDelay[base + j] = estimateDelay(ux[su[j]!]! - ux[d]!, uy[su[j]!]! - uy[d]!);
    }
    const r = analyse(tg, connDelay);
    estPeriod = r.period;
    for (let c = 0; c < nConn; c++) critPow[c] = Math.pow(r.crit[c]!, exp);
  };
  updateCriticality(1);
  recomputeAll();

  const trace: PlaceTrace = { steps: [], snapshots: [], initial: { bb: totalBB, timing: totalT }, moves: 0 };
  const nSnap = opts.snapshots ?? 10;
  const snapshot = (iter: number) => {
    const pad = new Int16Array(NU).fill(-1);
    for (let u = 0; u < NU; u++) if (clsOf[u] === CLS_IO) pad[u] = usite[u]!;
    trace.snapshots.push({ iter, bb: totalBB, x: ux.slice(), y: uy.slice(), pad });
  };
  snapshot(0);

  // Movable entities.
  const movable: number[] = [];
  entUnits.forEach((us, e) => {
    if (!fixed[us[0]!]) movable.push(e);
  });
  const finish = (): Placement => {
    const pad = new Int16Array(NU).fill(-1);
    for (let u = 0; u < NU; u++) if (clsOf[u] === CLS_IO) pad[u] = usite[u]!;
    return { unitX: ux, unitY: uy, unitPad: pad, bb: totalBB, timing: totalT, estPeriod, trace, seed };
  };
  if (movable.length === 0 || nNets === 0) {
    updateCriticality(1);
    snapshot(1);
    return finish();
  }

  // Move machinery.
  const mvU: number[] = [];
  const mvNew: number[] = [];
  const mvOld: number[] = [];
  const stamp = new Int32Array(nNets);
  let stampId = 0;
  const affNets: number[] = [];
  const affBB: number[] = [];
  const affT: number[] = [];
  const affRect: number[] = [];
  let maxR = Math.max(W, H);
  let rlim = maxR;

  /** Try to build a move of entity e within range r; fills mvU/mvNew/mvOld. */
  const propose = (e: number, r: number): boolean => {
    mvU.length = 0;
    mvNew.length = 0;
    mvOld.length = 0;
    const us = entUnits[e]!;
    const u0 = us[0]!;
    const cls = clsOf[u0]!;
    if (us.length === 1) {
      let s2 = -1;
      if (cls === CLS_LOGIC) {
        const x = ux[u0]!;
        const y = uy[u0]!;
        const nx = x + rint(2 * r + 1) - r;
        const ny = y + rint(2 * r + 1) - r;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
        s2 = siteAt[CLS_LOGIC]![dev.tid(nx, ny)]!;
        if (s2 < 0) return false;
      } else {
        const n = siteX[cls]!.length;
        for (let t = 0; t < 8; t++) {
          const s = rint(n);
          if (Math.abs(siteX[cls]![s]! - ux[u0]!) <= r && Math.abs(siteY[cls]![s]! - uy[u0]!) <= r) {
            s2 = s;
            break;
          }
        }
        if (s2 < 0) return false;
      }
      const s1 = usite[u0]!;
      if (s2 === s1) return false;
      const t = occ[cls]![s2]!;
      if (t >= 0) {
        if (fixed[t] || (cls === CLS_LOGIC && macroOfUnit(t) >= 0)) return false;
        mvU.push(u0, t);
        mvOld.push(s1, s2);
        mvNew.push(s2, s1);
      } else {
        mvU.push(u0);
        mvOld.push(s1);
        mvNew.push(s2);
      }
      return true;
    }
    // Macro: shift the column.
    const h = us.length;
    const x = ux[u0]!;
    const y = uy[u0]!;
    const nx = x + rint(2 * r + 1) - r;
    const ny = y + rint(2 * r + 1) - r;
    if (nx < 0 || nx >= W || ny < 1 || ny + h - 1 > rows || (nx === x && ny === y)) return false;
    const targets: number[] = [];
    for (let i = 0; i < h; i++) {
      const s = siteAt[CLS_LOGIC]![dev.tid(nx, ny + i)]!;
      if (s < 0) return false;
      targets.push(s);
    }
    const own = new Set(us);
    const evict: number[] = [];
    for (const s of targets) {
      const o = occ[CLS_LOGIC]![s]!;
      if (o >= 0 && !own.has(o)) {
        if (macroOfUnit(o) >= 0 || fixed[o]) return false;
        evict.push(o);
      }
    }
    const targetSet = new Set(targets);
    const freed: number[] = [];
    for (const u of us) if (!targetSet.has(usite[u]!)) freed.push(usite[u]!);
    if (evict.length > freed.length) return false;
    us.forEach((u, i) => {
      mvU.push(u);
      mvOld.push(usite[u]!);
      mvNew.push(targets[i]!);
    });
    evict.forEach((o, i) => {
      mvU.push(o);
      mvOld.push(usite[o]!);
      mvNew.push(freed[i]!);
    });
    return true;
  };

  const apply = (to: number[]) => {
    for (let i = 0; i < mvU.length; i++) occ[clsOf[mvU[i]!]!]![usite[mvU[i]!]!] = -1;
    for (let i = 0; i < mvU.length; i++) setSite(mvU[i]!, to[i]!);
  };

  /** Cost change of the move already applied; leaves new net costs in aff*. */
  const evaluate = (): { dBB: number; dT: number } => {
    stampId++;
    affNets.length = 0;
    affBB.length = 0;
    affT.length = 0;
    affRect.length = 0;
    binUndo.length = 0;
    binUndoD.length = 0;
    let dBB = 0;
    let dT = 0;
    for (const u of mvU) {
      for (let k = unCount[u]!; k < unCount[u + 1]!; k++) {
        const ni = unArr[k]!;
        if (stamp[ni] === stampId) continue;
        stamp[ni] = stampId;
        const b = bbOf(ni);
        const t = timeOf(ni);
        affNets.push(ni);
        affBB.push(b);
        affT.push(t);
        dBB += b - netBB[ni]!;
        dT += t - netTime[ni]!;
        if (gamma > 0) {
          const r0 = binOfX[bbx0]!;
          const r1 = binOfX[bbx1]!;
          const r2 = binOfY[bby0]!;
          const r3 = binOfY[bby1]!;
          const k = ni * 4;
          const moved = r0 !== netRect[k] || r1 !== netRect[k + 1] || r2 !== netRect[k + 2] || r3 !== netRect[k + 3];
          affRect.push(moved ? 1 : 0, r0, r1, r2, r3);
          if (moved) dBB += rebin(ni, r0, r1, r2, r3, b);
        }
      }
    }
    return { dBB, dT };
  };
  const commit = () => {
    for (let i = 0; i < affNets.length; i++) {
      const ni = affNets[i]!;
      totalBB += affBB[i]! - netBB[ni]!;
      totalT += affT[i]! - netTime[ni]!;
      netBB[ni] = affBB[i]!;
      netTime[ni] = affT[i]!;
      if (gamma > 0 && affRect[i * 5]) {
        for (let k = 0; k < 4; k++) netRect[ni * 4 + k] = affRect[i * 5 + 1 + k]!;
        netDem[ni] = affBB[i]!;
      }
    }
    binUndo.length = 0;
    binUndoD.length = 0;
  };

  const N = movable.length;
  let prevBB = Math.max(totalBB, 1e-9);
  let prevT = Math.max(totalT, 1e-9);
  const combine = (dBB: number, dT: number) => (1 - lambda) * (dBB / prevBB) + (lambda > 0 ? lambda * (dT / prevT) : 0);

  // Initial temperature: N unconditional moves.
  const costs: number[] = [];
  let totalMoves = 0;
  let cur = 0;
  for (let i = 0, tries = 0; i < N && tries < 20 * N; tries++) {
    const e = movable[rint(N)]!;
    if (!propose(e, rlim)) continue;
    const old = mvOld.slice();
    apply(mvNew);
    const { dBB, dT } = evaluate();
    commit();
    cur += combine(dBB, dT);
    costs.push(cur);
    void old;
    i++;
    totalMoves++;
  }
  let mean = 0;
  for (const c of costs) mean += c;
  mean /= Math.max(1, costs.length);
  let variance = 0;
  for (const c of costs) variance += (c - mean) * (c - mean);
  let temp = 20 * Math.sqrt(variance / Math.max(1, costs.length));
  if (!(temp > 0)) temp = 1e-3;
  recomputeAll();
  prevBB = Math.max(totalBB, 1e-9);
  prevT = Math.max(totalT, 1e-9);

  const movesPerTemp = Math.max(N, Math.ceil((opts.innerNum ?? 1) * Math.pow(N, 4 / 3)));
  const initialRlim = rlim;
  const maxTemps = opts.maxTemps ?? 300;
  const snapEvery = Math.max(1, Math.floor(maxTemps / Math.max(1, nSnap)));
  let iter = 0;
  const runTemperature = (T: number, moves: number): number => {
    let accepted = 0;
    const r = Math.max(1, Math.round(rlim));
    for (let m = 0; m < moves; m++) {
      const e = movable[rint(N)]!;
      if (!propose(e, r)) continue;
      apply(mvNew);
      const { dBB, dT } = evaluate();
      const delta = combine(dBB, dT);
      if (delta <= 0 || (T > 0 && rnd() < Math.exp(-delta / T))) {
        commit();
        accepted++;
      } else {
        revertBins();
        apply(mvOld);
      }
    }
    totalMoves += moves;
    return accepted / moves;
  };
  // (apply(mvOld) restores because mvOld holds the previous sites of the same units.)

  const snapAt = new Set<number>();
  for (;;) {
    iter++;
    const critExp = 1 + 7 * (1 - Math.min(1, Math.max(0, (rlim - 1) / Math.max(1, initialRlim - 1))));
    updateCriticality(critExp);
    recomputeAll();
    prevBB = Math.max(totalBB, 1e-9);
    prevT = Math.max(totalT, 1e-9);
    const rate = runTemperature(temp, movesPerTemp);
    recomputeAll();
    const norm = (1 - lambda) * (totalBB / prevBB) + lambda * (totalT / prevT);
    trace.steps.push({ iter, temp, cost: norm, bb: totalBB, timing: totalT, acceptRate: rate, rlim, moves: movesPerTemp, critExp });
    if (iter % snapEvery === 0) {
      snapshot(iter);
      snapAt.add(iter);
    }
    const alpha = rate > 0.96 ? 0.5 : rate > 0.8 ? 0.9 : rate > 0.15 ? 0.95 : 0.8;
    temp *= alpha;
    rlim = Math.min(maxR, Math.max(1, rlim * (1 - 0.44 + rate)));
    if (temp < 0.005 * norm / nNets || iter >= maxTemps) break;
  }
  // Quench.
  updateCriticality(8);
  recomputeAll();
  prevBB = Math.max(totalBB, 1e-9);
  prevT = Math.max(totalT, 1e-9);
  const rate = runTemperature(0, movesPerTemp);
  recomputeAll();
  trace.steps.push({ iter: iter + 1, temp: 0, cost: (1 - lambda) * (totalBB / prevBB) + lambda * (totalT / prevT), bb: totalBB, timing: totalT, acceptRate: rate, rlim, moves: movesPerTemp, critExp: 8 });
  snapshot(iter + 1);
  trace.moves = totalMoves;
  updateCriticality(1);
  return finish();
}

/** Checks that a placement is legal: sites of the right kind, no two blocks on a site, macros contiguous. */
export function checkPlacement(p: Packed, dev: VFpgaDevice, pl: Placement): string[] {
  const errors: string[] = [];
  const used = new Set<string>();
  p.units.forEach((u, i) => {
    const x = pl.unitX[i]!;
    const y = pl.unitY[i]!;
    const kind = dev.tileKind[dev.tid(x, y)];
    const key = u.kind === 'io' ? `pad${pl.unitPad[i]}` : `${x},${y}`;
    if (used.has(key)) errors.push(`two blocks at ${key}`);
    used.add(key);
    if (u.kind === 'logic' && kind !== TILE_LOGIC) errors.push(`${u.label} is not on a logic tile`);
    if (u.kind === 'bram' && kind !== TILE_BRAM) errors.push(`${u.label} is not on a block RAM tile`);
    if (u.kind === 'io' && (pl.unitPad[i]! < 0 || dev.pads[pl.unitPad[i]!]!.x !== x || dev.pads[pl.unitPad[i]!]!.y !== y)) errors.push(`${u.label} is not on a pad`);
  });
  for (const m of p.macros) {
    const u0 = m.clusters[0]!;
    m.clusters.forEach((c, i) => {
      if (pl.unitX[c] !== pl.unitX[u0] || pl.unitY[c] !== pl.unitY[u0]! + i) errors.push(`carry macro ${m.id} is not contiguous`);
    });
  }
  return errors;
}
