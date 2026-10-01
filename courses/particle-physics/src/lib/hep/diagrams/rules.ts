/**
 * The Standard Model vertex rules as data, and the functions that decide whether a set of lines may meet at a vertex.
 *
 * Conventions. A vertex is described by the list of particle labels of the lines that meet there, every line
 * seen as flowing INTO the vertex (the "all incoming" convention). A particle that leaves the vertex enters
 * as its antiparticle, so the vertex e⁻ → e⁻ γ is the triple (e⁻, ē⁻ = e⁺, γ) = (11, -11, 22).
 * In this convention every conservation law is "the labels sum to zero": the charges, the baryon number
 * and each lepton number of the incoming labels add up to nothing, and a fermion vertex has one
 * positive and one negative fermion label (one arrow in, one arrow out).
 */
import { particle } from '../particles/index.ts';
import { generation, isFermion, isLeptonId, isNeutrinoId, isQuarkId, symbolOf } from './process.ts';
import type { Force, IssueCode } from './types.ts';

export type FermionPattern = 'none' | 'charged' | 'quark' | 'any' | 'massive' | 'charged-current' | 'four-charged-current';

export interface VertexRule {
  id: string;
  /** Human name with Unicode symbols. */
  name: string;
  /** Forces that must all be enabled for the vertex to be used. */
  force: Force[];
  /** Number of lines. */
  legs: 3 | 4;
  /** The coupling constant as it appears in the vertex factor. */
  coupling: string;
  /** Short plain-text symbol of the coupling constant: 'e', 'g_s', 'g', 'y_f', 'G_F'. */
  couplingSymbol: 'e' | 'g_s' | 'g' | 'y_f' | 'λ' | 'G_F';
  /** Powers of the couplings in the amplitude: e³ has ew = 3. One vertex contributes `ew` or `s`, never both. */
  order: { ew: number; s: number };
  /** Power of α (or α_s) that the vertex contributes to a rate: half the coupling power. */
  alphaPower: { alpha: number; alphaS: number };
  /** Does the vertex keep the flavour of a fermion line? False for the W (generation changes through the CKM matrix). */
  conservesFlavour: boolean;
  /** Always true in the Standard Model: every vertex conserves electric charge. */
  conservesCharge: true;
  /** `ckm` for the quark W vertex: off-diagonal generation pairs are allowed but suppressed. */
  mixing?: 'ckm';
  /** The coupling is proportional to a mass (the Yukawa coupling f f̄ H and the Higgs–gauge couplings). */
  massProportional: boolean;
  description: string;
  example: string;
  /** Matching data (labels of the bosons in the all-incoming convention, sorted, and the kind of fermion pair). */
  bosons: number[];
  fermions: FermionPattern;
}

const v = (r: Omit<VertexRule, 'legs' | 'alphaPower' | 'conservesCharge'> & { legs?: 3 | 4 }): VertexRule => ({
  ...r,
  legs: r.legs ?? (((r.fermions === 'none' ? r.bosons.length : r.fermions === 'four-charged-current' ? 4 : 2 + r.bosons.length) === 4 ? 4 : 3) as 3 | 4),
  alphaPower: { alpha: r.order.ew / 2, alphaS: r.order.s / 2 },
  conservesCharge: true,
});

