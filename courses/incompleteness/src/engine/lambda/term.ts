// Terms of the pure (untyped) lambda calculus, as typed trees with stable node identities.
//
// The book (chapter "Introduction to the Lambda Calculus", section "The Syntax of the Lambda
// Calculus") defines: every variable is a term; if M and N are terms, so is (MN); if M is a term
// and x a variable, (λx.M) is a term. We work in the *pure* calculus: no constants.
//
// Every node carries an `id`. Operations that build new trees (substitution, β-contraction,
// α-renaming) share unchanged subtrees with their input — and so keep their ids — give fresh ids
// to genuinely new nodes (copies of the argument of a redex), and let a rebuilt ancestor keep the
// id of the node it replaces. A UI can use the ids to link an occurrence in one term to the same
// occurrence in the next.
//
// A node may carry a `label` ("K", "Y", "2̄", "Succ", …): the name of a combinator or Church
// numeral it *is*. Printers can collapse a labelled node to its label. Operations drop the label
// of any node whose subterm they change (so a label is never wrong).

export type NodeId = string;

let counter = 0;
/** A fresh node id. Ids are unique within a session; tests may reset the counter. */
export function freshId(prefix = 'l'): NodeId {
  return `${prefix}${++counter}`;
}
export function resetLambdaIds() {
  counter = 0;
}

/** A variable occurrence. */
export interface Var {
  k: 'var';
  id: NodeId;
  name: string;
  label?: string;
}

/** An application (M N). */
export interface App {
  k: 'app';
  id: NodeId;
  fn: Term;
  arg: Term;
  label?: string;
}

/** An abstraction (λx.M). The node itself is the binder of `param`. */
export interface Abs {
  k: 'abs';
  id: NodeId;
  param: string;
  body: Term;
  label?: string;
}

export type Term = Var | App | Abs;

/** A position in a term: 0 = function part / body, 1 = argument part. */
export type Path = number[];

// ------------------------------------------------------------------ constructors

export const variable = (name: string): Var => ({ k: 'var', id: freshId(), name });
export const app = (fn: Term, arg: Term): App => ({ k: 'app', id: freshId(), fn, arg });
export const lam = (param: string, body: Term): Abs => ({ k: 'abs', id: freshId(), param, body });

/** M N₁ … Nₖ, associating to the left as the book's conventions do. */
export function apps(fn: Term, ...args: Term[]): Term {
  return args.reduce<Term>((f, a) => app(f, a), fn);
}

/** λx₁ … xₖ.M, short for λx₁.λx₂.…λxₖ.M. */
export function lams(params: string[], body: Term): Term {
  return params.reduceRight<Term>((b, p) => lam(p, b), body);
}

/** The same node with a display label (a new object with the same id). */
export function withLabel<T extends Term>(t: T, label: string | undefined): T {
  if (label === undefined) {
    if (t.label === undefined) return t;
    const copy = { ...t };
    delete copy.label;
    return copy;
  }
  return { ...t, label };
}

/** Removes every label in the term (keeps ids). */
export function stripLabels(t: Term): Term {
  const bare = withLabel(t, undefined);
  switch (bare.k) {
    case 'var':
      return bare;
    case 'app':
      return { ...bare, fn: stripLabels(bare.fn), arg: stripLabels(bare.arg) };
    case 'abs':
      return { ...bare, body: stripLabels(bare.body) };
  }
}

// ------------------------------------------------------------------ traversal

export function children(t: Term): Term[] {
  switch (t.k) {
    case 'var':
      return [];
    case 'app':
      return [t.fn, t.arg];
    case 'abs':
      return [t.body];
  }
}

/** Visits every node in pre-order (outer before inner, left before right). */
export function walk(t: Term, f: (node: Term, parent: Term | null, path: Path) => void, parent: Term | null = null, path: Path = []) {
  f(t, parent, path);
  children(t).forEach((ch, i) => walk(ch, f, t, [...path, i]));
}

export function atPath(t: Term, path: Path): Term | null {
  let cur: Term = t;
  for (const i of path) {
    const ch = children(cur)[i];
    if (!ch) return null;
    cur = ch;
  }
  return cur;
}

export function pathOf(root: Term, id: NodeId): Path | null {
  let found: Path | null = null;
  walk(root, (n, _p, path) => {
    if (found === null && n.id === id) found = path;
  });
  return found;
}

