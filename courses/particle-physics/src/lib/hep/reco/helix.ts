/**
 * Helices in a uniform solenoid field along +z.
 *
 * A charged particle of charge q (in units of e) and transverse momentum pT (GeV) moves on a circle of radius
 *
 *     R[m] = pT[GeV] / (0.299792458 · B[T])
 *
 * and, because the field points along +z, a *positive* particle turns clockwise seen from +z: the azimuth of its
 * direction decreases along the path, φ(s) = φ₀ − c·s, where s is the transverse arc length and
 * c = q / R is the signed curvature (1/mm in this library). Along z the motion is uniform: z(s) = z₀ + s·tanλ with
 * tanλ = pz/pT = sinh η.
 *
 * The five **perigee parameters** describe the point of closest approach to the beam line (the z axis):
 *   d0  signed transverse impact parameter (mm), d0 = −x sinφ₀ + y cosφ₀ at the perigee (positive when the
 *       perigee lies to the left of the direction of motion when seen from the origin),
 *   z0  z at the perigee (mm),
 *   φ0  direction of motion at the perigee,
 *   tanλ, and the signed curvature c (or equivalently q and pT).
 */

/** GeV per (tesla · metre): p[GeV] = 0.299792458 · B[T] · R[m] for a unit charge. */
export const GEV_PER_TESLA_M = 0.299792458;

/** Transverse momentum (GeV) of a unit-charge particle on a circle of radius `R_mm` in a field `bTesla`. */
export function ptFromRadius(R_mm: number, bTesla: number): number {
  return (GEV_PER_TESLA_M * Math.abs(bTesla) * Math.abs(R_mm)) / 1000;
}
/** Radius (mm) of the circle of a unit-charge particle with transverse momentum `pt` (GeV). */
export function radiusFromPt(pt: number, bTesla: number): number {
  return (1000 * pt) / (GEV_PER_TESLA_M * Math.abs(bTesla));
}
/** Signed curvature 1/R (1/mm) of a particle of charge q (±1). Positive = clockwise seen from +z. */
export function curvatureFromPt(pt: number, bTesla: number, q: number): number {
  return (q * GEV_PER_TESLA_M * bTesla) / (1000 * pt);
}

/** A helix in perigee parameters. `c` is the signed curvature in 1/mm (c = q·0.2998·B/(1000 pT)). */
export interface Helix {
  d0: number;
  z0: number;
  phi0: number;
  tanLambda: number;
  c: number;
}

export interface HelixPoint {
  x: number;
  y: number;
  z: number;
  /** Direction of motion (azimuth) at this point. */
  phi: number;
}

/** sin(u)/u, stable near zero. */
export function sinc(u: number): number {
  return Math.abs(u) < 1e-4 ? 1 - (u * u) / 6 : Math.sin(u) / u;
}

/** Position on the helix after transverse arc length s (mm) from the perigee. */
export function helixAt(h: Helix, s: number): HelixPoint {
  const { c, phi0 } = h;
  const x0 = -h.d0 * Math.sin(phi0);
  const y0 = h.d0 * Math.cos(phi0);
  const half = (c * s) / 2;
  const L = s * sinc(half);
  const mid = phi0 - half;
  return { x: x0 + L * Math.cos(mid), y: y0 + L * Math.sin(mid), z: h.z0 + s * h.tanLambda, phi: phi0 - c * s };
}

/**
 * Transverse arc length s > 0 from the perigee at which the helix reaches the cylinder of radius r, or NaN when
 * it never does (a particle curling up inside r).
 *
 * Geometry: the distance to the axis at arc length s obeys r² = d0² + 4 |ρ| |R| sin²(cs/2), with R = 1/c and
 * ρ = R − d0 the distance from the origin to the centre of the circle. No cancellation for nearly straight tracks.
 */
export function arcToRadius(h: Helix, r: number): number {
  const { c, d0 } = h;
  const r2 = r * r - d0 * d0;
  if (r2 < 0) return NaN;
  if (Math.abs(c) < 1e-12) return Math.sqrt(r2);
  const R = 1 / c;
  const rho = Math.abs(R - d0);
  const arg = r2 / (4 * rho * Math.abs(R));
  if (arg > 1) return NaN;
  return (2 * Math.asin(Math.sqrt(arg))) / Math.abs(c);
}

/** The helix's position at the cylinder of radius r (forward of the perigee), or undefined if it does not reach it. */
export function helixAtRadius(h: Helix, r: number): HelixPoint | undefined {
  const s = arcToRadius(h, r);
  return Number.isNaN(s) ? undefined : helixAt(h, s);
}

