/**
 * The die's geometry in world units, and everything that turns a pointer position into "what is here".
 *
 * World coordinates: tile (x, y) of the device (x to the right, y upwards) sits at the left `x * pitch`, top
 * `(height − 1 − y) * pitch`; between tiles run **routing channels** of width `ch`:
 *
 * ```
 *        ┌─ tile ─┐  ▒▒▒ vertical channel (N and S wires), east of every tile
 *        │        │  ▒▒▒
 *        └────────┘  ▒▒▒
 *   ═══ horizontal channel (E and W wires), north of every tile; its crossing with the vertical one is the
 *       tile's switch box.
 * ```
 *
 * A wire of direction d, span s and track t is a segment in a channel: E and W wires in the horizontal channel
 * north of their starting tile (E on lanes 0…nk−1, W on lanes nk…2nk−1), N and S wires in the vertical channel
 * east of it. It starts at the starting tile's switch box and ends at the switch box `s` tiles away.
 *
 * Inside a tile, the 8 logic cells form 2 columns × 4 rows. Inputs sit on a cell's left edge, the output on its right.
 */
import { DX, DY, NK, TILE_BRAM, TILE_IO, TILE_LOGIC, type VFpgaDevice } from '../../pld/devices/vfpga';
import { LCS_PER_TILE } from '../../pld/devices/vfpga-arch';

/** Tile side, in world units. */
export const TILE = 200;
const MARGIN = 8;
const HEADER = 18;
const CELL_GAP = 5;
export const LANE = 2.6;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DieGeom {
  device: VFpgaDevice;
  /** Channel width and tile pitch. */
  ch: number;
  pitch: number;
  /** Wire kinds per direction. */
  nk: number;
  /** Size of the whole die. */
  width: number;
  height: number;
  /** Cell size inside a tile. */
  cw: number;
  chh: number;
}

const cache = new WeakMap<VFpgaDevice, DieGeom>();

export function dieGeom(device: VFpgaDevice): DieGeom {
  let g = cache.get(device);
  if (!g) {
    const nk = device.wireKinds.length;
    const ch = Math.max(44, 2 * nk * LANE + 10);
    const pitch = TILE + ch;
    g = {
      device,
      ch,
      pitch,
      nk,
      width: device.width * pitch,
      height: device.height * pitch,
      cw: (TILE - 2 * MARGIN - CELL_GAP) / 2,
      chh: (TILE - HEADER - MARGIN - 3 * CELL_GAP) / 4,
    };
    cache.set(device, g);
  }
  return g;
}

/** The tile's rectangle (y is flipped: device y grows upwards). */
export function tileRect(g: DieGeom, x: number, y: number): Rect {
  return { x: x * g.pitch, y: (g.device.height - 1 - y) * g.pitch, w: TILE, h: TILE };
}

/** The tile at a world point, or undefined over a channel or outside the die. */
export function tileAt(g: DieGeom, wx: number, wy: number): { x: number; y: number } | undefined {
  const x = Math.floor(wx / g.pitch);
  const row = Math.floor(wy / g.pitch);
  const y = g.device.height - 1 - row;
  if (x < 0 || y < 0 || x >= g.device.width || y >= g.device.height) return undefined;
  if (wx - x * g.pitch > TILE || wy - row * g.pitch > TILE) return undefined;
  if (g.device.tileKind[g.device.tid(x, y)] === 0) return undefined;
  return { x, y };
}

/** A cell's rectangle inside its tile. */
export function cellRect(g: DieGeom, x: number, y: number, k: number): Rect {
  const t = tileRect(g, x, y);
  const col = k & 1;
  const row = k >> 1;
  return { x: t.x + MARGIN + col * (g.cw + CELL_GAP), y: t.y + HEADER + row * (g.chh + CELL_GAP), w: g.cw, h: g.chh };
}

/** The cell slot at a world point inside a logic tile. */
export function cellAt(g: DieGeom, x: number, y: number, wx: number, wy: number): number {
  for (let k = 0; k < LCS_PER_TILE; k++) {
    const r = cellRect(g, x, y, k);
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return k;
  }
  return -1;
}

