import { describe, expect, test } from 'vitest';
import {
  irrep, irrepDim, decomposeProduct, formatDecomposition, baryonMultiplet, decupletSpacing, DECUPLET_MASSES, gellMannOkuboBaryons,
  gellMannOkuboMesons, omegaStrongDecayThreshold, gellMannNishijima, unitarityLimit, GEV2_TO_MB, parseContent, contentNumbers, hadronsWithContent,
  hasColourSinglet, flavourMultiplets, octetMoments, equalMassQuarkMoments, momentsFitToNucleons, MEASURED_MOMENTS, constituentMassRatio, isColourNeutral, chargeOf,
} from './index.ts';
import { allParticles, particle } from '../particles/index.ts';
import { twoBodyMomentum, mandelstamS, fromMass } from '../kinematics/index.ts';

describe('weight diagrams', () => {
  test('dimensions', () => {
    expect([irrep(0, 0), irrep(1, 0), irrep(0, 1), irrep(2, 0), irrep(1, 1), irrep(3, 0), irrep(2, 1), irrep(2, 2)].map((r) => r.dim)).toEqual([1, 3, 3, 6, 8, 10, 15, 27]);
    for (let p = 0; p < 6; p++) for (let q = 0; q < 6; q++) {
      const r = irrep(p, q);
      expect(r.dim).toBe(irrepDim(p, q));
      expect(r.weights.reduce((s, w) => s + w.mult, 0)).toBe(r.dim);
      expect(r.multiplets.reduce((s, m) => s + m.dim, 0)).toBe(r.dim);
    }
  });
  test('the triplet is u, d, s', () => {
    const w = irrep(1, 0).weights;
    expect(w).toEqual([{ i3x2: -1, y3: 1, mult: 1 }, { i3x2: 1, y3: 1, mult: 1 }, { i3x2: 0, y3: -2, mult: 1 }]);
    expect(w.map((x) => Math.round(3 * chargeOf(x))).sort()).toEqual([-1, -1, 2]);
  });
  test('the octet: seven weights, the centre doubly occupied, isospin content N, Σ, Λ, Ξ', () => {
    const o = irrep(1, 1);
    expect(o.weights.length).toBe(7);
    expect(o.weights.find((w) => w.i3x2 === 0 && w.y3 === 0)!.mult).toBe(2);
    expect(o.multiplets.map((m) => [m.y3 / 3, m.i2 / 2])).toEqual([[1, 0.5], [0, 0], [0, 1], [-1, 0.5]]);
  });
  test('the decuplet: a triangle with isospin 3/2, 1, 1/2, 0 from Y = 1 down to −2', () => {
    const d = irrep(3, 0);
    expect(d.weights.every((w) => w.mult === 1)).toBe(true);
    expect(d.multiplets.map((m) => [m.y3 / 3, m.i2 / 2])).toEqual([[1, 1.5], [0, 1], [-1, 0.5], [-2, 0]]);
    expect(d.highest).toEqual({ i3x2: 3, y3: 3 });
    // the corner at the bottom: I3 = 0, Y = −2, charge −1
    const corner = d.weights.find((w) => w.y3 === -6)!;
    expect(corner.i3x2).toBe(0);
    expect(chargeOf(corner)).toBe(-1);
  });
  test('the 27 has a weight of multiplicity 3 at the centre', () => {
    expect(irrep(2, 2).weights.find((w) => w.i3x2 === 0 && w.y3 === 0)!.mult).toBe(3);
  });
  test('products: 3 ⊗ 3̄ = 8 ⊕ 1, 3 ⊗ 3 = 6 ⊕ 3̄, 3 ⊗ 3 ⊗ 3 = 10 ⊕ 8 ⊕ 8 ⊕ 1', () => {
    expect(formatDecomposition(decomposeProduct([[1, 0], [0, 1]]))).toBe('8 ⊕ 1');
    expect(formatDecomposition(decomposeProduct([[1, 0], [1, 0]]))).toBe('6 ⊕ 3̄');
    expect(formatDecomposition(decomposeProduct([[1, 0], [1, 0], [1, 0]]))).toBe('10 ⊕ 8 ⊕ 8 ⊕ 1');
    expect(formatDecomposition(decomposeProduct([[1, 1], [1, 1]]))).toBe('27 ⊕ 10 ⊕ 10̄ ⊕ 8 ⊕ 8 ⊕ 1');
  });
});

