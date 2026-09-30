import { describe, expect, it } from 'vitest';
import { cpldGeom, cpldHit, RH } from './cpld-geometry';

describe('CPLD geometry', () => {
  const g = cpldGeom();
  it('lays out four blocks around the matrix', () => {
    expect(g.fbs).toHaveLength(4);
    expect(g.fbs[0]!.arrY1).toBeLessThan(g.band.y0);
    expect(g.fbs[2]!.arrY0).toBeGreaterThan(g.band.y1);
    expect(g.fbs[0]!.right).toBe(false);
    expect(g.fbs[1]!.right).toBe(true);
    expect(g.fbs[1]!.arrX0).toBeGreaterThan(g.fbs[0]!.arrX1);
    for (const f of g.fbs) {
      expect(f.padX >= 0 && f.padX + f.padW <= g.W).toBe(true);
      expect(f.mcY(7)).toBeLessThan(f.arrY1);
    }
  });
  it('hit-tests fuses, macrocells, pads and crossbar dots', () => {
    const sel = (fb: number, k: number) => (fb * 24 + k) % 64;
    for (const f of g.fbs) {
      for (const t of [0, 13, 39]) for (const c of [0, 20, 47]) expect(cpldHit(g, f.colX(c), f.rowY(t), sel)).toEqual({ kind: 'fuse', fb: f.fb, term: t, col: c });
      for (let m = 0; m < 8; m++) {
        expect(cpldHit(g, f.mcU(60), f.mcY(m), sel)).toEqual({ kind: 'mc', fb: f.fb, mc: m });
        expect(cpldHit(g, f.padX + 10, f.mcY(m), sel)).toEqual({ kind: 'pad', io: f.fb * 8 + m });
      }
      for (const k of [0, 11, 23]) expect(cpldHit(g, f.inputX(k), g.lineY(sel(f.fb, k)), sel)).toEqual({ kind: 'mux', fb: f.fb, input: k });
    }
    expect(RH * 40).toBe(360);
  });
});
