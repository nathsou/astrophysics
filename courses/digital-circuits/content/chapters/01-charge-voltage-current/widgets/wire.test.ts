import { describe, expect, test } from 'vitest';
import {
  C_LIGHT,
  E_CHARGE,
  V_THERMAL,
  WireSim,
  crossingTime,
  displayDriftRatio,
  driftSpeed,
  electronsPerSecond,
  formatLength,
  formatSpeed,
  sci,
  signalSpeed,
  supHtml,
} from './wire';

describe('the numbers in the text', () => {
  test('1 A in 1 mm² of copper drifts at 0.074 mm/s', () => {
    expect(driftSpeed(1, 1) * 1e3).toBeCloseTo(0.0735, 3);
  });
  test('household cable: 2.5 mm² at 1 A is 0.029 mm/s; 1.5 mm² is 0.049 mm/s', () => {
    expect(driftSpeed(1, 2.5) * 1e3).toBeCloseTo(0.0294, 3);
    expect(driftSpeed(1, 1.5) * 1e3).toBeCloseTo(0.049, 3);
  });
  test('drift is proportional to current and inversely to area', () => {
    expect(driftSpeed(3, 1) / driftSpeed(1, 1)).toBeCloseTo(3, 10);
    expect(driftSpeed(1, 4) / driftSpeed(1, 1)).toBeCloseTo(0.25, 10);
  });
  test('an hour at 1 A in 1 mm² moves an electron about 26 cm', () => {
    expect(driftSpeed(1, 1) * 3600).toBeCloseTo(0.2647, 3);
  });
  test('1 A is 6.24×10¹⁸ electrons per second', () => {
    expect(electronsPerSecond(1)).toBeCloseTo(1 / E_CHARGE, -5);
    expect(electronsPerSecond(1) / 1e18).toBeCloseTo(6.2415, 3);
    expect(electronsPerSecond(0.02) / 1e17).toBeCloseTo(1.248, 2);
  });
  test('the signal crosses a metre of cable in about 5 ns, ten orders of magnitude before the drift', () => {
    expect(signalSpeed()).toBeCloseTo(0.66 * C_LIGHT, 0);
    expect(crossingTime(1) * 1e9).toBeCloseTo(5.05, 1);
    expect(V_THERMAL / driftSpeed(1, 1)).toBeGreaterThan(1e9);
  });
  test('the picture keeps the true ratio, times the exaggeration, capped', () => {
    const real = displayDriftRatio(1, 1, 1);
    expect(real.ratio).toBeCloseTo(driftSpeed(1, 1) / V_THERMAL, 15);
    expect(real.capped).toBe(false);
    expect(displayDriftRatio(1, 1, 1e9).ratio).toBeCloseTo(0.63, 2);
    const big = displayDriftRatio(10, 0.1, 1e9);
    expect(big.capped).toBe(true);
    expect(big.ratio).toBe(2);
  });
});

describe('formatting', () => {
  test('sci uses superscripts', () => {
    expect(sci(6.2415e18)).toBe('6.2×10¹⁸');
    expect(sci(1.2e-3, 3)).toBe('1.20×10⁻³');
  });
  test('superscripts become <sup> elements', () => {
    expect(supHtml('6.2×10¹⁸ electrons')).toBe('6.2×10<sup>18</sup> electrons');
    expect(supHtml('1.6×10⁻¹⁹ C')).toBe('1.6×10<sup>−19</sup> C');
    expect(supHtml('no exponent')).toBe('no exponent');
  });
  test('speeds and lengths pick a sensible unit', () => {
    expect(formatSpeed(7.35e-5)).toBe('0.0735 mm/s');
    expect(formatSpeed(2.94e-5)).toBe('0.0294 mm/s');
    expect(formatSpeed(1.2e5)).toBe('1.2×10⁵ m/s');
    expect(formatLength(0.264)).toBe('26.4 cm');
    expect(formatLength(8.8e-4)).toBe('0.88 mm');
    expect(formatLength(3.3e-7)).toBe('0.33 µm');
  });
});

