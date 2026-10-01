/**
 * Reading a reaction typed by a person: `K- + p -> Omega- + K+ + K0`, `p → e+ + γ`, `mu- -> e- + nubar_e + nu_mu`.
 * Names are the table's ASCII names (`particle.name`), their typeset symbols, and a few common spellings.
 */
import { allParticles, byName, particle } from '../particles/index.ts';

export interface ParsedReaction {
  initial: number[];
  final: number[];
  /** Problems found, in plain language. Empty when the text was read completely. */
  errors: string[];
}

let lookup: Map<string, number> | null = null;

function normalise(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[̄̅¯]/g, '~') // combining macron or overbar → antiparticle tilde
    .replace(/\s+/g, '')
    .replace(/[⁺]/g, '+')
    .replace(/[⁻−–]/g, '-')
    .replace(/⁰/g, '0')
    .replace(/γ/g, 'gamma')
    .replace(/π/g, 'pi')
    .replace(/μ/g, 'mu')
    .replace(/ν/g, 'nu')
    .replace(/τ/g, 'tau')
    .replace(/Λ/g, 'Lambda')
    .replace(/Σ/g, 'Sigma')
    .replace(/Ξ/g, 'Xi')
    .replace(/Ω/g, 'Omega')
    .replace(/Δ/g, 'Delta')
    .replace(/η/g, 'eta')
    .replace(/ρ/g, 'rho')
    .replace(/ω/g, 'omega')
    .replace(/φ/g, 'phi')
    .replace(/ψ/g, 'psi')
    .replace(/Υ/g, 'Upsilon')
    .replace(/⁺⁺/g, '++');
}

function build(): Map<string, number> {
  const m = new Map<string, number>();
  const add = (key: string, pdg: number) => {
    const k = normalise(key).toLowerCase();
    if (!m.has(k)) m.set(k, pdg);
  };
  for (const p of allParticles()) {
    for (const pdg of p.selfConjugate ? [p.pdg] : [p.pdg, -p.pdg]) {
      const q = particle(pdg);
      add(q.name, pdg);
      add(q.symbol, pdg);
      if (pdg < 0) {
        const base = particle(-pdg);
        add(`${base.name}bar`, pdg);
        add(`${base.name}~`, pdg);
        add(`anti${base.name}`, pdg);
        add(`anti-${base.name}`, pdg);
        // nubar_e, nu_ebar, nu_e~ ; pbar, nbar
        add(base.name.replace(/^nu_(\w+)$/, 'nubar_$1'), pdg);
        add(base.symbol + '̄', pdg);
      }
    }
  }
  const alias: Record<string, number> = {
    electron: 11, positron: -11, muon: 13, antimuon: -13, tau: 15, photon: 22, proton: 2212, neutron: 2112, antiproton: -2212, antineutron: -2112,
    pbar: -2212, nbar: -2112, 'p~': -2212, 'n~': -2112, gamma: 22, 'e+': -11, 'e-': 11, 'mu+': -13, 'mu-': 13,
    nu: 14, 'k0bar': -311, 'kbar0': -311, 'k~0': -311, 'k0~': -311, 'k_s': 310, 'ks': 310, 'kl': 130, 'k_l': 130, 'k0s': 310, 'k0l': 130, 'lambda0': 3122, 'lambdabar': -3122,
    'sigma+bar': -3222, pion: 211, 'omega-': 3334, 'omega+': -3334,
  };
  for (const [k, v] of Object.entries(alias)) add(k, v);
  // The plain ω meson and the Ω baryon differ only in case: the table's ASCII names are 'omega' and 'Omega-'.
  m.set('omega', 223);
  return m;
}

/** One particle by name; undefined if it is not in the table. */
export function parseParticle(token: string): number | undefined {
  lookup ??= build();
  const raw = token.trim();
  if (!raw) return undefined;
  const direct = byName(raw);
  if (direct) return direct.pdg;
  const k = normalise(raw).toLowerCase();
  const hit = lookup.get(k);
  if (hit !== undefined) return hit;
  // "anti-K0" and "K0bar" style for any table entry
  const m = /^(?:anti-?)(.+)$/i.exec(raw);
  if (m) {
    const base = parseParticle(m[1]!);
    if (base !== undefined && !particle(base).selfConjugate) return -base;
  }
  return undefined;
}

/** A token such as "e+e-" or "p+p" written without spaces: try every place to cut it at a "+". */
function glued(token: string, depth = 0): number[] | undefined {
  const single = parseParticle(token);
  if (single !== undefined) return [single];
  if (depth > 3) return undefined;
  for (let i = 1; i < token.length - 1; i++) {
    if (token[i] !== '+') continue;
    for (const cut of [i, i + 1]) {
      const left = token.slice(0, cut);
      const right = token.slice(i + 1);
      const l = glued(left, depth + 1);
      const r = l && glued(right, depth + 1);
      if (l && r) return [...l, ...r];
    }
  }
  return undefined;
}

function side(text: string, errors: string[], which: string): number[] {
  const out: number[] = [];
  const parts = text.split(/\s+\+\s+|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    let count = 1;
    let tok = part;
    const c = /^(\d+)\s*(.+)$/.exec(part);
    if (c && parseParticle(part) === undefined) {
      count = Number(c[1]);
      tok = c[2]!;
    }
    const ids = glued(tok.replace(/\s+/g, ''));
    if (!ids) {
      errors.push(`I do not know the ${which} particle “${part}”.`);
      continue;
    }
    for (let k = 0; k < count; k++) out.push(...ids);
  }
  return out;
}

/** Read "initial → final". The arrow may be →, -> or =>; write " -> " with spaces if a particle name ends in "-". */
export function parseReaction(text: string): ParsedReaction {
  const errors: string[] = [];
  let parts = text.split(/\s*(?:→|⟶|=>|⇒)\s*/);
  if (parts.length !== 2) parts = text.split(/\s+->\s+|\s+-->\s+/);
  if (parts.length !== 2) parts = text.split(/->/);
  if (parts.length !== 2) return { initial: [], final: [], errors: ['Write the reaction with one arrow, for example: n → p + e- + anti-nu_e'] };
  const initial = side(parts[0]!, errors, 'initial');
  const final = side(parts[1]!, errors, 'final');
  if (!initial.length && !errors.length) errors.push('There is nothing before the arrow.');
  if (!final.length && !errors.length) errors.push('There is nothing after the arrow.');
  return { initial, final, errors };
}

/** "π⁻ p → Λ K⁰" as typeset symbols. */
export function formatReaction(initial: readonly number[], final: readonly number[]): string {
  const s = (ids: readonly number[]) => ids.map((id) => particle(id).symbol).join(' + ');
  return `${s(initial)} → ${s(final)}`;
}
