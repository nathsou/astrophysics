import { describe, expect, it } from 'vitest';
import { Camera, signedRho, View2D } from './camera.ts';

const out = () => new Float64Array(3);

describe('Camera', () => {
  it('projects its target to the centre of the screen', () => {
    const c = new Camera({ width: 800, height: 600, distance: 5000 });
    c.target = [100, -200, 300];
    c.update();
    const o = out();
    expect(c.project(100, -200, 300, o)).toBe(true);
    expect(o[0]).toBeCloseTo(400, 3);
    expect(o[1]).toBeCloseTo(300, 3);
    expect(o[2]).toBeCloseTo(5000, 3);
  });
  it('the camera frame is orthonormal and looks at the target', () => {
    const c = new Camera({ azimuth: 0.7, elevation: 0.4, distance: 1000 });
    c.update();
    const d = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    expect(d(c.right, c.right)).toBeCloseTo(1, 12);
    expect(d(c.up, c.up)).toBeCloseTo(1, 12);
    expect(d(c.forward, c.forward)).toBeCloseTo(1, 12);
    expect(d(c.right, c.up)).toBeCloseTo(0, 12);
    expect(d(c.right, c.forward)).toBeCloseTo(0, 12);
    expect(d(c.up, c.forward)).toBeCloseTo(0, 12);
    // forward points from the eye to the target
    const to = [-c.eye[0], -c.eye[1], -c.eye[2]];
    const l = Math.hypot(to[0]!, to[1]!, to[2]!);
    expect(d(c.forward, [to[0]! / l, to[1]! / l, to[2]! / l])).toBeCloseTo(1, 12);
  });
  it('a point to the right of the target appears on the right, a point above appears higher (smaller y)', () => {
    const c = new Camera({ width: 800, height: 600, distance: 5000, azimuth: 0.4, elevation: 0.2 });
    c.update();
    const o = out();
    const r = c.right, u = c.up;
    c.project(r[0]! * 100, r[1]! * 100, r[2]! * 100, o);
    expect(o[0]).toBeGreaterThan(400);
    c.project(u[0]! * 100, u[1]! * 100, u[2]! * 100, o);
    expect(o[1]).toBeLessThan(300);
  });
  it('perspective: a point twice as far appears about half as far from the centre', () => {
    const c = new Camera({ width: 800, height: 600, distance: 1000, azimuth: 0, elevation: 0 });
    c.update();
    const o = out();
    // camera on +z axis looking at the origin: world x is screen right
    c.project(50, 0, 0, o);
    const near = o[0]! - 400;
    c.project(50, 0, -1000, o); // 1000 further from the camera
    const far = o[0]! - 400;
    expect(far / near).toBeCloseTo(0.5, 4);
  });
  it('the vertical field of view maps to the screen height', () => {
    const c = new Camera({ width: 800, height: 600, distance: 1000, azimuth: 0, elevation: 0, fov: Math.PI / 2 });
    c.update();
    const o = out();
    c.project(0, 1000, 0, o); // tan(45°) × distance above the target: top edge
    expect(o[1]).toBeCloseTo(0, 3);
  });
  it('reports points behind the camera', () => {
    const c = new Camera({ width: 800, height: 600, distance: 1000, azimuth: 0, elevation: 0 });
    c.update();
    const o = out();
    expect(c.project(0, 0, 2000, o)).toBe(false);
  });
  it('orbit wraps the azimuth and limits the elevation', () => {
    const c = new Camera();
    c.azimuth = 6.2;
    c.orbit(0.2, 10);
    expect(c.azimuth).toBeGreaterThanOrEqual(0);
    expect(c.azimuth).toBeLessThan(0.2);
    expect(c.elevation).toBeLessThan(Math.PI / 2);
    c.orbit(0, -100);
    expect(c.elevation).toBeGreaterThan(-Math.PI / 2);
  });
  it('orbiting preserves the distance and keeps the target at the centre', () => {
    const c = new Camera({ width: 640, height: 480, distance: 3000 });
    c.orbit(1.3, -0.2);
    c.update();
    expect(Math.hypot(c.eye[0] - c.target[0], c.eye[1] - c.target[1], c.eye[2] - c.target[2])).toBeCloseTo(3000, 6);
    const o = out();
    c.project(0, 0, 0, o);
    expect(o[0]).toBeCloseTo(320, 3);
    expect(o[1]).toBeCloseTo(240, 3);
  });
  it('zoom multiplies the distance within limits', () => {
    const c = new Camera({ distance: 1000 });
    c.zoom(2);
    expect(c.distance).toBe(2000);
    c.zoom(1e-9, 300, 5000);
    expect(c.distance).toBe(300);
    c.zoom(1e9, 300, 5000);
    expect(c.distance).toBe(5000);
  });
  it('pan moves the target along the screen axes', () => {
    const c = new Camera({ width: 800, height: 600, distance: 5000 });
    c.update();
    const o = out();
    c.project(0, 0, 0, o);
    const x0 = o[0]!;
    c.pan(50, 0); // drag right by 50 px: the scene follows the pointer
    c.update();
    c.project(0, 0, 0, o);
    expect(o[0]! - x0).toBeCloseTo(50, 2);
  });
  it('orthographic projection has no perspective shrinking', () => {
    const c = new Camera({ width: 800, height: 600, distance: 1000, azimuth: 0, elevation: 0, ortho: true });
    c.near = -5000;
    c.far = 5000;
    c.update();
    const o = out();
    c.project(50, 0, 0, o);
    const a = o[0]!;
    c.project(50, 0, -1000, o);
    expect(o[0]).toBeCloseTo(a, 4);
  });
  it('the view-projection matrix agrees with project()', () => {
    const c = new Camera({ width: 800, height: 600, distance: 4000, azimuth: 1.1, elevation: 0.3 });
    c.update();
    const m = c.viewProj;
    const p = [120, -340, 560];
    const cx = m[0]! * p[0]! + m[4]! * p[1]! + m[8]! * p[2]! + m[12]!;
    const cy = m[1]! * p[0]! + m[5]! * p[1]! + m[9]! * p[2]! + m[13]!;
    const cw = m[3]! * p[0]! + m[7]! * p[1]! + m[11]! * p[2]! + m[15]!;
    const o = out();
    c.project(p[0]!, p[1]!, p[2]!, o);
    expect(o[0]).toBeCloseTo((cx / cw * 0.5 + 0.5) * 800, 3);
    expect(o[1]).toBeCloseTo((0.5 - cy / cw * 0.5) * 600, 3);
  });
});

