import { describe, expect, test } from 'vitest';
import { DEFAULT_CAMERA, cameraEye, identity, lookAt, multiply, perspective, project, viewProjection, type Camera } from './mat4';

describe('matrices', () => {
  test('multiplying by the identity changes nothing', () => {
    const p = perspective(0.7, 1.6, 0.1, 50);
    expect(Array.from(multiply(identity(), p))).toEqual(Array.from(p));
    expect(Array.from(multiply(p, identity()))).toEqual(Array.from(p));
  });
  test('lookAt puts the eye at the origin and the target on the −z axis', () => {
    const v = lookAt([0, 0, 5], [0, 0, 0]);
    const t = project([0, 0, 0], multiply(perspective(1, 1, 0.1, 50), v), 100, 100);
    expect(t.x).toBeCloseTo(50, 5);
    expect(t.y).toBeCloseTo(50, 5);
    expect(t.visible).toBe(true);
  });
});

describe('the orbiting camera', () => {
  const cam: Camera = { ...DEFAULT_CAMERA };
  test('the target is at the centre of the screen', () => {
    for (const ortho of [false, true]) {
      const p = project(cam.target, viewProjection({ ...cam, ortho }, 1.7), 800, 470);
      expect(p.x).toBeCloseTo(400, 3);
      expect(p.y).toBeCloseTo(235, 3);
      expect(p.visible).toBe(true);
    }
  });
  test('the eye is `distance` away from the target', () => {
    const e = cameraEye(cam);
    const d = Math.hypot(e[0] - cam.target[0], e[1] - cam.target[1], e[2] - cam.target[2]);
    expect(d).toBeCloseTo(cam.distance, 9);
    expect(e[1]).toBeGreaterThan(cam.target[1]);
  });
  test('higher points appear higher on the screen, and points to the right appear to the right', () => {
    const mvp = viewProjection({ ...cam, yaw: 0 }, 1.6);
    const base = project([0, 0, 0], mvp, 800, 500);
    expect(project([0, 2, 0], mvp, 800, 500).y).toBeLessThan(base.y);
    expect(project([2, 0, 0], mvp, 800, 500).x).toBeGreaterThan(base.x);
  });
  test('turning the camera by half a turn mirrors left and right', () => {
    const a = project([2, 0, 0], viewProjection({ ...cam, yaw: 0 }, 1), 100, 100).x;
    const b = project([2, 0, 0], viewProjection({ ...cam, yaw: Math.PI }, 1), 100, 100).x;
    expect(a - 50).toBeCloseTo(50 - b, 3);
  });
  test('nearer things are bigger in perspective and the same size in the orthographic view', () => {
    const persp = viewProjection({ ...cam, yaw: 0 }, 1);
    const ortho = viewProjection({ ...cam, yaw: 0, ortho: true }, 1);
    const size = (mvp: Float32Array, z: number) => project([1, 0, z], mvp, 100, 100).x - project([0, 0, z], mvp, 100, 100).x;
    expect(size(persp, 4)).toBeGreaterThan(size(persp, -4));
    expect(size(ortho, 4)).toBeCloseTo(size(ortho, -4), 6);
  });
  test('a point behind the camera is not visible', () => {
    const e = cameraEye(cam);
    const behind: [number, number, number] = [e[0] + (e[0] - cam.target[0]), e[1] + (e[1] - cam.target[1]), e[2] + (e[2] - cam.target[2])];
    expect(project(behind, viewProjection(cam, 1), 100, 100).visible).toBe(false);
  });
});
