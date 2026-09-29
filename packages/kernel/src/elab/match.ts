// Compiling pattern matching and structural recursion to eliminators.
//
// The kernel only knows recursors. Pattern matching is compiled into a case
// tree whose nodes are applications of `I.casesOn` (defined from `I.rec`);
// structural recursion is compiled by performing the first split on the
// decreasing argument with `I.rec` itself, so that every recursive call on a
// constructor field can be replaced by the corresponding induction hypothesis.
//
// This mirrors (a simplified version of) Lean's equation compiler; Lean uses
// the more general `brecOn` construction, which also allows recursive calls on
// deeper subterms.

import {
  type Expr,
  type FVar,
  exprEq,
  getAppArgs,
  getAppFn,
  hasFVar,
  headBeta,
  instantiate1,
  mkApps,
  mkConst,
  mkFVar,
  mkPi,
  abstractFVars,
  replaceExpr,
  liftLooseBVars,
  instantiateLevelParamsExpr,
} from '../core/expr.ts';
import { toNat } from '../core/level.ts';
import type { Decl, LocalDecl } from '../core/env.ts';
import { freshFVarId } from '../core/env.ts';
import type { SAlt, STerm, Span } from '../syntax/ast.ts';
import { type Elaborator, popLocal } from './elaborator.ts';
import { ElabError } from './errors.ts';

export class NonStructural extends ElabError {}

interface Row {
  pats: STerm[];
  binds: Map<string, Expr>;
  alt: SAlt;
  used: { v: boolean };
}

interface RecCtx {
  fn: FVar;
  name: string;
  nargs: number;
  /** position of the decreasing argument */
  j: number;
  /** positions that must be passed unchanged, with their values */
  fixed: Map<number, Expr>;
  /** positions passed to the induction hypothesis, in order */
  gen: number[];
}

interface State {
  cols: Expr[];
  rows: Row[];
  target: Expr;
  deps: FVar[];
  ih: Map<number, Expr>;
  exp: Map<number, Expr>;
  rec?: RecCtx;
  span: Span;
  path: string[];
  /** user variables replaced by index unification (visible under their old names) */
  renames?: Map<string, Expr>;
  /** for equation lemmas: the value of each argument of the function being defined, at this point of the case tree */
  argVals?: Map<number, Expr>;
}

/** a leaf of the case tree of a definition by equations, from which an equation lemma is built */
export interface EqnLeaf {
  lctx: import('../core/env.ts').LocalContext;
  /** values of the function's arguments (in order) */
  vals: Expr[];
  /** the right-hand side, with recursive calls still referring to `fn` */
  rhs: Expr;
  fn?: FVar;
}

type PatClass =
  | { k: 'wild' }
  | { k: 'var'; name: string; span: Span }
  | { k: 'ctor'; ctor: string; args: STerm[]; explicit: boolean; span: Span };

const hole = (span: Span): STerm => ({ k: 'hole', span });

function replaceFVars(e: Expr, m: Map<number, Expr>): Expr {
  if (m.size === 0 || !e.fv) return e;
  return replaceExpr(e, (x) => {
    if (!x.fv) return x;
    if (x.k === 'fvar') return m.get(x.id) ?? x;
    return undefined;
  });
}

function inaccessible(name: string): string {
  if (name.endsWith('✝')) return name;
  return (name === '_' ? 'x' : name) + '✝';
}

// ---------------------------------------------------------------------------
// pattern classification

function classify(el: Elaborator, p: STerm, colType: Expr): PatClass {
  const env = el.env;
  const t = el.whnf(el.instantiate(colType));
  const h = getAppFn(t);
  const I = h.k === 'const' ? h.name : undefined;
  const ind = I ? env.get(I) : undefined;
  const isCtorOf = (n: string | undefined): n is string => {
    if (!n) return false;
    const d = env.get(n);
    return d?.kind === 'ctor' && (!I || d.induct === I);
  };
  const resolveCtor = (name: string, span: Span): string | undefined => {
    const g = el.resolveGlobal(name);
    if (isCtorOf(g)) return g;
    if (I && isCtorOf(`${I}.${name}`)) return `${I}.${name}`;
    if (g && env.get(g)?.kind === 'ctor') el.err(span, `constructor '${g}' does not construct a value of type `, el.term(t));
    return undefined;
  };
  switch (p.k) {
    case 'hole':
      return { k: 'wild' };
    case 'paren':
    case 'ascribe':
      return classify(el, p.k === 'paren' ? p.term : p.term, colType);
    case 'ident': {
      if (p.name === 'rfl' && I === 'Eq') return { k: 'ctor', ctor: 'Eq.refl', args: [], explicit: false, span: p.span };
      const c = resolveCtor(p.name, p.span);
      if (c) return { k: 'ctor', ctor: c, args: [], explicit: p.explicit, span: p.span };
      if (p.name.includes('.')) el.err(p.span, `invalid pattern: unknown constructor '${p.name}'`);
      return { k: 'var', name: p.name, span: p.span };
    }
    case 'dotIdent': {
      if (!I || !isCtorOf(`${I}.${p.name}`)) el.err(p.span, `invalid pattern: '.${p.name}' is not a constructor of `, el.term(t));
      return { k: 'ctor', ctor: `${I}.${p.name}`, args: [], explicit: false, span: p.span };
    }
    case 'num': {
      if (I !== 'Nat') el.err(p.span, 'numeric patterns can only match natural numbers');
      if (p.value === 0) return { k: 'ctor', ctor: 'Nat.zero', args: [], explicit: false, span: p.span };
      return { k: 'ctor', ctor: 'Nat.succ', args: [{ k: 'num', value: p.value - 1, span: p.span }], explicit: false, span: p.span };
    }
    case 'anon': {
      if (!ind || ind.kind !== 'inductive' || ind.ctors.length !== 1) el.err(p.span, 'invalid ⟨…⟩ pattern: the type is not an inductive type with one constructor');
      return { k: 'ctor', ctor: ind.ctors[0], args: p.args, explicit: false, span: p.span };
    }
    case 'app': {
      if (p.args.some((a) => a.named)) el.err(p.span, 'named arguments are not supported in patterns');
      const fn = p.fn;
      // n + k  ⟶  Nat.succ^k n
      if (fn.k === 'ident' && el.resolveGlobal(fn.name) === 'Nat.add' && p.args.length === 2 && p.args[1].arg.k === 'num') {
        const k = (p.args[1].arg as { value: number }).value;
        if (k === 0) return classify(el, p.args[0].arg, colType);
        const inner: STerm = k === 1 ? p.args[0].arg : { ...p, args: [p.args[0], { arg: { k: 'num', value: k - 1, span: p.args[1].arg.span } }] };
        return { k: 'ctor', ctor: 'Nat.succ', args: [inner], explicit: false, span: p.span };
      }
      let c: string | undefined;
      let explicit = false;
      if (fn.k === 'ident') {
        c = resolveCtor(fn.name, fn.span);
        explicit = fn.explicit;
      } else if (fn.k === 'dotIdent') {
        c = I && isCtorOf(`${I}.${fn.name}`) ? `${I}.${fn.name}` : undefined;
      }
      if (!c) el.err(fn.span, 'invalid pattern: expected a constructor applied to patterns');
      return { k: 'ctor', ctor: c, args: p.args.map((a) => a.arg), explicit, span: p.span };
    }
    default:
      el.err(p.span, 'invalid pattern');
  }
}

