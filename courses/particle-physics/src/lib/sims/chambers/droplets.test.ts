import { describe, expect, it } from 'vitest';
import { rng } from '$lib/hep/random';
import { ALPHA_PDG, MATERIALS, mipLoss, simulateTrack } from '$lib/hep/chamber';
import { DropletField, STRIDE, dropletsForTrack, fitView, pickTrack, screenToWorld, worldToScreen, zoomAt, FOREVER } from './droplets';

const mip = (mipLoss(MATERIALS.air, true) * MATERIALS.air.density) / 10;
const run = (pdg: number, o: object) => simulateTrack({ pdg, position: [0, 0, 0], direction: [1, 0, 0], bField: 0, medium: 'air+alcohol vapour', rng: rng(3), ...o } as never).primary;

describe('droplets along tracks', () => {
  it('heavily ionising tracks get many more droplets per mm than minimum-ionising ones', () => {
    const alpha = run(ALPHA_PDG, { T: 0.0053 });
    const muon = run(13, { p: 2, bounds: { xMax: 40 } });
    const da = dropletsForTrack(alpha, rng(1), { kind: 'cloud', birth: 0, life: 1, mip, id: 0 });
    const dm = dropletsForTrack(muon, rng(1), { kind: 'cloud', birth: 0, life: 1, mip, id: 1 });
    const perMmA = da.length / STRIDE / alpha.length;
    const perMmM = dm.length / STRIDE / muon.length;
    expect(perMmA / perMmM).toBeGreaterThan(4);
    expect(perMmM).toBeGreaterThan(0.8);
    expect(perMmM).toBeLessThan(2.5);
  });
  it('droplets lie close to the track and carry the track id', () => {
    const t = run(13, { p: 2, bounds: { xMax: 60 } });
    const d = dropletsForTrack(t, rng(2), { kind: 'cloud', birth: 0, life: 1, mip, id: 7 });
    for (let i = 0; i < d.length; i += STRIDE) {
      expect(Math.abs(d[i + 1]!)).toBeLessThan(2);
      expect(d[i + 6]).toBe(7);
    }
  });
  it('the buffer grows, prunes the faded and finds neighbours', () => {
    const f = new DropletField();
    const t = run(13, { p: 2, bounds: { xMax: 400 } });
    f.append(dropletsForTrack(t, rng(1), { kind: 'cloud', birth: 0, life: 1, mip, id: 1 }));
    f.append(dropletsForTrack(t, rng(2), { kind: 'cloud', birth: 10, life: FOREVER, mip, id: 2 }));
    const n = f.count;
    expect(n).toBeGreaterThan(500);
    expect(f.nearest(100, 0, 1)).not.toBeNull();
    const removed = f.prune(5, 0.5);
    expect(removed).toBeGreaterThan(0);
    expect(f.count).toBeLessThan(n);
    expect(f.of(2).length).toBe(f.count);
    f.removeTrack(2);
    expect(f.count).toBe(0);
  });
  it('no droplets in an opaque plate', () => {
    const t = run(13, { p: 2, direction: [0, 1, 0], position: [0, -30, 0], plates: [{ y0: -3, y1: 3 }], bounds: { yMax: 30 } });
    const d = dropletsForTrack(t, rng(1), { kind: 'cloud', birth: 0, life: 1, mip, id: 0 });
    for (let i = 0; i < d.length; i += STRIDE) expect(Math.abs(d[i + 1]!)).toBeGreaterThan(2.5);
  });
});

describe('view', () => {
  it('converts between screen and world', () => {
    const v = { cx: 10, cy: -5, scale: 3 };
    const [sx, sy] = worldToScreen(v, 800, 500, 40, 20);
    const [x, y] = screenToWorld(v, 800, 500, sx, sy);
    expect(x).toBeCloseTo(40, 9);
    expect(y).toBeCloseTo(20, 9);
  });
  it('zoom keeps the point under the cursor fixed', () => {
    const v = fitView(300, 190, 900, 570);
    const [wx, wy] = screenToWorld(v, 900, 570, 200, 100);
    const z = zoomAt(v, 2.5, 200, 100, 900, 570, 1, 100);
    const [wx2, wy2] = screenToWorld(z, 900, 570, 200, 100);
    expect(wx2).toBeCloseTo(wx, 9);
    expect(wy2).toBeCloseTo(wy, 9);
    expect(z.scale).toBeCloseTo(v.scale * 2.5, 9);
  });
});

describe('picking', () => {
  it('picks the nearest visible track and ignores neutrals', () => {
    const a = run(13, { p: 2, bounds: { xMax: 100 } });
    const b = run(13, { p: 2, position: [0, 20, 0], bounds: { xMax: 100 } });
    const hit = pickTrack([a, b], 50, 18, 5)!;
    expect(hit.track).toBe(b);
    expect(pickTrack([a, b], 50, 10, 3)).toBeNull();
  });
});
