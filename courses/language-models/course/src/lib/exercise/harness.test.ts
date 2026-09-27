import { describe, expect as vexpect, test } from 'vitest';
import * as h from './harness';

describe('in-browser test harness', () => {
  test('passing and failing tests are reported', async () => {
    h.test('ok', () => h.expect(new Uint8Array([1, 2])).toEqual(new Uint8Array([1, 2])));
    h.test('bad', () => h.expect([1, 2, 3]).toEqual([1, 9, 3]));
    h.test('not', () => h.expect(1).not.toBe(2));
    h.test('close', () => h.expect(0.1 + 0.2).toBeCloseTo(0.3, 10));
    h.test('throws', () => h.expect(() => { throw new Error('boom'); }).toThrow('boom'));
    const r = await h.runRegistered();
    vexpect(r.map((x) => x.passed)).toEqual([true, false, true, true, true]);
    vexpect(r[1]!.error).toContain('first difference at index 1');
  });
});
