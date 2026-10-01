/**
 * From tracks to droplets (cloud chamber) or bubbles (bubble chamber), and the view geometry. Pure TypeScript: no DOM.
 *
 * A droplet is seven numbers in a flat Float32Array: x, y (mm), birth time (s), size (mm), brightness, life (s),
 * track id. The renderer turns them into sprites; the density along a track follows the local ionisation.
 */
import { normal, type Rng } from '$lib/hep/random';
import type { Track } from '$lib/hep/chamber';

export const STRIDE = 7;
/** A life this long means "never fades" (a photograph). */
export const FOREVER = 1e9;

export type ChamberKind = 'cloud' | 'bubble';

/** A growable buffer of droplets shared between the simulation and the renderer. */
export class DropletField {
  data = new Float32Array(STRIDE * 4096);
  count = 0;
  /** Incremented whenever the content changes, so a renderer knows to re-upload. */
  version = 0;

  clear(): void {
    this.count = 0;
    this.version++;
  }

  append(flat: ArrayLike<number>): void {
    const n = flat.length / STRIDE;
    if ((this.count + n) * STRIDE > this.data.length) {
      const bigger = new Float32Array(Math.max(this.data.length * 2, (this.count + n) * STRIDE * 1.5));
      bigger.set(this.data.subarray(0, this.count * STRIDE));
      this.data = bigger;
    }
    this.data.set(flat as ArrayLike<number>, this.count * STRIDE);
    this.count += n;
    this.version++;
  }

  /** Drop droplets that have faded out completely before `now`. Returns how many were removed. */
  prune(now: number, hold: number): number {
    let w = 0;
    const d = this.data;
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      const birth = d[o + 2]!;
      const life = d[o + 5]!;
      if (life < FOREVER && now > birth + hold + life + 0.05) continue;
      if (w !== i) d.copyWithin(w * STRIDE, o, o + STRIDE);
      w++;
    }
    const removed = this.count - w;
    if (removed) {
      this.count = w;
      this.version++;
    }
    return removed;
  }

  /** Remove the droplets of one track. */
  removeTrack(id: number): void {
    let w = 0;
    const d = this.data;
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      if (d[o + 6] === id) continue;
      if (w !== i) d.copyWithin(w * STRIDE, o, o + STRIDE);
      w++;
    }
    if (w !== this.count) {
      this.count = w;
      this.version++;
    }
  }

  /** The droplet nearest to (x, y) within `tol` mm, optionally of one track. */
  nearest(x: number, y: number, tol: number, trackId?: number): { x: number; y: number; track: number; dist: number } | null {
    let best: { x: number; y: number; track: number; dist: number } | null = null;
    let bd = tol;
    const d = this.data;
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      if (trackId !== undefined && d[o + 6] !== trackId) continue;
      const dx = d[o]! - x;
      const dy = d[o + 1]! - y;
      if (Math.abs(dx) > bd || Math.abs(dy) > bd) continue;
      const dist = Math.hypot(dx, dy);
      if (dist < bd) {
        bd = dist;
        best = { x: d[o]!, y: d[o + 1]!, track: d[o + 6]!, dist };
      }
    }
    return best;
  }

  /** The droplets of one track as (x, y) pairs. */
  of(trackId: number): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    const d = this.data;
    for (let i = 0; i < this.count; i++) {
      const o = i * STRIDE;
      if (d[o + 6] === trackId) out.push({ x: d[o]!, y: d[o + 1]! });
    }
    return out;
  }
}

export interface DropletOptions {
  kind: ChamberKind;
  /** Birth time (s) and life (s) of every droplet of this track. */
  birth: number;
  life: number;
  /** The minimum-ionising dE/dx of the medium, MeV/mm (restricted), so that density is measured in MIPs. */
  mip: number;
  /** Track id stored in each droplet. */
  id: number;
  /** Scale the number of droplets (quality setting). */
  density?: number;
}

/**
 * The droplets of one track: their number along the path follows the ionisation (saturating for very heavy
 * ionisation, where they merge into a solid line), scattered sideways by a fraction of a millimetre.
 */
