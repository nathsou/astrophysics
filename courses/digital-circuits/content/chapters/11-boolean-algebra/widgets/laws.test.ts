import { describe, expect, test } from 'vitest';
import { LAWS, checkLaws } from './laws';

describe('checkLaws', () => {
  test('every law in the list is true except the deliberate mistake', () => {
    for (const law of LAWS) {
      const r = checkLaws(law.left, law.right);
      expect(r.ok, law.id).toBe(true);
      if (r.ok) expect(r.equal, law.id).toBe(law.id !== 'wrong');
    }
  });

  test('the counterexample of the mistaken De Morgan is A = 1, B = 0', () => {
    const r = checkLaws('!(A & B)', '!A & !B');
    expect(r.ok && r.counterexample?.env).toEqual({ A: 0, B: 1 });
    if (r.ok) expect(r.differing).toBe(2);
  });

  test('the second distributive law', () => {
    const r = checkLaws('A + B·C', '(A + B)·(A + C)');
    expect(r.ok && r.equal).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(8);
  });

  test('errors say which side is wrong', () => {
    expect(checkLaws('A +', 'A')).toMatchObject({ ok: false, side: 'left' });
    expect(checkLaws('A', '(A')).toMatchObject({ ok: false, side: 'right' });
    expect(checkLaws('', 'A')).toMatchObject({ ok: false, side: 'left' });
    expect(checkLaws('A ^ B ^ C ^ D ^ E ^ F ^ G', 'A')).toMatchObject({ ok: false, side: 'both' });
  });

  test('constants and variables that appear on one side only', () => {
    const r = checkLaws('A | 1', '1');
    expect(r.ok && r.equal).toBe(true);
    const s = checkLaws('A & B | A & !B', 'A');
    expect(s.ok && s.equal).toBe(true);
    if (s.ok) expect(s.minimal.left).toBe('A');
  });
});
