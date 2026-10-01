/**
 * `hep/conservation`: the ledger of conservation laws, and the checker that applies it to a reaction.
 *
 * A reaction is two lists of PDG IDs (negative for antiparticles). `checkReaction` adds up the additive quantum numbers of
 * each side, from the particle table, and compares them:
 *
 *     checkReaction([2212, 2212], [2212, 2212, 2212, -2212])   // p p → p p p p̄:  allowed, nothing violated
 *     checkReaction([2212], [-11, 22])                          // p → e⁺ γ: violates baryon number and electron-lepton number
 *
 * The laws are those of Chapter 11: electric charge, baryon number, the three lepton-flavour numbers, and the three "flavour"
 * numbers that the strong and electromagnetic forces conserve and the weak force does not (strangeness, charm, bottom).
 * For a decay (one initial particle) the mass must also be large enough: energy is conserved.
 *
 * `allowed` means that no law of the ledger is broken. `details.interaction` says which force can do it: `'strong'` (hadrons only, everything
 * holds), `'electromagnetic'` (a photon or a charged lepton takes part and everything holds), `'weak'` (a neutrino takes part, or strangeness,
 * charm or bottom change by one unit: slow) or `'forbidden'` (an exact law is broken, or a flavour changes by two units at once).
 *
 * "Allowed" never means "observed": the ledger is a list of necessary conditions. Charge conjugation forbids π⁰ → γγγ,
 * which passes every law listed here; other reactions are allowed and merely too rare to have been seen.
 *
 * The function is the reference of the hook `conservation.checkReaction`: the reader's version (Chapter 11's exercise) is fetched
 * with `hook('conservation.checkReaction', checkReaction)`. The reader's function need only return `{ allowed, violated }`.
 */
import { particle, quantumNumbers, hasParticle } from '../particles/index.ts';

export { parseReaction, parseParticle, formatReaction, type ParsedReaction } from './parse.ts';

export type LawId = 'charge' | 'baryon' | 'lepton-e' | 'lepton-mu' | 'lepton-tau' | 'strangeness' | 'charm' | 'bottom' | 'energy';

export interface Law {
  id: LawId;
  name: string;
  /** Does the law hold for every interaction of the Standard Model (as far as is known)? */
  exact: boolean;
  /** Which of the three forces conserve it. */
  strong: boolean;
  electromagnetic: boolean;
  weak: boolean;
  /** One sentence for the reader: what is conserved and why it matters. */
  blurb: string;
}

export const LAWS: readonly Law[] = [
  { id: 'charge', name: 'electric charge', exact: true, strong: true, electromagnetic: true, weak: true, blurb: 'The total electric charge never changes. It is tied to the gauge symmetry of electromagnetism (Chapter 17).' },
  { id: 'baryon', name: 'baryon number', exact: true, strong: true, electromagnetic: true, weak: true, blurb: 'Baryons count +1 and antibaryons −1 (a quark counts 1/3). The lightest baryon, the proton, cannot decay while this holds.' },
  { id: 'lepton-e', name: 'electron-lepton number', exact: true, strong: true, electromagnetic: true, weak: true, blurb: 'Electrons and electron neutrinos count +1, their antiparticles −1.' },
  { id: 'lepton-mu', name: 'muon-lepton number', exact: true, strong: true, electromagnetic: true, weak: true, blurb: 'Muons and muon neutrinos count +1, their antiparticles −1.' },
  { id: 'lepton-tau', name: 'tau-lepton number', exact: true, strong: true, electromagnetic: true, weak: true, blurb: 'Tau leptons and tau neutrinos count +1, their antiparticles −1.' },
  { id: 'strangeness', name: 'strangeness', exact: false, strong: true, electromagnetic: true, weak: false, blurb: 'Counts the strange quarks (−1 each) and strange antiquarks (+1). The weak force changes it, by one unit at a time.' },
  { id: 'charm', name: 'charm', exact: false, strong: true, electromagnetic: true, weak: false, blurb: 'Counts charm quarks (+1) and antiquarks (−1). Only the weak force changes it.' },
  { id: 'bottom', name: 'bottom number', exact: false, strong: true, electromagnetic: true, weak: false, blurb: 'Counts bottom antiquarks (+1) and quarks (−1), in the PDG convention. Only the weak force changes it.' },
  { id: 'energy', name: 'energy (for a decay)', exact: true, strong: true, electromagnetic: true, weak: true, blurb: 'A particle can only decay into products whose masses add up to no more than its own.' },
];

export const lawById = (id: string): Law | undefined => LAWS.find((l) => l.id === id);

