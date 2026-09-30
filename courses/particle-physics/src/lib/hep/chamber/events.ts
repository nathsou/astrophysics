/**
 * Ready-made chamber pictures: particle sources for a cloud chamber, Anderson's positron photograph, and three
 * bubble-chamber events (an Ω⁻ production, a pair of V⁰ decays, and photon conversions), all built from `simulateEvent`.
 *
 * Every picture is a re-simulation from the physics in this library; none is a copy of a photograph.
 */
import { choice, normal, uniform, type Rng, rng as makeRng } from '../random/index.ts';
import { add, fromMass, phaseSpace, pmag, twoBodyDecay, type P4 } from '../kinematics/index.ts';
import { particle } from '../particles/index.ts';
import { MEDIA, MATERIALS, mipLoss, type MediumName } from './material.ts';
import { ALPHA_PDG, info, simulateEvent, simulateTrack, type Bounds, type EventOptions, type Injection, type Plate, type Track, type TrackSet, type Vec3 } from './track.ts';
import { measureTrack, type TrackMeasurement } from './measure.ts';

// ───────────────────────── pictures ─────────────────────────
export interface PictureLabel {
  letter: string;
  trackId: number;
  /** Truth: a particle id such as "alpha", "mu-", "e+", "p", "pi-". */
  truth: string;
  /** For a track crossing a plate: did it move up or down the picture? */
  direction?: 'up' | 'down';
}

export interface Picture {
  id: string;
  title: string;
  kind: 'cloud' | 'bubble';
  medium: MediumName;
  bField: number;
  /** Width and height (mm) of the window, centred on the origin. */
  width: number;
  height: number;
  set: TrackSet;
  plates: Plate[];
  sensitiveZ?: [number, number];
  labels: PictureLabel[];
  /** What happened, step by step, in words (shown after the reader has tried). */
  steps: string[];
  /** An honest description of what the picture is. */
  note: string;
  /** Does the picture include a source needle / where (cloud chamber)? */
  source?: { x: number; y: number };
}

/** Every track of a set that belongs to a `steps` narrative etc. is in `set`; this lists the visible charged ones. */
export function visibleTracks(set: TrackSet): Track[] {
  return set.tracks.filter((t) => !t.neutral && t.points.some((p) => p.visible));
}

/** Join several event sets into one, renumbering track ids. */
export function mergeSets(sets: TrackSet[]): TrackSet {
  const first = sets[0]!;
  const tracks: Track[] = [];
  for (const s of sets) {
    const shift = tracks.length;
    for (const t of s.tracks) {
      tracks.push({ ...t, id: t.id + shift, parent: t.parent === null ? null : t.parent + shift, children: t.children.map((c) => c + shift), kinks: t.kinks.map((k) => ({ ...k })) });
    }
  }
  return { ...first, tracks, primary: tracks[0]! };
}

// ───────────────────────── cloud chamber sources ─────────────────────────
export interface CloudSetup {
  /** Window size (mm), centred on the origin. */
  width: number;
  height: number;
  /** Magnetic field along +z (T). */
  bField: number;
  /** Absorber plate(s) across the middle. */
  plates: Plate[];
  /** The sensitive layer is |z| ≤ depth/2. */
  depth: number;
  /** Position of the radioactive needle (mm). */
  source: { x: number; y: number };
}

export function cloudSetup(o: Partial<Omit<CloudSetup, 'plates'>> & { plate?: boolean | number } = {}): CloudSetup {
  const width = o.width ?? 300;
  const height = o.height ?? 190;
  const t = typeof o.plate === 'number' ? o.plate : o.plate ? 6 : 0;
  return {
    width,
    height,
    bField: o.bField ?? 0,
    depth: o.depth ?? 40,
    source: o.source ?? { x: -width * 0.3, y: -height * 0.12 },
    plates: t > 0 ? [{ y0: -t / 2, y1: t / 2, material: 'lead' }] : [],
  };
}

export type SourceKind = 'alpha' | 'beta' | 'muon' | 'mixed' | 'shower';

const boundsOf = (s: CloudSetup): Bounds => ({ xMin: -s.width / 2, xMax: s.width / 2, yMin: -s.height / 2, yMax: s.height / 2, zMin: -1e4, zMax: 1e4 });

function baseOpts(s: CloudSetup, rng: Rng): Omit<EventOptions, 'particles'> {
  return {
    bField: s.bField,
    medium: 'air+alcohol vapour',
    rng,
    plates: s.plates,
    bounds: boundsOf(s),
    sensitiveZ: [-s.depth / 2, s.depth / 2],
    maxPath: 2500,
  };
}

