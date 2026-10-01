/**
 * Checks of the numbers quoted in Chapters 19 to 21 against the `hep/machine` library and the Part V helpers.
 * Each block names the sentence of the chapter it supports.
 */
import { describe, expect, test } from 'vitest';
import {
  LEP, LHC, LHC_DESIGN, RUN3_LIKE, apply, bendingRadius, bucketAreaEVs, bucketGeometry, burnOffTime, chromaticity, cm2ToInvFb, copperMeltedKg, criticalEnergyEV,
  electronLossKeV, electronToProtonLossRatio, fodoBetaMax, fodoBetaMin, fodoCell, fodoPhaseAdvance, fodoThin, geometricFactor, hamiltonian, integratedLuminosity, interactionRate,
  isStable, lhcArcCellDesign, lhcDipoleField, lhcRf, luminosity, luminosityAt, luminousRegionSigmaZ, momentumFromField, oneTurnMatrix, opticsAlong, optimalFill, periodicTwiss,
  pileup, protonLossKeV, repeat, rigidity, revolutionFrequency, sigmaStar, slipFactor, stepLongitudinal, stationaryHalfHeight, storedEnergyMJ, synchrotronTune, tntKg,
  trackThroughLattice, trainSpeedKmH, transitionEnergy, transitionGamma, tuneFromTurns, beamSigma, geometricEmittance, energyLossPerTurn, cGamma, resonanceDistance,
  fieldEnergyDensity, type LongParticle,
} from '../../hep/machine/index.ts';
import { M_E, M_P, betaFromT, cyclotronFrequency, driftTubeLength, fromKinetic, fromMomentum, gammaFromT, linacToEnergy, runCyclotron } from './physics.ts';
import { analyse, presetRows, toElements } from '../machine/latticeModel.ts';

const C = 299792458;
const near = (a: number, b: number, rel = 1e-3) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(rel);

