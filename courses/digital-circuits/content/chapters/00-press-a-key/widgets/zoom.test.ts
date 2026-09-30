import { describe, expect, test } from 'vitest';
import { FRAME, LAST, LEVELS, clampZ, ease, focusRect, formatLength, levelView, nearestLevel, opacityAt, pan, scaleBar, stepFactor, viewWidth } from './zoom';

/** Screen position of a point p of level i when the camera is at z. */
const toScreen = (i: number, z: number, p: { x: number; y: number }) => {
  const v = levelView(i, z);
  return { x: v.scale * p.x + v.tx, y: v.scale * p.y + v.ty };
};

describe('the levels', () => {
  test('eight levels from a keyboard to a silicon lattice, widths strictly decreasing', () => {
    expect(LEVELS.length).toBe(8);
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i]!.width).toBeLessThan(LEVELS[i - 1]!.width);
    expect(LEVELS[0]!.width).toBeCloseTo(0.45, 3);
    expect(LEVELS[LAST]!.width).toBeLessThan(1e-8);
  });
  test('every focus rectangle lies inside the frame and has the frame’s shape', () => {
    for (let i = 0; i < LAST; i++) {
      const f = focusRect(i);
      expect(f.x).toBeGreaterThanOrEqual(-1e-9);
      expect(f.y).toBeGreaterThanOrEqual(-1e-9);
      expect(f.x + f.w).toBeLessThanOrEqual(FRAME.w + 1e-9);
      expect(f.y + f.h).toBeLessThanOrEqual(FRAME.h + 1e-9);
      expect(f.w / f.h).toBeCloseTo(FRAME.w / FRAME.h, 9);
      expect(f.w).toBeCloseTo(FRAME.w / stepFactor(i), 9);
    }
  });
  test('each level names a chapter and a caption', () => {
    for (const l of LEVELS) {
      expect(l.caption.length).toBeGreaterThan(30);
      expect(l.chapter.number).toBeGreaterThan(0);
    }
  });
});

describe('the camera', () => {
  test('at an integer z the level is the frame itself, and the others are invisible', () => {
    for (let i = 0; i <= LAST; i++) {
      const v = levelView(i, i);
      expect(v).toEqual({ scale: 1, tx: 0, ty: 0, opacity: 1 });
      for (let j = 0; j <= LAST; j++) if (Math.abs(j - i) >= 1) expect(levelView(j, i).opacity).toBe(0);
    }
  });
  test('at the end of a zoom the focus rectangle fills the frame', () => {
    for (let i = 0; i < LAST; i++) {
      const f = focusRect(i);
      // z just short of i + 1: level i, seen through the camera, has its focus at the frame
      const a = toScreen(i, i + 1, { x: f.x, y: f.y });
      const b = toScreen(i, i + 1, { x: f.x + f.w, y: f.y + f.h });
      expect(a.x).toBeCloseTo(0, 6);
      expect(a.y).toBeCloseTo(0, 6);
      expect(b.x).toBeCloseTo(FRAME.w, 6);
      expect(b.y).toBeCloseTo(FRAME.h, 6);
    }
  });
  test('level i + 1 appears exactly in the focus rectangle of level i at the start of the zoom', () => {
    for (let i = 0; i < LAST; i++) {
      const f = focusRect(i);
      const tl = toScreen(i + 1, i, { x: 0, y: 0 });
      const br = toScreen(i + 1, i, { x: FRAME.w, y: FRAME.h });
      expect(tl.x).toBeCloseTo(f.x, 6);
      expect(tl.y).toBeCloseTo(f.y, 6);
      expect(br.x).toBeCloseTo(f.x + f.w, 6);
      expect(br.y).toBeCloseTo(f.y + f.h, 6);
    }
  });
  test('the two levels stay locked together all the way: a point of the next level sits over the same point of the current one', () => {
    for (let i = 0; i < LAST; i++) {
      const f = focusRect(i);
      for (const u of [0.1, 0.35, 0.5, 0.8]) {
        const z = i + u;
        // the frame corners of level i+1 are the focus corners of level i
        const a = toScreen(i, z, { x: f.x, y: f.y });
        const b = toScreen(i + 1, z, { x: 0, y: 0 });
        expect(a.x).toBeCloseTo(b.x, 4);
        expect(a.y).toBeCloseTo(b.y, 4);
        const c = toScreen(i, z, { x: f.x + f.w, y: f.y + f.h });
        const d = toScreen(i + 1, z, { x: FRAME.w, y: FRAME.h });
        expect(c.x).toBeCloseTo(d.x, 4);
        expect(c.y).toBeCloseTo(d.y, 4);
      }
    }
  });
  test('the zoom looks like constant speed: the scale grows by the same factor in equal steps of z', () => {
    const s = (z: number) => levelView(0, z).scale;
    expect(s(0.5) / s(0.25)).toBeCloseTo(s(0.75) / s(0.5), 9);
    expect(s(1)).toBeCloseTo(stepFactor(0), 9);
  });
  test('pan runs from 0 to 1 and is 0 at the start', () => {
    expect(pan(0, 50)).toBe(0);
    expect(pan(1, 50)).toBeCloseTo(1, 12);
    expect(pan(0.5, 50)).toBeGreaterThan(0.5); // it heads for the target early: most of the movement comes first
    expect(pan(0.3, 1)).toBeCloseTo(0.3, 12);
  });
  test('opacity: the level being left and the level being reached cross-fade, and one is always at least half visible', () => {
    expect(opacityAt(0)).toBe(1);
    expect(opacityAt(-1)).toBe(0);
    expect(opacityAt(1)).toBe(0);
    for (let u = 0; u <= 1; u += 0.05) expect(Math.max(opacityAt(u), opacityAt(u - 1))).toBeGreaterThan(0.45);
    // never both fully opaque in the middle of a zoom, so the swap is not a jump
    expect(opacityAt(0.5) + opacityAt(-0.5)).toBeGreaterThan(0.9);
  });
});

