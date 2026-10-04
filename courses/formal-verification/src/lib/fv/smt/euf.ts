/**
 * Equality with uninterpreted functions: congruence closure (Downey, Sethi and Tarjan 1980; Nelson and Oppen 1980)
 * with a proof forest for explanations (Nieuwenhuis and Oliveras 2005). When two terms end up in the same class,
 * `explain` returns the asserted equalities that put them there, which become the theory conflict or the reason of
 * a propagated literal.
 *
 * The closure grows incrementally as literals arrive; after the SAT solver backtracks it is rebuilt from the
 * literals that remain (simpler than undoing merges, and fast enough for the course's problems).
 *
 * Every non-Boolean-connective term is a node: variables, numerals, function applications, array reads and writes,
 * and arithmetic operators (treated here as uninterpreted symbols; the arithmetic solver interprets them). Two
 * distinct numerals in one class, or true and false in one class, are a conflict.
 */
import { FALSE, TRUE, type Term } from '../logic/term';

type Edge = { kind: 'lit'; lit: number } | { kind: 'cong'; a: Term; b: Term };

export class Euf {
  private parent = new Map<Term, Term>();
  private members = new Map<Term, Term[]>();
  /** Terms whose arguments include a member of the class (the use list), by representative. */
  private uses = new Map<Term, Term[]>();
  private sigs = new Map<string, Term>();
  /** Proof forest. */
  private pf = new Map<Term, { to: Term; edge: Edge }>();
  private pending: { a: Term; b: Term; edge: Edge }[] = [];
  /** Asserted disequalities. */
  diseqs: { a: Term; b: Term; lit: number }[] = [];
  /** A conflict found while merging: two terms that must differ but share a class, and an optional literal. */
  private conflictPair: { a: Term; b: Term; lit?: number } | null = null;
  readonly nodes: Term[] = [];

  constructor() {
    this.add(TRUE);
    this.add(FALSE);
  }

  has(t: Term): boolean {
    return this.parent.has(t);
  }

  /** Register a term and its subterms. */
  add(t: Term): void {
    if (this.parent.has(t)) return;
    for (const a of t.args) this.add(a);
    this.parent.set(t, t);
    this.members.set(t, [t]);
    this.uses.set(t, []);
    this.nodes.push(t);
    if (t.args.length) {
      for (const a of t.args) {
        const r = this.find(a);
        if (!this.uses.get(r)!.includes(t)) this.uses.get(r)!.push(t);
      }
      const s = this.sig(t);
      const other = this.sigs.get(s);
      if (other) this.pending.push({ a: t, b: other, edge: { kind: 'cong', a: t, b: other } });
      else this.sigs.set(s, t);
      this.propagate();
    }
  }

  find(t: Term): Term {
    let r = t;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    return r;
  }

  classOf(t: Term): readonly Term[] {
    return this.members.get(this.find(t)) ?? [t];
  }

  private sig(t: Term): string {
    return `${t.op}:${t.name ?? ''}:${t.params?.join(',') ?? ''}:${t.args.map((a) => this.find(a).id).join(',')}`;
  }

  /** Merge a and b because literal `lit` says they are equal. */
  assertEq(a: Term, b: Term, lit: number): void {
    this.add(a);
    this.add(b);
    this.pending.push({ a, b, edge: { kind: 'lit', lit } });
    this.propagate();
  }

  assertDiseq(a: Term, b: Term, lit: number): void {
    this.add(a);
    this.add(b);
    this.diseqs.push({ a, b, lit });
    if (!this.conflictPair && this.find(a) === this.find(b)) this.conflictPair = { a, b, lit };
  }

