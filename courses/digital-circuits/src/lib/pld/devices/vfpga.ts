/**
 * The virtual FPGA: device model and routing-resource graph.
 *
 * `getVFpga('S' | 'M' | 'L')` builds (once) a `VFpgaDevice`: the tile grid, the **routing-resource graph** (RR
 * graph) and the layout of the configuration memory. Configuration bits, bitstreams and the hand-configuration
 * API are in `vfpga-config.ts`.
 *
 * ## Routing
 *
 * Routing is built from unidirectional, single-driver multiplexers, as in modern FPGAs, so every configuration
 * decodes to a legal netlist and contention cannot happen.
 *
 * - **Wires.** Every non-empty tile *starts* wires in each of the four directions E, N, W, S. A wire has a span
 *   of 1, 4 or 12 tiles and one driver: the switch-box multiplexer of its starting tile. It can be tapped only at
 *   its far end (the iCE40's wires can also be tapped along their length; leaving that out keeps the graph small).
 *   A wire exists only if its far end is on the die.
 * - **Switch box.** The multiplexer of a wire starting at tile T can select: the wires of the same direction
 *   that *arrive* at T (straight on, one per span), wires arriving from the two perpendicular directions (a turn,
 *   one per span, on a neighbouring track so that tracks mix), and four of the tile's own outputs (logic cell
 *   outputs, RAM data outputs or pad inputs).
 * - **Connection box.** The multiplexer in front of a tile pin (a LUT input, clock-enable, set/reset, RAM pin or
 *   pad output) selects among a fixed subset of the wires arriving at the tile, plus four local outputs.
 * - **Select codes.** A multiplexer with n inputs has ceil(log2(n + 1)) configuration bits; code 0 means "nothing
 *   selected" (the net is undriven, Z in the simulation), code k > 0 selects input k − 1, and codes above n are
 *   reserved and also read as "nothing".
 * - **Global clocks.** `globals` clock networks are each fed by one dedicated pad (`gbPads`). Every flip-flop
 *   chooses one of them per tile (`clk_sel`). Clock networks are ideal (no skew) and not part of routing.
 * - **Carry.** The carry chain runs through the cells of a column, cell 0 → 7 and then into cell 0 of the tile
 *   above; it is a dedicated wire, not in the RR graph.
 *
 * ## Differences from the iCE40
 *
 * Wires can only be tapped at their end; there are no local-track/"glb2local" stages, so a connection box selects
 * straight from wires; a tile has 4 pads per I/O tile (2 in S) and one clock per tile that comes from a global
 * network only; the block RAM occupies one tile; sizes are much smaller.
 *
 * ## Node numbering
 *
 * Nodes are numbered tile by tile in column order (all tiles of column 0 by increasing y, then column 1, …). In
 * a tile: sources (`LCO`, `PADI`, `RAMO`), then sinks (`LCI`, `CE`, `SR`, `PADO`, `RAMI`), then the wires that
 * start there. The global clock nodes come last.
 */
import { LCS_PER_TILE, LC_BITS, LUT_INPUTS, BRAM_BITS, VFPGA_DELAYS, VFPGA_SPECS, type VFpgaSize, type VFpgaSpec } from './vfpga-arch';

export const TILE_EMPTY = 0;
export const TILE_LOGIC = 1;
export const TILE_IO = 2;
export const TILE_BRAM = 3;
export type TileKind = 0 | 1 | 2 | 3;

/** Node kinds of the RR graph. */
export const NK = { LCO: 0, LCI: 1, CE: 2, SR: 3, PADI: 4, PADO: 5, RAMO: 6, RAMI: 7, WIRE: 8, GCLK: 9 } as const;
export const NODE_KIND_NAMES = ['LCO', 'LCI', 'CE', 'SR', 'PADI', 'PADO', 'RAMO', 'RAMI', 'W', 'GCLK'] as const;

/** Directions: E, N, W, S. */
export const DIR_NAMES = ['E', 'N', 'W', 'S'] as const;
export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

