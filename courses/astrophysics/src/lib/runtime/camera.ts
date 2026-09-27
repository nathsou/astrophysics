// Minimal mat4 helpers (column-major Float32Array, WebGPU clip space z ∈ [0,1])
// and an orbit camera with mouse/touch/wheel controls for 3D sims.

export type Mat4 = Float32Array;

export function perspective(fovy: number, aspect: number, near: number, far: number, out: Mat4 = new Float32Array(16)): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (near * far) / (near - far);
  return out;
}

export function lookAt(eye: number[], target: number[], up: number[], out: Mat4 = new Float32Array(16)): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out.set([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  return out;
}

export function multiply(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  return out;
}

export interface OrbitCameraOpts {
  distance?: number;
  minDistance?: number;
  maxDistance?: number;
  yaw?: number;
  pitch?: number;
  fov?: number;
  near?: number;
  far?: number;
  target?: [number, number, number];
  /** Slowly rotate when idle (rad/s). */
  autoRotate?: number;
}

/**
 * Orbit camera: drag to rotate, wheel/pinch to zoom. Z is up.
 *   const cam = new OrbitCamera(stage.canvas, { distance: 10 });
 *   cam.onChange = () => loop.invalidate();
 *   const viewProj = cam.viewProj(aspect);   // Float32Array(16)
 */
export class OrbitCamera {
  distance: number;
  yaw: number;
  pitch: number;
  fov: number;
  near: number;
  far: number;
  target: [number, number, number];
  autoRotate: number;
  minDistance: number;
  maxDistance: number;
  onChange: () => void = () => {};
  private view = new Float32Array(16);
  private proj = new Float32Array(16);
  private vp = new Float32Array(16);
  private lastInteract = 0;

  constructor(el: HTMLElement, o: OrbitCameraOpts = {}) {
    this.distance = o.distance ?? 10;
    this.minDistance = o.minDistance ?? this.distance * 0.05;
    this.maxDistance = o.maxDistance ?? this.distance * 20;
    this.yaw = o.yaw ?? 0.6;
    this.pitch = o.pitch ?? 0.5;
    this.fov = o.fov ?? (45 * Math.PI) / 180;
    this.near = o.near ?? this.distance * 0.001;
    this.far = o.far ?? this.distance * 100;
    this.target = o.target ?? [0, 0, 0];
    this.autoRotate = o.autoRotate ?? 0;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      this.lastInteract = performance.now();
      if (pointers.size === 1) {
        this.yaw -= (e.clientX - p.x) * 0.006;
        this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch + (e.clientY - p.y) * 0.006));
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoom(pinch / d);
        pinch = d;
      }
      this.onChange();
    });
    const up = (e: PointerEvent) => { pointers.delete(e.pointerId); pinch = 0; el.style.cursor = 'grab'; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.lastInteract = performance.now();
      this.zoom(Math.exp(e.deltaY * 0.001));
      this.onChange();
    }, { passive: false });
  }

  zoom(f: number) {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance * f));
  }

  /** Advance auto-rotation; returns true if the camera moved. */
  update(dt: number): boolean {
    if (!this.autoRotate || performance.now() - this.lastInteract < 3000) return false;
    this.yaw += this.autoRotate * dt;
    return true;
  }

  get eye(): [number, number, number] {
    const cp = Math.cos(this.pitch);
    return [
      this.target[0] + this.distance * cp * Math.cos(this.yaw),
      this.target[1] + this.distance * cp * Math.sin(this.yaw),
      this.target[2] + this.distance * Math.sin(this.pitch),
    ];
  }

  viewMatrix(): Mat4 { return lookAt(this.eye, this.target, [0, 0, 1], this.view); }
  projMatrix(aspect: number): Mat4 { return perspective(this.fov, aspect, this.near, this.far, this.proj); }
  viewProj(aspect: number): Mat4 { return multiply(this.projMatrix(aspect), this.viewMatrix(), this.vp); }
}