/** align constructor-pattern arguments to the constructor's fields */
function alignFields(el: Elaborator, cls: Extract<PatClass, { k: 'ctor' }>, ctor: Extract<Decl, { kind: 'ctor' }>): STerm[] {
  const binfos: string[] = [];
  let t = ctor.type;
  let i = 0;
  while (t.k === 'pi') {
    if (i >= ctor.numParams) binfos.push(t.binfo);
    t = t.body;
    i++;
  }
  if (cls.explicit) {
    if (cls.args.length !== binfos.length) el.err(cls.span, `constructor '${ctor.name}' has ${binfos.length} fields, but the pattern has ${cls.args.length}`);
    return cls.args;
  }
  const nExplicit = binfos.filter((b) => b === 'default').length;
  let args = cls.args;
  if (args.length !== nExplicit) {
    // ⟨a, b, c⟩ for a two-field structure nests to the right
    if (args.length > nExplicit && nExplicit >= 1 && cls.args === cls.args) {
      const last = args.length === nExplicit ? [] : [{ k: 'anon', args: args.slice(nExplicit - 1), span: cls.span } as STerm];
      args = [...args.slice(0, nExplicit - 1), ...last];
    }
    if (args.length !== nExplicit) el.err(cls.span, `constructor '${ctor.name}' expects ${nExplicit} explicit argument(s) in a pattern, but ${cls.args.length} were given`);
  }
  const out: STerm[] = [];
  let k = 0;
  for (const b of binfos) out.push(b === 'default' ? args[k++] : hole(cls.span));
  return out;
}

// ---------------------------------------------------------------------------
// the case-tree compiler

function compile(el: Elaborator, st: State): Expr {
  st = expandStatic(el, st);
  if (st.rows.length === 0) {
    // no alternatives left: fine if every remaining case is impossible
    for (let i = 0; i < st.cols.length; i++) {
      const c = el.instantiate(st.cols[i]);
      if (c.k !== 'fvar') continue;
      const t = el.whnf(el.inferType(c));
      const h = getAppFn(t);
      const d = h.k === 'const' ? el.env.get(h.name) : undefined;
      if (!d || d.kind !== 'inductive') continue;
      const idx = getAppArgs(t).slice(d.numParams);
      const nonVar = idx.some((x, k) => x.k !== 'fvar' || idx.findIndex((y) => exprEq(x, y)) !== k);
      if (d.ctors.length === 0 || nonVar) return split(el, st, i, 'casesOn');
    }
    el.err(st.span, `non-exhaustive pattern match: missing case${st.path.length ? ' where ' + st.path.join(', ') : ''}`);
  }
  const row0 = st.rows[0];
  const colTypes = st.cols.map((c) => el.inferType(c));
  let splitCol = -1;
  for (let i = 0; i < st.cols.length; i++) {
    const c = classify(el, row0.pats[i], colTypes[i]);
    if (c.k === 'ctor') {
      splitCol = i;
      break;
    }
  }
  if (splitCol < 0) return leaf(el, st, row0, colTypes);
  return split(el, st, splitCol, 'casesOn');
}

/** columns whose value is a constructor application are matched statically */
function expandStatic(el: Elaborator, st: State): State {
  for (let i = 0; i < st.cols.length; i++) {
    const v = el.instantiate(st.cols[i]);
    if (v.k === 'fvar') continue;
    const w = el.whnf(v);
    const h = getAppFn(w);
    const d = h.k === 'const' ? el.env.get(h.name) : undefined;
    if (!d || d.kind !== 'ctor') continue;
    const args = getAppArgs(w);
    if (args.length !== d.numParams + d.numFields) continue;
    const fields = args.slice(d.numParams);
    const vt = el.inferType(v);
    const rows: Row[] = [];
    for (const r of st.rows) {
      const c = classify(el, r.pats[i], vt);
      const before = r.pats.slice(0, i);
      const after = r.pats.slice(i + 1);
      if (c.k === 'wild' || c.k === 'var') {
        const binds = new Map(r.binds);
        if (c.k === 'var') bindVar(el, binds, c.name, v, c.span);
        rows.push({ ...r, binds, pats: [...before, ...fields.map(() => hole(r.alt.span)), ...after] });
      } else if (c.ctor === (h as { name: string }).name) {
        rows.push({ ...r, pats: [...before, ...alignFields(el, c, d), ...after] });
      }
    }
    return expandStatic(el, { ...st, rows, cols: [...st.cols.slice(0, i), ...fields, ...st.cols.slice(i + 1)] });
  }
  return st;
}

function bindVar(el: Elaborator, binds: Map<string, Expr>, name: string, v: Expr, span: Span): void {
  if (binds.has(name)) el.err(span, `variable '${name}' occurs more than once in the pattern`);
  binds.set(name, v);
}

function leaf(el: Elaborator, st: State, row: Row, colTypes: Expr[]): Expr {
  row.used.v = true;
  const binds = new Map(row.binds);
  st.cols.forEach((c, i) => {
    const cl = classify(el, row.pats[i], colTypes[i]);
    if (cl.k === 'var') {
      bindVar(el, binds, cl.name, c, cl.span);
      el.record(cl.span, c, 'binder');
    }
  });
  return el.withSavedLctx(() => {
    for (const [n, v] of st.renames ?? []) el.aliases.set(n, el.instantiate(v));
    for (const [n, v] of binds) el.aliases.set(n, el.instantiate(v));
    let rhs = el.elab(row.alt.rhs, st.target);
    if (st.rec) {
      el.synthesizePending(false);
      // tactic blocks see the recursive function in their context: run those that are ready now
      el.runTacticBlocks(false);
    }
    if (st.argVals && el.eqnLeaves) {
      el.synthesizePending(false);
      el.eqnLeaves.push({ lctx: el.lctx, vals: [...st.argVals.values()], rhs: el.instantiate(rhs), fn: st.rec?.fn ?? el.wfFn });
    }
    if (st.rec) rhs = replaceRecCalls(el, el.instantiate(rhs), st, row.alt.rhs.span);
    else if (el.leafHook) rhs = el.leafHook(el.instantiate(rhs));
    return rhs;
  });
}