function unit(v: Vec3): Vec3 {
  const n = Math.hypot(...v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** A beta electron's kinetic energy (MeV) from the allowed shape p·E·(T0 − T)², endpoint T0. */
function betaEnergy(rng: Rng, t0: number): number {
  const me = 0.511;
  for (let i = 0; i < 1000; i++) {
    const T = 0.03 + (t0 - 0.03) * rng();
    const E = T + me;
    const p = Math.sqrt(T * (T + 2 * me));
    const w = p * E * (t0 - T) ** 2;
    const wmax = 0.45 * t0 ** 2; // generous envelope for t0 ≈ 1 MeV
    if (rng() * wmax * 1.6 <= w) return T;
  }
  return t0 / 3;
}

function cosmicMomentum(rng: Rng): number {
  return Math.min(100, Math.max(0.1, Math.exp(normal(rng, Math.log(1.6), 1.0))));
}

/** Injection of one cosmic-ray muon crossing the window from the top. */
function cosmicMuon(rng: Rng, s: CloudSetup, p?: number): Injection {
  // Zenith angle from cos²θ, azimuth uniform; keep those that run close to the picture plane (the layer is thin).
  let u: Vec3 = [0, -1, 0];
  for (let i = 0; i < 200; i++) {
    const th = Math.acos(Math.cbrt(1 - rng())); // cos²θ → cdf 1 − cos³θ
    const ph = 2 * Math.PI * rng();
    u = [Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)];
    if (Math.abs(u[2]) < 0.15 && Math.abs(u[0]) < 0.75) break;
  }
  const pdg = rng() < 0.56 ? -13 : 13; // μ⁺/μ⁻ ≈ 1.27 at sea level
  const x = uniform(rng, -s.width / 2, s.width / 2) - (u[0] / -u[1]) * s.height * 0.5;
  return { pdg, p: p ?? cosmicMomentum(rng), direction: u, position: [x, s.height / 2, uniform(rng, -s.depth / 2 + 4, s.depth / 2 - 4)] };
}

/** Everything one "arrival" makes: a single incoming particle (or a shower) with its secondaries. */
export function cloudArrival(kind: SourceKind, rng: Rng, s: CloudSetup): TrackSet {
  const base = baseOpts(s, rng);
  const z0 = () => uniform(rng, -s.depth / 2 + 5, s.depth / 2 - 5);
  const inPlane = (): Vec3 => {
    const a = 2 * Math.PI * rng();
    return unit([Math.cos(a), Math.sin(a), normal(rng, 0, 0.1)]);
  };
  switch (kind) {
    case 'alpha':
      return simulateEvent({ ...base, particles: [{ pdg: ALPHA_PDG, T: 0.0053, direction: inPlane(), position: [s.source.x, s.source.y, z0()] }] });
    case 'beta':
      return simulateEvent({ ...base, particles: [{ pdg: 11, T: betaEnergy(rng, 1.0) / 1000, direction: inPlane(), position: [s.source.x, s.source.y, z0()] }] });
    case 'muon':
      return simulateEvent({ ...base, particles: [cosmicMuon(rng, s)] });
    case 'shower': {
      const p = uniform(rng, 0.25, 0.6);
      const x = uniform(rng, -s.width / 4, s.width / 4);
      // Several plates, as in the multi-plate chambers that showed showers: 6 mm of lead at y = −42, 0 and +42 mm.
      const plates: Plate[] = s.plates.length ? s.plates : [-42, 0, 42].map((y) => ({ y0: y - 3, y1: y + 3, material: 'lead' as const }));
      return simulateEvent({ ...base, plates, maxTracks: 260, particles: [{ pdg: rng() < 0.5 ? 11 : -11, p, direction: unit([normal(rng, 0, 0.05), -1, normal(rng, 0, 0.03)]), position: [x, s.height / 2, 0] }] });
    }
    case 'mixed': {
      const k = choice(rng, [0.55, 0.3, 0.15]);
      if (k === 0) return cloudArrival('muon', rng, s);
      if (k === 1) {
        // A Compton or photo-electron: a low-energy electron starting anywhere in the layer.
        const T = Math.exp(uniform(rng, Math.log(0.05), Math.log(2))) / 1000;
        const pos: Vec3 = [uniform(rng, -s.width / 2 + 10, s.width / 2 - 10), uniform(rng, -s.height / 2 + 10, s.height / 2 - 10), z0()];
        const pdg = rng() < 0.93 ? 11 : -11;
        return simulateEvent({ ...base, particles: [{ pdg, T, direction: inPlane(), position: pos }] });
      }
      // An alpha from radon and its decay products, from somewhere in the gas.
      const pos: Vec3 = [uniform(rng, -s.width / 2 + 20, s.width / 2 - 20), uniform(rng, -s.height / 2 + 20, s.height / 2 - 20), z0()];
      return simulateEvent({ ...base, particles: [{ pdg: ALPHA_PDG, T: 0.0055, direction: inPlane(), position: pos }] });
    }
  }
}

// ───────────────────────── composing a picture from named particles ─────────────────────────
export const PARTICLE_CHOICES: { id: string; pdg: number; label: string; plain: string }[] = [
  { id: 'alpha', pdg: ALPHA_PDG, label: 'α particle', plain: 'an alpha particle (a helium nucleus)' },
  { id: 'e-', pdg: 11, label: 'electron', plain: 'an electron' },
  { id: 'e+', pdg: -11, label: 'positron', plain: 'a positron' },
  { id: 'mu-', pdg: 13, label: 'μ⁻ (negative muon)', plain: 'a negative muon' },
  { id: 'mu+', pdg: -13, label: 'μ⁺ (positive muon)', plain: 'a positive muon' },
  { id: 'pi-', pdg: -211, label: 'π⁻ (negative pion)', plain: 'a negative pion' },
  { id: 'pi+', pdg: 211, label: 'π⁺ (positive pion)', plain: 'a positive pion' },
  { id: 'K-', pdg: -321, label: 'K⁻ (negative kaon)', plain: 'a negative kaon' },
  { id: 'K+', pdg: 321, label: 'K⁺ (positive kaon)', plain: 'a positive kaon' },
  { id: 'p', pdg: 2212, label: 'proton', plain: 'a proton' },
  { id: 'pbar', pdg: -2212, label: 'antiproton', plain: 'an antiproton' },
];

export const pdgOfChoice = (id: string): number => PARTICLE_CHOICES.find((c) => c.id === id)?.pdg ?? 0;
export const choiceOfPdg = (pdg: number): string => PARTICLE_CHOICES.find((c) => c.pdg === pdg)?.id ?? String(pdg);

/** Do two particle ids agree? An id without a sign ("mu", "pi", "e") accepts either charge. */
export function sameParticle(truth: string, answer: string): boolean {
  if (truth === answer) return true;
  const strip = (s: string) => s.replace(/[+-]$/, '');
  const hasSign = (s: string) => /[+-]$/.test(s);
  if (!hasSign(answer) && strip(truth) === answer) return true;
  if (answer === 'proton' && truth === 'p') return true;
  if (answer === 'alpha particle' && truth === 'alpha') return true;
  return false;
}

/** Typical kinematics for each named particle in a cloud-chamber picture: what makes it recognisable. */
function typicalInjection(id: string, rng: Rng, s: CloudSetup, slot: number, nSlots: number): Injection {
  const pdg = pdgOfChoice(id);
  const colW = s.width / nSlots;
  const x = -s.width / 2 + colW * (slot + 0.5) + uniform(rng, -colW * 0.15, colW * 0.15);
  const z = uniform(rng, -s.depth / 2 + 6, s.depth / 2 - 6);
  const tiltz = normal(rng, 0, 0.03);
  // Start at the top (or the source for α) and head roughly downward, fanning out a little.
  const down = (tilt: number): Vec3 => unit([tilt, -1, tiltz]);
  const tilt = uniform(rng, -0.25, 0.25);
  const top = s.height / 2;
  switch (id) {
    case 'alpha':
      return { pdg, T: 0.0053, direction: unit([uniform(rng, -0.4, 0.4), -1, tiltz]), position: [x, top - uniform(rng, 10, 60), z] };
    case 'e-':
    case 'e+':
      return { pdg, p: uniform(rng, 0.012, 0.035), direction: down(tilt), position: [x, top, z] };
    case 'mu-':
    case 'mu+':
      return { pdg, p: uniform(rng, 0.14, 0.3), direction: down(tilt), position: [x, top, z] };
    case 'pi-':
    case 'pi+':
      return { pdg, p: uniform(rng, 0.16, 0.26), direction: down(tilt), position: [x, top, z] };
    case 'K-':
    case 'K+':
      return { pdg, p: uniform(rng, 0.22, 0.3), direction: down(tilt), position: [x, top, z] };
    case 'p':
    case 'pbar':
      return { pdg, T: uniform(rng, 0.0018, 0.0028), direction: down(tilt), position: [x, top - uniform(rng, 10, 50), z] };
  }
  return { pdg, p: 0.1, direction: down(tilt), position: [x, top, z] };
}

/**
 * A cloud-chamber picture containing exactly the named particles (ids from PARTICLE_CHOICES), one per label A, B, C…
 * Pions are made to decay in flight so that their kink is on the picture (lifetimes are exaggerated for teaching).
 */
export function composeCloudPicture(names: string[], seed: number, o: { bField?: number; plate?: boolean } = {}): Picture {
  const rng = makeRng(seed);
  const s = cloudSetup({ bField: o.bField ?? 1.0, plate: o.plate ?? false, width: 300, height: 190 });
  const base = baseOpts(s, rng);
  const order = names.map((n, i) => ({ n, i }));
  const inj = order.map(({ n }, slot) => ({ ...typicalInjection(n, rng, s, slot, names.length), label: String.fromCharCode(65 + slot) }));
  const force: Record<number, number[]> = {};
  inj.forEach((j, i) => {
    const id = names[i]!;
    if (id === 'pi+' || id === 'pi-' || id === 'K+' || id === 'K-') (force[j.pdg] ??= []).push(uniform(rng, 70, 110));
  });
  const set = simulateEvent({ ...base, particles: inj, forceDecayAt: force, decays: false });
  const labels: PictureLabel[] = names.map((n, i) => ({ letter: String.fromCharCode(65 + i), trackId: i, truth: n }));
  return {
    id: 'cloud-compose',
    title: 'A cloud-chamber picture',
    kind: 'cloud',
    medium: 'air+alcohol vapour',
    bField: s.bField,
    width: s.width,
    height: s.height,
    set,
    plates: s.plates,
    sensitiveZ: [-s.depth / 2, s.depth / 2],
    labels,
    steps: labels.map((l) => `${l.letter}: ${PARTICLE_CHOICES.find((c) => c.id === l.truth)?.plain ?? l.truth}`),
    note: 'A simulated picture. Decay lengths of unstable particles are shortened so that the kink fits in the window.',
    source: s.source,
  };
}

// ───────────────────────── Anderson's photograph ─────────────────────────
/**
 * Carl Anderson's 1932 photograph, re-simulated. The field (about 1.5 T = 15 kG), the 6 mm lead plate and the momenta
 * 63 MeV/c before and 23 MeV/c after the plate are as reported by Anderson (Phys. Rev. 43, 491 (1933)). These figures
 * were typed from memory and must be checked against the paper by the reviewer.
 */
export const ANDERSON = {
  bField: 1.5,
  plateMm: 6,
  pBefore: 0.063,
  pAfter: 0.023,
} as const;

export function andersonPicture(seed = 1): Picture {
  const s = cloudSetup({ width: 220, height: 200, bField: ANDERSON.bField, plate: ANDERSON.plateMm, depth: 40 });
  // A positron moving upwards, with a small dip out of the picture plane so that its helix leaves the thin sensitive layer.
  const dir = unit([0.05, 1, 0.12]);
  const start: Vec3 = [-40, -s.height / 2, -12];
  const inj = (): Injection => ({ pdg: -11, p: ANDERSON.pBefore, direction: dir, position: start, label: 'A' });
  // Search the random streams for the first in which the simulated plate loss matches the reported 23 MeV/c (a cheap run
  // that stops just above the plate), then run that stream in full.
  let bestK = 0;
  let bestErr = Infinity;
  for (let k = 0; k < 600; k++) {
    const quick = simulateEvent({ ...baseOpts(s, makeRng(seed * 1000 + k)), bounds: { ...boundsOf(s), yMax: 12 }, particles: [inj()] });
    const above = quick.primary.points.filter((p) => p.layer === 0 && p.y > 3);
    if (!above.length) continue;
    const err = Math.abs(above[0]!.p - ANDERSON.pAfter);
    if (err < bestErr) {
      bestErr = err;
      bestK = k;
      if (err < 0.0015) break;
    }
  }
  const best = simulateEvent({ ...baseOpts(s, makeRng(seed * 1000 + bestK)), particles: [inj()] });
  const set = best!;
  return {
    id: 'anderson',
    title: "Anderson's cloud-chamber photograph, re-simulated",
    kind: 'cloud',
    medium: 'air+alcohol vapour',
    bField: s.bField,
    width: s.width,
    height: s.height,
    set,
    plates: s.plates,
    sensitiveZ: [-s.depth / 2, s.depth / 2],
    labels: [{ letter: 'A', trackId: 0, truth: 'e+', direction: 'up' }],
    steps: [
      'The track is more strongly curved above the plate than below it, so the particle lost energy in the plate: it moved from the less curved side to the more curved side, upwards.',
      'Moving upwards in a field pointing out of the page, it turns clockwise. A positive charge does that (F = qv × B); a negative charge moving upwards would turn the other way.',
      'Its ionisation is that of a minimum-ionising light particle, far too thin for a proton of this momentum. The mass is the electron\'s. A light, positive particle: the positron.',
    ],
    note: 'A re-simulation of the kind of event Anderson photographed, with the field, the plate and the momenta as he reported them: not his photograph.',
    source: undefined,
  };
}

/**
 * Another exposure of the Anderson-style chamber: one cosmic-ray particle crossing the 6 mm lead plate in the 1.5 T field,
 * drawn from electrons, positrons, muons and protons of momenta that leave a measurable track on both sides, moving up or
 * down. The reader has to work out which, from the picture alone.
 */
export function andersonExposure(seed: number): Picture {
  const s = cloudSetup({ width: 220, height: 200, bField: ANDERSON.bField, plate: ANDERSON.plateMm, depth: 40 });
  const kinds: { id: string; pMin: number; pMax: number; w: number }[] = [
    { id: 'e-', pMin: 0.04, pMax: 0.11, w: 3 },
    { id: 'e+', pMin: 0.04, pMax: 0.11, w: 3 },
    { id: 'mu-', pMin: 0.3, pMax: 0.9, w: 2 },
    { id: 'mu+', pMin: 0.3, pMax: 0.9, w: 2 },
    { id: 'p', pMin: 0.45, pMax: 0.7, w: 2 },
  ];
  for (let k = 0; k < 200; k++) {
    const rng = makeRng(seed * 7919 + k);
    const kind = kinds[choice(rng, kinds.map((x) => x.w))]!;
    const up = rng() < 0.35;
    const p = uniform(rng, kind.pMin, kind.pMax);
    const dir = unit([normal(rng, 0, 0.05), up ? 1 : -1, uniform(rng, -0.1, 0.1)]);
    const set = simulateEvent({
      ...baseOpts(s, rng),
      particles: [{ pdg: pdgOfChoice(kind.id), p, direction: dir, position: [uniform(rng, -60, 40), up ? -s.height / 2 : s.height / 2, uniform(rng, -10, 10)], label: 'A' }],
    });
    const t = set.primary;
    const side = (f: (y: number) => boolean) => t.points.filter((q) => q.visible && q.layer === 0 && f(q.y)).length;
    if (side((y) => y > 3) < 25 || side((y) => y < -3) < 25) continue;
    return {
      id: 'anderson-exposure',
      title: 'Another exposure',
      kind: 'cloud',
      medium: 'air+alcohol vapour',
      bField: s.bField,
      width: s.width,
      height: s.height,
      set,
      plates: s.plates,
      sensitiveZ: [-s.depth / 2, s.depth / 2],
      labels: [{ letter: 'A', trackId: 0, truth: kind.id, direction: up ? 'up' : 'down' }],
      steps: [],
      note: 'A simulated exposure.',
    };
  }
  return andersonPicture(seed);
}

// ───────────────────────── bubble chamber events ─────────────────────────
const BUBBLE = { width: 800, height: 500, depth: 300, bField: 2.0 };

function bubbleBase(rng: Rng, bField: number): Omit<EventOptions, 'particles'> {
  return {
    bField,
    medium: 'liquid hydrogen',
    rng,
    bounds: { xMin: -BUBBLE.width / 2, xMax: BUBBLE.width / 2, yMin: -BUBBLE.height / 2, yMax: BUBBLE.height / 2, zMin: -BUBBLE.depth / 2, zMax: BUBBLE.depth / 2 },
    decays: false,
    maxStep: 4,
  };
}

function decayLength(mass: number, p: number, pdg: number, rng: Rng, lo = 0.3, hi = 0.7): number {
  const lam = (p / mass) * 299.792458 * info(pdg).lifetime * 1e9; // mm
  const q = uniform(rng, lo, hi);
  return -lam * Math.log(1 - q);
}

/** Pick three-body phase-space events (unweighted) until one passes `ok`. */
function sampleThreeBody(rng: Rng, total: P4, masses: number[], ok: (p: P4[]) => boolean): P4[] {
  let wmax = 0;
  const probe = rng.fork('probe');
  for (let i = 0; i < 300; i++) wmax = Math.max(wmax, phaseSpace(probe, total, masses).weight);
  wmax *= 1.2;
  for (let i = 0; i < 200000; i++) {
    const r = phaseSpace(rng, total, masses);
    if (rng() * wmax > r.weight) continue;
    if (ok(r.p)) return r.p;
  }
  throw new Error('no event passed the selection');
}

const PROTON_MASS = particle(2212).mass;

/**
 * K⁻ p → Ω⁻ K⁺ K⁰ at 5 GeV/c with the decay chain Ω⁻ → Ξ⁰ π⁻, Ξ⁰ → Λ π⁰, Λ → p π⁻, π⁰ → γγ → e⁺e⁻ twice.
 * A re-simulation of the topology of the 1964 Brookhaven event (Barnes et al., Phys. Rev. Lett. 12, 204 (1964)): the
 * beam momentum is as reported (from memory, to be verified); momenta, angles and decay lengths are drawn from the
 * kinematics and are not measurements from the photograph. The K⁰ is followed as its K_S component. The photon
 * conversions are forced to happen within the chamber (in liquid hydrogen most photons leave without converting).
 */
export function omegaPicture(seed = 1, bField = BUBBLE.bField): Picture {
  const rng = makeRng(seed);
  const mK = particle(321).mass;
  const pBeam = 5.0;
  // The beam track, to the interaction vertex.
  const vertexPath = 240;
  const startPos: Vec3 = [-BUBBLE.width / 2, 10, 0];
  const beam = simulateEvent({ ...bubbleBase(rng.fork('beam'), bField), particles: [{ pdg: -321, p: pBeam, direction: [1, 0, 0], position: startPos, endAt: vertexPath, label: 'K⁻' }] });
  const bt = beam.primary;
  const last = bt.points[bt.points.length - 1]!;
  const vertex: Vec3 = [last.x, last.y, last.z];
  const beamP4 = fromMass(mK, pBeam, 0, 0); // direction is very nearly +x over 240 mm at 5 GeV/c
  const target = fromMass(PROTON_MASS, 0, 0, 0);
  const total = add(beamP4, target);
  const mOmega = particle(3334).mass;
  const mK0 = particle(310).mass;
  const fin = sampleThreeBody(rng.fork('prod'), total, [mOmega, mK0, mK], (p) => {
    const om = p[0]!;
    const kp = p[2]!;
    const pp = pmag(om);
    const inPlane = (v: P4) => Math.abs(v.pz) < 0.3 * pmag(v);
    return pp > 1.4 && pp < 3.2 && om.px > 0 && inPlane(om) && kp.px > 0 && inPlane(kp) && pmag(kp) > 0.6 && Math.abs(p[1]!.pz) < 0.5 * pmag(p[1]!) && p[1]!.px > 0;
  });
  const [omega, k0, kplus] = fin as [P4, P4, P4];
  // The Ω⁻ decays: Ω⁻ → Ξ⁰ π⁻.
  const mXi = particle(3322).mass;
  const mPi = particle(-211).mass;
  const [xi, piOm] = twoBodyDecay(rng.fork('om'), omega, mXi, mPi);
  // Ξ⁰ → Λ π⁰
  const mLam = particle(3122).mass;
  const mPi0 = particle(111).mass;
  const [lam, pi0] = twoBodyDecay(rng.fork('xi'), xi, mLam, mPi0);
  void piOm;
  void lam;
  void pi0;
  const Lomega = decayLength(mOmega, pmag(omega), 3334, rng, 0.45, 0.6);
  const Lxi = decayLength(mXi, pmag(xi), 3322, rng, 0.4, 0.7);
  const Llam = decayLength(mLam, pmag(lam), 3122, rng, 0.35, 0.6);
  const Lk0 = decayLength(mK0, pmag(k0), 310, rng, 0.25, 0.5);
  // Everything from the vertex on, in one event. The Ω⁻ decay is seeded by `channel` and forced lengths; its products
  // are then generated by the same two-body kinematics inside simulateEvent (same seed stream, so the chain is consistent).
  const opts: EventOptions = {
    ...bubbleBase(rng.fork('event'), bField),
    particles: [
      { pdg: 3334, p4: omega, position: vertex, label: 'Ω⁻' },
      { pdg: 321, p4: kplus, position: vertex, label: 'K⁺' },
      { pdg: 310, p4: k0, position: vertex, label: 'K⁰' },
    ],
    forceDecayAt: { 3334: Lomega, 3322: Lxi, 3122: Llam, 310: Lk0 },
    forceConversionAt: [uniform(rng, 60, 130), uniform(rng, 140, 260)],
    channel: { 3334: [3322, -211], 3322: [3122, 111], 3122: [2212, -211], 310: [211, -211], 111: [22, 22] },
  };
  const ev = simulateEvent(opts);
  // Prepend the beam track (ids shift by one).
  const set = mergeSets([beam, ev]);
  const byName = (name: string) => set.tracks.find((t) => t.name === name);
  const labels: PictureLabel[] = [];
  const add1 = (letter: string, t: Track | undefined, truth: string) => t && labels.push({ letter, trackId: t.id, truth });
  add1('A', set.tracks[0], 'K-');
  add1('B', set.tracks.find((t) => t.pdg === 3334), 'Omega-');
  add1('C', set.tracks.find((t) => t.pdg === 321), 'K+');
  void byName;
  return {
    id: 'omega',
    title: 'Ω⁻ production and decay: a simulation of the topology',
    kind: 'bubble',
    medium: 'liquid hydrogen',
    bField,
    width: BUBBLE.width,
    height: BUBBLE.height,
    set,
    plates: [],
    labels,
    steps: [
      `A K⁻ beam of ${pBeam} GeV/c enters from the left and strikes a proton at rest: K⁻ p → Ω⁻ K⁺ K⁰.`,
      'The Ω⁻ is negative and leaves a track; so does the K⁺. The K⁰ is neutral and leaves none.',
      'The Ω⁻ decays to Ξ⁰ π⁻: only the π⁻ shows. The Ξ⁰ is neutral and crosses empty liquid.',
      'Ξ⁰ → Λ π⁰: both neutral. The π⁰ decays at once into two photons, which are neutral too.',
      'Each photon converts to an e⁺e⁻ pair (forced here so that they show): two V shapes that point back to the Ξ⁰ decay.',
      'The Λ decays to p π⁻: a V in empty space, pointing back to the Ξ⁰ decay.',
    ],
    note: "A simulation of the event's topology, not the photograph. Momenta, angles and decay lengths are drawn from the kinematics; the field is illustrative.",
  };
}

/** π⁻ p → Λ K⁰ with both neutrals decaying to a visible V: the two V⁰s of associated production. */
export function v0Picture(seed = 1, bField = BUBBLE.bField): Picture {
  const rng = makeRng(seed);
  const pBeam = 2.0;
  const mPi = particle(-211).mass;
  const vertexPath = 200;
  const beam = simulateEvent({ ...bubbleBase(rng.fork('beam'), bField), particles: [{ pdg: -211, p: pBeam, direction: [1, 0, 0], position: [-BUBBLE.width / 2 + 20, -20, 0], endAt: vertexPath, label: 'π⁻' }] });
  const last = beam.primary.points[beam.primary.points.length - 1]!;
  const vertex: Vec3 = [last.x, last.y, last.z];
  const total = add(fromMass(mPi, pBeam, 0, 0), fromMass(PROTON_MASS, 0, 0, 0));
  let lam: P4 = total;
  let k0: P4 = total;
  for (let i = 0; i < 2000; i++) {
    const [a, b] = twoBodyDecay(rng.fork(`prod${i}`), total, particle(3122).mass, particle(310).mass);
    const inP = (v: P4) => Math.abs(v.pz) < 0.25 * pmag(v) && v.px > 0.2 && Math.abs(v.py) < 1.5 * v.px;
    if (inP(a) && inP(b) && Math.abs(Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px)) > 0.25) {
      lam = a;
      k0 = b;
      break;
    }
  }
  const Ll = decayLength(particle(3122).mass, pmag(lam), 3122, rng, 0.3, 0.6);
  const Lk = decayLength(particle(310).mass, pmag(k0), 310, rng, 0.3, 0.6);
  const ev = simulateEvent({
    ...bubbleBase(rng.fork('event'), bField),
    particles: [
      { pdg: 3122, p4: lam, position: vertex, label: 'Λ' },
      { pdg: 310, p4: k0, position: vertex, label: 'K⁰' },
    ],
    forceDecayAt: { 3122: Ll, 310: Lk },
    channel: { 3122: [2212, -211], 310: [211, -211] },
  });
  const set = mergeSets([beam, ev]);
  const find = (pdg: number, n = 0) => set.tracks.filter((t) => t.pdg === pdg && !t.neutral)[n];
  const labels: PictureLabel[] = [];
  const push = (letter: string, t: Track | undefined, truth: string) => t && labels.push({ letter, trackId: t.id, truth });
  push('A', set.tracks[0], 'pi-');
  push('B', find(2212), 'p');
  push('C', find(-211, 1), 'pi-');
  push('D', find(211), 'pi+');
  push('E', find(-211, 2), 'pi-');
  return {
    id: 'v0',
    title: 'Two V shapes in empty liquid: π⁻ p → Λ K⁰',
    kind: 'bubble',
    medium: 'liquid hydrogen',
    bField,
    width: BUBBLE.width,
    height: BUBBLE.height,
    set,
    plates: [],
    labels,
    steps: [
      `A π⁻ beam of ${pBeam} GeV/c strikes a proton at rest: π⁻ p → Λ K⁰. Both products are neutral, so nothing leaves the interaction point.`,
      'Some distance away the Λ decays to p π⁻: a V whose two arms are a dense proton track and a thinner pion track.',
      'Elsewhere the K⁰ (as K_S) decays to π⁺ π⁻: a second V with two thin arms of opposite curvature.',
      'Each V, traced back along the sum of its arms, points at the vertex where the beam track ends.',
    ],
    note: 'A simulation: the neutral parents are drawn (dashed) only when you ask for them.',
  };
}

