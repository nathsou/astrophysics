/**
 * Just enough linear algebra for the voltage landscape: 4×4 matrices (column-major, as WebGL wants them),
 * a perspective or orthographic camera that orbits a target, and projection of a world point to the screen.
 * No libraries.
 */

export type Vec3 = [number, number, number];
export type Mat4 = Float32Array;

export function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a · b (apply b first, then a). */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
      out[c * 4 + r] = s;
    }
  return out;
}

/** Perspective projection: vertical field of view in radians, depth range mapped to −1…1. */
export function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

/** Orthographic projection of a view volume `height` units tall. */
export function orthographic(height: number, aspect: number, near: number, far: number): Mat4 {
  const h = height / 2;
  const w = h * aspect;
  const m = new Float32Array(16);
  m[0] = 1 / w;
  m[5] = 1 / h;
  m[10] = -2 / (far - near);
  m[14] = -(far + near) / (far - near);
  m[15] = 1;
  return m;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** View matrix looking from `eye` at `target`, with +y up. */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const f = norm(sub(target, eye));
  const s = norm(cross(f, up));
  const u = cross(s, f);
  const m = new Float32Array(16);
  m[0] = s[0];
  m[4] = s[1];
  m[8] = s[2];
  m[1] = u[0];
  m[5] = u[1];
  m[9] = u[2];
  m[2] = -f[0];
  m[6] = -f[1];
  m[10] = -f[2];
  m[12] = -dot(s, eye);
  m[13] = -dot(u, eye);
  m[14] = dot(f, eye);
  m[15] = 1;
  return m;
}

export interface Camera {
  /** Rotation about the vertical axis (radians): 0 looks along −z from +z. */
  yaw: number;
  /** Elevation above the horizon (radians). */
  pitch: number;
  distance: number;
  target: Vec3;
  /** Orthographic (the Canvas 2D fallback, an isometric-style view) or perspective. */
  ortho: boolean;
  /** Vertical field of view (radians) for the perspective camera. */
  fov: number;
}

export const DEFAULT_CAMERA: Camera = { yaw: 0.55, pitch: 0.5, distance: 14.5, target: [0, 1.1, 0], ortho: false, fov: 0.62 };

export function cameraEye(c: Camera): Vec3 {
  const cp = Math.cos(c.pitch);
  return [c.target[0] + c.distance * cp * Math.sin(c.yaw), c.target[1] + c.distance * Math.sin(c.pitch), c.target[2] + c.distance * cp * Math.cos(c.yaw)];
}

/** Projection × view for a camera and a viewport aspect ratio. */
export function viewProjection(c: Camera, aspect: number): Mat4 {
  const view = lookAt(cameraEye(c), c.target);
  // The orthographic view is sized to show the same extent as the perspective one at the target.
  const proj = c.ortho ? orthographic(2 * c.distance * Math.tan(c.fov / 2), aspect, 0.1, 100) : perspective(c.fov, aspect, 0.1, 100);
  return multiply(proj, view);
}

export interface Projected {
  /** Pixels from the left/top of the viewport. */
  x: number;
  y: number;
  /** Normalised device depth (−1 near … 1 far): larger is farther. */
  depth: number;
  /** In front of the camera and inside the depth range. */
  visible: boolean;
  /** Clip-space w (distance along the view axis for perspective), for sizing things by distance. */
  w: number;
}

/** Project a world point to viewport pixels. */
export function project(p: Vec3, mvp: Mat4, width: number, height: number): Projected {
  const x = mvp[0]! * p[0] + mvp[4]! * p[1] + mvp[8]! * p[2] + mvp[12]!;
  const y = mvp[1]! * p[0] + mvp[5]! * p[1] + mvp[9]! * p[2] + mvp[13]!;
  const z = mvp[2]! * p[0] + mvp[6]! * p[1] + mvp[10]! * p[2] + mvp[14]!;
  const w = mvp[3]! * p[0] + mvp[7]! * p[1] + mvp[11]! * p[2] + mvp[15]!;
  if (!(w > 1e-6)) return { x: NaN, y: NaN, depth: 1, visible: false, w };
  const nx = x / w;
  const ny = y / w;
  const nz = z / w;
  return { x: (nx * 0.5 + 0.5) * width, y: (0.5 - ny * 0.5) * height, depth: nz, visible: nz >= -1 && nz <= 1, w };
}
