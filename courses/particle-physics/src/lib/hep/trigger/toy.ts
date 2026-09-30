/**
 * Toy samples for the trigger: events drawn in code from simple distributions, seeded, with the cross-sections of the processes
 * (rounded, illustrative values at 13.6 TeV: the point is the orders of magnitude, not the digits).
 *
 * Every event is a `TriggerEvent`: reconstructed objects for the HLT (small resolution), and a coarse Level-1 input (towers and
 * muon stubs, built from the same objects with the L1's coarser measurements, some soft towers for pile-up, and the recoil).
 * The minimum-bias and dijet samples are stratified in the scale of the hardest scattering, each stratum carrying its own weight, so
 * that the rare high-scale tail that triggers is sampled as well as the bulk.
 *
 * Cross-sections (pb), approximate public values at 13–14 TeV:
 *   inelastic pp 80 mb = 8.0e10; Z → μμ (m > 50 GeV) about 2 nb; W → ℓν (ℓ = e, μ) about 40 nb together; dijets with pT̂ > 30 GeV about 19 µb
 *   (consistent with the minimum-bias tail; the dijet spectrum falls as pT̂⁻⁴); H → γγ about 55 pb × 0.23% = 0.13 pb; H → 4ℓ (e, μ) about 55 pb × 0.0125% = 0.0069 pb;
 *   tt̄ about 830 pb; B → J/ψ(→ μμ) X about 0.6 µb ×1 (order of magnitude); a SUSY-like gluino pair 0.05 pb (an invented benchmark).
 */
import { breitWigner, exponential, normal, rng, type Rng } from '../random/index.ts';
import { add, boost, eta as etaOf, fromMass, fromPtEtaPhiM, phi as phiOf, pt as ptOf, twoBodyDecay, type P4 } from '../kinematics/index.ts';
import type { ObjectKind, RecoEvent, RecoObject } from '../event/index.ts';
import { l1InputFromReco } from './level1.ts';
import type { Sample, TriggerEvent } from './menu.ts';

export interface ToySampleInfo {
  key: string;
  label: string;
  sigmaPb: number;
  role: 'signal' | 'background';
  /** How much the course cares about keeping this physics (the game's score weights). */
  importance: number;
  /** One-line description. */
  note: string;
}

const SIGMA_INEL_PB = 8.0e10;
const P0 = 0.8;
const Q0 = 2;
/** σ(minijet scale q > x) = σ_inel · P0 · (Q0/x)³. */
const sigmaAbove = (x: number): number => SIGMA_INEL_PB * P0 * (Q0 / x) ** 3;

export const TOY_SAMPLES: ToySampleInfo[] = [
  { key: 'minbias', label: 'Minimum bias', sigmaPb: SIGMA_INEL_PB - sigmaAbove(30), role: 'background', importance: 0, note: 'inelastic pp collisions with a mini-jet below 30 GeV: soft and uninteresting, 80 mb' },
  { key: 'dijets', label: 'Dijets (pT > 30 GeV)', sigmaPb: sigmaAbove(30), role: 'background', importance: 0, note: 'hard QCD scattering: two back-to-back jets' },
  { key: 'wlnu', label: 'W → ℓν', sigmaPb: 4.0e4, role: 'signal', importance: 1, note: 'a lepton and a neutrino (missing energy)' },
  { key: 'zmumu', label: 'Z → μμ', sigmaPb: 2.0e3, role: 'signal', importance: 1, note: 'two muons at the Z mass' },
  { key: 'ttbar', label: 'Top pairs', sigmaPb: 830, role: 'signal', importance: 2, note: 'two W bosons and two b-jets' },
  { key: 'hgg', label: 'H → γγ', sigmaPb: 0.13, role: 'signal', importance: 4, note: 'two photons at 125 GeV' },
  { key: 'h4l', label: 'H → ZZ* → 4ℓ', sigmaPb: 0.0069, role: 'signal', importance: 4, note: 'four leptons (e, μ) at 125 GeV' },
  { key: 'susy', label: 'SUSY-like', sigmaPb: 0.05, role: 'signal', importance: 3, note: 'many hard jets and large missing energy (an invented benchmark)' },
  { key: 'bmumu', label: 'B → J/ψ X (low pT)', sigmaPb: 6.0e5, role: 'signal', importance: 1, note: 'two soft muons from b-hadron decays' },
];

// ── Building blocks ──────────────────────────────────────────────────────────────────────────────

interface Vis { kind: ObjectKind; pt: number; eta: number; phi: number; m: number; charge?: number; iso: number; btag?: number }

