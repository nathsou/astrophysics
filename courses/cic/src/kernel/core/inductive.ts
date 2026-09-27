// Inductive types: checking declarations and generating their eliminators.
//
// Given a (mutual) block of inductive types with their constructors, this
// module
//   1. checks that everything is well typed and that constructors really
//      construct the type they belong to;
//   2. checks strict positivity of recursive occurrences;
//   3. checks the universe constraints on constructor fields;
//   4. decides which sorts the type may eliminate into (large elimination);
//   5. generates the recursor `I.rec` with its ι-reduction rules, plus the
//      derived `I.casesOn` and, for structures, projection functions.

import {
  type Expr,
  exprEq,
  getAppArgs,
  getAppFn,
  instantiate1,
  mkApp,
  mkApps,
  mkConst,
  mkFVar,
  mkSort,
  occursConst,
  forEachExpr,
} from './expr.ts';
import { type Level, isNeverZero, levelGeq, lparam, lzero, toNat } from './level.ts';
import { type Decl, Environment, LocalContext, type LocalDecl, type RecursorRule, freshFVarId } from './env.ts';
import { KernelError, type MsgPart, TypeChecker } from './typechecker.ts';

export interface InductiveTypeInput {
  name: string;
  type: Expr;
  ctors: { name: string; type: Expr; doc?: string }[];
  doc?: string;
}

export interface InductiveInput {
  levelParams: string[];
  numParams: number;
  types: InductiveTypeInput[];
  /** declared with `structure`: generate projections named by `fieldNames` */
  structure?: { fieldNames: string[] };
}

export interface AddInductiveResult {
  added: string[];
  /** fields accepted only because the positivity check was switched off */
  nonPositive: string[];
}

type FVar = Extract<Expr, { k: 'fvar' }>;

function pushLocal(tc: TypeChecker, name: string, type: Expr, binfo: LocalDecl['binfo'] = 'default'): FVar {
  const d: LocalDecl = { id: freshFVarId(), name, type, binfo };
  tc.lctx = tc.lctx.push(d);
  return mkFVar(d.id) as FVar;
}

/** instantiate the first `ps.length` Π binders of `t` with `ps` */
function instantiatePis(tc: TypeChecker, t: Expr, ps: Expr[], check?: (dom: Expr, i: number) => void): Expr {
  let cur = t;
  for (let i = 0; i < ps.length; i++) {
    if (cur.k !== 'pi') cur = tc.whnf(cur);
    if (cur.k !== 'pi') throw new KernelError(['expected at least ', String(ps.length), ' parameters']);
    check?.(cur.type, i);
    cur = instantiate1(cur.body, ps[i]);
  }
  return cur;
}

function freshLevelName(used: string[]): string {
  if (!used.includes('u')) return 'u';
  for (let i = 1; ; i++) if (!used.includes(`u_${i}`)) return `u_${i}`;
}

// ---------------------------------------------------------------------------
// positivity analysis (also used by the visualisation)

export type OccurrenceKind = 'strict' | 'nonstrict' | 'negative' | 'nested' | 'index';

export interface Occurrence {
  path: number[]; // path in the field type (app: 0 fn / 1 arg; binder: 0 type / 1 body)
  kind: OccurrenceKind;
}

/**
 * Classify every occurrence of the types `names` inside a constructor field
 * type. Strictly positive: only as the head of the final codomain, after any
 * number of Π's whose domains don't mention the type.
 */