export interface LawResult {
  id: LawId;
  name: string;
  exact: boolean;
  /** The total on the initial side (for `energy`: the mass, GeV). */
  initial: number;
  /** The total on the final side (for `energy`: the sum of the masses, GeV). */
  final: number;
  conserved: boolean;
  /** Does this law apply to this reaction? `energy` only applies when there is one initial particle. */
  applies: boolean;
}

/** The weakest-coupled force that can do it: `strong` (hadrons only, every law holds), `electromagnetic` (a photon or a charged lepton takes part), `weak` (a neutrino takes part, or a flavour number changes), or `forbidden`. */
export type Interaction = 'strong' | 'electromagnetic' | 'weak' | 'forbidden';

export interface CheckDetails {
  laws: LawResult[];
  interaction: Interaction;
  /** Exact laws that are broken (charge, baryon number, lepton numbers, energy). */
  exactBroken: LawId[];
  /** Approximate laws that are broken (strangeness, charm, bottom). */
  flavourBroken: LawId[];
  /** The change of each flavour number, final − initial. */
  delta: { strangeness: number; charm: number; bottom: number };
  isDecay: boolean;
  /** Sum of the masses of the initial and final particles, GeV. */
  massInitial: number;
  massFinal: number;
  /** For a decay, the energy released Q = M − Σ m (GeV); otherwise null. */
  q: number | null;
  /** The smallest centre-of-mass energy at which the final state can be made, GeV. */
  thresholdSqrtS: number;
  /** The law that a reader should be told first. */
  firstLaw: LawId | null;
  /** Plain-language lines, one per violated law, and one about the verdict. */
  explanation: string[];
}

export interface CheckResult {
  /** True when no law of the ledger is broken: the strong force could do it. */
  allowed: boolean;
  /** The ids of the laws that are broken, in ledger order. */
  violated: LawId[];
  details: CheckDetails;
}

const EPS = 1e-9;
const fmt = (x: number) => (Number.isInteger(x) ? (x > 0 ? `+${x}` : `${x}`) : x > 0 ? `+${x.toFixed(2)}` : x.toFixed(2));

/** Totals of each law for one side of a reaction. */
function totals(ids: readonly number[]) {
  const q = quantumNumbers(ids);
  return {
    charge: q.charge3 / 3,
    baryon: q.baryon3 / 3,
    'lepton-e': q.lepton[0],
    'lepton-mu': q.lepton[1],
    'lepton-tau': q.lepton[2],
    strangeness: q.strangeness,
    charm: q.charm,
    // The PDG convention, as in the table: the b quark has B' = −1 (like the s quark's S = −1).
    bottom: q.bottom,
  } as Record<string, number>;
}

/** Priority for naming a single law to the reader: the exact ones first, then the approximate ones. */
const PRIORITY: LawId[] = ['charge', 'baryon', 'lepton-e', 'lepton-mu', 'lepton-tau', 'energy', 'strangeness', 'charm', 'bottom'];