/** Pins of a block RAM tile, in sink order: RADDR0…10, WADDR0…10, WDATA0…15, RE, WE. */
export const RAM_PIN_COUNT = 40;
export const RAM_RADDR = 0;
export const RAM_WADDR = 11;
export const RAM_WDATA = 22;
export const RAM_RE = 38;
export const RAM_WE = 39;
export const ramPinName = (p: number): string =>
  p < RAM_WADDR ? `RADDR${p}` : p < RAM_WDATA ? `WADDR${p - RAM_WADDR}` : p < RAM_RE ? `WDATA${p - RAM_WDATA}` : p === RAM_RE ? 'RE' : 'WE';
export function ramPinIndex(name: string): number {
  if (name === 'RE') return RAM_RE;
  if (name === 'WE') return RAM_WE;
  const m = /^(RADDR|WADDR|WDATA)(\d+)$/.exec(name);
  if (!m) return -1;
  return (m[1] === 'RADDR' ? RAM_RADDR : m[1] === 'WADDR' ? RAM_WADDR : RAM_WDATA) + Number(m[2]);
}

export interface PadInfo {
  /** Index in `device.pads` (also the bit position on the virtual board's pin list). */
  index: number;
  /** "P0", "P1", … in ring order: top row left to right, right column downwards, bottom row right to left, left column upwards. */
  name: string;
  x: number;
  y: number;
  /** Pad number within its tile. */
  slot: number;
}

export interface WireKind {
  span: 1 | 4 | 12;
  /** Track within its span group. */
  track: number;
  /** Index of the span group (0: span 1, 1: span 4, 2: span 12). */
  group: number;
}

export interface VFpgaDevice {
  readonly spec: VFpgaSpec;
  readonly name: string;
  readonly size: VFpgaSize;
  /** Grid size in tiles, including the I/O ring. */
  readonly width: number;
  readonly height: number;
  /** Tile kind at `tid(x, y)`. */
  readonly tileKind: Uint8Array;
  /** Tile index of (x, y): x * height + y. */
  tid(x: number, y: number): number;
  tileX(tid: number): number;
  tileY(tid: number): number;

  // The RR graph.
  readonly nodeCount: number;
  readonly nodeKind: Uint8Array;
  readonly nodeX: Int16Array;
  readonly nodeY: Int16Array;
  /** Cell*4+pin (LCI), cell (LCO), pad slot, RAM pin or data bit, local wire index, global index. */
  readonly nodeIdx: Int16Array;
  /** Delay of passing through the node, ns. */
  readonly nodeDelay: Float32Array;
  readonly nodeTile: Int32Array;
  /** Multiplexer inputs (fan-in), CSR. The select code of input i of node n is i + 1. */
  readonly inStart: Int32Array;
  readonly inList: Int32Array;
  /** Fan-out, CSR. */
  readonly outStart: Int32Array;
  readonly outList: Int32Array;
  /** Wire kinds within a direction, and the wire nodes: wireNode[tid * wireSlots + dir * wireKinds.length + kind]. */
  readonly wireKinds: WireKind[];
  readonly wireSlots: number;
  readonly wireNode: Int32Array;
  /** First node of each tile (length tiles + 1), then the global clock nodes are gclkBase + g. */
  readonly tileNodeStart: Int32Array;
  readonly gclkBase: number;

  // Configuration memory layout.
  readonly totalBits: number;
  /** Bits of the select field of node n (0 for nodes without a multiplexer) and its absolute offset. */
  readonly cfgWidth: Uint8Array;
  readonly cfgOffset: Int32Array;
  /** Absolute bit offset and length of each tile's configuration. */
  readonly tileCfgOffset: Int32Array;
  readonly tileCfgBits: Int32Array;
  /** One frame per tile column: [start, length] in bits. */
  readonly frames: { start: number; length: number }[];
  /** Bits of a clock-select field (ceil(log2(globals))). */
  readonly clkBits: number;

  readonly pads: PadInfo[];
  /** Pad index driving each global clock network. */
  readonly gbPads: number[];
  /** padAt[tid * padsPerTile + slot] → pad index. */
  padAt(x: number, y: number, slot: number): number;