/** A π⁰ made in an invisible interaction; both its photons convert in the liquid (forced), giving two e⁺e⁻ pairs. */
export function pairPicture(seed = 1, bField = BUBBLE.bField): Picture {
  const rng = makeRng(seed);
  const pPi0 = 1.2;
  const mPi0 = particle(111).mass;
  const origin: Vec3 = [-330, uniform(rng, -40, 40), 0];
  let phot: [P4, P4] = [fromMass(0, 0, 0, 0), fromMass(0, 0, 0, 0)];
  for (let i = 0; i < 500; i++) {
    const parent = fromMass(mPi0, pPi0, 0, 0);
    const [a, b] = twoBodyDecay(rng.fork(`d${i}`), parent, 0, 0);
    if (Math.abs(a.pz) < 0.15 * pmag(a) && Math.abs(b.pz) < 0.15 * pmag(b) && a.E > 0.15 && b.E > 0.15 && Math.abs(a.py) > 0.05 && Math.abs(b.py) > 0.05 && a.py * b.py < 0) {
      phot = [a, b];
      break;
    }
  }
  const set = simulateEvent({
    ...bubbleBase(rng.fork('event'), bField),
    decays: true,
    particles: [
      { pdg: 22, p4: phot[0], position: origin, label: 'γ₁' },
      { pdg: 22, p4: phot[1], position: origin, label: 'γ₂' },
    ],
    forceConversionAt: [uniform(rng, 120, 180), uniform(rng, 200, 300)],
  });
  const labels: PictureLabel[] = [];
  const pairs = set.tracks.filter((t) => !t.neutral && t.origin === 'pair production');
  pairs.forEach((t, i) => labels.push({ letter: String.fromCharCode(65 + i), trackId: t.id, truth: t.charge < 0 ? 'e-' : 'e+' }));
  return {
    id: 'pair',
    title: 'Photons turning into e⁺e⁻ pairs',
    kind: 'bubble',
    medium: 'liquid hydrogen',
    bField,
    width: BUBBLE.width,
    height: BUBBLE.height,
    set,
    plates: [],
    labels,
    steps: [
      'A π⁰ was made by an interaction outside the picture and decayed at once into two photons. Photons are neutral: no tracks.',
      'Each photon converts in the field of a hydrogen nucleus into an electron and a positron: a V with two thin arms that curve in opposite directions, which is how the sign of the charge shows.',
      'The more energetic a pair, the narrower its V and the straighter its arms; low-energy electrons curl into small spirals as they lose energy.',
    ],
    note: 'A simulation. In liquid hydrogen (radiation length 8.9 m) most photons leave the chamber without converting; here the conversions are forced to happen in the picture.',
  };
}

