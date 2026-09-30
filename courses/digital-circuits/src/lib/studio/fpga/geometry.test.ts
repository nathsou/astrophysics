import { describe, expect, it } from 'vitest';
import { getVFpga, NK } from '../../pld/devices/vfpga';
import { LCS_PER_TILE } from '../../pld/devices/vfpga-arch';
import { TILE, cellAt, lutBitAt, lutBitRect, pinAt, cellRect, center, dieGeom, distToSegment, fitRect, neighbourTile, nodeAnchors, switchBoxRect, tileAt, tileRect, toScreen, toWorld, visibleRect, wireAt, wireSegment, zoomAt, zoomFor, zoomLevel } from './geometry';

describe('die geometry', () => {
  const dev = getVFpga('M');
  const g = dieGeom(dev);

  it('places tiles on a pitch and flips y', () => {
    const a = tileRect(g, 0, 0);
    const b = tileRect(g, 1, 0);
    const c = tileRect(g, 0, 1);
    expect(b.x - a.x).toBe(g.pitch);
    expect(a.y - c.y).toBe(g.pitch);
    expect(a.y).toBe((dev.height - 1) * g.pitch);
  });

  it('finds the tile under a point, and none in a channel or an empty corner', () => {
    const t = tileRect(g, 3, 4);
    expect(tileAt(g, t.x + 5, t.y + 5)).toEqual({ x: 3, y: 4 });
    expect(tileAt(g, t.x + TILE + g.ch / 2, t.y + 5)).toBeUndefined();
    expect(tileAt(g, 5, 5)).toBeUndefined(); // the top-left corner of the die is empty
    expect(tileAt(g, -10, 5)).toBeUndefined();
  });

  it('lays the eight cells out without overlap inside their tile', () => {
    const t = tileRect(g, 2, 2);
    const rs = Array.from({ length: LCS_PER_TILE }, (_, k) => cellRect(g, 2, 2, k));
    for (const r of rs) {
      expect(r.x).toBeGreaterThanOrEqual(t.x);
      expect(r.x + r.w).toBeLessThanOrEqual(t.x + TILE);
      expect(r.y + r.h).toBeLessThanOrEqual(t.y + TILE);
    }
    for (let i = 0; i < rs.length; i++)
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i]!;
        const b = rs[j]!;
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y).toBe(false);
      }
    for (let k = 0; k < LCS_PER_TILE; k++) {
      const c = center(cellRect(g, 2, 2, k));
      expect(cellAt(g, 2, 2, c.x, c.y)).toBe(k);
    }
    expect(cellAt(g, 2, 2, t.x + 1, t.y + 1)).toBe(-1);
  });

  it('puts every wire in a channel, with the right length and direction', () => {
    let checked = 0;
    for (let n = 0; n < dev.nodeCount; n += 7) {
      if (dev.nodeKind[n] !== NK.WIRE) continue;
      const s = wireSegment(g, n)!;
      const li = dev.nodeIdx[n]!;
      const dir = Math.floor(li / g.nk);
      const span = dev.wireKinds[li % g.nk]!.span;
      const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      expect(len).toBeCloseTo(span * g.pitch);
      if (dir === 0) expect(s.x1).toBeGreaterThan(s.x0);
      if (dir === 2) expect(s.x1).toBeLessThan(s.x0);
      if (dir === 1) expect(s.y1).toBeLessThan(s.y0);
      if (dir === 3) expect(s.y1).toBeGreaterThan(s.y0);
      // The start of a wire is inside its tile's switch box.
      const sb = switchBoxRect(g, dev.nodeX[n]!, dev.nodeY[n]!);
      expect(s.x0).toBeGreaterThanOrEqual(sb.x - 0.01);
      expect(s.x0).toBeLessThanOrEqual(sb.x + sb.w + 0.01);
      expect(s.y0).toBeGreaterThanOrEqual(sb.y - 0.01);
      expect(s.y0).toBeLessThanOrEqual(sb.y + sb.h + 0.01);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('hit-tests wires: the middle of every sampled wire finds that wire', () => {
    let checked = 0;
    for (let n = 3; n < dev.nodeCount; n += 41) {
      if (dev.nodeKind[n] !== NK.WIRE) continue;
      const s = wireSegment(g, n)!;
      const mx = (s.x0 + s.x1) / 2;
      const my = (s.y0 + s.y1) / 2;
      const found = wireAt(g, mx, my);
      expect(found).toBeGreaterThanOrEqual(0);
      // Overlapping wires of one lane are indistinguishable by position: the one found lies at the same point.
      expect(distToSegment(mx, my, wireSegment(g, found)!)).toBeCloseTo(0);
      expect(wireAt(g, mx, my, 0, (m) => m === n)).toBe(n);
      expect(distToSegment(mx, my, s)).toBeCloseTo(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
    // Inside a tile there are no wires.
    const t = tileRect(g, 3, 3);
    expect(wireAt(g, t.x + 50, t.y + 50)).toBe(-1);
  });

  it('gives pins anchors inside their tile', () => {
    for (const n of [dev.lcOut(3, 3, 5), dev.lcIn(3, 3, 2, 1), dev.ce(3, 3), dev.sr(3, 3), dev.padIn(4), dev.padOut(4), dev.ramOut(4, 3, 7), dev.ramIn(4, 3, 20)]) {
      const a = nodeAnchors(g, n)!;
      const x = dev.nodeX[n]!;
      const y = dev.nodeY[n]!;
      const t = tileRect(g, x, y);
      expect(a.in.x).toBeGreaterThanOrEqual(t.x);
      expect(a.in.x).toBeLessThanOrEqual(t.x + TILE);
      expect(a.in.y).toBeGreaterThanOrEqual(t.y);
      expect(a.in.y).toBeLessThanOrEqual(t.y + TILE);
    }
    expect(nodeAnchors(g, dev.gclk(0))).toBeUndefined();
  });

  it('chooses the zoom level from the size of a tile on screen', () => {
    expect(zoomLevel(0.05)).toBe('chip');
    expect(zoomLevel(0.5)).toBe('tile');
    expect(zoomLevel(3)).toBe('cell');
    const ks = [0.02, 0.1, 0.2, 0.5, 1, 2, 4, 10].map(zoomLevel);
    const order = { chip: 0, tile: 1, cell: 2 } as const;
    for (let i = 1; i < ks.length; i++) expect(order[ks[i]!]).toBeGreaterThanOrEqual(order[ks[i - 1]!]);
    expect(zoomLevel(zoomFor('chip', g, 900, 600))).toBe('chip');
    expect(zoomLevel(zoomFor('tile', g, 900, 600))).toBe('tile');
    expect(zoomLevel(zoomFor('cell', g, 900, 600))).toBe('cell');
  });

  it('moves between tiles with the keyboard, skipping empty corners', () => {
    expect(neighbourTile(g, 1, 1, 1, 0)).toEqual({ x: 2, y: 1 });
    expect(neighbourTile(g, 0, 1, -1, 0)).toEqual({ x: 0, y: 1 });
    expect(neighbourTile(g, 1, dev.height - 1, 0, 1)).toEqual({ x: 1, y: dev.height - 1 });
    // From the left I/O column going down, the corner is empty: stay.
    expect(neighbourTile(g, 0, 1, 0, -1)).toEqual({ x: 0, y: 1 });
  });
});

describe('inside a cell', () => {
  const g = dieGeom(getVFpga('M'));
  it('hit-tests the 16 LUT bits of a cell’s detailed drawing', () => {
    const r = cellRect(g, 3, 3, 2);
    for (let b = 0; b < 16; b++) {
      const br = lutBitRect(r, b);
      expect(lutBitAt(r, br.x + br.w / 2, br.y + br.h / 2)).toBe(b);
      expect(br.x).toBeGreaterThan(r.x);
      expect(br.x + br.w).toBeLessThan(r.x + r.w);
    }
    expect(lutBitAt(r, r.x + 1, r.y + 10)).toBe(-1);
    expect(lutBitAt(r, r.x + 18, r.y - 5)).toBe(-1);
  });

  it('finds the pin under a point', () => {
    const d = g.device;
    for (const n of [d.lcIn(3, 3, 5, 2), d.lcOut(3, 3, 6), d.ce(3, 3), d.sr(3, 3)]) {
      const a = nodeAnchors(g, n)!;
      expect(pinAt(g, 3, 3, a.in.x + 0.4, a.in.y - 0.3, 3)).toBe(n);
    }
    expect(pinAt(g, 3, 3, -500, -500, 3)).toBe(-1);
    const pad = d.padIn(5);
    const a = nodeAnchors(g, pad)!;
    expect(pinAt(g, d.nodeX[pad]!, d.nodeY[pad]!, a.in.x, a.in.y, 3)).toBe(pad);
  });
});

describe('viewport', () => {
  it('keeps the point under the pointer fixed while zooming', () => {
    const v = { k: 0.5, tx: 30, ty: -20 };
    const w = toWorld(v, 200, 150);
    const z = zoomAt(v, 2.5, 200, 150);
    const s = toScreen(z, w.x, w.y);
    expect(s.x).toBeCloseTo(200);
    expect(s.y).toBeCloseTo(150);
    expect(z.k).toBeCloseTo(1.25);
  });

  it('clamps the zoom', () => {
    expect(zoomAt({ k: 39, tx: 0, ty: 0 }, 10, 0, 0).k).toBe(40);
    expect(zoomAt({ k: 0.03, tx: 0, ty: 0 }, 0.01, 0, 0).k).toBe(0.02);
  });

  it('fits a rectangle centred in the view', () => {
    const r = { x: 100, y: 50, w: 400, h: 200 };
    const v = fitRect(r, 800, 600, 0);
    expect(v.k).toBeCloseTo(2);
    const vis = visibleRect(v, 800, 600);
    expect(vis.x + vis.w / 2).toBeCloseTo(300);
    expect(vis.y + vis.h / 2).toBeCloseTo(150);
  });
});
