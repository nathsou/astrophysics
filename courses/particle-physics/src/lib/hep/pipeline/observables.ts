/**
 * The analysis stage's observables: one number per event from the reconstructed objects (and, for a few, the same from the truth record for
 * comparison), a selection of the objects they use, and the truth-matching counters behind the efficiency summaries.
 *
 * Invariant masses go through the hook `kinematics.pairMass` (`hook('kinematics.pairMass', pairMass)`), so the function written in Chapter 2's
 * exercise computes the mass of every muon pair, photon pair and four-lepton system in the pipeline when "use my code" is on.
 *
 *   mll          mass of the leading opposite-sign same-flavour lepton pair (μμ, else ee)
 *   mgg          mass of the two leading photons (with pT/m > 0.35 and 0.25 when `selection.ptOverM`)
 *   m4l          mass of the four-lepton system: two opposite-sign same-flavour pairs, the one nearest the Z mass being Z₁ (40–120 GeV), the other
 *                Z₂ (12–120 GeV); leading lepton pT > 20 GeV, second > 10 GeV
 *   mjj          mass of the two leading jets
 *   ht           scalar sum of the pT of the jets above `jetPtMin`
 *   njets, nbtag, met, nTracks, nVertices, sumEt, ptLead
 *   cosThetaMu   cos θ of the μ⁻ of the leading μ⁺μ⁻ pair, from +z (the e⁻ beam direction in e⁺e⁻ collisions)
 */
import type { ObjectKind, RecoEvent, RecoObject, TruthEvent } from '../event/index.ts';
import { hook } from '../hooks.ts';
import { add, eta as etaOf, pairMass, pt as ptOf, type P4 } from '../kinematics/index.ts';
import { M_Z } from '../sm/index.ts';
import type { Selection } from './config.ts';

export interface ObservableDef {
  name: string;
  label: string;
  unit: string;
  bins: number;
  lo: number;
  hi: number;
  log?: boolean;
  description: string;
  /** Whether a truth-level version exists (from the prompt leptons and photons of the truth record). */
  truth: boolean;
  /** Integer-valued (drawn with one bin per value). */
  discrete?: boolean;
}

export const OBSERVABLES: Record<string, ObservableDef> = {
  mll: { name: 'mll', label: 'm(ℓℓ)', unit: 'GeV', bins: 60, lo: 60, hi: 120, description: 'Mass of the leading opposite-sign same-flavour lepton pair.', truth: true },
  mgg: { name: 'mgg', label: 'm(γγ)', unit: 'GeV', bins: 55, lo: 105, hi: 160, description: 'Mass of the two leading photons.', truth: true },
  m4l: { name: 'm4l', label: 'm(4ℓ)', unit: 'GeV', bins: 30, lo: 100, hi: 160, description: 'Mass of the four-lepton system (two opposite-sign same-flavour pairs).', truth: true },
  mjj: { name: 'mjj', label: 'm(jj)', unit: 'GeV', bins: 40, lo: 60, hi: 4000, log: true, description: 'Mass of the two leading jets.', truth: false },
  ht: { name: 'ht', label: 'H_T', unit: 'GeV', bins: 40, lo: 0, hi: 1000, description: 'Scalar sum of the pT of the jets.', truth: false },
  njets: { name: 'njets', label: 'jets', unit: '', bins: 10, lo: -0.5, hi: 9.5, discrete: true, description: 'Number of jets above the pT threshold.', truth: false },
  nbtag: { name: 'nbtag', label: 'b-tagged jets', unit: '', bins: 5, lo: -0.5, hi: 4.5, discrete: true, description: 'Number of jets with a b-tag score above the threshold.', truth: false },
  met: { name: 'met', label: 'missing pT', unit: 'GeV', bins: 40, lo: 0, hi: 200, description: 'Magnitude of the missing transverse momentum.', truth: false },
  nTracks: { name: 'nTracks', label: 'reconstructed tracks', unit: '', bins: 40, lo: 0, hi: 200, description: 'Number of reconstructed tracks.', truth: false },
  nVertices: { name: 'nVertices', label: 'primary vertices', unit: '', bins: 25, lo: -0.5, hi: 24.5, discrete: true, description: 'Number of reconstructed primary (hard and pile-up) vertices.', truth: false },
  sumEt: { name: 'sumEt', label: 'ΣE_T', unit: 'GeV', bins: 40, lo: 0, hi: 400, description: 'Scalar sum of calorimeter transverse energy.', truth: false },
  ptLead: { name: 'ptLead', label: 'leading pT', unit: 'GeV', bins: 40, lo: 0, hi: 200, description: 'pT of the hardest lepton, photon or jet.', truth: false },
  cosThetaMu: { name: 'cosThetaMu', label: 'cos θ(μ⁻)', unit: '', bins: 20, lo: -1, hi: 1, description: 'Polar angle of the μ⁻ from +z.', truth: true },
};
export const OBSERVABLE_NAMES = Object.keys(OBSERVABLES);

