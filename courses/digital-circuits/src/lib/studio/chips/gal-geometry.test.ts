import { describe, expect, it } from 'vitest';
import { ROWS, COLUMNS, OLMC_PINS } from '../../pld/devices/gal22v10';
import { galGeom, galHit, pinColumns } from './gal-geometry';

describe('GAL geometry', () => {
  const g = galGeom();
  it('places 132 distinct rows in order', () => {
    for (let r = 1; r < ROWS; r++) expect(g.rowY(r)).toBeGreaterThan(g.rowY(r - 1));
    expect(g.group).toHaveLength(10);
  });
  it('hit-tests every fuse back to itself', () => {
    for (let r = 0; r < ROWS; r += 5) for (let c = 0; c < COLUMNS; c += 7) expect(galHit(g, g.colX(c), g.rowY(r))).toEqual({ kind: 'fuse', row: r, col: c });
  });
  it('finds pins and macrocells', () => {
    for (const p of g.pads) expect(galHit(g, p.x + p.w / 2, p.cy)).toEqual({ kind: 'pin', pin: p.pin });
    OLMC_PINS.forEach((_, i) => expect(galHit(g, g.xBlock0 + 20, g.group[i]!.cy)).toEqual({ kind: 'olmc', index: i }));
  });
  it('maps pins to their column pairs', () => {
    expect(pinColumns(1)).toEqual([0, 1]);
    expect(pinColumns(23)).toEqual([2, 3]);
    expect(pinColumns(13)).toEqual([42, 43]);
    expect(pinColumns(12)).toBeNull();
  });
  it('routes every input and feedback', () => {
    expect(g.routes.map((r) => r.pin).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  });
});
