// Universe levels, following Lean 4's kernel:
//   l ::= 0 | l+1 | max l l | imax l l | u (parameter) | ?u (metavariable)
// `imax a b` is 0 when b is 0 and `max a b` otherwise; it is what makes
// `Prop` impredicative: (x : A) → P lives in `Sort (imax u 0) = Prop`.

export type Level =
  | { readonly k: 'zero' }
  | { readonly k: 'succ'; readonly l: Level }
  | { readonly k: 'max'; readonly a: Level; readonly b: Level }
  | { readonly k: 'imax'; readonly a: Level; readonly b: Level }
  | { readonly k: 'param'; readonly name: string }
  | { readonly k: 'mvar'; readonly id: number };

export const lzero: Level = { k: 'zero' };
export const lone: Level = { k: 'succ', l: lzero };

export const lsucc = (l: Level): Level => ({ k: 'succ', l });
export const lparam = (name: string): Level => ({ k: 'param', name });
export const lmvar = (id: number): Level => ({ k: 'mvar', id });

export function lofNat(n: number): Level {
  let l = lzero;
  for (let i = 0; i < n; i++) l = lsucc(l);
  return l;
}

/** Smart constructor for max with the obvious simplifications. */
export function lmax(a: Level, b: Level): Level {
  if (a.k === 'zero') return b;
  if (b.k === 'zero') return a;
  if (levelStructEq(a, b)) return a;
  const na = toNat(a);
  const nb = toNat(b);
  if (na !== undefined && nb !== undefined) return na >= nb ? a : b;
  if (a.k === 'succ' && b.k === 'succ') {
    // max (a+1) (b+1) = (max a b) + 1
    return lsucc(lmax(a.l, b.l));
  }
  return { k: 'max', a, b };
}

/** Smart constructor for imax. */
export function limax(a: Level, b: Level): Level {
  if (isNeverZero(b)) return lmax(a, b);
  if (b.k === 'zero') return lzero;
  if (a.k === 'zero') return b;
  if (levelStructEq(a, b)) return a;
  return { k: 'imax', a, b };
}

export function toNat(l: Level): number | undefined {
  let n = 0;
  while (l.k === 'succ') {
    n++;
    l = l.l;
  }
  return l.k === 'zero' ? n : undefined;
}

/** Split `l` into base + offset (l = base + k). */
export function toOffset(l: Level): [Level, number] {
  let n = 0;
  while (l.k === 'succ') {
    n++;
    l = l.l;
  }
  return [l, n];
}

export function levelStructEq(a: Level, b: Level): boolean {
  if (a === b) return true;
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'zero':
      return true;
    case 'succ':
      return levelStructEq(a.l, (b as typeof a).l);
    case 'max':
    case 'imax':
      return levelStructEq(a.a, (b as typeof a).a) && levelStructEq(a.b, (b as typeof a).b);
    case 'param':
      return a.name === (b as typeof a).name;
    case 'mvar':
      return a.id === (b as typeof a).id;
  }
}

/** True when the level is > 0 for every assignment of parameters. */
export function isNeverZero(l: Level): boolean {
  switch (l.k) {
    case 'zero':
      return false;
    case 'succ':
      return true;
    case 'max':
      return isNeverZero(l.a) || isNeverZero(l.b);
    case 'imax':
      return isNeverZero(l.b);
    case 'param':
    case 'mvar':
      return false;
  }
}

export function hasLevelMVar(l: Level): boolean {
  switch (l.k) {
    case 'zero':
    case 'param':
      return false;
    case 'mvar':
      return true;
    case 'succ':
      return hasLevelMVar(l.l);
    case 'max':
    case 'imax':
      return hasLevelMVar(l.a) || hasLevelMVar(l.b);
  }
}

export function hasLevelParam(l: Level): boolean {
  switch (l.k) {
    case 'zero':
    case 'mvar':
      return false;
    case 'param':
      return true;
    case 'succ':
      return hasLevelParam(l.l);
    case 'max':
    case 'imax':
      return hasLevelParam(l.a) || hasLevelParam(l.b);
  }
}

export function collectParams(l: Level, out: Set<string>): Set<string> {
  switch (l.k) {
    case 'param':
      out.add(l.name);
      break;
    case 'succ':
      collectParams(l.l, out);
      break;
    case 'max':
    case 'imax':
      collectParams(l.a, out);
      collectParams(l.b, out);
      break;
  }
  return out;
}

export function replaceLevel(l: Level, f: (l: Level) => Level | undefined): Level {
  const r = f(l);
  if (r !== undefined) return r;
  switch (l.k) {
    case 'succ':
      return lsucc(replaceLevel(l.l, f));
    case 'max':
      return lmax(replaceLevel(l.a, f), replaceLevel(l.b, f));
    case 'imax':
      return limax(replaceLevel(l.a, f), replaceLevel(l.b, f));
    default:
      return l;
  }
}

export function instantiateLevelParams(l: Level, names: readonly string[], ls: readonly Level[]): Level {
  if (names.length === 0 || !hasLevelParam(l)) return l;
  return replaceLevel(l, (x) => {
    if (x.k === 'param') {
      const i = names.indexOf(x.name);
      return i >= 0 ? ls[i] : x;
    }
    return undefined;
  });
}

