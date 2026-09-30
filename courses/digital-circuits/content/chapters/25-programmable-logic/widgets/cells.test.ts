import { describe, expect, test } from 'vitest';
import { ANTIFUSE, Antifuse, FUSE, FloatingGateCell, blowingCurrent, blows, fusePulse, steadyTemperature, timeToBlow } from './cells';

describe('a fuse', () => {
  test('a read current of 1 mA warms it by a few kelvin', () => {
    expect(steadyTemperature(0.001) - FUSE.ambient).toBeCloseTo(6, 5);
  });

  test('it takes about 15 mA, however long the pulse, to melt the link', () => {
    expect(blowingCurrent()).toBeGreaterThan(0.0148);
    expect(blowingCurrent()).toBeLessThan(0.0154);
    expect(timeToBlow(0.014)).toBe(Infinity);
    expect(blows(0.014, 100e-6)).toBe(false);
    expect(blows(0.016, 100e-6)).toBe(true);
  });

  test('20 mA blows it in under 2 µs: the pulse must be long enough as well as strong enough', () => {
    expect(timeToBlow(0.02)).toBeGreaterThan(1.6e-6);
    expect(timeToBlow(0.02)).toBeLessThan(1.8e-6);
    expect(blows(0.02, 0.5e-6)).toBe(false);
    expect(blows(0.02, 2.5e-6)).toBe(true);
  });

  test('once blown the current stops and the temperature falls away', () => {
    const s = fusePulse(0.03, 10e-6);
    const i = s.findIndex((x) => x.blown);
    expect(i).toBeGreaterThan(0);
    expect(s[i]!.temperature).toBe(FUSE.melt);
    expect(s[i + 5]!.current).toBe(0);
    expect(s[s.length - 1]!.temperature).toBeLessThan(FUSE.melt - 200);
    // The simulated time to blow agrees with the closed form.
    expect(s[i]!.t).toBeCloseTo(timeToBlow(0.03), 6);
  });

  test('a weak pulse leaves the link intact and cools down', () => {
    const s = fusePulse(0.01, 20e-6);
    expect(s.some((x) => x.blown)).toBe(false);
    expect(Math.max(...s.map((x) => x.temperature))).toBeLessThan(FUSE.ambient + 700);
  });
});

describe('an antifuse', () => {
  test('starts open, breaks down at its breakdown voltage and stays closed', () => {
    const a = new Antifuse();
    expect(a.conducts()).toBe(false);
    expect(a.resistance).toBe(ANTIFUSE.open);
    expect(a.apply(5)).toBe(false);
    expect(a.apply(9.9)).toBe(false);
    expect(a.apply(12)).toBe(true);
    expect(a.resistance).toBe(300);
    expect(a.apply(0)).toBe(true);
  });
});

describe('a floating-gate cell', () => {
  test('erased it conducts at the read voltage and reads 1; programmed it does not and reads 0', () => {
    const c = new FloatingGateCell();
    expect(c.read()).toBe(1);
    expect(c.vt).toBe(1);
    c.program(6);
    expect(c.read()).toBe(0);
    expect(c.vt).toBeGreaterThan(6.5);
    expect(c.readCurrent()).toBe(0);
  });

  test('one pulse is not enough: the threshold climbs with diminishing returns', () => {
    const c = new FloatingGateCell();
    const vt: number[] = [];
    for (let i = 0; i < 6; i++) {
      c.program();
      vt.push(c.vt);
    }
    expect(c.programPulses).toBe(6);
    for (let i = 1; i < vt.length; i++) {
      expect(vt[i]!).toBeGreaterThan(vt[i - 1]!);
      if (i > 1) expect(vt[i]! - vt[i - 1]!).toBeLessThan(vt[i - 1]! - vt[i - 2]!);
    }
    // After two pulses the cell still reads 1; three are needed to pass the read voltage of 5 V.
    const d = new FloatingGateCell();
    d.program(2);
    expect(d.read()).toBe(1);
    d.program(1);
    expect(d.read()).toBe(0);
  });

  test('UV light erases it exponentially: it reads 1 after two minutes, but a proper erase takes 20', () => {
    const c = new FloatingGateCell();
    c.program(10);
    expect(c.read()).toBe(0);
    c.uvErase(1);
    expect(c.read()).toBe(0);
    c.uvErase(1.5);
    // The cell now reads erased, yet more than half the charge is still there and the margin is thin.
    expect(c.read()).toBe(1);
    expect(c.charge).toBeGreaterThan(0.5);
    c.uvErase(17.5);
    expect(c.charge).toBeLessThan(0.02);
    expect(c.margin).toBeGreaterThan(3.8);
  });

  test('tunnelling erases in a few pulses and counts a cycle', () => {
    const c = new FloatingGateCell();
    c.program(8);
    c.tunnelErase();
    expect(c.read()).toBe(1);
    expect(c.cycles).toBe(1);
    c.program(8);
    c.tunnelErase(2);
    expect(c.cycles).toBe(2);
    expect(c.charge).toBeLessThan(0.01);
  });

  test('the margin is negative when programmed', () => {
    const c = new FloatingGateCell();
    expect(c.margin).toBe(4);
    c.program(20);
    expect(c.margin).toBeLessThan(-1.9);
  });
});
