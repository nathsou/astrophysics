/**
 * Picking objects of a scene under the pointer, for any view that can project world points to pixels (the 3D camera, the
 * transverse view, the longitudinal view). Lines are picked by their distance to the pointer; towers, cones and vertices by
 * a tolerance region around their axis; hits pick the track that produced them.
 *
 * Projecting every point costs more than searching, so the projected positions are cached and reused while the view does not
 * change (detected by projecting a few probe points and comparing them).
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

const PROBES: [number, number, number, number][] = [
  [0, 0, 0, 1],
  [1000, 0, 0, 1],
  [0, 1000, 0, 1],
  [0, 0, 1000, 1],
  [0, 0, 1000, -1],
];

/** A picker with buffers and projections reused between calls. */
export class ScenePicker {
  private tmp = new Float64Array(3);
  private sig = new Float64Array(PROBES.length * 2).fill(NaN);
  // Projected geometry, valid for `sig`.
  private xy = new Float32Array(0);
  private starts = new Int32Array(0);
  private lineIds = new Int32Array(0);
  private lineLayer = new Uint8Array(0);
  private hitXY = new Float32Array(0);
  private muXY = new Float32Array(0);
  private vtxXY = new Float32Array(0);
  private towerCap = new Float32Array(0); // ax, ay, bx, by, radius per tower; NaN if off screen
  private coneCap = new Float32Array(0); // ax, ay, bx, by, radius
  private metXY = new Float32Array(4);

  constructor(readonly scene: DisplayScene) {}

  private signatureChanged(proj: Projector): boolean {
    const t = this.tmp;
    let changed = false;
    PROBES.forEach((p, i) => {
      const ok = proj(p[0], p[1], p[2], p[3], t);
      const x = ok ? t[0]! : NaN, y = ok ? t[1]! : NaN;
      if (!(this.sig[2 * i] === x && this.sig[2 * i + 1] === y)) changed = true;
      this.sig[2 * i] = x;
      this.sig[2 * i + 1] = y;
    });
    return changed;
  }

