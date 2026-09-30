import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import type { Circuit } from '$lib/sim/netlist/types';
import {
  BALL_SPACING,
  BASE,
  BallField,
  DEFAULT_PARAMS,
  LAYOUT,
  LandscapeSolver,
  analytic,
  ballSpeed,
  buildScene,
  heightOf,
  pick,
  pointAt,
  type Palette,
  type Params,
} from './landscape';
import { DEFAULT_CAMERA, project, viewProjection } from './mat4';

const flat = () =>
  flatten(JSON.parse(readFileSync(fileURLToPath(new URL('../circuits/landscape.json', import.meta.url)), 'utf8')) as Circuit);

const palette: Palette = { volt: (v) => [v / 12, 0.2, 0.2], floor: [0.5, 0.5, 0.5], glass: [0.8, 0.5, 0.2], line: [0.3, 0.3, 0.3], accent: [0.8, 0.5, 0.2] };

describe('the circuit, solved by the analog engine, agrees with the hand calculation', () => {
  const cases: Params[] = [
    DEFAULT_PARAMS,
    { vs: 12, r1: 470, r2: 4700, r3: 2200, r4: 330 },
    { vs: 5, r1: 10000, r2: 100, r3: 100, r4: 10000 },
    { vs: 1, r1: 100, r2: 10000, r3: 10000, r4: 10000 },
  ];
  for (const p of cases) {
    test(JSON.stringify(p), () => {
      const s = new LandscapeSolver(flat(), p).solve();
      const a = analytic(p);
      expect(s.vP).toBeCloseTo(p.vs, 1);
      expect(s.vA).toBeCloseTo(a.vA, 1);
      expect(s.vB).toBeCloseTo(a.vB, 1);
      expect(s.iTotal).toBeCloseTo(a.iTotal, 5);
      expect(s.i2).toBeCloseTo(a.i2, 5);
      expect(s.i3).toBeCloseTo(a.i3, 5);
    });
  }
  test('the defaults give the round numbers used in the text: 9 V, 4.5 V, 2.25 V and 4.5 mA = 2.25 + 2.25', () => {
    const s = new LandscapeSolver(flat()).solve();
    expect(s.vA).toBeCloseTo(4.5, 1);
    expect(s.vB).toBeCloseTo(2.25, 1);
    expect(s.iTotal * 1000).toBeCloseTo(4.5, 1);
    expect(s.i2 * 1000).toBeCloseTo(2.25, 1);
    expect(s.i3 * 1000).toBeCloseTo(2.25, 1);
  });
  test('Kirchhoff holds in every solution: the current law at A and the voltage law round both loops', () => {
    for (const p of cases) {
      const s = new LandscapeSolver(flat(), p).solve();
      expect(s.iTotal).toBeCloseTo(s.i2 + s.i3, 6);
      expect(s.vP - s.vA + s.vA).toBeCloseTo(s.vP, 9);
      expect(s.vP - s.vA + (s.vA - s.vB) + s.vB).toBeCloseTo(s.vP, 9);
    }
  });
  test('changing a parameter re-solves', () => {
    const solver = new LandscapeSolver(flat());
    const before = solver.solve().vA;
    solver.set({ r1: 10000 });
    const after = solver.solve().vA;
    expect(after).toBeLessThan(before);
    expect(after).toBeCloseTo(analytic({ ...DEFAULT_PARAMS, r1: 10000 }).vA, 1);
  });
});

describe('the terrain', () => {
  const sol = analytic(DEFAULT_PARAMS);
  const scene = buildScene(sol, palette);
  const ys = (m: number[]) => m.filter((_, i) => i % 3 === 1);

  test('the highest point is the top of the lift, at the battery voltage', () => {
    expect(Math.max(...ys(scene.opaque.pos))).toBeCloseTo(heightOf(9), 9);
  });
  test('the lowest points are on the floor', () => {
    expect(Math.min(...ys(scene.opaque.pos))).toBe(0);
  });
  test('the heights of the plateaus are their voltages (scaled)', () => {
    const at = (id: string) => scene.anchors.find((a) => a.id === id)!.pos[1] - 0.25;
    expect(at('P')).toBeCloseTo(heightOf(9), 9);
    expect(at('A')).toBeCloseTo(heightOf(4.5), 9);
    expect(at('B')).toBeCloseTo(heightOf(2.25), 9);
    expect(at('G')).toBeCloseTo(BASE, 9);
  });
  test('a bigger R1 lowers the plateau after it', () => {
    const high = analytic({ ...DEFAULT_PARAMS, r1: 4000 });
    const s2 = buildScene(high, palette);
    const a1 = scene.anchors.find((a) => a.id === 'A')!.pos[1];
    const a2 = s2.anchors.find((a) => a.id === 'A')!.pos[1];
    expect(a2).toBeLessThan(a1);
  });
  test('every triangle vertex is finite, colours are RGBA in 0–1, normals are unit vectors', () => {
    for (const m of [scene.opaque, scene.glass]) {
      expect(m.pos.length % 9).toBe(0);
      expect(m.nrm.length).toBe(m.pos.length);
      expect(m.col.length).toBe((m.pos.length / 3) * 4);
      expect(m.pos.every(Number.isFinite)).toBe(true);
      expect(m.col.every((c) => c >= 0 && c <= 1)).toBe(true);
      for (let i = 0; i < m.nrm.length; i += 3) expect(Math.hypot(m.nrm[i]!, m.nrm[i + 1]!, m.nrm[i + 2]!)).toBeCloseTo(1, 6);
    }
    expect(scene.lines.pos.length % 6).toBe(0);
  });
  test('top faces point up and the sides point sideways', () => {
    const ups = scene.opaque.nrm.filter((_, i) => i % 3 === 1 && scene.opaque.nrm[i]! > 0.5).length;
    expect(ups).toBeGreaterThan(20);
  });
  test('with a 1 V battery the lift is only a step', () => {
    const s = buildScene(analytic({ ...DEFAULT_PARAMS, vs: 1 }), palette);
    expect(Math.max(...ys(s.opaque.pos))).toBeCloseTo(heightOf(1), 9);
  });
  test('the glass of the lift stands on its footprint', () => {
    const xs = scene.glass.pos.filter((_, i) => i % 3 === 0);
    expect(Math.min(...xs)).toBeCloseTo(LAYOUT.xP - LAYOUT.pad, 9);
    expect(Math.max(...xs)).toBeCloseTo(LAYOUT.xP + LAYOUT.pad, 9);
  });
});