function split(el: Elaborator, st: State, i: number, elim: 'casesOn' | 'rec', revertOverride?: FVar[]): Expr {
  const v = el.instantiate(st.cols[i]);
  if (v.k !== 'fvar') el.err(st.span, 'cannot pattern match on this term: dependent elimination requires a variable');
  const vType = el.whnf(el.inferType(v));
  const h = getAppFn(vType);
  const ind = h.k === 'const' ? el.env.get(h.name) : undefined;
  if (!ind || ind.kind !== 'inductive' || h.k !== 'const') {
    el.err(st.span, 'cannot pattern match on a value of type\n  ', el.term(vType), '\nwhich is not an inductive type');
  }
  const I = ind.name;
  const targs = getAppArgs(vType);
  const ps = targs.slice(0, ind.numParams);
  const is = targs.slice(ind.numParams);
  // indices that are not distinct variables are generalised, with equations
  let eqMode = false;
  for (const ix of is) {
    if (ix.k !== 'fvar' || ps.some((p) => hasFVar(p, ix.id)) || is.filter((y) => exprEq(y, ix)).length > 1) eqMode = true;
  }
  if (eqMode && elim === 'rec') {
    el.err(st.span, 'structural recursion on an inductive family whose indices are not distinct variables is not supported by this elaborator');
  }
  const isIds = new Set(eqMode ? [] : is.map((x) => (x as FVar).id));

  // hypotheses to revert: they mention the variable or its indices
  let reverted: FVar[];
  if (revertOverride) reverted = [...revertOverride, ...st.deps.filter((d) => dependsOn(el, d, v.id, isIds))];
  else {
    const cands: FVar[] = [...st.deps];
    st.cols.forEach((c, k) => {
      const ci = el.instantiate(c);
      if (k !== i && ci.k === 'fvar' && !isIds.has(ci.id) && !cands.some((x) => x.id === ci.id)) cands.push(ci as FVar);
    });
    const order = (f: FVar) => el.lctx.decls.findIndex((d) => d.id === f.id);
    cands.sort((a, b) => order(a) - order(b));
    reverted = [];
    const revIds = new Set<number>([v.id, ...isIds]);
    for (const c of cands) {
      const ty = el.instantiate(el.lctx.get(c.id)!.type);
      if ([...revIds].some((id) => hasFVar(ty, id))) {
        reverted.push(c);
        revIds.add(c.id);
      }
    }
  }
  const revIdList = reverted.map((r) => r.id);

  // motive: λ is' y, Π reverted', target
  const motive = el.withSavedLctx(() => {
    const idxLocals: FVar[] = [];
    let it = el.whnf(el.inferType(mkApps(mkConst(I, h.levels), ps)));
    for (let k = 0; k < is.length; k++) {
      if (it.k !== 'pi') it = el.whnf(it);
      const pi = it as Extract<Expr, { k: 'pi' }>;
      const fv = el.pushLocal(pi.name, pi.type);
      idxLocals.push(fv);
      it = instantiate1(pi.body, fv);
    }
    const y = el.pushLocal(inaccessible(el.lctx.get(v.id)!.name), mkApps(mkConst(I, h.levels), [...ps, ...idxLocals]));
    const sigma = new Map<number, Expr>([[v.id, y]]);
    const eqLocals: FVar[] = [];
    if (eqMode) {
      if (hasFVar(el.instantiate(st.target), v.id) || reverted.some((r) => hasFVar(el.instantiate(el.lctx.get(r.id)!.type), v.id))) {
        el.err(st.span, 'dependent pattern matching: the result type depends on a value of an inductive family with non-variable indices, which would need heterogeneous equality (not supported by this elaborator)');
      }
      is.forEach((ix, k) => eqLocals.push(el.pushLocal(`h${k + 1}✝`, mkEq(el, idxLocals[k], ix))));
    } else is.forEach((ix, k) => sigma.set((ix as FVar).id, idxLocals[k]));
    const newRev: FVar[] = [];
    for (const r of reverted) {
      const d = el.lctx.get(r.id)!;
      const nr = el.pushLocal(d.name, replaceFVars(el.instantiate(d.type), sigma), d.binfo);
      sigma.set(r.id, nr);
      newRev.push(nr);
    }
    const body = el.mkBinding('pi', [...eqLocals, ...newRev], replaceFVars(el.instantiate(st.target), sigma));
    return el.mkBinding('lam', [...idxLocals, y], body);
  });

  // universe of the motive
  const motiveBodyType = el.withSavedLctx(() => {
    let mt = el.inferType(motive);
    let guard = 0;
    while (guard++ < 64) {
      mt = el.whnf(mt);
      if (mt.k !== 'pi') break;
      const fv = el.pushLocal(mt.name, mt.type);
      mt = instantiate1(mt.body, fv);
    }
    return mt;
  });
  if (motiveBodyType.k !== 'sort') el.err(st.span, 'internal error: motive is not a type family');
  const motiveLevel = el.instantiate(motiveBodyType).k === 'sort' ? (el.instantiate(motiveBodyType) as Extract<Expr, { k: 'sort' }>).level : motiveBodyType.level;
  if (ind.elimOnlyProp && toNat(motiveLevel) !== 0) {
    el.err(
      st.span,
      `cannot eliminate a proof into data: '${I}' is a proposition that may only be eliminated into Prop (subsingleton elimination does not apply), but the result type\n  `,
      el.term(st.target),
      `\nis not a proposition`,
    );
  }
  const elimName = `${I}.${elim}`;
  if (!el.env.has(elimName)) el.err(st.span, `'${elimName}' is not available (mutual inductive types only support structural recursion via their recursors)`);
  const levels = ind.elimOnlyProp ? h.levels : [motiveLevel, ...h.levels];
  const elimHead = mkApps(mkConst(elimName, levels), [...ps, motive]);
  let et = el.whnf(el.inferType(elimHead));

  // collect the minor premise types
  const minorTypes: Expr[] = [];
  if (elim === 'rec') {
    for (let k = 0; k < ind.ctors.length; k++) {
      et = el.whnf(et);
      const pi = et as Extract<Expr, { k: 'pi' }>;
      minorTypes.push(pi.type);
      et = instantiate1(pi.body, mkFVar(-1));
    }
  } else {
    for (const ix of is) et = instantiate1((el.whnf(et) as Extract<Expr, { k: 'pi' }>).body, ix);
    et = instantiate1((el.whnf(et) as Extract<Expr, { k: 'pi' }>).body, v);
    for (let k = 0; k < ind.ctors.length; k++) {
      et = el.whnf(et);
      const pi = et as Extract<Expr, { k: 'pi' }>;
      minorTypes.push(pi.type);
      et = instantiate1(pi.body, mkFVar(-1));
    }
  }

  const minors: Expr[] = [];
  ind.ctors.forEach((cname, k) => {
    const cd = el.env.get(cname) as Extract<Decl, { kind: 'ctor' }>;
    minors.push(
      el.withSavedLctx(() => {
        // open fields and induction hypotheses
        let mt = minorTypes[k];
        const opened: FVar[] = [];
        while (mt.k === 'pi') {
          const nm = opened.length < cd.numFields ? inaccessible(mt.name) : mt.name.replace(/_ih$/, '') + '_ih✝';
          const fv = el.pushLocal(nm, headBeta(mt.type), 'default');
          opened.push(fv);
          mt = instantiate1(mt.body, fv);
        }
        const fields = opened.slice(0, cd.numFields);
        const ihs = opened.slice(cd.numFields);
        const concl = headBeta(mt);
        const cargs = getAppArgs(mt);
        const cis = cargs.slice(0, is.length);
        const cval0 = cargs[is.length];
        const continueWith = (goal: Expr, extra: Map<number, Expr>): Expr => {
        const cval = replaceFVars(cval0, extra);
        // open reverted hypotheses
        let rest = goal;
        const newRev: FVar[] = [];
        for (const r of reverted) {
          rest = el.whnf(rest);
          const pi = rest as Extract<Expr, { k: 'pi' }>;
          const fv = el.pushLocal(el.lctx.get(r.id)!.name, pi.type, pi.binfo);
          newRev.push(fv);
          rest = instantiate1(pi.body, fv);
        }
        const sigma = new Map<number, Expr>(extra);
        const renames = new Map(st.renames ?? []);
        for (const [n, e] of renames) renames.set(n, replaceFVars(e, extra));
        for (const [id, t] of extra) {
          const nm = el.lctx.get(id)?.name;
          if (nm && !nm.endsWith('✝')) renames.set(nm, t);
        }
        sigma.set(v.id, cval);
        if (!eqMode) is.forEach((ix, q) => sigma.set((ix as FVar).id, cis[q]));
        reverted.forEach((r, q) => sigma.set(r.id, newRev[q]));

        // update induction-hypothesis bookkeeping
        const ih = new Map<number, Expr>();
        for (const [z, e] of st.ih) ih.set(z, replaceFVars(e, sigma));
        if (elim === 'rec') {
          let q = 0;
          fields.forEach((f) => {
            const ft = el.whnf(el.lctx.get(f.id)!.type);
            let tt: Expr = ft;
            while (tt.k === 'pi') tt = tt.body;
            const hh = getAppFn(tt);
            if (hh.k === 'const' && ind.all.includes(hh.name) && q < ihs.length) ih.set(f.id, ihs[q++]);
          });
        }
        const exp = new Map(st.exp);
        for (const [z, e] of exp) exp.set(z, replaceFVars(e, sigma));
        exp.set(v.id, cval);

        const newCols = [...st.cols.slice(0, i), ...fields, ...st.cols.slice(i + 1)].map((c) => replaceFVars(el.instantiate(c), sigma));
        const rows: Row[] = [];
        for (const r of st.rows) {
          const c = classify(el, r.pats[i], vType);
          const binds = new Map<string, Expr>();
          for (const [n, e] of r.binds) binds.set(n, replaceFVars(el.instantiate(e), sigma));
          const before = r.pats.slice(0, i);
          const after = r.pats.slice(i + 1);
          if (c.k === 'wild') rows.push({ ...r, binds, pats: [...before, ...fields.map(() => hole(r.alt.span)), ...after] });
          else if (c.k === 'var') {
            bindVar(el, binds, c.name, cval, c.span);
            rows.push({ ...r, binds, pats: [...before, ...fields.map(() => hole(r.alt.span)), ...after] });
          } else if (c.ctor === cname) {
            rows.push({ ...r, binds, pats: [...before, ...alignFields(el, c, cd), ...after] });
          }
        }
        const deps = [
          ...st.deps.map((d) => (revIdList.includes(d.id) ? newRev[revIdList.indexOf(d.id)] : d)),
          ...ihs,
        ];
        const argVals = st.argVals ? new Map([...st.argVals].map(([k, x]) => [k, replaceFVars(el.instantiate(x), sigma)])) : undefined;
        const vname = el.lctx.get(v.id)?.name?.replace(/✝$/, '') ?? 'x';
        const body = compile(el, {
          ...st,
          cols: newCols,
          rows,
          target: rest,
          deps,
          ih,
          exp,
          path: [...st.path, `${vname} = ${cname}${cd.numFields ? ' …' : ''}`],
          renames,
          argVals,
        });
        return el.mkBinding('lam', newRev, body);
        };
        const inner = eqMode ? solveEqs(el, concl, is.length, new Set(fields.map((f) => f.id)), new Map(), continueWith, st.span) : continueWith(concl, new Map());
        return el.mkBinding('lam', [...fields, ...ihs], inner);
      }),
    );
  });

  if (elim === 'rec') return mkApps(elimHead, [...minors, ...is, v, ...reverted]);
  const refls = eqMode ? is.map((ix) => mkEqRefl(el, ix)) : [];
  return mkApps(elimHead, [...is, v, ...minors, ...refls, ...reverted]);
}

