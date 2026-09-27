// Reasoning with a provability predicate (sections 5.6–5.9).
//
// The proofs of the second incompleteness theorem, Löb's theorem and Tarski's theorem are not
// natural deduction derivations in the book: they are lists of sentences, each derivable in T,
// justified by (i) a fixed point given by the fixed-point lemma, (ii) the derivability
// conditions P1–P3, and (iii) "logic" — elementary propositional reasoning. This module checks
// such lists mechanically:
//
//   P1   from T ⊢ A infer T ⊢ Prov(⌜A⌝)                        (a rule about T)
//   P2   T ⊢ Prov(⌜A → B⌝) → (Prov(⌜A⌝) → Prov(⌜B⌝))           (instances are checked)
//   P3   T ⊢ Prov(⌜A⌝) → Prov(⌜Prov(⌜A⌝)⌝)                      (instances are checked)
//   logic  B follows from earlier lines A1, …, Ak by propositional logic: the sentence
//          (A1 ∧ … ∧ Ak) → B is a tautology, checked by a truth table in which each sentence
//          letter and each Prov(⌜…⌝) (or True(⌜…⌝)) counts as an atom.
//
// Every line is claimed to be derivable in T. The checker verifies the claims relative to the
// hypotheses it is given; it does not check the derivability conditions themselves (the book
// takes P1–P3 on faith too).

export type PF =
  | { k: 'atom'; name: string }
  | { k: 'bot' }
  | { k: 'not'; a: PF }
  | { k: 'and' | 'or' | 'imp' | 'iff'; a: PF; b: PF }
  /** name(⌜a⌝): Prov, True, RProv, … applied to the numeral of the Gödel number of a. */
  | { k: 'pred'; name: string; a: PF };

export const atom = (name: string): PF => ({ k: 'atom', name });
export const bot: PF = { k: 'bot' };
export const not = (a: PF): PF => ({ k: 'not', a });
export const imp = (a: PF, b: PF): PF => ({ k: 'imp', a, b });
export const and = (a: PF, b: PF): PF => ({ k: 'and', a, b });
export const or = (a: PF, b: PF): PF => ({ k: 'or', a, b });
export const iff = (a: PF, b: PF): PF => ({ k: 'iff', a, b });
export const prov = (a: PF, name = 'Prov'): PF => ({ k: 'pred', name, a });

export function eq(a: PF, b: PF): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'atom':
      return a.name === (b as typeof a).name;
    case 'bot':
      return true;
    case 'not':
      return eq(a.a, (b as typeof a).a);
    case 'pred':
      return a.name === (b as typeof a).name && eq(a.a, (b as typeof a).a);
    default:
      return eq(a.a, (b as typeof a).a) && eq(a.b, (b as typeof a).b);
  }
}

export function show(f: PF, outer = true): string {
  switch (f.k) {
    case 'atom':
      return f.name;
    case 'bot':
      return '⊥';
    case 'not':
      return `¬${show(f.a, false)}`;
    case 'pred':
      return `${f.name}(⌜${show(f.a)}⌝)`;
    default: {
      const op = { and: '∧', or: '∨', imp: '→', iff: '↔' }[f.k];
      const s = `${show(f.a, false)} ${op} ${show(f.b, false)}`;
      return outer ? s : `(${s})`;
    }
  }
}

export function tex(f: PF, outer = true): string {
  switch (f.k) {
    case 'atom':
      return f.name.length > 1 && !f.name.includes('_') ? `\\mathit{${f.name}}` : f.name;
    case 'bot':
      return '\\bot';
    case 'not':
      return `\\lnot ${tex(f.a, false)}`;
    case 'pred':
      return `\\mathsf{${f.name}}(\\ulcorner ${tex(f.a)} \\urcorner)`;
    default: {
      const op = { and: '\\land', or: '\\lor', imp: '\\rightarrow', iff: '\\leftrightarrow' }[f.k];
      const s = `${tex(f.a, false)} ${op} ${tex(f.b, false)}`;
      return outer ? s : `(${s})`;
    }
  }
}

