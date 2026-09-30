/**
 * Helical trajectories of charged particles in a solenoid field along z, and straight lines for neutral ones.
 *
 * Conventions: lengths in mm, momenta in GeV, field in tesla. With B along +z a positive particle turns clockwise seen from
 * +z: φ(s) = φ₀ + ω s with ω = −q sgn(B) / R and radius R[mm] = 1000 · pT / (0.29979 |q B|), where s is the path length
 * projected on the xy plane. The position is exact (arcs), and z advances as s · sinh η.
 */

/** 0.299792458 (GeV / (T·m)): pT = 0.3 B R. */
export const CURVATURE = 0.299792458;

export interface HelixParams {
  /** Charge in units of e (0 for a straight line). */
  charge: number;
  /** Transverse momentum (GeV). */
  pt: number;
  eta: number;
  /** Direction of flight at the start (radians). */
  phi: number;
  /** Start position (mm). */
  x: number;
  y: number;
  z: number;
  /** Field along z (T). */
  b: number;
}

/** Radius of curvature in mm (Infinity for neutral particles or no field). */
export function radiusOfCurvature(pt: number, charge: number, b: number): number {
  const k = Math.abs(charge * b);
  return k === 0 ? Infinity : (1000 * pt) / (CURVATURE * k);
}

/** ω: the rate of change of the direction with the transverse path length (rad/mm). */
export function omega(h: Pick<HelixParams, 'charge' | 'pt' | 'b'>): number {
  const R = radiusOfCurvature(h.pt, h.charge, h.b);
  return R === Infinity ? 0 : -Math.sign(h.charge * h.b) / R;
}

/** The position after transverse path length s. */
export function pointAt(h: HelixParams, s: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const w = omega(h);
  if (Math.abs(w * s) < 1e-9) {
    out[0] = h.x + s * Math.cos(h.phi);
    out[1] = h.y + s * Math.sin(h.phi);
  } else {
    out[0] = h.x + (Math.sin(h.phi + w * s) - Math.sin(h.phi)) / w;
    out[1] = h.y - (Math.cos(h.phi + w * s) - Math.cos(h.phi)) / w;
  }
  out[2] = h.z + s * Math.sinh(h.eta);
  return out;
}

/** The direction angle in the xy plane after path length s. */
export const phiAt = (h: HelixParams, s: number): number => h.phi + omega(h) * s;

/** Helix parameters from a momentum vector and a production vertex. */
export function helixFromMomentum(charge: number, px: number, py: number, pz: number, vertex: readonly [number, number, number], b: number): HelixParams {
  const pt = Math.hypot(px, py);
  return { charge, pt, eta: Math.asinh(pz / Math.max(pt, 1e-12)), phi: Math.atan2(py, px), x: vertex[0], y: vertex[1], z: vertex[2], b };
}

/**
 * Helix parameters of a reconstructed track, starting at its point of closest approach to the primary vertex. The
 * transverse impact parameter d0 is signed: the point of closest approach is (x_pv − d0 sin φ, y_pv + d0 cos φ), i.e. d0 > 0 when
 * the primary vertex lies to the right of the direction of flight. z0 is the longitudinal offset from the primary vertex.
 */
export function helixFromTrack(t: { charge: number; pt: number; eta: number; phi: number; d0: number; z0: number }, pv: readonly [number, number, number], b: number): HelixParams {
  return { charge: t.charge, pt: t.pt, eta: t.eta, phi: t.phi, x: pv[0] - t.d0 * Math.sin(t.phi), y: pv[1] + t.d0 * Math.cos(t.phi), z: pv[2] + t.z0, b };
}

/**
 * The smallest s ≥ 0 at which the transverse distance from the z axis equals r (null if the circle never reaches it).
 * Valid for a constant field.
 */