/** Bin edges of an observable with an optional override of the binning. */
export function binEdges(def: ObservableDef, over?: { bins: number; lo: number; hi: number }): number[] {
  const n = Math.max(1, Math.round(over?.bins ?? def.bins));
  const lo = over?.lo ?? def.lo, hi = over?.hi ?? def.hi;
  return Array.from({ length: n + 1 }, (_, i) => (def.log && lo > 0 ? lo * (hi / lo) ** (i / n) : lo + ((hi - lo) * i) / n));
}

// ── A particle with what the pair algorithms need ─────────────────────────────────────────────

interface Part {
  p: P4;
  charge: number;
  /** 11 (electron) or 13 (muon); 22 for a photon. */
  flavour: number;
}

const byPt = (a: Part, b: Part): number => ptOf(b.p) - ptOf(a.p);

/** The objects of a kind passing the cuts, hardest first (the same selection as `hep/analysis` `objects`, kept local so that this module loads without it). */
function objects(reco: RecoEvent, kind: ObjectKind, cuts: { ptMin?: number; etaMax?: number; isolationMax?: number; btagMin?: number }): RecoObject[] {
  const out: RecoObject[] = [];
  for (const o of reco.objects) {
    if (o.kind !== kind) continue;
    if (cuts.ptMin !== undefined && ptOf(o.p) < cuts.ptMin) continue;
    if (cuts.etaMax !== undefined && Math.abs(etaOf(o.p)) > cuts.etaMax) continue;
    if (cuts.isolationMax !== undefined && o.isolation !== undefined && o.isolation > cuts.isolationMax) continue;
    out.push(o);
  }
  return out.sort((a, b) => ptOf(b.p) - ptOf(a.p));
}

function recoParts(reco: RecoEvent, kind: ObjectKind, flavour: number, cuts: { ptMin: number; etaMax: number; isolationMax: number }): Part[] {
  return objects(reco, kind, { ptMin: cuts.ptMin, etaMax: cuts.etaMax, isolationMax: cuts.isolationMax < 50 ? cuts.isolationMax : undefined }).map((o: RecoObject) => ({ p: o.p, charge: o.charge ?? 0, flavour }));
}

/** The leading opposite-sign same-flavour pair of a list sorted by pT: the leading particle with the hardest partner of opposite charge. */
export function leadingPair(parts: readonly Part[]): [Part, Part] | null {
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]!, b = parts[j]!;
      if (a.flavour === b.flavour && a.charge * b.charge < 0) return [a, b];
    }
  }
  return null;
}

const M4L_PT1 = 20;
const M4L_PT2 = 10;
const pairMassHook = (a: P4, b: P4): number => hook('kinematics.pairMass', pairMass)(a, b);

