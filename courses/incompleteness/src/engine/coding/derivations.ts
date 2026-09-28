// Gödel numbers of natural deduction derivations (section "Derivations in Natural Deduction").
//
// The book's definition, by induction on δ:
//   – δ is the assumption A:                     #δ# = ⟨0, #A#, n⟩
//     (n = 0 if the assumption is undischarged, its numerical label otherwise);
//   – δ ends in an inference with 0, 1, 2 or 3 premises:
//        ⟨0, #A#, n, k⟩,  ⟨1, #δ₁#, #A#, n, k⟩,  ⟨2, #δ₁#, #δ₂#, #A#, n, k⟩,  ⟨3, #δ₁#, #δ₂#, #δ₃#, #A#, n, k⟩
//     where δᵢ are the sub-derivations ending in the premises, A the conclusion, n the discharge
//     label (0 if nothing is discharged) and k the number of the rule:
//        ∧I 1  ∧E 2  ∨I 3  ∨E 4  →I 5  →E 6  ¬I 7  ¬E 8  ⊥I 9  ⊥C 10  ∀I 11  ∀E 12  ∃I 13  ∃E 14  =I 15  =E 16.
//
// Axioms of a theory Γ are, in the book's natural deduction, undischarged assumptions; they are
// coded ⟨0, #A#, 0⟩ like any other. (The code does not say "this is an axiom" — Prf_Γ checks
// separately that every undischarged assumption is in Γ.) Hypotheses (facts proved elsewhere)
// have no code: a derivation containing them is not a derivation in the book's sense.
//
// The code records neither the term of ∀Elim / ∃Intro nor the eigenvariable of ∀Intro / ∃Elim:
// they are determined by the formulas. Decoding recovers them, and the natural deduction checker
// then verifies the decoded tree independently.
//
// All numbers are exact symbolic naturals (numbers/nat.ts): #A# is already astronomically large,
// and #δ# has #A# in an exponent. They are compared structurally, never expanded.

import type { Formula } from '../syntax/ast.ts';
import { check, inferInstance, type CheckResult, type Deriv, type Rule, did } from '../proof/nd.ts';
import { constants, formulaEq, freeVars } from '../syntax/ops.ts';
import { formulaText } from '../syntax/print.ts';
import { decodeSeq, evaluate, lit, natEq, seqItems, seqOf, type Nat } from '../numbers/nat.ts';
import { collapseNumerals, decode as decodeFormula, godelNumber } from './godel.ts';

// ------------------------------------------------------------------ rule numbers

/** The book's table: the number k of each rule. */
export const RULE_NUMBER: Record<Exclude<Rule, 'assume' | 'axiom' | 'hyp'>, number> = {
  andI: 1, andE: 2, orI: 3, orE: 4, impI: 5, impE: 6, notI: 7, notE: 8,
  botI: 9, botC: 10, allI: 11, allE: 12, exI: 13, exE: 14, eqI: 15, eqE: 16,
};

/** k ↦ rule, for k = 1, …, 16. */
export const RULE_OF_NUMBER: Record<number, Exclude<Rule, 'assume' | 'axiom' | 'hyp'>> = Object.fromEntries(
  Object.entries(RULE_NUMBER).map(([r, k]) => [k, r]),
) as Record<number, Exclude<Rule, 'assume' | 'axiom' | 'hyp'>>;

/** How many premises each rule has (the first component of the code). */
export const RULE_PREMISES: Record<Exclude<Rule, 'assume' | 'axiom' | 'hyp'>, number> = {
  andI: 2, andE: 1, orI: 1, orE: 3, impI: 1, impE: 2, notI: 1, notE: 2,
  botI: 1, botC: 1, allI: 1, allE: 1, exI: 1, exE: 2, eqI: 0, eqE: 2,
};

const DISCHARGING: ReadonlySet<Rule> = new Set<Rule>(['orE', 'impI', 'notI', 'botC', 'exE']);

// ------------------------------------------------------------------ encoding

