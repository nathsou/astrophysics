/**
 * Canvas 2D drawing of the transverse (r–φ), longitudinal (r–z) and η–φ lego views. Pure functions of a scene, a view and
 * the highlight states: no DOM beyond the `CanvasRenderingContext2D` passed in, so they can be driven from any canvas.
 */
import { Camera, View2D } from './camera.ts';
import type { RGB } from './colour.ts';
import { lighten } from './colour.ts';
import { lineColour, type RenderOptions } from './glData.ts';
import { outerHalfLength, outerRadius } from './geometry.ts';
import { wavyPolyline } from './helix.ts';
import { inConvexPolygon } from './pick.ts';
import type { DisplayScene, JetCone, Tower } from './scene.ts';
import type { Projector } from './scenePick.ts';

export type PlaneMode = 'rphi' | 'rz';

const FONT = '10.5px "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
const BG = '#05080d';

export const rgba = (c: RGB, a: number): string => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

/** The projector of a plane view: world point to pixels. */
export function planeProjector(mode: PlaneMode, view: View2D): Projector {
  if (mode === 'rphi') {
    return (x, y, _z, _s, out) => {
      out[0] = view.toScreenX(x);
      out[1] = view.toScreenY(y);
      out[2] = 0;
      return true;
    };
  }
  return (x, y, z, s, out) => {
    out[0] = view.toScreenX(z);
    out[1] = view.toScreenY(s * Math.hypot(x, y));
    out[2] = 0;
    return true;
  };
}

/** Fit a plane view to show the whole detector (`extent: 'all'`), the calorimeters or just the tracker. */
export function fitPlane(mode: PlaneMode, view: View2D, scene: DisplayScene, extent: 'all' | 'calo' | 'tracker'): void {
  const g = scene.geometry;
  const R = extent === 'all' ? outerRadius(g) : extent === 'calo' ? g.hcal.rOut * 1.08 : g.tracker.reduce((m, l) => Math.max(m, l.r), 0) * 1.1;
  if (mode === 'rphi') view.fit(-R, R, -R, R, 10);
  else {
    const L = extent === 'all' ? outerHalfLength(g) : extent === 'calo' ? g.hcal.halfLength * 1.05 : g.tracker.reduce((m, l) => Math.max(m, l.halfLength), 0) * 1.05;
    view.fit(-L, L, -R, R, 10);
  }
}

/** Corners of a tower projected in the plane view, as [x0,y0,…,x3,y3]. */
function towerCorners(mode: PlaneMode, view: View2D, t: Tower, out: Float64Array): void {
  const sign = Math.sin(t.phi) < 0 ? -1 : 1;
  if (mode === 'rphi') {
    const ch = Math.cosh(t.eta);
    const r0 = t.t0 / ch, r1 = t.t1 / ch;
    const p0 = t.phi - t.dPhi / 2, p1 = t.phi + t.dPhi / 2;
    const pts: [number, number][] = [
      [r0 * Math.cos(p0), r0 * Math.sin(p0)],
      [r1 * Math.cos(p0), r1 * Math.sin(p0)],
      [r1 * Math.cos(p1), r1 * Math.sin(p1)],
      [r0 * Math.cos(p1), r0 * Math.sin(p1)],
    ];
    for (let i = 0; i < 4; i++) {
      out[2 * i] = view.toScreenX(pts[i]![0]);
      out[2 * i + 1] = view.toScreenY(pts[i]![1]);
    }
  } else {
    const e0 = t.eta - t.dEta / 2, e1 = t.eta + t.dEta / 2;
    const at = (tt: number, e: number): [number, number] => [tt * Math.tanh(e), (sign * tt) / Math.cosh(e)];
    const pts = [at(t.t0, e0), at(t.t1, e0), at(t.t1, e1), at(t.t0, e1)];
    for (let i = 0; i < 4; i++) {
      out[2 * i] = view.toScreenX(pts[i]![0]);
      out[2 * i + 1] = view.toScreenY(pts[i]![1]);
    }
  }
}