export const center = (r: Rect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The switch box of a tile: the crossing of the channels north and east of it. */
export function switchBoxRect(g: DieGeom, x: number, y: number): Rect {
  const t = tileRect(g, x, y);
  return { x: t.x + TILE, y: t.y - g.ch, w: g.ch, h: g.ch };
}

// ── Wires ────────────────────────────────────────────────────────────────────────────────────────

export interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The segment of a wire node; undefined for other nodes. */
export function wireSegment(g: DieGeom, n: number): Segment | undefined {
  const d = g.device;
  if (d.nodeKind[n] !== NK.WIRE) return undefined;
  const x = d.nodeX[n]!;
  const y = d.nodeY[n]!;
  const li = d.nodeIdx[n]!;
  const dir = Math.floor(li / g.nk);
  const kind = d.wireKinds[li % g.nk]!;
  const t = tileRect(g, x, y);
  const sbx = t.x + TILE + g.ch / 2;
  const sby = t.y - g.ch / 2;
  const kk = li % g.nk;
  const len = kind.span * g.pitch;
  if (dir === 0 || dir === 2) {
    const lane = (dir === 0 ? 0 : g.nk) + kk;
    const ly = t.y - g.ch + g.ch / 2 + (lane - g.nk + 0.5) * LANE;
    return { x0: sbx, y0: ly, x1: sbx + DX[dir]! * len, y1: ly };
  }
  const lane = (dir === 1 ? 0 : g.nk) + kk;
  const lx = t.x + TILE + g.ch / 2 + (lane - g.nk + 0.5) * LANE;
  return { x0: lx, y0: sby, x1: lx, y1: sby - DY[dir]! * len };
}

export interface Pt {
  x: number;
  y: number;
}

/** Where a signal enters the node's tile/wire ("in") and leaves it ("out"). For pins both are the same point. */
export function nodeAnchors(g: DieGeom, n: number): { in: Pt; out: Pt } | undefined {
  const d = g.device;
  const kind = d.nodeKind[n]!;
  if (kind === NK.GCLK) return undefined;
  const x = d.nodeX[n]!;
  const y = d.nodeY[n]!;
  const i = d.nodeIdx[n]!;
  if (kind === NK.WIRE) {
    const s = wireSegment(g, n)!;
    return { in: { x: s.x0, y: s.y0 }, out: { x: s.x1, y: s.y1 } };
  }
  const t = tileRect(g, x, y);
  let p: Pt;
  switch (kind) {
    case NK.LCO: {
      const r = cellRect(g, x, y, i);
      p = { x: r.x + r.w, y: r.y + r.h / 2 };
      break;
    }
    case NK.LCI: {
      const r = cellRect(g, x, y, i >> 2);
      p = { x: r.x, y: r.y + (r.h * ((i & 3) + 0.5)) / 4 };
      break;
    }
    case NK.CE:
      p = { x: t.x + TILE * 0.3, y: t.y + TILE - 3 };
      break;
    case NK.SR:
      p = { x: t.x + TILE * 0.7, y: t.y + TILE - 3 };
      break;
    case NK.PADI:
      p = { x: t.x + (TILE * (i + 0.5)) / d.spec.padsPerTile, y: t.y + TILE * 0.42 };
      break;
    case NK.PADO:
      p = { x: t.x + (TILE * (i + 0.5)) / d.spec.padsPerTile, y: t.y + TILE * 0.58 };
      break;
    case NK.RAMO:
      p = { x: t.x + TILE - 10, y: t.y + 22 + (i * (TILE - 44)) / 15 };
      break;
    default:
      p = { x: t.x + 10, y: t.y + 12 + (i * (TILE - 24)) / 39 };
  }
  return { in: p, out: p };
}

/** The wire lane under a world point, if the point is on one (for hand routing and hovering). */
export function wireAt(g: DieGeom, wx: number, wy: number, slack = 0, prefer?: (n: number) => boolean): number {
  const d = g.device;
  // Wires of one span and track that start in neighbouring tiles share a lane and overlap (as on a real die): a
  // wire the caller prefers (a routed one) wins, then the one whose middle is nearest the point.
  const best = { n: -1, dist: Infinity, score: Infinity };
  const consider = (n: number, horizontal: boolean) => {
    if (n < 0) return;
    const seg = wireSegment(g, n)!;
    const along = horizontal ? wx >= Math.min(seg.x0, seg.x1) - 1 && wx <= Math.max(seg.x0, seg.x1) + 1 : wy >= Math.min(seg.y0, seg.y1) - 1 && wy <= Math.max(seg.y0, seg.y1) + 1;
    const dist = horizontal ? Math.abs(wy - seg.y0) : Math.abs(wx - seg.x0);
    if (!along || dist > LANE * 0.6 + slack) return;
    const score = (prefer?.(n) ? 0 : 1e6) + dist * 100 + Math.hypot(wx - (seg.x0 + seg.x1) / 2, wy - (seg.y0 + seg.y1) / 2);
    if (score < best.score) {
      best.n = n;
      best.dist = dist;
      best.score = score;
    }
  };
  // Horizontal channel: the strip [pitch·R − ch, pitch·R] north of screen row R.
  const hRow = Math.floor((wy + g.ch) / g.pitch);
  const hIn = wy + g.ch - hRow * g.pitch;
  if (hIn >= 0 && hIn <= g.ch) {
    const y = d.height - 1 - hRow;
    const q = (wx - TILE - g.ch / 2) / g.pitch;
    for (const dir of [0, 2]) {
      for (let kk = 0; kk < d.wireKinds.length; kk++) {
        const span = d.wireKinds[kk]!.span;
        for (let x = Math.floor(q) - span; x <= Math.ceil(q) + span; x++) {
          if (x < 0 || x >= d.width || y < 0 || y >= d.height) continue;
          consider(d.wireNode[d.tid(x, y) * d.wireSlots + dir * g.nk + kk]!, true);
        }
      }
    }
  }
  // Vertical channel: the strip east of tile column x.
  const col = Math.floor(wx / g.pitch);
  const vIn = wx - col * g.pitch;
  if (vIn >= TILE && vIn <= TILE + g.ch && col >= 0 && col < d.width) {
    const q = (wy + g.ch / 2) / g.pitch;
    for (const dir of [1, 3]) {
      for (let kk = 0; kk < d.wireKinds.length; kk++) {
        const span = d.wireKinds[kk]!.span;
        for (let R = Math.floor(q) - span; R <= Math.ceil(q) + span; R++) {
          const y = d.height - 1 - R;
          if (y < 0 || y >= d.height) continue;
          consider(d.wireNode[d.tid(col, y) * d.wireSlots + dir * g.nk + kk]!, false);
        }
      }
    }
  }
  return best.n;
}

// ── Inside a cell ────────────────────────────────────────────────────────────────────────────────

/** The rectangle of LUT bit `b` in a cell's detailed drawing (a column of 16 squares near its left edge). */
export function lutBitRect(r: Rect, b: number): Rect {
  const h = (r.h - 8) / 16;
  return { x: r.x + 16, y: r.y + 4 + b * h + 0.15, w: 6.5, h: h - 0.3 };
}

/** The LUT bit under a world point inside a cell rectangle, or −1. */
export function lutBitAt(r: Rect, wx: number, wy: number): number {
  const first = lutBitRect(r, 0);
  if (wx < first.x || wx > first.x + first.w) return -1;
  const h = (r.h - 8) / 16;
  const b = Math.floor((wy - (r.y + 4)) / h);
  return b >= 0 && b < 16 ? b : -1;
}

/** The pin node nearest a world point within `tol`, among the pins of tile (x, y); −1 if none. */
export function pinAt(g: DieGeom, x: number, y: number, wx: number, wy: number, tol: number): number {
  const d = g.device;
  const kind = d.tileKind[d.tid(x, y)]!;
  const cands: number[] = [];
  if (kind === TILE_LOGIC) {
    for (let k = 0; k < LCS_PER_TILE; k++) {
      cands.push(d.lcOut(x, y, k));
      for (let i = 0; i < 4; i++) cands.push(d.lcIn(x, y, k, i));
    }
    cands.push(d.ce(x, y), d.sr(x, y));
  } else if (kind === TILE_IO) {
    for (let s = 0; s < d.spec.padsPerTile; s++) {
      const pad = d.padAt(x, y, s);
      cands.push(d.padIn(pad), d.padOut(pad));
    }
  }
  let best = -1;
  let bd = tol;
  for (const n of cands) {
    const a = nodeAnchors(g, n);
    if (!a) continue;
    const dist = Math.hypot(wx - a.in.x, wy - a.in.y);
    if (dist <= bd) {
      bd = dist;
      best = n;
    }
  }
  return best;
}

/** Distance from a point to a segment. */
export function distToSegment(px: number, py: number, s: Segment): number {
  const dx = s.x1 - s.x0;
  const dy = s.y1 - s.y0;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x0) * dx + (py - s.y0) * dy) / l2));
  return Math.hypot(px - (s.x0 + t * dx), py - (s.y0 + t * dy));
}

