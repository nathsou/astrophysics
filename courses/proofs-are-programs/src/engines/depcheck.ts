// A JavaScript mirror of chapter 21's dependent type checker, step for step (the same
// substitution, the same normaliser with the same fuel, the same bidirectional `tc`),
// with a trace of every judgement, and switches that break the rules of the kernel.
// The chapter's tests check that this mirror and the course-language checker agree.

export type Tm =
  | { k: 'var'; i: number }
  | { k: 'sort'; l: number }
  | { k: 'pi'; A: Tm; B: Tm; x?: string }
  | { k: 'lam'; b: Tm; x?: string }
  | { k: 'app'; f: Tm; a: Tm }
  | { k: 'ann'; t: Tm; T: Tm }
  | { k: 'nat' }
  | { k: 'zero' }
  | { k: 'succ'; n: Tm };

export const FUEL = 100;

export function eqTm(a: Tm, b: Tm): boolean {
  switch (a.k) {
    case 'var':
      return b.k === 'var' && a.i === b.i;
    case 'sort':
      return b.k === 'sort' && a.l === b.l;
    case 'pi':
      return b.k === 'pi' && eqTm(a.A, b.A) && eqTm(a.B, b.B);
    case 'lam':
      return b.k === 'lam' && eqTm(a.b, b.b);
    case 'app':
      return b.k === 'app' && eqTm(a.f, b.f) && eqTm(a.a, b.a);
    case 'ann':
      return b.k === 'ann' && eqTm(a.t, b.t) && eqTm(a.T, b.T);
    case 'succ':
      return b.k === 'succ' && eqTm(a.n, b.n);
    default:
      return a.k === b.k;
  }
}

export function shift(d: number, c: number, t: Tm): Tm {
  switch (t.k) {
    case 'var':
      return t.i < c ? t : { k: 'var', i: t.i + d };
    case 'pi':
      return { k: 'pi', A: shift(d, c, t.A), B: shift(d, c + 1, t.B), x: t.x };
    case 'lam':
      return { k: 'lam', b: shift(d, c + 1, t.b), x: t.x };
    case 'app':
      return { k: 'app', f: shift(d, c, t.f), a: shift(d, c, t.a) };
    case 'ann':
      return { k: 'ann', t: shift(d, c, t.t), T: shift(d, c, t.T) };
    case 'succ':
      return { k: 'succ', n: shift(d, c, t.n) };
    default:
      return t;
  }
}

export function subst(t: Tm, j: number, s: Tm): Tm {
  switch (t.k) {
    case 'var':
      return t.i === j ? s : j < t.i ? { k: 'var', i: t.i - 1 } : t;
    case 'pi':
      return { k: 'pi', A: subst(t.A, j, s), B: subst(t.B, j + 1, shift(1, 0, s)), x: t.x };
    case 'lam':
      return { k: 'lam', b: subst(t.b, j + 1, shift(1, 0, s)), x: t.x };
    case 'app':
      return { k: 'app', f: subst(t.f, j, s), a: subst(t.a, j, s) };
    case 'ann':
      return { k: 'ann', t: subst(t.t, j, s), T: subst(t.T, j, s) };
    case 'succ':
      return { k: 'succ', n: subst(t.n, j, s) };
    default:
      return t;
  }
}

export function norm(fuel: number, t: Tm): Tm {
  if (fuel === 0) return t;
  const f = fuel - 1;
  switch (t.k) {
    case 'app': {
      const fn = norm(f, t.f);
      if (fn.k === 'lam') return norm(f, subst(fn.b, 0, norm(f, t.a)));
      return { k: 'app', f: fn, a: norm(f, t.a) };
    }
    case 'ann':
      return norm(f, t.t);
    case 'pi':
      return { k: 'pi', A: norm(f, t.A), B: norm(f, t.B), x: t.x };
    case 'lam':
      return { k: 'lam', b: norm(f, t.b), x: t.x };
    case 'succ':
      return { k: 'succ', n: norm(f, t.n) };
    default:
      return t;
  }
}

// ---------------------------------------------------------------------------
// the checker, with its trace