export function classifyOccurrences(fieldType: Expr, names: Set<string>, numParams: number): Occurrence[] {
  const out: Occurrence[] = [];
  const mark = (e: Expr, path: number[], kind: OccurrenceKind) => {
    forEachOcc(e, names, path, (p) => out.push({ path: p, kind }));
  };
  // walk the spine of Π's
  const walk = (e: Expr, path: number[], polarityPositive: boolean, strict: boolean): void => {
    if (e.k === 'pi') {
      // domain: flips polarity; nothing inside a domain is strictly positive
      walkDomain(e.type, [...path, 0], !polarityPositive);
      walk(e.body, [...path, 1], polarityPositive, strict);
      return;
    }
    const head = getAppFn(e);
    if (head.k === 'const' && names.has(head.name)) {
      // head occurrence: params must be the params; indices must not mention names
      const headPath = [...path, ...Array(getAppArgs(e).length).fill(0)];
      out.push({ path: headPath, kind: polarityPositive ? (strict ? 'strict' : 'nonstrict') : 'negative' });
      const args = getAppArgs(e);
      args.forEach((a, i) => {
        const argPath = [...path, ...Array(args.length - 1 - i).fill(0), 1];
        if (i >= numParams) mark(a, argPath, 'index');
        else mark(a, argPath, 'nested');
      });
      return;
    }
    // occurrence as an argument of some other type former: nested
    mark(e, path, polarityPositive ? 'nested' : 'negative');
  };
  const walkDomain = (e: Expr, path: number[], positive: boolean): void => {
    if (e.k === 'pi') {
      walkDomain(e.type, [...path, 0], !positive);
      walkDomain(e.body, [...path, 1], positive);
      return;
    }
    const head = getAppFn(e);
    if (head.k === 'const' && names.has(head.name)) {
      const args = getAppArgs(e);
      out.push({ path: [...path, ...Array(args.length).fill(0)], kind: positive ? 'nonstrict' : 'negative' });
      args.forEach((a, i) => mark(a, [...path, ...Array(args.length - 1 - i).fill(0), 1], positive ? 'nonstrict' : 'negative'));
      return;
    }
    mark(e, path, positive ? 'nonstrict' : 'negative');
  };
  walk(fieldType, [], true, true);
  return out;
}

function forEachOcc(e: Expr, names: Set<string>, path: number[], f: (p: number[]) => void): void {
  switch (e.k) {
    case 'const':
      if (names.has(e.name)) f(path);
      return;
    case 'app':
      forEachOcc(e.fn, names, [...path, 0], f);
      forEachOcc(e.arg, names, [...path, 1], f);
      return;
    case 'lam':
    case 'pi':
      forEachOcc(e.type, names, [...path, 0], f);
      forEachOcc(e.body, names, [...path, 1], f);
      return;
    case 'let':
      forEachOcc(e.type, names, [...path, 0], f);
      forEachOcc(e.value, names, [...path, 1], f);
      forEachOcc(e.body, names, [...path, 2], f);
      return;
  }
}

const occursAny = (e: Expr, names: Set<string>) => {
  let found = false;
  forEachExpr(e, (x) => {
    if (found) return false;
    if (x.k === 'const' && names.has(x.name)) found = true;
    return undefined;
  });
  return found;
};

// ---------------------------------------------------------------------------

interface FieldInfo {
  fvar: FVar;
  /** index in the block of the type of a recursive field, else −1 */
  recType: number;
  isProp: boolean;
  level: Level;
}

interface CtorInfo {
  name: string;
  type: Expr;
  typeIdx: number;
  fields: FieldInfo[];
  /** result indices (in terms of params and fields) */
  resultIndices: Expr[];
  doc?: string;
}