// ------------------------------------------------------------------ tautologies

/** The propositional atoms: sentence letters and predicate applications (by their text). */
function atomsOf(f: PF, out: Map<string, PF> = new Map()): Map<string, PF> {
  switch (f.k) {
    case 'atom':
    case 'pred':
      out.set(show(f), f);
      break;
    case 'bot':
      break;
    case 'not':
      atomsOf(f.a, out);
      break;
    default:
      atomsOf(f.a, out);
      atomsOf(f.b, out);
  }
  return out;
}

function value(f: PF, v: Map<string, boolean>): boolean {
  switch (f.k) {
    case 'atom':
    case 'pred':
      return v.get(show(f))!;
    case 'bot':
      return false;
    case 'not':
      return !value(f.a, v);
    case 'and':
      return value(f.a, v) && value(f.b, v);
    case 'or':
      return value(f.a, v) || value(f.b, v);
    case 'imp':
      return !value(f.a, v) || value(f.b, v);
    case 'iff':
      return value(f.a, v) === value(f.b, v);
  }
}

export type TautologyResult = { ok: true; atoms: string[]; rows: number } | { ok: false; atoms: string[]; counterexample: Record<string, boolean> };

/** Is the formula true under every assignment of truth values to its atoms? */
export function tautology(f: PF): TautologyResult {
  const atoms = [...atomsOf(f).keys()];
  if (atoms.length > 16) throw new Error('too many atoms for a truth table');
  for (let m = 0; m < 1 << atoms.length; m++) {
    const v = new Map(atoms.map((a, i) => [a, !!(m & (1 << i))]));
    if (!value(f, v)) return { ok: false, atoms, counterexample: Object.fromEntries(v) };
  }
  return { ok: true, atoms, rows: 1 << atoms.length };
}

// ------------------------------------------------------------------ proofs

export type Just =
  /** A sentence given to us: a fixed point from the fixed-point lemma, or the theorem's assumption. */
  | { r: 'hyp'; name: string }
  | { r: 'logic'; from: number[] }
  | { r: 'P1'; from: number }
  | { r: 'P2' }
  | { r: 'P3' };

export interface Line {
  n: number;
  f: PF;
  just: Just;
  /** the book's label (e.g. "G2-5"), if the line is in the book */
  book?: string;
  note?: string;
}

export interface LineCheck {
  ok: boolean;
  errors: string[];
  /** hypotheses and conditions this line depends on (transitively) */
  uses: Set<string>;
  truthTable?: { atoms: string[]; rows: number };
}