export interface Breaks {
  /** Type l : Type l, instead of Type (l + 1) */
  typeInType?: boolean;
  /** application does not check its argument */
  skipArg?: boolean;
  /** a term is accepted at any expected type */
  skipConv?: boolean;
}

export interface Node {
  mode: 'infer' | 'check';
  names: string[];
  term: Tm;
  expected?: Tm;
  result?: Tm;
  error?: string;
  children: Node[];
  conv?: { a: Tm; b: Tm; na: Tm; nb: Tm; ok: boolean; skipped?: boolean };
}

function lookup(ctx: Tm[], i: number): Tm | undefined {
  if (i >= ctx.length) return undefined;
  // the type of variable i was written in the context of the variables after it: shift past i + 1 binders
  return shift(i + 1, 0, ctx[i]);
}

export function tc(ctx: Tm[], names: string[], t: Tm, E: Tm | undefined, br: Breaks = {}): Node {
  const node: Node = { mode: E ? 'check' : 'infer', names, term: t, expected: E, children: [] };
  const expect = (r: Tm | undefined, why?: string): Node => {
    if (!r) {
      node.error ??= why ?? 'no type';
      return node;
    }
    if (!E) {
      node.result = r;
      return node;
    }
    const na = norm(FUEL, r);
    const nb = norm(FUEL, E);
    const ok = eqTm(na, nb);
    node.conv = { a: r, b: E, na, nb, ok: ok || !!br.skipConv, skipped: !ok && br.skipConv };
    if (ok || br.skipConv) node.result = E;
    else node.error = 'the inferred type and the expected type do not have the same normal form';
    return node;
  };
  const sortOf = (T: Tm | undefined): number | undefined => {
    if (!T) return undefined;
    const n = norm(FUEL, T);
    return n.k === 'sort' ? n.l : undefined;
  };
  const sub = (c: Tm[], ns: string[], x: Tm, e?: Tm) => {
    const n = tc(c, ns, x, e, br);
    node.children.push(n);
    return n;
  };
  switch (t.k) {
    case 'var': {
      const T = lookup(ctx, t.i);
      return expect(T, `the variable #${t.i} is not in the context`);
    }
    case 'sort':
      return expect({ k: 'sort', l: br.typeInType ? t.l : t.l + 1 });
    case 'pi': {
      const a = sub(ctx, names, t.A);
      const la = sortOf(a.result);
      if (la === undefined) return expect(undefined, a.result ? 'the domain of a Π-type must be a type' : 'the domain has no type');
      const b = sub([t.A, ...ctx], [t.x ?? '_', ...names], t.B);
      const lb = sortOf(b.result);
      if (lb === undefined) return expect(undefined, b.result ? 'the codomain of a Π-type must be a type' : 'the codomain has no type');
      return expect({ k: 'sort', l: Math.max(la, lb) });
    }
    case 'lam': {
      if (!E) return expect(undefined, 'cannot infer the type of an unannotated function: annotate it, (fun x => … : A → B)');
      const n = norm(FUEL, E);
      if (n.k !== 'pi') return expect(undefined, 'a function is expected to have a function type');
      const b = sub([n.A, ...ctx], [t.x ?? '_', ...names], t.b, n.B);
      if (!b.result) return expect(undefined, 'the body does not have the expected type');
      node.result = E;
      return node;
    }
    case 'app': {
      const f = sub(ctx, names, t.f);
      if (!f.result) return expect(undefined, 'the function has no type');
      const F = norm(FUEL, f.result);
      if (F.k !== 'pi') return expect(undefined, 'only functions can be applied: the type of the head is not a Π-type');
      if (!br.skipArg) {
        const a = sub(ctx, names, t.a, F.A);
        if (!a.result) return expect(undefined, 'the argument does not have the type the function expects');
      }
      return expect(subst(F.B, 0, t.a));
    }
    case 'ann': {
      const T = sub(ctx, names, t.T);
      if (sortOf(T.result) === undefined) return expect(undefined, 'an annotation must be a type');
      const x = sub(ctx, names, t.t, t.T);
      if (!x.result) return expect(undefined, 'the term does not have the annotated type');
      return expect(t.T);
    }
    case 'nat':
      return expect({ k: 'sort', l: 0 });
    case 'zero':
      return expect({ k: 'nat' });
    case 'succ': {
      const n = sub(ctx, names, t.n, { k: 'nat' });
      if (!n.result) return expect(undefined, 'succ needs a number');
      return expect({ k: 'nat' });
    }
  }
}

