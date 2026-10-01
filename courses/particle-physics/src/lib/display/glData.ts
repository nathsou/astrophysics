/**
 * Instance data for the WebGL renderer, built on the CPU from a scene: line segments, points, calorimeter towers and jet
 * cones as flat Float32Arrays, one record per instance. No GL calls here, so the layout is testable.
 *
 * Segment record (14 floats): p0 (3), p1 (3), colour rgb (3), alpha, width px, dash period mm (0 = solid), s0 mm, object id.
 * Point record (11 floats): position (3), colour rgb (3), alpha, size px, shape (0 disc, 1 diamond, 2 ring), object id, unused.
 * Tower record (12 floats): η, φ, Δη, Δφ, t0, t1, object id, unused, colour rgb, alpha.
 * Cone record (12 floats): η, φ, length, tan(half angle), origin xyz, object id, colour rgb, alpha.
 */
import type { ParticleClass, ParticleColours } from '../theme/particles.ts';
import { ptColour, type RGB } from './colour.ts';
import type { DisplayGeometry } from './geometry.ts';
import { wavyPolyline3D } from './helix.ts';
import type { DisplayScene } from './scene.ts';

export const SEG_STRIDE = 14;
export const POINT_STRIDE = 11;
export const TOWER_STRIDE = 12;
export const CONE_STRIDE = 12;

export type ColourBy = 'particle' | 'pt';

export interface RenderOptions {
  colourBy: ColourBy;
  showTruth: boolean;
  showReco: boolean;
  showHits: boolean;
  showCalo: boolean;
  palette: ParticleColours;
}

/** A growing Float32Array of fixed-size records. */
export class RecordWriter {
  data: Float32Array;
  count = 0;
  constructor(
    readonly stride: number,
    capacity = 256,
  ) {
    this.data = new Float32Array(stride * capacity);
  }
  /** Reserve a record and return its offset in `data`. */
  next(): number {
    if ((this.count + 1) * this.stride > this.data.length) {
      const bigger = new Float32Array(this.data.length * 2);
      bigger.set(this.data);
      this.data = bigger;
    }
    return this.count++ * this.stride;
  }
  view(): Float32Array {
    return this.data.subarray(0, this.count * this.stride);
  }
}

function seg(w: RecordWriter, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB, alpha: number, width: number, dash: number, s0: number, id: number): void {
  const o = w.next();
  const d = w.data;
  d[o] = x0; d[o + 1] = y0; d[o + 2] = z0;
  d[o + 3] = x1; d[o + 4] = y1; d[o + 5] = z1;
  d[o + 6] = c[0]; d[o + 7] = c[1]; d[o + 8] = c[2]; d[o + 9] = alpha;
  d[o + 10] = width; d[o + 11] = dash; d[o + 12] = s0; d[o + 13] = id;
}

/** The colour of a line of a given class and pT under the chosen colour scheme. */
export function lineColour(kind: ParticleClass, pt: number, o: Pick<RenderOptions, 'colourBy' | 'palette'>): RGB {
  if (o.colourBy === 'pt' && kind !== 'neutrino' && kind !== 'photon') return ptColour(pt);
  return o.palette[kind].rgb;
}

const ring = (n: number, f: (a: number) => void) => {
  for (let i = 0; i < n; i++) f((i / n) * Math.PI * 2);
};

/** Faint wire frames of the detector: tracker layers, calorimeter shells, the coil and the muon stations. */
export function wireframe(w: RecordWriter, g: DisplayGeometry, p: ParticleColours): void {
  const N = 64;
  const cyl = (r: number, L: number, c: RGB, alpha: number, width: number, lines: number, closed: boolean, rMin = 0) => {
    // End rings and a centre ring.
    for (const z of closed ? [-L, 0, L] : [-L, L]) {
      let px = r, py = 0;
      for (let i = 1; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const x = r * Math.cos(a), y = r * Math.sin(a);
        seg(w, px, py, z, x, y, z, c, alpha * (z === 0 ? 0.5 : 1), width, 0, 0, -1);
        px = x; py = y;
      }
    }
    ring(lines, (a) => seg(w, r * Math.cos(a), r * Math.sin(a), -L, r * Math.cos(a), r * Math.sin(a), L, c, alpha, width, 0, 0, -1));
    if (closed && rMin > 0) {
      // End-cap discs: an inner ring and spokes.
      for (const z of [-L, L]) {
        let px = rMin, py = 0;
        for (let i = 1; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          const x = rMin * Math.cos(a), y = rMin * Math.sin(a);
          seg(w, px, py, z, x, y, z, c, alpha, width, 0, 0, -1);
          px = x; py = y;
        }
        ring(lines, (a) => seg(w, rMin * Math.cos(a), rMin * Math.sin(a), z, r * Math.cos(a), r * Math.sin(a), z, c, alpha * 0.7, width, 0, 0, -1));
      }
    }
  };
  for (const l of g.tracker) cyl(l.r, l.halfLength, p.hit.rgb, 0.2, 1, 16, false);
  const etaMin = (L: number) => L / Math.sinh(3.0); // radius where the end cap meets η = 3
  for (const r of [g.ecal.rIn, g.ecal.rOut]) cyl(r, g.ecal.halfLength, p.caloEm.rgb, 0.22, 1, 16, true, etaMin(g.ecal.halfLength));
  for (const r of [g.hcal.rIn, g.hcal.rOut]) cyl(r, g.hcal.halfLength, p.caloHad.rgb, 0.17, 1, 16, true, etaMin(g.hcal.halfLength));
  cyl(g.solenoid.r, g.solenoid.halfLength, [0.75, 0.82, 0.9], 0.14, 1.2, 12, false);
  for (const s of g.muon) cyl(s.r, s.halfLength, p.muon.rgb, 0.1, 1, 8, false);
  // The beam axis, dotted.
  const L = g.muon[g.muon.length - 1]?.halfLength ?? g.hcal.halfLength;
  seg(w, 0, 0, -L, 0, 0, L, [0.8, 0.85, 0.95], 0.5, 1, 60, 0, -1);
}

