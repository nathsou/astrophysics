/**
 * Orthographic projection and a polar mesh for drawing a surface of revolution on a 2D canvas (the Mexican hat).
 * No DOM here, so it can be tested.
 *
 * World axes: x and y in the horizontal plane (the complex plane of φ), z up. The camera looks at the origin from azimuth `az`
 * (rotation about the vertical axis) and elevation `el` (0 = side view, π/2 = looking straight down).
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Projected {
  /** Screen x (right) and y (up), in world units. */
  X: number;
  Y: number;
  /** Larger = closer to the camera (for painter's-algorithm sorting). */
  depth: number;
}

export function project(p: Vec3, az: number, el: number): Projected {
  const ca = Math.cos(az);
  const sa = Math.sin(az);
  const xr = p.x * ca - p.y * sa;
  const yr = p.x * sa + p.y * ca;
  const ce = Math.cos(el);
  const se = Math.sin(el);
  return { X: xr, Y: p.z * ce + yr * se, depth: -yr * ce + p.z * se };
}

export interface Quad {
  /** Four corners, counter-clockwise seen from above. */
  pts: [Vec3, Vec3, Vec3, Vec3];
  /** Polar cell indices. */
  i: number;
  j: number;
  /** Unit normal of the cell (for shading). */
  normal: Vec3;
  /** Mean height. */
  zMean: number;
}

/** The mesh of z = h(r) over 0 ≤ r ≤ rMax, with `nr` rings and `nt` sectors. */
export function polarMesh(h: (r: number) => number, rMax: number, nr: number, nt: number): Quad[] {
  const quads: Quad[] = [];
  const pt = (i: number, j: number): Vec3 => {
    const r = (i / nr) * rMax;
    const t = (j / nt) * 2 * Math.PI;
    return { x: r * Math.cos(t), y: r * Math.sin(t), z: h(r) };
  };
  for (let i = 0; i < nr; i++)
    for (let j = 0; j < nt; j++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      // normal from the two diagonals
      const u = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const v = { x: d.x - b.x, y: d.y - b.y, z: d.z - b.z };
      let nx = u.y * v.z - u.z * v.y;
      let ny = u.z * v.x - u.x * v.z;
      let nz = u.x * v.y - u.y * v.x;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      if (nz < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      quads.push({ pts: [a, b, c, d], i, j, normal: { x: nx, y: ny, z: nz }, zMean: (a.z + b.z + c.z + d.z) / 4 });
    }
  return quads;
}

/** Lambertian shade in [0, 1] for a unit normal and a light direction (need not be normalised). */
export function shade(n: Vec3, light: Vec3): number {
  const l = Math.hypot(light.x, light.y, light.z) || 1;
  return Math.max(0, (n.x * light.x + n.y * light.y + n.z * light.z) / l);
}