describe('the scale bar', () => {
  test('the real width follows the levels and is log-linear between them', () => {
    expect(viewWidth(0)).toBeCloseTo(0.45, 9);
    expect(viewWidth(4)).toBeCloseTo(LEVELS[4]!.width, 12);
    expect(viewWidth(7)).toBeCloseTo(LEVELS[7]!.width, 15);
    expect(viewWidth(0.5)).toBeCloseTo(Math.sqrt(LEVELS[0]!.width * LEVELS[1]!.width), 9);
  });
  test('formatting', () => {
    expect(formatLength(0.45)).toBe('45 cm');
    expect(formatLength(0.025)).toBe('2.5 cm');
    expect(formatLength(0.0125)).toBe('1.3 cm');
    expect(formatLength(5.2e-3)).toBe('5.2 mm');
    expect(formatLength(30e-6)).toBe('30 µm');
    expect(formatLength(5e-9)).toBe('5 nm');
  });
  test('helpers', () => {
    expect(nearestLevel(2.4)).toBe(2);
    expect(nearestLevel(9)).toBe(LAST);
    expect(clampZ(-3)).toBe(0);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
  });
});

describe('scaleBar', () => {
  test('a round length that fits', () => {
    const b = scaleBar(0.45);
    expect(b.length).toBeCloseTo(0.1, 12);
    expect(b.fraction).toBeCloseTo(0.1 / 0.45, 9);
    expect(scaleBar(5e-9).length).toBeCloseTo(1e-9, 20);
    expect(scaleBar(30e-6).length).toBeCloseTo(5e-6, 15);
  });
  test('never longer than the maximum fraction, never tiny', () => {
    for (const w of [0.45, 0.12, 0.035, 0.0144, 0.005, 30e-6, 1.6e-6, 5e-9, 3.7e-3]) {
      const b = scaleBar(w);
      expect(b.fraction).toBeLessThanOrEqual(0.28 + 1e-9);
      expect(b.fraction).toBeGreaterThan(0.1);
    }
  });
});
