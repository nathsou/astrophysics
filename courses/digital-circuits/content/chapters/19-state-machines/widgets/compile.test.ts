import { expect, test } from 'vitest';
import { toDcl } from './dcl';
import { compileStats } from './compile';
import { PRESETS, TRAFFIC_LIGHT } from './presets';

test('the compiler lowers each encoding: flip-flops match the code width', () => {
  const ff = (e: 'binary' | 'gray' | 'onehot') => compileStats(toDcl(TRAFFIC_LIGHT, e), TRAFFIC_LIGHT);
  expect(ff('binary')).toMatchObject({ ok: true, flipFlops: 2 });
  expect(ff('gray')).toMatchObject({ ok: true, flipFlops: 2 });
  expect(ff('onehot')).toMatchObject({ ok: true, flipFlops: 4 });
  expect(ff('binary').gates).toBeGreaterThan(0);
});
test('every preset compiles in every encoding', () => {
  for (const p of PRESETS) for (const e of ['binary', 'gray', 'onehot'] as const) expect(compileStats(toDcl(p.fsm, e), p.fsm).ok).toBe(true);
});
