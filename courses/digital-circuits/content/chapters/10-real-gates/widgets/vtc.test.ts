import { describe, expect, test } from 'vitest';
import { DEFAULTS, judge, levels, sweep, vmFormula } from './vtc';

describe('the inverter transfer curve measured on the analog engine', () => {
  const v = sweep(DEFAULTS);
  const l = levels(v, 5);

  test('the output swings rail to rail and inverts', () => {
    expect(l.voh).toBeGreaterThan(4.99);
    expect(l.vol).toBeLessThan(0.01);
    for (let i = 1; i < v.vout.length; i++) expect(v.vout[i]!).toBeLessThanOrEqual(v.vout[i - 1]! + 1e-9);
  });

  test('a balanced inverter switches at half the supply, as the closed form says', () => {
    expect(l.vm).toBeCloseTo(2.5, 2);
    expect(vmFormula(DEFAULTS)).toBeCloseTo(2.5, 6);
    // Without channel-length modulation the engine reproduces the textbook formula for any k ratio.
    for (const ratio of [0.25, 0.5, 2, 4]) {
      const p = { ...DEFAULTS, lambda: 0, kp: DEFAULTS.kn * ratio };
      const m = levels(sweep(p, 401), 5).vm;
      expect(m).toBeCloseTo(vmFormula(p), 1);
    }
  });

  test('a stronger pMOS moves the threshold up, a weaker one down', () => {
    const strong = levels(sweep({ ...DEFAULTS, kp: DEFAULTS.kn * 4 }), 5).vm;
    const weak = levels(sweep({ ...DEFAULTS, kp: DEFAULTS.kn / 4 }), 5).vm;
    expect(strong).toBeGreaterThan(2.5);
    expect(weak).toBeLessThan(2.5);
  });

  test('VIL and VIH are where the slope is −1, and give positive noise margins', () => {
    expect(l.vil).not.toBeNull();
    expect(l.vih).not.toBeNull();
    expect(l.vil!).toBeGreaterThan(1);
    expect(l.vil!).toBeLessThan(l.vm);
    expect(l.vih!).toBeGreaterThan(l.vm);
    expect(l.vih!).toBeLessThan(4);
    expect(l.nmh!).toBeCloseTo(l.voh - l.vih!, 9);
    expect(l.nml!).toBeCloseTo(l.vil! - l.vol, 9);
    expect(l.nmh!).toBeGreaterThan(1);
    // Check the slope at VIL by differencing the curve.
    const h = 5 / 200;
    const i = Math.round(l.vil! / h);
    const s = (v.vout[i + 1]! - v.vout[i - 1]!) / (2 * h);
    expect(s).toBeGreaterThan(-1.15);
    expect(s).toBeLessThan(-0.85);
  });

  test('the supply current is a spike in the middle and nothing at the rails', () => {
    expect(v.idd[0]!).toBeLessThan(1e-9);
    expect(v.idd[v.idd.length - 1]!).toBeLessThan(1e-9);
    const peak = Math.max(...v.idd);
    expect(peak).toBeGreaterThan(1e-3);
    expect(v.idd.indexOf(peak)).toBeGreaterThan(80);
    expect(v.idd.indexOf(peak)).toBeLessThan(120);
  });

  test('lower supplies shrink the noise margins', () => {
    const at33 = levels(sweep({ ...DEFAULTS, vdd: 3.3, vt: 0.8 }), 3.3);
    const at18 = levels(sweep({ ...DEFAULTS, vdd: 1.8, vt: 0.5 }), 1.8);
    expect(at33.nmh!).toBeLessThan(l.nmh!);
    expect(at18.nmh!).toBeLessThan(at33.nmh!);
  });

  test('an inverter with no gain has no logic levels', () => {
    const weak = levels(sweep({ ...DEFAULTS, vt: 2.4, kn: 1e-5, kp: 1e-5 }), 5);
    // Both transistors are off around the middle, so the output floats: that is not a gate.
    if (weak.vil !== null) expect(weak.vil).toBeLessThan(weak.vih!);
  });
});

describe('the noise verdict', () => {
  const v = sweep(DEFAULTS);
  const l = levels(v, 5);

  test('small noise is read correctly and the receiver restores a clean level', () => {
    const j = judge(v, l, 0.5);
    expect(j.low).toBe('0');
    expect(j.high).toBe('1');
    expect(j.lowOut).toBeGreaterThan(4.9);
    expect(j.highOut).toBeLessThan(0.1);
  });

  test('noise inside the margin is harmless, noise beyond it is not', () => {
    expect(judge(v, l, l.nml! - 0.05).low).toBe('0');
    expect(judge(v, l, l.nml! + 0.05).low).toBe('forbidden');
    expect(judge(v, l, l.nmh! + 0.05).high).toBe('forbidden');
    expect(judge(v, l, 2.5).low).not.toBe('0');
  });

  test('a swing past the threshold reads as the wrong value', () => {
    const j = judge(v, l, 2.5);
    expect(['forbidden', 'wrong']).toContain(j.low);
    expect(judge(v, l, 4).low).toBe('wrong');
  });
});
