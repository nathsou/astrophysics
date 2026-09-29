import { describe, expect, test } from 'vitest';
import {
  BANDGAP_SI,
  BIAS_MAX,
  BIAS_MIN,
  DECADE_VOLTS,
  DOPING_DEFAULT,
  DOPING_MAX,
  DOPING_MIN,
  PnSim,
  VT,
  builtInVoltage,
  carrierCount,
  crossingProbability,
  depletionPx,
  depletionSplit,
  depletionWidth,
  diodeCurrent,
  dopingRatio,
  formatCurrent,
  junctionVoltage,
  saturationCurrent,
} from './pn';

describe('device physics', () => {
  test('thermal voltage at 300 K is 25.85 mV, and a decade of current is 59.5 mV', () => {
    expect(VT).toBeCloseTo(0.02585, 4);
    expect(DECADE_VOLTS).toBeCloseTo(0.0595, 3);
  });

  test('the built-in voltage of silicon doped 10^16 on both sides is about 0.7 V', () => {
    expect(builtInVoltage(1e16)).toBeGreaterThan(0.7);
    expect(builtInVoltage(1e16)).toBeLessThan(0.72);
    expect(builtInVoltage(1e15)).toBeCloseTo(0.595, 2);
    expect(builtInVoltage(1e18)).toBeCloseTo(0.952, 2);
    // Always below the bandgap: no junction can have a built-in voltage of more than 1.12 V.
    expect(builtInVoltage(DOPING_MAX)).toBeLessThan(BANDGAP_SI);
  });

  test('the depletion region is about 0.43 µm wide at zero bias, and grows as the square root of Vbi − V', () => {
    const w0 = depletionWidth(0, DOPING_DEFAULT);
    expect(w0).toBeGreaterThan(0.41);
    expect(w0).toBeLessThan(0.45);
    const vbi = builtInVoltage(DOPING_DEFAULT);
    expect(depletionWidth(-5, DOPING_DEFAULT) / w0).toBeCloseTo(Math.sqrt((vbi + 5) / vbi), 6);
    expect(depletionWidth(-2, DOPING_DEFAULT)).toBeGreaterThan(w0);
    expect(depletionWidth(0.5, DOPING_DEFAULT)).toBeLessThan(w0);
  });

  test('the width shrinks monotonically with forward bias, and stays positive', () => {
    let last = Infinity;
    for (let v = BIAS_MIN; v <= BIAS_MAX; v += 0.05) {
      const w = depletionWidth(v, DOPING_DEFAULT);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(last + 1e-12);
      last = w;
    }
  });

  test('heavier doping makes a thinner depletion region and a higher built-in voltage', () => {
    expect(depletionWidth(0, DOPING_MAX)).toBeLessThan(depletionWidth(0, DOPING_MIN));
    expect(builtInVoltage(DOPING_MAX)).toBeGreaterThan(builtInVoltage(DOPING_MIN));
  });

  test('a lighter-doped side takes more of the depletion region', () => {
    const { p, n } = depletionSplit(1, 1e17, 1e15);
    expect(n).toBeCloseTo(1e17 / (1e17 + 1e15), 6);
    expect(p + n).toBeCloseTo(1, 9);
    expect(n).toBeGreaterThan(p);
  });

  test('no current at zero volts', () => {
    expect(diodeCurrent(0)).toBe(0);
  });

  test('forward: the current grows ×10 for every 60 mV, between 10 µA and 10 mA', () => {
    const at = (v: number) => diodeCurrent(v);
    for (const v of [0.45, 0.5, 0.55]) {
      const ratio = at(v + DECADE_VOLTS) / at(v);
      expect(ratio).toBeGreaterThan(9.5);
      expect(ratio).toBeLessThan(10.5);
    }
    // Close to the textbook numbers: 0.6 V gives a fraction of a milliamp, 0.7 V several milliamps.
    expect(at(0.6)).toBeGreaterThan(1e-4);
    expect(at(0.6)).toBeLessThan(1e-3);
    expect(at(0.7)).toBeGreaterThan(3e-3);
    expect(at(0.7)).toBeLessThan(1e-2);
  });

  test('forward: the current is monotonic, and the series resistance bends it towards a straight line', () => {
    let last = -Infinity;
    for (let v = -5; v <= 1; v += 0.01) {
      const i = diodeCurrent(v);
      expect(i).toBeGreaterThanOrEqual(last);
      last = i;
    }
    // At 1 V the junction takes only part of the voltage.
    expect(junctionVoltage(1)).toBeLessThan(0.85);
    expect(junctionVoltage(1)).toBeGreaterThan(0.7);
    expect(diodeCurrent(1)).toBeLessThan(0.5);
  });

  test('reverse: the current is a tiny constant leakage that creeps up with the width of the region', () => {
    const i1 = diodeCurrent(-1);
    const i5 = diodeCurrent(-5);
    expect(i1).toBeLessThan(0);
    expect(Math.abs(i1)).toBeLessThan(1e-10);
    expect(Math.abs(i5)).toBeGreaterThan(Math.abs(i1));
    expect(Math.abs(i5)).toBeLessThan(1e-10);
    // A million times smaller than the forward current at 0.7 V.
    expect(diodeCurrent(0.7) / Math.abs(i5)).toBeGreaterThan(1e8);
  });

  test('doping moves the knee: a lightly doped junction conducts at a lower voltage', () => {
    expect(saturationCurrent(DOPING_MAX)).toBeLessThan(saturationCurrent(DOPING_MIN));
    expect(diodeCurrent(0.5, DOPING_MIN)).toBeGreaterThan(diodeCurrent(0.5, DOPING_MAX) * 100);
  });

  test('one dopant atom in a few million silicon atoms', () => {
    expect(dopingRatio(1e16)).toBe('1 in 5 million');
    expect(dopingRatio(1e15)).toBe('1 in 50 million');
    expect(dopingRatio(1e18)).toBe('1 in 50 thousand');
  });

  test('currents are formatted with an SI prefix', () => {
    expect(formatCurrent(5.8e-3)).toBe('5.80 mA');
    expect(formatCurrent(-1.2e-11)).toBe('−12.0 pA');
    expect(formatCurrent(0.25)).toBe('250 mA');
    expect(formatCurrent(0)).toBe('0 A');
  });
});

