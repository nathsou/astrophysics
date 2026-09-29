import { describe, expect, test } from 'vitest';
import { CELL, CHANNELS, CONTACTS_N, CONTACTS_P, N_DIFF, P_DIFF, POLY_A, POLY_B, POLY_W, POLY_Y } from './cmos';
import { LEVELS } from '../zoom';
import { NAND, ROW_H } from './gates';

describe('the NAND cell', () => {
  test('is centred in the frame and about as wide as the level-5 cell says (0.45 µm of 1.6)', () => {
    expect((CELL.x0 + CELL.x1) / 2).toBe(320);
    // level 5's cell is 0.45 µm wide and one row (0.9 µm) tall: in this frame 180 × 360 px
    expect(CELL.x1 - CELL.x0).toBeCloseTo(180, 6);
    expect(CELL.y1 - CELL.y0).toBeCloseTo(360, 6);
    expect(ROW_H / NAND.w).toBeCloseTo(2, 6);
  });
  test('two gates cross both diffusions, and every contact lies inside a diffusion', () => {
    for (const x of [POLY_A, POLY_B]) {
      expect(x - POLY_W / 2).toBeGreaterThan(P_DIFF.x0);
      expect(x + POLY_W / 2).toBeLessThan(P_DIFF.x1);
      expect(POLY_Y.y0).toBeLessThan(P_DIFF.y0);
      expect(POLY_Y.y1).toBeGreaterThan(N_DIFF.y1);
    }
    for (const x of CONTACTS_P) expect(x > P_DIFF.x0 && x < P_DIFF.x1).toBe(true);
    for (const x of CONTACTS_N) expect(x > N_DIFF.x0 && x < N_DIFF.x1).toBe(true);
    // contacts sit between the gates or outside them, never under a gate
    for (const x of [...CONTACTS_P, ...CONTACTS_N]) for (const g of [POLY_A, POLY_B]) expect(Math.abs(x - g)).toBeGreaterThan(POLY_W / 2 + 5);
  });
  test('four transistors, and the zoom is aimed at the channel of the first n-type one', () => {
    expect(CHANNELS.length).toBe(4);
    const n1 = CHANNELS.find((c) => c.id === 'N1')!;
    const f = LEVELS[6]!.focus;
    expect(f.x).toBeGreaterThan(n1.x);
    expect(f.x).toBeLessThan(n1.x + n1.w);
    expect(f.y).toBeGreaterThan(n1.y);
    expect(f.y).toBeLessThan(n1.y + n1.h);
  });
});