export function pathToRadius(h: HelixParams, r: number): number | null {
  const r0 = Math.hypot(h.x, h.y);
  if (r0 >= r) return 0;
  const w = omega(h);
  if (w === 0) {
    const ux = Math.cos(h.phi), uy = Math.sin(h.phi);
    const bq = h.x * ux + h.y * uy;
    const disc = bq * bq - (r0 * r0 - r * r);
    if (disc < 0) return null;
    const s = -bq + Math.sqrt(disc);
    return s >= 0 ? s : null;
  }
  const R = 1 / Math.abs(w);
  const side = w > 0 ? 1 : -1; // counter-clockwise turn: the centre is to the left of the direction of flight
  const cx = h.x - side * R * Math.sin(h.phi);
  const cy = h.y + side * R * Math.cos(h.phi);
  const d = Math.hypot(cx, cy);
  if (d < 1e-9) return null; // a circle around the origin never changes its radius
  if (r > d + R + 1e-9 || r < Math.abs(d - R) - 1e-9) return null;
  // Points of the circle: P(α) = C + R (cos α, sin α), |P|² = d² + R² + 2 d R cos(α − γ) with γ = atan2(cy, cx).
  const gamma = Math.atan2(cy, cx);
  const a0 = Math.atan2(h.y - cy, h.x - cx);
  const cc = Math.max(-1, Math.min(1, (r * r - d * d - R * R) / (2 * d * R)));
  const delta = Math.acos(cc);
  let best: number | null = null;
  for (const alpha of [gamma + delta, gamma - delta]) {
    let da = (alpha - a0) * side;
    da = ((da % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const s = da * R;
    if (best === null || s < best) best = s;
  }
  return best;
}

/** The path length at which |z| reaches zMax (Infinity if the track runs parallel to the beam or away from it). */
export function pathToZ(h: HelixParams, zMax: number): number {
  const t = Math.sinh(h.eta);
  if (Math.abs(t) < 1e-12) return Infinity;
  const s = ((t > 0 ? zMax : -zMax) - h.z) / t;
  return s >= 0 ? s : Infinity;
}

/**
 * Where the particle leaves a barrel + end-cap cylinder (radius r, half-length halfLength): the path length, and which face.
 * Null if it never does (a curler inside the barrel).
 */
export function exitCylinder(h: HelixParams, r: number, halfLength: number): { s: number; face: 'barrel' | 'endcap' } | null {
  const sr = pathToRadius(h, r);
  const sz = pathToZ(h, halfLength);
  if (sr === null && !Number.isFinite(sz)) return null;
  if (sr === null) return { s: sz, face: 'endcap' };
  return sz < sr ? { s: sz, face: 'endcap' } : { s: sr, face: 'barrel' };
}

export interface TraceOptions {
  /** Stop when the transverse radius reaches this (mm). */
  rStop: number;
  /** Stop when |z| reaches this (mm). */
  zStop: number;
  /** Largest step along the path (mm). */
  maxStep?: number;
  /** Largest turn per step (rad). */
  maxTurn?: number;
  /** Stop after this many turns of a looper. */
  maxTurns?: number;
  /** Radius beyond which the field is `outerFactor × B` (the coil radius); Infinity for a uniform field. */
  rCoil?: number;
  outerFactor?: number;
  /** Stop at this transverse path length if reached first (e.g. a decay vertex), mm. */
  sMax?: number;
}

export interface Trace {
  /** x, y, z of each point, flattened. */
  points: number[];
  /** Why the trace ended. */
  end: 'radius' | 'endcap' | 'loop' | 'vertex';
  /** Transverse path length covered. */
  s: number;
}

/**
 * Follow a particle from its start point until it leaves the volume `rStop`×`zStop`, completes `maxTurns` turns or reaches
 * `sMax`. The last point lies on the boundary that stopped it (to a fraction of a millimetre).
 */
export function traceHelix(h: HelixParams, o: TraceOptions): Trace {
  const maxStep = o.maxStep ?? 70;
  const maxTurn = o.maxTurn ?? 0.1;
  const rCoil = o.rCoil ?? Infinity;
  const outer = o.outerFactor ?? 1;
  const R0 = radiusOfCurvature(h.pt, h.charge, h.b);
  const sLoop = Number.isFinite(R0) ? (o.maxTurns ?? 1) * 2 * Math.PI * R0 : Infinity;
  const sMax = Math.min(o.sMax ?? Infinity, sLoop, 1e7);
  const vertexEnd = (o.sMax ?? Infinity) <= sLoop;
  const tz = Math.sinh(h.eta);
  const pts: number[] = [h.x, h.y, h.z];
  const w0 = omega(h);
  let s = 0;
  let x = h.x, y = h.y, z = h.z, phi = h.phi;
  for (let guard = 0; guard < 20000; guard++) {
    const r = Math.hypot(x, y);
    const w = r > rCoil ? w0 * outer : w0;
    let ds = maxStep;
    if (w !== 0) ds = Math.min(ds, maxTurn / Math.abs(w));
    const last = s + ds >= sMax;
    if (last) ds = sMax - s;
    let nx: number, ny: number, nphi: number;
    if (w === 0) {
      nx = x + ds * Math.cos(phi);
      ny = y + ds * Math.sin(phi);
      nphi = phi;
    } else {
      nphi = phi + w * ds;
      nx = x + (Math.sin(nphi) - Math.sin(phi)) / w;
      ny = y - (Math.cos(nphi) - Math.cos(phi)) / w;
    }
    const nz = z + ds * tz;
    const nr = Math.hypot(nx, ny);
    const outR = nr >= o.rStop;
    const outZ = Math.abs(nz) >= o.zStop;
    if (outR || outZ) {
      const fr = outR ? (nr > r ? (o.rStop - r) / (nr - r) : 1) : Infinity;
      const fz = outZ ? (nz !== z ? (Math.sign(nz) * o.zStop - z) / (nz - z) : 1) : Infinity;
      const f = Math.max(0, Math.min(1, Math.min(fr, fz)));
      pts.push(x + f * (nx - x), y + f * (ny - y), z + f * (nz - z));
      return { points: pts, end: fz < fr ? 'endcap' : 'radius', s: s + f * ds };
    }
    x = nx; y = ny; z = nz; phi = nphi;
    s += ds;
    pts.push(x, y, z);
    if (last) return { points: pts, end: vertexEnd ? 'vertex' : 'loop', s };
  }
  return { points: pts, end: 'loop', s };
}

/** A straight line from a point along direction (η, φ) until it leaves the cylinder. Returns the two end points, flattened. */
export function straightLine(x: number, y: number, z: number, eta: number, phi: number, rStop: number, zStop: number): number[] {
  const ch = Math.cosh(eta);
  const dx = Math.cos(phi) / ch, dy = Math.sin(phi) / ch, dz = Math.tanh(eta);
  let t = Infinity;
  const a = dx * dx + dy * dy, bq = x * dx + y * dy, c = x * x + y * y - rStop * rStop;
  if (a > 1e-12) {
    const disc = bq * bq - a * c;
    if (disc >= 0) t = Math.min(t, (-bq + Math.sqrt(disc)) / a);
  }
  if (Math.abs(dz) > 1e-9) t = Math.min(t, ((dz > 0 ? zStop : -zStop) - z) / dz);
  if (!Number.isFinite(t) || t < 0) t = 0;
  return [x, y, z, x + t * dx, y + t * dy, z + t * dz];
}

/** A wavy line between two 2D points: amp·sin(2π u/λ) about the segment, `perWave` samples per wavelength, flattened. */
export function wavyPolyline(x0: number, y0: number, x1: number, y1: number, amp: number, wavelength: number, perWave = 10): number[] {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 1e-9) return [x0, y0];
  const n = Math.max(2, Math.ceil((L / wavelength) * perWave));
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * L;
    // Taper the amplitude over the first and last half-wavelength so the line starts and ends on the axis.
    const env = Math.min(1, u / (wavelength / 2), (L - u) / (wavelength / 2));
    const d = amp * env * Math.sin((2 * Math.PI * u) / wavelength);
    out.push(x0 + ux * u - uy * d, y0 + uy * u + ux * d);
  }
  return out;
}

/**
 * A wavy line between two 3D points: the sine wave lies in the plane containing the line and the z axis (or the y axis for a
 * line along z). Returns x, y, z of each sample, flattened.
 */
export function wavyPolyline3D(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, amp: number, wavelength: number, perWave = 8): number[] {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const L = Math.hypot(dx, dy, dz);
  if (L < 1e-9) return [x0, y0, z0];
  const ux = dx / L, uy = dy / L, uz = dz / L;
  // perpendicular n = component of the reference axis normal to u
  const ref: [number, number, number] = Math.abs(uz) < 0.95 ? [0, 0, 1] : [0, 1, 0];
  const dot = ref[0] * ux + ref[1] * uy + ref[2] * uz;
  let nx = ref[0] - dot * ux, ny = ref[1] - dot * uy, nz = ref[2] - dot * uz;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const n = Math.max(2, Math.ceil((L / wavelength) * perWave));
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * L;
    const env = Math.min(1, u / (wavelength / 2), (L - u) / (wavelength / 2));
    const d = amp * env * Math.sin((2 * Math.PI * u) / wavelength);
    out.push(x0 + ux * u + nx * d, y0 + uy * u + ny * d, z0 + uz * u + nz * d);
  }
  return out;
}