// ── Semantic zoom ────────────────────────────────────────────────────────────────────────────────

export type ZoomLevel = 'chip' | 'tile' | 'cell';

/** What to draw at zoom `k` (screen pixels per world unit). */
export function zoomLevel(k: number): ZoomLevel {
  const tilePx = TILE * k;
  return tilePx < 46 ? 'chip' : tilePx < 520 ? 'tile' : 'cell';
}

/** The zoom that puts a level's subject at a comfortable size. */
export function zoomFor(level: 'chip' | 'tile' | 'cell' | 'routing', g: DieGeom, viewW: number, viewH: number): number {
  switch (level) {
    case 'chip':
      return Math.min(viewW / g.width, viewH / g.height) * 0.94;
    case 'tile':
      return Math.min(viewW, viewH) / (TILE * 1.3);
    case 'cell':
      return Math.min(viewW / (g.cw * 1.5), viewH / (g.chh * 3));
    case 'routing':
      return Math.min(viewW, viewH) / (g.ch * 3.2);
  }
}

// ── Viewport ─────────────────────────────────────────────────────────────────────────────────────

export interface View {
  k: number;
  tx: number;
  ty: number;
}

export const MIN_K = 0.02;
export const MAX_K = 40;
export const clampK = (k: number): number => Math.max(MIN_K, Math.min(MAX_K, k));

