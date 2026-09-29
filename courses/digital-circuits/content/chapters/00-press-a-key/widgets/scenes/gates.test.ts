import { describe, expect, test } from 'vitest';
import { NAND, NAND_ROW, ROWS, ROW_H, TOP, X0, X1, buildBlock } from './gates';
import { LEVELS, focusRect } from '../zoom';

describe('the standard-cell block', () => {
  const { rows } = buildBlock();
  test('every row is filled from edge to edge without gaps or overlaps', () => {
    expect(rows.length).toBe(ROWS);
    for (const cells of rows) {
      expect(cells[0]!.x).toBeCloseTo(X0, 6);
      for (let i = 1; i < cells.length; i++) expect(cells[i]!.x).toBeCloseTo(cells[i - 1]!.x + cells[i - 1]!.w, 6);
      const last = cells[cells.length - 1]!;
      expect(last.x + last.w).toBeCloseTo(X1, 6);
    }
  });
  test('there is exactly one NAND cell, where the zoom is aimed', () => {
    const nands = rows.flat().filter((c) => c.nand);
    expect(nands.length).toBe(1);
    const n = nands[0]!;
    expect(n.x).toBeCloseTo(NAND.x, 6);
    expect(rows[NAND_ROW]!.includes(n)).toBe(true);
    const f = LEVELS[5]!.focus;
    expect(f.x).toBeCloseTo(n.x + n.w / 2, 1);
    expect(f.y).toBeCloseTo(TOP + NAND_ROW * ROW_H + ROW_H / 2, 1);
    // and the focus rectangle contains the whole cell
    const r = focusRect(5);
    expect(r.x).toBeLessThan(n.x);
    expect(r.x + r.w).toBeGreaterThan(n.x + n.w);
    expect(r.y).toBeLessThan(TOP + NAND_ROW * ROW_H);
    expect(r.y + r.h).toBeGreaterThan(TOP + (NAND_ROW + 1) * ROW_H);
  });
  test('is deterministic', () => {
    expect(buildBlock()).toEqual(buildBlock());
  });
});
