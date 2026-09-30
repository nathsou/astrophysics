import { describe, expect, it } from 'vitest';
import { betterOf, distToSegment, inConvexPolygon, pickDiscs, pickPolylines } from './pick.ts';
import { ScenePicker } from './scenePick.ts';
import { planeProjector } from './draw2d.ts';
import { View2D } from './camera.ts';
import { buildScene } from './scene.ts';
import { defaultGeometry } from './geometry.ts';
import { sampleEvent } from './sampleEvents.ts';

describe('distToSegment', () => {
  it('measures to the nearest point of the segment', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBe(5); // beyond the start
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBe(5); // beyond the end
    expect(distToSegment(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2, 12); // a degenerate segment
  });
});

describe('pickPolylines', () => {
  // two lines: y = 0 from x=0..100 (id 7) and y = 50 (id 9), 3 points each
  const xy = [0, 0, 50, 0, 100, 0, 0, 50, 50, 50, 100, 50];
  const starts = [0, 3, 6];
  const ids = [7, 9];
  it('picks the nearest line within the radius', () => {
    expect(pickPolylines(xy, starts, ids, 2, 40, 4, 8)).toEqual({ id: 7, dist: 4 });
    expect(pickPolylines(xy, starts, ids, 2, 40, 47, 8)).toEqual({ id: 9, dist: 3 });
  });
  it('returns null when nothing is close enough', () => {
    expect(pickPolylines(xy, starts, ids, 2, 40, 25, 8)).toBeNull();
    expect(pickPolylines(xy, starts, ids, 2, 400, 0, 8)).toBeNull();
  });
  it('skips segments with NaN points (behind the camera)', () => {
    const bad = [NaN, NaN, 50, 0, 100, 0];
    expect(pickPolylines(bad, [0, 3], [1], 1, 25, 0, 8)).toBeNull();
    expect(pickPolylines(bad, [0, 3], [1], 1, 75, 2, 8)?.id).toBe(1);
  });
});

describe('pickDiscs and polygons', () => {
  it('a point inside a disc has distance 0; the smaller disc wins ties', () => {
    const xy = [50, 50, 50, 50];
    const r = pickDiscs(xy, [20, 5], [1, 2], 2, 52, 50, 10);
    expect(r).toEqual({ id: 2, dist: 0 });
    expect(pickDiscs(xy, [20, 5], [1, 2], 2, 50 + 25, 50, 10)).toEqual({ id: 1, dist: 5 });
    expect(pickDiscs(xy, [20, 5], [1, 2], 2, 200, 200, 10)).toBeNull();
  });
  it('point in convex polygon, either winding', () => {
    const sq = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(inConvexPolygon(5, 5, sq)).toBe(true);
    expect(inConvexPolygon(11, 5, sq)).toBe(false);
    expect(inConvexPolygon(5, 5, [0, 10, 10, 10, 10, 0, 0, 0])).toBe(true);
    expect(inConvexPolygon(-1, 5, [0, 10, 10, 10, 10, 0, 0, 0])).toBe(false);
  });
  it('a line within a few pixels beats an area', () => {
    expect(betterOf({ id: 1, dist: 4 }, { id: 2, dist: 0 })?.id).toBe(1);
    expect(betterOf({ id: 1, dist: 9 }, { id: 2, dist: 0 })?.id).toBe(2);
    expect(betterOf(null, { id: 2, dist: 3 })?.id).toBe(2);
    expect(betterOf(null, null)).toBeNull();
  });
});

describe('ScenePicker on a sample event', () => {
  const scene = buildScene(sampleEvent('zmumu', { seed: 3 }), defaultGeometry);
  const view = new View2D();
  view.resize(600, 600);
  view.fit(-7500, 7500, -7500, 7500, 10);
  const proj = planeProjector('rphi', view);
  const flags = { showTruth: false, showReco: true, showHits: true, showCalo: true };
  const picker = new ScenePicker(scene);
  const out = new Float64Array(3);

  it('picks a reconstructed muon when the pointer is on its track', () => {
    const mu = scene.objects.find((o) => o.cat === 'object' && o.kind === 'muon')!;
    const line = scene.polylines.find((p) => p.pick === mu.id)!;
    const n = line.points.length / 3;
    const k = Math.floor(n * 0.9);
    proj(line.points[3 * k]!, line.points[3 * k + 1]!, line.points[3 * k + 2]!, 1, out);
    const r = picker.pick(proj, out[0]! + 1, out[1]! + 1, flags);
    expect(r?.id).toBe(mu.id);
  });
  it('picks nothing far from any object', () => {
    expect(picker.pick(proj, 2, 2, flags)).toBeNull();
  });
  it('a hidden layer is not picked', () => {
    const line = scene.polylines.find((p) => p.layer === 'truth');
    if (!line) return;
    proj(line.points[line.points.length - 3]!, line.points[line.points.length - 2]!, 0, 1, out);
    const r = picker.pick(proj, out[0]!, out[1]!, { ...flags, showReco: false, showHits: false, showCalo: false, showTruth: false });
    expect(r).toBeNull();
  });
});