export function checkReaction(initial: number[], final: number[]): CheckResult {
  for (const id of [...initial, ...final]) if (!hasParticle(id)) throw new Error(`unknown particle: PDG ID ${id}`);
  const a = totals(initial);
  const b = totals(final);
  const isDecay = initial.length === 1;
  const massInitial = initial.reduce((s, id) => s + particle(id).mass, 0);
  const massFinal = final.reduce((s, id) => s + particle(id).mass, 0);

  const laws: LawResult[] = LAWS.map((law) => {
    if (law.id === 'energy') {
      return { id: law.id, name: law.name, exact: true, initial: massInitial, final: massFinal, conserved: !isDecay || massInitial + EPS >= massFinal, applies: isDecay };
    }
    const i = a[law.id]!;
    const f = b[law.id]!;
    return { id: law.id, name: law.name, exact: law.exact, initial: i, final: f, conserved: Math.abs(i - f) < EPS, applies: true };
  });

  const broken = laws.filter((l) => !l.conserved);
  const violated = broken.map((l) => l.id);
  const exactBroken = broken.filter((l) => l.exact).map((l) => l.id);
  const flavourBroken = broken.filter((l) => !l.exact).map((l) => l.id);
  const delta = { strangeness: b.strangeness! - a.strangeness!, charm: b.charm! - a.charm!, bottom: b.bottom! - a.bottom! };
  const oneUnit = Math.abs(delta.strangeness) <= 1 && Math.abs(delta.charm) <= 1 && Math.abs(delta.bottom) <= 1;
  const all = [...initial, ...final];
  const hasNeutrino = all.some((id) => [12, 14, 16].includes(Math.abs(id)));
  const hasEM = all.some((id) => id === 22 || [11, 13, 15].includes(Math.abs(id)));
  const interaction: Interaction = exactBroken.length
    ? 'forbidden'
    : flavourBroken.length > 0
      ? oneUnit ? 'weak' : 'forbidden'
      : hasNeutrino ? 'weak' : hasEM ? 'electromagnetic' : 'strong';

  const firstLaw = PRIORITY.find((id) => violated.includes(id)) ?? null;
  const explanation: string[] = [];
  for (const l of broken) {
    if (l.id === 'energy') {
      explanation.push(`Energy: the parent has mass ${particle(initial[0]!).mass.toPrecision(4)} GeV and the products need at least ${massFinal.toPrecision(4)} GeV, which is more than it has.`);
    } else {
      explanation.push(`${cap(l.name)}: ${fmt(l.initial)} before, ${fmt(l.final)} after.`);
    }
  }
  // Total lepton number can hold while the flavours do not.
  const leptonFlavourBroken = violated.filter((v) => v.startsWith('lepton-'));
  if (leptonFlavourBroken.length) {
    const lTotI = a['lepton-e']! + a['lepton-mu']! + a['lepton-tau']!;
    const lTotF = b['lepton-e']! + b['lepton-mu']! + b['lepton-tau']!;
    if (Math.abs(lTotI - lTotF) < EPS) explanation.push('Total lepton number is conserved; what fails is the conservation of each lepton flavour separately (Chapter 31 shows that neutrino oscillations break it, but never in a charged-lepton reaction like this).');
  }
  if (interaction === 'weak' && flavourBroken.length) explanation.push('Only a flavour number changes, by one unit: the weak force can do this, and it is slow (lifetimes of 10⁻¹⁰ s and longer, instead of 10⁻²³ s).');
  if (interaction === 'forbidden' && !exactBroken.length) explanation.push('A single weak interaction changes a flavour number by at most one unit; this reaction needs two.');
  if (!violated.length) explanation.push('Every law in the ledger holds: nothing forbids it.');
  if (interaction === 'strong') explanation.push('Only hadrons take part, so the strong force can do it (at the speed of the strong force, about 10⁻²³ s, if the energy is there).');
  if (interaction === 'electromagnetic') explanation.push('A photon or a charged lepton takes part: an electromagnetic process, at a rate smaller than a strong one by a factor of order α.');
  if (interaction === 'weak' && !flavourBroken.length) explanation.push('A neutrino takes part, and neutrinos feel only the weak force: this is a weak process, slow by the standards of the other two.');

  return {
    allowed: violated.length === 0,
    violated,
    details: {
      laws,
      interaction,
      exactBroken,
      flavourBroken,
      delta,
      isDecay,
      massInitial,
      massFinal,
      q: isDecay ? massInitial - massFinal : null,
      thresholdSqrtS: massFinal,
      firstLaw,
      explanation,
    },
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The ledger as a table: which laws hold for which force, and what the course says about each. The last column is where a later
 * chapter strikes the law through or qualifies it.
 */
export interface LedgerRow {
  law: string;
  strong: boolean | null;
  electromagnetic: boolean | null;
  weak: boolean | null;
  note: string;
  chapter?: string;
}
export const LEDGER: readonly LedgerRow[] = [
  { law: 'energy and momentum', strong: true, electromagnetic: true, weak: true, note: 'Exact: a symmetry of time and space (Chapter 17).' },
  { law: 'electric charge', strong: true, electromagnetic: true, weak: true, note: 'Exact.' },
  { law: 'colour', strong: true, electromagnetic: true, weak: true, note: 'Exact: the strong charge (Chapter 18).' },
  { law: 'baryon number', strong: true, electromagnetic: true, weak: true, note: 'Exact in the Standard Model as far as any experiment has seen; proton-decay searches test it (Chapter 32).', chapter: 'quarks' },
  { law: 'lepton flavour numbers', strong: true, electromagnetic: true, weak: true, note: 'Conserved for charged leptons; struck through by neutrino oscillations (Chapter 31).' },
  { law: 'strangeness, charm, bottom', strong: true, electromagnetic: true, weak: false, note: 'Changed by one unit by the weak force (Chapters 11 and 24).' },
  { law: 'isospin', strong: true, electromagnetic: false, weak: false, note: 'An approximate symmetry of the strong force (Chapter 12).' },
  { law: 'parity P', strong: true, electromagnetic: true, weak: false, note: 'Struck through by the weak force (Chapter 22).' },
  { law: 'charge conjugation C', strong: true, electromagnetic: true, weak: false, note: 'Struck through by the weak force (Chapter 22).' },
  { law: 'CP', strong: true, electromagnetic: true, weak: false, note: 'Broken slightly, in the weak force only (Chapter 24).' },
];