  // Node lookup.
  lcOut(x: number, y: number, k: number): number;
  lcIn(x: number, y: number, k: number, i: number): number;
  ce(x: number, y: number): number;
  sr(x: number, y: number): number;
  padIn(pad: number): number;
  padOut(pad: number): number;
  ramOut(x: number, y: number, bit: number): number;
  ramIn(x: number, y: number, pin: number): number;
  wire(x: number, y: number, dir: number, span: 1 | 4 | 12, track: number): number;
  gclk(g: number): number;

  nodeName(n: number): string;
  /** Node from a name such as "LCO(1,1,3)", "W(2,1,E,1,0)"; −1 if there is none. */
  findNode(name: string): number;
  /** The select code that makes sink/wire node `to` read `from`, or 0 if `from` is not one of its inputs. */
  selectFor(to: number, from: number): number;
  /** Shortest path (fewest nodes) through the RR graph, including both ends; [] if unreachable. */
  shortestPath(from: number, to: number): number[];
  /** Number of logic cells / block RAMs / pads. */
  readonly counts: { lcs: number; logicTiles: number; brams: number; pads: number; nodes: number; edges: number; bits: number };
}

const muxBits = (n: number): number => (n <= 0 ? 0 : Math.ceil(Math.log2(n + 1)));
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function build(spec: VFpgaSpec): VFpgaDevice {
  const W = spec.cols + 2;
  const H = spec.rows + 2;
  const NT = W * H;
  const tid = (x: number, y: number) => x * H + y;
  const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  const tileKind = new Uint8Array(NT);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const interior = x >= 1 && x <= spec.cols && y >= 1 && y <= spec.rows;
      const ring = ((x === 0 || x === W - 1) && y >= 1 && y <= spec.rows) || ((y === 0 || y === H - 1) && x >= 1 && x <= spec.cols);
      tileKind[tid(x, y)] = interior ? (spec.bramCols.includes(x) ? TILE_BRAM : TILE_LOGIC) : ring ? TILE_IO : TILE_EMPTY;
    }
  }

  // Wire kinds.
  const groups: { span: 1 | 4 | 12; tracks: number; base: number }[] = [];
  const wireKinds: WireKind[] = [];
  ([
    [1, spec.tracks.s1],
    [4, spec.tracks.s4],
    [12, spec.tracks.s12],
  ] as const).forEach(([span, tracks], g) => {
    groups.push({ span, tracks, base: wireKinds.length });
    for (let t = 0; t < tracks; t++) wireKinds.push({ span, track: t, group: g });
  });
  const nk = wireKinds.length;
  const WS = 4 * nk;

  const nSrcOf = (k: number) => (k === TILE_LOGIC ? LCS_PER_TILE : k === TILE_IO ? spec.padsPerTile : k === TILE_BRAM ? 16 : 0);
  const nSinkOf = (k: number) => (k === TILE_LOGIC ? LCS_PER_TILE * LUT_INPUTS + 2 : k === TILE_IO ? spec.padsPerTile : k === TILE_BRAM ? 40 : 0);

  const wireExists = (x: number, y: number, d: number, kk: number): boolean => {
    if (tileKind[tid(x, y)] === TILE_EMPTY) return false;
    const span = wireKinds[kk]!.span;
    const ex = x + DX[d]! * span;
    const ey = y + DY[d]! * span;
    return inGrid(ex, ey) && tileKind[tid(ex, ey)] !== TILE_EMPTY;
  };

  // Phase 1: assign node ids.
  const wireNode = new Int32Array(NT * WS).fill(-1);
  const tileNodeStart = new Int32Array(NT + 1);
  let count = 0;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const t = tid(x, y);
      tileNodeStart[t] = count;
      const kind = tileKind[t]!;
      if (kind === TILE_EMPTY) continue;
      count += nSrcOf(kind) + nSinkOf(kind);
      for (let d = 0; d < 4; d++) for (let kk = 0; kk < nk; kk++) if (wireExists(x, y, d, kk)) wireNode[t * WS + d * nk + kk] = count++;
    }
  }
  tileNodeStart[NT] = count;
  const gclkBase = count;
  count += spec.globals;
  const N = count;

  const nodeKind = new Uint8Array(N);
  const nodeX = new Int16Array(N);
  const nodeY = new Int16Array(N);
  const nodeIdx = new Int16Array(N);
  const nodeDelay = new Float32Array(N);
  const nodeTile = new Int32Array(N).fill(-1);
  const D = VFPGA_DELAYS;
  const spanDelay = { 1: D.span1, 4: D.span4, 12: D.span12 } as const;

  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const t = tid(x, y);
      const kind = tileKind[t]!;
      if (kind === TILE_EMPTY) continue;
      let n = tileNodeStart[t]!;
      const set = (nk_: number, idx: number, delay: number) => {
        nodeKind[n] = nk_;
        nodeX[n] = x;
        nodeY[n] = y;
        nodeIdx[n] = idx;
        nodeDelay[n] = delay;
        nodeTile[n] = t;
        n++;
      };
      if (kind === TILE_LOGIC) {
        for (let k = 0; k < LCS_PER_TILE; k++) set(NK.LCO, k, 0);
        for (let p = 0; p < LCS_PER_TILE * LUT_INPUTS; p++) set(NK.LCI, p, D.switch);
        set(NK.CE, 0, D.switch);
        set(NK.SR, 0, D.switch);
      } else if (kind === TILE_IO) {
        for (let s = 0; s < spec.padsPerTile; s++) set(NK.PADI, s, 0);
        for (let s = 0; s < spec.padsPerTile; s++) set(NK.PADO, s, D.switch);
      } else {
        for (let b = 0; b < 16; b++) set(NK.RAMO, b, 0);
        for (let p = 0; p < 40; p++) set(NK.RAMI, p, D.switch);
      }
      for (let d = 0; d < 4; d++) {
        for (let kk = 0; kk < nk; kk++) {
          const w = wireNode[t * WS + d * nk + kk]!;
          if (w < 0) continue;
          n = w;
          set(NK.WIRE, d * nk + kk, D.switch + spanDelay[wireKinds[kk]!.span]);
        }
      }
    }
  }
  for (let g = 0; g < spec.globals; g++) {
    nodeKind[gclkBase + g] = NK.GCLK;
    nodeIdx[gclkBase + g] = g;
    nodeDelay[gclkBase + g] = D.gclk;
  }

  // Pads, in ring order.
  const pads: PadInfo[] = [];
  const padTileFirst = new Int32Array(NT).fill(-1);
  const addTilePads = (x: number, y: number) => {
    padTileFirst[tid(x, y)] = pads.length;
    for (let s = 0; s < spec.padsPerTile; s++) pads.push({ index: pads.length, name: `P${pads.length}`, x, y, slot: s });
  };
  const topPadCandidates: number[] = [];
  for (let x = 1; x <= spec.cols; x++) {
    const first = pads.length;
    addTilePads(x, H - 1);
    for (let s = 0; s < spec.padsPerTile; s++) topPadCandidates.push(first + s);
  }
  for (let y = spec.rows; y >= 1; y--) addTilePads(W - 1, y);
  for (let x = spec.cols; x >= 1; x--) addTilePads(x, 0);
  for (let y = 1; y <= spec.rows; y++) addTilePads(0, y);
  const gbPads: number[] = [];
  for (let g = 0; g < spec.globals; g++) gbPads.push(topPadCandidates[Math.floor((g * topPadCandidates.length) / spec.globals)]!);
  const padSourceNode = (p: number) => tileNodeStart[tid(pads[p]!.x, pads[p]!.y)]! + pads[p]!.slot;

  // Phase 2: multiplexer inputs.
  const arrival = (x: number, y: number, d: number, g: number, t: number): number => {
    const span = groups[g]!.span;
    const sx = x - DX[d]! * span;
    const sy = y - DY[d]! * span;
    if (!inGrid(sx, sy)) return -1;
    return wireNode[tid(sx, sy) * WS + d * nk + groups[g]!.base + t]!;
  };
  const arrivalsList = (x: number, y: number): number[] => {
    const out: number[] = [];
    for (let d = 0; d < 4; d++) {
      for (let g = 0; g < groups.length; g++) {
        for (let t = 0; t < groups[g]!.tracks; t++) {
          const a = arrival(x, y, d, g, t);
          if (a >= 0) out.push(a);
        }
      }
    }
    return out;
  };
  const arrCache = new Map<number, number[]>();
  const arrivalsOf = (x: number, y: number) => {
    const t = tid(x, y);
    let a = arrCache.get(t);
    if (!a) arrCache.set(t, (a = arrivalsList(x, y)));
    return a;
  };

  const inS: number[] = [];
  const inStart = new Int32Array(N + 1);
  const pushUnique = (list: number[], n: number) => {
    if (n >= 0 && !list.includes(n)) list.push(n);
  };

  for (let n = 0; n < N; n++) {
    inStart[n] = inS.length;
    const kind = nodeKind[n]!;
    if (kind === NK.GCLK) {
      inS.push(padSourceNode(gbPads[nodeIdx[n]!]!));
      continue;
    }
    if (kind === NK.LCO || kind === NK.PADI || kind === NK.RAMO) continue;
    const x = nodeX[n]!;
    const y = nodeY[n]!;
    const t = nodeTile[n]!;
    const nSrc = nSrcOf(tileKind[t]!);
    const base = tileNodeStart[t]!;
    const cand: number[] = [];
    if (kind === NK.WIRE) {
      const li = nodeIdx[n]!;
      const d = Math.floor(li / nk);
      const kk = li % nk;
      const g = wireKinds[kk]!.group;
      const track = wireKinds[kk]!.track;
      for (let gg = 0; gg < groups.length; gg++) if (groups[gg]!.tracks > 0) pushUnique(cand, arrival(x, y, d, gg, track % groups[gg]!.tracks));
      const p1 = (d + 1) & 3;
      const p2 = (d + 3) & 3;
      for (let gg = 0; gg < groups.length; gg++) {
        const T = groups[gg]!.tracks;
        if (T === 0) continue;
        pushUnique(cand, arrival(x, y, p1, gg, (track + 1) % T));
        pushUnique(cand, arrival(x, y, p2, gg, (track + T - 1) % T));
      }
      for (let j = 0; j < 4; j++) pushUnique(cand, base + ((2 * kk + d + 3 * j + g) % nSrc));
    } else {
      // A sink: pin index within the tile's sinks.
      const pin = n - base - nSrc;
      const arr = arrivalsOf(x, y);
      const A = arr.length;
      if (A > 0) {
        const want = Math.min(spec.cbWires, A);
        let step = 3;
        while (A > 1 && gcd(step, A) !== 1) step += 2;
        if (A === 1) step = 1;
        const b0 = (pin * 5) % A;
        for (let j = 0; j < want; j++) pushUnique(cand, arr[(b0 + step * j) % A]!);
      }
      for (let j = 0; j < spec.cbLocal; j++) pushUnique(cand, base + ((pin + 3 * j) % nSrc));
    }
    for (const c of cand) inS.push(c);
  }
  inStart[N] = inS.length;
  const inList = Int32Array.from(inS);

  // Fan-out.
  const outStart = new Int32Array(N + 1);
  for (let i = 0; i < inList.length; i++) outStart[inList[i]! + 1]!++;
  for (let n = 0; n < N; n++) outStart[n + 1] = outStart[n + 1]! + outStart[n]!;
  const outList = new Int32Array(inList.length);
  {
    const fill = outStart.slice(0, N);
    for (let n = 0; n < N; n++) for (let i = inStart[n]!; i < inStart[n + 1]!; i++) outList[fill[inList[i]!]!++] = n;
  }

  // Configuration layout.
  const clkBits = spec.globals <= 1 ? 0 : Math.ceil(Math.log2(spec.globals));
  const siteBits = (kind: number): number =>
    kind === TILE_LOGIC ? clkBits + 1 + LCS_PER_TILE * LC_BITS : kind === TILE_IO ? 2 * spec.padsPerTile : kind === TILE_BRAM ? 3 + 2 * clkBits + BRAM_BITS : 0;
  const cfgWidth = new Uint8Array(N);
  const cfgOffset = new Int32Array(N).fill(-1);
  const tileCfgOffset = new Int32Array(NT);
  const tileCfgBits = new Int32Array(NT);
  const frames: { start: number; length: number }[] = [];
  let bitPos = 0;
  for (let x = 0; x < W; x++) {
    const frameStart = bitPos;
    for (let y = 0; y < H; y++) {
      const t = tid(x, y);
      tileCfgOffset[t] = bitPos;
      const kind = tileKind[t]!;
      if (kind === TILE_EMPTY) continue;
      let off = bitPos + siteBits(kind);
      for (let n = tileNodeStart[t]!; n < tileNodeStart[t + 1]!; n++) {
        const w = muxBits(inStart[n + 1]! - inStart[n]!);
        if (w === 0 || nodeKind[n] === NK.GCLK) continue;
        cfgWidth[n] = w;
        cfgOffset[n] = off;
        off += w;
      }
      tileCfgBits[t] = off - bitPos;
      bitPos = off;
    }
    frames.push({ start: frameStart, length: bitPos - frameStart });
  }
  const totalBits = bitPos;

  const tileNodeStartAt = (x: number, y: number) => tileNodeStart[tid(x, y)]!;
  const padAtTile = (x: number, y: number, slot: number) => padTileFirst[tid(x, y)]! + slot;

  let lcs = 0;
  let logicTiles = 0;
  let brams = 0;
  for (let t = 0; t < NT; t++) {
    if (tileKind[t] === TILE_LOGIC) {
      logicTiles++;
      lcs += LCS_PER_TILE;
    } else if (tileKind[t] === TILE_BRAM) brams++;
  }

  const nodeName = (n: number): string => {
    const kind = nodeKind[n]!;
    const x = nodeX[n]!;
    const y = nodeY[n]!;
    const i = nodeIdx[n]!;
    switch (kind) {
      case NK.LCO:
        return `LCO(${x},${y},${i})`;
      case NK.LCI:
        return `LCI(${x},${y},${i >> 2},${i & 3})`;
      case NK.CE:
        return `CE(${x},${y})`;
      case NK.SR:
        return `SR(${x},${y})`;
      case NK.PADI:
        return `PADI(${x},${y},${i})`;
      case NK.PADO:
        return `PADO(${x},${y},${i})`;
      case NK.RAMO:
        return `RAMO(${x},${y},${i})`;
      case NK.RAMI:
        return `RAMI(${x},${y},${ramPinName(i)})`;
      case NK.WIRE: {
        const wk = wireKinds[i % nk]!;
        return `W(${x},${y},${DIR_NAMES[Math.floor(i / nk)]},${wk.span},${wk.track})`;
      }
      default:
        return `GCLK(${i})`;
    }
  };

  const dev: VFpgaDevice = {
    spec,
    name: spec.name,
    size: spec.size,
    width: W,
    height: H,
    tileKind,
    tid,
    tileX: (t) => Math.floor(t / H),
    tileY: (t) => t % H,
    nodeCount: N,
    nodeKind,
    nodeX,
    nodeY,
    nodeIdx,
    nodeDelay,
    nodeTile,
    inStart,
    inList,
    outStart,
    outList,
    wireKinds,
    wireSlots: WS,
    wireNode,
    tileNodeStart,
    gclkBase,
    totalBits,
    cfgWidth,
    cfgOffset,
    tileCfgOffset,
    tileCfgBits,
    frames,
    clkBits,
    pads,
    gbPads,
    padAt: padAtTile,
    lcOut: (x, y, k) => tileNodeStartAt(x, y) + k,
    lcIn: (x, y, k, i) => tileNodeStartAt(x, y) + LCS_PER_TILE + k * LUT_INPUTS + i,
    ce: (x, y) => tileNodeStartAt(x, y) + LCS_PER_TILE + LCS_PER_TILE * LUT_INPUTS,
    sr: (x, y) => tileNodeStartAt(x, y) + LCS_PER_TILE + LCS_PER_TILE * LUT_INPUTS + 1,
    padIn: (p) => padSourceNode(p),
    padOut: (p) => padSourceNode(p) + spec.padsPerTile,
    ramOut: (x, y, b) => tileNodeStartAt(x, y) + b,
    ramIn: (x, y, p) => tileNodeStartAt(x, y) + 16 + p,
    wire: (x, y, d, span, track) => {
      const kk = wireKinds.findIndex((w) => w.span === span && w.track === track);
      if (kk < 0 || !inGrid(x, y)) return -1;
      return wireNode[tid(x, y) * WS + d * nk + kk]!;
    },
    gclk: (g) => gclkBase + g,
    nodeName,
    findNode: (name) => {
      const m = /^([A-Z]+)\(([^)]*)\)$/.exec(name.trim());
      if (!m) return -1;
      const a = m[2]!.split(',').map((s) => s.trim());
      const num = (i: number) => Number(a[i]);
      const okTile = (): boolean => inGrid(num(0), num(1)) && !Number.isNaN(num(0) + num(1));
      let id = -1;
      switch (m[1]) {
        case 'LCO':
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_LOGIC && num(2) >= 0 && num(2) < LCS_PER_TILE) id = dev.lcOut(num(0), num(1), num(2));
          break;
        case 'LCI':
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_LOGIC && num(2) >= 0 && num(2) < LCS_PER_TILE && num(3) >= 0 && num(3) < LUT_INPUTS) id = dev.lcIn(num(0), num(1), num(2), num(3));
          break;
        case 'CE':
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_LOGIC) id = dev.ce(num(0), num(1));
          break;
        case 'SR':
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_LOGIC) id = dev.sr(num(0), num(1));
          break;
        case 'PADI':
        case 'PADO':
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_IO && num(2) >= 0 && num(2) < spec.padsPerTile) {
            const base = tileNodeStartAt(num(0), num(1));
            id = m[1] === 'PADI' ? base + num(2) : base + spec.padsPerTile + num(2);
          }
          break;
        case 'RAMO':
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_BRAM && num(2) >= 0 && num(2) < 16) id = dev.ramOut(num(0), num(1), num(2));
          break;
        case 'RAMI': {
          const p = ramPinIndex(a[2] ?? '');
          if (okTile() && tileKind[tid(num(0), num(1))] === TILE_BRAM && p >= 0 && p < 40) id = dev.ramIn(num(0), num(1), p);
          break;
        }
        case 'W': {
          const d = DIR_NAMES.indexOf(a[2] as 'E');
          if (d >= 0 && okTile()) id = dev.wire(num(0), num(1), d, num(3) as 1, num(4));
          break;
        }
        case 'GCLK':
          if (num(0) >= 0 && num(0) < spec.globals) id = gclkBase + num(0);
          break;
      }
      return id;
    },
    selectFor: (to, from) => {
      for (let i = inStart[to]!; i < inStart[to + 1]!; i++) if (inList[i] === from) return i - inStart[to]! + 1;
      return 0;
    },
    shortestPath: (from, to) => {
      const prev = new Int32Array(N).fill(-2);
      prev[from] = -1;
      const queue = [from];
      for (let qi = 0; qi < queue.length && prev[to] === -2; qi++) {
        const n = queue[qi]!;
        for (let i = outStart[n]!; i < outStart[n + 1]!; i++) {
          const m = outList[i]!;
          if (prev[m] === -2) {
            prev[m] = n;
            queue.push(m);
          }
        }
      }
      if (prev[to] === -2) return [];
      const path: number[] = [];
      for (let n = to; n !== -1; n = prev[n]!) path.push(n);
      return path.reverse();
    },
    counts: { lcs, logicTiles, brams, pads: pads.length, nodes: N, edges: inList.length, bits: totalBits },
  };
  return dev;
}

const cache = new Map<VFpgaSize, VFpgaDevice>();

/** The device of a size, built on first use and shared afterwards. */
export function getVFpga(size: VFpgaSize | VFpgaDevice['name']): VFpgaDevice {
  const key: VFpgaSize = size.length === 1 ? (size as VFpgaSize) : (size.slice(-1) as VFpgaSize);
  let d = cache.get(key);
  if (!d) {
    const spec = VFPGA_SPECS[key];
    if (!spec) throw new Error(`unknown device ${size}`);
    cache.set(key, (d = build(spec)));
  }
  return d;
}

/** Manhattan distance between the tiles of two RR nodes. */
export const nodeDistance = (dev: VFpgaDevice, a: number, b: number): number =>
  Math.abs(dev.nodeX[a]! - dev.nodeX[b]!) + Math.abs(dev.nodeY[a]! - dev.nodeY[b]!);
