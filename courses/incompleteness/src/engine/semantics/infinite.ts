// Infinite structures whose interpretations are computable: the standard model ℕ, the integers
// ℤ, the book's models K and L of Q (chapter "Models of Arithmetic"), the computable copy K′ of
// K with domain ℕ, and the structure with domain {a}* from the introduction of that chapter.
//
// Terms and quantifier-free formulas can be evaluated exactly. A quantifier cannot be evaluated
// by running through an infinite domain, so it is *searched*: the evaluator tries the first
// `limit` elements of an enumeration of the domain. A witness for ∃ or a counterexample to ∀
// among them decides the quantifier; otherwise the answer is 'unknown' ("no witness among the
// first N elements"), never true for ∀ or false for ∃. In ℕ, bounded quantifiers
// ∀x (x < t → …) and ∃x (x < t ∧ …) with x not in t are evaluated exactly (see standard.ts).

import type { Formula, Term } from '../syntax/ast.ts';
import { constName, fnName, predName } from '../syntax/language.ts';
import { evaluate, type Nat } from '../numbers/nat.ts';
import type { Assignment } from './assignment.ts';
import { boundedForm } from './standard.ts';
import { evalFormulaIn, evalTermIn, makeCtx, type EvalOptions, type Fail, type FormulaTrace, type Interp, type TermTrace } from './trace.ts';

/** Elements of these structures: natural numbers or integers as bigints, or named elements such as "a". */
export type IElem = bigint | string;

export interface SearchStructure {
  id: string;
  name: string;
  /** The domain in words, e.g. "ℕ ∪ {a}". */
  domainText: string;
  description: string;
  show(e: IElem): string;
  constant(index: number): IElem | Fail;
  apply(arity: number, index: number, args: IElem[]): IElem | Fail;
  holds(arity: number, index: number, args: IElem[]): boolean | Fail;
  /** The first `limit` elements of a fixed enumeration of the domain (without repetitions). */
  enumerate(limit: number): IElem[];
  /** Whether bounded quantifiers ∀x (x < t → …), ∃x (x < t ∧ …) may be evaluated exactly (only for ℕ). */
  exactBounded?: boolean;
  /** Parse an element typed by the reader ("7", "-3", "a"). */
  parse(text: string): IElem | Fail;
}

const MAX_BITS = 4096;
const big = (v: bigint): bigint | Fail => (v.toString(2).length > MAX_BITS ? { fail: `the value has more than ${MAX_BITS} bits` } : v);
const notIn = (S: string, what: string) => ({ fail: `${S} does not interpret ${what}` });
const isNat = (e: IElem): e is bigint => typeof e === 'bigint';

function numeralBy(S: { constant(i: number): IElem | Fail; apply(a: number, i: number, args: IElem[]): IElem | Fail }, value: Nat, direct?: (n: bigint) => IElem): IElem | Fail {
  const n = evaluate(value, MAX_BITS);
  if (n === null) return { fail: 'the numeral is too large to evaluate (or known by name only)' };
  if (direct) return direct(n);
  if (n > 10_000n) return { fail: 'the numeral is too large to evaluate by applying successor step by step' };
  let v = S.constant(0);
  for (let i = 0n; i < n && !(typeof v === 'object'); i++) v = S.apply(1, 0, [v]);
  return v;
}

function parseNat(text: string): bigint | Fail {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return { fail: `“${text}” is not a natural number` };
  return BigInt(t);
}

// ------------------------------------------------------------------ the structures

/** The standard model ℕ. */
export const STANDARD: SearchStructure = {
  id: 'N',
  name: 'ℕ',
  domainText: 'ℕ = {0, 1, 2, …}',
  description: 'The standard model: 0, successor, addition, multiplication and the order of the natural numbers.',
  show: (e) => String(e),
  constant: (i) => (i === 0 ? 0n : notIn('ℕ', `the constant ${constName(i)}`)),
  apply: (arity, index, [a, b]) => {
    if (!isNat(a) || (arity === 2 && !isNat(b))) return { fail: 'not a natural number' };
    if (arity === 1 && index === 0) return big(a + 1n);
    if (arity === 2 && index === 0) return big(a + (b as bigint));
    if (arity === 2 && index === 1) return big(a * (b as bigint));
    return notIn('ℕ', `the function symbol ${fnName(arity, index)}`);
  },
  holds: (arity, index, [a, b]) => (arity === 2 && index === 0 ? (a as bigint) < (b as bigint) : notIn('ℕ', `the predicate symbol ${predName(arity, index)}`)),
  enumerate: (limit) => Array.from({ length: limit }, (_, i) => BigInt(i)),
  exactBounded: true,
  parse: parseNat,
};