// ───────────────────────── a one-stop catalogue ─────────────────────────
export const PICTURE_PRESETS = ['cloud-alpha', 'cloud-beta', 'cloud-muon', 'cloud-mixed', 'cloud-shower', 'anderson', 'omega', 'v0', 'pair'] as const;

/**
 * A picture by preset name and seed. Names: the cloud chamber sources (`cloud-alpha`, `cloud-beta`, `cloud-muon`,
 * `cloud-mixed`, `cloud-shower`), `anderson`, and the bubble-chamber events `omega`, `v0`, `pair`; or `cloud:` followed
 * by particle ids separated by commas (`cloud:alpha,mu-,e+`) for a composed picture.
 */
export function makePicture(preset: string, seed = 1, o: { bField?: number; plate?: boolean; n?: number } = {}): Picture {
  if (preset.startsWith('cloud:')) return composeCloudPicture(preset.slice(6).split(',').map((s) => s.trim()).filter(Boolean), seed, o);
  switch (preset) {
    case 'anderson':
      return andersonPicture(seed);
    case 'omega':
      return omegaPicture(seed, o.bField);
    case 'v0':
      return v0Picture(seed, o.bField);
    case 'pair':
      return pairPicture(seed, o.bField);
  }
  const kind = preset.replace(/^cloud-/, '') as SourceKind;
  const setup = cloudSetup({ bField: o.bField ?? 1.0, plate: o.plate ?? false });
  const rng = makeRng(seed);
  const n = o.n ?? (kind === 'mixed' ? 7 : kind === 'shower' ? 1 : 4);
  const sets: TrackSet[] = [];
  for (let i = 0; i < n; i++) sets.push(cloudArrival(kind, rng.fork(i), setup));
  const set = mergeSets(sets);
  const labels: PictureLabel[] = [];
  const primaries = set.tracks.filter((t) => t.origin === 'primary' && t.points.some((p) => p.visible));
  primaries.forEach((t, i) => labels.push({ letter: String.fromCharCode(65 + i), trackId: t.id, truth: truthOf(t) }));
  return {
    id: preset,
    title: `Cloud chamber: ${kind}`,
    kind: 'cloud',
    medium: 'air+alcohol vapour',
    bField: setup.bField,
    width: setup.width,
    height: setup.height,
    set,
    plates: setup.plates,
    sensitiveZ: [-setup.depth / 2, setup.depth / 2],
    labels,
    steps: labels.map((l) => `${l.letter}: ${l.truth}`),
    note: 'A simulated picture.',
    source: setup.source,
  };
}