/** One node of a coded derivation: the sub-derivation, the parts of its code, and the code. */
export interface CodedNode {
  /** The step of the original derivation. */
  step: Deriv;
  kind: 'assumption' | 'inference';
  /** The coded sub-derivations ending in the premises (δ₁, …). */
  premises: CodedNode[];
  /** The end-formula A. */
  formula: Formula;
  /** #A# */
  formulaCode: Nat;
  /** n: the discharge label (inference) or the label of a discharged assumption; 0 otherwise. */
  n: number;
  /** k: the rule number (inferences only). */
  k?: number;
  /** For an undischarged assumption that is an axiom of the theory: its name (not part of the code). */
  axiom?: string;
  /** The elements of the tuple, in order. */
  elements: Nat[];
  /** The code #δ# = ⟨…⟩ of the sub-derivation ending here. */
  code: Nat;
  /** Position in the tree: [] for the root, [i, j] for the j-th premise of the i-th premise, … */
  path: number[];
}

export type EncodeResult = { ok: true; root: CodedNode; check: CheckResult } | { ok: false; error: string; step?: string };

/** Overrides for re-coding a tree with changed components (to see what the checker says). */
export type Overrides = Map<string, { n?: number; k?: number }>;
export const pathKey = (p: number[]) => p.join('.');

/**
 * Codes a derivation as the book defines it. The derivation is checked first (with the given
 * axioms), since labels 0 for undischarged assumptions need to know which ones are discharged.
 */
export function encodeDerivation(root: Deriv, opts: { axioms?: Map<string, Formula> } = {}): EncodeResult {
  const chk = check(root, { axioms: opts.axioms });
  const discharged = new Set<string>();
  for (const s of chk.steps.values()) for (const a of s.discharged) discharged.add(a.id);
  const cache = new Map<string, Nat>();
  const code = (f: Formula): Nat => {
    const key = formulaText(f);
    let c = cache.get(key);
    if (!c) cache.set(key, (c = godelNumber(f)));
    return c;
  };
  let error: { error: string; step: string } | null = null;
  const go = (d: Deriv, path: number[]): CodedNode => {
    const formula = d.concl;
    const formulaCode = code(formula);
    if (d.rule === 'hyp') error ??= { error: `the hypothesis “${d.name ?? '?'}” is not part of a derivation in the book's sense, so it has no code`, step: d.id };
    if (d.rule === 'assume' || d.rule === 'axiom' || d.rule === 'hyp') {
      const isDischarged = d.rule === 'assume' && discharged.has(d.id);
      const n = isDischarged ? (d.label ?? 0) : 0;
      if (isDischarged && n <= 0) error ??= { error: 'discharge labels must be positive numbers: the label 0 means “undischarged”', step: d.id };
      const elements = [lit(0), formulaCode, lit(n)];
      return { step: d, kind: 'assumption', premises: [], formula, formulaCode, n, elements, code: seqOf(elements), path, ...(d.rule === 'axiom' && d.name ? { axiom: d.name } : {}) };
    }
    const premises = d.premises.map((p, i) => go(p, [...path, i]));
    const k = RULE_NUMBER[d.rule];
    const n = DISCHARGING.has(d.rule) ? (d.label ?? 0) : 0;
    if (DISCHARGING.has(d.rule) && n <= 0) error ??= { error: 'discharge labels must be positive numbers: the label 0 means “discharges nothing”', step: d.id };
    if (premises.length > 3) error ??= { error: 'an inference has at most three premises', step: d.id };
    const elements = [lit(premises.length), ...premises.map((p) => p.code), formulaCode, lit(n), lit(k)];
    return { step: d, kind: 'inference', premises, formula, formulaCode, n, k, elements, code: seqOf(elements), path };
  };
  const tree = go(root, []);
  if (error) return { ok: false, ...(error as { error: string; step: string }) };
  return { ok: true, root: tree, check: chk };
}

/** The code of a coded tree with some components changed (n or k at given paths). */
export function recode(node: CodedNode, overrides: Overrides): Nat {
  const o = overrides.get(pathKey(node.path));
  if (node.kind === 'assumption') {
    const n = o?.n ?? node.n;
    return seqOf([lit(0), node.formulaCode, lit(n)]);
  }
  const n = o?.n ?? node.n;
  const k = o?.k ?? node.k!;
  return seqOf([lit(node.premises.length), ...node.premises.map((p) => recode(p, overrides)), node.formulaCode, lit(n), lit(k)]);
}