/** The integers with the usual 0, x + 1, +, ×, < (a non-standard structure; not a model of Q). */
export const INTEGERS: SearchStructure = {
  id: 'Z',
  name: 'ℤ',
  domainText: 'ℤ = {…, −2, −1, 0, 1, 2, …}',
  description: 'The integers, with all symbols interpreted as usual (successor is x + 1). Negative numbers are not values of numerals, so the structure is non-standard; ∀x 0 ≠ x′ is false in it.',
  show: (e) => (isNat(e) && e < 0n ? `−${-e}` : String(e)),
  constant: (i) => (i === 0 ? 0n : notIn('ℤ', `the constant ${constName(i)}`)),
  apply: (arity, index, [a, b]) => {
    if (arity === 1 && index === 0) return big((a as bigint) + 1n);
    if (arity === 2 && index === 0) return big((a as bigint) + (b as bigint));
    if (arity === 2 && index === 1) return big((a as bigint) * (b as bigint));
    return notIn('ℤ', `the function symbol ${fnName(arity, index)}`);
  },
  holds: (arity, index, [a, b]) => (arity === 2 && index === 0 ? (a as bigint) < (b as bigint) : notIn('ℤ', `the predicate symbol ${predName(arity, index)}`)),
  enumerate: (limit) => Array.from({ length: limit }, (_, i) => (i % 2 === 0 ? BigInt(i / 2) : -BigInt((i + 1) / 2))),
  parse: (text) => {
    const t = text.trim().replace('−', '-');
    return /^-?\d+$/.test(t) ? BigInt(t) : { fail: `“${text}” is not an integer` };
  },
};

const A = 'a';
const B = 'b';

/**
 * The book's model K of Q (Example "model-K-of-Q"): ℕ ∪ {a}, where a is its own successor,
 * absorbs sums, and lies above everything in the order.
 */
export const MODEL_K: SearchStructure = {
  id: 'K',
  name: 'K',
  domainText: 'ℕ ∪ {a}',
  description: 'The book’s model K of Q: the natural numbers plus one non-standard element a, with a′ = a, x + y = a if x or y is a, x × y = 0 if x or y is 0 and otherwise a if either is a, and x < a for every x (including a itself).',
  show: (e) => String(e),
  constant: (i) => (i === 0 ? 0n : notIn('K', `the constant ${constName(i)}`)),
  apply: (arity, index, [x, y]) => {
    if (arity === 1 && index === 0) return isNat(x) ? big(x + 1n) : A;
    if (arity === 2 && index === 0) return isNat(x) && isNat(y) ? big(x + y) : A;
    if (arity === 2 && index === 1) {
      if (isNat(x) && isNat(y)) return big(x * y);
      if (x === 0n || y === 0n) return 0n;
      return A;
    }
    return notIn('K', `the function symbol ${fnName(arity, index)}`);
  },
  holds: (arity, index, [x, y]) => {
    if (!(arity === 2 && index === 0)) return notIn('K', `the predicate symbol ${predName(arity, index)}`);
    if (y === A) return true;
    return isNat(x) && isNat(y) && x < y;
  },
  enumerate: (limit) => [A, ...Array.from({ length: Math.max(0, limit - 1) }, (_, i) => BigInt(i))],
  parse: (text) => (text.trim() === 'a' ? A : parseNat(text)),
};

/**
 * The book's structure L (Example "model-L-of-Q"): ℕ ∪ {a, b}, with a′ = a, b′ = b and the
 * addition table of the book. The book gives only 0, ′ and +; interpreting × and < is left as an
 * exercise, so they are not interpreted here.
 */
