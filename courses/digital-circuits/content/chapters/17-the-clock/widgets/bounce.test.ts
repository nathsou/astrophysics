import { describe, expect, test } from 'vitest';
import { button, debounce, edges, RES, segsOf } from './bounce';

describe('a bouncing button', () => {
  test('is low, then high after the press, then low again, with several edges in each burst', () => {
    const b = button(1, 4);
    expect(b.raw[0]).toBe(0);
    expect(b.raw[(b.pressAt + 4 + 1) * RES]).toBe(1);
    expect(b.raw[(b.releaseAt + 4 + 1) * RES]).toBe(0);
    expect(edges(b.raw)).toBeGreaterThanOrEqual(6);
    expect(edges(b.raw) % 2).toBe(0);
  });
  test('the chatter lasts no longer than asked', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const b = button(seed, 3);
      const first = b.raw.findIndex((v) => v === 1);
      expect(first).toBe(b.pressAt * RES);
      // Steady from 3 ms after the press until the release.
      for (let k = Math.round((b.pressAt + 3) * RES); k < b.releaseAt * RES; k++) expect(b.raw[k]).toBe(1);
    }
  });
});

describe('the Debouncer of the standard library', () => {
  test('a window longer than the bounce gives one clean press and one clean release', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const b = button(seed, 4);
      const c = debounce(b, 8);
      expect(edges(c.clean), `seed ${seed}`).toBe(2);
      expect(c.clean[b.length - 1]).toBe(0);
    }
  });
  test('the output changes a window late, at the earliest: two cycles of synchroniser, then the window', () => {
    const b = button(2, 4);
    const c = debounce(b, 8);
    const rise = c.clean.findIndex((v) => v === 1);
    const firstSeen = c.sampled.findIndex((v) => v === 1);
    expect(rise - firstSeen).toBeGreaterThanOrEqual(2 + 8);
  });
  test('a window of two cycles lets bounces through', () => {
    let leaked = 0;
    for (let seed = 1; seed <= 10; seed++) if (edges(debounce(button(seed, 4), 2).clean) > 2) leaked++;
    expect(leaked).toBeGreaterThan(0);
  });
  test('the raw button has many more edges than the clean output', () => {
    const b = button(3, 4);
    expect(edges(b.raw)).toBeGreaterThan(edges(debounce(b, 8).clean) * 2);
  });
});

describe('segments', () => {
  test('merge equal neighbours and cover the whole list', () => {
    expect(segsOf([0, 0, 1, 1, 1, 0], 0.5)).toEqual([[0, 1, 0], [1, 2.5, 1], [2.5, 3, 0]]);
  });
});
