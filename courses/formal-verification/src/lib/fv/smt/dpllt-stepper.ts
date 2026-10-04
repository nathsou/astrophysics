/**
 * DPLL(T) as a conversation, for chapter 12: the chapter-7 CDCL stepper searches over atoms such as `f(a) = b`, and
 * after each round of propagation the theory of equality with uninterpreted functions (congruence closure, ./euf.ts)
 * checks whether the equalities and disequalities chosen so far can hold together. If they cannot, it returns an
 * explanation, a few of the chosen literals that already conflict, and their negation becomes a new clause (a
 * theory lemma) that the SAT side learns from like any other conflict.
 *
 * Not the course's production solver (./solver.ts), which does the same thing with watched literals, theory
 * propagation and certificates; this one keeps every exchange visible.
 */
import { Stepper } from '../sat/stepper';
import { Euf } from './euf';
import { app, uSort, type Term } from '../logic/term';

const U = uSort('U');

export interface EqAtom {
  a: Term;
  b: Term;
  text: string;
}

export class EufParseError extends Error {}

/** Parse terms like `f(g(a), b)`. */
function parseTerm(text: string): Term {
  let i = 0;
  const skip = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  const term = (): Term => {
    skip();
    const m = /^[A-Za-z_][A-Za-z0-9_']*/.exec(text.slice(i));
    if (!m) throw new EufParseError(`Expected a name at “${text.slice(i) || 'the end'}”.`);
    i += m[0].length;
    skip();
    if (text[i] !== '(') return app(m[0], [], U);
    i++;
    const args: Term[] = [term()];
    skip();
    while (text[i] === ',') {
      i++;
      args.push(term());
      skip();
    }
    if (text[i] !== ')') throw new EufParseError('Expected “)”.');
    i++;
    return app(m[0], args, U);
  };
  const t = term();
  skip();
  if (i < text.length) throw new EufParseError(`Unexpected “${text.slice(i)}”.`);
  return t;
}

export const showTerm = (t: Term): string => (t.args.length ? `${t.name}(${t.args.map(showTerm).join(', ')})` : t.name!);

/** Clauses written one per line, literals separated by `|`, each `s = t` or `s != t`. */
export function parseEufClauses(lines: string[]): { clauses: number[][]; atoms: EqAtom[] } {
  const atoms: EqAtom[] = [];
  const index = new Map<string, number>();
  const clauses = lines.map((line) =>
    line.split('|').map((lit) => {
      const m = /^(.*?)(!=|≠|=)(.*)$/.exec(lit.trim());
      if (!m) throw new EufParseError(`A literal is \`s = t\` or \`s != t\`: “${lit.trim()}”.`);
      const a = parseTerm(m[1]!.trim());
      const b = parseTerm(m[3]!.trim());
      // s = t and t = s are one atom; it keeps the orientation it was first written in.
      const [x, y] = [showTerm(a), showTerm(b)].sort();
      const k = `${x} = ${y}`;
      let v = index.get(k);
      if (v === undefined) {
        v = atoms.push({ a, b, text: `${showTerm(a)} = ${showTerm(b)}` });
        index.set(k, v);
      }
      return m[2] === '=' ? v : -v;
    }),
  );
  return { clauses, atoms };
}

export type Speaker = 'sat' | 'theory';
export interface Message {
  who: Speaker;
  kind: 'propagate' | 'decide' | 'consistent' | 'conflict' | 'learn' | 'sat' | 'unsat';
  text: string;
  /** Literals mentioned (for highlighting). */
  lits?: number[];
}

export class DplltStepper {
  readonly st: Stepper;
  readonly log: Message[] = [];
  /** Clause indices that are theory lemmas. */
  readonly lemmas = new Set<number>();
  private checked = false;

  constructor(
    clauses: number[][],
    readonly atoms: EqAtom[],
  ) {
    this.st = new Stepper(clauses, atoms.length);
  }

  litText(l: number): string {
    const a = this.atoms[Math.abs(l) - 1]!;
    return l > 0 ? a.text : `${showTerm(a.a)} ≠ ${showTerm(a.b)}`;
  }

  /** The e-graph of the current assignment. */
  egraph(): { euf: Euf; conflict: number[] | null } {
    const euf = new Euf();
    for (const t of this.st.trail) {
      const a = this.atoms[Math.abs(t.lit) - 1]!;
      euf.add(a.a);
      euf.add(a.b);
    }
    for (const t of this.st.trail) {
      const a = this.atoms[Math.abs(t.lit) - 1]!;
      if (t.lit > 0) euf.assertEq(a.a, a.b, t.lit);
      else euf.assertDiseq(a.a, a.b, t.lit);
    }
    return { euf, conflict: euf.conflict() };
  }

  get done(): boolean {
    return this.log.at(-1)?.kind === 'sat' || this.log.at(-1)?.kind === 'unsat';
  }

  /** One turn of the conversation. */
  next(): Message | undefined {
    if (this.done) return undefined;
    const st = this.st;
    const say = (m: Message) => {
      this.log.push(m);
      return m;
    };
    if (st.status === 'unsat') return say({ who: 'sat', kind: 'unsat', text: 'Every assignment fails: the formula is unsatisfiable.' });
    if (st.status === 'conflict') {
      const a = st.analysis!;
      const fromLemma = this.lemmas.has(st.conflict);
      st.learnAndBackjump();
      this.checked = false;
      return say({ who: 'sat', kind: 'learn', text: `${fromLemma ? 'The lemma is false under my choices.' : 'A clause is false under my choices.'} I learn ${a.learned.map((l) => this.litText(l)).join(' ∨ ') || 'the empty clause'} and jump back to level ${a.backjump}.`, lits: a.learned });
    }
    if (st.nextUnit()) {
      const before = st.trail.length;
      st.propagateAll();
      this.checked = false;
      const forced = st.trail.slice(before).map((t) => t.lit);
      if (st.status === 'conflict' && !forced.length) return this.next();
      return say({ who: 'sat', kind: 'propagate', text: `Unit propagation: ${forced.map((l) => this.litText(l)).join(', ')}.`, lits: forced });
    }
    if (!this.checked) {
      this.checked = true;
      const { conflict } = this.egraph();
      if (conflict) {
        const lemma = conflict.map((l) => -l);
        const idx = st.clauses.length;
        this.lemmas.add(idx);
        st.addClause(lemma);
        return say({ who: 'theory', kind: 'conflict', text: `Inconsistent: ${conflict.map((l) => this.litText(l)).join(' and ')} cannot all hold. Lemma: ${lemma.map((l) => this.litText(l)).join(' ∨ ')}.`, lits: conflict });
      }
      if (st.status === 'sat' || st.unassignedVars().length === 0) return say({ who: 'theory', kind: 'sat', text: 'Consistent, and every atom has a value: the formula is satisfiable. The classes of the e-graph are a model.' });
      return say({ who: 'theory', kind: 'consistent', text: 'Consistent: these equalities and disequalities can hold together.' });
    }
    st.decide();
    this.checked = false;
    const d = st.trail.at(-1)!.lit;
    return say({ who: 'sat', kind: 'decide', text: `Nothing is forced. I guess ${this.litText(d)} (level ${st.level}).`, lits: [d] });
  }
}