/** The transverse arc length (from the perigee) of the point of the helix's circle closest to (x, y). */
export function arcNearest(h: Helix, x: number, y: number): number {
  const { c, phi0 } = h;
  const x0 = -h.d0 * Math.sin(phi0);
  const y0 = h.d0 * Math.cos(phi0);
  if (Math.abs(c) < 1e-12) return (x - x0) * Math.cos(phi0) + (y - y0) * Math.sin(phi0);
  const R = 1 / c;
  // centre of the circle
  const xc = x0 + R * Math.sin(phi0);
  const yc = y0 - R * Math.cos(phi0);
  const aP = Math.atan2(y0 - yc, x0 - xc);
  const aQ = Math.atan2(y - yc, x - xc);
  // motion is clockwise for c > 0: angle decreases by c·s
  let d = (aP - aQ) * Math.sign(c);
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d / Math.abs(c);
}

/**
 * Signed transverse distance from the point (x, y) to the helix's circle, positive when the point is to the left of
 * the direction of motion (same sign convention as d0), and the z of the helix at the nearest point.
 */
export function distanceToHelix(h: Helix, x: number, y: number): { d: number; s: number; z: number; gx: number; gy: number } {
  const s = arcNearest(h, x, y);
  const p = helixAt(h, s);
  const dx = x - p.x;
  const dy = y - p.y;
  // left-pointing normal of the direction at the nearest point
  const nx = -Math.sin(p.phi);
  const ny = Math.cos(p.phi);
  return { d: dx * nx + dy * ny, s, z: p.z, gx: nx, gy: ny };
}

/** Perigee parameters from a point, a direction (azimuth ψ), tanλ and the signed curvature c. */
export function perigeeFromPoint(x: number, y: number, z: number, psi: number, tanLambda: number, c: number): Helix {
  if (Math.abs(c) < 1e-12) {
    // straight line
    const dx = Math.cos(psi);
    const dy = Math.sin(psi);
    const s = -(x * dx + y * dy);
    const px = x + s * dx;
    const py = y + s * dy;
    return { d0: dx * py - dy * px, z0: z + s * tanLambda, phi0: psi, tanLambda, c };
  }
  const R = 1 / c;
  const cx = x + R * Math.sin(psi);
  const cy = y - R * Math.cos(psi);
  // (sinφ0, −cosφ0) points from the origin towards the centre for c > 0, away for c < 0
  const phi0 = c > 0 ? Math.atan2(cx, -cy) : Math.atan2(-cx, cy);
  const d0 = -x * Math.sin(phi0) + y * Math.cos(phi0) + (1 - Math.cos(psi - phi0)) / c;
  let dphi = psi - phi0;
  while (dphi > Math.PI) dphi -= 2 * Math.PI;
  while (dphi <= -Math.PI) dphi += 2 * Math.PI;
  // arc length from the perigee to the point: φ decreases by c·s, so s = (φ0 − ψ)/c
  const s = -dphi / c;
  return { d0, z0: z - s * tanLambda, phi0, tanLambda, c };
}

/** Helix parameters from physical track parameters. */
export function helixFromTrack(t: { pt: number; eta: number; phi: number; d0: number; z0: number; charge: number }, bTesla: number): Helix {
  return { d0: t.d0, z0: t.z0, phi0: t.phi, tanLambda: Math.sinh(t.eta), c: curvatureFromPt(t.pt, bTesla, t.charge) };
}

/** Wrap an angle into (−π, π]. */
export function wrapPi(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** A point with a direction on a helix: position, azimuth ψ of the direction, tanλ and signed curvature c (1/mm). */
export interface HelixState {
  x: number;
  y: number;
  z: number;
  psi: number;
  tanLambda: number;
  c: number;
}

/**
 * Follow the helix from `st` to the cylinder of radius `r`, the first crossing on the outgoing branch (forward of
 * the perigee), whether that is ahead of the current point (r larger) or behind it (r smaller).
 * Returns undefined when the helix never reaches that radius. `ds` is the signed transverse arc length travelled.
 */
export function propagateToRadius(st: HelixState, r: number): (HelixState & { ds: number }) | undefined {
  const h = perigeeFromPoint(st.x, st.y, st.z, st.psi, st.tanLambda, st.c);
  const s0 = arcNearest(h, st.x, st.y);
  const s1 = arcToRadius(h, r);
  if (Number.isNaN(s1)) return undefined;
  const p = helixAt(h, s1);
  return { x: p.x, y: p.y, z: p.z, psi: p.phi, tanLambda: st.tanLambda, c: st.c, ds: s1 - s0 };
}