/** All nodes of a coded tree, root first, level by level (as the book's SubtreeSeq lists them). */
export function codedNodes(root: CodedNode): CodedNode[] {
  const out: CodedNode[] = [];
  let level = [root];
  while (level.length) {
    out.push(...level);
    level = level.flatMap((n) => n.premises);
  }
  return out;
}

// ------------------------------------------------------------------ the book's functions on codes

/** The elements of a sequence code (small literal codes are factored). */
export function elementsOf(d: Nat, limit = 64): Nat[] | null {
  if (d.k === 'lit') {
    if (d.v > 1n << 4096n) return null;
    const r = decodeSeq(d.v);
    return r.ok ? r.items.map((x) => lit(x)) : null;
  }
  return seqItems(d, limit);
}

/** (d)_i, with the book's convention that (d)_i = 0 when i ≥ len(d). */
export function component(d: Nat, i: number): Nat | null {
  const xs = elementsOf(d);
  if (!xs) return null;
  return i < xs.length ? xs[i] : lit(0);
}

const small = (n: Nat | null): number | null => {
  if (!n) return null;
  const v = evaluate(n, 64);
  return v === null || v > 1_000_000n ? null : Number(v);
};

/** EndFmla(d) = (d)_{(d)_0 + 1} */
export function endFmla(d: Nat): Nat | null {
  const p = small(component(d, 0));
  return p === null ? null : component(d, p + 1);
}
/** DischargeLabel(d) = (d)_{(d)_0 + 2} */
export function dischargeLabel(d: Nat): number | null {
  const p = small(component(d, 0));
  return p === null ? null : small(component(d, p + 2));
}
/** LastRule(d) = (d)_{(d)_0 + 3} (0 for an assumption ⟨0, x, n⟩, whose (d)_3 does not exist). */
export function lastRule(d: Nat): number | null {
  const p = small(component(d, 0));
  return p === null ? null : small(component(d, p + 3));
}
/** Is d of the form ⟨0, x, n⟩ (an assumption)? */
export function isAssumptionCode(d: Nat): boolean {
  const xs = elementsOf(d);
  return !!xs && xs.length === 3 && small(xs[0]) === 0;
}
/** The immediate sub-derivations (d)_1, …, (d)_{(d)_0} (none for an assumption). */
export function immediateSubs(d: Nat): Nat[] {
  const xs = elementsOf(d);
  if (!xs || isAssumptionCode(d)) return [];
  const p = small(xs[0]) ?? 0;
  return xs.slice(1, 1 + p);
}

/** SubtreeSeq(d), without repetitions: the codes of all sub-derivations, level by level. */
export function subtreeSeq(d: Nat, limit = 5000): Nat[] {
  const out: Nat[] = [];
  let level = [d];
  while (level.length && out.length < limit) {
    out.push(...level);
    level = level.flatMap(immediateSubs);
  }
  return out;
}

export interface AssumptionOccurrence {
  /** x: the code of the assumed formula */
  x: Nat;
  /** its label n (0: not discharged) */
  n: number;
  /** the chain of sub-derivations from d down to the assumption ⟨0, x, n⟩ */
  chain: Nat[];
  /** OpenAssum: no sub-derivation on the chain ends in an inference with discharge label n (n = 0 is never discharged) */
  open: boolean;
  /** where it is discharged (the code of that sub-derivation), if it is */
  dischargedAt?: Nat;
}

/**
 * Every occurrence of an assumption in d, with the book's test for OpenAssum: an occurrence
 * ⟨0, z, n⟩ is undischarged if on the path δ₀ = δ, δ₁, …, δₖ = ⟨0, z, n⟩ of immediate
 * sub-derivations no δᵢ (i < k) ends in an inference with discharge label n.
 */
export function assumptionOccurrences(d: Nat): AssumptionOccurrence[] {
  const out: AssumptionOccurrence[] = [];
  const go = (cur: Nat, chain: Nat[]) => {
    const here = [...chain, cur];
    if (isAssumptionCode(cur)) {
      const xs = elementsOf(cur)!;
      const n = small(xs[2]) ?? -1;
      const at = n === 0 ? undefined : chain.find((c) => dischargeLabel(c) === n);
      out.push({ x: xs[1], n, chain: here, open: at === undefined, ...(at ? { dischargedAt: at } : {}) });
      return;
    }
    for (const s of immediateSubs(cur)) go(s, here);
  };
  go(d, []);
  return out;
}

