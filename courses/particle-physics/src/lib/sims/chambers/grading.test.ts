import { describe, expect, it } from 'vitest';
import { makePicture, andersonPicture } from '$lib/hep/chamber';
import { compareMeasurement, coordinateTable, gradeAnswers, radiusMm, truePT, truthFor, visiblePathLength } from './grading';
import { makeMeasurement } from './tools';

describe('truth values', () => {
  const pic = makePicture('cloud:alpha,mu-,e+', 3, { bField: 1 });
  it('momentum, radius and length follow from the simulated track', () => {
    const e = truthFor('momentum', { track: 'C' }, pic)!;
    expect(e.value).toBeGreaterThan(0.005);
    expect(e.value).toBeLessThan(0.05);
    const R = truthFor('radius', { track: 'C' }, pic)!;
    expect(R.value).toBeCloseTo(radiusMm(e.value, 1), 6);
    expect(truthFor('length', { track: 'A' }, pic)!.value).toBeGreaterThan(30);
    expect(truthFor('charge', { track: 'C' }, pic)!.value).toBe(1);
    expect(truthFor('charge', { track: 'B' }, pic)!.value).toBe(-1);
  });
  it('an author-fixed value wins', () => {
    expect(truthFor('momentum', { track: 'C', value: 0.123 }, pic)!.value).toBe(0.123);
  });
});

describe('grading', () => {
  const pic = makePicture('cloud:alpha,mu-,e+', 3, { bField: 1 });
  const p = truePT(pic.set.tracks[2]!);
  it('accepts within tolerance and rejects outside', () => {
    const ok = gradeAnswers({ momentum: { track: 'C', tolerance: 0.1 } }, pic, { momentum: p * 1.05 });
    expect(ok[0]!.ok).toBe(true);
    const bad = gradeAnswers({ momentum: { track: 'C', tolerance: 0.1 } }, pic, { momentum: p * 1.3 });
    expect(bad[0]!.ok).toBe(false);
    expect(bad[0]!.message).toContain('Too large');
  });
  it('charge must have the right sign; a missing number is not ok', () => {
    expect(gradeAnswers({ charge: { track: 'C' } }, pic, { charge: 1 })[0]!.ok).toBe(true);
    expect(gradeAnswers({ charge: { track: 'C' } }, pic, { charge: -1 })[0]!.ok).toBe(false);
    expect(gradeAnswers({ momentum: { track: 'C' } }, pic, {})[0]!.ok).toBe(false);
  });
  it('absolute tolerance', () => {
    const L = visiblePathLength(pic.set.tracks[0]!);
    expect(gradeAnswers({ length: { track: 'A', toleranceAbs: 2 } }, pic, { length: L + 1.5 })[0]!.ok).toBe(true);
    expect(gradeAnswers({ length: { track: 'A', toleranceAbs: 2 } }, pic, { length: L + 2.5 })[0]!.ok).toBe(false);
  });
});

describe('free measurements compared with the truth', () => {
  it('a three-point circle on a simulated track is within 10 % of the true radius', () => {
    const pic = makePicture('cloud:e+', 5, { bField: 1 });
    const t = pic.set.tracks[0]!;
    const v = t.points.filter((q) => q.visible);
    const pts = [0.15, 0.5, 0.85].map((f) => v[Math.floor(f * (v.length - 1))]!);
    const m = makeMeasurement('circle', pts.map((q) => ({ x: q.x, y: q.y })), 1, 1)!;
    const c = compareMeasurement(m, pic)!;
    expect(c.ok).toBe(true);
  });
  it('the Anderson positron: radii above and below the plate differ as the momenta do', () => {
    const pic = andersonPicture(1);
    const v = pic.set.primary.points.filter((q) => q.visible && q.layer === 0);
    const below = v.filter((q) => q.y < 0);
    const above = v.filter((q) => q.y > 3);
    const pick = (a: typeof v) => [0.1, 0.5, 0.9].map((f) => a[Math.floor(f * (a.length - 1))]!);
    const r = (a: typeof v) => makeMeasurement('circle', pick(a).map((q) => ({ x: q.x, y: q.y })), 1.5, 1)!.value;
    expect(r(below) / r(above)).toBeGreaterThan(2);
    expect(r(below) / r(above)).toBeLessThan(3.5);
  });
});

describe('coordinate table', () => {
  it('lists points along a track at even spacing', () => {
    const pic = makePicture('cloud:mu-', 2, { bField: 1 });
    const rows = coordinateTable(pic.set.tracks[0]!, 20, () => [0, 0]);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows[1]!.s - rows[0]!.s).toBeGreaterThanOrEqual(19.9);
  });
});