export function nodeById(root: Term, id: NodeId): Term | null {
  const p = pathOf(root, id);
  return p === null ? null : atPath(root, p);
}

/**
 * Replaces the subterm at `path` by `sub`. Ancestors are rebuilt with their ids kept and their
 * labels dropped (their subterm changed).
 */
export function replaceAt(t: Term, path: Path, sub: Term): Term {
  const go = (s: Term, i: number): Term => {
    if (i === path.length) return sub;
    const bare = withLabel(s, undefined);
    switch (bare.k) {
      case 'var':
        throw new Error('replaceAt: path leads below a variable');
      case 'app':
        return path[i] === 0 ? { ...bare, fn: go(bare.fn, i + 1) } : { ...bare, arg: go(bare.arg, i + 1) };
      case 'abs':
        return { ...bare, body: go(bare.body, i + 1) };
    }
  };
  return go(t, 0);
}

/** Number of nodes. */
export function size(t: Term): number {
  let n = 0;
  const stack: Term[] = [t];
  while (stack.length) {
    const s = stack.pop()!;
    n++;
    if (s.k === 'app') stack.push(s.fn, s.arg);
    else if (s.k === 'abs') stack.push(s.body);
  }
  return n;
}

/** A structural copy with fresh ids (labels kept); `origin` maps each new id to the id it copies. */
export function cloneFresh(t: Term, origin?: Map<NodeId, NodeId>): Term {
  const id = freshId();
  origin?.set(id, t.id);
  let copy: Term;
  switch (t.k) {
    case 'var':
      copy = { ...t, id };
      break;
    case 'app':
      copy = { ...t, id, fn: cloneFresh(t.fn, origin), arg: cloneFresh(t.arg, origin) };
      break;
    case 'abs':
      copy = { ...t, id, body: cloneFresh(t.body, origin) };
      break;
  }
  // A copy has the same free variables: reuse the cached set, if any.
  const fv = fvCache.get(t);
  if (fv) fvCache.set(copy, fv);
  return copy;
}

// ------------------------------------------------------------------ variables

const fvCache = new WeakMap<Term, ReadonlySet<string>>();

/** FV(M): the variables with a free occurrence in M. (Cached per node object; terms are immutable.) */
export function freeVars(t: Term): ReadonlySet<string> {
  const hit = fvCache.get(t);
  if (hit) return hit;
  let s: Set<string>;
  switch (t.k) {
    case 'var':
      s = new Set([t.name]);
      break;
    case 'app': {
      const a = freeVars(t.fn);
      const b = freeVars(t.arg);
      s = new Set(a);
      for (const x of b) s.add(x);
      break;
    }
    case 'abs': {
      const b = freeVars(t.body);
      if (!b.has(t.param)) {
        fvCache.set(t, b);
        return b;
      }
      s = new Set(b);
      s.delete(t.param);
      break;
    }
  }
  fvCache.set(t, s);
  return s;
}

export function isFree(x: string, t: Term): boolean {
  return freeVars(t).has(x);
}

export function isClosed(t: Term): boolean {
  return freeVars(t).size === 0;
}

/** Every variable name occurring in M, free, bound or as a binder. */
export function allNames(t: Term): Set<string> {
  const s = new Set<string>();
  walk(t, (n) => {
    if (n.k === 'var') s.add(n.name);
    else if (n.k === 'abs') s.add(n.param);
  });
  return s;
}

/** The free occurrences of x in M, with the binders (outermost first) they sit under. */
export function freeOccurrences(t: Term, x: string): { node: NodeId; path: Path; scopes: { id: NodeId; param: string }[] }[] {
  const out: { node: NodeId; path: Path; scopes: { id: NodeId; param: string }[] }[] = [];
  const go = (s: Term, path: Path, scopes: { id: NodeId; param: string }[]) => {
    switch (s.k) {
      case 'var':
        if (s.name === x) out.push({ node: s.id, path, scopes });
        return;
      case 'app':
        go(s.fn, [...path, 0], scopes);
        go(s.arg, [...path, 1], scopes);
        return;
      case 'abs':
        if (s.param === x) return;
        go(s.body, [...path, 0], [...scopes, { id: s.id, param: s.param }]);
    }
  };
  go(t, [], []);
  return out;
}