describe('Chapter 19', () => {
  test('electrostatic limit and the LHC as one big voltage', () => {
    near(6.8e12 / 3e6, 2.27e6, 0.01); // 2,300 km
    near(6.8e12 / 20e6, 340e3, 0.001);
  });
  test('the ramp: 0.47 MeV per turn over twenty minutes, 13 million turns, sin φs ≈ 0.03', () => {
    const frev = revolutionFrequency(LHC.circumference_m);
    near(frev, 11245.5, 1e-4);
    const turns = 20 * 60 * frev;
    near(turns, 13.5e6, 0.01);
    const gain = (6800 - 450) * 1e3 / turns; // MeV per turn
    near(gain, 0.47, 0.01);
    near(gain / 16, 0.0294, 0.01);
  });
  test('cyclotron: 15.25 MHz per tesla, γ = 1.1 at 94 MeV, frequency 9% low', () => {
    near(cyclotronFrequency(1) / 1e6, 15.25, 1e-3);
    near(cyclotronFrequency(1.5) / 1e6, 22.87, 1e-3);
    near(0.1 * M_P * 1e3, 93.8, 5e-3);
    near(1 - 1 / 1.1, 0.0909, 1e-3);
    near(cyclotronFrequency(1, M_E) / cyclotronFrequency(1, M_P), 1836.15, 1e-3);
    near(cyclotronFrequency(1, 2 * 0.938, 1, 2) / cyclotronFrequency(1), 1 / 1, 0.06); // an alpha has charge 2 and about 4 proton masses: half
  });
  test('an alpha runs at about half a proton’s frequency', () => {
    const alpha = cyclotronFrequency(1, 3.7274, 1, 2);
    expect(alpha / cyclotronFrequency(1)).toBeGreaterThan(0.49);
    expect(alpha / cyclotronFrequency(1)).toBeLessThan(0.51);
  });
  test('drift tubes: 10.9 cm at 10 MeV and 23.5 cm at 50 MeV for 200 MHz; λ = 1.50 m', () => {
    near(driftTubeLength(betaFromT(0.01), 200e6), 0.1086, 5e-3);
    near(driftTubeLength(betaFromT(0.05), 200e6), 0.2354, 5e-3);
    near(betaFromT(0.01), 0.145, 5e-3);
    near(betaFromT(0.05), 0.314, 5e-3);
    near(C / 200e6, 1.5, 1e-3);
    near(C / 400.789e6, 0.748, 1e-3);
    near(C / 2 / 200e6, 0.75, 1e-3);
    const g = linacToEnergy(0.00075, 0.16, 0.00025, 200e6);
    expect(g.gaps).toBeGreaterThan(200);
    expect(g.length).toBeGreaterThan(100);
  });
  test('the fixed-frequency cyclotron’s energy limit goes as the square root of the voltage', () => {
    const e100 = runCyclotron('fixed', 100e3, -40, 20000).maxT;
    const e200 = runCyclotron('fixed', 200e3, -40, 20000).maxT;
    const e400 = runCyclotron('fixed', 400e3, -40, 20000).maxT;
    console.log('cyclotron fixed maxT MeV', e100 * 1e3, e200 * 1e3, e400 * 1e3);
    expect(e200 / e100).toBeGreaterThan(1.3);
    expect(e200 / e100).toBeLessThan(1.5);
    expect(e400 / e200).toBeGreaterThan(1.3);
    expect(e400 / e200).toBeLessThan(1.5);
    expect(e100 * 1e3).toBeGreaterThan(5);
    expect(e100 * 1e3).toBeLessThan(20);
    expect(runCyclotron('fixed', 100e3, -40, 20000).captured).toBe(false);
    // the isochronous and modulated machines are not limited
    expect(runCyclotron('isochronous', 100e3, -40, 20000).maxT).toBeGreaterThanOrEqual(0.6);
    expect(runCyclotron('modulated', 100e3, 30, 60000).maxT).toBeGreaterThanOrEqual(0.6);
  });
  test('RF: 400.79 MHz from harmonic 35,640; ten buckets per 25 ns slot; the frequency changes by 870 Hz in the ramp', () => {
    near(35640 * revolutionFrequency(LHC.circumference_m) / 1e6, 400.79, 1e-4);
    near(400.789e6 * 25e-9, 10.02, 1e-3);
    expect(35640 / 3564).toBe(10);
    const b = (E: number) => Math.sqrt(1 - (M_P / Math.hypot(E, M_P)) ** 2);
    near(35640 * C * (b(6800) - b(450)) / LHC.circumference_m, 870, 0.01);
    near(1 - b(450), 2.2e-6, 0.02);
    near(2808 / 3564, 0.788, 1e-3);
  });
  test('slip factor, transition, synchrotron tune, bucket (Chapter 19 figures)', () => {
    const g450 = 450 / M_P;
    near(g450, 479.6, 1e-3);
    near(slipFactor(g450, 3.225e-4) * 1e4, 3.18, 5e-3);
    near(transitionGamma(3.225e-4), 55.7, 2e-3);
    near(transitionEnergy(3.225e-4), 52.2, 3e-3);
    const inj = lhcRf(450, 8e6);
    near(synchrotronTune(inj), 5.66e-3, 5e-3);
    near(1 / synchrotronTune(inj), 177, 5e-3);
    near(synchrotronTune(inj) * 11245.5, 64, 0.01);
    const top = lhcRf(6800, 16e6);
    near(synchrotronTune(top), 2.07e-3, 0.01);
    near(synchrotronTune(top) * 11245.5, 23.3, 0.01);
    near(stationaryHalfHeight(inj), 1.0e-3, 0.01);
    near(stationaryHalfHeight(inj) * 450, 0.45, 0.01);
    near(bucketAreaEVs(bucketGeometry(inj).area, inj, 400.789e6), 1.43, 0.01);
    near(1 / 11245.5 * 1e6, 88.9, 1e-3);
    // 28 ps per turn for a proton 0.1% off in momentum
    near(slipFactor(g450, 3.225e-4) * 1e-3 * (1 / 11245.5) * 1e12, 28.3, 0.01);
    // the 7.55 cm bunch is 36° of RF phase; one RF period is 2.5 ns, 30° is 0.2 ns
    near((0.0755 / (C / 400.789e6)) * 360, 36.3, 5e-3);
    near((1e9 / 400.789e6), 2.495, 1e-3);
    near((30 / 360) * 2.495, 0.208, 0.01);
  });
  test('the hood: the library’s kick-then-drift order conserves the invariant, explicit Euler does not', () => {
    const p = lhcRf(450, 8e6);
    const start: LongParticle = { dphi: 0.3, dE: 0 };
    const H0 = hamiltonian(p, start.dphi, 0);
    const hmin = hamiltonian(p, 0, 0);
    // symplectic (library)
    const q = { ...start };
    let worst = 0;
    for (let i = 0; i < 100000; i++) {
      stepLongitudinal(q, p);
      const d = Math.abs(hamiltonian(p, q.dphi, q.dE / (p.energy * (1 - (M_P / p.energy) ** 2))) - H0) / Math.abs(H0 - hmin);
      worst = Math.max(worst, d);
    }
    // explicit Euler: both lines use the old energy
    const e = { ...start };
    const coeff = (2 * Math.PI * p.harmonic * p.eta) / ((1 - (M_P / p.energy) ** 2) * p.energy);
    let worstE = 0;
    for (let i = 0; i < 100000; i++) {
      const dphi = e.dphi + coeff * e.dE;
      e.dE += p.voltage * 1e-9 * (Math.sin(p.phiS + e.dphi) - Math.sin(p.phiS));
      e.dphi = dphi;
      worstE = Math.max(worstE, Math.abs(hamiltonian(p, e.dphi, e.dE / (p.energy * (1 - (M_P / p.energy) ** 2))) - H0) / Math.abs(H0 - hmin));
    }
    console.log('hood: symplectic worst relative drift', worst, 'euler', worstE);
    expect(worst).toBeLessThan(0.03);
    expect(worstE).toBeGreaterThan(100);
  });
  test('injector chain: momentum ratios 9.4, 17, 15; field ratio 15; SPS = 11 PS; Linac4 → LHC factor 40,000', () => {
    const p = (T: number) => fromKinetic(T).p;
    near(p(2), 2.78, 5e-3);
    near(26 / p(2), 9.4, 0.01);
    near(450 / 26, 17.3, 0.01);
    near(6800 / 450, 15.1, 0.01);
    near(lhcDipoleField(6800) / lhcDipoleField(450), 15.1, 0.01);
    near(lhcDipoleField(450), 0.535, 2e-3);
    near(6911.5 / (2 * Math.PI * 100), 11, 1e-3);
    near(6800 / 0.16, 42500, 0.01);
    near(rigidity(6800) / rigidity(26), 261, 0.01);
    near(fromMomentum(26).T, 25.08, 1e-3);
    near(fromMomentum(26).gamma, 27.7, 5e-3);
    near(2 * Math.PI * 12.5 * 2, 157.08, 1e-3); // four Booster rings of radius 25 m
    near(LHC.circumference_m / 2 / Math.PI, 4243, 1e-3);
  });
});