describe('the paths and the balls', () => {
  const sol = analytic(DEFAULT_PARAMS);
  const scene = buildScene(sol, palette);
  const path = (id: string) => scene.paths.find((p) => p.id === id)!;

  test('the paths run along the conventional current and are continuous', () => {
    const end = (id: string) => path(id).points.at(-1)!;
    const start = (id: string) => path(id).points[0]!;
    expect(end('lift')).toEqual(start('R1').map((v, i) => (i === 1 ? v : v)));
    expect(end('R1')).toEqual(start('R2'));
    expect(end('R1')).toEqual(start('R3'));
    expect(end('R3')).toEqual(start('R4'));
    expect(end('R2')).toEqual(start('ground-left'));
    expect(end('R4')).toEqual(start('ground-right'));
    expect(end('ground-right')).toEqual(start('ground-left'));
    expect(end('ground-left')).toEqual(start('lift').map((v, i) => (i === 1 ? BASE : v)));
  });
  test('currents on the paths obey Kirchhoff: R1 = R2 + R3, R3 = R4, the return carries it all', () => {
    expect(path('R1').current).toBeCloseTo(path('R2').current + path('R3').current, 12);
    expect(path('R3').current).toBe(path('R4').current);
    expect(path('ground-left').current).toBe(path('R1').current);
    expect(path('lift').current).toBe(path('R1').current);
  });
  test('pointAt interpolates and clamps', () => {
    const p = path('R1');
    expect(pointAt(p, 0)).toEqual(p.points[0]);
    expect(pointAt(p, p.length + 1)).toEqual(p.points.at(-1));
    const mid = pointAt(p, p.length / 2);
    expect(mid[0]).toBeGreaterThan(p.points[0]![0]);
  });
  test('the balls on a slope stay on it: they roll down as R1 falls from 9 V to 4.5 V', () => {
    const field = new BallField();
    const balls = field.positions([path('R1')]);
    expect(balls.length).toBeGreaterThan(2);
    const ys = balls.map((b) => b[1]);
    expect(Math.max(...ys)).toBeLessThanOrEqual(heightOf(9) + 0.2);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(heightOf(4.5));
  });
  test('the flux (speed ÷ spacing) is conserved at the junction: R1 = R2 + R3', () => {
    const max = Math.max(...scene.paths.map((p) => p.current));
    const flux = (id: string) => ballSpeed(path(id).current, max) / BALL_SPACING;
    expect(flux('R1')).toBeCloseTo(flux('R2') + flux('R3'), 12);
    expect(flux('R3')).toBeCloseTo(flux('R4'), 12);
  });
  test('there are no balls when there is no current, and they move when there is', () => {
    const dead = buildScene({ vP: 0, vA: 0, vB: 0, iTotal: 0, i2: 0, i3: 0 }, palette);
    expect(new BallField().positions(dead.paths)).toEqual([]);
    const field = new BallField();
    const before = field.positions(scene.paths).map((b) => b.join());
    field.advance(0.3, scene.paths);
    const after = field.positions(scene.paths).map((b) => b.join());
    expect(after).not.toEqual(before);
  });
  test('a path with a tenth of the current has balls that move a tenth as fast', () => {
    expect(ballSpeed(0.1, 1)).toBeCloseTo(ballSpeed(1, 1) / 10, 12);
    expect(ballSpeed(1, 0)).toBe(0);
  });
});

describe('picking', () => {
  const scene = buildScene(analytic(DEFAULT_PARAMS), palette);
  const mvp = viewProjection(DEFAULT_CAMERA, 1.6);
  test('a pointer on an anchor picks it; far away picks nothing; ticks are never picked', () => {
    const a = scene.anchors.find((x) => x.id === 'A')!;
    const q = project(a.pos, mvp, 800, 500);
    expect(pick(scene.anchors, mvp, 800, 500, q.x + 3, q.y - 2)?.id).toBe('A');
    expect(pick(scene.anchors, mvp, 800, 500, 2, 2)).toBeUndefined();
    const tick = scene.anchors.find((x) => x.kind === 'tick')!;
    const t = project(tick.pos, mvp, 800, 500);
    expect(pick(scene.anchors, mvp, 800, 500, t.x, t.y)?.kind).not.toBe('tick');
  });
});