// ---------------------------------------------------------------------------
// index unification for dependent pattern matching

function sortLevel(el: Elaborator, t: Expr): import('../core/level.ts').Level {
  const s = el.whnf(el.inferType(t));
  if (s.k !== 'sort') throw new Error('expected a type');
  return el.mctx.instantiateLevel(s.level);
}

function mkEq(el: Elaborator, a: Expr, b: Expr): Expr {
  const T = el.instantiate(el.inferType(a));
  return mkApps(mkConst('Eq', [sortLevel(el, T)]), [T, a, b]);
}

function mkEqRefl(el: Elaborator, a: Expr): Expr {
  const T = el.instantiate(el.inferType(a));
  return mkApps(mkConst('Eq.refl', [sortLevel(el, T)]), [T, a]);
}

/** Eq.rec {T} {a} {motive} (m : motive a rfl) {b} (h : a = b) : motive b h */
function mkEqRec(el: Elaborator, T: Expr, a: Expr, motive: Expr, m: Expr, b: Expr, h: Expr, resultType: Expr): Expr {
  return mkApps(mkConst('Eq.rec', [sortLevel(el, resultType), sortLevel(el, T)]), [T, a, motive, m, b, h]);
}

/** a proof of b = a from h : a = b */
function mkEqSymm(el: Elaborator, T: Expr, a: Expr, b: Expr, h: Expr): Expr {
  const motive = el.withSavedLctx(() => {
    const x = el.pushLocal('x', T);
    const e = el.pushLocal('e', mkEq(el, a, x));
    return el.mkBinding('lam', [x, e], mkEq(el, x, a));
  });
  return mkEqRec(el, T, a, motive, mkEqRefl(el, a), b, h, mkEq(el, b, a));
}