/** Assum(x, d, n): x is the code of an assumption of d with label n. */
export function assum(x: Nat, d: Nat, n: number): boolean {
  return assumptionOccurrences(d).some((o) => o.n === n && natEq(o.x, x) === 'equal');
}

/** Discharge(x, d, n): every assumption of d labelled n is x. */
export function dischargeOk(x: Nat, d: Nat, n: number): boolean {
  return assumptionOccurrences(d).every((o) => o.n !== n || natEq(o.x, x) === 'equal');
}

// ------------------------------------------------------------------ decoding

export interface DecodeStepInfo {
  path: number[];
  code: Nat;
  /** (d)_0: number of premises, or 0 for assumptions and zero-premise inferences */
  premises: number;
  kind: 'assumption' | 'inference';
  formula: Formula;
  n: number;
  k?: number;
  rule: Rule;
  /** Where the decoder had to reconstruct information not in the code. */
  recovered?: string;
}

export type DecodeDerivationResult =
  | { ok: true; deriv: Deriv; steps: DecodeStepInfo[] }
  | { ok: false; error: string; path: number[]; steps: DecodeStepInfo[] };

class DecodeError extends Error {
  path: number[];
  constructor(message: string, path: number[]) {
    super(message);
    this.path = path;
  }
}

/** The labelled assumption leaves of a decoded derivation. */
function leavesWithLabel(d: Deriv, label: number): Deriv[] {
  if (d.rule === 'assume') return d.label === label ? [d] : [];
  return d.premises.flatMap((p) => leavesWithLabel(p, label));
}

function allConstants(d: Deriv, out = new Set<number>()): Set<number> {
  for (const c of constants(d.concl)) out.add(c);
  d.premises.forEach((p) => allConstants(p, out));
  return out;
}

function fresh(d: Deriv[]): number {
  const used = new Set<number>([0]);
  d.forEach((x) => allConstants(x, used));
  let i = 1;
  while (used.has(i)) i++;
  return i;
}

/**
 * Reads a derivation back from its code. Undischarged assumptions that are axioms of `axioms`
 * become axiom leaves (this is not in the code: it is how Prf_Γ reads them). The result is a
 * derivation for the checker, which verifies it independently.
 */
export function decodeDerivation(code: Nat, opts: { axioms?: Map<string, Formula> } = {}): DecodeDerivationResult {
  const steps: DecodeStepInfo[] = [];
  const go = (c: Nat, path: number[]): Deriv => {
    const xs = elementsOf(c);
    if (!xs) throw new DecodeError('this is not (recognisably) a sequence code', path);
    const first = small(xs[0]);
    if (first === null) throw new DecodeError('(d)₀ is not a small number, so this is not the code of a derivation', path);
    const readFormula = (x: Nat): Formula => {
      const r = decodeFormula(x, { expect: 'formula' });
      if (!r.ok) throw new DecodeError(`the end-formula component does not decode to a formula: ${r.error}`, path);
      const f = collapseNumerals(r.node as Formula);
      if (freeVars(f).size) throw new DecodeError(`${formulaText(f)} is not a sentence`, path);
      return f;
    };
    if (xs.length === 3 && first === 0) {
      const formula = readFormula(xs[1]);
      const n = small(xs[2]);
      if (n === null) throw new DecodeError('the label is not a small number', path);
      let rule: Rule = 'assume';
      let name: string | undefined;
      if (n === 0 && opts.axioms) {
        for (const [nm, ax] of opts.axioms) {
          if (formulaEq(ax, formula)) {
            rule = 'axiom';
            name = nm;
            break;
          }
        }
      }
      steps.push({ path, code: c, premises: 0, kind: 'assumption', formula, n, rule });
      const d: Deriv = { id: did(), rule, concl: formula, premises: [] };
      if (n > 0) d.label = n;
      if (name) d.name = name;
      return d;
    }
    if (xs.length !== first + 4) throw new DecodeError(`(d)₀ = ${first} premises means the code should have ${first + 4} components, but it has ${xs.length}`, path);
    const premises = xs.slice(1, 1 + first).map((p, i) => go(p, [...path, i]));
    const formula = readFormula(xs[first + 1]);
    const n = small(xs[first + 2]);
    const k = small(xs[first + 3]);
    if (n === null || k === null) throw new DecodeError('the discharge label or rule number is not a small number', path);
    const rule = RULE_OF_NUMBER[k];
    if (!rule) throw new DecodeError(`${k} is not the number of any rule (the rules are numbered 1 to 16)`, path);
    const d: Deriv = { id: did(), rule, concl: formula, premises };
    if (n > 0) d.label = n;
    let recovered: string | undefined;
    // Eigenvariables are not in the code: read them off the formulas.
    if (rule === 'allI' && formula.k === 'forall' && premises[0]) {
      const t = inferInstance(formula.body, formula.v.index, premises[0].concl);
      if (t && t.k === 'const' && t.index !== 0) d.eigen = t.index;
      else if (!t) d.eigen = fresh([d]);
      recovered = d.eigen !== undefined ? `eigenvariable read off the premise` : undefined;
    }
    if (rule === 'exE' && premises[0]?.concl.k === 'exists' && premises[1]) {
      const ex = premises[0].concl;
      const leaves = n > 0 ? leavesWithLabel(premises[1], n) : [];
      for (const l of leaves) {
        const t = inferInstance(ex.body, ex.v.index, l.concl);
        if (t && t.k === 'const' && t.index !== 0) {
          d.eigen = t.index;
          break;
        }
      }
      if (d.eigen === undefined) d.eigen = fresh([d]);
      recovered = 'eigenvariable read off the discharged assumption';
    }
    steps.push({ path, code: c, premises: first, kind: 'inference', formula, n, k, rule, ...(recovered ? { recovered } : {}) });
    return d;
  };
  try {
    return { ok: true, deriv: go(code, []), steps };
  } catch (e) {
    if (e instanceof DecodeError) return { ok: false, error: e.message, path: e.path, steps };
    throw e;
  }
}