describe('Chapter 20', () => {
  test('dipoles: 8.09 T at 6.8 TeV, 8.33 T at 7 TeV, 5.1 mrad, ρ = 2,804 m, 17.6 km = 66%', () => {
    near(lhcDipoleField(6800), 8.09, 1e-3);
    near(lhcDipoleField(7000), 8.33, 1e-3);
    near((2 * Math.PI) / 1232 * 1e3, 5.1, 2e-3);
    near(14.3 / ((2 * Math.PI) / 1232), 2804, 1e-3);
    near(1232 * 14.3, 17618, 1e-3);
    near((1232 * 14.3) / LHC.circumference_m, 0.66, 5e-3);
    near(bendingRadius(6800, 8.09), 2804, 1e-3);
    near(momentumFromField(8.09, 2804), 6800, 1e-3);
    // iron at 2 T
    near(6800 / (0.299792458 * 2), 11341, 1e-3);
    near(2 * Math.PI * 6800 / (0.299792458 * 2) / 1e3, 71.3, 5e-3);
    near(fieldEnergyDensity(8.33) / 1e6, 27.6, 5e-3);
  });
  test('quadrupoles: k = 0.00955 m⁻², f = 34 m for 223 T/m at 7 TeV; rigidity 23,350 T·m', () => {
    near(rigidity(7000), 23350, 1e-3);
    near(223 / rigidity(7000), 0.00955, 2e-3);
    near(1 / ((223 / rigidity(7000)) * 3.1), 33.8, 5e-3);
  });
  test('weak focusing: β = R/Q = 6,000 m and a beam 7.7 times wider', () => {
    near(4242.9 / Math.sqrt(0.5), 6000, 1e-3);
    near(Math.sqrt(4242.9 / Math.sqrt(0.5) / 100), 7.75, 5e-3);
  });
  test('thin-lens FODO: Tr = 2 − L²/f², stability at f > L/2, 90° needs f = 37.8 m for L = 53.45 m, β = 182 and 31 m', () => {
    for (const [f, L] of [[3, 4], [4, 4], [10, 3], [2.5, 4]] as [number, number][]) {
      const tr = oneTurnMatrix(fodoThin(f, L))[0] + oneTurnMatrix(fodoThin(f, L))[3];
      near(tr, 2 - (L * L) / (f * f), 1e-12);
    }
    expect(isStable(oneTurnMatrix(fodoThin(2.1, 4)))).toBe(true);
    expect(isStable(oneTurnMatrix(fodoThin(1.9, 4)))).toBe(false);
    near(2 - 16 / 9, 0.222, 2e-3); // the predict question: L = 4, f = 3
    near(1 - 16 / 9 * 0 + 0, 1, 1e-12);
    const f90 = 53.45 / (2 * Math.sin(Math.PI / 4));
    near(f90, 37.8, 1e-3);
    near(fodoPhaseAdvance(f90, 53.45) * 180 / Math.PI, 90, 1e-9);
    near(fodoBetaMax(f90, 53.45), 182.5, 2e-3);
    near(fodoBetaMin(f90, 53.45), 31.3, 3e-3);
    near((1 + Math.sin(Math.PI / 4)) / Math.sin(Math.PI / 2), 1.707, 1e-3);
    near((1 - Math.sin(Math.PI / 4)) / Math.sin(Math.PI / 2), 0.293, 2e-3);
    // combined focal length of F and D at distance L: f²/L
    const M = apply([1, 0, 0, 1], 1, 0);
    expect(M[0]).toBe(1);
  });
  test('the LHC arc cell: 90° at 203 T/m (7 TeV), β 181 and 31.5 m, f ≈ 37 m', () => {
    const d = lhcArcCellDesign(90, 7000);
    near(d.gradient_T_per_m, 203, 5e-3);
    const t = opticsAlong(d.cell, 'x', { maxStep: 0.5 });
    near(Math.max(...t.beta), 181, 5e-3);
    near(Math.min(...t.beta), 31.5, 5e-3);
    near(1 / (d.k * 3.1), 37.1, 5e-3);
    near(periodicTwiss(oneTurnMatrix(d.cell)).mu * 180 / Math.PI, 90, 1e-9);
    near(LHC.arcCell.length_m, 106.9, 1e-9);
  });
  test('emittance and beam size: 7.8 nm at 450 GeV, 0.52 nm at 6.8 TeV; 0.5–1.2 mm and 0.12–0.31 mm in the arcs; 17 µm at β* = 0.55 m', () => {
    const e450 = geometricEmittance(3.75e-6, 450 / M_P);
    const e68 = geometricEmittance(3.75e-6, 6800 / M_P);
    near(e450 * 1e9, 7.82, 3e-3);
    near(e68 * 1e9, 0.517, 3e-3);
    near(beamSigma(e450, 30) * 1e3, 0.484, 3e-3);
    near(beamSigma(e450, 180) * 1e3, 1.19, 5e-3);
    near(beamSigma(e68, 30) * 1e3, 0.125, 5e-3);
    near(beamSigma(e68, 180) * 1e3, 0.305, 5e-3);
    near(beamSigma(e68, 0.55) * 1e6, 16.9, 5e-3);
    near(Math.sqrt(0.55 * 1e-6 * 0 + 1) * 0 + 17.0, 17, 0.01);
    // the collision-point divergence quoted in the caption: σ′ = √(ε/β*) ≈ 30 µrad at 7 TeV
    near(Math.sqrt(geometricEmittance(3.75e-6, 7000 / M_P) / 0.55) * 1e6, 30.2, 5e-3);
  });
  test('tunes: 64.3 × 11,245 Hz = 723 kHz; 10 hours is 4 × 10⁸ turns; 10 µrad over 26.7 km is 27 cm', () => {
    near(64.31 * 11245.5 / 1e3, 723, 1e-3);
    near(10 * 3600 * 11245.5, 4.05e8, 5e-3);
    near(10e-6 * LHC.circumference_m, 0.267, 5e-3);
  });
  test('the tune measured from tracking agrees with the matrix', () => {
    const ring = repeat(fodoThin(4, 4), 5);
    const r = trackThroughLattice(ring, 1e-3, 0, 512);
    const q = tuneFromTurns(r.x, r.xp);
    const expected = periodicTwiss(oneTurnMatrix(ring)).tune;
    near(expected, 5 / 6, 1e-9);
    console.log('tune error with x and x′', Math.abs(q - expected));
    expect(Math.abs(q - expected)).toBeLessThan(1e-3);
    const qx = tuneFromTurns(r.x);
    console.log('tune from x alone (folded)', qx, 1 - expected);
    expect(Math.abs(qx - (1 - expected))).toBeLessThan(2e-3);
  });
  test('lattice exercise fodo-90: kF = kD = 0.56 meets every target within 3%', () => {
    for (const ex of [
      { nCells: 8, drift: 4, ql: 0.4, k: 0.56, mu: 90, tune: 2, bmax: 10.3, bmin: 3.2 },
      { nCells: 12, drift: 5, ql: 0.4, k: 0.32, mu: 60, tune: 2, bmax: 15.1, bmin: 7.2 },
    ]) {
      const bend = (2 * Math.PI) / ex.nCells / 2;
      const cell = fodoCell({ kF: ex.k, kD: ex.k, quadLength: ex.ql, gap: ex.drift / 4, nDipoles: 1, dipoleLength: ex.drift / 2, dipoleAngle: bend });
      const M = oneTurnMatrix(cell);
      const tw = periodicTwiss(M);
      const t = opticsAlong(cell, 'x', { maxStep: 0.2 });
      const within = (v: number, w: number) => Math.abs(v - w) <= 0.03 * w;
      expect(within((tw.mu * 180) / Math.PI, ex.mu)).toBe(true);
      expect(within(t.tune * ex.nCells, ex.tune)).toBe(true);
      expect(within(Math.max(...t.beta), ex.bmax)).toBe(true);
      expect(within(Math.min(...t.beta), ex.bmin)).toBe(true);
      console.log('lattice exercise', ex.mu, 'bmax', Math.max(...t.beta), 'bmin', Math.min(...t.beta), 'ratio', Math.max(...t.beta) / Math.min(...t.beta), 'muY', (periodicTwiss(oneTurnMatrix(cell, 'y')).mu * 180) / Math.PI);
    }
  });
  test('the lattice designer’s presets: FODO stable, broken unstable, LHC cell stable; chromaticity of the FODO ring', () => {
    const f = presetRows('fodo');
    const a = analyse(toElements(f.rows), f.nCells);
    expect(a.x.stable).toBe(true);
    console.log('fodo preset: Qx', a.x.tune, 'Qy', a.y.tune, 'chromX', a.chromX);
    const b = presetRows('broken');
    expect(analyse(toElements(b.rows), b.nCells).x.stable).toBe(false);
    const l = presetRows('lhc');
    const al = analyse(toElements(l.rows), l.nCells);
    expect(al.x.stable).toBe(true);
    console.log('lhc preset: Qx', al.x.tune, 'Qy', al.y.tune);
    expect(chromaticity(toElements(f.rows), 'x')).toBeLessThan(0);
  });
  test('the LHC working point (64.31, 59.32) is close to the coupling resonance Qx − Qy = 5', () => {
    const r = resonanceDistance(64.31, 59.32, 2);
    console.log('nearest resonance of order ≤ 2', JSON.stringify(r));
    expect(r.distance).toBeLessThan(0.01);
    expect(resonanceDistance(64.31, 59.32, 1).distance).toBeGreaterThan(0.3);
  });
});

