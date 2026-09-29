// Propositional logic: parsing, truth tables, intuitionistic proof search that
// produces proof terms in the course language, and Kripke countermodels.
//
// Proof search uses Dyckhoff's contraction-free sequent calculus G4ip, which
// terminates without loop checking. Each rule is read as a way to build a
// term: hypotheses are (term, formula) pairs, and decomposing a hypothesis
// replaces it by new terms built from it (h.1, h.2, fun c d => h ⟨c, d⟩ …).

export type F =
  | { k: 'atom'; name: string }
  | { k: 'top' }
  | { k: 'bot' }
  | { k: 'and'; a: F; b: F }
  | { k: 'or'; a: F; b: F }
  | { k: 'imp'; a: F; b: F }
  | { k: 'iff'; a: F; b: F };

const atom = (name: string): F => ({ k: 'atom', name });
const imp = (a: F, b: F): F => ({ k: 'imp', a, b });
const BOT: F = { k: 'bot' };

// ---------------------------------------------------------------------------
// parsing:  p ∧ q → q ∧ p,   ¬¬p → p,   (p ↔ q) ∨ r,   True, False

export function parseF(src: string): F {
  const toks = src.match(/[A-Za-z][\w'₀-₉]*|↔|<->|→|->|∧|\/\\|∨|\\\/|¬|~|\(|\)|⊤|⊥/gu) ?? [];
  const rest = src.replace(/[A-Za-z][\w'₀-₉]*|↔|<->|→|->|∧|\/\\|∨|\\\/|¬|~|\(|\)|⊤|⊥|\s/gu, '');
  if (rest.length) throw new Error(`unexpected '${rest[0]}'`);
  let i = 0;
  const peek = () => toks[i];
  const iff = (): F => {
    const a = impl();
    if (peek() === '↔' || peek() === '<->') {
      i++;
      return { k: 'iff', a, b: iff() };
    }
    return a;
  };
  const impl = (): F => {
    const a = or();
    if (peek() === '→' || peek() === '->') {
      i++;
      return imp(a, impl());
    }
    return a;
  };
  const or = (): F => {
    const a = and();
    if (peek() === '∨' || peek() === '\\/') {
      i++;
      return { k: 'or', a, b: or() };
    }
    return a;
  };
  const and = (): F => {
    const a = unary();
    if (peek() === '∧' || peek() === '/\\') {
      i++;
      return { k: 'and', a, b: and() };
    }
    return a;
  };
  const unary = (): F => {
    const t = toks[i++];
    if (t === '¬' || t === '~') return imp(unary(), BOT);
    if (t === '(') {
      const r = iff();
      if (toks[i++] !== ')') throw new Error('expected )');
      return r;
    }
    if (t === 'True' || t === '⊤') return { k: 'top' };
    if (t === 'False' || t === '⊥') return BOT;
    if (!t || !/^[A-Za-z]/.test(t)) throw new Error(`unexpected ${t ?? 'end of input'}`);
    return atom(t);
  };
  const r = iff();
  if (i < toks.length) throw new Error(`unexpected ${toks[i]}`);
  return r;
}

export function showF(f: F, prec = 0): string {
  const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
  switch (f.k) {
    case 'atom':
      return f.name;
    case 'top':
      return 'True';
    case 'bot':
      return 'False';
    case 'and':
      return par(`${showF(f.a, 4)} ∧ ${showF(f.b, 3)}`, 3);
    case 'or':
      return par(`${showF(f.a, 3)} ∨ ${showF(f.b, 2)}`, 2);
    case 'imp':
      if (f.b.k === 'bot') return `¬${showF(f.a, 5)}`;
      return par(`${showF(f.a, 2)} → ${showF(f.b, 1)}`, 1);
    case 'iff':
      return par(`${showF(f.a, 1)} ↔ ${showF(f.b, 0)}`, 0);
  }
}

export function atoms(f: F, out: string[] = []): string[] {
  if (f.k === 'atom') {
    if (!out.includes(f.name)) out.push(f.name);
  } else if (f.k !== 'top' && f.k !== 'bot') {
    atoms(f.a, out);
    atoms(f.b, out);
  }
  return out;
}

const eqF = (x: F, y: F): boolean => {
  if (x.k !== y.k) return false;
  if (x.k === 'atom') return x.name === (y as typeof x).name;
  if (x.k === 'top' || x.k === 'bot') return true;
  const yy = y as typeof x;
  return eqF(x.a, yy.a) && eqF(x.b, yy.b);
};

// ---------------------------------------------------------------------------
// classical truth tables

export function evalF(f: F, v: Record<string, boolean>): boolean {
  switch (f.k) {
    case 'atom':
      return !!v[f.name];
    case 'top':
      return true;
    case 'bot':
      return false;
    case 'and':
      return evalF(f.a, v) && evalF(f.b, v);
    case 'or':
      return evalF(f.a, v) || evalF(f.b, v);
    case 'imp':
      return !evalF(f.a, v) || evalF(f.b, v);
    case 'iff':
      return evalF(f.a, v) === evalF(f.b, v);
  }
}

/** a valuation making f false, if any */
export function falsifier(f: F): Record<string, boolean> | undefined {
  const as = atoms(f);
  for (let m = 0; m < 1 << as.length; m++) {
    const v: Record<string, boolean> = {};
    as.forEach((a, i) => (v[a] = !!(m & (1 << i))));
    if (!evalF(f, v)) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// intuitionistic proof search (G4ip) with proof terms

/** proof terms, printed in the course language */
export type Tm =
  | { k: 'var'; name: string }
  | { k: 'lam'; name: string; body: Tm }
  | { k: 'app'; fn: Tm; arg: Tm }
  | { k: 'pair'; a: Tm; b: Tm }
  | { k: 'proj'; t: Tm; i: 1 | 2 }
  | { k: 'inl'; t: Tm }
  | { k: 'inr'; t: Tm }
  | { k: 'orElim'; t: Tm; l: Tm; r: Tm }
  | { k: 'falseElim'; t: Tm }
  | { k: 'trivial' };

const V = (name: string): Tm => ({ k: 'var', name });
const lam = (name: string, body: Tm): Tm => ({ k: 'lam', name, body });

function subst(t: Tm, x: string, by: Tm): Tm {
  switch (t.k) {
    case 'var':
      return t.name === x ? by : t;
    case 'lam':
      return t.name === x ? t : { ...t, body: subst(t.body, x, by) };
    case 'app':
      return { k: 'app', fn: subst(t.fn, x, by), arg: subst(t.arg, x, by) };
    case 'pair':
      return { k: 'pair', a: subst(t.a, x, by), b: subst(t.b, x, by) };
    case 'proj':
    case 'inl':
    case 'inr':
    case 'falseElim':
      return { ...t, t: subst(t.t, x, by) } as Tm;
    case 'orElim':
      return { k: 'orElim', t: subst(t.t, x, by), l: subst(t.l, x, by), r: subst(t.r, x, by) };
    case 'trivial':
      return t;
  }
}

/** application, β-reducing when the function is a λ (all bound names are fresh, so there is no capture) */
function ap(fn: Tm, arg: Tm): Tm {
  if (fn.k === 'lam') return subst(fn.body, fn.name, arg);
  return { k: 'app', fn, arg };
}

/** a projection, reducing ⟨a, b⟩.1 to a */
function pj(t: Tm, i: 1 | 2): Tm {
  if (t.k === 'pair') return i === 1 ? t.a : t.b;
  return { k: 'proj', t, i };
}

export function showTm(t: Tm): string {
  const go = (t: Tm, prec: number): string => {
    const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
    switch (t.k) {
      case 'var':
        return t.name;
      case 'trivial':
        return 'trivial';
      case 'lam': {
        const names: string[] = [];
        let b: Tm = t;
        while (b.k === 'lam') {
          names.push(b.name);
          b = b.body;
        }
        return par(`fun ${names.join(' ')} => ${go(b, 0)}`, 0);
      }
      case 'app':
        return par(`${go(t.fn, 1)} ${go(t.arg, 2)}`, 1);
      case 'pair':
        return `⟨${go(t.a, 0)}, ${go(t.b, 0)}⟩`;
      case 'proj':
        return `${go(t.t, 2)}.${t.i}`;
      case 'inl':
        return par(`Or.inl ${go(t.t, 2)}`, 1);
      case 'inr':
        return par(`Or.inr ${go(t.t, 2)}`, 1);
      case 'falseElim':
        return par(`False.elim ${go(t.t, 2)}`, 1);
      case 'orElim':
        return par(`Or.elim ${go(t.t, 2)} ${go(t.l, 2)} ${go(t.r, 2)}`, 1);
    }
  };
  return go(t, 0);
}

interface Hyp {
  t: Tm;
  f: F;
}

/** names used in the terms of a context (free or bound) */
function namesIn(ctx: Hyp[]): Set<string> {
  const out = new Set<string>();
  const go = (t: Tm): void => {
    switch (t.k) {
      case 'var':
        out.add(t.name);
        return;
      case 'lam':
        out.add(t.name);
        return go(t.body);
      case 'app':
        go(t.fn);
        return go(t.arg);
      case 'pair':
        go(t.a);
        return go(t.b);
      case 'orElim':
        go(t.t);
        go(t.l);
        return go(t.r);
      case 'trivial':
        return;
      default:
        return go(t.t);
    }
  };
  ctx.forEach((h) => go(h.t));
  return out;
}

class Names {
  /** a name for a hypothesis of type f, not used anywhere in ctx (so substitution never captures) */
  fresh(f: F, ctx: Hyp[], also: string[] = []): string {
    const base = f.k === 'atom' ? `h${f.name}` : f.k === 'and' ? 'hand' : f.k === 'or' ? 'hor' : f.k === 'imp' && f.b.k === 'bot' ? 'hn' : 'h';
    const used = namesIn(ctx);
    for (const a of also) used.add(a);
    if (!used.has(base) && base !== 'h') return base;
    for (let i = base === 'h' ? 1 : 2; ; i++) if (!used.has(`${base}${i}`)) return `${base}${i}`;
  }
}

class Prover {
  steps = 0;
  constructor(
    private names: Names,
    private limit = 20000,
  ) {}

  prove(ctx: Hyp[], goal: F): Tm | undefined {
    if (++this.steps > this.limit) throw new Error('search limit');
    // --- invertible rules on the goal
    if (goal.k === 'top') return { k: 'trivial' };
    if (goal.k === 'imp') {
      const x = this.names.fresh(goal.a, ctx);
      const body = this.prove([...ctx, { t: V(x), f: goal.a }], goal.b);
      return body === undefined ? undefined : lam(x, body);
    }
    if (goal.k === 'and') {
      const a = this.prove(ctx, goal.a);
      if (a === undefined) return undefined;
      const b = this.prove(ctx, goal.b);
      return b === undefined ? undefined : { k: 'pair', a, b };
    }
    if (goal.k === 'iff') {
      const a = this.prove(ctx, imp(goal.a, goal.b));
      if (a === undefined) return undefined;
      const b = this.prove(ctx, imp(goal.b, goal.a));
      return b === undefined ? undefined : { k: 'pair', a, b };
    }
    // --- invertible rules on hypotheses
    for (let i = 0; i < ctx.length; i++) {
      const h = ctx[i];
      const rest = [...ctx.slice(0, i), ...ctx.slice(i + 1)];
      switch (h.f.k) {
        case 'bot':
          return goal.k === 'bot' ? h.t : { k: 'falseElim', t: h.t };
        case 'top':
          return this.prove(rest, goal);
        case 'and':
          return this.prove([...rest, { t: pj(h.t, 1), f: h.f.a }, { t: pj(h.t, 2), f: h.f.b }], goal);
        case 'iff':
          return this.prove([...rest, { t: pj(h.t, 1), f: imp(h.f.a, h.f.b) }, { t: pj(h.t, 2), f: imp(h.f.b, h.f.a) }], goal);
        case 'or': {
          const x = this.names.fresh(h.f.a, ctx);
          const y = this.names.fresh(h.f.b, ctx, [x]);
          const l = this.prove([...rest, { t: V(x), f: h.f.a }], goal);
          if (l === undefined) return undefined;
          const r = this.prove([...rest, { t: V(y), f: h.f.b }], goal);
          if (r === undefined) return undefined;
          return { k: 'orElim', t: h.t, l: lam(x, l), r: lam(y, r) };
        }
        case 'imp': {
          const a = h.f.a;
          const b = h.f.b;
          if (a.k === 'atom') {
            const found = rest.find((g) => eqF(g.f, a));
            if (found) return this.prove([...rest, { t: ap(h.t, found.t), f: b }], goal);
            break;
          }
          if (a.k === 'top') return this.prove([...rest, { t: ap(h.t, { k: 'trivial' }), f: b }], goal);
          if (a.k === 'bot') return this.prove(rest, goal);
          if (a.k === 'and') {
            const c = this.names.fresh(a.a, ctx);
            const d = this.names.fresh(a.b, ctx, [c]);
            return this.prove([...rest, { t: lam(c, lam(d, ap(h.t, { k: 'pair', a: V(c), b: V(d) }))), f: imp(a.a, imp(a.b, b)) }], goal);
          }
          if (a.k === 'or') {
            const c = this.names.fresh(a.a, ctx);
            const d = this.names.fresh(a.b, ctx, [c]);
            return this.prove(
              [...rest, { t: lam(c, ap(h.t, { k: 'inl', t: V(c) })), f: imp(a.a, b) }, { t: lam(d, ap(h.t, { k: 'inr', t: V(d) })), f: imp(a.b, b) }],
              goal,
            );
          }
          if (a.k === 'iff') {
            const c = this.names.fresh(a.a, ctx);
            const d = this.names.fresh(a.b, ctx, [c]);
            return this.prove([...rest, { t: lam(c, lam(d, ap(h.t, { k: 'pair', a: V(c), b: V(d) }))), f: imp(imp(a.a, a.b), imp(imp(a.b, a.a), b)) }], goal);
          }
          break;
        }
        default:
          break;
      }
    }
    // --- axioms
    const direct = ctx.find((g) => eqF(g.f, goal));
    if (direct) return direct.t;
    // --- non-invertible rules
    if (goal.k === 'or') {
      const l = this.prove(ctx, goal.a);
      if (l !== undefined) return { k: 'inl', t: l };
      const r = this.prove(ctx, goal.b);
      if (r !== undefined) return { k: 'inr', t: r };
    }
    for (let i = 0; i < ctx.length; i++) {
      const h = ctx[i];
      if (h.f.k !== 'imp' || h.f.a.k !== 'imp') continue;
      // h : (C → D) → B.   Γ, D → B ⊢ C → D   and   Γ, B ⊢ goal
      const { a: C, b: D } = h.f.a;
      const B = h.f.b;
      const rest = [...ctx.slice(0, i), ...ctx.slice(i + 1)];
      const d = this.names.fresh(D, ctx);
      const k = this.names.fresh(C, ctx, [d]);
      const cd = this.prove([...rest, { t: lam(d, ap(h.t, lam(k, V(d)))), f: imp(D, B) }], imp(C, D));
      if (cd === undefined) continue;
      const r = this.prove([...rest, { t: ap(h.t, cd), f: B }], goal);
      if (r !== undefined) return r;
    }
    return undefined;
  }
}

export interface ProofResult {
  /** a proof term, when the formula is intuitionistically provable */
  term?: string;
  /** the search gave up */
  gaveUp?: boolean;
}

export function proveF(f: F): ProofResult {
  const p = new Prover(new Names());
  try {
    const t = p.prove([], f);
    return t === undefined ? {} : { term: showTm(t) };
  } catch {
    return { gaveUp: true };
  }
}

/** a theorem declaration for the formula, with its atoms as propositional variables */
export function theoremDecl(f: F, term: string, name = 'claim'): string {
  const as = atoms(f);
  const binders = as.length ? ` (${as.join(' ')} : Prop)` : '';
  return `theorem ${name}${binders} : ${showF(f)} :=\n  ${term}`;
}

// ---------------------------------------------------------------------------
// Kripke countermodels

export interface Kripke {
  /** worlds 0..n-1; 0 is the root */
  n: number;
  /** le[i][j]: world j is reachable from world i (reflexive, transitive) */
  le: boolean[][];
  /** the atoms true at each world (upward closed) */
  val: Record<string, boolean[]>;
}

export function forces(m: Kripke, w: number, f: F): boolean {
  switch (f.k) {
    case 'atom':
      return !!m.val[f.name]?.[w];
    case 'top':
      return true;
    case 'bot':
      return false;
    case 'and':
      return forces(m, w, f.a) && forces(m, w, f.b);
    case 'or':
      return forces(m, w, f.a) || forces(m, w, f.b);
    case 'imp':
      for (let v = 0; v < m.n; v++) if (m.le[w][v] && forces(m, v, f.a) && !forces(m, v, f.b)) return false;
      return true;
    case 'iff':
      return forces(m, w, imp(f.a, f.b)) && forces(m, w, imp(f.b, f.a));
  }
}

/** rooted frames with up to n worlds: trees are enough for propositional logic */
function* trees(n: number): Generator<number[]> {
  // parent[i] < i for i ≥ 1
  const parent = new Array(n).fill(-1);
  function* go(i: number): Generator<number[]> {
    if (i === n) {
      yield [...parent];
      return;
    }
    for (let p = 0; p < i; p++) {
      // canonical ordering: parents are non-decreasing (avoids most duplicate shapes)
      if (i > 1 && p < parent[i - 1]) continue;
      parent[i] = p;
      yield* go(i + 1);
    }
  }
  yield* go(1);
}

function frameOf(parent: number[]): boolean[][] {
  const n = parent.length;
  const le = Array.from({ length: n }, () => new Array(n).fill(false));
  for (let v = 0; v < n; v++) {
    let u = v;
    while (u >= 0) {
      le[u][v] = true;
      u = parent[u];
    }
  }
  return le;
}

/** a Kripke model (tree-shaped, at most maxWorlds worlds) whose root does not force f */
export function countermodel(f: F, maxWorlds = 4): Kripke | undefined {
  const as = atoms(f);
  for (let n = 1; n <= maxWorlds; n++) {
    for (const parent of trees(n)) {
      const le = frameOf(parent);
      // upward-closed sets of worlds, for each atom
      const ups: boolean[][] = [];
      for (let m = 0; m < 1 << n; m++) {
        const s = Array.from({ length: n }, (_, i) => !!(m & (1 << i)));
        let ok = true;
        for (let u = 0; u < n && ok; u++) for (let v = 0; v < n && ok; v++) if (s[u] && le[u][v] && !s[v]) ok = false;
        if (ok) ups.push(s);
      }
      const choice = new Array(as.length).fill(0);
      const total = ups.length ** as.length;
      for (let c = 0; c < total; c++) {
        let x = c;
        for (let i = 0; i < as.length; i++) {
          choice[i] = x % ups.length;
          x = Math.floor(x / ups.length);
        }
        const val: Record<string, boolean[]> = {};
        as.forEach((a, i) => (val[a] = ups[choice[i]]));
        const m: Kripke = { n, le, val };
        if (!forces(m, 0, f)) return m;
      }
    }
  }
  return undefined;
}

/** the subformulas of f, smallest first (for displaying forcing tables) */
export function subformulas(f: F): F[] {
  const out: F[] = [];
  const go = (g: F) => {
    if (g.k !== 'atom' && g.k !== 'top' && g.k !== 'bot') {
      go(g.a);
      go(g.b);
    }
    if (!out.some((x) => eqF(x, g))) out.push(g);
  };
  go(f);
  return out;
}

export type Verdict = { kind: 'provable'; term: string } | { kind: 'classical'; model?: Kripke } | { kind: 'false'; valuation: Record<string, boolean> } | { kind: 'unknown' };

/** the three possible answers: provable (with a proof), true only classically (with a countermodel), or false (with a valuation) */
export function judge(f: F): Verdict {
  const v = falsifier(f);
  if (v) return { kind: 'false', valuation: v };
  const r = proveF(f);
  if (r.term !== undefined) return { kind: 'provable', term: r.term };
  if (r.gaveUp) return { kind: 'unknown' };
  return { kind: 'classical', model: countermodel(f) };
}
