import { describe, expect, test } from 'vitest';
import { getProcess } from '../../hep/gen/index.ts';
import { RATE_PROCESSES, integratedPb, rateHz } from './rates.ts';

describe('the stored cross-sections are what hep/gen computes', () => {
  for (const [id, name] of [['z', 'pp->Z->mumu'], ['w', 'pp->W->munu'], ['tt', 'pp->ttbar']] as const) {
    test(`${name} at 13 TeV`, () => {
      const stored = RATE_PROCESSES.find((p) => p.id === id)!.sigmaPb;
      expect(getProcess(name).sigma(13000) / stored).toBeCloseTo(1, 3);
    });
  }
});

describe('rates', () => {
  test('1 pb at L = 10³⁴ cm⁻² s⁻¹ is 0.01 Hz; the Z → μμ rate at design luminosity is about 16 Hz', () => {
    expect(rateHz(1, 1e34)).toBeCloseTo(0.01, 12);
    const z = RATE_PROCESSES.find((p) => p.id === 'z')!;
    expect(rateHz(z.sigmaPb, 1e34)).toBeCloseTo(15.87, 2);
    expect(rateHz(z.sigmaPb, 2e34)).toBeCloseTo(31.74, 2);
  });
  test('inelastic collisions: 80 mb at 10³⁴ is 8 × 10⁸ per second', () => {
    const p = RATE_PROCESSES.find((x) => x.id === 'inel')!;
    expect(rateHz(p.sigmaPb, 1e34)).toBeCloseTo(8e8, -6);
  });
  test('integrated luminosity: 10³⁴ cm⁻² s⁻¹ for a day is 0.864 fb⁻¹', () => {
    expect(integratedPb(1e34, 86400)).toBeCloseTo(864, 6);
  });
});