// ------------------------------------------------------------------ Prf_Γ

export interface PrfCheck {
  /** Deriv(x): x decodes to a derivation every inference of which is correct */
  deriv: boolean;
  /** EndFmla(x) = y */
  endFormula: boolean;
  /** every undischarged assumption is in Γ */
  openInGamma: boolean;
  /** the undischarged assumptions (codes), with the axiom each one is, if any */
  open: { x: Nat; axiom?: string }[];
  holds: boolean;
  decoded?: DecodeDerivationResult;
  check?: CheckResult;
}

/**
 * Prf_Γ(x, y) for Γ given by its axioms: x is the code of a correct derivation, its end-formula
 * has code y, and all its undischarged assumptions are in Γ.
 */
export function prf(x: Nat, y: Nat, axioms: Map<string, Formula>): PrfCheck {
  const decoded = decodeDerivation(x, { axioms });
  const axiomCodes = [...axioms].map(([name, f]) => ({ name, code: godelNumber(f) }));
  const occ = assumptionOccurrences(x).filter((o) => o.open);
  const open = occ.map((o) => {
    const a = axiomCodes.find((c) => natEq(c.code, o.x) === 'equal');
    return a ? { x: o.x, axiom: a.name } : { x: o.x };
  });
  const openInGamma = open.every((o) => o.axiom !== undefined);
  const e = endFmla(x);
  const endFormula = !!e && natEq(e, y) === 'equal';
  if (!decoded.ok) return { deriv: false, endFormula, openInGamma, open, holds: false, decoded };
  const chk = check(decoded.deriv, { axioms });
  // Axioms are decoded as axiom leaves; everything else open must not exist.
  const deriv = chk.valid;
  return { deriv, endFormula, openInGamma, open, holds: deriv && endFormula && openInGamma, decoded, check: chk };
}

/** Structural comparison of two derivations (rules, formulas, labels), treating axiom leaves by formula. */
export function sameDerivation(a: Deriv, b: Deriv): boolean {
  const kind = (r: Rule) => (r === 'axiom' || r === 'hyp' ? 'assume' : r);
  if (kind(a.rule) !== kind(b.rule)) return false;
  if (!formulaEq(a.concl, b.concl)) return false;
  if (a.premises.length !== b.premises.length) return false;
  return a.premises.every((p, i) => sameDerivation(p, b.premises[i]));
}