export function addInductive(env: Environment, input: InductiveInput): AddInductiveResult {
  const f = env.features;
  if (!f.inductives) throw new KernelError([`inductive types are not part of ${f.name}`]);
  const { levelParams, numParams, types } = input;
  const names = new Set(types.map((t) => t.name));
  for (const t of types) {
    if (env.has(t.name)) throw new KernelError([`'${t.name}' has already been declared`]);
    for (const c of t.ctors) if (env.has(c.name)) throw new KernelError([`'${c.name}' has already been declared`]);
  }
  const lps = levelParams.map(lparam);

  // 1. check the types of the inductive types themselves
  const tc0 = new TypeChecker(env);
  let resultLevel: Level | undefined;
  const numIndices: number[] = [];
  for (const t of types) {
    const s = tc0.infer(t.type);
    tc0.ensureSort(s);
    const saved = tc0.lctx;
    const { fvars, body } = tc0.openPis(t.type, Infinity, true);
    const sort = tc0.whnf(body);
    tc0.lctx = saved;
    if (sort.k !== 'sort') throw new KernelError([`the type of '${t.name}' must be of the form Π (params) (indices), Sort u`]);
    if (fvars.length < numParams) throw new KernelError([`'${t.name}' has fewer than ${numParams} parameters`]);
    numIndices.push(fvars.length - numParams);
    if (resultLevel === undefined) resultLevel = sort.level;
    else if (!tc0.levelDefEq(resultLevel, sort.level)) throw new KernelError(['all types in a mutual block must live in the same universe']);
  }
  const level = resultLevel!;

  // 2. temporary environment with the types declared (no constructors yet)
  const tmp = env.clone();
  for (let j = 0; j < types.length; j++) {
    tmp.add({
      kind: 'inductive',
      name: types[j].name,
      levelParams,
      type: types[j].type,
      numParams,
      numIndices: numIndices[j],
      ctors: [],
      isRec: false,
      all: types.map((t) => t.name),
      elimOnlyProp: false,
      isStructure: false,
      doc: types[j].doc,
    });
  }
  const tc = new TypeChecker(tmp);
  // parameters, shared by the block
  const { fvars: params } = tc.openPis(types[0].type, numParams, true);
  const paramsLctx = tc.lctx;
  for (let j = 1; j < types.length; j++) {
    instantiatePis(tc, types[j].type, params, (dom, i) => {
      if (!tc.isDefEq(dom, tc.lctx.get((params[i] as FVar).id)!.type)) throw new KernelError(['all types in a mutual block must have the same parameters']);
    });
  }

  // 3. constructors
  const nonPositive: string[] = [];
  const ctorInfos: CtorInfo[] = [];
  let isRec = false;
  for (let j = 0; j < types.length; j++) {
    for (const c of types[j].ctors) {
      tc.lctx = paramsLctx;
      const ct = tc.infer(c.type);
      tc.ensureSort(ct);
      tc.lctx = paramsLctx;
      const rest = instantiatePis(tc, c.type, params, (dom, i) => {
        if (!tc.isDefEq(dom, tc.lctx.get((params[i] as FVar).id)!.type)) {
          throw new KernelError([`constructor '${c.name}': parameter ${i + 1} does not match the parameters of the inductive type`]);
        }
      });
      const { fvars: fields, body: result } = tc.openPis(rest, Infinity, false);
      const fieldInfos: FieldInfo[] = [];
      // result type must be I params indices
      const rh = getAppFn(result);
      const rargs = getAppArgs(result);
      if (rh.k !== 'const' || rh.name !== types[j].name) {
        throw new KernelError([`constructor '${c.name}' must construct an element of '${types[j].name}', but its result type is `, { e: result, lctx: tc.lctx }]);
      }
      if (rargs.length !== numParams + numIndices[j]) throw new KernelError([`constructor '${c.name}': wrong number of arguments in the result type`]);
      for (let i = 0; i < numParams; i++) {
        if (!exprEq(rargs[i], params[i])) {
          throw new KernelError([`constructor '${c.name}': the parameters of the result type must be exactly the parameters of '${types[j].name}' (found `, { e: rargs[i], lctx: tc.lctx }, `). Did you mean to make this argument an index?`]);
        }
      }
      const resultIndices = rargs.slice(numParams);
      for (const ix of resultIndices) {
        if (occursAny(ix, names)) throw new KernelError([`constructor '${c.name}': the inductive type may not occur in the indices of the result type`]);
      }
      // fields
      for (const fv of fields) {
        const fty = tc.lctx.get(fv.id)!.type;
        const fsort = tc.ensureSort(tc.infer(fty));
        // universe constraint
        if (!f.typeInType && toNat(level) !== 0 && !levelGeq(level, fsort)) {
          throw new KernelError([
            `universe level too large: the field '${tc.lctx.get(fv.id)!.name}' of constructor '${c.name}' has type `,
            { e: fty, lctx: tc.lctx },
            ` which lives in a universe larger than the inductive type itself. Either the inductive type must live in a larger universe, or it must be a Prop.`,
          ]);
        }
        let recType = -1;
        if (occursAny(fty, names)) {
          const r = checkPositivity(tc, fty, names, numParams, params);
          if (r.ok) {
            recType = types.findIndex((t) => t.name === r.head);
            isRec = true;
          } else if (!f.positivity) {
            nonPositive.push(`${c.name}: ${tc.lctx.get(fv.id)!.name}`);
          } else {
            throw new KernelError([`arg #${numParams + fieldInfos.length + 1} of '${c.name}' has a non-positive occurrence of the datatypes being declared: `, { e: fty, lctx: tc.lctx }, r.reason ? `\n${r.reason}` : '']);
          }
        }
        fieldInfos.push({ fvar: fv, recType, isProp: toNat(fsort) === 0, level: fsort });
      }
      ctorInfos.push({ name: c.name, type: c.type, typeIdx: j, fields: fieldInfos, resultIndices, doc: c.doc });
    }
  }

  // 4. elimination level
  const isPropLevel = toNat(level) === 0;
  let largeElim = true;
  if (!isNeverZero(level) && f.restrictPropElim) {
    // subsingleton elimination
    const allCtors = ctorInfos;
    if (types.length > 1) largeElim = false;
    else if (allCtors.length === 0) largeElim = true;
    else if (allCtors.length > 1) largeElim = false;
    else {
      const c = allCtors[0];
      largeElim = c.fields.every((fi) => fi.isProp || c.resultIndices.some((ix) => exprEq(ix, fi.fvar)));
    }
  }
  void isPropLevel;
  const elimName = largeElim ? freshLevelName(levelParams) : undefined;
  const elimLevel: Level = elimName ? lparam(elimName) : lzero;
  const recLevelParams = elimName ? [elimName, ...levelParams] : [...levelParams];
  const recLevels = recLevelParams.map(lparam);

  // 5. build the recursor(s)
  tc.lctx = paramsLctx;
  const motives: FVar[] = [];
  for (let j = 0; j < types.length; j++) {
    const saved = tc.lctx;
    const idxT = instantiatePis(tc, types[j].type, params);
    const { fvars: idx } = tc.openPis(idxT, numIndices[j], true);
    const major = pushLocal(tc, 't', mkApps(mkConst(types[j].name, lps), [...params, ...idx]));
    const mt = tc.mkBinding('pi', [...idx, major], mkSort(elimLevel));
    tc.lctx = saved;
    motives.push(pushLocal(tc, types.length > 1 ? `motive_${j + 1}` : 'motive', mt, 'implicit'));
  }
  const motiveLctx = tc.lctx;

  // minor premises
  const minors: FVar[] = [];
  const minorShapes: { ctor: CtorInfo; nfields: number }[] = [];
  let running = motiveLctx;
  for (const ci of ctorInfos) {
    tc.lctx = running;
    const rest = instantiatePis(tc, ci.type, params);
    const { fvars: fields, body: result } = tc.openPis(rest, Infinity, false);
    const ihs: FVar[] = [];
    fields.forEach((fv, i) => {
      const info = ci.fields[i];
      if (info.recType < 0) return;
      const saved = tc.lctx;
      const fty = tc.lctx.get(fv.id)!.type;
      const { fvars: ys, body: fres } = tc.openPis(fty, Infinity, true);
      const is = getAppArgs(fres).slice(numParams);
      const ihT = tc.mkBinding('pi', ys, mkApps(motives[info.recType], [...is, mkApps(fv, ys)]));
      tc.lctx = saved;
      ihs.push(pushLocal(tc, `${tc.lctx.get(fv.id)!.name}_ih`, ihT));
    });
    const cIdx = getAppArgs(result).slice(numParams);
    const concl = mkApps(motives[ci.typeIdx], [...cIdx, mkApps(mkConst(ci.name, lps), [...params, ...fields])]);
    const minorT = tc.mkBinding('pi', [...fields, ...ihs], concl);
    tc.lctx = running;
    minors.push(pushLocal(tc, `${shortName(ci.name)}`, minorT));
    running = tc.lctx;
    minorShapes.push({ ctor: ci, nfields: fields.length });
  }
  const minorsCtx = tc.lctx;

  const recDecls: Decl[] = [];
  for (let j = 0; j < types.length; j++) {
    tc.lctx = minorsCtx;
    const idxT = instantiatePis(tc, types[j].type, params);
    const { fvars: idx } = tc.openPis(idxT, numIndices[j], true);
    for (const ix of idx) setBinfo(tc, ix, 'implicit');
    for (const p of params) setBinfo(tc, p as FVar, 'implicit');
    const major = pushLocal(tc, 't', mkApps(mkConst(types[j].name, lps), [...params, ...idx]));
    const recT = tc.mkBinding('pi', [...params, ...motives, ...minors, ...idx, major], mkApps(motives[j], [...idx, major]));
    // ι-rules
    const rules: RecursorRule[] = [];
    for (const shape of minorShapes) {
      if (shape.ctor.typeIdx !== j) continue;
      const ci = shape.ctor;
      tc.lctx = minorsCtx;
      const rest = instantiatePis(tc, ci.type, params);
      const { fvars: fields } = tc.openPis(rest, Infinity, false);
      const ihVals: Expr[] = [];
      fields.forEach((fv, i) => {
        const info = ci.fields[i];
        if (info.recType < 0) return;
        const saved = tc.lctx;
        const fty = tc.lctx.get(fv.id)!.type;
        const { fvars: ys, body: fres } = tc.openPis(fty, Infinity, true);
        const is = getAppArgs(fres).slice(numParams);
        const val = tc.mkBinding(
          'lam',
          ys,
          mkApps(mkConst(types[info.recType].name + '.rec', recLevels), [...params, ...motives, ...minors, ...is, mkApps(fv, ys)]),
        );
        tc.lctx = saved;
        ihVals.push(val);
      });
      const minorIdx = minorShapes.indexOf(shape);
      const rhsBody = mkApps(minors[minorIdx], [...fields, ...ihVals]);
      const rhs = tc.mkBinding('lam', [...params, ...motives, ...minors, ...fields], rhsBody);
      rules.push({ ctor: ci.name, nfields: fields.length, rhs });
    }
    const isK =
      toNat(level) === 0 &&
      types.length === 1 &&
      ctorInfos.length === 1 &&
      ctorInfos[0].fields.length === 0;
    recDecls.push({
      kind: 'rec',
      name: types[j].name + '.rec',
      levelParams: recLevelParams,
      type: recT,
      induct: types[j].name,
      all: types.map((t) => t.name),
      numParams,
      numIndices: numIndices[j],
      numMotives: types.length,
      numMinors: minors.length,
      rules,
      k: isK,
      majorIdx: numParams + types.length + minors.length + numIndices[j],
      doc: `The recursor (eliminator) of '${types[j].name}', generated automatically from its constructors.`,
      builtin: true,
    });
  }

  // 6. add everything to the real environment
  const isStructureLike =
    types.length === 1 && ctorInfos.length === 1 && numIndices[0] === 0 && !isRec;
  const added: string[] = [];
  for (let j = 0; j < types.length; j++) {
    env.add({
      kind: 'inductive',
      name: types[j].name,
      levelParams,
      type: types[j].type,
      numParams,
      numIndices: numIndices[j],
      ctors: types[j].ctors.map((c) => c.name),
      isRec,
      all: types.map((t) => t.name),
      elimOnlyProp: !largeElim,
      isStructure: isStructureLike && input.structure !== undefined,
      fieldNames: input.structure?.fieldNames,
      doc: types[j].doc,
    });
    added.push(types[j].name);
  }
  ctorInfos.forEach((ci) => {
    const cidx = types[ci.typeIdx].ctors.findIndex((c) => c.name === ci.name);
    env.add({
      kind: 'ctor',
      name: ci.name,
      levelParams,
      type: ci.type,
      induct: types[ci.typeIdx].name,
      cidx,
      numParams,
      numFields: ci.fields.length,
      doc: ci.doc,
    });
    added.push(ci.name);
  });
  for (const r of recDecls) {
    env.add(r);
    added.push(r.name);
  }

  if (types.length === 1) {
    added.push(addCasesOn(env, types[0].name));
    if (input.structure && isStructureLike) added.push(...addProjections(env, types[0].name, input.structure.fieldNames));
  }
  return { added, nonPositive };
}

