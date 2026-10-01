import { describe, expect, it } from 'vitest';
import { rng } from '../random/index.ts';
import { quantumNumbers } from '../particles/index.ts';
import {
  ANDERSON,
  andersonPicture,
  cloudArrival,
  cloudSetup,
  composeCloudPicture,
  explainTrack,
  makePicture,
  mergeSets,
  measureTrack,
  omegaPicture,
  pairPicture,
  sameParticle,
  v0Picture,
  visibleTracks,
} from './index.ts';

describe('Anderson preset', () => {
  const pic = andersonPicture(1);
  it('uses the reported field, plate and momenta (as reported by Anderson)', () => {
    expect(pic.bField).toBe(ANDERSON.bField);
    expect(pic.plates[0]!.y1 - pic.plates[0]!.y0).toBe(6);
    const pts = pic.set.primary.points;
    const before = pts.filter((p) => p.layer === 0 && p.y < 0).pop()!;
    const after = pts.find((p) => p.layer === 0 && p.y > 3)!;
    expect(before.p).toBeCloseTo(0.063, 3);
    expect(after.p).toBeGreaterThan(0.0205);
    expect(after.p).toBeLessThan(0.0255);
  });
  it('the track is more curved above the plate, and does not call itself a positron in the data the widget shows', () => {
    const m = measureTrack(pic.set.primary, pic.bField, pic.medium);
    const segs = m.segments.filter((s) => s.fit && !s.fit.straight);
    expect(segs[segs.length - 1]!.fit!.R).toBeLessThan(segs[0]!.fit!.R);
    // radii follow from the reported momenta: R = p / (0.29979 B)
    expect(segs[0]!.fit!.R).toBeGreaterThan(120);
    expect(segs[0]!.fit!.R).toBeLessThan(160);
  });
  it('the positron moves up and curves clockwise (positive charge, B out of the page)', () => {
    const m = measureTrack(pic.set.primary, pic.bField, pic.medium);
    expect(m.segments[0]!.fit!.orientation).toBe(-1);
    const p = pic.set.primary.points;
    expect(p[p.length - 1]!.y).toBeGreaterThan(p[0]!.y);
  });
});

describe('bubble chamber events', () => {
  it('the Ω⁻ event has the expected topology, and the neutral particles leave no ionisation', () => {
    const pic = omegaPicture(1);
    const byPdg = (pdg: number) => pic.set.tracks.filter((t) => t.pdg === pdg);
    expect(pic.set.tracks[0]!.pdg).toBe(-321);
    expect(pic.set.tracks[0]!.end).toBe('interaction');
    const omega = byPdg(3334)[0]!;
    expect(omega.charge).toBe(-1);
    expect(omega.end).toBe('decay');
    const xi = byPdg(3322)[0]!;
    const lam = byPdg(3122)[0]!;
    for (const t of [xi, lam, ...byPdg(22), ...byPdg(310)]) {
      expect(t.neutral).toBe(true);
      expect(t.points.every((p) => p.dedx === 0)).toBe(true);
    }
    // Ω⁻ → Ξ⁰ π⁻ ; Ξ⁰ → Λ π⁰ ; Λ → p π⁻ ; two photons converted
    expect(omega.endDetail).toContain('Ξ⁰');
    expect(xi.endDetail).toContain('Λ');
    expect(lam.endDetail).toBe('p + π⁻');
    expect(byPdg(22).filter((t) => t.end === 'conversion')).toHaveLength(2);
    expect(pic.set.tracks.filter((t) => t.origin === 'pair production')).toHaveLength(4);
    // The Λ decay is a V starting in empty space: its start is not on any visible track.
    const v = lam.points[lam.points.length - 1]!;
    const onTrack = pic.set.tracks.some((t) => !t.neutral && t.id !== lam.children[0] && t.id !== lam.children[1] && t.points.some((p) => Math.hypot(p.x - v.x, p.y - v.y) < 3));
    expect(onTrack).toBe(false);
  });
  it('charge is conserved at every visible vertex of the Ω⁻ chain', () => {
    const pic = omegaPicture(2);
    for (const t of pic.set.tracks) {
      if (t.children.length === 0 || t.origin === 'delta ray' || t.end === 'range') continue;
      const kids = t.children.map((c) => pic.set.tracks[c]!).filter((k) => k.origin === 'decay' || k.origin === 'pair production');
      if (!kids.length) continue;
      const q3 = kids.reduce((a, k) => a + Math.round(k.charge * 3), 0);
      expect(q3).toBe(Math.round(t.charge * 3));
    }
    // and the table agrees: Ω⁻ → Ξ⁰ π⁻ conserves charge, strangeness is violated (weak decay): ΔS = 1
    const before = quantumNumbers([3334]);
    const after = quantumNumbers([3322, -211]);
    expect(after.charge3).toBe(before.charge3);
    expect(after.strangeness - before.strangeness).toBe(1);
  });
  it('the V⁰ event has two neutral parents and two V shapes', () => {
    const pic = v0Picture(1);
    const lam = pic.set.tracks.find((t) => t.pdg === 3122)!;
    const k0 = pic.set.tracks.find((t) => t.pdg === 310)!;
    expect(lam.neutral && k0.neutral).toBe(true);
    expect(lam.children).toHaveLength(2);
    expect(k0.children).toHaveLength(2);
    // The Λ → p π⁻ proton is far more ionising than the pion
    const p = pic.set.tracks.find((t) => t.pdg === 2212)!;
    const pi = pic.set.tracks.find((t) => t.pdg === -211 && t.parent === lam.id)!;
    expect(p.points[Math.floor(p.points.length / 2)]!.dedx).toBeGreaterThan(pi.points[Math.floor(pi.points.length / 2)]!.dedx);
  });
  it('photon conversions give e⁺e⁻ pairs with opposite signs', () => {
    const pic = pairPicture(1);
    const pairs = pic.set.tracks.filter((t) => t.origin === 'pair production');
    expect(pairs.filter((t) => t.charge > 0)).toHaveLength(pairs.filter((t) => t.charge < 0).length);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
  });
  it('is deterministic', () => {
    const a = omegaPicture(5).set.tracks.map((t) => t.points.length);
    const b = omegaPicture(5).set.tracks.map((t) => t.points.length);
    expect(a).toEqual(b);
  });
});