/** The four-lepton mass of the best Z₁Z₂ candidate in a list of leptons sorted by pT, or null. */
export function fourLeptonMass(parts: readonly Part[]): number | null {
  const L = parts.slice(0, 6);
  const n = L.length;
  if (n < 4) return null;
  const mass = new Map<number, number>();
  const pm = (i: number, j: number): number => {
    const k = i * 8 + j;
    let m = mass.get(k);
    if (m === undefined) mass.set(k, (m = pairMassHook(L[i]!.p, L[j]!.p)));
    return m;
  };
  const isPair = (i: number, j: number) => L[i]!.flavour === L[j]!.flavour && L[i]!.charge * L[j]!.charge < 0;
  let best: { score: number; z1: [number, number]; z2: [number, number] } | null = null;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    // pT of the sorted quadruplet: a is the hardest, b the second
    if (ptOf(L[a]!.p) < M4L_PT1 || ptOf(L[b]!.p) < M4L_PT2) continue;
    const idx: [number, number, number, number][] = [[a, b, c, d], [a, c, b, d], [a, d, b, c]];
    for (const [i, j, k, l] of idx) {
      if (!isPair(i, j) || !isPair(k, l)) continue;
      const mA = pm(i, j), mB = pm(k, l);
      const [z1, z2, m1, m2]: [[number, number], [number, number], number, number] = Math.abs(mA - M_Z) <= Math.abs(mB - M_Z) ? [[i, j], [k, l], mA, mB] : [[k, l], [i, j], mB, mA];
      if (!(m1 > 40 && m1 < 120 && m2 > 12 && m2 < 120)) continue;
      const score = Math.abs(m1 - M_Z);
      if (!best || score < best.score) best = { score, z1, z2 };
    }
  }
  if (!best) return null;
  const z1 = add(L[best.z1[0]]!.p, L[best.z1[1]]!.p);
  const z2 = add(L[best.z2[0]]!.p, L[best.z2[1]]!.p);
  return pairMassHook(z1, z2);
}

function photonMass(ph: readonly Part[], ptOverM: boolean): number | null {
  if (ph.length < 2) return null;
  const a = ph[0]!, b = ph[1]!;
  const m = pairMassHook(a.p, b.p);
  if (!(m > 0)) return null;
  if (ptOverM && !(ptOf(a.p) > 0.35 * m && ptOf(b.p) > 0.25 * m)) return null;
  return m;
}

// ── Reconstructed-level observables ───────────────────────────────────────────────────────────

/** The values of the requested observables (null where an event has none: no pair, not enough photons, …), from the reconstructed event. */
export function recoObservables(reco: RecoEvent, sel: Selection, names: readonly string[]): (number | null)[] {
  const cuts = { ptMin: sel.leptonPtMin, etaMax: sel.etaMax, isolationMax: sel.isolationMax };
  const cache: Record<string, unknown> = {};
  const memo = <T>(k: string, f: () => T): T => (k in cache ? (cache[k] as T) : ((cache[k] = f()) as T));
  const muons = () => memo('mu', () => recoParts(reco, 'muon', 13, cuts));
  const electrons = () => memo('el', () => recoParts(reco, 'electron', 11, cuts));
  const leptons = () => memo('lep', () => [...muons(), ...electrons()].sort(byPt));
  const photons = () => memo('ph', () => recoParts(reco, 'photon', 22, { ptMin: sel.photonPtMin, etaMax: sel.etaMax, isolationMax: sel.isolationMax }));
  const jets = () => memo('jet', () => objects(reco, 'jet', { ptMin: sel.jetPtMin, etaMax: sel.jetEtaMax }));
  const dilepton = () => memo('ll', () => leadingPair(muons()) ?? leadingPair(electrons()));
  return names.map((name): number | null => {
    switch (name) {
      case 'mll': {
        const pair = dilepton();
        return pair ? pairMassHook(pair[0].p, pair[1].p) : null;
      }
      case 'mgg':
        return photonMass(photons(), sel.ptOverM);
      case 'm4l':
        return fourLeptonMass(leptons());
      case 'mjj': {
        const j = jets();
        return j.length >= 2 ? pairMassHook(j[0]!.p, j[1]!.p) : null;
      }
      case 'ht':
        return jets().reduce((s, o) => s + ptOf(o.p), 0);
      case 'njets':
        return jets().length;
      case 'nbtag':
        return jets().filter((o) => (o.btag ?? 0) >= sel.btagMin).length;
      case 'met':
        return Math.hypot(reco.met.x, reco.met.y);
      case 'nTracks':
        return reco.tracks.length;
      case 'nVertices':
        return reco.vertices.filter((v) => v.kind !== 'secondary').length;
      case 'sumEt':
        return reco.sumEt;
      case 'ptLead': {
        let m = 0;
        for (const p of leptons()) m = Math.max(m, ptOf(p.p));
        for (const p of photons()) m = Math.max(m, ptOf(p.p));
        for (const j of jets()) m = Math.max(m, ptOf(j.p));
        return m > 0 ? m : null;
      }
      case 'cosThetaMu': {
        const pair = leadingPair(muons());
        if (!pair) return null;
        const mum = pair[0].charge < 0 ? pair[0] : pair[1];
        const p = Math.hypot(mum.p.px, mum.p.py, mum.p.pz);
        return p > 0 ? mum.p.pz / p : null;
      }
      default:
        throw new Error(`unknown observable "${name}"; available: ${OBSERVABLE_NAMES.join(', ')}`);
    }
  });
}

