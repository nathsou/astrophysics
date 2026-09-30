/**
 * Text form of a process ("e+ e- > mu+ mu-"), particle names and typeset labels.
 */
import { antiId, byName, hasParticle, particle } from '../particles/index.ts';
import type { LineKind, Process } from './types.ts';

export const isFermion = (pdg: number): boolean => {
  const a = Math.abs(pdg);
  return (a >= 1 && a <= 6) || (a >= 11 && a <= 16);
};
export const isQuarkId = (pdg: number): boolean => Math.abs(pdg) >= 1 && Math.abs(pdg) <= 6;
export const isLeptonId = (pdg: number): boolean => Math.abs(pdg) >= 11 && Math.abs(pdg) <= 16;
export const isNeutrinoId = (pdg: number): boolean => [12, 14, 16].includes(Math.abs(pdg));
/** 1, 2 or 3 for quarks and leptons; 0 for bosons. */
export const generation = (pdg: number): number => {
  const a = Math.abs(pdg);
  if (a >= 1 && a <= 6) return Math.ceil(a / 2);
  if (a >= 11 && a <= 16) return Math.ceil((a - 10) / 2);
  return 0;
};
/** Is the particle its own antiparticle (γ, g, Z, H)? */
export const isSelfConjugate = (pdg: number): boolean => particle(Math.abs(pdg)).selfConjugate;

export function lineKind(pdg: number): LineKind {
  const a = Math.abs(pdg);
  if (isFermion(a)) return 'fermion';
  if (a === 22) return 'photon';
  if (a === 21) return 'gluon';
  if (a === 24) return 'W';
  if (a === 23) return 'Z';
  if (a === 25) return 'higgs';
  throw new Error(`no diagram line for PDG ID ${pdg}`);
}

/** The particle as a structured label: base letter, optional subscript and superscript, optional bar. */
export interface ParticleLabel {
  base: string;
  sub?: string;
  sup?: string;
  /** An antiparticle whose name is written with a bar: q̄, ν̄. */
  bar?: boolean;
  /** Plain Unicode text, e.g. "e⁻", "ν̄_μ". */
  text: string;
}

const MINUS = '−';
const SUP: Record<string, string> = { '+': '⁺', [MINUS]: '⁻', '0': '⁰' };
const GREEK_LEPTON: Record<number, string> = { 11: 'e', 13: 'μ', 15: 'τ' };

export function particleLabel(pdg: number): ParticleLabel {
  const a = Math.abs(pdg);
  const neg = pdg < 0;
  let l: Omit<ParticleLabel, 'text'>;
  if (GREEK_LEPTON[a]) l = { base: GREEK_LEPTON[a]!, sup: neg ? '+' : MINUS };
  else if (a === 12 || a === 14 || a === 16) l = { base: 'ν', sub: ['e', 'μ', 'τ'][(a - 12) / 2]!, bar: neg };
  else if (a >= 1 && a <= 6) l = { base: ['d', 'u', 's', 'c', 'b', 't'][a - 1]!, bar: neg };
  else if (a === 21) l = { base: 'g' };
  else if (a === 22) l = { base: 'γ' };
  else if (a === 23) l = { base: 'Z' };
  else if (a === 24) l = { base: 'W', sup: neg ? MINUS : '+' };
  else if (a === 25) l = { base: 'H' };
  else {
    const p = particle(pdg);
    l = { base: p.symbol };
  }
  let text = l.base;
  if (l.bar) text += '̄';
  if (l.sub) text += `_${l.sub}`;
  if (l.sup) text += SUP[l.sup] ?? l.sup;
  return { ...l, text };
}

/** Unicode symbol of a particle, "e⁺", "ν̄_e", "γ". */
export const symbolOf = (pdg: number): string => particleLabel(pdg).text;

/** ASCII name used in the text form: "e-", "mu+", "nu_e~", "u~", "gamma", "W+". */
export function asciiName(pdg: number): string {
  const p = particle(pdg);
  if (pdg > 0 || p.selfConjugate) return p.name;
  if (p.name.endsWith('+') || p.name.endsWith('-')) return p.name;
  return `${particle(-pdg).name}~`;
}