export function truthOf(t: Track): string {
  if (Math.abs(t.pdg) === ALPHA_PDG) return 'alpha';
  const id = choiceOfPdg(t.pdg);
  return id === String(t.pdg) ? t.name : id;
}

/** The measured properties of every labelled track (what a scanner could work out). */
export function measureLabels(pic: Picture): { label: PictureLabel; m: TrackMeasurement; track: Track }[] {
  return pic.labels.map((label) => {
    const track = pic.set.tracks[label.trackId]!;
    return { label, track, m: measureTrack(track, pic.bField, pic.medium) };
  });
}

/** A short plain-English account of what the clues of a track say (for the feedback of the identification exercise). */
export function explainTrack(pic: Picture, label: PictureLabel): string {
  const track = pic.set.tracks[label.trackId]!;
  const m = measureTrack(track, pic.bField, pic.medium);
  const parts: string[] = [];
  const ion = m.ionisation;
  const mat = MEDIA[pic.medium];
  void mat;
  const first = m.segments[0];
  if (ion > 40) parts.push(`very heavily ionising (about ${Math.round(ion)} times a minimum-ionising particle)`);
  else if (ion > 4) parts.push(`heavily ionising (about ${ion.toFixed(0)} times minimum)`);
  else if (ion > 1.5) parts.push(`somewhat more ionising than a minimum-ionising particle (${ion.toFixed(1)} times)`);
  else parts.push('thin, close to minimum ionisation');
  if (m.endsInside && track.end === 'range') parts.push(`it stops after ${m.length.toFixed(0)} mm: a finite range`);
  else parts.push(`it is ${m.length.toFixed(0)} mm long in the picture`);
  if (first?.fit && !first.fit.straight && Number.isFinite(first.pT) && pic.bField !== 0) {
    parts.push(`its radius of curvature is about ${Math.round(first.fit.R)} mm, so p_T ≈ ${(first.pT * 1000).toFixed(0)} MeV/c`);
  } else if (pic.bField !== 0) parts.push('it is nearly straight, so its momentum is high');
  const kink = track.kinks.find((k) => k.kind === 'decay');
  if (kink) parts.push(`there is a kink where it decays (${(kink.angle * 180 / Math.PI).toFixed(0)}° change of direction)`);
  return parts.join('; ');
}

export { MATERIALS, mipLoss, simulateTrack };