  private propagate(): void {
    while (this.pending.length) {
      const { a, b, edge } = this.pending.pop()!;
      let ra = this.find(a);
      let rb = this.find(b);
      if (ra === rb) continue;
      // Proof forest: re-root a's tree at a, then hang it under b.
      this.reroot(a);
      this.pf.set(a, { to: b, edge });
      // Union by size: merge the smaller class into the larger.
      if (this.members.get(ra)!.length > this.members.get(rb)!.length) [ra, rb] = [rb, ra];
      for (const u of this.uses.get(ra)!) this.sigs.delete(this.sig(u));
      for (const m of this.members.get(ra)!) this.parent.set(m, rb);
      this.members.get(rb)!.push(...this.members.get(ra)!);
      this.members.delete(ra);
      const moved = this.uses.get(ra)!;
      this.uses.delete(ra);
      const ub = this.uses.get(rb)!;
      for (const u of moved) {
        const s = this.sig(u);
        const other = this.sigs.get(s);
        if (other && other !== u) this.pending.push({ a: u, b: other, edge: { kind: 'cong', a: u, b: other } });
        else this.sigs.set(s, u);
        if (!ub.includes(u)) ub.push(u);
      }
      if (!this.conflictPair) this.checkClass(rb);
    }
  }

  /** Two distinct values (numerals, true/false, bit-vector literals) in one class, or an asserted disequality. */
  private checkClass(r: Term): void {
    let value: Term | undefined;
    for (const m of this.members.get(r)!) {
      if (m.op === 'num' || m.op === 'bvnum' || m.op === 'true' || m.op === 'false') {
        if (value && value !== m) {
          this.conflictPair = { a: value, b: m };
          return;
        }
        value = m;
      }
    }
    for (const d of this.diseqs) {
      if (this.find(d.a) === this.find(d.b)) {
        this.conflictPair = d;
        return;
      }
    }
  }

  private reroot(t: Term): void {
    let prev: { to: Term; edge: Edge } | undefined;
    let cur: Term | undefined = t;
    let from: Term | undefined;
    while (cur) {
      const next = this.pf.get(cur);
      if (from && prev) this.pf.set(cur, { to: from, edge: prev.edge });
      else this.pf.delete(cur);
      prev = next;
      from = cur;
      cur = next?.to;
    }
  }

  /** The conflict, as the literals that are jointly inconsistent, or null. */
  conflict(): number[] | null {
    const c = this.conflictPair;
    if (!c) return null;
    const lits = this.explain(c.a, c.b);
    if (c.lit !== undefined) lits.push(c.lit);
    return [...new Set(lits)];
  }

  /** Why a and b are in the same class: the literals used. */
  explain(a: Term, b: Term): number[] {
    const out = new Set<number>();
    const todo: [Term, Term][] = [[a, b]];
    const done = new Set<string>();
    while (todo.length) {
      const [x, y] = todo.pop()!;
      if (x === y) continue;
      const k = x.id < y.id ? `${x.id},${y.id}` : `${y.id},${x.id}`;
      if (done.has(k)) continue;
      done.add(k);
      for (const e of this.path(x, y)) {
        if (e.kind === 'lit') out.add(e.lit);
        else e.a.args.forEach((arg, i) => todo.push([arg, e.b.args[i]!]));
      }
    }
    return [...out];
  }

  /** The proof-forest edges between x and y (which must be connected). */
  private path(x: Term, y: Term): Edge[] {
    const up = (t: Term) => {
      const chain: Term[] = [t];
      let c = t;
      while (this.pf.has(c)) {
        c = this.pf.get(c)!.to;
        chain.push(c);
      }
      return chain;
    };
    const px = up(x);
    const py = up(y);
    const sy = new Set(py);
    const lca = px.find((t) => sy.has(t));
    if (!lca) throw new Error('explain: terms are not in the same class');
    const edges: Edge[] = [];
    for (const chain of [px, py]) {
      for (const t of chain) {
        if (t === lca) break;
        edges.push(this.pf.get(t)!.edge);
      }
    }
    return edges;
  }

  /** The class representatives. */
  classes(): Term[] {
    return [...this.members.keys()];
  }
}