/** All line segments of the scene under the given options. */
export function buildSegments(scene: DisplayScene, o: RenderOptions): RecordWriter {
  const w = new RecordWriter(SEG_STRIDE, 8192);
  wireframe(w, scene.geometry, o.palette);
  const both = o.showTruth && o.showReco;
  for (const pl of scene.polylines) {
    if (pl.layer === 'truth' ? !o.showTruth : !o.showReco) continue;
    const c = lineColour(pl.kind, pl.pt, o);
    const ghost = both && pl.layer === 'truth';
    const alpha = ghost ? 0.62 : 1;
    const width = ghost ? Math.max(1, pl.width * 0.75) : pl.width;
    const dash = pl.line === 'dotted' ? 45 : ghost ? 70 : 0;
    const P = pl.points;
    if (pl.line === 'wavy') {
      const n = P.length / 3;
      const a = wavyPolyline3D(P[0]!, P[1]!, P[2]!, P[3 * (n - 1)]!, P[3 * (n - 1) + 1]!, P[3 * (n - 1) + 2]!, 22, 120, 8);
      for (let i = 3; i < a.length; i += 3) seg(w, a[i - 3]!, a[i - 2]!, a[i - 1]!, a[i]!, a[i + 1]!, a[i + 2]!, c, alpha, width, 0, 0, pl.obj);
      continue;
    }
    let s = 0;
    for (let i = 3; i < P.length; i += 3) {
      seg(w, P[i - 3]!, P[i - 2]!, P[i - 1]!, P[i]!, P[i + 1]!, P[i + 2]!, c, alpha, width, dash, s, pl.obj);
      if (dash) s += Math.hypot(P[i]! - P[i - 3]!, P[i + 1]! - P[i - 2]!, P[i + 2]! - P[i - 1]!);
    }
  }
  if (o.showReco) {
    // Jet cone outlines.
    const jc = o.palette.jet.rgb;
    for (const k of scene.cones) {
      const ch = Math.cosh(k.eta);
      const a: [number, number, number] = [Math.cos(k.phi) / ch, Math.sin(k.phi) / ch, Math.tanh(k.eta)];
      const [e1, e2] = coneBasis(a);
      const rad = k.tanHalf * k.length;
      const M = 40;
      let prev: [number, number, number] | null = null;
      for (let i = 0; i <= M; i++) {
        const t = (i / M) * Math.PI * 2;
        const cx = Math.cos(t) * rad, cy = Math.sin(t) * rad;
        const pt: [number, number, number] = [k.origin[0] + a[0] * k.length + e1[0] * cx + e2[0] * cy, k.origin[1] + a[1] * k.length + e1[1] * cx + e2[1] * cy, k.origin[2] + a[2] * k.length + e1[2] * cx + e2[2] * cy];
        if (prev) seg(w, prev[0], prev[1], prev[2], pt[0], pt[1], pt[2], jc, 0.55, 1.2, 0, 0, k.obj);
        if (i % 5 === 0 && i < M) seg(w, k.origin[0], k.origin[1], k.origin[2], pt[0], pt[1], pt[2], jc, 0.4, 1, 0, 0, k.obj);
        prev = pt;
      }
    }
    // Missing pT: a dotted arrow in the transverse plane.
    const m = scene.met;
    if (m) {
      const c = o.palette.neutrino.rgb;
      const ux = Math.cos(m.phi), uy = Math.sin(m.phi);
      const tip: [number, number, number] = [m.origin[0] + ux * m.length, m.origin[1] + uy * m.length, m.origin[2]];
      seg(w, m.origin[0], m.origin[1], m.origin[2], tip[0], tip[1], tip[2], c, 1, 2.4, 55, 0, m.obj);
      const hl = Math.min(260, m.length * 0.25);
      for (const s of [-1, 1]) {
        const bx = tip[0] - ux * hl - s * uy * hl * 0.45, by = tip[1] - uy * hl + s * ux * hl * 0.45;
        seg(w, tip[0], tip[1], tip[2], bx, by, tip[2], c, 1, 2.4, 0, 0, m.obj);
      }
    }
  }
  return w;
}

