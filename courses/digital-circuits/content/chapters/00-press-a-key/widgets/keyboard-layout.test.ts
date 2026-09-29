import { describe, expect, test } from 'vitest';
import { BODY, extraKeys, keyA, keyCentre, mainKeys } from './keyboard-layout';
import { LEVELS } from './zoom';

describe('keyboard layout', () => {
  const all = [...mainKeys(), ...extraKeys()];
  test('has about a hundred keys, all inside the case and inside the frame', () => {
    expect(all.length).toBeGreaterThan(95);
    expect(all.length).toBeLessThan(110);
    for (const key of all) {
      expect(key.x).toBeGreaterThanOrEqual(BODY.x);
      expect(key.x + key.w).toBeLessThanOrEqual(BODY.x + BODY.w);
      expect(key.y).toBeGreaterThanOrEqual(BODY.y);
      expect(key.y + key.h).toBeLessThanOrEqual(BODY.y + BODY.h);
    }
  });
  test('no two keys overlap', () => {
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i]!;
        const b = all[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.label}@${a.x},${a.y} and ${b.label}@${b.x},${b.y}`).toBe(false);
      }
  });
  test('the first level zooms into the A key', () => {
    const c = keyCentre(keyA());
    expect(Math.abs(LEVELS[0]!.focus.x - c.x)).toBeLessThan(12);
    expect(LEVELS[0]!.focus.y).toBeCloseTo(c.y, 0);
  });
});