export const MODEL_L: SearchStructure = {
  id: 'L',
  name: 'L',
  domainText: 'ℕ ∪ {a, b}',
  description: 'The book’s structure L: ℕ plus two non-standard elements a and b, each its own successor, with the book’s table for +. The book specifies only 0, ′ and + (× and < are an exercise), so formulas with × or < cannot be evaluated here.',
  show: (e) => String(e),
  constant: (i) => (i === 0 ? 0n : notIn('L', `the constant ${constName(i)}`)),
  apply: (arity, index, [x, y]) => {
    if (arity === 1 && index === 0) return isNat(x) ? big(x + 1n) : x;
    if (arity === 2 && index === 0) {
      // rows: x; columns: y ∈ {m, a, b}
      if (isNat(y)) return isNat(x) ? big(x + y) : x; // n ⊕ m = n+m, a ⊕ m = a, b ⊕ m = b
      if (y === A) return B; // n ⊕ a = a ⊕ a = b ⊕ a = b
      return A; // y = b: n ⊕ b = a, a ⊕ b = a, b ⊕ b = a
    }
    return notIn('L', `${fnName(arity, index)} (the book gives only 0, ′ and + for L)`);
  },
  holds: (arity, index) => notIn('L', `${predName(arity, index)} (the book gives only 0, ′ and + for L)`),
  enumerate: (limit) => [A, B, ...Array.from({ length: Math.max(0, limit - 2) }, (_, i) => BigInt(i))],
  parse: (text) => (text.trim() === 'a' ? A : text.trim() === 'b' ? B : parseNat(text)),
};

/**
 * The computable model K′ of Q with domain ℕ (Example "comp-model-q"): 0 plays the role of a,
 * and n + 1 the role of n. So 0^{K′} = 1, x′ = x + 1 for x > 0 and 0′ = 0, and the book's
 * formulas for + and ×; x < y iff (0 < x < y) or y = 0.
 */
export const MODEL_K_PRIME: SearchStructure = {
  id: "K'",
  name: 'K′',
  domainText: 'ℕ',
  description: 'The book’s computable copy K′ of K on the domain ℕ: 0 plays the role of a and n+1 the role of n. The constant 0 is interpreted as 1; 0′ = 0 and n′ = n + 1 for n > 0; x + y is interpreted as x + y − 1 if x, y > 0 (else 0); and so on.',
  show: (e) => String(e),
  constant: (i) => (i === 0 ? 1n : notIn('K′', `the constant ${constName(i)}`)),
  apply: (arity, index, [a, b]) => {
    const x = a as bigint;
    const y = b as bigint;
    if (arity === 1 && index === 0) return x === 0n ? 0n : big(x + 1n);
    if (arity === 2 && index === 0) return x > 0n && y > 0n ? big(x + y - 1n) : 0n;
    if (arity === 2 && index === 1) {
      if (x === 1n || y === 1n) return 1n;
      if (x > 1n && y > 1n) return big(x * y - x - y + 2n);
      return 0n;
    }
    return notIn('K′', `the function symbol ${fnName(arity, index)}`);
  },
  holds: (arity, index, [a, b]) => {
    if (!(arity === 2 && index === 0)) return notIn('K′', `the predicate symbol ${predName(arity, index)}`);
    const x = a as bigint;
    const y = b as bigint;
    return (x < y && x > 0n && y > 0n) || y === 0n;
  },
  enumerate: (limit) => Array.from({ length: limit }, (_, i) => BigInt(i)),
  parse: parseNat,
};

const aStr = (n: bigint): string => (n === 0n ? '∅' : n <= 12n ? 'a'.repeat(Number(n)) : `a^${n}`);
const aLen = (e: IElem): bigint | null => {
  if (typeof e !== 'string') return null;
  if (e === '∅') return 0n;
  if (/^a+$/.test(e)) return BigInt(e.length);
  const m = /^a\^(\d+)$/.exec(e);
  return m ? BigInt(m[1]) : null;
};