describe('the picture', () => {
  test('the region is drawn wider in reverse bias and nearly gone in forward bias', () => {
    const wide = depletionPx(depletionWidth(-5, DOPING_DEFAULT));
    const mid = depletionPx(depletionWidth(0, DOPING_DEFAULT));
    const thin = depletionPx(depletionWidth(0.7, DOPING_DEFAULT));
    expect(wide).toBeGreaterThan(2 * mid);
    expect(mid).toBeGreaterThan(2 * thin);
    expect(thin).toBeLessThan(15);
  });

  test('carriers cross more and more easily as the forward voltage rises, and never in reverse', () => {
    let last = 0;
    for (const v of [-5, -1, 0, 0.3, 0.5, 0.6, 0.7]) {
      const p = crossingProbability(v, DOPING_DEFAULT);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(crossingProbability(-1, DOPING_DEFAULT)).toBeLessThan(1e-6);
    expect(crossingProbability(0.8, DOPING_DEFAULT)).toBeLessThanOrEqual(0.5);
  });

  test('more doping, more carriers', () => {
    expect(carrierCount(DOPING_MAX, 640)).toBeGreaterThan(carrierCount(DOPING_DEFAULT, 640));
    expect(carrierCount(DOPING_DEFAULT, 640)).toBeGreaterThan(carrierCount(DOPING_MIN, 640));
    expect(carrierCount(DOPING_DEFAULT, 320)).toBeCloseTo(carrierCount(DOPING_DEFAULT, 640) / 2, -1);
  });

  const run = (sim: PnSim, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) sim.step(1 / 60);
  };

  test('with forward bias the carriers cross, recombine and flash; nothing crosses at reverse bias', () => {
    const fwd = new PnSim(640, 170, 7);
    fwd.setBias(0.7);
    run(fwd, 6);
    expect(fwd.crossings).toBeGreaterThan(20);
    expect(fwd.recombinations).toBeGreaterThan(5);

    const rev = new PnSim(640, 170, 7);
    rev.setBias(-3);
    run(rev, 6);
    expect(rev.crossings).toBe(0);
    expect(rev.recombinations).toBe(0);
    // Only the thermally generated carriers get through: a few per second at most.
    expect(rev.generated).toBeGreaterThan(0);
    expect(rev.generated).toBeLessThan(40);
  });

  test('crossing rates rise steeply with the forward voltage', () => {
    const counts = [0.3, 0.5, 0.7].map((v) => {
      const s = new PnSim(640, 170, 3);
      s.setBias(v);
      run(s, 8);
      return s.crossings;
    });
    expect(counts[0]).toBeLessThan(counts[1]!);
    expect(counts[1]).toBeLessThan(counts[2]!);
  });

  test('the number of majority carriers stays where the doping puts it, and everything stays on the canvas', () => {
    const sim = new PnSim(640, 170, 11);
    sim.setBias(0.65);
    run(sim, 10);
    const target = carrierCount(sim.doping, 640);
    expect(Math.abs(sim.majorityCount('hole') - target)).toBeLessThanOrEqual(3);
    expect(Math.abs(sim.majorityCount('electron') - target)).toBeLessThanOrEqual(3);
    for (const c of sim.carriers) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(640);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(170);
    }
  });

  test('majority carriers keep out of the depletion region', () => {
    const sim = new PnSim(640, 170, 5);
    for (const v of [-5, -2, 0, 0.5]) {
      sim.setBias(v);
      run(sim, 1);
      for (const c of sim.carriers) {
        if (c.mode !== 'major') continue;
        if (c.kind === 'hole') expect(c.x).toBeLessThanOrEqual(sim.left + 1e-6);
        else expect(c.x).toBeGreaterThanOrEqual(sim.right - 1e-6);
      }
    }
  });

  test('changing the doping changes the population and the region', () => {
    const sim = new PnSim(640, 170, 2);
    const before = sim.majorityCount('hole');
    const w0 = sim.right - sim.left;
    sim.setDoping(DOPING_MAX);
    run(sim, 2);
    expect(sim.majorityCount('hole')).toBeGreaterThan(before);
    expect(sim.right - sim.left).toBeLessThan(w0);
  });

  test('it is deterministic for a seed', () => {
    const a = new PnSim(640, 170, 9);
    const b = new PnSim(640, 170, 9);
    for (const s of [a, b]) {
      s.setBias(0.6);
      run(s, 3);
    }
    expect(a.crossings).toBe(b.crossings);
    expect(a.carriers.map((c) => c.x.toFixed(6))).toEqual(b.carriers.map((c) => c.x.toFixed(6)));
  });
});
