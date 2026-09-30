/**
 * Picking in screen space: which object is under the pointer. The views project their primitives to pixels and call these
 * functions, so the same logic serves the 3D view, the two projections and the lego plot. No DOM.
 */

export interface PickResult {
  /** The id given for the primitive (an object id). */
  id: number;
  /** Distance in pixels (0 when the pointer is inside an area). */
  dist: number;
}

/** Distance from a point to a segment, in the units of the inputs. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * The nearest polyline to (px, py) within `maxDist`. `xy` holds the projected points of all polylines, two numbers per point;
 * polyline k uses points starts[k] … starts[k+1]−1; `ids[k]` is its id (a negative id hides the line). Points with NaN coordinates (behind the camera) break the line.
 */
export function pickPolylines(xy: ArrayLike<number>, starts: ArrayLike<number>, ids: ArrayLike<number>, n: number, px: number, py: number, maxDist: number): PickResult | null {
  let best = maxDist;
  let bestId = -1;
  for (let k = 0; k < n; k++) {
    if (ids[k]! < 0) continue; // a hidden line
    const s = starts[k]!, e = starts[k + 1]!;
    for (let i = s; i < e - 1; i++) {
      const ax = xy[2 * i]!, ay = xy[2 * i + 1]!, bx = xy[2 * i + 2]!, by = xy[2 * i + 3]!;
      if (ax !== ax || bx !== bx) continue;
      // Cheap rejection: the segment's bounding box grown by the best distance.
      if (px < Math.min(ax, bx) - best || px > Math.max(ax, bx) + best || py < Math.min(ay, by) - best || py > Math.max(ay, by) + best) continue;
      const d = distToSegment(px, py, ax, ay, bx, by);
      if (d < best) {
        best = d;
        bestId = ids[k]!;
      }
    }
  }
  return bestId < 0 ? null : { id: bestId, dist: best };
}

/**
 * The nearest disc: (x, y) and radius per item. A pointer inside a disc has distance 0; otherwise the distance to its rim.
 * Returns the best within `maxDist` of the rim.
 */
export function pickDiscs(xy: ArrayLike<number>, radii: ArrayLike<number>, ids: ArrayLike<number>, n: number, px: number, py: number, maxDist: number): PickResult | null {
  let best = maxDist;
  let bestIdx = -1;
  for (let i = 0; i < n; i++) {
    const x = xy[2 * i]!;
    if (x !== x) continue;
    const d = Math.max(0, Math.hypot(px - x, py - xy[2 * i + 1]!) - radii[i]!);
    if (d < best || (d === 0 && best === 0 && bestIdx >= 0 && radii[i]! < radii[bestIdx]!)) {
      best = d;
      bestIdx = i;
    }
  }
  return bestIdx < 0 ? null : { id: ids[bestIdx]!, dist: best };
}

/** Whether (px, py) lies inside the convex polygon with vertices (x0,y0,x1,y1,…) in either winding. */
export function inConvexPolygon(px: number, py: number, poly: ArrayLike<number>): boolean {
  const n = poly.length / 2;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const ax = poly[2 * i]!, ay = poly[2 * i + 1]!;
    const bx = poly[2 * ((i + 1) % n)]!, by = poly[2 * ((i + 1) % n) + 1]!;
    const c = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (c !== 0) {
      const s = c > 0 ? 1 : -1;
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/**
 * Combine a line hit and an area hit. A line within `lineFirst` pixels wins over an area (towers are large and sit behind
 * tracks); otherwise the closer one wins.
 */
export function betterOf(line: PickResult | null, area: PickResult | null, lineFirst = 6): PickResult | null {
  if (line && (!area || line.dist <= lineFirst || line.dist <= area.dist)) return line;
  return area ?? line;
}