export function checkProof(lines: Line[], opts: { conditions?: Partial<Record<'P1' | 'P2' | 'P3', boolean>>; hypotheses?: Set<string> } = {}) {
  const on = { P1: true, P2: true, P3: true, ...opts.conditions };
  const byN = new Map(lines.map((l) => [l.n, l]));
  const out = new Map<number, LineCheck>();
  for (const l of lines) {
    const errors: string[] = [];
    const uses = new Set<string>();
    let truthTable: LineCheck['truthTable'];
    const need = (n: number) => {
      const p = byN.get(n);
      const c = out.get(n);
      if (!p || !c) {
        errors.push(`line ${n} is not an earlier line`);
        return null;
      }
      if (!c.ok) errors.push(`line ${n} is not established`);
      for (const u of c.uses) uses.add(u);
      return p;
    };
    const j = l.just;
    switch (j.r) {
      case 'hyp':
        uses.add(j.name);
        if (opts.hypotheses && !opts.hypotheses.has(j.name)) errors.push(`the hypothesis “${j.name}” is not available`);
        break;
      case 'P1': {
        uses.add('P1');
        if (!on.P1) errors.push('condition P1 is switched off');
        const p = need(j.from);
        if (p && !(l.f.k === 'pred' && l.f.name === 'Prov' && eq(l.f.a, p.f))) errors.push(`P1 gives Prov(⌜${show(p.f)}⌝) from line ${j.from}, not this`);
        break;
      }
      case 'P2': {
        uses.add('P2');
        if (!on.P2) errors.push('condition P2 is switched off');
        const f = l.f;
        const okShape =
          f.k === 'imp' && f.a.k === 'pred' && f.a.name === 'Prov' && f.a.a.k === 'imp' && f.b.k === 'imp' &&
          f.b.a.k === 'pred' && f.b.a.name === 'Prov' && f.b.b.k === 'pred' && f.b.b.name === 'Prov' &&
          eq(f.a.a.a, f.b.a.a) && eq(f.a.a.b, f.b.b.a);
        if (!okShape) errors.push('not an instance of P2: Prov(⌜A → B⌝) → (Prov(⌜A⌝) → Prov(⌜B⌝))');
        break;
      }
      case 'P3': {
        uses.add('P3');
        if (!on.P3) errors.push('condition P3 is switched off');
        const f = l.f;
        const okShape = f.k === 'imp' && f.a.k === 'pred' && f.a.name === 'Prov' && f.b.k === 'pred' && f.b.name === 'Prov' && f.b.a.k === 'pred' && eq(f.b.a, f.a);
        if (!okShape) errors.push('not an instance of P3: Prov(⌜A⌝) → Prov(⌜Prov(⌜A⌝)⌝)');
        break;
      }
      case 'logic': {
        const prem = j.from.map(need).filter((p): p is Line => !!p);
        const conj = prem.length === 0 ? null : prem.slice(1).reduce<PF>((acc, p) => and(acc, p.f), prem[0].f);
        const claim = conj ? imp(conj, l.f) : l.f;
        const t = tautology(claim);
        if (!t.ok) {
          const ce = Object.entries(t.counterexample).map(([a, v]) => `${a} = ${v ? 'T' : 'F'}`).join(', ');
          errors.push(`does not follow by propositional logic: counterexample ${ce}`);
        } else truthTable = { atoms: t.atoms, rows: t.rows };
        break;
      }
    }
    out.set(l.n, { ok: errors.length === 0, errors, uses, truthTable });
  }
  return out;
}

// ------------------------------------------------------------------ the book's proofs

const G = atom('G');
const Con = not(prov(bot));

/** Section 5.7: T ⊢ Con → G, following lines (G2-1)–(G2-10), with the P2 instances written out. */
export function secondIncompleteness(): Line[] {
  const PG = prov(G);
  return [
    { n: 1, f: iff(G, not(PG)), just: { r: 'hyp', name: 'fixed point: G is a Gödel sentence' }, book: 'G2-1' },
    { n: 2, f: imp(G, not(PG)), just: { r: 'logic', from: [1] }, book: 'G2-2' },
    { n: 3, f: imp(G, imp(PG, bot)), just: { r: 'logic', from: [2] }, book: 'G2-3', note: 'uses ⊢ ¬A ↔ (A → ⊥)' },
    { n: 4, f: prov(imp(G, imp(PG, bot))), just: { r: 'P1', from: 3 }, book: 'G2-4' },
    { n: 5, f: imp(prov(imp(G, imp(PG, bot))), imp(PG, prov(imp(PG, bot)))), just: { r: 'P2' }, note: 'the instance of P2 with A ≡ G, B ≡ Prov(⌜G⌝) → ⊥ (implicit in the book)' },
    { n: 6, f: imp(PG, prov(imp(PG, bot))), just: { r: 'logic', from: [4, 5] }, book: 'G2-5' },
    { n: 7, f: imp(prov(imp(PG, bot)), imp(prov(PG), prov(bot))), just: { r: 'P2' }, note: 'the instance of P2 with A ≡ Prov(⌜G⌝), B ≡ ⊥ (implicit in the book)' },
    { n: 8, f: imp(PG, imp(prov(PG), prov(bot))), just: { r: 'logic', from: [6, 7] }, book: 'G2-6' },
    { n: 9, f: imp(PG, prov(PG)), just: { r: 'P3' }, book: 'G2-7' },
    { n: 10, f: imp(PG, prov(bot)), just: { r: 'logic', from: [8, 9] }, book: 'G2-8', note: 'uses A → (B → C), A → B ⊢ A → C' },
    { n: 11, f: imp(Con, not(PG)), just: { r: 'logic', from: [10] }, book: 'G2-9', note: 'contraposition; Con is ¬Prov(⌜⊥⌝)' },
    { n: 12, f: imp(Con, G), just: { r: 'logic', from: [1, 11] }, book: '(last line)' },
  ];
}