export const VERTEX_RULES: readonly VertexRule[] = [
  // QED
  v({ id: 'ffγ', name: 'f f̄ γ', force: ['qed'], coupling: 'e Q_f', couplingSymbol: 'e', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'A photon couples to every charged fermion, with strength proportional to its charge Q_f. It leaves the fermion\'s flavour unchanged.', example: 'e⁻ → e⁻ γ', bosons: [22], fermions: 'charged' }),
  v({ id: 'WWγ', name: 'W⁺ W⁻ γ', force: ['qed'], coupling: 'e', couplingSymbol: 'e', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'The W is charged, so it couples to the photon.', example: 'W⁺ → W⁺ γ', bosons: [-24, 22, 24], fermions: 'none' }),
  v({ id: 'γγWW', name: 'W⁺ W⁻ γ γ', force: ['qed'], coupling: 'e²', couplingSymbol: 'e', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic vertex: two photons and a W pair.', example: 'γγ → W⁺ W⁻', bosons: [-24, 22, 22, 24], fermions: 'none' }),
  // QCD
  v({ id: 'qqg', name: 'q q̄ g', force: ['qcd'], coupling: 'g_s', couplingSymbol: 'g_s', order: { ew: 0, s: 1 }, conservesFlavour: true, massProportional: false,
    description: 'A gluon couples to quarks and changes their colour, not their flavour.', example: 'q → q g', bosons: [21], fermions: 'quark' }),
  v({ id: 'ggg', name: 'g g g', force: ['qcd'], coupling: 'g_s', couplingSymbol: 'g_s', order: { ew: 0, s: 1 }, conservesFlavour: true, massProportional: false,
    description: 'Gluons carry colour themselves, so they couple to each other.', example: 'g → g g', bosons: [21, 21, 21], fermions: 'none' }),
  v({ id: 'gggg', name: 'g g g g', force: ['qcd'], coupling: 'g_s²', couplingSymbol: 'g_s', order: { ew: 0, s: 2 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic gluon vertex.', example: 'g g → g g (contact)', bosons: [21, 21, 21, 21], fermions: 'none' }),
  // Weak
  v({ id: 'ffZ', name: 'f f̄ Z', force: ['weak'], coupling: 'g/cos θ_W · (g_V − g_A γ⁵)', couplingSymbol: 'g', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'The Z couples to every fermion, neutrinos included, and never changes its flavour (no flavour-changing neutral currents at tree level).', example: 'ν → ν Z', bosons: [23], fermions: 'any' }),
  v({ id: 'ffW', name: 'f f′ W', force: ['weak'], coupling: 'g/√2 · V_ij', couplingSymbol: 'g', order: { ew: 1, s: 0 }, legs: 3, conservesFlavour: false, mixing: 'ckm', massProportional: false,
    description: 'The W turns the upper member of a doublet into the lower one: ν_ℓ ↔ ℓ of the same generation (lepton flavour is conserved), and up-type ↔ down-type quarks, with generation mixing set by the CKM matrix V_ij.', example: 'μ⁻ → ν_μ W⁻', bosons: [-24, 24], fermions: 'charged-current' }),
  v({ id: 'WWZ', name: 'W⁺ W⁻ Z', force: ['weak'], coupling: 'g cos θ_W', couplingSymbol: 'g', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'The W carries weak charge, so it couples to the Z.', example: 'Z → W⁺ W⁻', bosons: [-24, 23, 24], fermions: 'none' }),
  v({ id: 'γZWW', name: 'W⁺ W⁻ γ Z', force: ['qed', 'weak'], coupling: 'e g cos θ_W', couplingSymbol: 'g', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic vertex with a photon, a Z and a W pair.', example: 'γ Z → W⁺ W⁻', bosons: [-24, 22, 23, 24], fermions: 'none' }),
  v({ id: 'ZZWW', name: 'W⁺ W⁻ Z Z', force: ['weak'], coupling: 'g² cos² θ_W', couplingSymbol: 'g', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic vertex with two Z bosons and a W pair.', example: 'Z Z → W⁺ W⁻', bosons: [-24, 23, 23, 24], fermions: 'none' }),
  v({ id: 'WWWW', name: 'W⁺ W⁻ W⁺ W⁻', force: ['weak'], coupling: 'g²', couplingSymbol: 'g', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic W self-coupling.', example: 'W⁺ W⁻ → W⁺ W⁻ (contact)', bosons: [-24, -24, 24, 24], fermions: 'none' }),
  // Higgs
  v({ id: 'ffH', name: 'f f̄ H', force: ['higgs'], coupling: 'm_f / v  (y_f = √2 m_f / v)', couplingSymbol: 'y_f', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: true,
    description: 'The Higgs couples to a fermion in proportion to its mass: strongly to the top quark, feebly to the electron. Neutrinos are massless in the Standard Model and do not couple.', example: 't → t H', bosons: [25], fermions: 'massive' }),
  v({ id: 'WWH', name: 'W⁺ W⁻ H', force: ['higgs'], coupling: 'g m_W', couplingSymbol: 'g', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: true,
    description: 'The Higgs couples to the W in proportion to its mass.', example: 'H → W⁺ W⁻', bosons: [-24, 24, 25], fermions: 'none' }),
  v({ id: 'ZZH', name: 'Z Z H', force: ['higgs'], coupling: 'g m_Z / cos θ_W', couplingSymbol: 'g', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: true,
    description: 'The Higgs couples to the Z in proportion to its mass (Higgs-strahlung e⁺e⁻ → Z* → Z H).', example: 'Z* → Z H', bosons: [23, 23, 25], fermions: 'none' }),
  v({ id: 'HHH', name: 'H H H', force: ['higgs'], coupling: '3 m_H² / v', couplingSymbol: 'λ', order: { ew: 1, s: 0 }, conservesFlavour: true, massProportional: true,
    description: 'The Higgs self-coupling, fixed by the Higgs mass.', example: 'H* → H H', bosons: [25, 25, 25], fermions: 'none' }),
  v({ id: 'HHHH', name: 'H H H H', force: ['higgs'], coupling: '3 m_H² / v²', couplingSymbol: 'λ', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: true,
    description: 'Quartic Higgs self-coupling.', example: 'H H → H H (contact)', bosons: [25, 25, 25, 25], fermions: 'none' }),
  v({ id: 'WWHH', name: 'W⁺ W⁻ H H', force: ['higgs'], coupling: 'g²/2', couplingSymbol: 'g', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic vertex: a W pair and two Higgs bosons.', example: 'W⁺ W⁻ → H H', bosons: [-24, 24, 25, 25], fermions: 'none' }),
  v({ id: 'ZZHH', name: 'Z Z H H', force: ['higgs'], coupling: 'g²/(2 cos² θ_W)', couplingSymbol: 'g', order: { ew: 2, s: 0 }, conservesFlavour: true, massProportional: false,
    description: 'Quartic vertex: two Z bosons and two Higgs bosons.', example: 'Z Z → H H', bosons: [23, 23, 25, 25], fermions: 'none' }),
  // Effective
  v({ id: 'fermi', name: 'Fermi four-fermion contact', force: ['fermi'], coupling: 'G_F/√2', couplingSymbol: 'G_F', order: { ew: 2, s: 0 }, legs: 4, conservesFlavour: false, mixing: 'ckm', massProportional: false,
    description: 'Fermi\'s 1934 contact interaction: two charged currents meet at one point. It is the W exchange with the W propagator shrunk to a point, valid far below m_W. It is an effective vertex, not part of the fundamental Standard Model.', example: 'μ⁻ → e⁻ ν̄_e ν_μ', bosons: [], fermions: 'four-charged-current' }),
];

const RULE_BY_ID = new Map(VERTEX_RULES.map((r) => [r.id, r]));
export const vertexRule = (id: string): VertexRule => {
  const r = RULE_BY_ID.get(id);
  if (!r) throw new Error(`unknown vertex rule ${id}`);
  return r;
};

const BOSON_RULES = new Map<string, VertexRule>();
for (const r of VERTEX_RULES) if (r.fermions === 'none') BOSON_RULES.set(r.bosons.join(','), r);

/** Electric charge ×3 of a label. */
const q3 = (label: number): number => particle(label).charge3;

export interface MatchContext {
  /** Forces enabled. Default: all except the effective `fermi`. */
  forces?: readonly Force[];
  /** See `EnumerateOptions.ckm`. Default `full`. */
  ckm?: 'auto' | 'diagonal' | 'full';
  /** Fermions lighter than this (GeV) do not couple to H. Default 0. */
  minYukawaMass?: number;
  /** For each label: is the line an external leg? (Used by `ckm: 'auto'`.) */
  external?: readonly boolean[];
}

const DEFAULT_FORCES: readonly Force[] = ['qed', 'qcd', 'weak', 'higgs'];

function forcesOk(rule: VertexRule, ctx: MatchContext): boolean {
  const on = ctx.forces ?? DEFAULT_FORCES;
  return rule.force.every((f) => on.includes(f));
}

/** Can f and f2 (both particle IDs, positive) be joined by a W? Returns 'ok', 'offdiag' (allowed only with generation mixing) or 'no'. */
function wPair(f: number, f2: number): 'ok' | 'offdiag' | 'no' {
  if (isLeptonId(f) && isLeptonId(f2)) return generation(f) === generation(f2) && isNeutrinoId(f) !== isNeutrinoId(f2) ? 'ok' : 'no';
  if (isQuarkId(f) && isQuarkId(f2)) {
    const upA = f % 2 === 0;
    const upB = f2 % 2 === 0;
    if (upA === upB) return 'no';
    return generation(f) === generation(f2) ? 'ok' : 'offdiag';
  }
  return 'no';
}

/**
 * Find the vertex rule for a set of lines (labels in the all-incoming convention), or null.
 * A rule is returned only if it conserves charge, has the right arrows and its forces are enabled.
 */
export function matchVertex(labels: readonly number[], ctx: MatchContext = {}): VertexRule | null {
  const n = labels.length;
  if (n < 3 || n > 4) return null;
  let charge = 0;
  for (const l of labels) charge += q3(l);
  if (charge !== 0) return null;
  const ferm = labels.filter(isFermion);
  const bos = labels.filter((l) => !isFermion(l));
  let rule: VertexRule | null = null;
  if (ferm.length === 0) {
    rule = BOSON_RULES.get([...labels].sort((a, b) => a - b).join(',')) ?? null;
  } else if (ferm.length === 2 && bos.length === 1 && n === 3) {
    const fi = labels.findIndex((l) => isFermion(l) && l > 0);
    const gi = labels.findIndex((l) => isFermion(l) && l < 0);
    if (fi < 0 || gi < 0) return null;
    const f = labels[fi]!;
    const f2 = -labels[gi]!;
    const b = bos[0]!;
    switch (Math.abs(b)) {
      case 22:
        if (f === f2 && particle(f).charge3 !== 0) rule = vertexRule('ffγ');
        break;
      case 21:
        if (f === f2 && isQuarkId(f)) rule = vertexRule('qqg');
        break;
      case 23:
        if (f === f2) rule = vertexRule('ffZ');
        break;
      case 25: {
        const m = particle(f).mass;
        if (f === f2 && m > 0 && m >= (ctx.minYukawaMass ?? 0)) rule = vertexRule('ffH');
        break;
      }
      case 24: {
        const pair = wPair(f, f2);
        if (pair === 'ok') rule = vertexRule('ffW');
        else if (pair === 'offdiag') {
          const mode = ctx.ckm ?? 'full';
          const ext = ctx.external;
          if (mode === 'full' || (mode === 'auto' && ext && ext[fi] && ext[gi])) rule = vertexRule('ffW');
        }
        break;
      }
    }
  } else if (ferm.length === 4 && n === 4) {
    const pos = ferm.filter((l) => l > 0);
    const neg = ferm.filter((l) => l < 0).map((l) => -l);
    if (pos.length === 2 && neg.length === 2) {
      const okPair = (a: number, b: number) => wPair(a, b) === 'ok';
      if ((okPair(pos[0]!, neg[0]!) && okPair(pos[1]!, neg[1]!)) || (okPair(pos[0]!, neg[1]!) && okPair(pos[1]!, neg[0]!))) rule = vertexRule('fermi');
    }
  }
  if (rule && !forcesOk(rule, ctx)) return null;
  return rule;
}

export interface VertexReason {
  code: IssueCode;
  message: string;
}
export interface VertexCheck {
  ok: boolean;
  rule?: VertexRule;
  /** Why the vertex is not allowed, most fundamental reason first. */
  reasons: VertexReason[];
  /** Non-fatal remarks (for instance: the coupling is tiny). */
  notes: VertexReason[];
}

const fmtCharge = (c3: number): string => {
  const c = c3 / 3;
  const s = Number.isInteger(c) ? String(Math.abs(c)) : `${Math.abs(c3)}/3`;
  return `${c3 > 0 ? '+' : '−'}${s}`;
};

/** Decide whether the lines may meet at a vertex, and say why not when they may not. */
export function checkVertex(labels: readonly number[], ctx: MatchContext = {}): VertexCheck {
  const reasons: VertexReason[] = [];
  const notes: VertexReason[] = [];
  const n = labels.length;
  if (n < 3) return { ok: false, reasons: [{ code: 'degree', message: n === 0 ? 'No line ends at this point yet.' : `A vertex needs at least three lines; this one has ${n}.` }], notes };
  if (n > 4) return { ok: false, reasons: [{ code: 'degree', message: `The Standard Model has vertices with three or four lines; this one has ${n}.` }], notes };
  const rule = matchVertex(labels, ctx);
  if (rule) {
    if (rule.id === 'ffH') {
      const f = labels.find((l) => l > 0 && isFermion(l))!;
      const m = particle(f).mass;
      if (m < 0.01) notes.push({ code: 'yukawa-small', message: `Allowed, but the coupling is proportional to the ${symbolOf(f)} mass (${m < 0.001 ? `${(m * 1000).toPrecision(2)} MeV` : `${(m * 1000).toFixed(0)} MeV`}): it is tiny.` });
    }
    const ffw = rule.id === 'ffW' || rule.id === 'fermi';
    if (ffw) {
      const fs = labels.filter((l) => isFermion(l));
      const quarks = fs.filter(isQuarkId);
      if (quarks.length >= 2) {
        const pos = quarks.find((l) => l > 0)!;
        const neg = -quarks.find((l) => l < 0)!;
        if (generation(pos) !== generation(neg)) notes.push({ code: 'generation', message: `Allowed through CKM mixing between generations ${generation(pos)} and ${generation(neg)}, but suppressed: |V| is small.` });
      }
    }
    return { ok: true, rule, reasons, notes };
  }

  // Why not?
  let charge = 0;
  for (const l of labels) charge += q3(l);
  if (charge !== 0) reasons.push({ code: 'charge', message: `Charge is not conserved at this vertex: the lines bring in a net charge of ${fmtCharge(charge)} e.` });
  const ferm = labels.filter(isFermion);
  const bos = labels.filter((l) => !isFermion(l));
  const nPos = ferm.filter((l) => l > 0).length;
  const nNeg = ferm.length - nPos;
  let arrowsOk = true;
  if (ferm.length % 2 === 1) {
    arrowsOk = false;
    reasons.push({ code: 'arrows', message: 'A fermion line cannot begin or end at a vertex: it runs through, one arrow in and one arrow out.' });
  } else if (nPos !== nNeg) {
    arrowsOk = false;
    reasons.push({ code: 'arrows', message: `The fermion arrows must run through the vertex (one in, one out); here ${nPos} point in and ${nNeg} point out, so fermion number is not conserved.` });
  }
  const has = (id: number) => bos.some((b) => Math.abs(b) === id);
  if (arrowsOk) {
    // Baryon and lepton number, and flavour, only when the arrows are right (otherwise they just repeat the same fault).
    let bary = 0;
    const lep = [0, 0, 0];
    for (const l of labels) {
      const p = particle(l);
      bary += p.baryon3;
      for (let i = 0; i < 3; i++) lep[i]! += p.lepton[i]!;
    }
    if (bary !== 0) reasons.push({ code: 'baryon', message: 'Baryon number is not conserved: no vertex turns a quark into a lepton.' });
    else if (lep.some((x) => x !== 0)) {
      const total = lep[0]! + lep[1]! + lep[2]!;
      if (total !== 0) reasons.push({ code: 'lepton-flavour', message: 'Lepton number is not conserved at this vertex.' });
      else reasons.push({ code: 'lepton-flavour', message: 'Lepton flavour is not conserved at this vertex: the W turns a charged lepton into the neutrino of the same generation only (e ↔ ν_e, μ ↔ ν_μ, τ ↔ ν_τ).' });
    }
    if (ferm.length === 2 && bos.length === 1) {
      const a = Math.abs(ferm[0]!);
      const b = Math.abs(ferm[1]!);
      const boson = Math.abs(bos[0]!);
      const neutral = [a, b].some((x) => particle(x).charge3 === 0);
      if (boson === 22 && neutral) reasons.push({ code: 'photon-neutral', message: `A photon cannot couple to a neutrino: neutrinos have no electric charge.` });
      else if (boson === 21 && (isLeptonId(a) || isLeptonId(b))) reasons.push({ code: 'gluon-lepton', message: 'A gluon couples only to quarks and to gluons: leptons carry no colour.' });
      else if (boson === 25 && (isNeutrinoId(a) || isNeutrinoId(b))) reasons.push({ code: 'higgs-mass', message: 'The Higgs couples in proportion to mass, and neutrinos are massless in the Standard Model.' });
      if (a !== b && [22, 21, 23, 25].includes(boson) && !reasons.some((r) => ['photon-neutral', 'gluon-lepton', 'higgs-mass', 'lepton-flavour', 'baryon'].includes(r.code))) {
        const nm = boson === 21 ? 'A gluon changes the colour of a quark, not its flavour' : boson === 22 ? 'A photon does not change the flavour of a fermion' : boson === 23 ? 'A Z couples a fermion to itself: there are no flavour-changing neutral currents at tree level' : 'The Higgs couples a fermion to itself, not to a different one';
        reasons.push({ code: boson === 21 ? 'gluon-flavour' : 'flavour-change', message: `${nm}.` });
      }
      if (boson === 24 && isLeptonId(a) && isLeptonId(b) && generation(a) !== generation(b) && !reasons.some((r) => r.code === 'lepton-flavour')) {
        reasons.push({ code: 'generation', message: 'A W connects a charged lepton to the neutrino of the same generation only.' });
      }
      if (boson === 24 && isQuarkId(a) && isQuarkId(b) && reasons.length === 0) {
        reasons.push({ code: 'flavour-change', message: 'A W connects an up-type quark (u, c, t) to a down-type quark (d, s, b).' });
      }
    }
  }
  if (!reasons.length || reasons.every((r) => r.code === 'arrows' || r.code === 'charge')) {
    if (has(21) && bos.some((b) => Math.abs(b) !== 21) && ferm.length === 0) reasons.push({ code: 'colour', message: 'Gluons couple only to quarks and to other gluons; the other boson here carries no colour.' });
    else if (ferm.length === 0 && bos.length > 0 && bos.every((b) => b === 22 || b === 23) && !has(24)) reasons.push({ code: 'neutral-bosons', message: 'The photon and the Z carry no charge, so they do not couple to each other or to themselves: only the W⁺ and W⁻ carry weak charge.' });
    else if (ferm.length === 0 && has(25) && bos.some((b) => [21, 22].includes(Math.abs(b)))) reasons.push({ code: 'unknown', message: 'There is no tree-level coupling of the Higgs boson to massless gauge bosons (γγ, gg); those arise only through loops.' });
    else if (ferm.length === 4 && ferm.length === n) reasons.push({ code: 'effective', message: 'A four-fermion vertex is not a Standard Model vertex (only Fermi\'s effective theory has one, with two charged currents).' });
    else if (!reasons.length) reasons.push({ code: 'unknown', message: 'The Standard Model has no vertex with these lines.' });
  }
  // A vertex that exists but is switched off.
  if (!reasons.length) reasons.push({ code: 'unknown', message: 'This vertex belongs to an interaction that is switched off for this process.' });
  return { ok: false, reasons, notes };
}

// ── Coupling strengths (for rough ranking only) ─────────────────────────────

// Local copies of the couplings (the same values as `units`): 1/α = 137.036, α_s(m_Z) = 0.118, sin²θ_W = 0.2229.
const ALPHA = 1 / 137.035999084;
const ALPHA_S_MZ = 0.118;
const SIN2_THETA_W = 0.2229;
const E_COUPLING = Math.sqrt(4 * Math.PI * ALPHA);
const GS = Math.sqrt(4 * Math.PI * ALPHA_S_MZ);
const SW = Math.sqrt(SIN2_THETA_W);
const CW = Math.sqrt(1 - SIN2_THETA_W);
const G_W = E_COUPLING / SW;
const V_HIGGS = 246.22;

const CKM: Record<string, number> = { '2,1': 0.974, '2,3': 0.225, '2,5': 0.0037, '4,1': 0.225, '4,3': 0.973, '4,5': 0.041, '6,1': 0.0086, '6,3': 0.040, '6,5': 0.999 };

/**
 * A rough magnitude of the vertex factor, dimensionless, for ranking diagrams: e|Q| for the photon, g_s for the gluon,
 * the Z's vector and axial couplings, g V_ij/√2 for the W, √2 m_f/v for the Higgs. It ignores spin structure and propagators.
 */
export function couplingStrength(rule: VertexRule, labels: readonly number[]): number {
  const fermions = labels.filter((l) => isFermion(l));
  const f = Math.abs(fermions[0] ?? 0);
  switch (rule.id) {
    case 'ffγ':
      return E_COUPLING * Math.abs(particle(f).charge3) / 3;
    case 'qqg':
    case 'ggg':
      return GS;
    case 'gggg':
      return GS * GS;
    case 'ffZ': {
      const q = particle(f).charge3 / 3;
      const t3 = isNeutrinoId(f) || f % 2 === 0 ? 0.5 : -0.5;
      const gv = t3 / 2 - q * SIN2_THETA_W;
      const ga = t3 / 2;
      return (E_COUPLING / (SW * CW)) * Math.hypot(gv, ga);
    }
    case 'ffW': {
      const a = Math.abs(fermions.find((l) => l > 0)!);
      const b = Math.abs(fermions.find((l) => l < 0)!);
      const ckm = isQuarkId(a) ? CKM[`${Math.max(a, b)},${Math.min(a, b)}`] ?? 1 : 1;
      return (G_W / Math.SQRT2) * ckm;
    }
    case 'ffH':
      return (Math.SQRT2 * particle(f).mass) / V_HIGGS;
    case 'WWγ':
      return E_COUPLING;
    case 'γγWW':
      return E_COUPLING ** 2;
    case 'WWZ':
      return G_W * CW;
    case 'γZWW':
      return E_COUPLING * G_W * CW;
    case 'ZZWW':
      return (G_W * CW) ** 2;
    case 'WWWW':
      return G_W ** 2;
    case 'WWH':
    case 'ZZH':
    case 'HHH':
      return G_W / 2;
    case 'fermi':
      return G_W * G_W / 8;
    default:
      return G_W ** 2 / 4;
  }
}
