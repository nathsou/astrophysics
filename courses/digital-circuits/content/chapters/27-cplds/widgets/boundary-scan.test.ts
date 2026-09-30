import { describe, expect, test } from 'vitest';
import { IDCODE_VALUE, NETS, runInterconnectTest, idcodeHex } from './boundary-scan';

describe('the boundary-scan board of Chapter 27', () => {
  test('a good board passes: 16 patterns, every net seen high and low, and both chips answer with their IDCODE', () => {
    const r = runInterconnectTest();
    expect(r.steps).toHaveLength(2 * NETS);
    expect(r.bad).toEqual([]);
    expect(r.verdicts.every((v) => v === 'ok')).toBe(true);
    expect(r.idcodes).toEqual([IDCODE_VALUE, IDCODE_VALUE]);
    expect(idcodeHex(IDCODE_VALUE)).toBe('1C0321FF');
    // The walking one really walks, and the receiver saw it.
    expect(r.steps[3]!.sent).toEqual([0, 0, 0, 1, 0, 0, 0, 0]);
    expect(r.steps[3]!.seen).toEqual(r.steps[3]!.sent);
    expect(r.steps[NETS + 5]!.sent).toEqual([1, 1, 1, 1, 1, 0, 1, 1]);
  });

  test('a broken joint, a short to ground and a short to the supply are each found, and only on their own net', () => {
    const r = runInterconnectTest({ 3: 'open', 5: 'stuck0', 6: 'stuck1' });
    expect(r.bad).toEqual([3, 5, 6]);
    // An open net floats; the receiving cell reads it low, exactly like a short to ground.
    expect(r.verdicts[3]).toBe('always 0');
    expect(r.verdicts[5]).toBe('always 0');
    expect(r.verdicts[6]).toBe('always 1');
    expect(r.verdicts[0]).toBe('ok');
    expect(r.verdicts[7]).toBe('ok');
  });

  test('a net stuck high is caught by exactly the patterns that send it a 0: half of the sixteen', () => {
    const r = runInterconnectTest({ 2: 'stuck1' });
    const wrong = r.steps.filter((s) => s.seen[2] !== s.sent[2]);
    // Net 2 is sent 0 in seven walking-one patterns and in its own walking-zero pattern.
    expect(wrong).toHaveLength(8);
    // The walking zeros are what catch a net stuck high against a walking one, which only ever sends it one 1.
    expect(r.steps.filter((s) => s.label.startsWith('walking 1') && s.seen[2] !== s.sent[2])).toHaveLength(7);
  });

  test('the whole test costs a few thousand TCK cycles on the two chips: each pattern is two 99-bit scans and more', () => {
    const r = runInterconnectTest();
    expect(r.cycles).toBeGreaterThan(6000);
    expect(r.cycles).toBeLessThan(9000);
  });
});