const SUPERSCRIPT_TO_ASCII: Record<string, string> = { '⁺': '+', '⁻': '-', '−': '-', '⁰': '0', '̄': '~', '̅': '~' };
const ALIASES: Record<string, number> = {
  e: 11, electron: 11, positron: -11, mu: 13, muon: 13, tau: 15,
  nu_e: 12, ve: 12, nue: 12, nu_mu: 14, vmu: 14, numu: 14, nu_tau: 16, vtau: 16, nutau: 16,
  gamma: 22, photon: 22, a: 22, g: 21, gluon: 21, z: 23, z0: 23, h: 25, higgs: 25, h0: 25,
  w: 24, 'w+': 24, 'w-': -24,
  u: 2, d: 1, s: 3, c: 4, b: 5, t: 6,
  p: 2212, n: 2112, proton: 2212, neutron: 2112,
};

/** Parse one particle name: "e+", "μ⁻", "mu-", "nu_e~", "anti-u", "ubar", "γ", "W-", "Z", "H". Throws on unknown names. */
export function parseParticle(token: string): number {
  let t = token.trim();
  if (!t) throw new Error('empty particle name');
  t = [...t].map((c) => SUPERSCRIPT_TO_ASCII[c] ?? c).join('');
  t = t.replace('μ', 'mu').replace('τ', 'tau').replace('γ', 'gamma').replace(/ν/g, 'nu').replace(/ℓ/g, 'l');
  t = t.replace(/^(.*?)~(_.+)$/, '$1$2~');
  const low = t.toLowerCase();
  // Antiparticle markers.
  let m = /^(?:anti-?|anti_)(.+)$/i.exec(t) ?? /^(.+?)(?:~|-?bar)$/i.exec(t);
  if (m) {
    const base = parseParticle(m[1]!);
    if (isSelfConjugate(base)) throw new Error(`${token}: ${symbolOf(base)} is its own antiparticle`);
    return -base;
  }
  // Charged names first: "e-", "mu+", "tau-", "W+", "pi-".
  const direct = byName(t);
  if (direct) return direct.pdg;
  if (low in ALIASES) return ALIASES[low]!;
  const s = /^(e|mu|tau|w)([+-])$/i.exec(t);
  if (s) {
    const base = ALIASES[s[1]!.toLowerCase()]!;
    const pos = s[2] === '+';
    return base === 24 ? (pos ? 24 : -24) : pos ? -base : base;
  }
  if (/^\d+$/.test(t) && hasParticle(Number(t))) return Number(t);
  if (/^-\d+$/.test(t) && hasParticle(Number(t))) return Number(t);
  throw new Error(`unknown particle "${token}"`);
}

/** Parse "e+ e- > mu+ mu-" (also "→" and "->"). Particles are separated by spaces or commas. */
export function parseProcess(text: string): Process {
  const halves = text.split(/\s*(?:->|=>|→|>)\s*/);
  if (halves.length !== 2) throw new Error('write a process as "initial particles > final particles", for example "e+ e- > mu+ mu-"');
  const side = (s: string) => s.split(/[\s,]+/).filter(Boolean).map(parseParticle);
  const initial = side(halves[0]!);
  const final = side(halves[1]!);
  if (!initial.length) throw new Error('the process has no incoming particle');
  if (!final.length) throw new Error('the process has no outgoing particle');
  return { initial, final };
}

/** Like `parseProcess` but returns the error instead of throwing. */
export function tryParseProcess(text: string): { ok: true; process: Process } | { ok: false; error: string } {
  try {
    return { ok: true, process: parseProcess(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The text form: "e+ e- > mu+ mu-". */
export function formatProcess(p: Process): string {
  return `${p.initial.map(asciiName).join(' ')} > ${p.final.map(asciiName).join(' ')}`;
}
/** Typeset: "e⁺ e⁻ → μ⁺ μ⁻". */
export function processSymbols(p: Process): string {
  return `${p.initial.map(symbolOf).join(' ')} → ${p.final.map(symbolOf).join(' ')}`;
}

/** The label of an outgoing particle seen as an incoming one, and vice versa (crossing). */
export const crossed = (pdg: number): number => antiId(pdg);