export function dropletsForTrack(track: Track, rng: Rng, o: DropletOptions): number[] {
  const out: number[] = [];
  const pts = track.points;
  const k = o.density ?? 1;
  // A track that retraces itself (a low-energy electron circling in the field) does not make new droplets where the
  // vapour has already condensed: keep at most one droplet per small cell of the picture.
  const cell = o.kind === 'cloud' ? 0.3 : 0.45;
  const taken = new Set<number>();
  // droplets per mm of path at 1 × minimum ionisation, and the cap
  const perMm = o.kind === 'cloud' ? 2.1 : 0.55;
  const cap = o.kind === 'cloud' ? 16 : 3.2;
  const expo = o.kind === 'cloud' ? 0.42 : 0.38;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (!(a.visible && b.visible)) continue;
    const ds = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (ds <= 0) continue;
    const rel = Math.max(0.05, (0.5 * (a.dedx + b.dedx)) / o.mip);
    const dens = Math.min(cap, perMm * Math.pow(rel, expo)) * k;
    const nExp = dens * ds;
    const n = Math.floor(nExp + rng());
    if (!n) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    // Lateral spread (mm) grows slowly with ionisation: a thick alpha track is fuzzier than a muon's.
    const sigma = (o.kind === 'cloud' ? 0.17 : 0.09) * Math.pow(Math.max(rel, 1), 0.28);
    const size = o.kind === 'cloud' ? 0.62 * (1 + 0.22 * Math.log10(1 + rel)) : 0.62 * (1 + 0.15 * Math.log10(1 + rel));
    for (let j = 0; j < n; j++) {
      const t = rng();
      const lat = normal(rng, 0, sigma);
      const px = a.x + dx * t + nx * lat;
      const py = a.y + dy * t + ny * lat;
      const key = (Math.floor(px / cell) + 32768) * 65536 + (Math.floor(py / cell) + 32768);
      if (taken.has(key)) continue;
      taken.add(key);
      out.push(px, py, o.birth + rng() * 0.04, size * (0.8 + 0.4 * rng()), 0.55 + 0.45 * rng(), o.life * (0.85 + 0.3 * rng()), o.id);
    }
  }
  return out;
}

// ───────────────────────── view geometry ─────────────────────────
export interface View {
  /** World point (mm) at the centre of the screen. */
  cx: number;
  cy: number;
  /** CSS pixels per millimetre. */
  scale: number;
}

export const worldToScreen = (v: View, W: number, H: number, x: number, y: number): [number, number] => [(x - v.cx) * v.scale + W / 2, H / 2 - (y - v.cy) * v.scale];
export const screenToWorld = (v: View, W: number, H: number, sx: number, sy: number): [number, number] => [(sx - W / 2) / v.scale + v.cx, (H / 2 - sy) / v.scale + v.cy];

/** The view that just fits a world of (worldW × worldH) mm into W × H pixels. */
export function fitView(worldW: number, worldH: number, W: number, H: number): View {
  return { cx: 0, cy: 0, scale: Math.min(W / worldW, H / worldH) };
}

/** Zoom by `factor` keeping the world point under the screen point (sx, sy) fixed. */
export function zoomAt(v: View, factor: number, sx: number, sy: number, W: number, H: number, min: number, max: number): View {
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  const [wx, wy] = screenToWorld(v, W, H, sx, sy);
  return { scale, cx: wx - (sx - W / 2) / scale, cy: wy + (sy - H / 2) / scale };
}

// ───────────────────────── picking ─────────────────────────
/** Distance (mm) from point (px, py) to segment ab. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The visible track nearest to (x, y) in the picture (within `tol` mm), by distance to its polyline. */
export function pickTrack(tracks: readonly Track[], x: number, y: number, tol: number, eligible?: (t: Track) => boolean): { track: Track; index: number; dist: number } | null {
  let best: { track: Track; index: number; dist: number } | null = null;
  let bd = tol;
  for (const t of tracks) {
    if (t.neutral || (eligible && !eligible(t))) continue;
    const p = t.points;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1]!;
      const b = p[i]!;
      if (!(a.visible && b.visible)) continue;
      if (x < Math.min(a.x, b.x) - bd || x > Math.max(a.x, b.x) + bd || y < Math.min(a.y, b.y) - bd || y > Math.max(a.y, b.y) + bd) continue;
      const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
      // a delta-ray spur on a track must not steal the click from the track itself
      const score = d + (t.origin === 'delta ray' ? 0.6 * tol : 0);
      if (d < tol && score < bd) {
        bd = score;
        best = { track: t, index: i, dist: d };
      }
    }
  }
  return best;
}
