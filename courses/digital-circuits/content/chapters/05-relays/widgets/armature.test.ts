import { describe, expect, test } from 'vitest';
import { Armature, armatureAngle } from './armature';

describe('Armature', () => {
  test('takes one operate time to travel the whole way', () => {
    const a = new Armature();
    for (let i = 0; i < 50; i++) a.update(0.0001, true, 0.005);
    expect(a.position).toBeCloseTo(1, 9);
    for (let i = 0; i < 25; i++) a.update(0.0001, false, 0.005);
    expect(a.position).toBeCloseTo(0.5, 9);
  });
  test('halfway there it can turn round', () => {
    const a = new Armature();
    a.update(0.0025, true, 0.005);
    expect(a.position).toBeCloseTo(0.5, 9);
    a.update(0.001, false, 0.005);
    expect(a.position).toBeCloseTo(0.3, 9);
  });
  test('never leaves 0..1', () => {
    const a = new Armature();
    a.update(10, true, 0.005);
    expect(a.position).toBe(1);
    a.update(10, false, 0.005);
    expect(a.position).toBe(0);
  });
  test('angle: tilted when released, flat on the core', () => {
    expect(armatureAngle(0)).toBeLessThan(0);
    expect(armatureAngle(1)).toBe(0);
    expect(armatureAngle(0.5)).toBeCloseTo(armatureAngle(0) / 2, 9);
  });
});