/** Section 5.8: Löb's theorem, lines (L-1)–(L-12). */
export function lob(): Line[] {
  const A = atom('A');
  const D = atom('D');
  const PD = prov(D);
  const PA = prov(A);
  return [
    { n: 1, f: iff(D, imp(PD, A)), just: { r: 'hyp', name: 'fixed point: D ↔ (Prov(⌜D⌝) → A)' }, book: 'L-1' },
    { n: 2, f: imp(D, imp(PD, A)), just: { r: 'logic', from: [1] }, book: 'L-2' },
    { n: 3, f: prov(imp(D, imp(PD, A))), just: { r: 'P1', from: 2 }, book: 'L-3' },
    { n: 4, f: imp(prov(imp(D, imp(PD, A))), imp(PD, prov(imp(PD, A)))), just: { r: 'P2' }, note: 'instance of P2 (implicit in the book)' },
    { n: 5, f: imp(PD, prov(imp(PD, A))), just: { r: 'logic', from: [3, 4] }, book: 'L-4' },
    { n: 6, f: imp(prov(imp(PD, A)), imp(prov(PD), PA)), just: { r: 'P2' }, note: 'instance of P2 (implicit in the book)' },
    { n: 7, f: imp(PD, imp(prov(PD), PA)), just: { r: 'logic', from: [5, 6] }, book: 'L-5' },
    { n: 8, f: imp(PD, prov(PD)), just: { r: 'P3' }, book: 'L-6' },
    { n: 9, f: imp(PD, PA), just: { r: 'logic', from: [7, 8] }, book: 'L-7' },
    { n: 10, f: imp(PA, A), just: { r: 'hyp', name: 'assumption of the theorem: T ⊢ Prov(⌜A⌝) → A' }, book: 'L-8' },
    { n: 11, f: imp(PD, A), just: { r: 'logic', from: [9, 10] }, book: 'L-9' },
    { n: 12, f: imp(imp(PD, A), D), just: { r: 'logic', from: [1] }, book: 'L-10' },
    { n: 13, f: D, just: { r: 'logic', from: [11, 12] }, book: 'L-11' },
    { n: 14, f: PD, just: { r: 'P1', from: 13 }, book: 'L-12' },
    { n: 15, f: A, just: { r: 'logic', from: [11, 14] }, book: '(last line)' },
  ];
}

/** Section 5.9: no truth definition — from the two biconditionals, T derives ⊥. */
export function tarski(): Line[] {
  const L = atom('L');
  const TL = prov(L, 'True');
  return [
    { n: 1, f: iff(L, not(TL)), just: { r: 'hyp', name: 'fixed point of ¬True(x)' } },
    { n: 2, f: iff(L, TL), just: { r: 'hyp', name: 'True(x) is a truth definition (instance for L)' } },
    { n: 3, f: bot, just: { r: 'logic', from: [1, 2] }, note: 'L ↔ ¬True(⌜L⌝) and L ↔ True(⌜L⌝) cannot both hold' },
  ];
}
