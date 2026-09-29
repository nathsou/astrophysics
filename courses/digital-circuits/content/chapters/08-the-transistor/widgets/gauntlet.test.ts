import { describe, expect, test } from 'vitest';
import { STAGES, cobweb, errorCount, firstError, gaussian, rng, runGauntlet, runWord, stageFunction } from './gauntlet';
import { RTL, VCC, diodeVtc, fixedPoint, gainAt, gainBand, rtlVtc, steepest, sweepRtl, transfer } from './vtc';

describe('the measured transfer curves', () => {
  test('the RTL inverter inverts: 5 V for a low input, a few hundredths of a volt for a high one', () => {
    const t = rtlVtc();
    expect(transfer(t, 0)).toBeGreaterThan(4.1);
    expect(transfer(t, 0)).toBeLessThan(5.01);
    expect(transfer(t, 5)).toBeLessThan(0.15);
    expect(transfer(t, 5)).toBeGreaterThan(0);
  });

  test('it is monotonically falling, and switches near 0.9 V', () => {
    const t = rtlVtc();
    for (let i = 1; i < t.vout.length; i++) expect(t.vout[i]!).toBeLessThanOrEqual(t.vout[i - 1]! + 1e-9);
    const th = fixedPoint(t)!;
    expect(th).toBeGreaterThan(0.75);
    expect(th).toBeLessThan(1.05);
  });

  test('its gain in the middle is far steeper than −1 (that is regeneration), and flat at both ends', () => {
    const t = rtlVtc();
    const s = steepest(t);
    expect(s.gain).toBeLessThan(-8);
    expect(s.at).toBeGreaterThan(0.6);
    expect(s.at).toBeLessThan(1.0);
    expect(Math.abs(gainAt(t, 0))).toBeLessThan(0.05);
    expect(Math.abs(gainAt(t, 5))).toBeLessThan(0.05);
    const band = gainBand(t)!;
    expect(band.from).toBeGreaterThan(0.4);
    expect(band.to).toBeLessThan(1.2);
  });

  test('the transistor goes cut-off, active, saturation as the input rises', () => {
    const t = sweepRtl();
    const at = (v: number) => t.region![Math.round((v - t.vin[0]!) / 0.02)];
    expect(at(0)).toBe('cutoff');
    expect(at(0.8)).toBe('active');
    expect(at(3)).toBe('saturation');
  });

  test('the loaded high level is lower than the unloaded 5 V: the next stage’s base takes current', () => {
    // 1 kΩ pull-up, 4.7 kΩ base resistor, 0.75 V on the base: 5 − 1000 × (V − 0.75)/4700 = V.
    const expected = (VCC + (0.75 * RTL.rc) / RTL.rb) / (1 + RTL.rc / RTL.rb);
    expect(transfer(rtlVtc(), 0)).toBeCloseTo(expected, 1);
  });

  test('the diode stage loses about 0.65 V and has a gain just below 1', () => {
    const d = diodeVtc();
    expect(5 - transfer(d, 5)).toBeGreaterThan(0.55);
    expect(5 - transfer(d, 5)).toBeLessThan(0.8);
    const g = gainAt(d, 3);
    expect(g).toBeGreaterThan(0.9);
    expect(g).toBeLessThan(1);
    expect(transfer(d, 0)).toBeCloseTo(0, 6);
    // It can never output more than it is given, and never a negative voltage.
    for (let i = 0; i < d.vin.length; i++) {
      expect(d.vout[i]!).toBeLessThanOrEqual(Math.max(0, d.vin[i]!) + 1e-6);
      expect(d.vout[i]!).toBeGreaterThan(-1e-4);
    }
  });

  test('a chain of four diode stages, with noise off, matches Figure 7.6 (4.3 V, 3.6 V, 2.9 V, 2.3 V)', () => {
    const r = runGauntlet({ kind: 'diode', bit: 1, sigma: 0, stages: 4 });
    const want = [5, 4.29, 3.6, 2.94, 2.32];
    r.levels.forEach((v, i) => expect(Math.abs(v - want[i]!)).toBeLessThan(0.12));
  });
});