// ── Truth-level observables ───────────────────────────────────────────────────────────────────

/** A final-state truth lepton or photon that comes from the hard process (no hadron among its ancestors), in the hard collision. */
export function promptParticles(truth: TruthEvent, pdgs: readonly number[]): { id: number; pdg: number; p: P4 }[] {
  const out: { id: number; pdg: number; p: P4 }[] = [];
  const ps = truth.particles;
  for (const p of ps) {
    if (p.status !== 'final' || (p.collision ?? 0) !== 0 || !pdgs.includes(Math.abs(p.pdg))) continue;
    // walk up the first-mother chain and all mothers: reject if any ancestor is a hadron (|PDG id| ≥ 100)
    let ok = true;
    const seen = new Set<number>();
    const stack = [...p.mothers];
    while (stack.length) {
      const i = stack.pop()!;
      if (seen.has(i)) continue;
      seen.add(i);
      const m = ps[i];
      if (!m) continue;
      if (Math.abs(m.pdg) >= 100 && Math.abs(m.pdg) !== 2212 && m.status !== 'beam') {
        ok = false;
        break;
      }
      stack.push(...m.mothers);
    }
    if (ok) out.push({ id: p.id, pdg: p.pdg, p: p.p });
  }
  return out;
}

const partsFromTruth = (truth: TruthEvent, pdgs: number[], cuts: { ptMin: number; etaMax: number }): Part[] =>
  promptParticles(truth, pdgs)
    .filter((t) => ptOf(t.p) >= cuts.ptMin && Math.abs(etaOf(t.p)) < cuts.etaMax)
    .map((t) => ({ p: t.p, charge: t.pdg === 22 ? 0 : t.pdg > 0 ? -1 : 1, flavour: Math.abs(t.pdg) }))
    .sort(byPt);

/** The truth-level version of an observable (same acceptance cuts, perfect measurement), or null if the observable has none or the event has no such objects. */
export function truthObservable(truth: TruthEvent, sel: Selection, name: string, etaLimit = Infinity): number | null {
  const etaMax = Math.min(sel.etaMax, etaLimit);
  switch (name) {
    case 'mll': {
      const leps = partsFromTruth(truth, [11, 13], { ptMin: sel.leptonPtMin, etaMax });
      const mu = leps.filter((l) => l.flavour === 13), el = leps.filter((l) => l.flavour === 11);
      const pair = leadingPair(mu) ?? leadingPair(el);
      return pair ? pairMassHook(pair[0].p, pair[1].p) : null;
    }
    case 'cosThetaMu': {
      const pair = leadingPair(partsFromTruth(truth, [13], { ptMin: sel.leptonPtMin, etaMax }));
      if (!pair) return null;
      const mum = pair[0].charge < 0 ? pair[0] : pair[1];
      const p = Math.hypot(mum.p.px, mum.p.py, mum.p.pz);
      return p > 0 ? mum.p.pz / p : null;
    }
    case 'mgg':
      return photonMass(partsFromTruth(truth, [22], { ptMin: sel.photonPtMin, etaMax }), sel.ptOverM);
    case 'm4l':
      return fourLeptonMass(partsFromTruth(truth, [11, 13], { ptMin: sel.leptonPtMin, etaMax }));
    default:
      return null;
  }
}

