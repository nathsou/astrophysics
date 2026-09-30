import { describe, expect, test } from 'vitest';
import { polarMesh, project, shade } from './view3d.ts';

describe('orthographic projection', () => {
  test('side view: height is screen y, depth is minus the distance along the view axis', () => {
    const p = project({ x: 1, y: 2, z: 3 }, 0, 0);
    expect(p.X).toBeCloseTo(1, 12);
    expect(p.Y).toBeCloseTo(3, 12);
    expect(p.depth).toBeCloseTo(-2, 12);
  });
  test('top view: screen y is world y, depth is height', () => {
    const p = project({ x: 1, y: 2, z: 3 }, 0, Math.PI / 2);
    expect(p.X).toBeCloseTo(1, 12);
    expect(p.Y).toBeCloseTo(2, 12);
    expect(p.depth).toBeCloseTo(3, 12);
  });
  test('rotation about the vertical axis preserves lengths in the plane and heights', () => {
    const a = project({ x: 1, y: 0, z: 0.5 }, 0.7, 0.4);
    const b = project({ x: 0, y: 1, z: 0.5 }, 0.7 + Math.PI / 2 * 0, 0.4);
    expect(Math.hypot(a.X, a.depth * 0 + (a.Y - 0.5 * Math.cos(0.4)) / Math.sin(0.4))).toBeCloseTo(1, 12);
    expect(b.X ** 2 + ((b.Y - 0.5 * Math.cos(0.4)) / Math.sin(0.4)) ** 2).toBeCloseTo(1, 12);
  });
  test('points nearer the camera have larger depth (low elevation: the side facing the camera)', () => {
    const near = project({ x: 0, y: -1, z: 0 }, 0, 0.3);
    const far = project({ x: 0, y: 1, z: 0 }, 0, 0.3);
    expect(near.depth).toBeGreaterThan(far.depth);
    // far points appear higher on the screen when looking down
    expect(far.Y).toBeGreaterThan(near.Y);
  });
});

describe('polar mesh', () => {
  test('counts, radii and normals of a paraboloid', () => {
    const q = polarMesh((r) => r * r, 1, 10, 24);
    expect(q.length).toBe(240);
    for (const c of q) {
      expect(Math.hypot(c.normal.x, c.normal.y, c.normal.z)).toBeCloseTo(1, 12);
      expect(c.normal.z).toBeGreaterThan(0);
      for (const p of c.pts) expect(p.z).toBeCloseTo(Math.hypot(p.x, p.y) ** 2, 12);
    }
    // a flat cell faces straight up and is fully lit from above
    const flat = polarMesh(() => 0, 1, 2, 8)[5]!;
    expect(shade(flat.normal, { x: 0, y: 0, z: 1 })).toBeCloseTo(1, 12);
  });
});
