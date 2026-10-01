/**
 * `hep/topreco`: reconstruction of top-quark pairs in the lepton + jets channel (Chapter 25).
 *
 * In tt̄ → (ℓ ν b)(q q′ b̄) the detector sees one charged lepton, missing transverse momentum (the neutrino) and at least four jets, of which two come from
 * b quarks. To reconstruct the two tops one has to decide which jet is which: the **assignment** problem. With n jets there are n (n − 1) (n − 2)(n − 3)/2
 * ways to pick (b on the leptonic side, b on the hadronic side, an unordered pair of light-quark jets): 12 for n = 4, 60 for n = 5, 180 for n = 6.
 *
 * The reference solution of the exercise (hook `reco.assignTopJets`) minimises
 *
 *     χ² = ((m_qq′ − m_W)/σ_W)² + ((m_qq′b − m_t)/σ_t)² + ((m_ℓνb − m_t)/σ_t)²  [+ penalty × number of b-tag mismatches],
 *
 * with m_W = 80.4 GeV, m_t = 172.5 GeV, σ_W = 10 GeV and σ_t = 20 GeV (`TOP_CHI2` holds them). The neutrino's momentum along the beam is not measured: it
 * is found from the condition m(ℓν) = m_W (`neutrinoPz`), which is a quadratic with two roots; the root with the smaller |p_z| is used, and if there is no real root
 * the real part (the one that makes m_T(ℓν) = m_W as nearly as possible) is.
 *
 * Natural units, GeV. Pure functions, no randomness.
 */
import { hook } from '../hooks.ts';
import { mass, type P4 } from '../kinematics/index.ts';

export interface TopJet {
  p: P4;
  /** b-tagging score in [0, 1]; above 0.5 counts as tagged. */
  btag: number;
}

export const TOP_CHI2 = { mW: 80.4, mT: 172.5, sigmaW: 10, sigmaT: 20, tagThreshold: 0.5 } as const;

export interface AssignOptions {
  /** Added to χ² for each jet assigned as a b quark that is not tagged, and for each tagged jet assigned as a light quark. Default 0. */
  btagPenalty?: number;
  /** Only the first `maxJets` jets (in the order given, which is by decreasing pT) are used. Default 6. */
  maxJets?: number;
}

export interface Assignment {
  /** Indices into the jet list: the b jet on the leptonic side, the b jet on the hadronic side, and the two light-quark jets (q1 < q2). */
  bLep: number;
  bHad: number;
  q1: number;
  q2: number;
  chi2: number;
  /** The invariant masses of the three systems, and the neutrino's longitudinal momentum used. */
  mW: number;
  mTopHad: number;
  mTopLep: number;
  nuPz: number;
}

/**
 * The longitudinal momentum of the neutrino from m(ℓν) = m_W, for a charged lepton treated as massless and missing momentum (x, y).
 * With a = m_W²/2 + p_T(ℓ)·p_T^miss: p_z(ν) = (a p_z(ℓ) ± E(ℓ) √(a² − p_T(ℓ)² p_T^miss²)) / p_T(ℓ)². Returns the root with smaller |p_z|, and
 * `complex: true` when the square root is of a negative number (then the real part is returned).
 */
export function neutrinoPz(lepton: P4, met: { x: number; y: number }, mW: number = TOP_CHI2.mW): { pz: number; complex: boolean } {
  const ptl2 = lepton.px * lepton.px + lepton.py * lepton.py;
  if (ptl2 === 0) return { pz: 0, complex: true };
  const a = 0.5 * mW * mW + lepton.px * met.x + lepton.py * met.y;
  const etm2 = met.x * met.x + met.y * met.y;
  const disc = a * a - ptl2 * etm2;
  const El = Math.sqrt(ptl2 + lepton.pz * lepton.pz);
  const centre = (a * lepton.pz) / ptl2;
  if (disc < 0) return { pz: centre, complex: true };
  const d = (El * Math.sqrt(disc)) / ptl2;
  const r1 = centre + d, r2 = centre - d;
  return { pz: Math.abs(r1) <= Math.abs(r2) ? r1 : r2, complex: false };
}

const add3 = (a: P4, b: P4, c: P4): P4 => ({ E: a.E + b.E + c.E, px: a.px + b.px + c.px, py: a.py + b.py + c.py, pz: a.pz + b.pz + c.pz });
const add2 = (a: P4, b: P4): P4 => ({ E: a.E + b.E, px: a.px + b.px, py: a.py + b.py, pz: a.pz + b.pz });