  /** Project everything once for the current view. */
  private project(proj: Projector): void {
    const s = this.scene;
    const t = this.tmp;
    const nLines = s.polylines.length;
    let nPts = 0;
    for (const pl of s.polylines) nPts += pl.points.length / 3;
    if (this.xy.length < nPts * 2) this.xy = new Float32Array(nPts * 2);
    if (this.starts.length < nLines + 1) {
      this.starts = new Int32Array(nLines + 1);
      this.lineIds = new Int32Array(nLines);
      this.lineLayer = new Uint8Array(nLines);
    }
    let p = 0;
    s.polylines.forEach((pl, k) => {
      this.starts[k] = p;
      this.lineLayer[k] = pl.layer === 'truth' ? 1 : 0;
      const P = pl.points;
      for (let i = 0; i < P.length; i += 3) {
        const ok = proj(P[i]!, P[i + 1]!, P[i + 2]!, pl.rzSign, t);
        this.xy[2 * p] = ok ? t[0]! : NaN;
        this.xy[2 * p + 1] = ok ? t[1]! : NaN;
        p++;
      }
    });
    this.starts[nLines] = p;

    const projectSet = (set: { xyz: Float32Array; count: number }, into: 'hitXY' | 'muXY') => {
      if (this[into].length < set.count * 2) this[into] = new Float32Array(set.count * 2);
      const out = this[into];
      for (let i = 0; i < set.count; i++) {
        const y = set.xyz[3 * i + 1]!;
        const ok = proj(set.xyz[3 * i]!, y, set.xyz[3 * i + 2]!, y < 0 ? -1 : 1, t);
        out[2 * i] = ok ? t[0]! : NaN;
        out[2 * i + 1] = ok ? t[1]! : NaN;
      }
    };
    projectSet(s.hits, 'hitXY');
    projectSet(s.muonHits, 'muXY');

    if (this.vtxXY.length < s.vertices.length * 2) this.vtxXY = new Float32Array(s.vertices.length * 2);
    s.vertices.forEach((v, i) => {
      const ok = proj(v.x, v.y, v.z, v.y < 0 ? -1 : 1, t);
      this.vtxXY[2 * i] = ok ? t[0]! : NaN;
      this.vtxXY[2 * i + 1] = ok ? t[1]! : NaN;
    });

    // Towers: a capsule around the axis, as wide as the tower.
    if (this.towerCap.length < s.towers.length * 5) this.towerCap = new Float32Array(s.towers.length * 5);
    const a = new Float64Array(3), b = new Float64Array(3);
    s.towers.forEach((tw, i) => {
      const ch = Math.cosh(tw.eta), c = Math.cos(tw.phi), sn = Math.sin(tw.phi), th = Math.tanh(tw.eta);
      const sign = sn < 0 ? -1 : 1;
      const o = 5 * i;
      const ok = proj((tw.t0 * c) / ch, (tw.t0 * sn) / ch, tw.t0 * th, sign, a) && proj((tw.t1 * c) / ch, (tw.t1 * sn) / ch, tw.t1 * th, sign, b);
      if (!ok) {
        this.towerCap[o] = NaN;
        return;
      }
      const tm = (tw.t0 + tw.t1) / 2;
      const hw = (0.5 * tw.dPhi * tm) / ch;
      const mx = (tm * c) / ch, my = (tm * sn) / ch, mz = tm * th;
      let r = 3;
      if (proj(mx, my, mz, sign, t)) {
        const cx = t[0]!, cy = t[1]!;
        if (proj(mx - sn * hw, my + c * hw, mz, sign, t)) r = Math.max(3, Math.hypot(t[0]! - cx, t[1]! - cy));
      }
      this.towerCap[o] = a[0]!;
      this.towerCap[o + 1] = a[1]!;
      this.towerCap[o + 2] = b[0]!;
      this.towerCap[o + 3] = b[1]!;
      this.towerCap[o + 4] = r;
    });

    // Jet cones: the axis and the projected cone radius three quarters of the way out.
    if (this.coneCap.length < s.cones.length * 5) this.coneCap = new Float32Array(s.cones.length * 5);
    s.cones.forEach((j, i) => {
      const ch = Math.cosh(j.eta);
      const ux = Math.cos(j.phi) / ch, uy = Math.sin(j.phi) / ch, uz = Math.tanh(j.eta);
      const sign = uy < 0 ? -1 : 1;
      const o = 5 * i;
      if (!proj(j.origin[0], j.origin[1], j.origin[2], sign, a) || !proj(j.origin[0] + ux * j.length, j.origin[1] + uy * j.length, j.origin[2] + uz * j.length, sign, b)) {
        this.coneCap[o] = NaN;
        return;
      }
      const cxp = j.origin[0] + ux * j.length * 0.75, cyp = j.origin[1] + uy * j.length * 0.75, czp = j.origin[2] + uz * j.length * 0.75;
      let r = 10;
      if (proj(cxp, cyp, czp, sign, t)) {
        const cx = t[0]!, cy = t[1]!;
        const rad = j.tanHalf * j.length * 0.75;
        const nl = Math.hypot(-uy, ux) || 1;
        if (proj(cxp + (-uy / nl) * rad, cyp + (ux / nl) * rad, czp, sign, t)) r = Math.max(10, Math.hypot(t[0]! - cx, t[1]! - cy));
      }
      this.coneCap[o] = a[0]!;
      this.coneCap[o + 1] = a[1]!;
      this.coneCap[o + 2] = b[0]!;
      this.coneCap[o + 3] = b[1]!;
      this.coneCap[o + 4] = r;
    });

    if (s.met) {
      const m = s.met;
      const ok1 = proj(m.origin[0], m.origin[1], m.origin[2], 1, t);
      const x0 = t[0]!, y0 = t[1]!;
      const ok2 = proj(m.origin[0] + Math.cos(m.phi) * m.length, m.origin[1] + Math.sin(m.phi) * m.length, m.origin[2], 1, t);
      this.metXY[0] = ok1 ? x0 : NaN;
      this.metXY[1] = y0;
      this.metXY[2] = ok2 ? t[0]! : NaN;
      this.metXY[3] = t[1]!;
    }
  }

