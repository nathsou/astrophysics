import { expect, test } from '@lm/test';
import { softmaxCrossEntropy } from './solution.ts';

test('uniform logits: loss is log V and the gradient is p − y', () => {
  const { loss, grad } = softmaxCrossEntropy([0, 0, 0, 0], 2);
  expect(loss).toBeCloseTo(Math.log(4), 10);
  expect(grad).toEqual([0.25, 0.25, -0.75, 0.25]);
});

test('the gradient sums to zero', () => {
  const { grad } = softmaxCrossEntropy([1.3, -0.2, 4, 0.7, -2], 1);
  expect(grad.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
});

test('matches finite differences', () => {
  const z = [0.5, -1.2, 2.0, 0.1];
  const { grad } = softmaxCrossEntropy(z, 3);
  for (let j = 0; j < z.length; j++) {
    const up = [...z], down = [...z];
    up[j]! += 1e-5;
    down[j]! -= 1e-5;
    const numeric = (softmaxCrossEntropy(up, 3).loss - softmaxCrossEntropy(down, 3).loss) / 2e-5;
    expect(grad[j]!).toBeCloseTo(numeric, 5);
  }
});

test('stays finite for huge logits', () => {
  const { loss, grad } = softmaxCrossEntropy([1000, 0, -1000], 1);
  expect(loss).toBeCloseTo(1000, 6);
  expect(grad.every(Number.isFinite)).toBe(true);
});
