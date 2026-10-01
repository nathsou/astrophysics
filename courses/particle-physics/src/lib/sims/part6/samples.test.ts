import { describe, expect, test } from 'vitest';
import { TOP_SAMPLE } from './topSample';
import { IP_SAMPLE } from './ipSample';
import { fromPtEtaPhiM } from '$lib/hep/kinematics';
import { assignTopJetsReference } from '$lib/hep/topreco';

describe('the precomputed tt̄ sample', () => {
  test('591 selected events out of 1,400 generated, each passing the lepton + jets selection', () => {
    expect(TOP_SAMPLE.events.length).toBe(TOP_SAMPLE.selected);
    expect(TOP_SAMPLE.generated).toBe(1400);
    for (const e of TOP_SAMPLE.events) {
      expect(e.l[0]).toBeGreaterThan(25);
      expect(Math.hypot(e.m[0]!, e.m[1]!)).toBeGreaterThan(20);
      expect(e.j.length).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < e.j.length; i++) expect(e.j[i]![0]).toBeLessThanOrEqual(e.j[i - 1]![0]!);
      for (const j of e.j) expect(j[0]).toBeGreaterThan(25);
    }
  });
  test('each truth role is used at most once (twice for the two light quarks)', () => {
    for (const e of TOP_SAMPLE.events) {
      const roles = e.j.map((j) => j[5]);
      expect(roles.filter((r) => r === 1).length).toBeLessThanOrEqual(1);
      expect(roles.filter((r) => r === 2).length).toBeLessThanOrEqual(1);
      expect(roles.filter((r) => r === 3).length).toBeLessThanOrEqual(2);
    }
  });
  test('the numbers quoted in the chapter: 29 % of events have all four quark jets; the b-tag penalty roughly doubles the χ² success', () => {
    let all4 = 0, ok0 = 0, ok1 = 0, n = 0;
    for (const e of TOP_SAMPLE.events) {
      const roles = e.j.map((j) => j[5]!);
      const complete = roles.includes(1) && roles.includes(2) && roles.filter((r) => r === 3).length === 2;
      if (complete) all4++;
      const six = roles.slice(0, 6);
      if (!(six.includes(1) && six.includes(2) && six.filter((r) => r === 3).length === 2)) continue;
      const jets = e.j.map((j) => ({ p: fromPtEtaPhiM(j[0]!, j[1]!, j[2]!, j[3]!), btag: j[4]! }));
      const lep = fromPtEtaPhiM(e.l[0]!, e.l[1]!, e.l[2]!, 0);
      const met = { x: e.m[0]!, y: e.m[1]! };
      const right = (pen: number) => {
        const a = assignTopJetsReference(jets, lep, met, { maxJets: 6, btagPenalty: pen })!;
        return roles[a.bLep] === 1 && roles[a.bHad] === 2 && roles[a.q1] === 3 && roles[a.q2] === 3;
      };
      n++;
      if (right(0)) ok0++;
      if (right(10)) ok1++;
    }
    expect(all4 / TOP_SAMPLE.events.length).toBeGreaterThan(0.26);
    expect(all4 / TOP_SAMPLE.events.length).toBeLessThan(0.32);
    expect(ok0 / n).toBeGreaterThan(0.12);
    expect(ok0 / n).toBeLessThan(0.25);
    expect(ok1 / n).toBeGreaterThan(1.6 * (ok0 / n));
  });
});

describe('the precomputed jet sample', () => {
  test('about 600 jets of each flavour; the tagger works as the README says (b ≈ 75 %, light < 1 % at a score of 0.5)', () => {
    const eff = (rows: number[][], cut: number) => rows.filter((r) => r[0]! > cut).length / rows.length;
    for (const f of ['light', 'c', 'b'] as const) expect(IP_SAMPLE[f].length).toBeGreaterThan(550);
    expect(eff(IP_SAMPLE.b, 0.5)).toBeGreaterThan(0.7);
    expect(eff(IP_SAMPLE.b, 0.5)).toBeLessThan(0.82);
    expect(eff(IP_SAMPLE.light, 0.5)).toBeLessThan(0.015);
    expect(eff(IP_SAMPLE.c, 0.5)).toBeGreaterThan(0.15);
    expect(eff(IP_SAMPLE.c, 0.5)).toBeLessThan(0.3);
  });
  test('the exercise recipe: a cut at 3 on the second-largest significance keeps about 75 % of b jets and about 0.5 % of light jets', () => {
    const s2 = (rows: number[][], cut: number) => rows.filter((r) => (r[2] ?? -10) > cut).length / rows.length;
    expect(s2(IP_SAMPLE.b, 3)).toBeGreaterThan(0.68);
    expect(s2(IP_SAMPLE.b, 3)).toBeLessThan(0.82);
    expect(s2(IP_SAMPLE.light, 3)).toBeLessThan(0.015);
  });
});