/**
 * The structure M of the chapter's introduction: domain {a}* (finite strings of a's), 0 = ∅,
 * s′ = s⌢a, and + and × on lengths. The book gives 0, ′, + and × (not <).
 */
export const A_STRINGS: SearchStructure = {
  id: 'a*',
  name: 'M',
  domainText: '{a}* = {∅, a, aa, aaa, …}',
  description: 'The structure from the chapter’s introduction: finite strings of a’s, with 0 the empty string ∅, s′ = s⌢a, and aⁿ + aᵐ = aⁿ⁺ᵐ, aⁿ × aᵐ = aⁿᵐ. It is isomorphic to ℕ. The book does not interpret < here.',
  show: (e) => String(e),
  constant: (i) => (i === 0 ? '∅' : notIn('M', `the constant ${constName(i)}`)),
  apply: (arity, index, args) => {
    const ns = args.map(aLen);
    if (ns.some((n) => n === null)) return { fail: 'not a string of a’s' };
    const [x, y] = ns as bigint[];
    if (arity === 1 && index === 0) return aStr(x + 1n);
    if (arity === 2 && index === 0) return aStr(x + y);
    if (arity === 2 && index === 1) return x * y > 1_000_000n ? { fail: 'the string would be too long' } : aStr(x * y);
    return notIn('M', `the function symbol ${fnName(arity, index)}`);
  },
  holds: (arity, index) => notIn('M', `${predName(arity, index)} (the book gives only 0, ′, + and × for this structure)`),
  enumerate: (limit) => Array.from({ length: limit }, (_, i) => aStr(BigInt(i))),
  parse: (text) => {
    const t = text.trim();
    if (t === '∅' || t === '' || t === 'e') return '∅';
    return aLen(t) !== null ? aStr(aLen(t)!) : { fail: `“${text}” is not a string of a’s (type ∅, a, aa, … or a^n)` };
  },
};

export const SEARCH_STRUCTURES: SearchStructure[] = [STANDARD, INTEGERS, MODEL_K, MODEL_L, MODEL_K_PRIME, A_STRINGS];

// ------------------------------------------------------------------ evaluation by search

export interface SearchOptions extends EvalOptions {
  /** How many elements of the domain a quantifier tries (default 60). */
  limit?: number;
  /** Refuse bounded quantifiers in ℕ whose bound exceeds this (default 100,000). */
  maxBound?: number;
}

export function searchInterpretation(S: SearchStructure, opts: SearchOptions = {}): Interp<IElem> {
  const limit = opts.limit ?? 60;
  const maxBound = opts.maxBound ?? 100_000;
  return {
    name: S.name,
    show: S.show,
    constant: S.constant,
    apply: S.apply,
    holds: S.holds,
    numeral: (value) => numeralBy(S, value, S.id === 'N' ? (n) => n : undefined),
    range: (q, _s, evalTerm) => {
      if (S.exactBounded) {
        const b = boundedForm(q);
        if (b && !('reason' in b)) {
          const bound = evalTerm(b.bound);
          if (bound.value !== null && typeof bound.value === 'bigint' && bound.value <= BigInt(maxBound)) {
            const n = bound.value;
            return {
              elements: Array.from({ length: Number(n) }, (_, i) => BigInt(i)),
              count: Number(n),
              bound,
              description: n === 0n ? `no numbers (the bound has value 0)` : `0, …, ${n - 1n} (the numbers below the value ${n} of the bound ${bound.text})`,
              rest: b.kind === 'forall' ? `larger values make the antecedent false` : `larger values make the conjunct x < t false`,
            };
          }
        }
      }
      const els = S.enumerate(limit);
      // The order of the search, unless the domain's description already lists it in that order.
      const first = els.slice(0, 4).map(S.show).join(', ');
      const shown = S.domainText.includes(first) ? '' : ` (in the order ${first}, …)`;
      return { elements: els, count: els.length, partial: true, description: `the first ${els.length} elements of ${S.domainText}${shown}` };
    },
  };
}