// ---------------------------------------------------------------------------
// Semantic comparison.
//
// A level without metavariables denotes a function from parameter valuations
// to ℕ. We decide `a = b` and `a ≥ b` for all valuations by case-splitting each
// parameter into "= 0" or "≥ 1". Under a fixed split every `imax` is decided,
// and the remaining expression is a maximum of terms `p + k` and constants,
// which has a canonical normal form.

interface NF {
  offsets: Map<string, number>; // param -> max offset
  constant: number; // -1 means absent
}

function nfOf(l: Level, zeroParams: Set<string>): NF {
  const nf: NF = { offsets: new Map(), constant: -1 };
  const go = (l: Level, k: number): void => {
    switch (l.k) {
      case 'zero':
        nf.constant = Math.max(nf.constant, k);
        return;
      case 'succ':
        go(l.l, k + 1);
        return;
      case 'max':
        go(l.a, k);
        go(l.b, k);
        return;
      case 'imax': {
        if (isZeroUnder(l.b, zeroParams)) {
          nf.constant = Math.max(nf.constant, k);
        } else {
          go(l.a, k);
          go(l.b, k);
        }
        return;
      }
      case 'param':
        if (zeroParams.has(l.name)) nf.constant = Math.max(nf.constant, k);
        else nf.offsets.set(l.name, Math.max(nf.offsets.get(l.name) ?? -1, k));
        return;
      case 'mvar':
        // treat unknown metavariables as opaque positive parameters
        nf.offsets.set('?' + l.id, Math.max(nf.offsets.get('?' + l.id) ?? -1, k));
        return;
    }
  };
  go(l, 0);
  // a constant is redundant when some parameter term already dominates it
  // (all remaining parameters are ≥ 1)
  let minFromParams = -1;
  for (const k of nf.offsets.values()) minFromParams = Math.max(minFromParams, k + 1);
  if (nf.constant <= minFromParams) nf.constant = nf.offsets.size > 0 ? -1 : Math.max(nf.constant, 0);
  if (nf.offsets.size === 0 && nf.constant < 0) nf.constant = 0;
  return nf;
}

function isZeroUnder(l: Level, zeroParams: Set<string>): boolean {
  switch (l.k) {
    case 'zero':
      return true;
    case 'succ':
      return false;
    case 'max':
      return isZeroUnder(l.a, zeroParams) && isZeroUnder(l.b, zeroParams);
    case 'imax':
      return isZeroUnder(l.b, zeroParams);
    case 'param':
      return zeroParams.has(l.name);
    case 'mvar':
      return false;
  }
}

function forAllSplits(params: string[], f: (zero: Set<string>) => boolean): boolean {
  const n = params.length;
  if (n > 12) return false; // give up rather than explode
  for (let mask = 0; mask < 1 << n; mask++) {
    const zero = new Set<string>();
    for (let i = 0; i < n; i++) if (mask & (1 << i)) zero.add(params[i]);
    if (!f(zero)) return false;
  }
  return true;
}

function nfEq(a: NF, b: NF): boolean {
  if (a.constant !== b.constant) return false;
  if (a.offsets.size !== b.offsets.size) return false;
  for (const [p, k] of a.offsets) if (b.offsets.get(p) !== k) return false;
  return true;
}

function nfGeq(a: NF, b: NF): boolean {
  for (const [p, k] of b.offsets) {
    const ka = a.offsets.get(p);
    if (ka === undefined || ka < k) return false;
  }
  if (b.constant >= 0) {
    let minA = a.constant;
    for (const k of a.offsets.values()) minA = Math.max(minA, k + 1);
    if (minA < b.constant) return false;
  }
  return true;
}

export function levelEq(a: Level, b: Level): boolean {
  if (levelStructEq(a, b)) return true;
  const ps = [...collectParams(b, collectParams(a, new Set()))];
  return forAllSplits(ps, (z) => nfEq(nfOf(a, z), nfOf(b, z)));
}

export function levelGeq(a: Level, b: Level): boolean {
  const ps = [...collectParams(b, collectParams(a, new Set()))];
  return forAllSplits(ps, (z) => nfGeq(nfOf(a, z), nfOf(b, z)));
}

/** Canonical-ish simplification used for display. */
export function simplifyLevel(l: Level): Level {
  switch (l.k) {
    case 'succ':
      return lsucc(simplifyLevel(l.l));
    case 'max':
      return lmax(simplifyLevel(l.a), simplifyLevel(l.b));
    case 'imax':
      return limax(simplifyLevel(l.a), simplifyLevel(l.b));
    default:
      return l;
  }
}

export function levelToString(l: Level, mvarName?: (id: number) => string): string {
  const [base, off] = toOffset(l);
  if (base.k === 'zero') return String(off);
  const atom = (l: Level): string => {
    const s = levelToString(l, mvarName);
    return /\s|\+/.test(s) ? `(${s})` : s;
  };
  let s: string;
  switch (base.k) {
    case 'param':
      s = base.name;
      break;
    case 'mvar':
      s = mvarName ? mvarName(base.id) : `?u${base.id}`;
      break;
    case 'max':
      s = `max ${atom(base.a)} ${atom(base.b)}`;
      break;
    case 'imax':
      s = `imax ${atom(base.a)} ${atom(base.b)}`;
      break;
    default:
      s = '?';
  }
  if (off === 0) return s;
  return base.k === 'max' || base.k === 'imax' ? `(${s})+${off}` : `${s}+${off}`;
}
