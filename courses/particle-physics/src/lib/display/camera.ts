/**
 * Projection mathematics for the event display: an orbit camera (perspective) for the 3D view and the lego plot, and a 2D
 * orthographic view (pan and zoom) for the transverse and longitudinal views. No DOM: everything here is testable.
 *
 * World axes are the detector's: x, y transverse, z along the beam; the camera's up vector is world +y.
 * Matrices are column-major, as WebGL wants them. Screen coordinates are CSS pixels with the origin at the top left.
 */

const TAU = Math.PI * 2;

/** A perspective orbit camera around a target point. */
export class Camera {
  /** Rotation about the vertical (y) axis, radians. */
  azimuth = 1.0;
  /** Elevation above the xz plane, radians, limited to ±(π/2 − 0.05). */
  elevation = 0.35;
  /** Distance from the target (mm or whatever the scene's unit is). */
  distance = 10000;
  target: [number, number, number] = [0, 0, 0];
  /** Vertical field of view, radians. */
  fov = (38 * Math.PI) / 180;
  width = 800;
  height = 600;
  near = 100;
  far = 100000;
  /** Orthographic projection instead of perspective (used by the lego plot). */
  ortho = false;

  readonly view = new Float32Array(16);
  readonly proj = new Float32Array(16);
  readonly viewProj = new Float32Array(16);
  readonly eye: [number, number, number] = [0, 0, 0];
  /** Unit vectors of the camera frame in world coordinates (right, up, forward). */
  readonly right: [number, number, number] = [1, 0, 0];
  readonly up: [number, number, number] = [0, 1, 0];
  readonly forward: [number, number, number] = [0, 0, -1];

  constructor(init: Partial<Pick<Camera, 'azimuth' | 'elevation' | 'distance' | 'fov' | 'width' | 'height' | 'ortho'>> = {}) {
    Object.assign(this, init);
    this.update();
  }

  /** Orbit by (dAzimuth, dElevation) radians. */
  orbit(dAz: number, dEl: number): void {
    this.azimuth = (((this.azimuth + dAz) % TAU) + TAU) % TAU;
    const lim = Math.PI / 2 - 0.05;
    this.elevation = Math.max(-lim, Math.min(lim, this.elevation + dEl));
  }

  /** Multiply the distance by `factor` (> 1 zooms out), within [minDistance, maxDistance]. */
  zoom(factor: number, minDistance = 300, maxDistance = 60000): void {
    this.distance = Math.max(minDistance, Math.min(maxDistance, this.distance * factor));
  }

  /** Move the target along the camera's right and up vectors by (dx, dy) pixels. */
  pan(dxPx: number, dyPx: number): void {
    const s = this.pixelSize();
    for (let i = 0; i < 3; i++) this.target[i] = this.target[i]! - this.right[i]! * dxPx * s + this.up[i]! * dyPx * s;
  }

