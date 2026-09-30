import { describe, expect, test } from 'vitest';
import { runSupply } from './supply';

describe('bench supply', () => {
  test('constant voltage: a 1 kΩ load at 5 V draws 5 mA and the CC light is off', () => {
    const o = runSupply('resistor', 5, 0.5);
    expect(o.volts).toBeCloseTo(5, 3);
    expect(o.amps).toBeCloseTo(5e-3, 5);
    expect(o.cc).toBe(false);
    expect(o.burned).toBe(false);
  });

  test('constant current: with a 1 mA limit the same load sits at 1 V and CC lights', () => {
    const o = runSupply('resistor', 5, 1e-3);
    expect(o.cc).toBe(true);
    expect(o.amps).toBeCloseTo(1e-3, 6);
    expect(o.volts).toBeCloseTo(1, 3);
  });

  test('an LED with no resistor survives a 20 mA limit but burns at 500 mA', () => {
    const safe = runSupply('led', 5, 0.02);
    expect(safe.cc).toBe(true);
    expect(safe.amps).toBeCloseTo(0.02, 4);
    expect(safe.volts).toBeGreaterThan(1.7);
    expect(safe.volts).toBeLessThan(2.2);
    expect(safe.burned).toBe(false);
    expect(safe.brightness!).toBeGreaterThan(0.5);
    const dead = runSupply('led', 5, 0.5);
    expect(dead.burned).toBe(true);
    expect(dead.messages.join(' ')).toMatch(/burned/);
    expect(dead.brightness).toBe(0);
  });

  test('an LED with its resistor needs no limit', () => {
    const o = runSupply('led-resistor', 5, 0.5);
    expect(o.cc).toBe(false);
    expect(o.burned).toBe(false);
    expect(o.amps).toBeGreaterThan(0.008);
    expect(o.amps).toBeLessThan(0.012);
  });

  test('a short circuit: the limit caps the current and the voltage collapses', () => {
    const o = runSupply('short', 5, 0.1);
    expect(o.cc).toBe(true);
    expect(o.amps).toBeCloseTo(0.1, 4);
    expect(o.volts).toBeLessThan(0.01);
  });

  test('nothing connected: the set voltage, no current', () => {
    const o = runSupply('resistor', 7, 0.5, false);
    expect(o.volts).toBeCloseTo(7, 3);
    expect(Math.abs(o.amps)).toBeLessThan(1e-9);
  });
});