function ctorApp(el: Elaborator, e: Expr): { name: string; ind: Extract<Decl, { kind: 'inductive' }>; params: Expr[]; fields: Expr[] } | undefined {
  const w = el.whnf(el.instantiate(e));
  const f = getAppFn(w);
  if (f.k !== 'const') return undefined;
  const cd = el.env.get(f.name);
  if (!cd || cd.kind !== 'ctor') return undefined;
  const args = getAppArgs(w);
  if (args.length !== cd.numParams + cd.numFields) return undefined;
  const ind = el.env.get(cd.induct) as Extract<Decl, { kind: 'inductive' }>;
  return { name: f.name, ind, params: args.slice(0, cd.numParams), fields: args.slice(cd.numParams) };
}

/**
 * noConfusionType P a b: for a = c xs, b = c ys it is (xs = ys → P) → P;
 * for different constructors it is P.
 */
function mkNoConfusionType(el: Elaborator, T: Expr, P: Expr, a: Expr, b: Expr, span: Span): Expr {
  const w = el.whnf(T);
  const h = getAppFn(w);
  const ind = h.k === 'const' ? el.env.get(h.name) : undefined;
  if (!ind || ind.kind !== 'inductive' || h.k !== 'const') el.err(span, 'cannot solve an index equation: not an inductive type');
  if (ind.numIndices > 0) el.err(span, 'cannot solve an index equation between elements of an indexed family');
  if (ind.elimOnlyProp) el.err(span, 'cannot solve an index equation between proofs');
  const params = getAppArgs(w);
  const u = sortLevel(el, P);
  const mkSortExpr = () => el.instantiate(el.inferType(P)); // = Sort u
  const motive = el.withSavedLctx(() => {
    const x = el.pushLocal('x', T);
    return el.mkBinding('lam', [x], mkSortExpr());
  });
  const casesOnConst = mkConst(`${ind.name}.casesOn`, [{ k: 'succ', l: u } as import('../core/level.ts').Level, ...h.levels]);
  const minorsFor = (inner: (cname: string, fields: FVar[]) => Expr) =>
    ind.ctors.map((cname) =>
      el.withSavedLctx(() => {
        const cd = el.env.get(cname) as Extract<Decl, { kind: 'ctor' }>;
        let ct = instantiateLevelParamsExpr(cd.type, cd.levelParams, h.levels);
        for (let k = 0; k < cd.numParams; k++) ct = instantiate1((el.whnf(ct) as Extract<Expr, { k: 'pi' }>).body, params[k]);
        const fields: FVar[] = [];
        for (let k = 0; k < cd.numFields; k++) {
          const pi = el.whnf(ct) as Extract<Expr, { k: 'pi' }>;
          const fv = el.pushLocal(inaccessible(pi.name), pi.type);
          fields.push(fv);
          ct = instantiate1(pi.body, fv);
        }
        return el.mkBinding('lam', fields, inner(cname, fields));
      }),
    );
  return mkApps(casesOnConst, [
    ...params,
    motive,
    a,
    ...minorsFor((ca, xs) =>
      mkApps(casesOnConst, [
        ...params,
        motive,
        b,
        ...minorsFor((cb, ys) => {
          if (ca !== cb) return P;
          // (x₁ = y₁ → … → P) → P
          for (let k = 0; k < xs.length; k++) {
            const tk = el.instantiate(el.lctx.get(ys[k].id)!.type);
            if (xs.slice(0, k).some((x) => hasFVar(tk, x.id)) || ys.slice(0, k).some((y) => hasFVar(tk, y.id))) {
              el.err(span, 'cannot solve an index equation: constructor fields with dependent types need heterogeneous equality');
            }
          }
          const k = el.withSavedLctx(() => {
            const hs = xs.map((x, q) => el.pushLocal(`e${q + 1}`, mkEq(el, x, ys[q])));
            return el.mkBinding('pi', hs, P);
          });
          return mkArrow(k, P);
        }),
      ]),
    ),
  ]);
}

function mkArrow(a: Expr, b: Expr): Expr {
  return mkPi('_', a, b.lb === 0 ? b : liftAll(b));
}

function liftAll(b: Expr): Expr {
  return liftLooseBVars(b, 0, 1);
}

/** noConfusion: from h : a = b, a proof of noConfusionType P a b */
export function mkNoConfusion(el: Elaborator, T: Expr, P: Expr, a: Expr, b: Expr, h: Expr, span: Span): Expr {
  const ca = ctorApp(el, a)!;
  // diagonal case: noConfusionType P a a ≡ (a.fields = a.fields → P) → P
  const diagType = el.whnf(mkNoConfusionType(el, T, P, a, a, span));
  const diag = el.withSavedLctx(() => {
    const k = el.pushLocal('k', (diagType as Extract<Expr, { k: 'pi' }>).type);
    return el.mkBinding('lam', [k], mkApps(k, ca.fields.map((f) => mkEqRefl(el, f))));
  });
  const motive = el.withSavedLctx(() => {
    const x = el.pushLocal('x', T);
    const e = el.pushLocal('e', mkEq(el, a, x));
    return el.mkBinding('lam', [x, e], mkNoConfusionType(el, T, P, a, x, span));
  });
  return mkEqRec(el, T, a, motive, diag, b, h, mkNoConfusionType(el, T, P, a, b, span));
}

