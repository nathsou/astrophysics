import { expect, test } from '@lm/test';
import { beamSearch } from './solution.ts';

// Token 0 is likelier first (0.6 against 0.4), but after 0 the model is unsure, while after 1 it is certain.
const table: Record<string, number[]> = { '': [0.6, 0.4, 0], '0': [0.34, 0.33, 0.33], '1': [0, 0, 1] };
const logprobs = (ids: number[]) => (table[ids.slice(1).join(',')] ?? [0.2, 0.2, 0.6]).map(Math.log);

test('width 1 is greedy decoding', () => {
  expect(beamSearch(logprobs, [7], 1, 2)[0]!.ids).toEqual([7, 0, 0]);
});

test('a wider beam finds the more probable sequence that greedy misses', () => {
  const beam = beamSearch(logprobs, [7], 2, 2);
  expect(beam[0]!.ids).toEqual([7, 1, 2]);
  expect(beam[0]!.logp).toBeCloseTo(Math.log(0.4), 10);
  expect(beam[1]!.ids).toEqual([7, 0, 0]);
  expect(beam[1]!.logp).toBeCloseTo(Math.log(0.6 * 0.34), 10);
});

test('finished hypotheses are carried along unchanged', () => {
  // With eos = 2, [7, 1, 2] finishes at step 2 and must still be there after step 3.
  const beam = beamSearch(logprobs, [7], 2, 3, 2);
  const done = beam.find((h) => h.ids.join() === '7,1,2');
  expect(done).toBeDefined();
  expect(done!.logp).toBeCloseTo(Math.log(0.4), 10);
});