export const toWorld = (v: View, sx: number, sy: number): Pt => ({ x: (sx - v.tx) / v.k, y: (sy - v.ty) / v.k });
export const toScreen = (v: View, wx: number, wy: number): Pt => ({ x: wx * v.k + v.tx, y: wy * v.k + v.ty });

/** Zoom by `f` keeping the screen point (sx, sy) fixed. */
export function zoomAt(v: View, f: number, sx: number, sy: number): View {
  const k = clampK(v.k * f);
  const r = k / v.k;
  return { k, tx: sx - (sx - v.tx) * r, ty: sy - (sy - v.ty) * r };
}

/** The view that shows a world rectangle centred in a viewport of the given size. */
export function fitRect(r: Rect, viewW: number, viewH: number, pad = 12, maxK = MAX_K): View {
  const k = Math.min(maxK, clampK(Math.min((viewW - 2 * pad) / r.w, (viewH - 2 * pad) / r.h)));
  return { k, tx: (viewW - r.w * k) / 2 - r.x * k, ty: (viewH - r.h * k) / 2 - r.y * k };
}

/** The world rectangle a view shows. */
export function visibleRect(v: View, viewW: number, viewH: number): Rect {
  return { x: -v.tx / v.k, y: -v.ty / v.k, w: viewW / v.k, h: viewH / v.k };
}

export const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** The tile range (inclusive) a rectangle touches, in device coordinates. */
export function tilesIn(g: DieGeom, r: Rect): { x0: number; x1: number; y0: number; y1: number } {
  const c0 = Math.max(0, Math.floor(r.x / g.pitch));
  const c1 = Math.min(g.device.width - 1, Math.floor((r.x + r.w) / g.pitch));
  const r0 = Math.max(0, Math.floor(r.y / g.pitch));
  const r1 = Math.min(g.device.height - 1, Math.floor((r.y + r.h) / g.pitch));
  return { x0: c0, x1: c1, y0: g.device.height - 1 - r1, y1: g.device.height - 1 - r0 };
}

/** The tile kind at (x, y), for callers that only have the geometry. */
export const kindAt = (g: DieGeom, x: number, y: number): number => g.device.tileKind[g.device.tid(x, y)]!;

/** Keyboard navigation between tiles: the nearest non-empty tile in a direction (dx, dy in device coordinates). */
export function neighbourTile(g: DieGeom, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  const d = g.device;
  let nx = x + dx;
  let ny = y + dy;
  while (nx >= 0 && ny >= 0 && nx < d.width && ny < d.height) {
    if (d.tileKind[d.tid(nx, ny)] !== 0) return { x: nx, y: ny };
    nx += dx;
    ny += dy;
  }
  // Empty corners: stay where we are.
  return { x, y };
}

export { TILE_BRAM, TILE_IO, TILE_LOGIC };