describe('the field front', () => {
  test('nothing happens before the switch is closed', () => {
    const s = new WireSim(400, 90, { seed: 3 });
    s.step(0.5, 50);
    expect(s.fieldAt(0)).toBe(false);
    expect(s.frontX()).toBeUndefined();
  });
  test('the front runs from the switch to the far end in `crossing` seconds', () => {
    const s = new WireSim(400, 90, { seed: 3, crossing: 2 });
    s.setSwitch(true);
    expect(s.frontX()).toBe(0);
    s.step(1, 0);
    expect(s.frontX()).toBeCloseTo(200, 3);
    expect(s.fieldAt(150)).toBe(true);
    expect(s.fieldAt(250)).toBe(false);
    s.step(1.05, 0);
    expect(s.frontX()).toBeUndefined();
    expect(s.fieldAt(399)).toBe(true);
  });
  test('opening the switch turns the field off from the switch outwards', () => {
    const s = new WireSim(400, 90, { seed: 3, crossing: 2 });
    s.setSwitch(true);
    s.step(3, 0);
    s.setSwitch(false);
    s.step(0.5, 0);
    expect(s.fieldAt(20)).toBe(false);
    expect(s.fieldAt(300)).toBe(true);
    s.step(2, 0);
    expect(s.fieldAt(399)).toBe(false);
  });
  test('closing twice records one event', () => {
    const s = new WireSim(400, 90);
    s.setSwitch(true);
    s.setSwitch(true);
    expect(s.events).toHaveLength(1);
  });
});

describe('the electrons', () => {
  test('the density is fixed by the size, and resizing keeps it', () => {
    const s = new WireSim(400, 90, { density: 1 / 400 });
    expect(s.count).toBe(90);
    s.resize(400, 180);
    expect(s.count).toBe(180);
    expect(s.x.length).toBe(180);
    s.resize(200, 90);
    expect(s.count).toBe(45);
    for (let i = 0; i < s.count; i++) expect(s.x[i]).toBeLessThanOrEqual(200);
  });
  test('electrons stay inside the wire and wrap round its ends', () => {
    const s = new WireSim(300, 80, { seed: 7 });
    s.setSwitch(true);
    for (let k = 0; k < 600; k++) s.step(1 / 60, 200);
    for (let i = 0; i < s.count; i++) {
      expect(s.x[i]).toBeGreaterThanOrEqual(0);
      expect(s.x[i]).toBeLessThanOrEqual(300);
      expect(s.y[i]).toBeGreaterThanOrEqual(s.radius);
      expect(s.y[i]).toBeLessThanOrEqual(80 - s.radius);
    }
    expect(s.count).toBe(Math.round(300 * 80 * s.density));
  });
  test('the jiggle averages to nothing, the drift to −driftPx', () => {
    const s = new WireSim(400, 120, { seed: 11, crossing: 1 });
    for (let k = 0; k < 120; k++) s.step(1 / 60, 40);
    expect(Math.abs(s.meanVx())).toBeLessThan(8);
    s.setSwitch(true);
    for (let k = 0; k < 240; k++) s.step(1 / 60, 40);
    expect(s.meanVx()).toBeLessThan(-30);
    expect(s.meanVx()).toBeGreaterThan(-50);
  });
  test('ahead of the front the electrons have not started to drift', () => {
    const s = new WireSim(600, 400, { seed: 5, crossing: 4 });
    s.setSwitch(true);
    for (let k = 0; k < 60; k++) s.step(1 / 60, 60); // front at 150 px
    const behind = s.meanVx((x) => x < 100);
    const ahead = s.meanVx((x) => x > 300);
    expect(behind).toBeLessThan(-15);
    expect(Math.abs(ahead)).toBeLessThan(25);
    expect(ahead - behind).toBeGreaterThan(30);
  });
  test('deterministic for a seed', () => {
    const a = new WireSim(300, 80, { seed: 2 });
    const b = new WireSim(300, 80, { seed: 2 });
    for (let k = 0; k < 50; k++) {
      a.step(1 / 60, 30);
      b.step(1 / 60, 30);
    }
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
  });
  test('the tagged electron leaves a bounded trail', () => {
    const s = new WireSim(300, 80, { seed: 2 });
    for (let k = 0; k < 500; k++) s.step(1 / 60, 30);
    expect(s.trail.length).toBeLessThanOrEqual(180);
    expect(s.trail.length % 2).toBe(0);
  });
});
