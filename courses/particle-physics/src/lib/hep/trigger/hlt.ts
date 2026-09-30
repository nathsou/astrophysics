/**
 * The High-Level Trigger (HLT): software running on a farm of ordinary computers on every event Level-1 accepted (about 100 kHz),
 * within a budget of the order of 100 ms per event. It runs a fast version of the offline reconstruction, so its selections are
 * written over reconstructed objects (muons, electrons, photons, jets, missing ET) with identification and isolation, and
 * it reduces the rate to about 1 kHz for storage.
 */
import type { RecoEvent, RecoObject } from '../event/index.ts';
import { eta as etaOf, pt as ptOf, pairMass } from '../kinematics/index.ts';
import type { L1Kind, L1Variables } from './level1.ts';

/** An isolation cut (scalar pT sum in a cone over the object's pT). */
export const ISO_MAX = 0.15;

const byPt = (a: RecoObject, b: RecoObject): number => ptOf(b.p) - ptOf(a.p);
/** The objects of a kind, sorted by decreasing pT. */
export function objectsOf(reco: Pick<RecoEvent, 'objects'>, ...kinds: RecoObject['kind'][]): RecoObject[] {
  return reco.objects.filter((o) => kinds.includes(o.kind)).sort(byPt);
}
const isolated = (o: RecoObject, max = ISO_MAX): boolean => (o.isolation ?? 0) < max;
export const metOf = (reco: Pick<RecoEvent, 'met'>): number => Math.hypot(reco.met.x, reco.met.y);

/** Leading isolated muon pT within |η| < 2.4 (0 if none). */
export function hltSingleMuon(reco: RecoEvent): number {
  const m = objectsOf(reco, 'muon').filter((o) => Math.abs(etaOf(o.p)) < 2.4 && isolated(o));
  return m[0] ? ptOf(m[0].p) : 0;
}
/** The best opposite-sign muon pair (mass between mMin and mMax, both |η| < 2.4): the pT of its softer muon (0 if none). */
export function hltMuonPair(reco: RecoEvent, mMin = 12, mMax = Infinity): number {
  const m = objectsOf(reco, 'muon').filter((o) => Math.abs(etaOf(o.p)) < 2.4);
  let best = 0;
  for (let i = 0; i < m.length; i++) {
    for (let j = i + 1; j < m.length; j++) {
      const a = m[i]!, b = m[j]!;
      if ((a.charge ?? 0) * (b.charge ?? 0) > 0) continue;
      const mass = pairMass(a.p, b.p);
      if (mass < mMin || mass > mMax) continue;
      best = Math.max(best, Math.min(ptOf(a.p), ptOf(b.p)));
    }
  }
  return best;
}
/** Leading isolated electron pT within |η| < 2.5. */
export function hltSingleElectron(reco: RecoEvent): number {
  const e = objectsOf(reco, 'electron').filter((o) => Math.abs(etaOf(o.p)) < 2.5 && isolated(o));
  return e[0] ? ptOf(e[0].p) : 0;
}
/** Two isolated electromagnetic objects (photons or electrons) with invariant mass above `mMin`: the pT of the second. */
export function hltDiPhoton(reco: RecoEvent, mMin = 90): number {
  const g = objectsOf(reco, 'photon', 'electron').filter((o) => Math.abs(etaOf(o.p)) < 2.5 && isolated(o, 0.25));
  let best = 0;
  for (let i = 0; i < g.length; i++) {
    for (let j = i + 1; j < g.length; j++) {
      if (pairMass(g[i]!.p, g[j]!.p) < mMin) continue;
      best = Math.max(best, Math.min(ptOf(g[i]!.p), ptOf(g[j]!.p)));
    }
  }
  return best;
}
/** Leading jet pT within |η| < 3. */
export function hltSingleJet(reco: RecoEvent): number {
  const j = objectsOf(reco, 'jet').filter((o) => Math.abs(etaOf(o.p)) < 3);
  return j[0] ? ptOf(j[0].p) : 0;
}
/** HT: the scalar sum of the pT of jets above 30 GeV within |η| < 2.5. */
export function hltHT(reco: RecoEvent): number {
  let ht = 0;
  for (const o of objectsOf(reco, 'jet')) {
    const p = ptOf(o.p);
    if (p >= 30 && Math.abs(etaOf(o.p)) < 2.5) ht += p;
  }
  return ht;
}
/** Low-mass dimuon for B physics: an opposite-sign pair between 2.5 and 12 GeV, the pT of the softer muon. */
export function hltLowMassDimuon(reco: RecoEvent): number {
  return hltMuonPair(reco, 2.5, 12);
}

/** One entry of the menu catalogue: a physics signature with an L1 item and an HLT variable, both thresholded from below. */
export interface MenuKind {
  key: string;
  label: string;
  /** The Level-1 item (an L1 kind, possibly with a suffix). */
  l1Item: string;
  l1Variable: (v: L1Variables) => number;
  hltVariable: (reco: RecoEvent) => number;
  /** The physics it is meant to catch, in a few words. */
  purpose: string;
}
const L1 = (k: L1Kind) => (v: L1Variables) => v[k];
export const MENU_KINDS: MenuKind[] = [
  { key: 'SingleMu', label: 'Single muon', l1Item: 'SingleMu', l1Variable: L1('SingleMu'), hltVariable: hltSingleMuon, purpose: 'W and Z decays, top, anything with a hard muon' },
  { key: 'DoubleMu', label: 'Two muons', l1Item: 'DoubleMu', l1Variable: L1('DoubleMu'), hltVariable: (r) => hltMuonPair(r), purpose: 'Z → μμ, H → 4ℓ' },
  { key: 'SingleEG', label: 'Single electron', l1Item: 'SingleEG', l1Variable: L1('SingleEG'), hltVariable: hltSingleElectron, purpose: 'W and Z decays, top' },
  { key: 'DoubleEG', label: 'Two photons', l1Item: 'DoubleEG', l1Variable: L1('DoubleEG'), hltVariable: (r) => hltDiPhoton(r), purpose: 'H → γγ' },
  { key: 'SingleJet', label: 'Single jet', l1Item: 'SingleJet', l1Variable: L1('SingleJet'), hltVariable: hltSingleJet, purpose: 'new heavy particles decaying to jets' },
  { key: 'HT', label: 'Jet energy sum (HT)', l1Item: 'HT', l1Variable: L1('HT'), hltVariable: hltHT, purpose: 'supersymmetry-like cascades, top' },
  { key: 'MET', label: 'Missing energy', l1Item: 'MET', l1Variable: L1('MET'), hltVariable: (r) => metOf(r), purpose: 'particles that leave no signal: neutrinos, dark matter' },
  { key: 'BPhys', label: 'Low-mass dimuon (B physics)', l1Item: 'DoubleMu_Low', l1Variable: L1('DoubleMu'), hltVariable: hltLowMassDimuon, purpose: 'B → J/ψ X and other b-hadron decays' },
];
export const menuKind = (key: string): MenuKind => {
  const k = MENU_KINDS.find((m) => m.key === key);
  if (!k) throw new Error(`unknown menu kind: ${key}`);
  return k;
};
