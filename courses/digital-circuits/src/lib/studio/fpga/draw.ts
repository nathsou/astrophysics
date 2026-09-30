/**
 * Draws the vFPGA on a Canvas 2D with semantic zoom.
 *
 * - **chip** (a tile is under 46 px): tiles as blocks that glow with use and take the colour of their module;
 *   routed nets as thin lines through the channels;
 * - **tile**: the eight logic cells of a tile drawn as LUT + flip-flop + carry, the channels with every wire lane
 *   (span 1, 4 and 12 in their own colours), switch boxes;
 * - **logic cell** (a tile is over 520 px): a cell's 16 LUT bits, the multiplexer tree that selects one, the
 *   flip-flop and the bypass multiplexer, with the live values when the design runs.
 *
 * World units and geometry are in `geometry.ts`; this file only paints. Colours come from the design tokens
 * (`readSignals`), so light and dark themes both work (the die is drawn on dark silicon either way).
 */
import { NK, TILE_BRAM, TILE_IO, TILE_LOGIC } from '../../pld/devices/vfpga';
import { LCS_PER_TILE } from '../../pld/devices/vfpga-arch';
import { readLc, type LcConfig } from '../../pld/devices/vfpga-config';
import { mix, withAlpha, type Signals } from '../../theme/signals';
import { moduleHue, tileModule, tileUse, type ChipModel } from './chipmodel';
import type { FabricSim } from './fabric-sim';
import { TILE, cellRect, dieGeom, intersects, lutBitRect, nodeAnchors, tileRect, tilesIn, switchBoxRect, visibleRect, wireSegment, zoomLevel, type Pt, type Rect, type View } from './geometry';
import { hex4, muxTree } from './lut';
import type { PlaceFrame } from './replay';
import type { FpgaPlacement, FpgaProbe } from './types';

export interface DrawOptions {
  model: ChipModel;
  view: View;
  width: number;
  height: number;
  dpr: number;
  sig: Signals;
  probe: FpgaProbe;
  hover: FpgaProbe;
  /** The keyboard cursor. */
  cursor: { x: number; y: number } | null;
  sim: FabricSim | null;
  layers: { wires: boolean; modules: boolean; critical: boolean };
  replay: { frame: PlaceFrame; place: FpgaPlacement; showLinks: boolean } | null;
  congestion: { tiles: Map<string, number>; max: number; nodes: readonly number[] } | null;
  /** Node highlighted by hand (the inspector's subject). */
  node: number | null;
  /** Show cell details editable (by hand): the LUT bits get a pointer cursor and outline. */
  editable: boolean;
}

/** `hsl` → `rgb(...)`, since the colour helpers read hex and rgb only. */
export function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  return `rgb(${f(0)}, ${f(8)}, ${f(4)})`;
}

export const moduleColour = (i: number): string => hsl(moduleHue(i), 62, 58);

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

class Painter {
  readonly ctx: CanvasRenderingContext2D;
  readonly o: DrawOptions;
  readonly k: number;
  readonly m: ChipModel;
  readonly vis: Rect;
  readonly level;
  readonly base: string;
  readonly metal: string;
  constructor(ctx: CanvasRenderingContext2D, o: DrawOptions) {
    this.ctx = ctx;
    this.o = o;
    this.k = o.view.k;
    this.m = o.model;
    this.vis = visibleRect(o.view, o.width, o.height);
    this.level = zoomLevel(this.k);
    this.base = mix(o.sig.silicon, '#000000', 0.32);
    this.metal = o.sig.siliconMetal;
  }

  /** Text in world units; skipped when it would be smaller than `min` px. */
  text(s: string, x: number, y: number, size: number, colour: string, align: CanvasTextAlign = 'left', min = 6.5): void {
    if (size * this.k < min) return;
    const c = this.ctx;
    c.font = `${size}px ${MONO}`;
    c.fillStyle = colour;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }

  rect(r: Rect, fill: string | null, stroke: string | null, lw = 1, radius = 0): void {
    const c = this.ctx;
    c.beginPath();
    if (radius > 0) c.roundRect(r.x, r.y, r.w, r.h, radius);
    else c.rect(r.x, r.y, r.w, r.h);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  line(a: Pt, b: Pt, colour: string, lw: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.strokeStyle = colour;
    c.lineWidth = lw;
    c.stroke();
  }

  /** Width in world units that is at least `px` pixels on screen. */
  atLeast(world: number, px: number): number {
    return Math.max(world, px / this.k);
  }
}

// ── Public entry ─────────────────────────────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, o: DrawOptions): void {
  const { width, height, dpr, view } = o;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.k, view.k);
  const p = new Painter(ctx, o);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawSubstrate(p);
  if (o.replay) drawReplay(p);
  else {
    drawTiles(p);
    drawChannels(p);
    drawRouting(p);
    drawSelection(p);
  }
  if (o.congestion) drawCongestion(p);
  ctx.restore();
}

