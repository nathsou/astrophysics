import { expect, test } from '@lm/test';
import { maskedLoss } from './solution.ts';

test('uniform logits cost ln V per counted position', () => {
  expect(maskedLoss([[0, 0, 0, 0]], [2], [true])).toBeCloseTo(Math.log(4), 10);
});

test('masked positions do not count, however bad', () => {
  const logits = [[10, 0], [0, 0]];
  // Position 0 would be terrible (target 1, but 10 vs 0) — it is masked out.
  expect(maskedLoss(logits, [1, 0], [false, true])).toBeCloseTo(Math.log(2), 10);
});

test('averages over counted positions only', () => {
  const logits = [[0, 0], [Math.log(3), 0], [0, 0]];
  const want = (Math.log(2) + -Math.log(3 / 4)) / 2;
  expect(maskedLoss(logits, [0, 0, 1], [false, true, true])).toBeCloseTo(want, 10);
});