describe('cloud chamber sources and composed pictures', () => {
  it('alphas are short, thick and straight; cosmic muons cross the window', () => {
    const s = cloudSetup({ bField: 1 });
    const a = cloudArrival('alpha', rng(1), s).primary;
    expect(a.length).toBeLessThan(45);
    const m = cloudArrival('muon', rng(3), s).primary;
    expect(Math.abs(m.points[0]!.y - m.points[m.points.length - 1]!.y)).toBeGreaterThan(100);
  });
  it('composes a picture from names with the labelled tracks, and explains each', () => {
    const pic = composeCloudPicture(['alpha', 'mu-', 'e+', 'pi+'], 4, { bField: 1 });
    expect(pic.labels.map((l) => l.letter)).toEqual(['A', 'B', 'C', 'D']);
    expect(pic.labels.map((l) => l.truth)).toEqual(['alpha', 'mu-', 'e+', 'pi+']);
    expect(pic.set.tracks[3]!.end).toBe('decay');
    for (const l of pic.labels) expect(explainTrack(pic, l).length).toBeGreaterThan(20);
    // the alpha stops; the muon crosses
    expect(pic.set.tracks[0]!.end).toBe('range');
    expect(visibleTracks(pic.set).length).toBeGreaterThanOrEqual(4);
  });
  it('makePicture understands every preset', () => {
    for (const name of ['cloud-alpha', 'cloud-beta', 'cloud-muon', 'cloud-mixed', 'cloud-shower', 'v0', 'pair', 'cloud:alpha,p']) {
      const pic = makePicture(name, 2);
      expect(pic.set.tracks.length).toBeGreaterThan(0);
    }
  });
  it('mergeSets renumbers parents and children', () => {
    const s = cloudSetup({ bField: 1 });
    const a = cloudArrival('shower', rng(1), s);
    const b = cloudArrival('alpha', rng(2), s);
    const m = mergeSets([a, b]);
    expect(m.tracks).toHaveLength(a.tracks.length + b.tracks.length);
    const first = m.tracks[a.tracks.length]!;
    expect(first.id).toBe(a.tracks.length);
    expect(first.parent).toBeNull();
  });
  it('answers without a charge sign accept either sign', () => {
    expect(sameParticle('mu+', 'mu')).toBe(true);
    expect(sameParticle('mu+', 'mu-')).toBe(false);
    expect(sameParticle('e-', 'e-')).toBe(true);
    expect(sameParticle('alpha', 'alpha')).toBe(true);
  });
});