function setBinfo(tc: TypeChecker, fv: FVar, binfo: LocalDecl['binfo']) {
  // replace the local decl with the same id but a different binder info
  const d = tc.lctx.get(fv.id)!;
  const decls = tc.lctx.decls.map((x) => (x.id === fv.id ? { ...d, binfo } : x));
  let l = LocalContext.empty;
  for (const x of decls) l = l.push(x);
  tc.lctx = l;
}


function shortName(n: string): string {
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(i + 1) : n;
}

function checkPositivity(
  tc: TypeChecker,
  fty: Expr,
  names: Set<string>,
  numParams: number,
  params: Expr[],
): { ok: true; head: string } | { ok: false; reason?: string } {
  // fty = Π (ys : Cs), I params is   with no occurrence in Cs or is
  let cur = tc.whnf(fty);
  const saved = tc.lctx;
  try {
    while (cur.k === 'pi') {
      if (occursAny(cur.type, names)) {
        return { ok: false, reason: 'the type being defined occurs to the left of an arrow (in the domain of a function type)' };
      }
      const y = pushLocal(tc, cur.name, cur.type);
      cur = tc.whnf(instantiate1(cur.body, y));
    }
    const h = getAppFn(cur);
    if (h.k !== 'const' || !names.has(h.name)) {
      return { ok: false, reason: 'the type being defined occurs as an argument of another type (nested inductive types are not supported by this kernel)' };
    }
    const args = getAppArgs(cur);
    for (let i = 0; i < numParams; i++) {
      if (!exprEq(args[i], params[i])) return { ok: false, reason: 'a recursive occurrence must use the same parameters' };
    }
    for (let i = numParams; i < args.length; i++) {
      if (occursAny(args[i], names)) return { ok: false, reason: 'the type being defined occurs in an index of a recursive occurrence' };
    }
    return { ok: true, head: h.name };
  } finally {
    tc.lctx = saved;
  }
}