describe('the baryons on the diagrams', () => {
  test('the octet is full and the decuplet has exactly one missing corner', () => {
    const o = baryonMultiplet('octet');
    expect(o.every((s) => s.pdg !== null)).toBe(true);
    const centre = o.find((s) => s.i3x2 === 0 && s.strangeness === -1)!;
    expect(centre.all.sort()).toEqual([3122, 3212]);
    const d = baryonMultiplet('decuplet');
    expect(d.length).toBe(10);
    // The table has Δ and Ω⁻ only; Σ* and Ξ* are missing from it, so the widget supplies them
    expect(d.filter((s) => s.pdg !== null).map((s) => s.name).sort()).toEqual(['Delta+', 'Delta++', 'Delta-', 'Delta0', 'Omega-']);
  });
  test('charge, isospin and strangeness of every placed baryon agree with the table', () => {
    for (const kind of ['octet', 'decuplet'] as const)
      for (const s of baryonMultiplet(kind)) for (const id of s.all) {
        const p = particle(id);
        expect(p.charge3 / 3).toBeCloseTo(s.charge, 12);
        expect(p.strangeness).toBe(s.strangeness);
        expect(p.i3x2).toBe(s.i3x2);
      }
  });
  test('Gell-Mann–Nishijima holds for every hadron in the table', () => {
    for (const p of allParticles()) {
      if (p.kind !== 'meson' && p.kind !== 'baryon') continue;
      if (p.charm || p.bottom || p.pdg === 311 || p.pdg === 310 || p.pdg === 130 || p.pdg === 221 || p.pdg === 331 || p.pdg === 223 || p.pdg === 333 || p.pdg === 113 || p.pdg === 111) continue; // I3 not stored for mixtures or heavy quarkonia: zero, fine except K_S/K_L
      const { q, fromNumbers } = gellMannNishijima(p.pdg);
      // heavy flavours carry charge through c, b quarks whose I3 = 0: the relation with Y = B + S + C + B′ still holds
      expect(fromNumbers, p.name).toBeCloseTo(q, 12);
    }
  });
});

describe('masses', () => {
  test('equal spacing predicts the Ω⁻ near 1680 MeV', () => {
    const s = decupletSpacing();
    expect(s.step1).toBeCloseTo(0.1517, 3);
    expect(s.step2).toBeCloseTo(0.1481, 3);
    expect(s.omegaFromLastSpacing).toBeGreaterThan(1.675);
    expect(s.omegaFromLastSpacing).toBeLessThan(1.685);
    expect(s.omegaFromMeanSpacing).toBeCloseTo(1.6818, 3);
    // the measured mass (the table's) is within 0.6 % of both
    expect(Math.abs(DECUPLET_MASSES[-3].mass - s.omegaFromLastSpacing) / DECUPLET_MASSES[-3].mass).toBeLessThan(0.006);
    // the 1962 inputs, Δ(1232) Σ*(1385) Ξ*(1530): ≈ 1680
    const old = decupletSpacing({ delta: 1.232, sigmaStar: 1.385, xiStar: 1.530 });
    expect(old.omegaFromLastSpacing).toBeCloseTo(1.675, 3);
    expect(old.omegaFromMeanSpacing).toBeCloseTo(1.679, 3);
  });
  test('Gell-Mann–Okubo: within 1 % for baryons, 7 % for mesons in squared masses', () => {
    const b = gellMannOkuboBaryons();
    expect(b.lhs).toBeCloseTo(4.5144, 3);
    expect(Math.abs(b.relativeDifference)).toBeLessThan(0.01);
    const m = gellMannOkuboMesons();
    expect(Math.abs(m.relativeDifference)).toBeLessThan(0.08);
  });
  test('the Ω⁻ cannot decay strongly: it is lighter than Ξ K', () => {
    const t = omegaStrongDecayThreshold();
    expect(t.open).toBe(false);
    expect(t.threshold).toBeCloseTo(1.8085, 3);
  });
});

describe('Δ(1232): the pion energy and the size of the peak', () => {
  test('pion kinetic energy at the peak is about 190 MeV and the unitarity limit about 190 mb', () => {
    const mD = 1.232, mp = particle(2212).mass, mpi = particle(211).mass;
    const Epi = (mD * mD - mp * mp - mpi * mpi) / (2 * mp);
    expect((Epi - mpi) * 1000).toBeGreaterThan(185);
    expect((Epi - mpi) * 1000).toBeLessThan(195);
    // the same from four-vectors
    const pi = fromMass(mpi, 0, 0, Math.sqrt(Epi * Epi - mpi * mpi));
    const target = fromMass(mp, 0, 0, 0);
    expect(Math.sqrt(mandelstamS(pi, target))).toBeCloseTo(mD, 9);
    const k = twoBodyMomentum(mD, mpi, mp);
    expect(k).toBeCloseTo(0.2272, 3);
    const sigma = unitarityLimit(k, 3, 0, 1) * GEV2_TO_MB;
    expect(sigma).toBeGreaterThan(185);
    expect(sigma).toBeLessThan(200);
  });
});