// ---------------------------------------------------------------------------
// surface syntax:  (fun A x => x : (A : Type) → A → A) Nat 3

export function parse(src: string): Tm {
  const toks = src.match(/\d+|[A-Za-z_][\w'₀-₉]*|=>|->|→|[():]|\S/gu) ?? [];
  let i = 0;
  const peek = (k = 0) => toks[i + k];
  const expect = (s: string) => {
    if (toks[i] !== s) throw new Error(`expected '${s}'${toks[i] ? `, found '${toks[i]}'` : ' at the end'}`);
    i++;
  };
  const isIdent = (t: string | undefined) => t !== undefined && /^[A-Za-z_]/.test(t) && !['fun', 'Type', 'Nat', 'zero', 'succ'].includes(t);
  const term = (ns: string[]): Tm => {
    if (peek() === 'fun' || peek() === 'λ') {
      i++;
      const xs: string[] = [];
      while (isIdent(peek())) xs.push(toks[i++]);
      if (!xs.length) throw new Error('expected a variable name after fun');
      expect('=>');
      let inner = [...ns];
      for (const x of xs) inner = [x, ...inner];
      let b = term(inner);
      for (const x of [...xs].reverse()) b = { k: 'lam', b, x };
      return b;
    }
    // (x : A) → B
    if (peek() === '(' && isIdent(peek(1)) && peek(2) === ':') {
      const save = i;
      i += 3;
      const A = term(ns);
      if (peek() === ')' && (peek(1) === '→' || peek(1) === '->')) {
        i += 2;
        const x = toks[save + 1];
        return { k: 'pi', A, B: term([x, ...ns]), x };
      }
      i = save;
    }
    const a = app(ns);
    if (peek() === '→' || peek() === '->') {
      i++;
      return { k: 'pi', A: a, B: term(['_', ...ns]), x: '_' };
    }
    return a;
  };
  const startsAtom = (t: string | undefined) => t !== undefined && (t === '(' || /^\d+$/.test(t) || /^[A-Za-z_]/.test(t)) && t !== 'fun';
  const app = (ns: string[]): Tm => {
    if (peek() === 'succ') {
      i++;
      return { k: 'succ', n: atom(ns) };
    }
    let f = atom(ns);
    while (startsAtom(peek())) {
      if (peek() === 'succ') {
        i++;
        f = { k: 'app', f, a: { k: 'succ', n: atom(ns) } };
      } else f = { k: 'app', f, a: atom(ns) };
    }
    return f;
  };
  const atom = (ns: string[]): Tm => {
    const t = toks[i++];
    if (t === undefined) throw new Error('unexpected end of input');
    if (t === '(') {
      const x = term(ns);
      if (peek() === ':') {
        i++;
        const T = term(ns);
        expect(')');
        return { k: 'ann', t: x, T };
      }
      expect(')');
      return x;
    }
    if (/^\d+$/.test(t)) {
      let r: Tm = { k: 'zero' };
      for (let k = 0; k < Number(t); k++) r = { k: 'succ', n: r };
      return r;
    }
    if (t === 'Type') {
      if (/^\d+$/.test(peek() ?? '')) return { k: 'sort', l: Number(toks[i++]) };
      return { k: 'sort', l: 0 };
    }
    if (t === 'Nat') return { k: 'nat' };
    if (t === 'zero') return { k: 'zero' };
    if (isIdent(t)) {
      const idx = ns.indexOf(t);
      if (idx < 0) throw new Error(`unbound variable '${t}'`);
      return { k: 'var', i: idx };
    }
    throw new Error(`unexpected '${t}'`);
  };
  const r = term([]);
  if (i < toks.length) throw new Error(`unexpected '${toks[i]}'`);
  return r;
}

// ---------------------------------------------------------------------------
// printing

function mentions0(t: Tm, d = 0): boolean {
  switch (t.k) {
    case 'var':
      return t.i === d;
    case 'pi':
      return mentions0(t.A, d) || mentions0(t.B, d + 1);
    case 'lam':
      return mentions0(t.b, d + 1);
    case 'app':
      return mentions0(t.f, d) || mentions0(t.a, d);
    case 'ann':
      return mentions0(t.t, d) || mentions0(t.T, d);
    case 'succ':
      return mentions0(t.n, d);
    default:
      return false;
  }
}

function numeral(t: Tm): number | undefined {
  let n = 0;
  while (t.k === 'succ') {
    n++;
    t = t.n;
  }
  return t.k === 'zero' ? n : undefined;
}

export function show(t: Tm, ns: string[] = [], prec = 0): string {
  const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
  const fresh = (x: string | undefined) => {
    let b = x && x !== '_' ? x : 'x';
    while (ns.includes(b)) b += "'";
    return b;
  };
  switch (t.k) {
    case 'var':
      return ns[t.i] && ns[t.i] !== '_' ? ns[t.i] : `#${t.i}`;
    case 'sort':
      return t.l === 0 ? 'Type' : `Type ${t.l}`;
    case 'nat':
      return 'Nat';
    case 'zero':
      return '0';
    case 'succ': {
      const n = numeral(t);
      return n !== undefined ? String(n) : par(`succ ${show(t.n, ns, 3)}`, 2);
    }
    case 'pi': {
      if (!mentions0(t.B)) return par(`${show(t.A, ns, 1)} → ${show(t.B, ['_', ...ns], 0)}`, 0);
      const x = fresh(t.x);
      return par(`(${x} : ${show(t.A, ns, 0)}) → ${show(t.B, [x, ...ns], 0)}`, 0);
    }
    case 'lam': {
      const x = fresh(t.x);
      return par(`fun ${x} => ${show(t.b, [x, ...ns], 0)}`, 0);
    }
    case 'app':
      return par(`${show(t.f, ns, 2)} ${show(t.a, ns, 3)}`, 2);
    case 'ann':
      return `(${show(t.t, ns, 0)} : ${show(t.T, ns, 0)})`;
  }
}

/** the term as a value of the chapter's `Tm` */
export function toCourse(t: Tm): string {
  switch (t.k) {
    case 'var':
      return `(.var ${t.i})`;
    case 'sort':
      return `(.sort ${t.l})`;
    case 'pi':
      return `(.pi ${toCourse(t.A)} ${toCourse(t.B)})`;
    case 'lam':
      return `(.lam ${toCourse(t.b)})`;
    case 'app':
      return `(.app ${toCourse(t.f)} ${toCourse(t.a)})`;
    case 'ann':
      return `(.ann ${toCourse(t.t)} ${toCourse(t.T)})`;
    case 'nat':
      return '.nat';
    case 'zero':
      return '.zero';
    case 'succ':
      return `(.succ ${toCourse(t.n)})`;
  }
}

export const KERNEL_PRESETS: { src: string; note: string; breaks?: Breaks }[] = [
  { src: '(fun A x => x : (A : Type) → A → A)', note: 'the polymorphic identity' },
  { src: '(fun A x => x : (A : Type) → A → A) Nat 3', note: 'a dependent application: the type of the result depends on the first argument' },
  { src: '(fun f => f (f 1) : (Nat → Nat) → Nat) (fun n => succ n)', note: 'bidirectional: the argument fun n => … is checked against Nat → Nat' },
  { src: '(2 : (fun T => T : Type → Type) Nat)', note: 'a type that computes: (fun T => T) Nat is Nat, by normalisation' },
  { src: '(Type : Type)', note: 'rejected: Type lives in Type 1 (try the first switch)' },
  { src: '(fun n => succ n : Nat → Nat) Type', note: 'rejected: the argument is not a number (try the second switch)' },
  { src: '(Nat : Nat)', note: 'rejected: Nat is a type, not a number (try the third switch)' },
];

/** the course code checking the same term with the chapter's checker (and the mirror's verdict, as a theorem) */
export function kernelCertificate(src: string): string {
  const t = parse(src);
  const n = tc([], [], t, undefined);
  const verdict = n.result ? `some ${toCourse(n.result)}` : 'none';
  return `#eval tc [] ${toCourse(t)} none\n\nexample : tc [] ${toCourse(t)} none = ${verdict} := by decide`;
}