// ---------------------------------------------------------------------------
// casesOn: the non-recursive eliminator, defined from the recursor
//   I.casesOn : {params} → {motive} → {indices} → (t : I params indices) →
//               (minor for each constructor, without induction hypotheses) → motive indices t

export function addCasesOn(env: Environment, indName: string): string {
  const ind = env.get(indName) as Extract<Decl, { kind: 'inductive' }>;
  const rec = env.get(indName + '.rec') as Extract<Decl, { kind: 'rec' }>;
  const tc = new TypeChecker(env);
  const recLevels = rec.levelParams.map(lparam);
  const { fvars: all } = tc.openPis(rec.type);
  const params = all.slice(0, rec.numParams);
  const motive = all[rec.numParams];
  const minors = all.slice(rec.numParams + 1, rec.numParams + 1 + rec.numMinors);
  const idx = all.slice(rec.numParams + 1 + rec.numMinors, rec.numParams + 1 + rec.numMinors + rec.numIndices);
  const major = all[all.length - 1];
  // new minors: drop the induction hypotheses
  const newMinors: Expr[] = [];
  const minorArgs: Expr[] = [];
  rec.rules.forEach((rule, i) => {
    const m = minors[i] as FVar;
    const mt = tc.lctx.get(m.id)!.type;
    const saved = tc.lctx;
    const { fvars: fs } = tc.openPis(mt);
    const fields = fs.slice(0, rule.nfields);
    const ihs = fs.slice(rule.nfields);
    // type of the new minor: Π fields, (conclusion of the original)
    const concl = instantiateRest(tc, mt, fs);
    const newT = tc.mkBinding('pi', fields, concl);
    void ihs;
    tc.lctx = saved;
    const nm = pushLocal(tc, tc.lctx.get(m.id)!.name, newT);
    newMinors.push(nm);
    // argument to rec: λ fields ihs, nm fields
    const saved2 = tc.lctx;
    const { fvars: fs2 } = tc.openPis(mt);
    const lam = tc.mkBinding('lam', fs2, mkApps(nm, fs2.slice(0, rule.nfields)));
    tc.lctx = saved2;
    minorArgs.push(lam);
  });
  const body = mkApps(mkConst(rec.name, recLevels), [...params, motive, ...minorArgs, ...idx, major]);
  const binders = [...params, motive, ...idx, major, ...newMinors];
  const value = tc.mkBinding('lam', binders, body);
  const type = tc.mkBinding('pi', binders, mkApps(motive, [...idx, major]));
  const name = indName + '.casesOn';
  env.add({
    kind: 'def',
    name,
    levelParams: rec.levelParams,
    type,
    value,
    height: 1,
    doc: `Case analysis on '${indName}': like '${rec.name}' but without induction hypotheses.`,
    builtin: true,
  });
  void ind;
  return name;
}