/** Tracker hits, muon hits and vertex markers as point records. */
export function buildPoints(scene: DisplayScene, o: RenderOptions): RecordWriter {
  const w = new RecordWriter(POINT_STRIDE, 1024);
  const add = (x: number, y: number, z: number, c: RGB, alpha: number, size: number, shape: number, id: number) => {
    const d = w.data;
    const k = w.next();
    d[k] = x; d[k + 1] = y; d[k + 2] = z;
    d[k + 3] = c[0]; d[k + 4] = c[1]; d[k + 5] = c[2]; d[k + 6] = alpha;
    d[k + 7] = size; d[k + 8] = shape; d[k + 9] = id; d[k + 10] = 0;
  };
  const pick = (reco: number, truth: number) => (o.showReco && reco >= 0 ? reco : truth >= 0 ? truth : reco);
  if (o.showHits) {
    const h = scene.hits;
    for (let i = 0; i < h.count; i++) add(h.xyz[3 * i]!, h.xyz[3 * i + 1]!, h.xyz[3 * i + 2]!, o.palette.hit.rgb, 0.9, 3.4, 0, pick(h.owner[i]!, h.truthOwner[i]!));
    const m = scene.muonHits;
    for (let i = 0; i < m.count; i++) add(m.xyz[3 * i]!, m.xyz[3 * i + 1]!, m.xyz[3 * i + 2]!, o.palette.muon.rgb, 1, 8, 1, pick(m.owner[i]!, m.truthOwner[i]!));
  }
  if (o.showReco) {
    for (const v of scene.vertices) {
      if (v.kind === 'primary') add(v.x, v.y, v.z, o.palette.higgs.rgb, 1, 8, 2, v.obj);
      else add(v.x, v.y, v.z, o.palette.hit.rgb, 0.9, 5, 2, v.obj);
    }
  }
  return w;
}

/** Calorimeter towers: ECAL and HCAL colours, height from the scene's energy scale. */
export function buildTowers(scene: DisplayScene, o: RenderOptions): RecordWriter {
  const w = new RecordWriter(TOWER_STRIDE, 256);
  if (!o.showCalo) return w;
  for (const t of scene.towers) {
    const k = w.next();
    const d = w.data;
    const c = t.calo === 'ecal' ? o.palette.caloEm.rgb : o.palette.caloHad.rgb;
    d[k] = t.eta; d[k + 1] = t.phi; d[k + 2] = t.dEta; d[k + 3] = t.dPhi;
    d[k + 4] = t.t0; d[k + 5] = t.t1; d[k + 6] = t.obj; d[k + 7] = 0;
    d[k + 8] = c[0]; d[k + 9] = c[1]; d[k + 10] = c[2]; d[k + 11] = 0.5;
  }
  return w;
}

/** Jet cones. */
export function buildCones(scene: DisplayScene, o: RenderOptions): RecordWriter {
  const w = new RecordWriter(CONE_STRIDE, 16);
  if (!o.showReco) return w;
  const c = o.palette.jet.rgb;
  for (const j of scene.cones) {
    const k = w.next();
    const d = w.data;
    d[k] = j.eta; d[k + 1] = j.phi; d[k + 2] = j.length; d[k + 3] = j.tanHalf;
    d[k + 4] = j.origin[0]; d[k + 5] = j.origin[1]; d[k + 6] = j.origin[2]; d[k + 7] = j.obj;
    d[k + 8] = c[0]; d[k + 9] = c[1]; d[k + 10] = c[2]; d[k + 11] = 0.13;
  }
  return w;
}

/** Two unit vectors perpendicular to `a` (the same construction as the cone vertex shader). */
export function coneBasis(a: [number, number, number]): [[number, number, number], [number, number, number]] {
  const ref: [number, number, number] = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let e1: [number, number, number] = [a[1] * ref[2] - a[2] * ref[1], a[2] * ref[0] - a[0] * ref[2], a[0] * ref[1] - a[1] * ref[0]];
  const n = Math.hypot(...e1);
  e1 = [e1[0] / n, e1[1] / n, e1[2] / n];
  const e2: [number, number, number] = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
  return [e1, e2];
}