/** The binder (abstraction node) of a variable occurrence, or null if the occurrence is free. */
export function binderOf(root: Term, occurrence: NodeId): Abs | null {
  const path = pathOf(root, occurrence);
  if (path === null) return null;
  const occ = atPath(root, path);
  if (!occ || occ.k !== 'var') return null;
  let binder: Abs | null = null;
  let cur: Term = root;
  for (const i of path) {
    if (cur.k === 'abs' && cur.param === occ.name) binder = cur;
    cur = children(cur)[i]!;
  }
  return binder;
}

/**
 * For every variable occurrence, the abstraction that binds it (null if the occurrence is free).
 * Keys and values are node ids.
 */
export function binderMap(t: Term): Map<NodeId, NodeId | null> {
  const out = new Map<NodeId, NodeId | null>();
  const env = new Map<string, NodeId[]>();
  const go = (s: Term) => {
    switch (s.k) {
      case 'var': {
        const st = env.get(s.name);
        out.set(s.id, st && st.length ? st[st.length - 1]! : null);
        return;
      }
      case 'app':
        go(s.fn);
        go(s.arg);
        return;
      case 'abs': {
        let st = env.get(s.param);
        if (!st) env.set(s.param, (st = []));
        st.push(s.id);
        go(s.body);
        st.pop();
      }
    }
  };
  go(t);
  return out;
}

export const VAR_NAME = /^[a-z][a-z0-9_']*$/;

/**
 * A variable name not in `avoid`: `name` itself if possible, else name′, name″, name‴, then
 * name_1, name_2, … (on the letters of `name`).
 */
export function freshName(name: string, avoid: Iterable<string>): string {
  const bad = avoid instanceof Set ? (avoid as Set<string>) : new Set(avoid);
  if (!bad.has(name)) return name;
  for (let k = 1; k <= 3; k++) {
    const c = name + "'".repeat(k);
    if (!bad.has(c)) return c;
  }
  const base = name.replace(/'+$/, '').replace(/_\d+$/, '');
  for (let i = 1; ; i++) {
    const c = `${base}_${i}`;
    if (!bad.has(c)) return c;
  }
}

// ------------------------------------------------------------------ α-equivalence

/**
 * M ≡α N: the terms differ only in the names of bound variables (section "The Syntax of the
 * Lambda Calculus": "Two terms that differ only in the names of the bound variables are called
 * α-equivalent").
 */
export function alphaEq(a: Term, b: Term): boolean {
  // Environments map a bound name to its binding depth; free variables compare by name.
  const go = (s: Term, t: Term, es: Map<string, number>, et: Map<string, number>, depth: number): boolean => {
    if (s.k !== t.k) return false;
    switch (s.k) {
      case 'var': {
        const tv = t as Var;
        const ds = es.get(s.name);
        const dt = et.get(tv.name);
        if (ds === undefined && dt === undefined) return s.name === tv.name;
        return ds === dt;
      }
      case 'app': {
        const ta = t as App;
        return go(s.fn, ta.fn, es, et, depth) && go(s.arg, ta.arg, es, et, depth);
      }
      case 'abs': {
        const tb = t as Abs;
        const es2 = new Map(es).set(s.param, depth);
        const et2 = new Map(et).set(tb.param, depth);
        return go(s.body, tb.body, es2, et2, depth + 1);
      }
    }
  };
  return go(a, b, new Map(), new Map(), 0);
}

/**
 * A string that is the same for two terms iff they are α-equivalent (de Bruijn indices for bound
 * variables, names for free ones). Useful as a hash key.
 */
export function alphaKey(t: Term): string {
  const parts: string[] = [];
  const go = (s: Term, env: string[]) => {
    switch (s.k) {
      case 'var': {
        const i = env.lastIndexOf(s.name);
        parts.push(i < 0 ? `"${s.name}` : `#${env.length - 1 - i}`);
        return;
      }
      case 'app':
        parts.push('@');
        go(s.fn, env);
        go(s.arg, env);
        return;
      case 'abs':
        parts.push('\\');
        go(s.body, [...env, s.param]);
    }
  };
  go(t, []);
  return parts.join(' ');
}

/** Syntactic identity (same names everywhere; ids and labels ignored). */
export function identical(a: Term, b: Term): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'var':
      return a.name === (b as Var).name;
    case 'app':
      return identical(a.fn, (b as App).fn) && identical(a.arg, (b as App).arg);
    case 'abs':
      return a.param === (b as Abs).param && identical(a.body, (b as Abs).body);
  }
}