// ── Truth matching: efficiency and fake rate of the reconstructed objects ─────────────────────

export const EFF_KINDS = ['muon', 'electron', 'photon'] as const;
export type EffKind = (typeof EFF_KINDS)[number];
const EFF_PDG: Record<EffKind, number[]> = { muon: [13], electron: [11], photon: [22] };

export interface EffCounts {
  /** Prompt truth objects in the acceptance (pT above threshold, |η| inside both the analysis and the detector acceptance). */
  nTruth: number;
  /** Of these, the number with a reconstructed object of the same kind within ΔR < 0.1. */
  nMatched: number;
  /** Reconstructed objects of this kind above the threshold and inside the acceptance. */
  nReco: number;
  /** Of these, the number with no truth particle of the kind (prompt or not, any pT above 1 GeV) within ΔR < 0.1. */
  nFake: number;
}
export const emptyEff = (): EffCounts => ({ nTruth: 0, nMatched: 0, nReco: 0, nFake: 0 });

const dR = (a: P4, b: P4): number => {
  const dphi = Math.atan2(Math.sin(Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px)), Math.cos(Math.atan2(a.py, a.px) - Math.atan2(b.py, b.px)));
  return Math.hypot(etaOf(a) - etaOf(b), dphi);
};

/**
 * The pseudorapidity reached by the detector: by the tracker and calorimeters (η limit minus a margin) and, for muons, by at least two muon stations
 * (a station at radius r and half-length h is reached up to η = asinh(h/r); the second-best station sets the limit).
 */
export function detectorAcceptance(cfg: { etaMax: number; muon: { stations: { r: number; halfLength: number }[] } }): { tracker: number; muon: number } {
  const reach = cfg.muon.stations.map((s) => Math.asinh(s.halfLength / s.r)).sort((a, b) => b - a);
  const second = reach.length >= 2 ? reach[1]! : (reach[0] ?? 0);
  return { tracker: cfg.etaMax - 0.1, muon: Math.min(cfg.etaMax - 0.1, second - 0.05) };
}

/** Count truth and reconstructed objects of each kind and their matches (by ΔR < 0.1), inside the detector's acceptance. */
export function matchCounts(truth: TruthEvent, reco: RecoEvent, sel: Selection, acceptance: { tracker: number; muon: number }, kinds: readonly EffKind[] = EFF_KINDS): Record<EffKind, EffCounts> {
  const out = { muon: emptyEff(), electron: emptyEff(), photon: emptyEff() } as Record<EffKind, EffCounts>;
  for (const kind of kinds) {
    const etaMax = Math.min(sel.etaMax, kind === 'muon' ? acceptance.muon : acceptance.tracker);
    const ptMin = kind === 'photon' ? sel.photonPtMin : sel.leptonPtMin;
    const prompt = promptParticles(truth, EFF_PDG[kind]).filter((t) => ptOf(t.p) >= ptMin && Math.abs(etaOf(t.p)) < etaMax);
    const recos = reco.objects.filter((o) => o.kind === kind);
    const c = out[kind];
    c.nTruth = prompt.length;
    for (const t of prompt) if (recos.some((o) => dR(o.p, t.p) < 0.1)) c.nMatched++;
    const inAcc = recos.filter((o) => ptOf(o.p) >= ptMin && Math.abs(etaOf(o.p)) < etaMax);
    c.nReco = inAcc.length;
    if (inAcc.length) {
      const anyTruth = truth.particles.filter((p) => p.status === 'final' && EFF_PDG[kind].includes(Math.abs(p.pdg)) && ptOf(p.p) > 1);
      for (const o of inAcc) if (!anyTruth.some((t) => dR(o.p, t.p) < 0.1)) c.nFake++;
    }
  }
  return out;
}
