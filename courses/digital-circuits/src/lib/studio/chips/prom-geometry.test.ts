import { describe, expect, it } from 'vitest';
import { promGeom, promHit } from './prom-geometry';

describe('PROM geometry', () => {
  it('hit-tests every cell back to itself', () => {
    const g = promGeom(16, 7, 4);
    for (let w = 0; w < 16; w++)
      for (let c = 0; c < 7; c++) expect(promHit(g, g.fuseX(c), g.wordY(w))).toEqual({ word: w, column: c });
    expect(promHit(g, 0, 0)).toBeNull();
    expect(promHit(g, g.xArr + g.colW * 7 + 1, g.wordY(0))).toBeNull();
  });
  it('shrinks rows for bigger PROMs', () => {
    expect(promGeom(64, 8, 6).rowH).toBeLessThan(promGeom(16, 8, 4).rowH);
  });
});
