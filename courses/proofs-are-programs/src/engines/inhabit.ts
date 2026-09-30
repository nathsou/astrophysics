// Enumerating the programs of a simple type.
//
// Types are built from type variables (α, β, …), → and ×. We enumerate the
// terms in *long normal form* (β-normal, η-long): the canonical representatives
// of all programs of the type, since every well-typed term of the simply typed
// λ-calculus computes to exactly one of them. So the list shows, up to a size
// bound, every genuinely different program a type allows.

export type Ty = { k: 'var'; name: string } | { k: 'arrow'; a: Ty; b: Ty } | { k: 'prod'; a: Ty; b: Ty };

export type Tm =
  | { k: 'var'; name: string }
  | { k: 'lam'; name: string; body: Tm }
  | { k: 'app'; fn: Tm; arg: Tm }
  | { k: 'pair'; a: Tm; b: Tm }
  | { k: 'fst'; t: Tm }
  | { k: 'snd'; t: Tm };

// ---------------------------------------------------------------------------
// parsing types:  (α → α) → α → α,   α × β → β × α

export function parseTy(src: string): Ty {
  const toks = src.match(/[α-ωa-zA-Z][\w'₀-₉]*|→|->|×|\*|\(|\)/gu) ?? [];
  let i = 0;
  const peek = () => toks[i];
  const arrow = (): Ty => {
    const a = prod();
    if (peek() === '→' || peek() === '->') {
      i++;
      return { k: 'arrow', a, b: arrow() };
    }
    return a;
  };
  const prod = (): Ty => {
    const a = atom();
    if (peek() === '×' || peek() === '*') {
      i++;
      return { k: 'prod', a, b: prod() };
    }
    return a;
  };
  const atom = (): Ty => {
    const t = toks[i++];
    if (t === '(') {
      const r = arrow();
      if (toks[i++] !== ')') throw new Error('expected )');
      return r;
    }
    if (!t || !/^[α-ωa-zA-Z]/u.test(t)) throw new Error(`unexpected ${t ?? 'end of input'}`);
    return { k: 'var', name: t };
  };
  const r = arrow();
  if (i < toks.length) throw new Error(`unexpected ${toks[i]}`);
  return r;
}

export function showTy(t: Ty, prec = 0): string {
  switch (t.k) {
    case 'var':
      return t.name;
    case 'arrow': {
      const s = `${showTy(t.a, 1)} → ${showTy(t.b, 0)}`;
      return prec > 0 ? `(${s})` : s;
    }
    case 'prod': {
      const s = `${showTy(t.a, 2)} × ${showTy(t.b, 1)}`;
      return prec > 1 ? `(${s})` : s;
    }
  }
}

export function tyVars(t: Ty, out: string[] = []): string[] {
  if (t.k === 'var') {
    if (!out.includes(t.name)) out.push(t.name);
  } else {
    tyVars(t.a, out);
    tyVars(t.b, out);
  }
  return out;
}

const tyEq = (a: Ty, b: Ty): boolean => a.k === b.k && (a.k === 'var' ? a.name === (b as typeof a).name : tyEq(a.a, (b as typeof a).a) && tyEq(a.b, (b as typeof a).b));

// ---------------------------------------------------------------------------
// enumeration

interface Hyp {
  name: string;
  ty: Ty;
}

/** ways to use a hypothesis to reach an atomic type: apply it to arguments, project pairs */
interface Path {
  /** build the term from the argument terms */
  build: (args: Tm[]) => Tm;
  /** the argument types still to provide, in order */
  args: Ty[];
  target: Ty;
}

function paths(head: Tm, ty: Ty): Path[] {
  const out: Path[] = [{ build: () => head, args: [], target: ty }];
  if (ty.k === 'arrow') {
    for (const p of paths({ k: 'var', name: '•' }, ty.b)) {
      out.push({
        build: (args) => substHole(p.build(args.slice(1)), { k: 'app', fn: head, arg: args[0] }),
        args: [ty.a, ...p.args],
        target: p.target,
      });
    }
  } else if (ty.k === 'prod') {
    for (const [proj, sub] of [
      ['fst', ty.a],
      ['snd', ty.b],
    ] as const) {
      for (const p of paths({ k: 'var', name: '•' }, sub)) {
        out.push({ build: (args) => substHole(p.build(args), { k: proj, t: head }), args: p.args, target: p.target });
      }
    }
  }
  return out;
}

function substHole(t: Tm, by: Tm): Tm {
  switch (t.k) {
    case 'var':
      return t.name === '•' ? by : t;
    case 'app':
      return { k: 'app', fn: substHole(t.fn, by), arg: t.arg };
    case 'fst':
    case 'snd':
      return { k: t.k, t: substHole(t.t, by) };
    default:
      return t;
  }
}

export function size(t: Tm): number {
  switch (t.k) {
    case 'var':
      return 1;
    case 'lam':
      return 1 + size(t.body);
    case 'app':
      return size(t.fn) + size(t.arg);
    case 'pair':
      return 1 + size(t.a) + size(t.b);
    case 'fst':
    case 'snd':
      return 1 + size(t.t);
  }
}

const NAMES_FN = ['f', 'g', 'h', 'k'];
const NAMES_X = ['x', 'y', 'z', 'w', 'u', 'v'];

function freshName(ty: Ty, ctx: Hyp[]): string {
  const pool = ty.k === 'arrow' ? NAMES_FN : ty.k === 'prod' ? ['p', 'q', 'r'] : NAMES_X;
  for (const n of pool) if (!ctx.some((h) => h.name === n)) return n;
  for (let i = 1; ; i++) {
    const n = `${pool[0]}${i}`;
    if (!ctx.some((h) => h.name === n)) return n;
  }
}

/** all long normal forms of type `ty` in context `ctx` with size ≤ budget */
function* terms(ctx: Hyp[], ty: Ty, budget: number): Generator<Tm> {
  if (budget <= 0) return;
  if (ty.k === 'arrow') {
    const x = freshName(ty.a, ctx);
    for (const b of terms([...ctx, { name: x, ty: ty.a }], ty.b, budget - 1)) yield { k: 'lam', name: x, body: b };
    return;
  }
  if (ty.k === 'prod') {
    for (const a of terms(ctx, ty.a, budget - 1)) {
      for (const b of terms(ctx, ty.b, budget - 1 - size(a))) yield { k: 'pair', a, b };
    }
    return;
  }
  // an atom: use a hypothesis whose path ends in this atom
  for (let i = ctx.length - 1; i >= 0; i--) {
    const h = ctx[i];
    for (const p of paths({ k: 'var', name: h.name }, h.ty)) {
      if (!tyEq(p.target, ty)) continue;
      yield* argsFor(ctx, p, [], budget - baseSize(p));
    }
  }
}

function baseSize(p: Path): number {
  // size of the path with unit-size placeholder arguments, minus the placeholders
  const placeholders = p.args.map(() => ({ k: 'var', name: '□' }) as Tm);
  return size(p.build(placeholders)) - placeholders.length;
}

function* argsFor(ctx: Hyp[], p: Path, done: Tm[], budget: number): Generator<Tm> {
  if (done.length === p.args.length) {
    if (budget >= 0) yield p.build(done);
    return;
  }
  const remaining = p.args.length - done.length - 1;
  for (const a of terms(ctx, p.args[done.length], budget - remaining)) {
    yield* argsFor(ctx, p, [...done, a], budget - size(a));
  }
}

export interface Enumeration {
  terms: Tm[];
  /** true when the size bound cut the search (there may be more) */
  truncated: boolean;
  maxSize: number;
}

/** enumerate the programs of `ty`, smallest first, up to `limit` terms and size `maxSize` */
export function enumerate(ty: Ty, limit = 12, maxSize = 16): Enumeration {
  const found: Tm[] = [];
  const seen = new Set<string>();
  let truncated = false;
  outer: for (let s = 1; s <= maxSize; s++) {
    for (const t of terms([], ty, s)) {
      const k = showTm(t);
      if (seen.has(k)) continue;
      seen.add(k);
      found.push(t);
      if (found.length >= limit) {
        truncated = true;
        break outer;
      }
    }
  }
  // are there terms beyond the size bound?
  if (!truncated) {
    for (const t of terms([], ty, maxSize + 6)) {
      if (!seen.has(showTm(t))) {
        truncated = true;
        break;
      }
    }
  }
  found.sort((a, b) => size(a) - size(b));
  return { terms: found, truncated, maxSize };
}

// ---------------------------------------------------------------------------
// printing, in the course language

export function showTm(t: Tm): string {
  const go = (t: Tm, prec: number): string => {
    switch (t.k) {
      case 'var':
        return t.name;
      case 'lam': {
        const names: string[] = [];
        let b: Tm = t;
        while (b.k === 'lam') {
          names.push(b.name);
          b = b.body;
        }
        const s = `fun ${names.join(' ')} => ${go(b, 0)}`;
        return prec > 0 ? `(${s})` : s;
      }
      case 'app': {
        const s = `${go(t.fn, 1)} ${go(t.arg, 2)}`;
        return prec > 1 ? `(${s})` : s;
      }
      case 'pair':
        return `(${go(t.a, 0)}, ${go(t.b, 0)})`;
      case 'fst':
        return `${go(t.t, 2)}.1`;
      case 'snd':
        return `${go(t.t, 2)}.2`;
    }
  };
  return go(t, 0);
}

/** a declaration checking the term in the course language */
export function asDecl(ty: Ty, t: Tm, name = 'prog'): string {
  const vars = tyVars(ty);
  const binders = vars.length ? ` {${vars.join(' ')} : Type}` : '';
  const toLean = (x: Ty, prec = 0): string => {
    switch (x.k) {
      case 'var':
        return x.name;
      case 'arrow': {
        const s = `${toLean(x.a, 1)} → ${toLean(x.b, 0)}`;
        return prec > 0 ? `(${s})` : s;
      }
      case 'prod': {
        const s = `${toLean(x.a, 2)} × ${toLean(x.b, 1)}`;
        return prec > 1 ? `(${s})` : s;
      }
    }
  };
  return `def ${name}${binders} : ${toLean(ty)} :=\n  ${showTm(t)}`;
}