function drawSubstrate(p: Painter): void {
  const g = p.m.g;
  const pad = 30;
  p.rect({ x: -pad, y: -pad + g.ch, w: g.width + 2 * pad - g.ch + 8, h: g.height + 2 * pad - g.ch }, mix(p.o.sig.silicon, '#000', 0.5), withAlpha(p.metal, 0.35), p.atLeast(1.2, 1), 22);
}

// ── Tiles ────────────────────────────────────────────────────────────────────────────────────────

function drawTiles(p: Painter): void {
  const { device: d, g } = p.m;
  const t = tilesIn(g, p.vis);
  for (let x = t.x0; x <= t.x1; x++) {
    for (let y = t.y0; y <= t.y1; y++) {
      const kind = d.tileKind[d.tid(x, y)]!;
      if (kind === 0) continue;
      const r = tileRect(g, x, y);
      if (!intersects(r, p.vis)) continue;
      if (kind === TILE_LOGIC) drawLogicTile(p, x, y, r);
      else if (kind === TILE_IO) drawIoTile(p, x, y, r);
      else drawBramTile(p, x, y, r);
    }
  }
}

function tileFill(p: Painter, x: number, y: number): { fill: string; tint: string | null; use: number } {
  const use = tileUse(p.m, x, y);
  const mi = p.o.layers.modules && p.m.modules.length > 1 ? tileModule(p.m, x, y) : -1;
  const tint = use === 0 ? null : mi >= 0 ? moduleColour(mi) : p.o.sig.high;
  const strength = p.level === 'chip' ? 0.18 + 0.5 * (use / LCS_PER_TILE) : 0.07 + 0.1 * (use / LCS_PER_TILE);
  const fill = tint ? mix(p.base, tint, strength) : mix(p.base, p.o.sig.silicon, 0.3);
  return { fill, tint, use };
}

function drawLogicTile(p: Painter, x: number, y: number, r: Rect): void {
  const { fill, tint, use } = tileFill(p, x, y);
  const sel = p.o.probe.tiles.has(`${x},${y}`);
  const hov = p.o.hover.tiles.has(`${x},${y}`);
  const tilePx = TILE * p.k;
  p.rect(r, fill, withAlpha(tint ?? p.metal, tint ? 0.9 : 0.4), p.atLeast(1.2, 1), 6);
  if (p.level === 'chip') {
    if (tilePx >= 20) {
      // A mini grid of the eight cells.
      const f = p.m.used.get(p.m.device.tid(x, y));
      for (let k = 0; k < LCS_PER_TILE; k++) {
        const col = k & 1;
        const row = k >> 1;
        const c = { x: r.x + 26 + col * 82, y: r.y + 26 + row * 38, w: 66, h: 30 };
        p.rect(c, f?.[k] ? (tint ?? p.o.sig.high) : withAlpha(p.metal, 0.12), null, 0, 4);
      }
    }
  } else {
    p.text(`(${x}, ${y})`, r.x + 10, r.y + 9, 9, withAlpha(p.metal, 0.9), 'left', 8);
    p.text(`${use}/8`, r.x + TILE - 10, r.y + 9, 9, use ? (tint ?? p.o.sig.high) : withAlpha(p.metal, 0.6), 'right', 8);
    for (let k = 0; k < LCS_PER_TILE; k++) drawCell(p, x, y, k);
    // Clock-enable and set/reset pins along the bottom edge.
    p.text('CE', r.x + TILE * 0.3, r.y + TILE - 5, 6, withAlpha(p.metal, 0.55), 'center', 7);
    p.text('SR', r.x + TILE * 0.7, r.y + TILE - 5, 6, withAlpha(p.metal, 0.55), 'center', 7);
  }
  if (sel) p.rect(r, withAlpha(p.o.sig.phosphor, 0.1), p.o.sig.phosphor, p.atLeast(2, 2), 6);
  else if (hov) p.rect(r, withAlpha(p.o.sig.copper, 0.08), p.o.sig.copper, p.atLeast(1.5, 1.5), 6);
}

