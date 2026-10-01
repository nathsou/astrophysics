import { expect, test } from 'vitest';
import { bhabhaParts } from './shapes.ts';
import { bhabhaDiffXsec, ee2mumuDiffXsec } from '../../hep/gen/index.ts';
import { ALPHA_0 } from '../../hep/sm/index.ts';

test('Bhabha pieces add up to the library formula; the s-channel piece is e⁺e⁻ → μ⁺μ⁻', () => {
  const s = 49;
  const unit = (Math.PI * ALPHA_0 ** 2) / s;
  for (const c of [-0.9, -0.3, 0, 0.6, 0.9]) {
    const p = bhabhaParts(c);
    expect(p.total * unit).toBeCloseTo(bhabhaDiffXsec(s, c), 14);
    expect(p.s * unit).toBeCloseTo(ee2mumuDiffXsec(s, c), 14);
    expect(p.s).toBeCloseTo((1 + c * c) / 2, 14);
  }
});
