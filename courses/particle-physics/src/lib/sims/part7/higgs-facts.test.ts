/**
 * The numbers of Chapters 26, 29 and 30 that come from the library, recomputed: if the library or the text changes, this says so.
 */
import { describe, expect, test } from 'vitest';
import { higgsWidths, M_W, M_Z, G_F, alphaEM, SIN2W_EFF, runningMass } from '../../hep/sm/index.ts';
import { particle } from '../../hep/particles/index.ts';
import { V_EW_GEV, lambdaFromMass, hatDepth, yukawaCoupling } from '../../hep/fields/index.ts';
import { getProcess } from '../../hep/gen/index.ts';

describe('Chapter 26: the mechanism', () => {
  test('v, λ, μ, the depth of the hat', () => {
    expect(V_EW_GEV).toBeCloseTo(246.22, 2);
    expect(lambdaFromMass(125.2)).toBeCloseTo(0.1293, 3);
    expect(125.2 / Math.SQRT2).toBeCloseTo(88.53, 2);
    expect(hatDepth(125.2)).toBeCloseTo(1.188e8, -5);
    expect(Math.pow(hatDepth(125.2), 0.25)).toBeCloseTo(104.4, 1);
  });
  test('the W mass from g = e/sinθ and v: 79.9 GeV, 0.6 % below the measured value', () => {
    const e = Math.sqrt(4 * Math.PI * alphaEM(M_Z));
    const g = e / Math.sqrt(SIN2W_EFF);
    expect(g).toBeCloseTo(0.649, 3);
    expect((g * V_EW_GEV) / 2).toBeCloseTo(79.87, 1);
    expect(1 - (g * V_EW_GEV) / 2 / M_W).toBeCloseTo(0.0062, 3);
    expect(1 - (M_W / M_Z) ** 2).toBeCloseTo(0.2232, 4);
  });
  test('the Yukawa couplings and the weak range', () => {
    expect(yukawaCoupling(particle(6).mass)).toBeCloseTo(0.9912, 3);
    expect(yukawaCoupling(particle(11).mass)).toBeCloseTo(2.935e-6, 9);
    expect(particle(6).mass / particle(11).mass).toBeCloseTo(337711, -2);
    expect((0.1973269804 / M_W) * 1e-15).toBeCloseTo(2.455e-18, 21);
    expect(G_F / Math.SQRT2).toBeCloseTo(((2 * M_W) / V_EW_GEV) ** 2 / (8 * M_W ** 2), 12);
  });
  test('the Lee–Quigg–Thacker bound: 1.0 TeV, or 710 GeV for the stricter form', () => {
    const m = Math.sqrt((8 * Math.PI * Math.SQRT2) / (3 * G_F));
    expect(m).toBeCloseTo(1007.9, 0);
    expect(m / Math.SQRT2).toBeCloseTo(712.7, 0);
  });
  test('the valence quarks of the proton are about 1 % of its mass', () => {
    const q = 2 * particle(2).mass + particle(1).mass;
    expect(q / 0.93827).toBeCloseTo(0.0096, 3);
  });
});