function instantiateRest(tc: TypeChecker, t: Expr, fs: Expr[]): Expr {
  let cur = t;
  for (const f of fs) {
    if (cur.k !== 'pi') cur = tc.whnf(cur);
    cur = instantiate1((cur as Extract<Expr, { k: 'pi' }>).body, f);
  }
  return cur;
}

// ---------------------------------------------------------------------------
// projections of structures:  S.field : {params} → (self : S params) → FieldType

function addProjections(env: Environment, indName: string, fieldNames: string[]): string[] {
  const ind = env.get(indName) as Extract<Decl, { kind: 'inductive' }>;
  const ctor = env.get(ind.ctors[0]) as Extract<Decl, { kind: 'ctor' }>;
  const rec = env.get(indName + '.rec') as Extract<Decl, { kind: 'rec' }>;
  const lps = ind.levelParams.map(lparam);
  const out: string[] = [];
  const projNames: string[] = [];
  for (let i = 0; i < ctor.numFields; i++) {
    const tc = new TypeChecker(env);
    const { fvars: params } = tc.openPis(ind.type, ind.numParams, true);
    const self = pushLocal(tc, 'self', mkApps(mkConst(indName, lps), params));
    // field types, with earlier fields replaced by earlier projections applied to self
    let ct = instantiatePis(tc, ctor.type, params);
    const projApps: Expr[] = [];
    for (let k = 0; k < i; k++) {
      ct = tc.whnf(ct);
      const pk = mkApps(mkConst(projNames[k], lps), [...params, self]);
      projApps.push(pk);
      ct = instantiate1((ct as Extract<Expr, { k: 'pi' }>).body, pk);
    }
    ct = tc.whnf(ct);
    const fieldTy = (ct as Extract<Expr, { k: 'pi' }>).type;
    const fsort = tc.ensureSort(tc.infer(fieldTy));
    if (ind.elimOnlyProp && toNat(fsort) !== 0) break; // cannot project data out of a proof
    // motive: λ (x : S params), FieldType[projₖ x]
    const saved = tc.lctx;
    const x = pushLocal(tc, 'x', mkApps(mkConst(indName, lps), params));
    let ctx = instantiatePis(tc, ctor.type, params);
    for (let k = 0; k < i; k++) {
      ctx = tc.whnf(ctx);
      ctx = instantiate1((ctx as Extract<Expr, { k: 'pi' }>).body, mkApps(mkConst(projNames[k], lps), [...params, x]));
    }
    ctx = tc.whnf(ctx);
    const motive = tc.mkBinding('lam', [x], (ctx as Extract<Expr, { k: 'pi' }>).type);
    tc.lctx = saved;
    // minor: λ fields, field_i
    const saved2 = tc.lctx;
    const { fvars: fields } = tc.openPis(instantiatePis(tc, ctor.type, params));
    const minor = tc.mkBinding('lam', fields, fields[i]);
    tc.lctx = saved2;
    const recLevels = rec.levelParams.length > ind.levelParams.length ? [fsort, ...lps] : lps;
    const body = mkApps(mkConst(rec.name, recLevels), [...params, motive, minor, self]);
    for (const p of params) setBinfo(tc, p as FVar, 'implicit');
    const value = tc.mkBinding('lam', [...params, self], body);
    const type = tc.mkBinding('pi', [...params, self], fieldTy);
    const name = `${indName}.${fieldNames[i] ?? `${i + 1}`}`;
    if (env.has(name)) break;
    env.add({ kind: 'def', name, levelParams: ind.levelParams, type, value, height: 1, doc: `Projection onto the field '${fieldNames[i]}' of the structure '${indName}'.`, builtin: true });
    projNames.push(name);
    out.push(name);
    void projApps;
  }
  if (projNames.length === ctor.numFields) env.update({ ...ind, projs: projNames });
  return out;
}