function drawCell(p: Painter, x: number, y: number, k: number): void {
  const g = p.m.g;
  const r = cellRect(g, x, y, k);
  if (!intersects(r, p.vis)) return;
  const key = `${x},${y},${k}`;
  const used = p.m.used.get(p.m.device.tid(x, y))?.[k] === 1;
  const mi = p.o.layers.modules ? p.m.cellModule.get(key) : undefined;
  const tint = used ? (mi !== undefined && p.m.modules.length > 1 ? moduleColour(mi) : p.o.sig.high) : null;
  const critical = p.o.layers.critical && p.m.criticalCells.has(key);
  const sel = p.o.probe.cells.has(key);
  const hov = p.o.hover.cells.has(key);
  const st = p.o.sim?.cellState(x, y, k);
  const live = st?.ff !== undefined ? st.ff : st?.out;
  const fill = tint ? mix(p.base, tint, live === 1 ? 0.55 : 0.26) : withAlpha(p.metal, 0.07);
  p.rect(r, fill, tint ? withAlpha(tint, 0.85) : withAlpha(p.metal, 0.25), p.atLeast(0.8, 0.8), 3);
  const cellPx = r.w * p.k;
  const deep = p.level === 'cell' && cellPx >= 300;
  const cfg = used ? readLc(p.m.device, p.m.bits, x, y, k) : null;
  if (cfg && deep) drawCellDetail(p, r, cfg, key, st);
  else if (cellPx >= 40) drawCellSketch(p, r, cfg, key, tint, live);
  if (critical) p.rect({ x: r.x - 1.5, y: r.y - 1.5, w: r.w + 3, h: r.h + 3 }, null, p.o.sig.current, p.atLeast(1.6, 1.6), 4);
  if (sel) p.rect({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, withAlpha(p.o.sig.phosphor, 0.12), p.o.sig.phosphor, p.atLeast(2, 2), 4);
  else if (hov) p.rect({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, null, p.o.sig.copper, p.atLeast(1.5, 1.5), 4);
}

/** A cell as blocks: LUT, flip-flop (with a clock triangle), carry link, and the bypass multiplexer. */
function drawCellSketch(p: Painter, r: Rect, cfg: LcConfig | null, key: string, tint: string | null, live: 0 | 1 | 'x' | undefined): void {
  const line = withAlpha(p.metal, cfg ? 0.95 : 0.4);
  const ink = cfg ? '#e9edf5' : withAlpha(p.metal, 0.5);
  const lut = { x: r.x + 6, y: r.y + 5, w: r.w * 0.36, h: r.h - 10 };
  const ff = { x: r.x + r.w * 0.52, y: r.y + 7, w: r.w * 0.2, h: r.h - 14 };
  p.rect(lut, withAlpha('#000', 0.25), line, p.atLeast(0.7, 0.7), 2);
  p.text('LUT4', lut.x + lut.w / 2, lut.y + lut.h * 0.36, 6.2, ink, 'center', 7);
  if (cfg) p.text(hex4(cfg.lut).slice(2), lut.x + lut.w / 2, lut.y + lut.h * 0.72, 5, withAlpha(ink, 0.85), 'center', 7);
  p.rect(ff, cfg?.ff ? withAlpha(tint ?? p.o.sig.high, 0.35) : withAlpha('#000', 0.2), line, p.atLeast(0.7, 0.7), 2);
  p.text('FF', ff.x + ff.w / 2, ff.y + ff.h * 0.4, 6.2, ink, 'center', 7);
  if (cfg?.ff) {
    // The clock triangle.
    const c = p.ctx;
    c.beginPath();
    c.moveTo(ff.x, ff.y + ff.h - 6);
    c.lineTo(ff.x + 4, ff.y + ff.h - 3.5);
    c.lineTo(ff.x, ff.y + ff.h - 1);
    c.strokeStyle = line;
    c.lineWidth = p.atLeast(0.6, 0.6);
    c.stroke();
  }
  // Wires between the blocks and to the pins; the carry chain leaves through the bottom.
  const mid = r.y + r.h / 2;
  p.line({ x: lut.x + lut.w, y: mid }, { x: ff.x, y: mid }, line, p.atLeast(0.6, 0.6));
  p.line({ x: ff.x + ff.w, y: mid }, { x: r.x + r.w, y: mid }, live === 1 ? p.o.sig.high : line, p.atLeast(0.6, 0.6));
  for (let i = 0; i < 4; i++) p.line({ x: r.x, y: r.y + (r.h * (i + 0.5)) / 4 }, { x: lut.x, y: r.y + (r.h * (i + 0.5)) / 4 }, withAlpha(p.metal, 0.5), p.atLeast(0.5, 0.5));
  if (cfg && (cfg.carryChain || cfg.i3Carry)) p.text('carry', r.x + r.w * 0.5, r.y + r.h - 3, 4.6, p.o.sig.current, 'center', 7);
  const label = p.m.cellLabel.get(key);
  if (label) p.text(label, r.x + 3, r.y + 3.2, 5, withAlpha(ink, 0.9), 'left', 7);
}

/** A cell in full: 16 LUT bits, the multiplexer tree, the flip-flop and the bypass mux, with live values. */
function drawCellDetail(p: Painter, r: Rect, cfg: LcConfig, key: string, st: { row: number; out: 0 | 1 | 'x'; ff: 0 | 1 | 'x' | undefined } | undefined): void {
  const c = p.ctx;
  const sig = p.o.sig;
  const ink = '#e9edf5';
  const dim = withAlpha(p.metal, 0.55);
  const bitH = (r.h - 8) / 16;
  const bx = lutBitRect(r, 0).x;
  const inputs: (0 | 1 | -1)[] = st ? [0, 1, 2, 3].map((i) => (st.row < 0 ? -1 : (((st.row >> i) & 1) as 0 | 1))) : [0, 0, 0, 0];
  const tree = muxTree(cfg.lut, st ? inputs : [-1, -1, -1, -1]);
  const row = st && st.row >= 0 ? st.row : -1;
  // The 16 stored bits.
  for (let b = 0; b < 16; b++) {
    const y = r.y + 4 + b * bitH;
    const on = ((cfg.lut >> b) & 1) === 1;
    const hit = row === b;
    p.rect(lutBitRect(r, b), on ? mix('#000', sig.high, hit ? 0.95 : 0.6) : withAlpha('#000', 0.35), hit ? sig.phosphor : withAlpha(p.metal, 0.6), p.atLeast(0.3, 0.6), 0.5);
    p.text(on ? '1' : '0', bx + 3.25, y + bitH / 2, 1.9, on ? '#1b1204' : dim, 'center', 8);
    p.text(String(b), bx - 1.2, y + bitH / 2, 1.5, dim, 'right', 8);
    if (p.o.editable) p.rect(lutBitRect(r, b), null, withAlpha(sig.copper, 0.6), p.atLeast(0.2, 0.5), 0.5);
  }
  // The multiplexer tree: 8, 4, 2, 1 two-way multiplexers, each drawn as a trapezoid with the chosen leg marked.
  let x0 = bx + 9;
  let ys: number[] = Array.from({ length: 16 }, (_, b) => r.y + 4 + (b + 0.5) * bitH);
  for (let l = 0; l < 4; l++) {
    const w = 5;
    const next: number[] = [];
    for (let i = 0; i < ys.length / 2; i++) {
      const ya = ys[2 * i]!;
      const yb = ys[2 * i + 1]!;
      const ym = (ya + yb) / 2;
      const h = Math.abs(yb - ya) * 0.8;
      c.beginPath();
      c.moveTo(x0, ya - bitH * 0.35);
      c.lineTo(x0 + w, ym - h * 0.3);
      c.lineTo(x0 + w, ym + h * 0.3);
      c.lineTo(x0, yb + bitH * 0.35);
      c.closePath();
      c.fillStyle = withAlpha('#000', 0.3);
      c.fill();
      c.strokeStyle = withAlpha(p.metal, 0.8);
      c.lineWidth = p.atLeast(0.25, 0.7);
      c.stroke();
      const sel = tree.selected[l]!;
      if (sel >= 0) {
        const yy = sel === 0 ? ya : yb;
        const v = tree.levels[l]![2 * i + sel]!;
        p.line({ x: x0 - 1.5, y: yy }, { x: x0 + w, y: ym }, v === 1 ? sig.high : withAlpha(p.metal, 0.9), p.atLeast(0.3, 0.8));
      }
      const v = tree.levels[l + 1]![i]!;
      p.line({ x: x0 + w, y: ym }, { x: x0 + w + 3, y: ym }, v === 1 ? sig.high : v === 0 ? withAlpha(p.metal, 0.8) : withAlpha(sig.x, 0.8), p.atLeast(0.25, 0.7));
      next.push(ym);
    }
    p.text(`I${l}`, x0 + w / 2, r.y + r.h - 1.2, 1.7, l === 0 ? sig.copper : dim, 'center', 8);
    ys = next;
    x0 += w + 4;
  }
  // Input pins on the left, feeding the select lines.
  for (let i = 0; i < 4; i++) {
    const y = r.y + (r.h * (i + 0.5)) / 4;
    const v = st ? inputs[i]! : -1;
    p.line({ x: r.x, y }, { x: r.x + 3, y }, v === 1 ? sig.high : withAlpha(p.metal, 0.8), p.atLeast(0.3, 0.8));
    p.text(`I${i}`, r.x + 3.6, y, 2, v === 1 ? sig.high : ink, 'left', 8);
  }
  // Flip-flop and bypass multiplexer.
  const ff = { x: x0 + 3, y: r.y + r.h * 0.3, w: 14, h: r.h * 0.4 };
  const lutOut = ys[0]!;
  p.line({ x: x0 - 4, y: lutOut }, { x: ff.x, y: lutOut }, withAlpha(p.metal, 0.9), p.atLeast(0.3, 0.8));
  p.rect(ff, cfg.ff ? withAlpha(sig.high, 0.22) : withAlpha('#000', 0.3), withAlpha(p.metal, 0.9), p.atLeast(0.3, 0.8), 1);
  p.text('D flip-flop', ff.x + ff.w / 2, ff.y + 3, 1.7, ink, 'center', 8);
  p.text(cfg.ff ? `Q = ${st?.ff === undefined ? '?' : st.ff}` : 'unused', ff.x + ff.w / 2, ff.y + ff.h * 0.55, 2, cfg.ff ? sig.high : dim, 'center', 8);
  const flags = [cfg.ceEn && 'CE', cfg.srEn && (cfg.srAsync ? 'async ' : 'sync ') + (cfg.srVal ? 'set' : 'reset'), cfg.init && 'init 1'].filter(Boolean).join(' · ');
  if (flags) p.text(flags, ff.x + ff.w / 2, ff.y + ff.h - 2.2, 1.5, dim, 'center', 8);
  // Bypass multiplexer.
  const mx = ff.x + ff.w + 4;
  c.beginPath();
  c.moveTo(mx, r.y + r.h * 0.22);
  c.lineTo(mx + 4, r.y + r.h * 0.34);
  c.lineTo(mx + 4, r.y + r.h * 0.66);
  c.lineTo(mx, r.y + r.h * 0.78);
  c.closePath();
  c.fillStyle = withAlpha('#000', 0.3);
  c.fill();
  c.strokeStyle = withAlpha(p.metal, 0.9);
  c.lineWidth = p.atLeast(0.3, 0.8);
  c.stroke();
  p.line({ x: ff.x + ff.w, y: r.y + r.h / 2 }, { x: mx, y: r.y + r.h * 0.58 }, cfg.ff ? sig.high : dim, p.atLeast(0.3, 0.8));
  p.line({ x: x0 - 4, y: lutOut }, { x: x0 - 4, y: r.y + r.h * 0.9 }, cfg.ff ? dim : sig.high, p.atLeast(0.3, 0.8));
  p.line({ x: x0 - 4, y: r.y + r.h * 0.9 }, { x: mx, y: r.y + r.h * 0.42 }, cfg.ff ? dim : sig.high, p.atLeast(0.3, 0.8));
  p.text('bypass', mx + 2, r.y + r.h * 0.12, 1.5, dim, 'center', 8);
  p.line({ x: mx + 4, y: r.y + r.h / 2 }, { x: r.x + r.w, y: r.y + r.h / 2 }, (cfg.ff ? st?.ff : st?.out) === 1 ? sig.high : withAlpha(p.metal, 0.9), p.atLeast(0.3, 0.8));
  p.text('O', r.x + r.w - 1.5, r.y + r.h / 2 - 2.6, 2, ink, 'right', 8);
  const flagText = [cfg.carryChain && 'carry in ← previous cell', cfg.i3Carry && 'I3 = carry in', !cfg.carryChain && cfg.carryConst && 'carry in = 1'].filter(Boolean).join(' · ');
  if (flagText) p.text(flagText, r.x + r.w / 2, r.y + r.h + 3, 2.2, sig.current, 'center', 8);
  p.text(`${p.m.cellLabel.get(key) ?? key}  LUT ${hex4(cfg.lut)}`, r.x + 1, r.y - 2.2, 2.4, ink, 'left', 8);
}

function drawIoTile(p: Painter, x: number, y: number, r: Rect): void {
  const d = p.m.device;
  const sel = p.o.probe.tiles.has(`${x},${y}`);
  const hov = p.o.hover.tiles.has(`${x},${y}`);
  const configured = [...Array(d.spec.padsPerTile).keys()].some((s) => p.m.bits[d.tileCfgOffset[d.tid(x, y)]! + 2 * s] || p.m.bits[d.tileCfgOffset[d.tid(x, y)]! + 2 * s + 1]);
  p.rect(r, mix(p.base, p.metal, configured ? 0.18 : 0.06), withAlpha(p.metal, 0.4), p.atLeast(1, 1), 6);
  const n = d.spec.padsPerTile;
  for (let s = 0; s < n; s++) {
    const pad = d.padAt(x, y, s);
    const w = (TILE - 24) / n - 6;
    const pr = { x: r.x + 12 + s * (w + 6), y: r.y + 40, w, h: TILE - 80 };
    const port = p.m.padPort.get(pad);
    const o = d.tileCfgOffset[d.tid(x, y)]! + 2 * s;
    const out = p.m.bits[o] === 1;
    const level = port && p.o.sim ? (out ? p.o.sim.output(port) : undefined) : undefined;
    const active = port !== undefined || out;
    p.rect(pr, active ? mix(p.base, level === 1 ? p.o.sig.high : p.metal, level === 1 ? 0.7 : 0.35) : withAlpha(p.metal, 0.1), withAlpha(p.metal, 0.7), p.atLeast(0.8, 0.8), 3);
    if (p.level !== 'chip') {
      p.text(`P${pad}`, pr.x + pr.w / 2, pr.y + 12, Math.min(14, pr.w * 0.34), '#e9edf5', 'center', 7);
      p.text(active ? (out ? '→ out' : '← in') : '', pr.x + pr.w / 2, pr.y + 28, Math.min(11, pr.w * 0.26), withAlpha(p.metal, 0.9), 'center', 8);
      if (port) p.text(port, pr.x + pr.w / 2, pr.y + pr.h - 10, Math.min(11, pr.w * 0.26), p.o.sig.copper, 'center', 8);
    }
  }
  if (sel) p.rect(r, withAlpha(p.o.sig.phosphor, 0.1), p.o.sig.phosphor, p.atLeast(2, 2), 6);
  else if (hov) p.rect(r, null, p.o.sig.copper, p.atLeast(1.5, 1.5), 6);
}

function drawBramTile(p: Painter, x: number, y: number, r: Rect): void {
  const sel = p.o.probe.tiles.has(`${x},${y}`);
  const hov = p.o.hover.tiles.has(`${x},${y}`);
  p.rect(r, mix(p.base, p.o.sig.current, 0.14), withAlpha(p.o.sig.current, 0.6), p.atLeast(1, 1), 6);
  const inner = { x: r.x + 26, y: r.y + 26, w: TILE - 52, h: TILE - 52 };
  p.rect(inner, withAlpha('#000', 0.3), withAlpha(p.o.sig.current, 0.5), p.atLeast(0.8, 0.8), 3);
  // A memory array texture.
  const c = p.ctx;
  if (p.level !== 'chip') {
    c.strokeStyle = withAlpha(p.o.sig.current, 0.25);
    c.lineWidth = p.atLeast(0.4, 0.5);
    for (let i = 1; i < 8; i++) {
      c.beginPath();
      c.moveTo(inner.x + (inner.w * i) / 8, inner.y);
      c.lineTo(inner.x + (inner.w * i) / 8, inner.y + inner.h);
      c.moveTo(inner.x, inner.y + (inner.h * i) / 8);
      c.lineTo(inner.x + inner.w, inner.y + (inner.h * i) / 8);
      c.stroke();
    }
  }
  p.text('RAM 4 Kb', r.x + TILE / 2, r.y + TILE / 2, 15, '#e9edf5', 'center', 8);
  p.text(`(${x}, ${y})`, r.x + 10, r.y + 12, 9, withAlpha(p.metal, 0.9), 'left', 8);
  if (sel) p.rect(r, withAlpha(p.o.sig.phosphor, 0.1), p.o.sig.phosphor, p.atLeast(2, 2), 6);
  else if (hov) p.rect(r, null, p.o.sig.copper, p.atLeast(1.5, 1.5), 6);
}

// ── Channels and routing ─────────────────────────────────────────────────────────────────────────

const SPAN_COLOUR = { 1: 'metal', 4: 'copper', 12: 'current' } as const;

function drawChannels(p: Painter): void {
  const { device: d, g } = p.m;
  if (p.level === 'chip') return;
  const tiles = tilesIn(g, p.vis);
  const chPx = g.ch * p.k;
  if (p.o.layers.wires && chPx >= 8) {
    // Every wire lane of the visible tiles, by span.
    const c = p.ctx;
    const nk = g.nk;
    const groups: Record<number, number[]> = { 1: [], 4: [], 12: [] };
    for (let x = tiles.x0; x <= tiles.x1; x++) {
      for (let y = tiles.y0; y <= tiles.y1; y++) {
        const t = d.tid(x, y);
        if (d.tileKind[t] === 0) continue;
        for (let dir = 0; dir < 4; dir++) for (let kk = 0; kk < nk; kk++) {
          const n = d.wireNode[t * d.wireSlots + dir * nk + kk]!;
          if (n >= 0) groups[d.wireKinds[kk]!.span]!.push(n);
        }
      }
    }
    for (const span of [1, 4, 12] as const) {
      const colour = span === 1 ? p.metal : span === 4 ? p.o.sig.copper : p.o.sig.current;
      c.strokeStyle = withAlpha(colour, span === 1 ? 0.22 : 0.3);
      c.lineWidth = p.atLeast(span === 1 ? 0.7 : span === 4 ? 1 : 1.3, 0.6);
      c.beginPath();
      for (const n of groups[span]!) {
        const s = wireSegment(g, n)!;
        c.moveTo(s.x0, s.y0);
        c.lineTo(s.x1, s.y1);
      }
      c.stroke();
    }
  }
  // Switch boxes.
  const sbPx = g.ch * p.k;
  if (sbPx >= 10) {
    for (let x = tiles.x0; x <= tiles.x1; x++) {
      for (let y = tiles.y0; y <= tiles.y1; y++) {
        if (d.tileKind[d.tid(x, y)] === 0) continue;
        const sb = switchBoxRect(g, x, y);
        if (!intersects(sb, p.vis)) continue;
        p.rect({ x: sb.x + 2, y: sb.y + 2, w: sb.w - 4, h: sb.h - 4 }, withAlpha(p.metal, 0.06), withAlpha(p.metal, 0.4), p.atLeast(0.6, 0.6), 3);
        if (sbPx >= 34) p.text('SB', sb.x + sb.w / 2, sb.y + sb.h / 2, Math.min(14, g.ch * 0.3), withAlpha(p.metal, 0.6), 'center', 8);
      }
    }
  }
}

function edgeColour(p: Painter, net: number, from: number, to: number): { colour: string; lw: number; glow: boolean } {
  const o = p.o;
  const crit = o.layers.critical && p.m.criticalNodes.has(to) && p.m.criticalNodes.has(from);
  const sel = net >= 0 && o.probe.nets.has(net);
  const hov = net >= 0 && o.hover.nets.has(net);
  if (sel) return { colour: o.sig.phosphor, lw: 2.4, glow: true };
  if (hov) return { colour: o.sig.copper, lw: 2, glow: true };
  if (crit) return { colour: o.sig.current, lw: 2, glow: true };
  if (o.sim) {
    const v = o.sim.nodeLevel(to);
    if (v === 1) return { colour: o.sig.high, lw: 1.6, glow: false };
    if (v === 0) return { colour: mix(o.sig.low, '#000', 0.1), lw: 1.4, glow: false };
    if (v === 'x') return { colour: o.sig.x, lw: 1.4, glow: false };
  }
  return { colour: withAlpha(p.metal, 0.95), lw: 1.3, glow: false };
}

function drawRouting(p: Painter): void {
  const { device: d, g, routing } = p.m;
  const c = p.ctx;
  const e = routing.edges;
  // Draw the ordinary ones first, then critical, hovered and selected on top.
  const passes: number[][] = [[], [], []];
  for (let i = 0; i < routing.count; i++) {
    const from = e[3 * i]!;
    const to = e[3 * i + 1]!;
    const net = e[3 * i + 2]!;
    const a = nodeAnchors(g, from);
    const b = nodeAnchors(g, to);
    if (!a || !b) continue;
    const minx = Math.min(a.out.x, b.in.x, b.out.x);
    const maxx = Math.max(a.out.x, b.in.x, b.out.x);
    const miny = Math.min(a.out.y, b.in.y, b.out.y);
    const maxy = Math.max(a.out.y, b.in.y, b.out.y);
    if (maxx < p.vis.x || minx > p.vis.x + p.vis.w || maxy < p.vis.y || miny > p.vis.y + p.vis.h) continue;
    const hot = net >= 0 && (p.o.probe.nets.has(net) || p.o.hover.nets.has(net));
    const crit = p.o.layers.critical && p.m.criticalNodes.has(to) && p.m.criticalNodes.has(from);
    passes[hot ? 2 : crit ? 1 : 0]!.push(i);
  }
  for (const pass of passes) {
    for (const i of pass) {
      const from = e[3 * i]!;
      const to = e[3 * i + 1]!;
      const net = e[3 * i + 2]!;
      const a = nodeAnchors(g, from)!;
      const b = nodeAnchors(g, to)!;
      const st = edgeColour(p, net, from, to);
      // Screen-constant widths: nets stay thin lines at every zoom instead of swelling into bars.
      const lw = (st.lw * (st.glow ? 1.1 : 0.85)) / p.k;
      if (st.glow) {
        c.save();
        c.shadowColor = st.colour;
        c.shadowBlur = 7;
      }
      c.beginPath();
      // The connector from the driver's output to the start of this node, then the node itself (a wire is a segment).
      c.moveTo(a.out.x, a.out.y);
      if (Math.abs(b.in.x - a.out.x) > 0.01 && Math.abs(b.in.y - a.out.y) > 0.01) c.lineTo(b.in.x, a.out.y);
      c.lineTo(b.in.x, b.in.y);
      if (d.nodeKind[to] === NK.WIRE) c.lineTo(b.out.x, b.out.y);
      c.strokeStyle = st.colour;
      c.lineWidth = lw;
      c.stroke();
      if (st.glow) c.restore();
      // A dot where a multiplexer input is taken.
      if (p.level !== 'chip' && d.nodeKind[to] === NK.WIRE) {
        c.beginPath();
        c.arc(b.in.x, b.in.y, 2.2 / p.k, 0, Math.PI * 2);
        c.fillStyle = st.colour;
        c.fill();
      }
    }
  }
  // The wire the inspector is showing.
  if (p.o.node !== null) {
    const s = wireSegment(g, p.o.node);
    if (s) p.line({ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }, p.o.sig.copper, p.atLeast(3, 3));
    else {
      const a = nodeAnchors(g, p.o.node);
      if (a) {
        c.beginPath();
        c.arc(a.in.x, a.in.y, p.atLeast(3, 4), 0, Math.PI * 2);
        c.strokeStyle = p.o.sig.copper;
        c.lineWidth = p.atLeast(1, 1.5);
        c.stroke();
      }
    }
  }
}

function drawSelection(p: Painter): void {
  const cur = p.o.cursor;
  if (!cur) return;
  const r = tileRect(p.m.g, cur.x, cur.y);
  p.rect({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }, null, p.o.sig.current, p.atLeast(2, 2), 8);
}

// ── Replay ───────────────────────────────────────────────────────────────────────────────────────

function drawReplay(p: Painter): void {
  const { device: d, g } = p.m;
  const rep = p.o.replay!;
  const { frame, place } = rep;
  // Empty sites first.
  const tiles = tilesIn(g, p.vis);
  for (let x = tiles.x0; x <= tiles.x1; x++) {
    for (let y = tiles.y0; y <= tiles.y1; y++) {
      const kind = d.tileKind[d.tid(x, y)]!;
      if (kind === 0) continue;
      const r = tileRect(g, x, y);
      p.rect(r, kind === TILE_BRAM ? withAlpha(p.o.sig.current, 0.08) : withAlpha(p.metal, kind === TILE_IO ? 0.05 : 0.04), withAlpha(p.metal, 0.18), p.atLeast(0.8, 0.6), 6);
    }
  }
  const pos = (u: number): Pt => {
    const slot = place.units[u]!.kind === 'io' ? (d.pads[frame.pad[u]!]?.slot ?? 0) : 0;
    const spread = place.units[u]!.kind === 'io' ? (slot - (d.spec.padsPerTile - 1) / 2) * (TILE / d.spec.padsPerTile) : 0;
    return { x: frame.x[u]! * g.pitch + TILE / 2 + spread, y: (d.height - 1 - frame.y[u]!) * g.pitch + TILE / 2 };
  };
  // Rat's nest: a thin line from each driver to its sinks.
  if (rep.showLinks) {
    const c = p.ctx;
    c.strokeStyle = withAlpha(p.o.sig.copper, 0.16);
    c.lineWidth = p.atLeast(1.4, 0.6);
    c.beginPath();
    const links = place.links;
    const stride = Math.max(1, Math.floor(links.length / 3 / 1500));
    for (let i = 0; i < links.length; i += 3 * stride) {
      const a = pos(links[i]!);
      const b = pos(links[i + 1]!);
      c.moveTo(a.x, a.y);
      c.lineTo(b.x, b.y);
    }
    c.stroke();
  }
  place.units.forEach((u, i) => {
    const q = pos(i);
    const s = u.kind === 'logic' ? 150 : u.kind === 'bram' ? 170 : Math.min(90, (TILE / d.spec.padsPerTile) * 0.9);
    const r = { x: q.x - s / 2, y: q.y - s / 2, w: s, h: s };
    if (!intersects(r, p.vis)) return;
    const fill = u.kind === 'logic' ? mix(p.base, p.o.sig.high, 0.25 + 0.5 * (u.cells / 8)) : u.kind === 'bram' ? mix(p.base, p.o.sig.current, 0.5) : mix(p.base, p.o.sig.phosphor, 0.45);
    p.rect(r, fill, withAlpha(u.kind === 'logic' ? p.o.sig.high : u.kind === 'bram' ? p.o.sig.current : p.o.sig.phosphor, 0.9), p.atLeast(1.4, 1), 10);
    p.text(u.kind === 'io' ? u.label : u.kind === 'bram' ? 'RAM' : String(u.cells), q.x, q.y, u.kind === 'io' ? 22 : 40, '#0b0f18', 'center', 7);
  });
}

function drawCongestion(p: Painter): void {
  const { device: d, g } = p.m;
  const cg = p.o.congestion!;
  for (const [key, v] of cg.tiles) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    if (d.tileKind[d.tid(x, y)] === 0) continue;
    const r = tileRect(g, x, y);
    // The overused node starts in this tile; shade the tile and its switch box.
    const a = 0.18 + 0.6 * (v / Math.max(1, cg.max));
    p.rect({ x: r.x - g.ch * 0.4, y: r.y - g.ch, w: TILE + g.ch * 1.4, h: TILE + g.ch }, withAlpha(p.o.sig.x, a), null, 0, 12);
  }
  for (const n of cg.nodes) {
    const a = nodeAnchors(g, n);
    if (!a) continue;
    const s = wireSegment(g, n);
    if (s) p.line({ x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }, p.o.sig.x, p.atLeast(2.4, 2));
  }
}

export { dieGeom };