function drawOutline(ctx: CanvasRenderingContext2D, scene: DisplayScene, mode: PlaneMode, view: View2D, o: RenderOptions): void {
  const g = scene.geometry;
  const p = o.palette;
  ctx.lineWidth = 1;
  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  const circle = (r: number) => {
    ctx.beginPath();
    ctx.arc(view.toScreenX(0), view.toScreenY(0), r * view.scale, 0, Math.PI * 2);
  };
  const rect = (L: number, r: number, reverse = false) => {
    const x0 = view.toScreenX(-L), x1 = view.toScreenX(L), y0 = view.toScreenY(r), y1 = view.toScreenY(-r);
    if (reverse) {
      ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y0); ctx.closePath();
    } else {
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath();
    }
  };
  const shell = (rIn: number, rOut: number, L: number, c: RGB, label: string) => {
    ctx.beginPath();
    if (mode === 'rphi') {
      ctx.arc(view.toScreenX(0), view.toScreenY(0), rOut * view.scale, 0, Math.PI * 2);
      ctx.arc(view.toScreenX(0), view.toScreenY(0), rIn * view.scale, 0, Math.PI * 2, true);
    } else {
      rect(L, rOut);
      rect(L * (rIn / rOut), rIn, true);
    }
    ctx.fillStyle = rgba(c, 0.07);
    ctx.fill('evenodd');
    ctx.strokeStyle = rgba(c, 0.42);
    ctx.stroke();
    ctx.fillStyle = rgba(c, 0.75);
    ctx.textAlign = 'left';
    if (mode === 'rphi') {
      const a = (label === 'ECAL' ? 62 : 52) * (Math.PI / 180); // up and to the right, clear of the missing-pT label
      ctx.fillText(label, view.toScreenX(0) + rOut * view.scale * Math.cos(a) + 3, view.toScreenY(0) - rOut * view.scale * Math.sin(a) - 3);
    } else {
      ctx.fillText(label, view.toScreenX(L * 0.02) + 4, view.toScreenY(rOut) - 8);
    }
  };
  // Tracker layers.
  ctx.strokeStyle = rgba(p.hit.rgb, 0.22);
  for (const l of g.tracker) {
    if (mode === 'rphi') {
      circle(l.r);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(view.toScreenX(-l.halfLength), view.toScreenY(l.r));
      ctx.lineTo(view.toScreenX(l.halfLength), view.toScreenY(l.r));
      ctx.moveTo(view.toScreenX(-l.halfLength), view.toScreenY(-l.r));
      ctx.lineTo(view.toScreenX(l.halfLength), view.toScreenY(-l.r));
      ctx.stroke();
    }
  }
  shell(g.ecal.rIn, g.ecal.rOut, g.ecal.halfLength, p.caloEm.rgb, 'ECAL');
  shell(g.hcal.rIn, g.hcal.rOut, g.hcal.halfLength, p.caloHad.rgb, 'HCAL');
  // Coil.
  ctx.strokeStyle = 'rgba(190,210,230,0.28)';
  ctx.lineWidth = 1.6;
  if (mode === 'rphi') {
    circle(g.solenoid.r);
    ctx.stroke();
  } else {
    ctx.beginPath();
    rect(g.solenoid.halfLength, g.solenoid.r);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  // Muon stations.
  g.muon.forEach((s, i) => {
    ctx.strokeStyle = rgba(p.muon.rgb, 0.3);
    ctx.lineWidth = 1.4;
    if (mode === 'rphi') {
      circle(s.r);
      ctx.stroke();
    } else {
      ctx.beginPath();
      rect(s.halfLength, s.r);
      ctx.stroke();
    }
    if (i === g.muon.length - 1) {
      ctx.fillStyle = rgba(p.muon.rgb, 0.75);
      ctx.textAlign = 'left';
      if (mode === 'rphi') ctx.fillText('muon stations', view.toScreenX(0) + s.r * view.scale * 0.7071 + 4, view.toScreenY(0) - s.r * view.scale * 0.7071 + 12);
      else ctx.fillText('muon stations', view.toScreenX(-s.halfLength) + 4, view.toScreenY(s.r) + 12);
    }
  });
  ctx.lineWidth = 1;
  // Beam axis in the longitudinal view.
  if (mode === 'rz') {
    ctx.strokeStyle = 'rgba(200,215,235,0.28)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(0, view.toScreenY(0));
    ctx.lineTo(view.width, view.toScreenY(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** A scale bar in the bottom-left corner: a round number of metres that is about 90 px long. */
function drawScale(ctx: CanvasRenderingContext2D, view: View2D): void {
  const target = 90 / view.scale; // mm
  const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  let mm = nice[0]!;
  for (const n of nice) if (n <= target * 1.3) mm = n;
  const px = mm * view.scale;
  const x = 12, y = view.height - 14;
  ctx.strokeStyle = 'rgba(200,215,235,0.8)';
  ctx.fillStyle = 'rgba(200,215,235,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4);
  ctx.stroke();
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(mm >= 1000 ? `${mm / 1000} m` : `${mm} mm`, x + 4, y - 4);
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
}

function drawCone(ctx: CanvasRenderingContext2D, mode: PlaneMode, view: View2D, j: JetCone, c: RGB, state: number): void {
  const ch = Math.cosh(j.eta);
  const alpha = state === 3 ? 0.04 : state === 2 ? 0.3 : state === 1 ? 0.22 : 0.14;
  ctx.beginPath();
  if (mode === 'rphi') {
    const L = j.length / ch;
    const ox = view.toScreenX(j.origin[0]), oy = view.toScreenY(j.origin[1]);
    const a0 = -(j.phi - 0.4), a1 = -(j.phi + 0.4); // canvas y points down
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, L * view.scale, a0, a1, true);
    ctx.closePath();
  } else {
    const sign = Math.sin(j.phi) < 0 ? -1 : 1;
    const theta = Math.atan2(1, Math.sinh(j.eta)); // polar angle, 0 … π
    const dth = 0.4 / ch;
    const L = j.length;
    const pt = (th: number): [number, number] => [view.toScreenX(j.origin[2] + L * Math.cos(th)), view.toScreenY(sign * L * Math.sin(th))];
    ctx.moveTo(view.toScreenX(j.origin[2]), view.toScreenY(0));
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(theta - dth + (2 * dth * i) / n);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  ctx.fillStyle = rgba(c, alpha);
  ctx.fill();
  ctx.strokeStyle = rgba(c, state === 3 ? 0.12 : 0.6);
  ctx.lineWidth = state === 2 ? 2 : 1;
  ctx.setLineDash(state === 2 ? [] : [5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

/** Draw the transverse or longitudinal view. `states` are the highlight states per object id (null = no selection). */
export function drawPlane(ctx: CanvasRenderingContext2D, scene: DisplayScene, mode: PlaneMode, view: View2D, o: RenderOptions, states: Uint8Array | null): void {
  const W = view.width, H = view.height;
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
  g.addColorStop(0, '#0a1119');
  g.addColorStop(1, BG);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawOutline(ctx, scene, mode, view, o);

  const st = (id: number): number => (states ? (id >= 0 ? states[id]! : 4) : 0);
  const pal = o.palette;

  // Jet cones (under everything else).
  if (o.showReco) for (const j of scene.cones) drawCone(ctx, mode, view, j, pal.jet.rgb, st(j.obj));

  // Towers, smallest first so that the tallest are on top.
  if (o.showCalo && scene.towers.length) {
    const c = new Float64Array(8);
    const order = scene.towers.length > 1500 ? scene.towers.slice(0, 1500) : scene.towers;
    for (let i = order.length - 1; i >= 0; i--) {
      const t = order[i]!;
      const s = st(t.obj);
      towerCorners(mode, view, t, c);
      const col = t.calo === 'ecal' ? pal.caloEm.rgb : pal.caloHad.rgb;
      ctx.beginPath();
      ctx.moveTo(c[0]!, c[1]!); ctx.lineTo(c[2]!, c[3]!); ctx.lineTo(c[4]!, c[5]!); ctx.lineTo(c[6]!, c[7]!); ctx.closePath();
      ctx.fillStyle = s === 2 ? rgba(lighten(col, 0.5), 0.9) : s === 1 ? rgba(lighten(col, 0.2), 0.75) : rgba(col, s === 3 || s === 4 ? 0.12 : 0.5);
      ctx.fill();
      ctx.strokeStyle = rgba(col, s === 3 || s === 4 ? 0.2 : 0.95);
      ctx.lineWidth = s >= 1 && s <= 2 ? 1.6 : 0.8;
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  // Hits, batched in three paths by highlight state.
  const drawHits = (set: typeof scene.hits, diamonds: boolean) => {
    if (!set.count) return;
    const dim = new Path2D(), norm = new Path2D(), hi = new Path2D();
    const size = diamonds ? 4.5 : 1.5;
    for (let i = 0; i < set.count; i++) {
      const y = set.xyz[3 * i + 1]!;
      const id = o.showReco && set.owner[i]! >= 0 ? set.owner[i]! : set.truthOwner[i]!;
      const s = states ? (id >= 0 ? states[id]! : 4) : 0;
      const x = mode === 'rphi' ? view.toScreenX(set.xyz[3 * i]!) : view.toScreenX(set.xyz[3 * i + 2]!);
      const yy = mode === 'rphi' ? view.toScreenY(y) : view.toScreenY((y < 0 ? -1 : 1) * Math.hypot(set.xyz[3 * i]!, y));
      const path = s === 3 || s === 4 ? dim : s === 1 || s === 2 ? hi : norm;
      const r = s === 1 || s === 2 ? size * 1.6 : size;
      if (diamonds) {
        path.moveTo(x, yy - r); path.lineTo(x + r, yy); path.lineTo(x, yy + r); path.lineTo(x - r, yy); path.closePath();
      } else path.rect(x - r, yy - r, r * 2, r * 2);
    }
    const c = diamonds ? pal.muon.rgb : pal.hit.rgb;
    ctx.fillStyle = rgba(c, 0.12);
    ctx.fill(dim);
    ctx.fillStyle = rgba(c, diamonds ? 0.95 : 0.85);
    ctx.fill(norm);
    ctx.fillStyle = rgba(lighten(c, 0.6), 1);
    ctx.fill(hi);
  };
  if (o.showHits) {
    drawHits(scene.hits, false);
    drawHits(scene.muonHits, true);
  }

  // Polylines.
  const both = o.showTruth && o.showReco;
  const few = scene.polylines.length <= 1500;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Dimmed lines first, highlighted lines last.
  for (let pass = 0; pass < 2; pass++) {
    for (const pl of scene.polylines) {
      if (pl.layer === 'truth' ? !o.showTruth : !o.showReco) continue;
      const s = st(pl.obj);
      const dimmed = s === 3 || s === 4;
      if ((pass === 0) !== dimmed) continue;
      const ghost = both && pl.layer === 'truth';
      const col = lineColour(pl.kind, pl.pt, o);
      let width = ghost ? Math.max(1, pl.width * 0.75) : pl.width;
      if (s === 2) width *= 2.2;
      else if (s === 1) width *= 1.6;
      const P = pl.points;
      const n = P.length / 3;
      const sx = (i: number) => (mode === 'rphi' ? view.toScreenX(P[3 * i]!) : view.toScreenX(P[3 * i + 2]!));
      const sy = (i: number) => (mode === 'rphi' ? view.toScreenY(P[3 * i + 1]!) : view.toScreenY(pl.rzSign * Math.hypot(P[3 * i]!, P[3 * i + 1]!)));
      ctx.beginPath();
      if (pl.line === 'wavy') {
        const w = wavyPolyline(sx(0), sy(0), sx(n - 1), sy(n - 1), 2.6, 11, 8);
        ctx.moveTo(w[0]!, w[1]!);
        for (let i = 2; i < w.length; i += 2) ctx.lineTo(w[i]!, w[i + 1]!);
      } else {
        ctx.moveTo(sx(0), sy(0));
        for (let i = 1; i < n; i++) ctx.lineTo(sx(i), sy(i));
      }
      if (pl.line === 'dotted') ctx.setLineDash([0.1, 5]);
      else if (ghost) ctx.setLineDash([6, 4]);
      const a = dimmed ? 0.16 : ghost ? 0.65 : 1;
      if (few && !dimmed) {
        ctx.strokeStyle = rgba(col, a * 0.16);
        ctx.lineWidth = width + 4;
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(s === 2 ? lighten(col, 0.45) : col, a);
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // Missing pT: a dotted arrow in the transverse view.
  if (o.showReco && scene.met && mode === 'rphi') {
    const m = scene.met;
    const s = st(m.obj);
    const col = pal.neutrino.rgb;
    const x0 = view.toScreenX(m.origin[0]), y0 = view.toScreenY(m.origin[1]);
    const x1 = view.toScreenX(m.origin[0] + Math.cos(m.phi) * m.length), y1 = view.toScreenY(m.origin[1] + Math.sin(m.phi) * m.length);
    ctx.strokeStyle = rgba(s === 2 ? lighten(col, 0.5) : col, s === 3 ? 0.2 : 1);
    ctx.lineWidth = s === 2 ? 4 : 2.4;
    ctx.lineCap = 'round';
    ctx.setLineDash([0.1, 6]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1 - 11 * Math.cos(ang - 0.45), y1 - 11 * Math.sin(ang - 0.45));
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - 11 * Math.cos(ang + 0.45), y1 - 11 * Math.sin(ang + 0.45));
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1;
    ctx.fillStyle = rgba(col, 0.9);
    ctx.textAlign = 'left';
    ctx.fillText('missing pT', x1 + 6, y1);
  }

  // Vertices.
  if (o.showReco) {
    for (const v of scene.vertices) {
      const s = st(v.obj);
      const x = mode === 'rphi' ? view.toScreenX(v.x) : view.toScreenX(v.z);
      const y = mode === 'rphi' ? view.toScreenY(v.y) : view.toScreenY((v.y < 0 ? -1 : 1) * Math.hypot(v.x, v.y));
      ctx.beginPath();
      ctx.arc(x, y, v.kind === 'primary' ? 4 : 2.5, 0, Math.PI * 2);
      ctx.strokeStyle = s === 2 ? '#fff' : v.kind === 'primary' ? rgba(pal.higgs.rgb, 1) : rgba(pal.hit.rgb, s === 3 ? 0.2 : 0.85);
      ctx.lineWidth = v.kind === 'primary' ? 1.6 : 1;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }
  drawScale(ctx, view);
  // Axis labels.
  ctx.fillStyle = 'rgba(200,215,235,0.75)';
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(mode === 'rphi' ? 'x →   y ↑   (beam along z, out of the page)' : 'z →   r ↑ (signed by y)', W - 8, 6);
  ctx.textBaseline = 'middle';
}

// ── Lego plot ────────────────────────────────────────────────────────────────────────────────

export interface LegoBar {
  obj: number;
  eta: number;
  phi: number;
  dEta: number;
  dPhi: number;
  /** Transverse energy (GeV). */
  et: number;
  calo: 'ecal' | 'hcal';
}

export interface LegoModel {
  bars: LegoBar[];
  /** Height in world units per GeV of E_T. */
  hScale: number;
  maxEt: number;
}

export const LEGO_ETA = 3;

/** The bars of the lego plot: one per tower, with transverse energy E_T = E / cosh η, stacked ECAL under HCAL at the same cell. */
export function legoModel(scene: DisplayScene): LegoModel {
  const bars: LegoBar[] = scene.towers.map((t) => ({ obj: t.obj, eta: t.eta, phi: t.phi, dEta: t.dEta, dPhi: t.dPhi, et: t.energy / Math.cosh(t.eta), calo: t.calo }));
  const maxEt = bars.reduce((m, b) => Math.max(m, b.et), 0);
  return { bars, maxEt, hScale: 2.0 / Math.max(30, maxEt) };
}

/** Set up the lego camera for a canvas size. */
export function legoCamera(cam: Camera, w: number, h: number): void {
  cam.ortho = true;
  cam.resize(w, h);
  cam.target = [0, 0.5, 0];
  const aspect = w / h;
  const half = 3.9; // half of the vertical extent to fit (the floor seen at an angle is about 9 units across)
  cam.distance = 12;
  cam.fov = 2 * Math.atan(half / Math.min(1, aspect * 1.25) / cam.distance);
  cam.near = -60;
  cam.far = 60;
  cam.update();
}

/** Screen polygons of the lego plot for picking: flat coordinates, start offsets (in points), object ids and priorities. */
export interface LegoPolygons {
  xy: number[];
  starts: number[];
  ids: number[];
  /** 0 bars (picked first), 1 markers, 2 jet circles. Within a priority the one drawn last (front-most) wins. */
  prio: number[];
}

/** The object at (px, py) in the lego plot, or -1. */
export function pickLego(polys: LegoPolygons | null, px: number, py: number): number {
  if (!polys) return -1;
  let best = -1, bestPrio = 99;
  for (let k = polys.ids.length - 1; k >= 0; k--) {
    const pr = polys.prio[k]!;
    if (pr >= bestPrio) continue;
    const s = polys.starts[k]!, e = k + 1 < polys.starts.length ? polys.starts[k + 1]! : polys.xy.length / 2;
    if (inConvexPolygon(px, py, polys.xy.slice(2 * s, 2 * e))) {
      best = polys.ids[k]!;
      bestPrio = pr;
    }
  }
  return best;
}

/**
 * Draw the lego plot with an orthographic orbit camera: bars of E_T over the η–φ plane, jet circles of radius 0.4, markers for
 * leptons and photons and the direction of the missing pT. Returns the screen polygons for picking.
 */
export function drawLego(ctx: CanvasRenderingContext2D, scene: DisplayScene, model: LegoModel, cam: Camera, o: RenderOptions, states: Uint8Array | null): LegoPolygons {
  const W = cam.width, H = cam.height;
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
  g.addColorStop(0, '#0a1119');
  g.addColorStop(1, BG);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const out = new Float64Array(3);
  const P = (x: number, y: number, z: number): [number, number] => {
    cam.project(x, y, z, out);
    return [out[0]!, out[1]!];
  };
  const st = (id: number): number => (states ? (id >= 0 ? states[id]! : 4) : 0);
  const pal = o.palette;
  // X = η, Z = φ, Y = height.
  const E = LEGO_ETA, F = Math.PI;
  // Floor.
  ctx.beginPath();
  for (const [x, z] of [[-E, -F], [E, -F], [E, F], [-E, F]] as const) {
    const [a, b] = P(x, 0, z);
    if (x === -E && z === -F) ctx.moveTo(a, b);
    else ctx.lineTo(a, b);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,170,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,230,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160,190,230,0.14)';
  ctx.beginPath();
  for (let e = -E + 1; e < E; e++) {
    const [a, b] = P(e, 0, -F), [c, d] = P(e, 0, F);
    ctx.moveTo(a, b); ctx.lineTo(c, d);
  }
  for (const f of [-F / 2, 0, F / 2]) {
    const [a, b] = P(-E, 0, f), [c, d] = P(E, 0, f);
    ctx.moveTo(a, b); ctx.lineTo(c, d);
  }
  ctx.stroke();
  // Tick labels and axis titles.
  ctx.font = FONT;
  ctx.fillStyle = 'rgba(200,215,235,0.8)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  // Put η labels on the edge nearer the camera (z = ±π) and φ labels on the edge nearer in x.
  const f = cam.forward;
  const zEdge = f[2] < 0 ? F : -F; // the near edge has the camera on its side
  const xEdge = f[0] < 0 ? E : -E;
  for (let e = -E; e <= E; e++) {
    const [a, b] = P(e, 0, zEdge + (zEdge > 0 ? 0.35 : -0.35));
    ctx.fillText(String(e), a, b);
  }
  ctx.textAlign = 'center';
  {
    const [a, b] = P(0, 0, zEdge + (zEdge > 0 ? 0.85 : -0.85));
    ctx.fillText('η', a, b);
  }
  for (const [f2, lab] of [[-F, '−π'], [0, '0'], [F, 'π']] as const) {
    const [a, b] = P(xEdge + (xEdge > 0 ? 0.3 : -0.3), 0, f2);
    ctx.fillText(lab, a, b);
  }
  {
    const [a, b] = P(xEdge + (xEdge > 0 ? 0.75 : -0.75), 0, 0);
    ctx.fillText('φ', a, b);
  }

  // Bars, far to near.
  const order = model.bars
    .map((b, i) => {
      cam.project(b.eta, 0, b.phi, out);
      return { i, depth: out[2]! };
    })
    .sort((a, b) => b.depth - a.depth);
  const buf: LegoPolygons = { xy: [], starts: [], ids: [], prio: [] };
  const addPoly = (pts: ArrayLike<number>, id: number, prio: number) => {
    buf.starts.push(buf.xy.length / 2);
    for (let k = 0; k < pts.length; k++) buf.xy.push(pts[k]!);
    buf.ids.push(id);
    buf.prio.push(prio);
  };
  const faceShade = [1, 0.72, 0.52];
  for (const { i } of order) {
    const b = model.bars[i]!;
    const s = st(b.obj);
    const x0 = b.eta - b.dEta / 2, x1 = b.eta + b.dEta / 2, z0 = b.phi - b.dPhi / 2, z1 = b.phi + b.dPhi / 2;
    const h = Math.max(0.03, b.et * model.hScale);
    const col = b.calo === 'ecal' ? pal.caloEm.rgb : pal.caloHad.rgb;
    const base: RGB = s === 2 ? lighten(col, 0.5) : s === 1 ? lighten(col, 0.2) : col;
    const alpha = s === 3 || s === 4 ? 0.22 : 1;
    const drawFace = (pts: [number, number, number][], shade: number) => {
      const p = pts.map((q) => P(q[0], q[1], q[2]));
      ctx.beginPath();
      ctx.moveTo(p[0]![0], p[0]![1]);
      for (let k = 1; k < 4; k++) ctx.lineTo(p[k]![0], p[k]![1]);
      ctx.closePath();
      ctx.fillStyle = rgba([base[0] * shade, base[1] * shade, base[2] * shade], alpha * 0.92);
      ctx.fill();
      ctx.strokeStyle = rgba(lighten(col, 0.3), alpha * 0.6);
      ctx.lineWidth = s === 2 ? 1.6 : 0.6;
      ctx.stroke();
      addPoly([p[0]![0], p[0]![1], p[1]![0], p[1]![1], p[2]![0], p[2]![1], p[3]![0], p[3]![1]], b.obj, 0);
    };
    // Sides facing the camera (normal · forward < 0), then the top.
    if (f[0] < 0) drawFace([[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], faceShade[1]!);
    else drawFace([[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]], faceShade[1]!);
    if (f[2] < 0) drawFace([[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]], faceShade[2]!);
    else drawFace([[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], faceShade[2]!);
    if (f[1] < 0) drawFace([[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], faceShade[0]!);
  }
  ctx.lineWidth = 1;

  // Jets: circles of radius 0.4 in (η, φ) on the floor, with a label.
  if (o.showReco) {
    for (const j of scene.cones) {
      const s = st(j.obj);
      ctx.beginPath();
      const ring: number[] = [];
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const [x, y] = P(j.eta + 0.4 * Math.cos(a), 0.01, j.phi + 0.4 * Math.sin(a));
        ring.push(x, y);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(pal.jet.rgb, s === 3 ? 0.04 : s === 2 ? 0.35 : 0.16);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.jet.rgb, s === 3 ? 0.2 : 0.95);
      ctx.lineWidth = s === 2 ? 2.4 : 1.4;
      ctx.stroke();
      const [lx, ly] = P(j.eta, 0.01, j.phi);
      ctx.fillStyle = rgba(pal.jet.rgb, s === 3 ? 0.3 : 1);
      ctx.textAlign = 'left';
      ctx.fillText(`jet ${j.pt.toFixed(0)}`, lx + 18, ly - 10);
      addPoly(ring, j.obj, 2);
    }
    // Leptons and photons: a pole with a glyph on top, at (η, φ).
    for (const ob of scene.objects) {
      if (ob.cat !== 'object' || !ob.kind || ob.kind === 'jet') continue;
      const s = st(ob.id);
      const h = Math.max(0.3, ob.pt * model.hScale);
      const [bx, by] = P(ob.eta, 0, ob.phi), [tx, ty] = P(ob.eta, h, ob.phi);
      const c = pal[ob.kind].rgb;
      ctx.strokeStyle = rgba(c, s === 3 ? 0.2 : 0.9);
      ctx.lineWidth = s === 2 ? 3 : 1.6;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = rgba(s === 2 ? lighten(c, 0.5) : c, s === 3 ? 0.25 : 1);
      ctx.beginPath(); ctx.arc(tx, ty, s === 2 ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba(c, s === 3 ? 0.3 : 1);
      ctx.textAlign = 'left';
      ctx.fillText(`${ob.label.replace(/[⁺⁻]/, '')} ${ob.pt.toFixed(0)}`, tx + 8, ty);
      addPoly([tx - 8, ty - 8, tx + 8, ty - 8, tx + 8, ty + 8, tx - 8, ty + 8, bx, by], ob.id, 1);
    }
    // Missing pT: a dotted line at its azimuth across the η range.
    if (scene.met) {
      const s = st(scene.met.obj);
      const [a, b] = P(-E, 0.01, scene.met.phi), [c, d] = P(E, 0.01, scene.met.phi);
      ctx.strokeStyle = rgba(pal.neutrino.rgb, s === 3 ? 0.2 : 1);
      ctx.lineWidth = s === 2 ? 3.4 : 2;
      ctx.lineCap = 'round';
      ctx.setLineDash([0.1, 6]);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.fillStyle = rgba(pal.neutrino.rgb, 0.95);
      ctx.textAlign = 'left';
      ctx.fillText(`missing pT ${scene.met.magnitude.toFixed(0)}`, c + 4, d);
      addPoly([a, b - 4, c, d - 4, c, d + 4, a, b + 4], scene.met.obj, 1);
    }
  }
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(200,215,235,0.75)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('bar height: E_T = E / cosh η', 10, H - 8);
  ctx.textBaseline = 'middle';
  return buf;
}
