import { describe, expect, it } from 'vitest';
import { getVFpga } from '../../pld/devices/vfpga';
import { congestionMap, overusedAt, placeFrame, placeSeries, positionOfStep, routeSeries } from './replay';
import { flowOf } from './fixture.test-util';

describe('replay', () => {
  const { result, device } = flowOf('alu', 'Alu', 'M');
  const pl = result.place;

  it('starts at the random placement and ends at the final one', () => {
    const first = placeFrame(pl, 0);
    const last = placeFrame(pl, 1);
    expect(Array.from(last.x)).toEqual(Array.from(pl.unitX));
    expect(Array.from(last.y)).toEqual(Array.from(pl.unitY));
    expect(first.bb).toBeGreaterThan(last.bb);
    expect(first.from).toBe(0);
    expect(last.blend).toBe(0);
  });

  it('interpolates between snapshots and stays between them', () => {
    const n = pl.snapshots.length;
    expect(n).toBeGreaterThan(3);
    const t = 1.5 / (n - 1);
    const f = placeFrame(pl, t);
    expect(f.from).toBe(1);
    expect(f.to).toBe(2);
    expect(f.blend).toBeCloseTo(0.5);
    const A = pl.snapshots[1]!;
    const B = pl.snapshots[2]!;
    for (let u = 0; u < f.x.length; u++) {
      const lo = Math.min(A.x[u]!, B.x[u]!);
      const hi = Math.max(A.x[u]!, B.x[u]!);
      expect(f.x[u]!).toBeGreaterThanOrEqual(lo - 1e-4);
      expect(f.x[u]!).toBeLessThanOrEqual(hi + 1e-4);
    }
    // At the middle of a pair with an eased blend, a moved unit is exactly halfway.
    const moved = Array.from(A.x).findIndex((x, u) => x !== B.x[u]);
    if (moved >= 0) expect(f.x[moved]!).toBeCloseTo((A.x[moved]! + B.x[moved]!) / 2, 3);
  });

  it('clamps the replay position and is continuous', () => {
    expect(placeFrame(pl, -3).from).toBe(0);
    expect(placeFrame(pl, 9).to).toBe(pl.snapshots.length - 1);
    const a = placeFrame(pl, 0.4);
    const b = placeFrame(pl, 0.4001);
    let d = 0;
    for (let u = 0; u < a.x.length; u++) d = Math.max(d, Math.abs(a.x[u]! - b.x[u]!));
    expect(d).toBeLessThan(0.5);
  });

  it('follows the annealing schedule: the step follows the position and the temperature falls', () => {
    const s = placeSeries(pl);
    expect(s.temperature.values.length).toBe(pl.steps.length);
    expect(s.temperature.values[0]!).toBeGreaterThan(s.temperature.values.at(-1)!);
    expect(placeFrame(pl, 0).stepIndex).toBe(0);
    expect(placeFrame(pl, 1).stepIndex).toBe(pl.steps.length - 1);
    const mid = placeFrame(pl, 0.5);
    expect(mid.step?.temp).toBe(pl.steps[mid.stepIndex]!.temp);
    // The position of a step is monotone in the step.
    let prev = -1;
    for (let i = 0; i < pl.steps.length; i += 9) {
      const p = positionOfStep(pl, i);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    expect(positionOfStep(pl, 0)).toBe(0);
    expect(positionOfStep(pl, 1e9)).toBe(1);
  });

  it('plots the router’s overuse per iteration, ending at zero', () => {
    const r = routeSeries(result.route);
    expect(r.values.length).toBe(result.route.iterations.length);
    expect(r.values.at(-1)).toBe(0);
    expect(r.values[0]!).toBeGreaterThan(0);
  });

  it('shows the overused nodes of an iteration as a congestion map, clear at the end', () => {
    const first = overusedAt(result.route, 0);
    expect(first.length).toBeGreaterThan(0);
    const map = congestionMap(first, device);
    expect(map.max).toBeGreaterThan(0);
    let total = 0;
    for (const v of map.tiles.values()) total += v;
    expect(total).toBe(first.length);
    expect(overusedAt(result.route, result.route.iterations.length - 1)).toEqual([]);
    // An iteration between records shows the latest earlier record.
    const it = result.route.iterations.find((i) => !result.route.overusedNodes.some((o) => o.iter === i.iter) && i.iter > 3 && i.overused > 0);
    if (it) expect(overusedAt(result.route, result.route.iterations.indexOf(it)).length).toBeGreaterThan(0);
    expect(getVFpga('M')).toBe(device);
  });
});