/**
 * Build a term of type `goal` = Π (e₁ : l₁ = r₁) … (eₙ : lₙ = rₙ), Rest by
 * solving the equations (conflict, injection, substitution), then calling
 * `cont` with the remaining goal and the substitution performed.
 */
function solveEqs(
  el: Elaborator,
  goal: Expr,
  n: number,
  locals: Set<number>,
  sigma: Map<number, Expr>,
  cont: (goal: Expr, sigma: Map<number, Expr>) => Expr,
  span: Span,
): Expr {
  if (n === 0) return cont(goal, sigma);
  const w = el.whnf(goal) as Extract<Expr, { k: 'pi' }>;
  if (w.k !== 'pi') el.err(span, 'internal error: expected an equation');
  const eqT = el.whnf(w.type);
  const [T, l, r] = getAppArgs(eqT);
  return el.withSavedLctx(() => {
    const e = el.pushLocal('h✝', w.type);
    const rest = instantiate1(w.body, e);
    if (hasFVar(el.instantiate(rest), e.id)) el.err(span, 'cannot solve an index equation that the goal depends on');
    let body: Expr;
    const cl = ctorApp(el, l);
    const cr = ctorApp(el, r);
    if (el.isDefEq(l, r)) {
      body = solveEqs(el, rest, n - 1, locals, sigma, cont, span);
    } else if (cl && cr) {
      const nc = mkNoConfusion(el, T, rest, l, r, e, span);
      if (cl.name !== cr.name) body = nc; // conflict: the case is impossible
      else {
        // injection: new equations between the fields
        const inner = el.withSavedLctx(() => {
          const hs = cl.fields.map((x, q) => el.pushLocal(`e${q + 1}✝`, mkEq(el, x, cr.fields[q])));
          return el.mkBinding('pi', hs, rest);
        });
        body = mkApps(nc, [solveEqs(el, inner, cl.fields.length + n - 1, locals, sigma, cont, span)]);
      }
    } else {
      // substitution: a local variable on one side
      const lv = el.whnf(el.instantiate(l));
      const rv = el.whnf(el.instantiate(r));
      let x: FVar | undefined;
      let t: Expr | undefined;
      let flipped = false;
      // prefer eliminating variables introduced by this match, then any other variable
      if (lv.k === 'fvar' && locals.has(lv.id) && !hasFVar(rv, lv.id)) {
        x = lv as FVar;
        t = rv;
      } else if (rv.k === 'fvar' && locals.has(rv.id) && !hasFVar(lv, rv.id)) {
        x = rv as FVar;
        t = lv;
        flipped = true;
      } else if (lv.k === 'fvar' && !hasFVar(rv, lv.id) && !el.lctx.get(lv.id)?.value) {
        x = lv as FVar;
        t = rv;
      } else if (rv.k === 'fvar' && !hasFVar(lv, rv.id) && !el.lctx.get(rv.id)?.value) {
        x = rv as FVar;
        t = lv;
        flipped = true;
      }
      if (!x || !t) {
        el.err(span, 'cannot solve the index equation\n  ', el.term(l), ' = ', el.term(r), '\n(only constructor applications and pattern variables can be unified)');
      }
      // hypotheses depending on x must be reverted
      const order = el.lctx.decls.map((d) => d.id);
      const deps: FVar[] = [];
      const depIds = new Set<number>([x.id]);
      for (const id of order) {
        // every later hypothesis that mentions x (as Lean's `cases` does), not only this match's own locals
        if (id === e.id || id === x.id || order.indexOf(id) < order.indexOf(x.id) || el.lctx.get(id)!.value) continue;
        const ty = el.instantiate(el.lctx.get(id)!.type);
        if ([...depIds].some((d) => hasFVar(ty, d))) {
          deps.push(mkFVar(id) as FVar);
          depIds.add(id);
        }
      }
      const goal2 = el.mkBinding('pi', deps, rest); // Π deps, rest   (mentions x)
      // h : t = x
      const h = flipped ? e : mkEqSymm(el, T, x, t, e);
      const motive = el.withSavedLctx(() => {
        const y = el.pushLocal('y', T);
        const hh = el.pushLocal('h', mkEq(el, t!, y));
        return el.mkBinding('lam', [y, hh], replaceFVars(goal2, new Map([[x!.id, y]])));
      });
      const minor = el.withSavedLctx(() => {
        // Π deps[x := t], rest[x := t]
        let g = replaceFVars(goal2, new Map([[x!.id, t!]]));
        const newDeps: FVar[] = [];
        const sub = new Map<number, Expr>(sigma);
        sub.set(x!.id, t!);
        for (const d of deps) {
          const pi = el.whnf(g) as Extract<Expr, { k: 'pi' }>;
          const nd = el.pushLocal(el.lctx.get(d.id)!.name, pi.type);
          newDeps.push(nd);
          sub.set(d.id, nd);
          g = instantiate1(pi.body, nd);
        }
        const locals2 = new Set(locals);
        newDeps.forEach((d) => locals2.add(d.id));
        for (const [k, vv] of sub) sub.set(k, replaceFVars(vv, new Map([[x!.id, t!]])));
        return el.mkBinding('lam', newDeps, solveEqs(el, g, n - 1, locals2, sub, cont, span));
      });
      body = mkApps(mkEqRec(el, T, t, motive, minor, x, h, goal2), deps);
    }
    return el.mkBinding('lam', [e], body);
  });
}