describe('quark model', () => {
  test('charges, baryon number and strangeness of every baryon and meson with a simple content', () => {
    for (const p of allParticles()) {
      if (p.kind !== 'meson' && p.kind !== 'baryon') continue;
      if (p.quarks.includes('-') || p.quarks.includes('+') || !p.quarks) continue;
      const n = contentNumbers(parseContent(p.quarks));
      expect(n.charge3, p.name).toBe(p.charge3);
      expect(n.baryon3, p.name).toBe(p.baryon3);
      expect(n.strangeness, p.name).toBe(p.strangeness);
      expect(n.charm, p.name).toBe(p.charm);
      expect(n.bottom, p.name).toBe(p.bottom);
    }
  });
  test('content lookup, including antiparticles', () => {
    expect(hadronsWithContent(parseContent('uud')).map((p) => p.name).sort()).toEqual(['Delta+', 'p']);
    expect(hadronsWithContent(parseContent('uuu')).map((p) => p.name)).toEqual(['Delta++']);
    // the table's names for antiparticles collide (the antiparticle of Δ⁺ is called "Delta-", like ddd): compare PDG IDs
    expect(hadronsWithContent(parseContent('u~u~d~')).map((p) => p.pdg).sort((a, b) => a - b)).toEqual([-2214, -2212]);
    expect(hadronsWithContent(parseContent('ud~')).map((p) => p.name).sort()).toEqual(['pi+', 'rho+']);
    expect(hadronsWithContent(parseContent('ss~')).map((p) => p.name)).toContain('phi');
  });
  test('colour singlets: qq̄ and qqq yes, qq and qqq̄ no, tetra- and pentaquark contents yes', () => {
    const c = (s: string) => parseContent(s);
    expect(hasColourSinglet(c('ud~'))).toBe(true);
    expect(hasColourSinglet(c('uud'))).toBe(true);
    expect(hasColourSinglet(c('uu'))).toBe(false);
    expect(hasColourSinglet(c('uud~'))).toBe(false);
    expect(hasColourSinglet(c('ud'))).toBe(false);
    expect(hasColourSinglet(c('uu~dd~'))).toBe(true);
    expect(hasColourSinglet(c('uudcc~'))).toBe(true);
    expect(hasColourSinglet(c('u~u~d~'))).toBe(true);
    expect(isColourNeutral([{ colour: 'r', anti: false }, { colour: 'g', anti: false }, { colour: 'b', anti: false }])).toBe(true);
    expect(isColourNeutral([{ colour: 'r', anti: false }, { colour: 'r', anti: true }])).toBe(true);
    expect(isColourNeutral([{ colour: 'r', anti: false }, { colour: 'g', anti: true }])).toBe(false);
  });
  test('flavour multiplets of the ground states', () => {
    expect(flavourMultiplets(parseContent('uuu'))).toEqual(['10']);
    expect(flavourMultiplets(parseContent('sss'))).toEqual(['10']);
    expect(flavourMultiplets(parseContent('uud')).sort()).toEqual(['10', '8', '8']);
    expect(flavourMultiplets(parseContent('uds')).sort()).toEqual(['1', '10', '8', '8']);
    expect(flavourMultiplets(parseContent('ud~'))).toEqual(['8']);
  });
  test('magnetic moments: the quark model predicts μp/μn = −3/2, measured −1.46', () => {
    const m = octetMoments(equalMassQuarkMoments());
    expect(m.p).toBeCloseTo(3, 12);
    expect(m.n).toBeCloseTo(-2, 12);
    expect(m.p / m.n).toBeCloseTo(-1.5, 12);
    expect(MEASURED_MOMENTS.p / MEASURED_MOMENTS.n).toBeCloseTo(-1.4599, 4);
    // the fit to the nucleons
    const fit = momentsFitToNucleons();
    const back = octetMoments({ ...fit, s: 0 });
    expect(back.p).toBeCloseTo(MEASURED_MOMENTS.p, 10);
    expect(back.n).toBeCloseTo(MEASURED_MOMENTS.n, 10);
    // implied constituent masses, in MeV: about 338 for u and about 510 for s
    const mp = particle(2212).mass * 1000;
    expect(constituentMassRatio(2 / 3, fit.u) * mp).toBeGreaterThan(330);
    expect(constituentMassRatio(2 / 3, fit.u) * mp).toBeLessThan(345);
    expect(constituentMassRatio(-1 / 3, MEASURED_MOMENTS.Lambda) * mp).toBeGreaterThan(500);
    expect(constituentMassRatio(-1 / 3, MEASURED_MOMENTS.Lambda) * mp).toBeLessThan(520);
  });
});
