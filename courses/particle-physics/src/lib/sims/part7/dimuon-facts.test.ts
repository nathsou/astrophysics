/**
 * The facts about the real dimuon sample that Chapter 27 states, recomputed from static/data/dimuon.f32. If the file or the text changes, this test says so.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { dimuonMasses, parseDimuon } from '../../hep/data/index.ts';

const file = path.resolve(import.meta.dirname, '../../../../static/data/dimuon.f32');
const buf = readFileSync(file);
const d = parseDimuon(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const m = dimuonMasses(d);
const n = d.n;
const soft = new Float64Array(n), hard = new Float64Array(n), dphi = new Float64Array(n), eta1 = new Float64Array(n), eta2 = new Float64Array(n), dEta = new Float64Array(n), mApprox = new Float64Array(n);
const etaOf = (p: { px: number; py: number; pz: number }) => Math.asinh(p.pz / Math.hypot(p.px, p.py));
for (let i = 0; i < n; i++) {
  const a = d.mu1(i), b = d.mu2(i);
  const pa = Math.hypot(a.px, a.py), pb = Math.hypot(b.px, b.py);
  soft[i] = Math.min(pa, pb);
  hard[i] = Math.max(pa, pb);
  let dp = Math.abs(Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px));
  if (dp > Math.PI) dp = 2 * Math.PI - dp;
  dphi[i] = dp;
  eta1[i] = etaOf(a);
  eta2[i] = etaOf(b);
  dEta[i] = eta1[i]! - eta2[i]!;
  // massless pair in collider variables: m² = 2 pT1 pT2 (cosh Δη − cos Δφ)
  mApprox[i] = Math.sqrt(Math.max(0, 2 * pa * pb * (Math.cosh(dEta[i]!) - Math.cos(dp))));
}
const count = (f: (i: number) => boolean) => {
  let c = 0;
  for (let i = 0; i < n; i++) if (f(i)) c++;
  return c;
};
const binCount = (v: Float64Array, lo: number, hi: number) => count((i) => v[i]! >= lo && v[i]! < hi);

describe('the dimuon sample, as Chapter 27 describes it', () => {
  test('100,000 opposite-sign pairs; every muon has |η| < 2.4', () => {
    expect(n).toBe(100000);
    let max = 0;
    for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(eta1[i]!), Math.abs(eta2[i]!));
    expect(max).toBeLessThan(2.4);
    expect(max).toBeGreaterThan(2.399);
  });

  test('the softer muon pT distribution has steps at 3, 4, 6 and 8 GeV, the harder one at 13 GeV', () => {
    const step = (v: Float64Array, x: number) => binCount(v, x, x + 0.25) / binCount(v, x - 0.25, x);
    expect(step(soft, 3)).toBeGreaterThan(1.8);
    expect(step(soft, 4)).toBeGreaterThan(2.8);
    expect(step(soft, 6)).toBeGreaterThan(1.6);
    expect(step(soft, 8)).toBeGreaterThan(1.15);
    expect(step(hard, 13)).toBeGreaterThan(1.35);
    // and there is no step at 5 or 7 GeV, where a smooth falling spectrum continues (ratio below 1)
    expect(step(soft, 5)).toBeLessThan(1);
    expect(step(soft, 7)).toBeLessThan(1.05);
  });

  test('the hump between 8 and 20 GeV: 47,363 pairs, mostly two soft muons back to back', () => {
    const hump = (i: number) => m[i]! >= 8 && m[i]! < 20;
    const total = count(hump);
    expect(total).toBe(47363);
    expect(count((i) => hump(i) && soft[i]! >= 4) / total).toBeCloseTo(0.886, 2);
    expect(count((i) => hump(i) && soft[i]! >= 6) / total).toBeCloseTo(0.275, 2);
    expect(count((i) => hump(i) && soft[i]! >= 8) / total).toBeCloseTo(0.063, 2);
    expect(count((i) => hump(i) && hard[i]! < 10) / total).toBeCloseTo(0.881, 2);
    expect(count((i) => hump(i) && dphi[i]! > Math.PI / 2) / total).toBeCloseTo(0.891, 2);
    expect(count((i) => hump(i) && dphi[i]! > 0.9 * Math.PI) / total).toBeGreaterThan(0.6);
  });

  test('pairs with both muons between 4 and 6 GeV are 88 % back to back, and their mass starts at about 8 GeV', () => {
    const sel = (i: number) => soft[i]! >= 4 && hard[i]! < 6;
    const total = count(sel);
    expect(total).toBe(17064);
    expect(count((i) => sel(i) && dphi[i]! > 0.9 * Math.PI) / total).toBeCloseTo(0.882, 2);
    const inBin = (lo: number, hi: number) => count((i) => sel(i) && m[i]! >= lo && m[i]! < hi);
    expect(inBin(9, 10)).toBeGreaterThan(4000);
    expect(inBin(6, 8)).toBeLessThan(150);
    // 2 pT: the mass of a back-to-back central pair at the cut
    expect(2 * 4).toBe(8);
  });

  test('the median mass moves up with the threshold on the softer muon', () => {
    const median = (cut: number) => {
      const v: number[] = [];
      for (let i = 0; i < n; i++) if (soft[i]! >= cut) v.push(m[i]!);
      v.sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)]!;
    };
    expect(median(3)).toBeCloseTo(12.8, 0);
    expect(median(4)).toBeCloseTo(13.3, 0);
    expect(median(6)).toBeCloseTo(16.2, 0);
    expect(median(8)).toBeCloseTo(22.7, 0);
  });

  test('the collider-variable formula m² = 2 pT1 pT2 (cosh Δη − cos Δφ) reproduces the mass of pairs above 8 GeV (the muon mass is neglected)', () => {
    const errs: number[] = [];
    for (let i = 0; i < n; i++) if (m[i]! > 8) errs.push(Math.abs(mApprox[i]! / m[i]! - 1));
    errs.sort((a, b) => a - b);
    const q = (f: number) => errs[Math.floor(f * (errs.length - 1))]!;
    console.log('relative error of the massless formula, m > 8 GeV: median', q(0.5), '99th percentile', q(0.99), 'max', q(1));
    expect(q(0.5)).toBeLessThan(0.0005);
    expect(q(0.99)).toBeLessThan(0.005);
  });
});