/** M, s ⊨ A for a structure with an infinite domain: exact where possible, by search otherwise. */
export function satisfiesSearch(S: SearchStructure, s: Assignment<IElem>, F: Formula, opts: SearchOptions = {}): FormulaTrace<IElem> {
  return evalFormulaIn(makeCtx(searchInterpretation(S, opts), opts), F, s);
}

export function evaluateTermSearch(S: SearchStructure, s: Assignment<IElem>, t: Term): TermTrace<IElem> {
  return evalTermIn(makeCtx(searchInterpretation(S)), t, s);
}

// ------------------------------------------------------------------ comparing two structures on samples

export interface MapCheckFailure {
  condition: 'constant' | 'function' | 'predicate';
  symbol: string;
  args: IElem[];
  detail: string;
}

/**
 * Checks the conditions (3)–(5) of the book's definition of isomorphism for a map h from S1 to
 * S2 on sample arguments only (h(c^{S1}) = c^{S2}; h(f^{S1}(a⃗)) = f^{S2}(h(a⃗)); ⟨a⃗⟩ ∈ P^{S1} iff
 * ⟨h(a⃗)⟩ ∈ P^{S2}). Finitely many samples illustrate; they do not prove that h is an isomorphism.
 */
export function checkMapOnSamples(
  S1: SearchStructure,
  S2: SearchStructure,
  h: (e: IElem) => IElem,
  samples: IElem[],
  symbols: { constants?: number[]; functions?: [number, number][]; predicates?: [number, number][] },
): { checked: number; failures: MapCheckFailure[] } {
  const failures: MapCheckFailure[] = [];
  let checked = 0;
  const eq = (a: IElem, b: IElem) => a === b;
  for (const c of symbols.constants ?? []) {
    checked++;
    const a = S1.constant(c);
    const b = S2.constant(c);
    if (typeof a === 'object' || typeof b === 'object') continue;
    if (!eq(h(a), b)) failures.push({ condition: 'constant', symbol: constName(c), args: [], detail: `h(${constName(c)}^${S1.name}) = h(${S1.show(a)}) = ${S2.show(h(a))}, but ${constName(c)}^${S2.name} = ${S2.show(b)}` });
  }
  const tuplesOf = (n: number): IElem[][] => (n === 1 ? samples.map((x) => [x]) : samples.flatMap((x) => samples.map((y) => [x, y])));
  for (const [n, i] of symbols.functions ?? []) {
    for (const args of tuplesOf(n)) {
      checked++;
      const v1 = S1.apply(n, i, args);
      const v2 = S2.apply(n, i, args.map(h));
      if (typeof v1 === 'object' || typeof v2 === 'object') continue;
      if (!eq(h(v1), v2)) failures.push({ condition: 'function', symbol: fnName(n, i), args, detail: `h(${fnName(n, i)}^${S1.name}(${args.map(S1.show).join(', ')})) = ${S2.show(h(v1))} but ${fnName(n, i)}^${S2.name}(${args.map(h).map(S2.show).join(', ')}) = ${S2.show(v2)}` });
    }
  }
  for (const [n, i] of symbols.predicates ?? []) {
    for (const args of tuplesOf(n)) {
      checked++;
      const r1 = S1.holds(n, i, args);
      const r2 = S2.holds(n, i, args.map(h));
      if (typeof r1 === 'object' || typeof r2 === 'object') continue;
      if (r1 !== r2) failures.push({ condition: 'predicate', symbol: predName(n, i), args, detail: `⟨${args.map(S1.show).join(', ')}⟩ ${r1 ? '∈' : '∉'} ${predName(n, i)}^${S1.name} but ⟨${args.map(h).map(S2.show).join(', ')}⟩ ${r2 ? '∈' : '∉'} ${predName(n, i)}^${S2.name}` });
    }
  }
  return { checked, failures };
}

/** The relabeling g : K′ → K from the book's example: 0 ↦ a, n ↦ n − 1 for n > 0. */
export const kPrimeToK = (e: IElem): IElem => (e === 0n ? A : (e as bigint) - 1n);
/** The isomorphism ℕ → {a}*, n ↦ aⁿ. */
export const natToAStrings = (e: IElem): IElem => aStr(e as bigint);