  /** World units per pixel at the target's depth. */
  pixelSize(): number {
    return (2 * this.distance * Math.tan(this.fov / 2)) / this.height;
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  /** Recompute eye, view, projection and their product. Allocation-free. */
  update(): void {
    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    const ca = Math.cos(this.azimuth), sa = Math.sin(this.azimuth);
    const dx = ce * sa, dy = se, dz = ce * ca;
    const t = this.target;
    this.eye[0] = t[0] + this.distance * dx;
    this.eye[1] = t[1] + this.distance * dy;
    this.eye[2] = t[2] + this.distance * dz;
    // forward = −(eye − target)/|…|
    const f = this.forward;
    f[0] = -dx; f[1] = -dy; f[2] = -dz;
    // right = forward × worldUp, normalised; up = right × forward
    // f × (0,1,0) = (−f_z, 0, f_x)
    let rx = -f[2], ry = 0, rz = f[0];
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    const r = this.right, u = this.up;
    r[0] = rx; r[1] = ry; r[2] = rz;
    u[0] = ry * f[2] - rz * f[1];
    u[1] = rz * f[0] - rx * f[2];
    u[2] = rx * f[1] - ry * f[0];
    const v = this.view;
    v[0] = rx; v[4] = ry; v[8] = rz; v[12] = -(rx * this.eye[0] + ry * this.eye[1] + rz * this.eye[2]);
    v[1] = u[0]; v[5] = u[1]; v[9] = u[2]; v[13] = -(u[0] * this.eye[0] + u[1] * this.eye[1] + u[2] * this.eye[2]);
    v[2] = -f[0]; v[6] = -f[1]; v[10] = -f[2]; v[14] = f[0] * this.eye[0] + f[1] * this.eye[1] + f[2] * this.eye[2];
    v[3] = 0; v[7] = 0; v[11] = 0; v[15] = 1;
    const p = this.proj;
    p.fill(0);
    const aspect = this.width / this.height;
    const n = this.near, fa = this.far;
    if (this.ortho) {
      const hh = this.distance * Math.tan(this.fov / 2), hw = hh * aspect;
      p[0] = 1 / hw; p[5] = 1 / hh; p[10] = -2 / (fa - n); p[14] = -(fa + n) / (fa - n); p[15] = 1;
    } else {
      const fl = 1 / Math.tan(this.fov / 2);
      p[0] = fl / aspect; p[5] = fl; p[10] = (fa + n) / (n - fa); p[11] = -1; p[14] = (2 * fa * n) / (n - fa);
    }
    mul4(this.viewProj, p, v);
  }

  /**
   * Project a world point to screen pixels. Writes (x, y, depth) into `out`, where depth is the distance along the view
   * direction (negative = behind the camera). Returns false if the point is behind the near plane.
   */
  project(x: number, y: number, z: number, out: { [i: number]: number }): boolean {
    const m = this.viewProj;
    const cx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    const cy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    const cw = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
    const vz = this.view[2]! * x + this.view[6]! * y + this.view[10]! * z + this.view[14]!;
    out[2] = -vz;
    if (this.ortho) {
      out[0] = (cx * 0.5 + 0.5) * this.width;
      out[1] = (0.5 - cy * 0.5) * this.height;
      return -vz > this.near;
    }
    if (cw <= 1e-6) {
      out[0] = NaN;
      out[1] = NaN;
      return false;
    }
    out[0] = (cx / cw * 0.5 + 0.5) * this.width;
    out[1] = (0.5 - (cy / cw) * 0.5) * this.height;
    return true;
  }

  /** Set near and far planes to bound a scene of radius `radius` centred on the target. */
  fitClip(radius: number): void {
    this.far = this.distance + radius * 2.5;
    this.near = Math.max(10, (this.distance - radius * 1.5) * 0.25);
    if (this.ortho) this.near = -this.far;
  }
}

/** out = a · b for column-major 4×4 matrices. */
export function mul4(out: Float32Array, a: Float32Array, b: Float32Array): void {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
}

/** A 2D orthographic view: world (u, v) with v up, to pixels with y down. */
export class View2D {
  /** World coordinates at the centre of the view. */
  cx = 0;
  cy = 0;
  /** Pixels per world unit. */
  scale = 0.1;
  width = 400;
  height = 400;

  toScreenX(u: number): number {
    return this.width / 2 + (u - this.cx) * this.scale;
  }
  toScreenY(v: number): number {
    return this.height / 2 - (v - this.cy) * this.scale;
  }
  toWorldU(px: number): number {
    return this.cx + (px - this.width / 2) / this.scale;
  }
  toWorldV(py: number): number {
    return this.cy - (py - this.height / 2) / this.scale;
  }
  /** Fit the box [u0,u1]×[v0,v1] in the view with a margin in pixels. */
  fit(u0: number, u1: number, v0: number, v1: number, margin = 12): void {
    this.cx = (u0 + u1) / 2;
    this.cy = (v0 + v1) / 2;
    const sx = (this.width - 2 * margin) / Math.max(1e-9, u1 - u0);
    const sy = (this.height - 2 * margin) / Math.max(1e-9, v1 - v0);
    this.scale = Math.max(1e-6, Math.min(sx, sy));
  }
  /** Zoom by `factor` (> 1 zooms in) keeping the world point under pixel (px, py) fixed. */
  zoomAt(px: number, py: number, factor: number, minScale = 1e-4, maxScale = 50): void {
    const u = this.toWorldU(px), v = this.toWorldV(py);
    this.scale = Math.max(minScale, Math.min(maxScale, this.scale * factor));
    this.cx = u - (px - this.width / 2) / this.scale;
    this.cy = v + (py - this.height / 2) / this.scale;
  }
  pan(dxPx: number, dyPx: number): void {
    this.cx -= dxPx / this.scale;
    this.cy += dyPx / this.scale;
  }
  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
  }
}

/** The signed radius of the longitudinal view: ρ with the sign of y (an object's side of the beam axis). */
export const signedRho = (x: number, y: number): number => (y < 0 ? -1 : 1) * Math.hypot(x, y);