const U = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r();
const rayleigh = (r: Rng, mean: number) => (mean / Math.sqrt(Math.PI / 2)) * Math.sqrt(-2 * Math.log(1 - r()));
const vis = (kind: ObjectKind, p: P4, iso: number, charge?: number, extra: Partial<Vis> = {}): Vis => ({ kind, pt: ptOf(p), eta: etaOf(p), phi: phiOf(p), m: 0, charge, iso, ...extra });
const asP4 = (v: Vis): P4 => fromPtEtaPhiM(v.pt, v.eta, v.phi, v.m);

/** A boson-like system of mass m, transverse momentum from a Rayleigh distribution, rapidity Gaussian. */
function system(r: Rng, m: number, ptMean: number, yWidth: number): P4 {
  const pt = rayleigh(r, ptMean);
  const y = normal(r, 0, yWidth);
  const phi = U(r, -Math.PI, Math.PI);
  const mT = Math.hypot(m, pt);
  return { E: mT * Math.cosh(y), px: pt * Math.cos(phi), py: pt * Math.sin(phi), pz: mT * Math.sinh(y) };
}

const ACCEPT: Record<string, { etaMax: number; eff: number; res: number }> = {
  muon: { etaMax: 2.4, eff: 1, res: 0.015 },
  electron: { etaMax: 2.5, eff: 1, res: 0.02 },
  photon: { etaMax: 2.5, eff: 1, res: 0.015 },
  jet: { etaMax: 4.7, eff: 1, res: 0.08 },
  tau: { etaMax: 2.5, eff: 0.6, res: 0.08 },
};
const JET_MIN = 20;

interface Built { event: TriggerEvent; }

/**
 * Turn the final-state objects of an event into a TriggerEvent. `invisible` is the vector sum of the invisible particles' pT
 * (neutrinos); the recoil of the rest of the event (initial-state radiation, the rest of the hadronic system) balances the total.
 */
function finish(r: Rng, objs: Vis[], invisible: { x: number; y: number }, opts: { recoil?: boolean } = {}): Built {
  let sx = invisible.x, sy = invisible.y;
  for (const o of objs) { sx += o.pt * Math.cos(o.phi); sy += o.pt * Math.sin(o.phi); }
  const extra: { et: number; eta: number; phi: number }[] = [];
  const recoilEt = opts.recoil === false ? 0 : Math.hypot(sx, sy);
  const recoilPhi = Math.atan2(-sy, -sx);
  const recoilEta = normal(r, 0, 1.5);
  const reco: RecoObject[] = [];
  let mx = 0, my = 0, sumEt = 0;
  const addReco = (kind: ObjectKind, pt: number, eta: number, phi: number, m: number, charge: number | undefined, iso: number, btag?: number) => {
    const p = fromPtEtaPhiM(pt, eta, phi, m);
    reco.push({ kind, p, charge, isolation: iso, btag, truth: -1 });
    mx -= p.px; my -= p.py; sumEt += pt;
  };
  for (const o of objs) {
    const a = ACCEPT[o.kind];
    if (!a) continue;
    if (Math.abs(o.eta) >= a.etaMax || r() > a.eff) {
      // not reconstructed as an object: a jet below threshold or outside the tracker still deposits energy
      if (o.kind === 'jet') extra.push({ et: o.pt, eta: o.eta, phi: o.phi });
      continue;
    }
    const pt = o.pt * (1 + a.res * normal(r));
    if (o.kind === 'jet' && pt < JET_MIN) { extra.push({ et: o.pt, eta: o.eta, phi: o.phi }); mx -= pt * Math.cos(o.phi); my -= pt * Math.sin(o.phi); continue; }
    addReco(o.kind, pt, o.eta, o.phi, o.m, o.charge, o.iso * (0.8 + 0.4 * r()), o.btag);
  }
  if (recoilEt > 1) {
    if (recoilEt >= 25 && Math.abs(recoilEta) < 3) addReco('jet', recoilEt, recoilEta, recoilPhi, 0, undefined, 0);
    else { extra.push({ et: recoilEt, eta: recoilEta, phi: recoilPhi }); mx -= recoilEt * Math.cos(recoilPhi); my -= recoilEt * Math.sin(recoilPhi); }
    if (recoilEt < 25 || Math.abs(recoilEta) >= 3) sumEt += recoilEt;
  }
  mx += normal(r, 0, 4); my += normal(r, 0, 4);
  const recoEvent: RecoEvent = { tracks: [], vertices: [], clusters: [], objects: reco, met: { x: mx, y: my }, sumEt };
  const l1 = l1InputFromReco(recoEvent, { rng: r, extra, softTowers: 40 });
  return { event: { reco: recoEvent, l1 } };
}