  /** The object under (px, py) within `radius` pixels, or null. */
  pick(proj: Projector, px: number, py: number, flags: PickFlags, radius = 9): ScenePickResult | null {
    const s = this.scene;
    if (this.signatureChanged(proj)) this.project(proj);
    let best = radius;
    let bestId = -1;
    const consider = (score: number, id: number) => {
      if (score < best) {
        best = score;
        bestId = id;
      }
    };

    // Polylines: a line of a hidden layer has id −1 and is skipped.
    const nLines = s.polylines.length;
    for (let k = 0; k < nLines; k++) {
      const pl = s.polylines[k]!;
      this.lineIds[k] = pl.layer === 'truth' ? (flags.showTruth ? pl.pick : -1) : flags.showReco ? pl.pick : -1;
    }
    const line = pickPolylines(this.xy, this.starts, this.lineIds, nLines, px, py, best);
    if (line) consider(line.dist, line.id);

    // Missing pT arrow.
    if (flags.showReco && s.met) {
      const m = this.metXY;
      if (m[0] === m[0] && m[2] === m[2]) consider(distToSegment(px, py, m[0]!, m[1]!, m[2]!, m[3]!), s.met.obj);
    }

    // Vertices.
    if (flags.showReco) {
      s.vertices.forEach((v, i) => {
        const x = this.vtxXY[2 * i]!;
        if (x === x) consider(Math.max(0, Math.hypot(px - x, py - this.vtxXY[2 * i + 1]!) - 5) + 1, v.obj);
      });
    }

    // Hits pick the track or particle that made them.
    if (flags.showHits) {
      const scan = (set: { count: number; owner: Int32Array; truthOwner: Int32Array }, xy: Float32Array, rad: number) => {
        for (let i = 0; i < set.count; i++) {
          const x = xy[2 * i]!;
          if (Math.abs(x - px) > 10) continue;
          const id = flags.showReco && set.owner[i]! >= 0 ? set.owner[i]! : set.truthOwner[i]!;
          if (id < 0) continue;
          const d = Math.hypot(px - x, py - xy[2 * i + 1]!);
          if (d < 10) consider(Math.max(0, d - rad) + (rad > 4 ? 1 : 2), id);
        }
      };
      scan(s.hits, this.hitXY, 3);
      scan(s.muonHits, this.muXY, 6);
    }

    // Towers.
    if (flags.showCalo) {
      const c = this.towerCap;
      for (let i = 0; i < s.towers.length; i++) {
        const o = 5 * i;
        if (c[o] !== c[o]) continue;
        const d = Math.max(0, distToSegment(px, py, c[o]!, c[o + 1]!, c[o + 2]!, c[o + 3]!) - c[o + 4]!);
        consider(d + 4, s.towers[i]!.obj);
      }
    }

    // Jet cones: inside the cone's projected axis band (low priority).
    if (flags.showReco) {
      const c = this.coneCap;
      for (let i = 0; i < s.cones.length; i++) {
        const o = 5 * i;
        if (c[o] !== c[o]) continue;
        const d = distToSegment(px, py, c[o]!, c[o + 1]!, c[o + 2]!, c[o + 3]!);
        if (d <= c[o + 4]!) consider(6 + (d / c[o + 4]!) * 2, s.cones[i]!.obj);
      }
    }
    return bestId < 0 ? null : { id: bestId, score: best };
  }
}