function dependsOn(el: Elaborator, d: FVar, vid: number, isIds: Set<number>): boolean {
  const ty = el.instantiate(el.lctx.get(d.id)!.type);
  if (hasFVar(ty, vid)) return true;
  for (const id of isIds) if (hasFVar(ty, id)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// recursive calls

function expand(e: Expr, exp: Map<number, Expr>): Expr {
  let cur = e;
  for (let k = 0; k < 64; k++) {
    const next = replaceFVars(cur, exp);
    if (exprEq(next, cur)) return cur;
    cur = next;
  }
  return cur;
}

function replaceRecCalls(el: Elaborator, e: Expr, st: State, span: Span): Expr {
  const rec = st.rec!;
  const go = (e: Expr): Expr =>
    replaceExpr(e, (x) => {
      if (!x.fv) return x;
      const fn = getAppFn(x);
      if (fn.k !== 'fvar' || fn.id !== rec.fn.id) return undefined;
      const args = getAppArgs(x);
      // partial applications are fine as long as the decreasing argument and all
      // fixed arguments are given; the missing arguments are generalised ones
      const given = args.length;
      if (given <= rec.j || [...rec.fixed.keys()].some((k) => k >= given)) {
        throw new NonStructural([`the recursive function '${rec.name}' must be applied at least up to its decreasing argument (argument #${rec.j + 1})`], span);
      }
      for (const [k, val] of rec.fixed) {
        if (!exprEq(el.instantiate(args[k]), val) && !el.isDefEq(args[k], val)) {
          throw new NonStructural(
            [`argument #${k + 1} of the recursive call to '${rec.name}' must be passed unchanged (it is a fixed parameter), but got\n  `, el.term(args[k])],
            span,
          );
        }
      }
      const a = expand(el.instantiate(args[rec.j]), st.exp);
      let ih: Expr | undefined;
      for (const [z, h] of st.ih) {
        if (exprEq(expand(mkFVar(z), st.exp), a)) {
          ih = h;
          break;
        }
      }
      if (!ih) {
        throw new NonStructural(
          [
            `structural recursion failed: in the recursive call '`,
            el.term(mkApps(mkConst(rec.name), args)),
            `', argument #${rec.j + 1} is not smaller than the value being matched: it must be one of its constructor fields (like n in n + 1, or xs in x :: xs)`,
          ],
          span,
        );
      }
      const genArgs = rec.gen.filter((k) => k < given).map((k) => go(args[k]));
      const extra = args.slice(rec.nargs).map(go);
      return mkApps(ih, [...genArgs, ...extra]);
    });
  const r = go(e);
  if (hasFVar(r, rec.fn.id)) throw new NonStructural([`the recursive function '${rec.name}' may only be used applied to arguments`], span);
  return r;
}

// ---------------------------------------------------------------------------
// entry points

/** `match d₁, …, dₙ with | p₁, …, pₙ => e …` */
export function elabMatch(el: Elaborator, s: Extract<STerm, { k: 'match' }>, expected: Expr | undefined): Expr {
  if (el.cube) el.err(s.span, 'pattern matching needs inductive types');
  // instance arguments in the expected type must be known before generalising over the discriminants
  el.synthesizeInstances(false);
  const target0 = expected ? el.instantiate(expected) : el.newTypeMVar(s.span, 'type of the match');
  for (const a of s.alts) {
    if (a.pats.length !== s.discrs.length) el.err(a.span, `expected ${s.discrs.length} pattern(s), got ${a.pats.length}`);
  }
  const saved = el.lctx;
  // a match with no alternatives needs a known result type
  if (s.alts.length === 0 && !expected) el.err(s.span, 'nomatch needs a known expected type');
  try {
    const cols: Expr[] = [];
    const generalized: { y: FVar; d: Expr }[] = [];
    let target = target0;
    for (const ds of s.discrs) {
      const d = el.instantiate(el.elab(ds));
      if (d.k === 'fvar' && !el.lctx.get(d.id)?.value) {
        cols.push(d);
        continue;
      }
      const dt = el.inferType(d, ds.span);
      const y = el.pushLocal('x✝', el.instantiate(dt));
      target = kabstract(el.instantiate(target), d, y);
      generalized.push({ y, d });
      cols.push(y);
    }
    const used = s.alts.map(() => ({ v: false }));
    const rows: Row[] = s.alts.map((a, k) => ({ pats: a.pats, binds: new Map(), alt: a, used: used[k] }));
    // like Lean, generalise local hypotheses whose types mention a discriminant (or one of its index variables)
    const colIds = new Set(cols.map((c) => (c as FVar).id));
    for (const c of [...cols]) {
      const ct = el.whnf(el.instantiate(el.inferType(c)));
      const ch = getAppFn(ct);
      const cd = ch.k === 'const' ? el.env.get(ch.name) : undefined;
      if (cd?.kind === 'inductive') for (const ix of getAppArgs(ct).slice(cd.numParams)) if (ix.k === 'fvar' && !el.lctx.get(ix.id)?.value) colIds.add(ix.id);
    }
    const deps: FVar[] = [];
    for (const d of el.lctx.decls) {
      if (d.value || colIds.has(d.id) || (el.rec && d.id === el.rec.fn.id)) continue;
      const ty = el.instantiate(d.type);
      if ([...colIds].some((id) => hasFVar(ty, id)) || deps.some((x) => hasFVar(ty, x.id))) deps.push(mkFVar(d.id) as FVar);
    }
    let r = compile(el, { cols, rows, target, deps, ih: new Map(), exp: new Map(), span: s.span, path: [] });
    reportUnused(el, rows);
    for (const g of generalized) r = replaceFVars(el.instantiate(r), new Map([[g.y.id, g.d]]));
    el.lctx = saved;
    return el.ensureHasType(r, target0, expected, s.span);
  } finally {
    el.lctx = saved;
  }
}

function reportUnused(el: Elaborator, rows: Row[]): void {
  for (const r of rows) if (!r.used.v) el.warnings.push({ span: r.alt.span, msg: ['redundant alternative: this case is never reached'] });
}

function kabstract(e: Expr, t: Expr, y: Expr): Expr {
  return replaceExpr(e, (x) => (exprEq(x, t) ? y : undefined));
}

/**
 * Compile a definition given by equations.
 *   fixed : binders before the colon (fvars in el.lctx)
 *   cols  : the arguments matched by the equations (fvars in el.lctx)
 *   target: result type
 * Returns the body (in terms of fixed and cols).
 */
export interface EquationsInput {
  name: string;
  /** all arguments of the function, in order (fvars in el.lctx) */
  args: FVar[];
  /** positions (in args) of the arguments matched by the patterns */
  colIdx: number[];
  alts: SAlt[];
  target: Expr;
  recursive: boolean;
  span: Span;
  /** type of the whole function, for the recursive local */
  fullType: Expr;
}

/** Compile a definition given by equations; returns the body in terms of `args`. */
export function compileEquations(el: Elaborator, opts: EquationsInput): { body: Expr; decreasing?: number } {
  const { alts, target } = opts;
  void target;
  const cols = opts.colIdx.map((i) => opts.args[i]);
  for (const a of alts) {
    if (a.pats.length !== cols.length) el.err(a.span, `expected ${cols.length} pattern(s), got ${a.pats.length}`);
  }
  if (!opts.recursive) {
    const rows: Row[] = alts.map((a) => ({ pats: a.pats, binds: new Map(), alt: a, used: { v: false } }));
    const argVals = new Map<number, Expr>(opts.args.map((a) => [a.id, a]));
    // like `match`, generalise the other arguments whose types mention a matched one
    const colIds = new Set(cols.map((c) => c.id));
    // the index variables of the matched arguments' types are refined by the match too
    const idxIds = new Set<number>();
    for (const c of cols) {
      const t = el.whnf(el.instantiate(el.inferType(c)));
      const ind = getAppFn(t).k === 'const' ? el.env.get((getAppFn(t) as { name: string }).name) : undefined;
      if (ind?.kind === 'inductive') for (const x of getAppArgs(t).slice(ind.numParams)) if (x.k === 'fvar') idxIds.add(x.id);
    }
    const deps: FVar[] = [];
    for (const a of opts.args) {
      if (colIds.has(a.id) || idxIds.has(a.id)) continue;
      const ty = el.instantiate(el.lctx.get(a.id)!.type);
      if ([...colIds, ...idxIds].some((id) => hasFVar(ty, id)) || deps.some((x) => hasFVar(ty, x.id))) deps.push(a);
    }
    const body = compile(el, { cols, rows, target, deps, ih: new Map(), exp: new Map(), span: opts.span, path: [], argVals });
    reportUnused(el, rows);
    return { body };
  }
  // indices of matched arguments that are themselves arguments (`{n} … (xs : Vec α n)`) change in
  // recursive calls: match on them too (with `_`), so they are not fixed parameters
  opts = addIndexColumns(el, opts);
  const cols2 = opts.colIdx.map((i) => opts.args[i]);
  cols.length = 0;
  cols.push(...cols2);
  // try each matched argument as the decreasing one
  let firstErr: ElabError | undefined;
  let otherErr: ElabError | undefined;
  for (let j = 0; j < cols.length; j++) {
    const vType = el.whnf(el.inferType(cols[j]));
    const h = getAppFn(vType);
    const ind = h.k === 'const' ? el.env.get(h.name) : undefined;
    if (!ind || ind.kind !== 'inductive' || !ind.isRec) continue;
    const cp = el.mctx.checkpoint();
    const ninfos = el.infos.length;
    const nwarn = el.warnings.length;
    const nleaves = el.eqnLeaves?.length ?? 0;
    const saved = el.lctx;
    try {
      return { body: compileRec(el, opts, j), decreasing: opts.colIdx[j] };
    } catch (err) {
      if (!(err instanceof ElabError)) throw err;
      el.mctx.rollback(cp);
      el.infos.length = ninfos;
      el.warnings.length = nwarn;
      if (el.eqnLeaves) el.eqnLeaves.length = nleaves;
      el.lctx = saved;
      if (err instanceof NonStructural) firstErr ??= err;
      else otherErr ??= err;
    }
  }
  if (otherErr) throw otherErr;
  if (firstErr) throw firstErr;
  el.err(opts.span, `'${opts.name}' is recursive, but none of its matched arguments has a recursive inductive type, so structural recursion is impossible`);
}

function addIndexColumns(el: Elaborator, opts: EquationsInput): EquationsInput {
  const extra: number[] = [];
  for (const i of opts.colIdx) {
    const t = el.whnf(el.inferType(opts.args[i]));
    const h = getAppFn(t);
    const ind = h.k === 'const' ? el.env.get(h.name) : undefined;
    if (!ind || ind.kind !== 'inductive' || ind.numIndices === 0) continue;
    for (const x of getAppArgs(t).slice(ind.numParams)) {
      if (x.k !== 'fvar') continue;
      const pos = opts.args.findIndex((a) => a.id === x.id);
      if (pos >= 0 && !opts.colIdx.includes(pos) && !extra.includes(pos)) extra.push(pos);
    }
  }
  if (!extra.length) return opts;
  extra.sort((a, b) => a - b);
  return {
    ...opts,
    colIdx: [...extra, ...opts.colIdx],
    alts: opts.alts.map((a) => ({ ...a, pats: [...extra.map((): STerm => ({ k: 'hole', span: a.span })), ...a.pats] })),
  };
}

function compileRec(el: Elaborator, opts: EquationsInput, jj: number): Expr {
  const { args, colIdx, target } = opts;
  const cols = colIdx.map((i) => args[i]);
  const v = cols[jj];
  const vType = el.whnf(el.inferType(v));
  const indDecl = el.env.get((getAppFn(vType) as { name: string }).name) as { numParams: number };
  const ps = getAppArgs(vType).slice(0, indDecl.numParams);
  const is = getAppArgs(vType).slice(indDecl.numParams);
  const fixedMap = new Map<number, Expr>();
  args.forEach((a, pos) => {
    if (!colIdx.includes(pos)) fixedMap.set(pos, a);
  });
  const gen: number[] = [];
  cols.forEach((c, k) => {
    if (k === jj) return;
    const pos = colIdx[k];
    if (ps.some((p) => hasFVar(p, c.id))) fixedMap.set(pos, c);
    else if (!is.some((x) => x.k === 'fvar' && x.id === c.id)) gen.push(pos);
  });
  // the recursive function itself, as a local hypothesis
  const fn = el.pushLocal(opts.name, opts.fullType);
  const rec: RecCtx = { fn, name: opts.name, nargs: args.length, j: colIdx[jj], fixed: fixedMap, gen };
  el.rec = { fn, name: opts.name };
  try {
    const rows: Row[] = opts.alts.map((a) => ({ pats: a.pats, binds: new Map(), alt: a, used: { v: false } }));
    const genFVars = gen.map((pos) => args[pos]);
    const argVals = new Map<number, Expr>(args.map((a) => [a.id, a]));
    const body = split(el, { cols, rows, target, deps: [], ih: new Map(), exp: new Map(), span: opts.span, path: [], rec, argVals }, jj, 'rec', genFVars);
    reportUnused(el, rows);
    const r = el.instantiate(body);
    if (hasFVar(r, fn.id)) throw new NonStructural([`could not eliminate all recursive calls to '${opts.name}'`], opts.span);
    return r;
  } finally {
    el.rec = undefined;
    el.lctx = popLocal(el.lctx, fn.id);
  }
}

export { mkPi, abstractFVars };
export type { LocalDecl };
void freshFVarId;
