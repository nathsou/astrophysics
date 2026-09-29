import { expect, test } from '@lm/test';
import { clipLoss } from './solution.ts';

test('random guessing among N costs log N', () => {
  const same = [[1, 0], [1, 0], [1, 0], [1, 0]];
  expect(clipLoss(same, same, 1)).toBeCloseTo(Math.log(4), 10);
});

test('perfectly separated pairs at low temperature cost almost nothing', () => {
  const e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  expect(clipLoss(e, e, 0.01)).toBeLessThan(1e-6);
});

test('both directions count', () => {
  // Two images both close to text 0: image → text is fine for image 0, but text 0 is ambiguous between images.
  const images = [[1, 0], [0.8, 0.6]];
  const texts = [[1, 0], [0, 1]];
  const l = clipLoss(images, texts, 0.1);
  const row = (z: number[], t: number) => Math.log(z.reduce((s, v) => s + Math.exp(v), 0)) - z[t]!;
  const expected = (row([10, 0], 0) + row([8, 6], 1) + row([10, 8], 0) + row([0, 6], 1)) / 4;
  expect(l).toBeCloseTo(expected, 8);
});