const jetVis = (pt: number, eta: number, phi: number, r: Rng, nonPromptMuon = 0.012): Vis[] => {
  const out: Vis[] = [{ kind: 'jet', pt, eta, phi, m: 0, iso: 0 }];
  if (r() < nonPromptMuon) out.push({ kind: 'muon', pt: pt * U(r, 0.05, 0.3), eta: eta + normal(r, 0, 0.05), phi: phi + normal(r, 0, 0.05), m: 0.1057, charge: r() < 0.5 ? 1 : -1, iso: U(r, 0.25, 1.5) });
  return out;
};
const leptonVis = (kind: 'electron' | 'muon', p: P4, charge: number, r: Rng, isoScale = 0.03): Vis => vis(kind, p, exponential(r, isoScale), charge, { m: kind === 'muon' ? 0.1057 : 0.000511 });
const photonVis = (p: P4, r: Rng): Vis => vis('photon', p, exponential(r, 0.03), 0);

// ── The processes ──────────────────────────────────────────────────────────────────────────────

function genZmumu(r: Rng): { b: Built; fiducial: boolean } {
  const Z = system(r, 91.19, 12, 1.6);
  const M = breitWigner(r, 91.19, 2.495, 60, 120);
  const Zp = fromMass(M, Z.px, Z.py, Z.pz);
  const [a, b] = twoBodyDecay(r, Zp, 0.1057, 0.1057);
  const objs = [leptonVis('muon', a, -1, r), leptonVis('muon', b, 1, r)];
  return { b: finish(r, objs, { x: 0, y: 0 }), fiducial: objs.every((o) => o.pt > 20 && Math.abs(o.eta) < 2.4) };
}
function genWlnu(r: Rng): { b: Built; fiducial: boolean } {
  const W = system(r, 80.38, 10, 1.5);
  const M = breitWigner(r, 80.38, 2.085, 50, 120);
  const Wp = fromMass(M, W.px, W.py, W.pz);
  const [l, nu] = twoBodyDecay(r, Wp, 0.0005, 0);
  const kind = r() < 0.5 ? 'muon' : 'electron';
  const lep = leptonVis(kind, l, r() < 0.5 ? -1 : 1, r);
  return { b: finish(r, [lep], { x: nu.px, y: nu.py }), fiducial: lep.pt > 25 && Math.abs(lep.eta) < (kind === 'muon' ? 2.4 : 2.5) };
}
/** Minimum-bias stratum k of the scale ranges [0,2), [2,4), [4,8), [8,16), [16,30). */
const MB_EDGES = [0, 2, 4, 8, 16, 30];
function genMinbias(r: Rng, k: number): TriggerEvent {
  const objs: Vis[] = [];
  if (k > 0) {
    const lo = MB_EDGES[k]!, hi = MB_EDGES[k + 1]!;
    // power-law q in [lo, hi): P(q > x) ∝ x⁻³
    const u = r();
    const q = Math.pow(lo ** -3 - u * (lo ** -3 - hi ** -3), -1 / 3);
    const y = normal(r, 0, 1.2);
    const dy = Math.abs(normal(r, 0, 0.7));
    const phi = U(r, -Math.PI, Math.PI);
    objs.push(...jetVis(q, y + dy, phi, r), ...jetVis(q * (1 + normal(r, 0, 0.03)), y - dy, phi + Math.PI + normal(r, 0, 0.05), r));
  }
  return finish(r, objs, { x: 0, y: 0 }).event;
}
/** Dijet strata in pT̂: [30,50), [50,100), [100,200), [200,400), [400,800), [800,∞); the spectrum falls as pT̂⁻⁴. */
const DIJET_EDGES = [30, 50, 100, 200, 400, 800, Infinity];
const dijetSigmaAbove = (x: number): number => (Number.isFinite(x) ? sigmaAbove(30) * (30 / x) ** 4 : 0);
function genDijet(r: Rng, k: number): TriggerEvent {
  const lo = DIJET_EDGES[k]!, hi = DIJET_EDGES[k + 1]!;
  const u = r();
  const q = Math.pow(lo ** -4 - u * (lo ** -4 - (Number.isFinite(hi) ? hi ** -4 : 0)), -1 / 4);
  const y = normal(r, 0, 1.2);
  const dy = Math.abs(normal(r, 0, 0.8));
  const phi = U(r, -Math.PI, Math.PI);
  const objs = [...jetVis(q, y + dy, phi, r, 0.015), ...jetVis(q * (1 + normal(r, 0, 0.04)), y - dy, phi + Math.PI + normal(r, 0, 0.06), r, 0.015)];
  return finish(r, objs, { x: 0, y: 0 }).event;
}
function genHgg(r: Rng): { b: Built; fiducial: boolean } {
  const H = system(r, 125.25, 30, 1.9);
  const [a, b] = twoBodyDecay(r, H, 0, 0);
  const objs = [photonVis(a, r), photonVis(b, r)];
  const [lead, sub] = objs[0]!.pt > objs[1]!.pt ? [objs[0]!, objs[1]!] : [objs[1]!, objs[0]!];
  return { b: finish(r, objs, { x: 0, y: 0 }), fiducial: lead.pt > 125.25 / 3 && sub.pt > 125.25 / 4 && objs.every((o) => Math.abs(o.eta) < 2.5) };
}
function genH4l(r: Rng): { b: Built; fiducial: boolean } {
  const H = system(r, 125.25, 30, 1.9);
  let m1 = 0, m2 = 0;
  do {
    m1 = breitWigner(r, 91.19, 2.495, 50, 100);
    m2 = U(r, 12, 40);
  } while (m1 + m2 >= 125.0);
  const [z1, z2] = twoBodyDecay(r, H, m1, m2);
  const u = r();
  const f1: 'electron' | 'muon' = u < 0.25 ? 'electron' : u < 0.5 ? 'muon' : r() < 0.5 ? 'electron' : 'muon';
  const f2: 'electron' | 'muon' = u < 0.25 ? 'electron' : u < 0.5 ? 'muon' : f1 === 'electron' ? 'muon' : 'electron';
  const mass = (k: 'electron' | 'muon') => (k === 'muon' ? 0.1057 : 0.000511);
  const [a, b] = twoBodyDecay(r, z1, mass(f1), mass(f1));
  const [c, d] = twoBodyDecay(r, z2, mass(f2), mass(f2));
  const objs = [leptonVis(f1, a, -1, r), leptonVis(f1, b, 1, r), leptonVis(f2, c, -1, r), leptonVis(f2, d, 1, r)];
  const sorted = objs.map((o) => o.pt).sort((x, y) => y - x);
  const ok = objs.every((o) => Math.abs(o.eta) < (o.kind === 'muon' ? 2.4 : 2.5) && o.pt > (o.kind === 'muon' ? 5 : 7)) && sorted[0]! > 20 && sorted[1]! > 10;
  return { b: finish(r, objs, { x: 0, y: 0 }), fiducial: ok };
}
function genTtbar(r: Rng): { b: Built; fiducial: boolean } {
  const phi0 = U(r, -Math.PI, Math.PI);
  const pt1 = rayleigh(r, 90);
  const pt2 = pt1 * (1 + normal(r, 0, 0.25));
  const tops: P4[] = [
    (() => { const y = normal(r, 0, 1.3); const mT = Math.hypot(172.5, pt1); return { E: mT * Math.cosh(y), px: pt1 * Math.cos(phi0), py: pt1 * Math.sin(phi0), pz: mT * Math.sinh(y) }; })(),
    (() => { const y = normal(r, 0, 1.3); const p = Math.max(1, pt2); const mT = Math.hypot(172.5, p); return { E: mT * Math.cosh(y), px: -p * Math.cos(phi0), py: -p * Math.sin(phi0), pz: mT * Math.sinh(y) }; })(),
  ];
  const objs: Vis[] = [];
  let inv = { x: 0, y: 0 };
  let nLep = 0;
  for (const t of tops) {
    const mW = breitWigner(r, 80.38, 2.085, 50, 110);
    const [bq, W] = twoBodyDecay(r, t, 4.8, mW);
    objs.push(vis('jet', bq, 0, undefined, { btag: 0.7 + 0.3 * r() }));
    const u = r();
    if (u < 0.216) {
      const [l, nu] = twoBodyDecay(r, W, u < 0.108 ? 0.000511 : 0.1057, 0);
      objs.push(leptonVis(u < 0.108 ? 'electron' : 'muon', l, r() < 0.5 ? 1 : -1, r));
      inv = { x: inv.x + nu.px, y: inv.y + nu.py };
      nLep++;
    } else {
      const [q1, q2] = twoBodyDecay(r, W, 0, 0);
      objs.push(vis('jet', q1, 0), vis('jet', q2, 0));
    }
  }
  const jets = objs.filter((o) => o.kind === 'jet' && o.pt > 30 && Math.abs(o.eta) < 2.5).length;
  const lep = objs.find((o) => (o.kind === 'muon' || o.kind === 'electron') && o.pt > 25 && Math.abs(o.eta) < 2.4);
  return { b: finish(r, objs, inv), fiducial: nLep >= 1 && !!lep && jets >= 3 };
}
function genBmumu(r: Rng): { b: Built; fiducial: boolean } {
  const pt = 3 + exponential(r, 9);
  const y = normal(r, 0, 1.8);
  const phi = U(r, -Math.PI, Math.PI);
  const mT = Math.hypot(3.097, pt);
  const J = { E: mT * Math.cosh(y), px: pt * Math.cos(phi), py: pt * Math.sin(phi), pz: mT * Math.sinh(y) };
  const [a, b] = twoBodyDecay(r, J, 0.1057, 0.1057);
  const objs = [leptonVis('muon', a, -1, r, 0.4), leptonVis('muon', b, 1, r, 0.4)];
  // the rest of the b-quark system recoils as a soft jet
  return { b: finish(r, objs, { x: 0, y: 0 }), fiducial: objs.every((o) => o.pt > 4 && Math.abs(o.eta) < 2.4) };
}
function genSusy(r: Rng): { b: Built; fiducial: boolean } {
  const objs: Vis[] = [];
  const n = 4 + (r() < 0.4 ? 1 : 0);
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const pt = 80 + exponential(r, 130);
    const phi = U(r, -Math.PI, Math.PI);
    objs.push(vis('jet', fromPtEtaPhiM(pt, normal(r, 0, 1.3), phi, 0), 0));
    sx += pt * Math.cos(phi); sy += pt * Math.sin(phi);
  }
  // the two invisible neutralinos carry the opposite of the visible transverse momentum
  const inv = { x: -sx, y: -sy };
  const met = Math.hypot(inv.x, inv.y);
  const ht = objs.reduce((s, o) => s + (o.pt > 30 && Math.abs(o.eta) < 2.5 ? o.pt : 0), 0);
  return { b: finish(r, objs, inv, { recoil: false }), fiducial: met > 200 && ht > 400 };
}

