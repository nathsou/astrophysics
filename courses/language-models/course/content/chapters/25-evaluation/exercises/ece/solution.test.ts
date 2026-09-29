import { expect, test } from '@lm/test';
import { ece } from './solution.ts';

test('calibrated: 80% confident and right 80% of the time', () => {
  const preds = Array.from({ length: 10 }, (_, i) => ({ confidence: 0.85, correct: i < 8 }));
  expect(ece(preds)).toBeCloseTo(0.05, 12); // mean confidence 0.85 vs accuracy 0.8
});

test('overconfident', () => {
  const preds = Array.from({ length: 4 }, (_, i) => ({ confidence: 0.95, correct: i < 2 }));
  expect(ece(preds)).toBeCloseTo(0.45, 12);
});

test('bins are weighted by size, and confidence 1 goes in the last bin', () => {
  const preds = [
    { confidence: 1, correct: true },
    { confidence: 1, correct: true },
    { confidence: 0.25, correct: true },
  ];
  // Bin 9: conf 1, acc 1 → 0. Bin 2: conf 0.25, acc 1 → 0.75, weight 1/3.
  expect(ece(preds)).toBeCloseTo(0.25, 12);
});