describe('View2D', () => {
  it('maps world to screen and back', () => {
    const v = new View2D();
    v.resize(400, 300);
    v.cx = 10;
    v.cy = -5;
    v.scale = 0.5;
    for (const [u, w] of [[0, 0], [100, 50], [-30, 70]] as const) {
      expect(v.toWorldU(v.toScreenX(u))).toBeCloseTo(u, 9);
      expect(v.toWorldV(v.toScreenY(w))).toBeCloseTo(w, 9);
    }
    expect(v.toScreenX(10)).toBe(200);
    expect(v.toScreenY(-5)).toBe(150);
    // v points up on screen
    expect(v.toScreenY(6)).toBeLessThan(v.toScreenY(5));
  });
  it('fits a box with a margin', () => {
    const v = new View2D();
    v.resize(400, 200);
    v.fit(-100, 100, -50, 50, 10);
    expect(v.toScreenX(-100)).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(v.toScreenX(100)).toBeLessThanOrEqual(390 + 1e-9);
    expect(v.toScreenY(50)).toBeGreaterThanOrEqual(10 - 1e-9);
    expect(v.toScreenY(-50)).toBeLessThanOrEqual(190 + 1e-9);
  });
  it('zooms about a fixed point', () => {
    const v = new View2D();
    v.resize(400, 300);
    v.scale = 1;
    const u = v.toWorldU(123), w = v.toWorldV(77);
    v.zoomAt(123, 77, 2.5);
    expect(v.scale).toBeCloseTo(2.5, 9);
    expect(v.toScreenX(u)).toBeCloseTo(123, 9);
    expect(v.toScreenY(w)).toBeCloseTo(77, 9);
  });
  it('panning moves the content with the pointer', () => {
    const v = new View2D();
    v.resize(400, 300);
    const x = v.toScreenX(5);
    const y = v.toScreenY(5);
    v.pan(20, -10);
    expect(v.toScreenX(5)).toBeCloseTo(x + 20, 9);
    expect(v.toScreenY(5)).toBeCloseTo(y - 10, 9);
  });
  it('signedRho takes the sign of y', () => {
    expect(signedRho(3, 4)).toBe(5);
    expect(signedRho(3, -4)).toBe(-5);
  });
});
