import { describe, expect, test } from 'vitest';
import { REFERENCE, aggregate, runEvent, runPoint } from './pileup.ts';

describe('tracking under pile-up', () => {
  test('without pile-up the reference finds every signal pion and no fakes', () => {
    const p = runPoint(0, 6, REFERENCE);
    expect(p.efficiency.value).toBeGreaterThan(0.95);
    expect(p.fakeRate.k).toBe(0);
  });
  test('the number of seeds grows faster than the number of collisions, while the reference stays efficient', () => {
    const a = runPoint(25, 3, REFERENCE, undefined, 2);
    const b = runPoint(100, 3, REFERENCE, undefined, 2);
    expect(b.seedsPerEvent / a.seedsPerEvent).toBeGreaterThan(4 * 1.5);
    expect(b.efficiency.value).toBeGreaterThan(0.9);
    expect(b.tracksPerEvent / a.tracksPerEvent).toBeGreaterThan(3);
  });
  test('loosening the finder (3 hits, 8σ roads, χ²/ndof < 20) creates fakes that grow with pile-up', () => {
    const loose = { ...REFERENCE, minHits: 3, roadSigmas: 8, maxChi2: 20 };
    const a = runPoint(10, 4, loose, undefined, 3);
    const b = runPoint(140, 4, loose, undefined, 3);
    expect(b.fakeRate.value).toBeGreaterThan(0.3);
    expect(b.fakeRate.value).toBeGreaterThan(a.fakeRate.value);
  });
  test('requiring all eight layers costs efficiency when 3 % of the channels are dead', () => {
    const p = runPoint(25, 6, { ...REFERENCE, minHits: 8 }, { noise: 1, dead: 0.03 }, 4);
    expect(p.efficiency.value).toBeLessThan(0.8);
  });
  test('Hough seeding works on a quiet event and loses the tracks in a busy one', () => {
    const hough = { ...REFERENCE, seeding: 'hough' as const };
    const quiet = runPoint(0, 6, hough, undefined, 5);
    const busy = runPoint(25, 3, hough, undefined, 5);
    expect(quiet.efficiency.value).toBeGreaterThan(0.85);
    expect(busy.efficiency.value).toBeLessThan(quiet.efficiency.value);
  });
  test('an event is deterministic and can return a picture', () => {
    const a = runEvent(5, 11, REFERENCE, undefined, true);
    const b = runEvent(5, 11, REFERENCE, undefined, true);
    expect(a.nTracks).toBe(b.nTracks);
    expect(a.hits.length).toBe(a.nHits);
    expect(a.hits.some((h) => h.kind === 'signal')).toBe(true);
    expect(aggregate(5, [a]).events).toBe(1);
  });
});