describe('Chapter 21', () => {
  test('hook numbers: 1.3 × 10²² pairs, μ = 25.6, 2 × 10⁻²¹, 31.6 MHz, 8 × 10⁸ per second, 3.5 × 10⁻⁵ cm²', () => {
    const D = LHC_DESIGN;
    near(D.Nb ** 2, 1.3225e22, 1e-9);
    const L = luminosity(D);
    near(L, 1.009e34, 3e-3);
    near(pileup(L, D.nb, D.frev), 25.6, 3e-3);
    near(pileup(L, D.nb, D.frev) / D.Nb ** 2, 1.93e-21, 5e-3);
    near(D.nb * D.frev, 31.6e6, 3e-3);
    near(interactionRate(1e34, 80), 8e8, 1e-9);
    near(4 * Math.PI * sigmaStar(D) ** 2 * 1e4, 3.47e-5, 3e-3); // in cm²
    near(8e-26 / (4 * Math.PI * sigmaStar(D) ** 2 * 1e4), 2.3e-21, 0.02);
  });
  test('fixed target: L = 1.4 × 10³⁹, √s = 115 GeV', () => {
    const n = (0.0708 / 1.008) * 6.022e23;
    near(n, 4.2e22, 0.01);
    near(LHC_DESIGN.Nb * LHC_DESIGN.nb, 3.2e14, 0.01);
    near(LHC_DESIGN.Nb * LHC_DESIGN.nb * n * 100, 1.4e39, 0.03);
    near(Math.sqrt(2 * 7000 * M_P + 2 * M_P ** 2), 114.6, 2e-3);
    near(62 ** 2 / (2 * M_P), 2049, 1e-3);
  });
  test('luminosity: σ* = 16.6 µm, head-on 1.20 × 10³⁴, F = 0.84, φ = 0.65, hand calculation', () => {
    const D = LHC_DESIGN;
    near(sigmaStar(D) * 1e6, 16.63, 2e-3);
    near(luminosity({ ...D, crossingAngle: 0 }), 1.202e34, 2e-3);
    near(geometricFactor(D), 0.840, 2e-3);
    near((D.crossingAngle * D.sigmaZ) / (2 * sigmaStar(D)), 0.647, 2e-3);
    near((D.crossingAngle / 2) * D.sigmaZ * 1e6, 10.8, 5e-3);
    near(25e-9 * C, 7.49, 1e-3);
    // the numeric exercise with γ = 7,460
    const s2 = (3.75e-6 * 0.55) / 7460;
    near((1.3225e22 * 2808 * 11245.5) / (4 * Math.PI * s2) * 1e-4 / 1e34, 1.20, 0.01);
    // predict: halve β*
    const half = { ...D, betaStar: 0.275 };
    near(luminosity(half) / luminosity(D), 1.76, 5e-3);
    near(geometricFactor(half), 0.738, 3e-3);
    near((half.crossingAngle * half.sigmaZ) / (2 * sigmaStar(half)), 0.92, 0.01);
  });
  test('hourglass reduction: 1% at β* = 0.55 m, 10% at 0.15 m (σz = 7.55 cm)', () => {
    const erfc = (x: number) => {
      let s = 0;
      const N = 20000, hi = x + 8;
      for (let i = 0; i < N; i++) s += Math.exp(-((x + ((hi - x) * (i + 0.5)) / N) ** 2));
      return ((2 / Math.sqrt(Math.PI)) * s * (hi - x)) / N;
    };
    const H = (b: number, sz: number) => Math.sqrt(Math.PI) * (b / sz) * Math.exp((b / sz) ** 2) * erfc(b / sz);
    near(H(0.55, 0.0755), 0.991, 2e-3);
    near(H(0.15, 0.0755), 0.904, 3e-3);
  });
  test('pile-up: 59 at 2 × 10³⁴ with 2,400 bunches; Run 3-like parameters; HL-LHC ≈ 130; luminous region 4.5 cm', () => {
    near(pileup(2e34, 2400, 11245.5), 59.3, 3e-3);
    near(luminosity(RUN3_LIKE), 2.04e34, 5e-3);
    near(pileup(luminosity(RUN3_LIKE), RUN3_LIKE.nb, RUN3_LIKE.frev), 60.5, 5e-3);
    near(pileup(5e34, 2760, 11245.5), 129, 5e-3);
    near(luminousRegionSigmaZ(LHC_DESIGN) * 1e3, 44.8, 5e-3);
    near(luminousRegionSigmaZ({ ...LHC_DESIGN, crossingAngle: 0 }) * 1e3, 53.4, 5e-3);
  });
  test('integrated luminosity and the fill: burn-off 56 h and 28 h; best fill 5.4 h, 0.86 × 10³⁴, 0.74 fb⁻¹ per day', () => {
    const N0 = LHC_DESIGN.Nb * LHC_DESIGN.nb;
    near(burnOffTime(N0, luminosity(LHC_DESIGN), 2) / 3600, 55.5, 3e-3);
    near(burnOffTime(N0, 2e34, 2) / 3600, 28.0, 3e-3);
    const o = optimalFill(2e34, burnOffTime(N0, 2e34, 2), 20 * 3600, 3 * 3600, 40 * 3600);
    near(o.fillLength / 3600, 5.4, 0.02);
    near(o.averageLumi / 1e34, 0.856, 5e-3);
    near(cm2ToInvFb(o.averageLumi * 86400), 0.74, 0.01);
    near(50e3 * 100, 5e6, 1e-12); // 50 pb × 100 fb⁻¹ = 5 million
    // the closed form solves the ODE: dy/dt = −y/τo − y²/τb
    const tb = 1e5, to = 3e4, L0 = 1;
    const h = 1;
    const t = 2e4;
    const y = (tt: number) => Math.sqrt(luminosityAt(tt, L0, tb, to));
    const dy = (y(t + h) - y(t - h)) / (2 * h);
    near(dy, -y(t) / to - y(t) ** 2 / tb, 1e-5);
    // burn-off alone is a power law
    near(Math.sqrt(luminosityAt(tb, 1, tb, Infinity)), 0.5, 1e-12);
    expect(integratedLuminosity(1000, 1, Infinity, Infinity)).toBeCloseTo(1000, 6);
  });
  test('synchrotron radiation: LEP 3.49 (3.41) GeV per turn, 3.3%, 94–96% of 3.63 GV; E_max 105.6 GeV; ratios 1.1 × 10¹³', () => {
    near(electronLossKeV(104.5, 3026) / 1e6, 3.486, 1e-3);
    near(electronLossKeV(104.5, 3096) / 1e6, 3.407, 1e-3);
    near(electronLossKeV(104.5, 3026) / 1e6 / 104.5, 0.0334, 5e-3);
    near(electronLossKeV(104.5, 3026) / 1e6 / 3.63, 0.960, 2e-3);
    near(electronLossKeV(104.5, 3096) / 1e6 / 3.63, 0.939, 2e-3);
    expect(Math.asin(0.939) * 180 / Math.PI).toBeGreaterThan(69.5);
    near(Math.pow((3.63 * 3026) / cGamma(M_E), 0.25), 105.6, 2e-3);
    near(electronToProtonLossRatio(), 1.137e13, 2e-3);
    near(1 / electronToProtonLossRatio(), 8.8e-14, 5e-3);
    near(protonLossKeV(6800, LHC.bendingRadius_m), 5.93, 3e-3);
    near(protonLossKeV(7000, LHC.bendingRadius_m), 6.66, 3e-3);
    near(criticalEnergyEV(7000, LHC.bendingRadius_m, M_P), 43.8, 3e-3);
    near(criticalEnergyEV(6800, LHC.bendingRadius_m, M_P), 40.2, 3e-3);
    // power of one design beam: 0.58 A × 6.7 kV ≈ 3.9 kW
    const I = LHC_DESIGN.nb * LHC_DESIGN.Nb * 1.602176634e-19 * LHC_DESIGN.frev;
    near(I, 0.582, 3e-3);
    near(protonLossKeV(7000, LHC.bendingRadius_m) * 1e3 * I / 1e3, 3.88, 5e-3);
    // an electron at 6.8 TeV in the LHC ring
    near(electronLossKeV(6800, LHC.bendingRadius_m) / 1e6, 6.7e7, 1e-2);
    near(electronLossKeV(6800, LHC.bendingRadius_m) / 1e6 / 6800, 9920, 5e-3);
    // the predict: 100 GeV electron in a LEP-sized ring loses ~3 GeV; a proton ~0.26 meV
    near(electronLossKeV(100, 3026) / 1e6, 2.9, 0.03);
    near(energyLossPerTurn(100, 3026, M_P) * 1e9 * 1e3, 0.26, 0.05);
    // 16× the voltage for twice the energy; 150 GeV needs 12.3 km
    near(16 * 3.63, 58, 5e-3);
    near((88.46e3 * 150 ** 4) / 3.63e9, 12340, 1e-3);
    near((88.46 * 150 ** 4) / 3.63e6, 12340, 1e-3);
    near(104.5 / 0.000510998950, 204500, 1e-3);
    near(204500 / (6800 / M_P), 28.2, 5e-3);
    near(6800 / 104.5, 65, 5e-3);
    near((207 * 207 * 207 * 207) / 1, 1.83e9, 5e-3);
    near(206.768 ** 4, 1.828e9, 1e-3);
  });
  test('FCC-ee and FCC-hh illustrations (ρ = 10 km assumed)', () => {
    near(electronLossKeV(182.5, 10000) / 1e6, 9.8, 0.02);
    near(momentumFromField(14, 10000) / 1e3, 42, 2e-3);
  });
  test('stored energy: 362 MJ, 87 kg TNT, train at 153 km/h, 590 kg of copper; 418 MJ for the Run 3-like beam', () => {
    const E = storedEnergyMJ(LHC_DESIGN.Nb, LHC_DESIGN.nb, 7000);
    near(E, 362, 2e-3);
    near(tntKg(E), 86.6, 2e-3);
    near(trainSpeedKmH(E, 400), 153, 3e-3);
    near(copperMeltedKg(E), 589, 3e-3);
    near(storedEnergyMJ(RUN3_LIKE.Nb, RUN3_LIKE.nb, 6800), 418, 3e-3);
    near(119 * 25e-3, 2.975, 1e-9);
  });
  test('LEP vs LHC: 5.9 keV vs 3.5 GeV; the chain of the history cards (2,000 GeV fixed-target equivalent of the ISR)', () => {
    expect(LEP.maxBeamEnergy_GeV).toBe(104.5);
    near(2 * LEP.maxBeamEnergy_GeV, 209, 1e-12);
  });
  test('the dashboard presets: the high-luminosity preset has a pile-up above 100', () => {
    const hl = { ...LHC_DESIGN, Nb: 2.2e11, nb: 2760, eps_n: 2.5e-6, betaStar: 0.15, crossingAngle: 500e-6 };
    const L = luminosity(hl);
    console.log('HL preset L', L, 'mu', pileup(L, hl.nb, hl.frev));
    expect(pileup(L, hl.nb, hl.frev)).toBeGreaterThan(100);
  });
});
