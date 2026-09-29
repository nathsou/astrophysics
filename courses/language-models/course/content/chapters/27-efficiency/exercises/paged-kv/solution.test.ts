import { expect, test } from '@lm/test';
import { kvSlots } from './solution.ts';

test('paging wastes less than a block per sequence', () => {
  const r = kvSlots([100, 17, 2048], 2048, 16);
  expect(r.used).toBe(2165);
  expect(r.contiguous).toBe(6144);
  expect(r.paged).toBe(112 + 32 + 2048);
});

test('block size 1 wastes nothing', () => {
  const r = kvSlots([5, 9], 64, 1);
  expect(r.paged).toBe(r.used);
});