export interface ToyOptions {
  seed?: number;
  /** Events per sample (the minimum-bias sample gets this many in total, spread over its five strata). */
  nPerSample?: number;
  /** Which samples to build (keys of TOY_SAMPLES); all by default. */
  only?: readonly string[];
}

/** Generate the toy samples. Deterministic for a given seed. */
export function generateToySamples(opts: ToyOptions = {}): Sample[] {
  const n = opts.nPerSample ?? 2000;
  const root = rng(opts.seed ?? 1);
  const out: Sample[] = [];
  for (const info of TOY_SAMPLES) {
    const r = root.fork(info.key); // forked for every sample, so that `only` does not change the others' random streams
    if (opts.only && !opts.only.includes(info.key)) continue;
    const events: TriggerEvent[] = [];
    if (info.key === 'minbias') {
      const per = Math.max(1, Math.floor(n / 5));
      const sig = (k: number) => (k === 0 ? SIGMA_INEL_PB * (1 - P0) : k < 5 ? sigmaAbove(MB_EDGES[k]!) - sigmaAbove(MB_EDGES[k + 1]!) : 0);
      for (let k = 0; k < 5; k++) {
        const w = sig(k) / per;
        for (let i = 0; i < per; i++) events.push({ ...genMinbias(r, k), weight: w });
      }
    } else if (info.key === 'dijets') {
      const per = Math.max(1, Math.floor(n / 6));
      for (let k = 0; k < 6; k++) {
        const w = (dijetSigmaAbove(DIJET_EDGES[k]!) - dijetSigmaAbove(DIJET_EDGES[k + 1]!)) / per;
        for (let i = 0; i < per; i++) events.push({ ...genDijet(r, k), weight: w });
      }
    } else {
      const gen = { zmumu: genZmumu, wlnu: genWlnu, hgg: genHgg, h4l: genH4l, ttbar: genTtbar, bmumu: genBmumu, susy: genSusy }[info.key]!;
      for (let i = 0; i < n; i++) {
        const g = gen(r);
        events.push({ ...g.b.event, fiducial: g.fiducial });
      }
    }
    out.push({ name: info.key, label: info.label, sigmaPb: info.sigmaPb, events, role: info.role });
  }
  return out;
}
