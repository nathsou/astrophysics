import { it, expect } from 'vitest';
import { wordCardPosition } from './position';
it('places cards above low anchors and clamps horizontal edges', () => {
  expect(wordCardPosition({ left: 350, width: 20, top: 650, bottom: 680 }, { width: 320, height: 200 }, { width: 375, height: 700 })).toEqual({ left: 47, top: 440 });
});
it('clamps cards when neither above nor below fits in a short viewport', () => {
  expect(wordCardPosition({ left: 0, width: 10, top: 80, bottom: 100 }, { width: 304, height: 220 }, { width: 320, height: 240 })).toEqual({ left: 8, top: 12 });
});