void occursConst;
void mkApp;
export type { MsgPart };

// ---------------------------------------------------------------------------
// fixed-index promotion (as in Lean 4): an index that every constructor
// instantiates with its first field, uniformly, can be turned into a
// parameter. This is how `inductive Eq : α → α → Prop | refl (a : α) : Eq a a`
// ends up with `a` as a parameter, so that `Eq.refl a` takes `a` explicitly.

export function promoteIndices(env: Environment, input: InductiveInput): number {
  if (input.types.length !== 1) return input.numParams;
  const t = input.types[0];
  const tmp = env.clone();
  tmp.add({ kind: 'axiom', name: t.name, levelParams: input.levelParams, type: t.type });
  let np = input.numParams;
  const tc = new TypeChecker(tmp);
  const total = (() => {
    const saved = tc.lctx;
    const { fvars } = tc.openPis(t.type, Infinity, true);
    tc.lctx = saved;
    return fvars.length;
  })();
  for (;;) {
    if (np >= total) return np;
    if (t.ctors.length === 0) return np;
    const ok = t.ctors.every((c) => {
      const saved = tc.lctx;
      try {
        const { fvars, body } = tc.openPis(c.type);
        if (fvars.length <= np) return false;
        const ps = fvars.slice(0, np);
        const f = fvars[np];
        // domain of index `np` in the inductive's type
        let it = t.type;
        for (let i = 0; i < np; i++) it = instantiate1((tc.whnf(it) as Extract<Expr, { k: 'pi' }>).body, ps[i]);
        it = tc.whnf(it);
        if (it.k !== 'pi' || !exprEq(it.type, tc.lctx.get(f.id)!.type)) return false;
        const good = (e: Expr): boolean => {
          let fine = true;
          forEachExpr(e, (x) => {
            if (!fine) return false;
            if (x.k === 'app' && getAppFn(x).k === 'const' && (getAppFn(x) as { name: string }).name === t.name) {
              const args = getAppArgs(x);
              if (args.length > np && !exprEq(args[np], f)) fine = false;
            }
            return undefined;
          });
          return fine;
        };
        for (const fv of fvars.slice(np + 1)) if (!good(tc.lctx.get(fv.id)!.type)) return false;
        const rargs = getAppArgs(body);
        return rargs.length > np && exprEq(rargs[np], f) && good(body);
      } catch {
        return false;
      } finally {
        tc.lctx = saved;
      }
    });
    if (!ok) return np;
    np++;
  }
}
