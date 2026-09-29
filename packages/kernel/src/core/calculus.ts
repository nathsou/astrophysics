// A single kernel serves every calculus in the course. A `Features` record
// says which one is active: the corners of Barendregt's λ-cube are Pure Type
// Systems over the sorts * and □, and the later chapters switch on universe
// levels, inductive types and the rest of Lean 4's type theory.

/** A PTS product rule (s₁, s₂): Π x : A. B is allowed when A : s₁ and B : s₂. */
export type SortPair = readonly [0 | 1, 0 | 1];

export interface Features {
  id: string;
  name: string;
  /** λ-cube mode: only the sorts * (= Sort 0) and □ (= Sort 1) exist */
  cube?: { rules: readonly SortPair[] };
  /** Type : Type — inconsistent, used to demonstrate Girard's paradox */
  typeInType: boolean;
  /** Π x : A, P : Prop whenever P : Prop (via imax) */
  impredicativeProp: boolean;
  inductives: boolean;
  /** strict positivity check for inductive declarations */
  positivity: boolean;
  /** restrict elimination of Prop-inductives into Type (subsingleton elimination) */
  restrictPropElim: boolean;
  /** definitional proof irrelevance: any two proofs of the same Prop are equal */
  proofIrrelevance: boolean;
  /** η for functions: (λ x, f x) ≡ f */
  eta: boolean;
  /** η for structures: p ≡ ⟨p.1, p.2⟩ */
  structEta: boolean;
  quotients: boolean;
  /** universe polymorphism (level parameters on declarations) */
  universePolymorphism: boolean;
}

const base: Features = {
  id: 'cic',
  name: 'CIC (Lean 4)',
  typeInType: false,
  impredicativeProp: true,
  inductives: true,
  positivity: true,
  restrictPropElim: true,
  proofIrrelevance: true,
  eta: true,
  structEta: true,
  quotients: true,
  universePolymorphism: true,
};

const cubeBase: Omit<Features, 'id' | 'name' | 'cube'> = {
  typeInType: false,
  impredicativeProp: true,
  inductives: false,
  positivity: true,
  restrictPropElim: true,
  proofIrrelevance: false,
  eta: false,
  structEta: false,
  quotients: false,
  universePolymorphism: false,
};

const S = 0 as const; // *
const B = 1 as const; // □

function cube(id: string, name: string, rules: SortPair[]): Features {
  return { id, name, cube: { rules }, ...cubeBase };
}

export const calculi = {
  stlc: cube('stlc', 'λ→ (simply typed)', [[S, S]]),
  f: cube('f', 'λ2 (System F)', [
    [S, S],
    [B, S],
  ]),
  womega: cube('womega', 'λω̲ (type operators)', [
    [S, S],
    [B, B],
  ]),
  fomega: cube('fomega', 'λω (System Fω)', [
    [S, S],
    [B, S],
    [B, B],
  ]),
  lp: cube('lp', 'λP (LF)', [
    [S, S],
    [S, B],
  ]),
  lp2: cube('lp2', 'λP2', [
    [S, S],
    [B, S],
    [S, B],
  ]),
  lpw: cube('lpw', 'λPω̲', [
    [S, S],
    [S, B],
    [B, B],
  ]),
  coc: cube('coc', 'λC (Calculus of Constructions)', [
    [S, S],
    [B, S],
    [S, B],
    [B, B],
  ]),
  /** CoC + a predicative universe hierarchy (roughly Luo's ECC, without Σ) */
  ecc: { ...base, id: 'ecc', name: 'CoC + universes', inductives: false, quotients: false, structEta: false },
  cic: base,
  /** CIC with Type : Type — inconsistent */
  typeInType: { ...base, id: 'typeInType', name: 'CIC + Type : Type', typeInType: true },
} satisfies Record<string, Features>;

export type CalculusId = keyof typeof calculi;

export const defaultFeatures: Features = base;

export function isCube(f: Features): boolean {
  return f.cube !== undefined;
}

export function cubeAllows(f: Features, s1: number, s2: number): boolean {
  return f.cube!.rules.some(([a, b]) => a === s1 && b === s2);
}

/** Names used for the rule pairs in text. */
export const cubeRuleNames: Record<string, string> = {
  '0,0': 'terms depending on terms (functions)',
  '1,0': 'terms depending on types (polymorphism)',
  '1,1': 'types depending on types (type operators)',
  '0,1': 'types depending on terms (dependent types)',
};