describe('the gauntlet', () => {
  test('with no noise a diode chain fades: a 1 is misread from the fifth stage, and gone by stage 8', () => {
    const r = runGauntlet({ kind: 'diode', bit: 1, sigma: 0 });
    expect(firstError(r)).toBeGreaterThanOrEqual(4);
    expect(firstError(r)).toBeLessThanOrEqual(5);
    expect(r.levels[8]!).toBeLessThan(1);
    expect(r.levels[STAGES]!).toBeLessThan(0.1);
  });

  test('with no noise an inverter chain is perfect: 4.2 V and 0.1 V alternate for ever', () => {
    const r = runGauntlet({ kind: 'inverter', bit: 1, sigma: 0 });
    expect(firstError(r)).toBeUndefined();
    expect(r.levels[1]!).toBeLessThan(0.2);
    expect(r.levels[2]!).toBeGreaterThan(4);
    expect(r.levels[STAGES]!).toBeGreaterThan(4);
    // The last stage is stage 20: an even number of inversions, so the 1 arrives as a 1.
    expect(r.expected[STAGES]).toBe(1);
  });

  test('inverters restore a badly degraded 1: 2.0 V in, clean levels out after a stage or two', () => {
    const r = runGauntlet({ kind: 'inverter', bit: 1, high: 2.0, sigma: 0 });
    expect(r.read[1]).toBe(0);
    expect(r.levels[1]!).toBeLessThan(0.3);
    // Stage 1 inverts to a clean 0, stage 2 to a clean 1 (4.2 V: the loaded high level).
    expect(r.levels[2]!).toBeGreaterThan(4);
    expect(r.read[2]).toBe(1);
    // A diode stage would have made it 1.4 V, and then a 0.8 V.
    const d = runGauntlet({ kind: 'diode', bit: 1, high: 2.0, sigma: 0 });
    expect(d.levels[1]!).toBeLessThan(1.5);
  });

  test('with 0.2 V of noise per stage, inverters never misread and diodes always lose the 1s', () => {
    expect(errorCount({ kind: 'inverter', sigma: 0.2, seed: 3 })).toBe(0);
    // Half the trial bits are 1s, and every one is lost; the 0s arrive (a dead line reads as a 0).
    expect(errorCount({ kind: 'diode', sigma: 0.2, seed: 3 })).toBe(200);
  });

  test('a plain wire keeps the signal but lets the noise pile up as the square root of the number of stages', () => {
    const spread = (n: number) => {
      const xs: number[] = [];
      for (let t = 0; t < 600; t++) xs.push(runGauntlet({ kind: 'wire', bit: 1, high: 2.5, sigma: 0.1, seed: t + 1, stages: n }).levels[n]!);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    };
    const s4 = spread(4);
    const s16 = spread(16);
    expect(s4).toBeGreaterThan(0.15);
    expect(s4).toBeLessThan(0.25);
    expect(s16 / s4).toBeGreaterThan(1.7);
    expect(s16 / s4).toBeLessThan(2.4);
  });

  test('after inverters the noise is only the last stage’s own; after a wire it is the sum of all twenty', () => {
    const spread = (kind: 'wire' | 'inverter') => {
      const xs: number[] = [];
      for (let t = 0; t < 600; t++) xs.push(runGauntlet({ kind, bit: 1, high: 2.5, sigma: 0.1, seed: t + 1 }).levels[STAGES]!);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    };
    expect(spread('inverter')).toBeLessThan(0.13);
    expect(spread('wire')).toBeGreaterThan(0.38);
  });

  test('a word: every bit of it passes the inverters and 0.2 V of noise, and none of the 1s survives the diodes', () => {
    const bits = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0] as (0 | 1)[];
    const inv = runWord({ kind: 'inverter', sigma: 0.2, seed: 5 }, bits);
    expect(inv.errors).toBe(0);
    expect(inv.received).toEqual(bits);
    const dio = runWord({ kind: 'diode', sigma: 0.2, seed: 5 }, bits);
    // Every 1 is lost; every 0 arrives (a dead line is a 0).
    expect(dio.errors).toBe(bits.filter((b) => b === 1).length);
  });

  test('so much noise that even inverters fail (the noise margin is finite)', () => {
    expect(errorCount({ kind: 'inverter', sigma: 1.6, seed: 2 })).toBeGreaterThan(20);
  });

  test('the cobweb of an inverter settles on two levels; that of a diode chain slides to zero', () => {
    const c = cobweb('inverter', 3);
    const last = c[c.length - 1]!;
    expect(last[0]).toBeGreaterThan(4);
    const d = cobweb('diode', 5);
    expect(d[d.length - 1]![0]).toBeLessThan(0.1);
    expect(stageFunction('wire')(3.3)).toBe(3.3);
  });

  test('it is deterministic for a seed, and different seeds differ', () => {
    const a = runGauntlet({ kind: 'wire', bit: 1, sigma: 0.3, seed: 7 });
    const b = runGauntlet({ kind: 'wire', bit: 1, sigma: 0.3, seed: 7 });
    const c = runGauntlet({ kind: 'wire', bit: 1, sigma: 0.3, seed: 8 });
    expect(a.levels).toEqual(b.levels);
    expect(a.levels).not.toEqual(c.levels);
  });

  test('the Gaussian generator has mean 0 and standard deviation 1', () => {
    const g = gaussian(rng(1));
    const xs = Array.from({ length: 20000 }, g);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(sd).toBeGreaterThan(0.97);
    expect(sd).toBeLessThan(1.03);
  });
});

describe('noise margins (a preview of Chapter 10)', () => {
  test('the RTL inverter’s margins by the unity-gain definition: small for a 0, large for a 1', async () => {
    const { noiseMargins } = await import('./vtc');
    const m = noiseMargins(rtlVtc())!;
    expect(m.vil).toBeGreaterThan(0.4);
    expect(m.vil).toBeLessThan(0.75);
    expect(m.vih).toBeGreaterThan(0.85);
    expect(m.vih).toBeLessThan(1.2);
    expect(m.vih).toBeGreaterThan(m.vil);
    expect(m.nml).toBeGreaterThan(0.3);
    expect(m.nml).toBeLessThan(0.7);
    expect(m.nmh).toBeGreaterThan(2.5);
    // The diode stage never reaches a gain of −1, so it has no noise margin at all.
    expect(noiseMargins(diodeVtc())).toBeUndefined();
  });
});

describe('what length does to each kind of chain (the difference gain makes)', () => {
  test('with 0.2 V of noise per stage a wire loses bits as the chain grows, while inverters hardly do', () => {
    const wire = (stages: number) => errorCount({ kind: 'wire', sigma: 0.2, seed: 1, stages });
    const inv = (stages: number) => errorCount({ kind: 'inverter', sigma: 0.2, seed: 1, stages });
    expect(wire(20)).toBeLessThan(10);
    expect(wire(100)).toBeGreaterThan(50);
    expect(wire(500)).toBeGreaterThan(180);
    expect(inv(20)).toBe(0);
    expect(inv(100)).toBeLessThan(10);
    expect(inv(500)).toBeLessThan(15);
  });
  test('beyond the noise margin an inverter chain fails too: restoration has a limit (about 0.5 V for a 0)', () => {
    expect(errorCount({ kind: 'inverter', sigma: 0.5, seed: 1 })).toBeGreaterThan(80);
  });
});
