import { describe, expect, test } from 'vitest';
import { simulateShower, CTAU_MU_M, CTAU_PI_M, chargedMultiplicity, heightOfDepth, depthAtHeight, X0 } from './airshower.ts';
import { particle } from '../../hep/particles/index.ts';

describe('constants from the particle table', () => {
  test('c·τ of the muon is 659 m and of the charged pion 7.8 m', () => {
    expect(CTAU_MU_M).toBeCloseTo(658.6, 0);
    expect(CTAU_PI_M).toBeCloseTo(7.805, 2);
  });
  test('atmosphere', () => {
    expect(heightOfDepth(X0)).toBeCloseTo(0, 12);
    expect(depthAtHeight(heightOfDepth(300))).toBeCloseTo(300, 9);
    expect(heightOfDepth(265)).toBeGreaterThan(9);
    expect(heightOfDepth(265)).toBeLessThan(11);
  });
  test('multiplicity grows slowly with energy', () => {
    expect(chargedMultiplicity(1000)).toBe(10);
    expect(chargedMultiplicity(1e6)).toBeGreaterThan(30);
    expect(chargedMultiplicity(1e6)).toBeLessThan(50);
  });
});

describe('the toy shower at 10^15 eV', () => {
  const base = { E0: 1e6, seed: 4 };
  const a = simulateShower(base);
  test('deterministic for a seed', () => {
    const b = simulateShower(base);
    expect(b.muonsGround).toBe(a.muonsGround);
    expect(b.pions).toBe(a.pions);
  });
  test('the first interaction is high in the atmosphere', () => {
    expect(a.firstHeightKm).toBeGreaterThan(8);
    expect(a.firstHeightKm).toBeLessThan(40);
  });
  test('thousands of muons are made, and a good fraction reaches the ground with dilation', () => {
    expect(a.muonsMade).toBeGreaterThan(3000);
    expect(a.muonsMade).toBeLessThan(200000);
    expect(a.muonsGround).toBeGreaterThan(0.3 * a.muonsMade);
    expect(a.muonsGround).toBeLessThan(a.muonsMade);
  });
  test('without time dilation essentially nothing arrives', () => {
    const n = simulateShower({ ...base, timeDilation: false });
    // only muons born within a kilometre or so of the ground survive: about a twelfth of those that arrive with dilation
    expect(n.muonsGround).toBeLessThan(0.15 * a.muonsGround);
    expect(n.muonsGround).toBeGreaterThan(0.03 * a.muonsGround);
    expect(Math.abs(n.muonsGround - a.expectedNoDilation) / a.expectedNoDilation).toBeLessThan(0.2);
    // muons born above 5 km: none survive without dilation, most do with it
    let hiBorn = 0, hiNo = 0, hiYes = 0;
    a.muonBirthKm.forEach((h, k) => { if (h > 5) { hiBorn++; hiNo += a.muonPNoDilation[k]!; hiYes += a.muonReached[k]!; } });
    expect(hiNo / hiBorn).toBeLessThan(1e-3);
    expect(hiYes / hiBorn).toBeGreaterThan(0.3);
    expect(a.expectedDilationNoLoss).toBeGreaterThan(a.muonsGround); // energy loss takes some away
  });
  test('the simulated arrival is close to the analytic survival sum, less the muons that ionisation stops', () => {
    expect(a.muonsGround / a.expectedDilationNoLoss).toBeGreaterThan(0.5);
    expect(a.muonsGround / a.expectedDilationNoLoss).toBeLessThan(1.05);
  });
  test('energy bookkeeping: the electromagnetic part is a third of the pion energy or so', () => {
    expect(a.emEnergy).toBeGreaterThan(0.1 * base.E0);
    expect(a.emEnergy).toBeLessThan(0.9 * base.E0);
  });
  test('ground muons have energies of a few GeV', () => {
    const sorted = [...a.groundEnergies].sort((x, y) => x - y);
    const med = sorted[Math.floor(sorted.length / 2)]!;
    expect(med).toBeGreaterThan(0.5);
    expect(med).toBeLessThan(50);
    expect(Math.min(...sorted)).toBeGreaterThan(particle(13).mass);
  });
  test('a more inclined shower loses more muons', () => {
    const v = simulateShower({ ...base, zenithDeg: 0 });
    const t = simulateShower({ ...base, zenithDeg: 60 });
    expect(t.muonsGround / t.muonsMade).toBeLessThan(v.muonsGround / v.muonsMade);
  });
  test('ten times more energy gives more muons, by a factor well below 10 times E^0.9 scaling (N ∝ E^0.8–0.9 in Heitler–Matthews)', () => {
    const hi = simulateShower({ E0: 1e7, seed: 3, keepTracks: 10 });
    const ratio = hi.muonsMade / a.muonsMade;
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(10);
  });
});