describe('Chapter 30: decays', () => {
  const h = higgsWidths();
  const table: Record<string, number> = { bb: 0.582, WW: 0.214, gg: 0.0819, tautau: 0.0627, cc: 0.0289, ZZ: 0.0262, gammagamma: 0.00227, mumu: 0.00022 };
  test('the particle table holds the values quoted in the chapter', () => {
    const d = particle(25).decays!;
    const br = (a: number, b: number) => d.find((x) => x.products.length === 2 && x.products[0] === a && x.products[1] === b)!.br;
    expect(br(5, -5)).toBe(0.582);
    expect(br(24, -24)).toBe(0.214);
    expect(br(21, 21)).toBe(0.0819);
    expect(br(15, -15)).toBe(0.0627);
    expect(br(4, -4)).toBe(0.0289);
    expect(br(23, 23)).toBe(0.0262);
    expect(br(22, 22)).toBe(0.00227);
    expect(br(13, -13)).toBe(0.00022);
    expect(particle(25).width).toBe(0.0041);
  });
  test('leading order within 3 to 26 % of the table, except gg (0.60 of the table)', () => {
    for (const [k, t] of Object.entries(table)) {
      const r = (h.br as unknown as Record<string, number>)[k]! / t;
      if (k === 'gg') expect(r).toBeCloseTo(0.6, 1);
      else {
        expect(r).toBeGreaterThan(0.89);
        expect(r).toBeLessThan(1.27);
      }
    }
    expect(h.br.bb).toBeCloseTo(0.602, 3);
    expect(h.br.WW).toBeCloseTo(0.216, 3);
    expect(h.br.gammagamma).toBeCloseTo(0.00252, 5);
    expect(h.br.mumu).toBeCloseTo(0.000249, 6);
  });
  test('total width 3.69 MeV at LO, the lifetime and the ratio to the Z', () => {
    expect(h.total * 1e3).toBeCloseTo(3.69, 2);
    expect(6.582119569e-25 / 0.0041).toBeCloseTo(1.6e-22, 23);
    expect(6.582119569e-25 / 0.0041 / (6.582119569e-25 / 2.4955)).toBeGreaterThan(600);
    expect(6.582119569e-25 / 0.0041 / (6.582119569e-25 / 2.4955)).toBeLessThan(620);
  });
  test('μμ against ττ: the ratio of masses squared, 283 and the table says 285', () => {
    const r = (particle(15).mass / particle(13).mass) ** 2;
    expect(r).toBeCloseTo(282.8, 0);
    expect(0.0627 / 0.00022).toBeCloseTo(285, 0);
    expect(100 * 0.0627 * (particle(13).mass / particle(15).mass) ** 2).toBeCloseTo(0.02217, 4);
    // BR(ee) from the muon's, scaled by the masses squared
    expect(0.00022 * (particle(11).mass / particle(13).mass) ** 2).toBeCloseTo(5.1e-9, 10);
  });
  test('H → 4ℓ (e, μ) through ZZ*: 0.012 %', () => {
    const z = 0.03363 + 0.03366;
    expect(0.0262 * z * z).toBeCloseTo(1.19e-4, 6);
    expect(h.br.gammagamma).toBeLessThan(0.0026);
  });
  test('the running b mass at 125 GeV is about 3.0 GeV', () => {
    expect(runningMass(5, 125.2)).toBeCloseTo(3.0, 1);
  });
  test('the generator: gg → H at LO is 14 pb at 13 TeV; K = 3.4 brings the 8 TeV γγ to about 0.044 pb', () => {
    const p = getProcess('pp->H->gammagamma');
    expect(p.sigma(13000)).toBeCloseTo(0.032, 3);
    expect(p.sigma(8000)).toBeCloseTo(0.0130, 4);
    expect(p.sigma(8000) * 3.4).toBeCloseTo(0.0443, 4);
  });
});

describe('Chapter 28 and 27 numbers', () => {
  test('rates at 2 × 10³⁴: one Higgs per second, one H → γγ every 7 minutes, one H → 4ℓ every 2.3 hours', () => {
    const L = 2e34;
    const sigmaH = 50e-36; // cm²
    expect(sigmaH * L).toBeCloseTo(1, 6);
    expect(1 / (sigmaH * L * particle(25).decays!.find((d) => d.products.length === 2 && d.products[0] === 22 && d.products[1] === 22)!.br) / 60).toBeCloseTo(7.3, 1);
    expect(1 / (sigmaH * L * 1.2e-4) / 3600).toBeCloseTo(2.3, 1);
    expect(8e-26 * L).toBeCloseTo(1.6e9, -7);
    expect((8e-26 * L) / (sigmaH * L)).toBeCloseTo(1.6e9, -7);
  });
});
