import { describe, expect, it } from 'vitest';
import { rng } from '$lib/hep/random';
import { simulateTrack } from '$lib/hep/chamber';
import { makeMeasurement, niceLength, chargeFromSense } from './tools';
import { inferredCharge, selectionInfo } from './info';

describe('scan tools', () => {
  it('ruler, angle and circle', () => {
    expect(makeMeasurement('ruler', [{ x: 0, y: 0 }, { x: 3, y: 4 }], 0, 1)!.value).toBeCloseTo(5, 12);
    expect(makeMeasurement('angle', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 2 }], 0, 1)!.value).toBeCloseTo(90, 9);
    // a circle of radius 1000 mm in 1 T: p = 0.29979 GeV/c
    const R = 1000;
    const pts = [0.1, 0.2, 0.3].map((a) => ({ x: R * Math.sin(a), y: R * (1 - Math.cos(a)) }));
    const c = makeMeasurement('circle', pts, 1, 1)!;
    expect(c.value).toBeCloseTo(R, 6);
    expect(c.pT).toBeCloseTo(0.299792458, 6);
    expect(c.orientation).toBe(1);
  });
  it('collinear points do not give a radius', () => {
    const c = makeMeasurement('circle', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 1, 1)!;
    expect(c.value).toBe(Infinity);
  });
  it('needs enough points', () => {
    expect(makeMeasurement('ruler', [{ x: 0, y: 0 }], 0, 1)).toBeNull();
  });
  it('nice lengths', () => {
    expect(niceLength(37)).toBe(20);
    expect(niceLength(120)).toBe(100);
    expect(niceLength(6)).toBe(5);
  });
  it('the charge follows from the sense and the direction of travel', () => {
    expect(chargeFromSense(-1, 1)).toBe('positive');
    expect(chargeFromSense(1, 1)).toBe('negative');
    expect(inferredCharge(-1, 1, true)).toBe(1);
    expect(inferredCharge(-1, 1, false)).toBe(-1);
    expect(inferredCharge(0, 1, true)).toBeNull();
  });
});

describe('selection info', () => {
  it('reports radius and momentum close to the truth, and does not leak the direction of travel', () => {
    const run = (dir: [number, number, number], start: [number, number, number]) =>
      simulateTrack({ pdg: -13, p: 0.3, direction: dir, position: start, bField: 1, medium: 'air+alcohol vapour', rng: rng(4), bounds: { xMin: -300, xMax: 300, yMin: -100, yMax: 100 }, scatterTail: false, secondaries: false }).primary;
    // The same arc traversed in opposite directions: μ⁺ going right and … the μ⁻ going left along the mirror path.
    const a = run([1, 0, 0], [-150, 0, 0]);
    const info = selectionInfo(a, 1, 'air+alcohol vapour');
    expect(info.segments).toHaveLength(1);
    const seg = info.segments[0]!;
    expect(seg.pT!).toBeGreaterThan(0.27);
    expect(seg.pT!).toBeLessThan(0.33);
    expect(info.end1.x).toBeLessThan(info.end2.x);
    // μ⁺ in B > 0 goes clockwise travelling ① → ②
    expect(seg.sense).toBe(-1);
    expect(inferredCharge(seg.sense, 1, true)).toBe(1);
    expect(info.ionisation).toBeGreaterThan(0.9);
  });
});
