/**
 * Picking objects of a scene under the pointer, for any view that can project world points to pixels (the 3D camera, the
 * transverse view, the longitudinal view). Lines are picked by their distance to the pointer; towers, cones and vertices by
 * a tolerance region around their axis; hits pick the track that produced them.
 */
import { distToSegment, pickPolylines } from './pick.ts';
import type { DisplayScene } from './scene.ts';

/** Project a world point to pixels. `sign` (±1) is the side of the beam axis for the longitudinal view; other views ignore it. */
export type Projector = (x: number, y: number, z: number, sign: number, out: Float64Array) => boolean;

export interface PickFlags {
  showTruth: boolean;
  showReco: boolean;
  showHits: boolean;
  showCalo: boolean;
}

export interface ScenePickResult {
  id: number;
  /** Combined score (lower is closer); a pixel distance plus a priority penalty. */
  score: number;
}

/** A picker with buffers reused between calls. */
export class ScenePicker {
  private xy = new Float32Array(0);
  private starts = new Int32Array(0);
  private ids = new Int32Array(0);
  private tmp = new Float64Array(3);
  private tmp2 = new Float64Array(3);
  private tmp3 = new Float64Array(3);

  constructor(readonly scene: DisplayScene) {}

  /** The object under (px, py) within `radius` pixels, or null. */
  pick(proj: Projector, px: number, py: number, flags: PickFlags, radius = 9): ScenePickResult | null {
    const s = this.scene;
    const t = this.tmp;
    let best = radius;
    let bestId = -1;
    const consider = (score: number, id: number) => {
      if (score < best) {
        best = score;
        bestId = id;
      }
    };

    // Polylines.
    let nLines = 0, nPts = 0;
    for (const pl of s.polylines) {
      if (pl.layer === 'truth' ? flags.showTruth : flags.showReco) {
        nLines++;
        nPts += pl.points.length / 3;
      }
    }
    if (this.xy.length < nPts * 2) this.xy = new Float32Array(nPts * 2 * 1.5);
    if (this.starts.length < nLines + 1) {
      this.starts = new Int32Array((nLines + 1) * 2);
      this.ids = new Int32Array((nLines + 1) * 2);
    }
    let k = 0, p = 0;
    for (const pl of s.polylines) {
      if (!(pl.layer === 'truth' ? flags.showTruth : flags.showReco)) continue;
      this.starts[k] = p;
      this.ids[k] = pl.pick;
      k++;
      const P = pl.points;
      for (let i = 0; i < P.length; i += 3) {
        const ok = proj(P[i]!, P[i + 1]!, P[i + 2]!, pl.rzSign, t);
        this.xy[2 * p] = ok ? t[0]! : NaN;
        this.xy[2 * p + 1] = ok ? t[1]! : NaN;
        p++;
      }
    }
    this.starts[k] = p;
    const line = pickPolylines(this.xy, this.starts, this.ids, nLines, px, py, best);
    if (line) consider(line.dist, line.id);

    // Missing pT arrow.
    if (flags.showReco && s.met) {
      const m = s.met;
      const a = this.tmp2, b = this.tmp3;
      const ok1 = proj(m.origin[0], m.origin[1], m.origin[2], 1, a);
      const ok2 = proj(m.origin[0] + Math.cos(m.phi) * m.length, m.origin[1] + Math.sin(m.phi) * m.length, m.origin[2], 1, b);
      if (ok1 && ok2) consider(distToSegment(px, py, a[0]!, a[1]!, b[0]!, b[1]!), m.obj);
    }

    // Vertices.
    if (flags.showReco) {
      for (const v of s.vertices) {
        if (!proj(v.x, v.y, v.z, v.y < 0 ? -1 : 1, t)) continue;
        consider(Math.max(0, Math.hypot(px - t[0]!, py - t[1]!) - 5) + 1, v.obj);
      }
    }

    // Hits pick the track or particle that made them.
    if (flags.showHits) {
      const h = s.hits;
      for (let i = 0; i < h.count; i++) {
        const id = flags.showReco && h.owner[i]! >= 0 ? h.owner[i]! : h.truthOwner[i]!;
        if (id < 0) continue;
        const y = h.xyz[3 * i + 1]!;
        if (!proj(h.xyz[3 * i]!, y, h.xyz[3 * i + 2]!, y < 0 ? -1 : 1, t)) continue;
        const d = Math.hypot(px - t[0]!, py - t[1]!);
        if (d < 10) consider(Math.max(0, d - 3) + 2, id);
      }
      const m = s.muonHits;
      for (let i = 0; i < m.count; i++) {
        const id = flags.showReco && m.owner[i]! >= 0 ? m.owner[i]! : m.truthOwner[i]!;
        if (id < 0) continue;
        const y = m.xyz[3 * i + 1]!;
        if (!proj(m.xyz[3 * i]!, y, m.xyz[3 * i + 2]!, y < 0 ? -1 : 1, t)) continue;
        consider(Math.max(0, Math.hypot(px - t[0]!, py - t[1]!) - 6) + 1, id);
      }
    }

    // Towers: a capsule around the axis, as wide as the tower.
    if (flags.showCalo) {
      const a = this.tmp2, b = this.tmp3;
      for (const tw of s.towers) {
        const ch = Math.cosh(tw.eta), c = Math.cos(tw.phi), sn = Math.sin(tw.phi), th = Math.tanh(tw.eta);
        const sign = sn < 0 ? -1 : 1;
        const x0 = (tw.t0 * c) / ch, y0 = (tw.t0 * sn) / ch, z0 = tw.t0 * th;
        const x1 = (tw.t1 * c) / ch, y1 = (tw.t1 * sn) / ch, z1 = tw.t1 * th;
        if (!proj(x0, y0, z0, sign, a) || !proj(x1, y1, z1, sign, b)) continue;
        // Half width in pixels: project a point one half-tower to the side at mid height.
        const tm = (tw.t0 + tw.t1) / 2;
        const hw = (0.5 * tw.dPhi * tm) / ch;
        const mx = (tm * c) / ch, my = (tm * sn) / ch, mz = tm * th;
        let r = 3;
        if (proj(mx, my, mz, sign, t)) {
          const cx = t[0]!, cy = t[1]!;
          if (proj(mx - sn * hw, my + c * hw, mz, sign, t)) r = Math.max(3, Math.hypot(t[0]! - cx, t[1]! - cy));
        }
        const d = Math.max(0, distToSegment(px, py, a[0]!, a[1]!, b[0]!, b[1]!) - r);
        consider(d + 4, tw.obj);
      }
    }

    // Jet cones: inside the cone's projected axis band (low priority).
    if (flags.showReco) {
      const a = this.tmp2, b = this.tmp3;
      for (const j of s.cones) {
        const ch = Math.cosh(j.eta);
        const ux = Math.cos(j.phi) / ch, uy = Math.sin(j.phi) / ch, uz = Math.tanh(j.eta);
        const sign = uy < 0 ? -1 : 1;
        if (!proj(j.origin[0], j.origin[1], j.origin[2], sign, a)) continue;
        if (!proj(j.origin[0] + ux * j.length, j.origin[1] + uy * j.length, j.origin[2] + uz * j.length, sign, b)) continue;
        const cxp = j.origin[0] + ux * j.length * 0.75, cyp = j.origin[1] + uy * j.length * 0.75, czp = j.origin[2] + uz * j.length * 0.75;
        let r = 10;
        if (proj(cxp, cyp, czp, sign, t)) {
          const cx = t[0]!, cy = t[1]!;
          const rad = j.tanHalf * j.length * 0.75;
          // a point off the axis along the direction perpendicular to it and to z (or y)
          const nx = -uy, ny = ux;
          const nl = Math.hypot(nx, ny) || 1;
          if (proj(cxp + (nx / nl) * rad, cyp + (ny / nl) * rad, czp, sign, t)) r = Math.max(10, Math.hypot(t[0]! - cx, t[1]! - cy));
        }
        const d = distToSegment(px, py, a[0]!, a[1]!, b[0]!, b[1]!);
        if (d <= r) consider(6 + (d / r) * 2, j.obj);
      }
    }
    return bestId < 0 ? null : { id: bestId, score: best };
  }
}
