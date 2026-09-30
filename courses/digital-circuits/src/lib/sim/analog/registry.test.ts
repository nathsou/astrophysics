import { describe, expect, test } from 'vitest';
import { analogModelTypes, getAnalogModel, registerAnalogModel } from './models';
import type { AnalogModelFactory } from './device';

const model = (): AnalogModelFactory => () => ({ stamp() {}, current: () => 0, state: () => ({}), setParam() {}, reset() {} });

describe('model registry', () => {
  test('registering a type again from the same module replaces it (hot reload evaluates a module twice)', () => {
    const first = model();
    const second = model();
    registerAnalogModel('test-part', first, '/src/models/x.ts');
    expect(() => registerAnalogModel('test-part', second, '/src/models/x.ts')).not.toThrow();
    expect(getAnalogModel('test-part')).toBe(second);
    expect(analogModelTypes().filter((t) => t === 'test-part')).toHaveLength(1);
  });

  test('two different modules claiming one type is still an error', () => {
    registerAnalogModel('test-part-2', model(), '/src/models/a.ts');
    expect(() => registerAnalogModel('test-part-2', model(), '/src/models/b.ts')).toThrow(/duplicate model for "test-part-2"/);
  });

  test('the caller is found from the stack: importing and re-registering a built-in type from here is an error, from the same module is not', () => {
    // This file is not the module that registered "resistor".
    expect(() => registerAnalogModel('resistor', model())).toThrow(/duplicate model/);
    // A second registration by the same (unknown or identical) owner replaces.
    registerAnalogModel('test-part-3', model());
    expect(() => registerAnalogModel('test-part-3', model())).not.toThrow();
  });

  test('every built-in type is registered', () => {
    for (const t of ['resistor', 'capacitor', 'led', 'nmos', 'relay', 'voltmeter', 'rail']) expect(getAnalogModel(t)).toBeTypeOf('function');
  });
});