/** The reference of the hook `reco.assignTopJets`: the assignment of jets to the four quarks of tt̄ → ℓ+jets that minimises χ² (see the file header), or null with fewer than four jets. */
export function assignTopJetsReference(jets: TopJet[], lepton: P4, met: { x: number; y: number }, opts: AssignOptions = {}): Assignment | null {
  const n = Math.min(jets.length, opts.maxJets ?? 6);
  if (n < 4) return null;
  const pen = opts.btagPenalty ?? 0;
  const { mW, mT, sigmaW, sigmaT, tagThreshold } = TOP_CHI2;
  const nu = neutrinoPz(lepton, met, mW);
  const ptn = Math.hypot(met.x, met.y);
  const neutrino: P4 = { E: Math.sqrt(ptn * ptn + nu.pz * nu.pz), px: met.x, py: met.y, pz: nu.pz };
  const lnu = add2(lepton, neutrino);
  const tagged = jets.slice(0, n).map((j) => j.btag > tagThreshold);
  let best: Assignment | null = null;
  for (let bl = 0; bl < n; bl++) {
    const mLep = mass(add2(lnu, jets[bl]!.p));
    const cLep = ((mLep - mT) / sigmaT) ** 2;
    for (let bh = 0; bh < n; bh++) {
      if (bh === bl) continue;
      for (let a = 0; a < n; a++) {
        if (a === bl || a === bh) continue;
        for (let b = a + 1; b < n; b++) {
          if (b === bl || b === bh) continue;
          const mw = mass(add2(jets[a]!.p, jets[b]!.p));
          const mh = mass(add3(jets[a]!.p, jets[b]!.p, jets[bh]!.p));
          let chi2 = ((mw - mW) / sigmaW) ** 2 + ((mh - mT) / sigmaT) ** 2 + cLep;
          if (pen) chi2 += pen * ((tagged[bl]! ? 0 : 1) + (tagged[bh]! ? 0 : 1) + (tagged[a]! ? 1 : 0) + (tagged[b]! ? 1 : 0));
          if (!best || chi2 < best.chi2) best = { bLep: bl, bHad: bh, q1: a, q2: b, chi2, mW: mw, mTopHad: mh, mTopLep: mLep, nuPz: nu.pz };
        }
      }
    }
  }
  return best;
}

/** `assignTopJetsReference`, or the reader's own version if it has been installed as the hook `reco.assignTopJets`. */
export function assignTopJets(jets: TopJet[], lepton: P4, met: { x: number; y: number }, opts: AssignOptions = {}): Assignment | null {
  return hook('reco.assignTopJets', assignTopJetsReference)(jets, lepton, met, opts);
}

/** The number of assignments of n jets: n (n − 1)(n − 2)(n − 3)/2 for n ≥ 4. */
export function assignmentCount(n: number): number {
  return n < 4 ? 0 : (n * (n - 1) * (n - 2) * (n - 3)) / 2;
}

export interface TopInput {
  lepton: P4;
  /** Charge of the lepton (±1) and its kind. */
  charge: number;
  kind: 'electron' | 'muon';
  met: { x: number; y: number };
  jets: TopJet[];
}

export interface SelectionOptions {
  leptonPtMin?: number;
  jetPtMin?: number;
  jetEtaMax?: number;
  metMin?: number;
  /** Isolation requirement for the lepton (relative track isolation below this). Default 0.15. */
  isolationMax?: number;
}

interface ObjLike {
  kind: string;
  p: P4;
  charge?: number;
  isolation?: number;
  btag?: number;
}

/**
 * The lepton + jets selection on reconstructed objects: exactly one isolated electron or muon with p_T > 25 GeV and |η| < 2.5, at least four jets with
 * p_T > 25 GeV and |η| < 2.5, and missing transverse momentum above 20 GeV. Returns null if the event fails. Jets are ordered by decreasing p_T.
 */
export function selectLeptonJets(objects: readonly ObjLike[], met: { x: number; y: number }, opts: SelectionOptions = {}): TopInput | null {
  const lPt = opts.leptonPtMin ?? 25, jPt = opts.jetPtMin ?? 25, jEta = opts.jetEtaMax ?? 2.5, metMin = opts.metMin ?? 20, iso = opts.isolationMax ?? 0.15;
  const pt = (p: P4) => Math.hypot(p.px, p.py);
  const eta = (p: P4) => Math.asinh(p.pz / pt(p));
  const leptons = objects.filter((o) => (o.kind === 'electron' || o.kind === 'muon') && pt(o.p) > lPt && Math.abs(eta(o.p)) < 2.5 && (o.isolation ?? 0) < iso);
  if (leptons.length !== 1) return null;
  if (Math.hypot(met.x, met.y) < metMin) return null;
  const jets = objects
    .filter((o) => o.kind === 'jet' && pt(o.p) > jPt && Math.abs(eta(o.p)) < jEta)
    .sort((a, b) => pt(b.p) - pt(a.p))
    .map((o) => ({ p: o.p, btag: o.btag ?? 0 }));
  if (jets.length < 4) return null;
  const l = leptons[0]!;
  return { lepton: l.p, charge: l.charge ?? 0, kind: l.kind as 'electron' | 'muon', met, jets };
}

/** Select and assign in one step. */
export function reconstructTop(objects: readonly ObjLike[], met: { x: number; y: number }, opts: AssignOptions & SelectionOptions = {}): { input: TopInput; assignment: Assignment } | null {
  const input = selectLeptonJets(objects, met, opts);
  if (!input) return null;
  const assignment = assignTopJets(input.jets, input.lepton, input.met, opts);
  return assignment ? { input, assignment } : null;
}
