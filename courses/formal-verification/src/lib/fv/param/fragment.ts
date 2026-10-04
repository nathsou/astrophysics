/**
 * Is a parameterised system's verification condition in the decidable fragment, and how large must a
 * counterexample be? (Chapter 25.)
 *
 * The verification conditions are "Inv ∧ facts ∧ T ∧ ¬Inv′" (consecution, one per action and per invariant) and
 * "Init ∧ facts ∧ ¬Inv" (initiation). Put in prenex form, each is a formula of first-order logic over the
 * parameter types (`type Node`, with no size). When every quantifier in it is existential, or universal with no
 * existential inside it (the ∃*∀* prefix of the Bernays–Schönfinkel–Ramsey class, which Ivy calls EPR), and there
 * are no functions from parameter values to parameter values, the formula has a model if and only if it has one
 * whose elements are all named by its existential variables and constants: at most K of them, where K counts those
 * names. Checking every instance size from 1 to K therefore decides the condition for every size.
 *
 * This file walks the system's expressions with their polarity (where a ∀ under a negation acts as an ∃), counts
 * the existential names per parameter type, and reports the first construct outside the fragment.
 */
import type * as A from '../vouch/syntax/ast';
import type { Checked, ContainerInfo } from '../vouch/check/checker';
import type { Ty } from '../vouch/check/types';

type Pol = 1 | -1 | 0;
export type Counts = Map<string, number>;

export interface Fragment {
  /** The parameter types (declared without a definition), by name. */
  sorts: string[];
  /** What must be shown inductive: the invariants, and the facts that mention a variable some action changes. */
  obligations: { name: string; expr: A.Expr }[];
  /** Facts about variables no action changes: assumed in every state, nothing to prove. */
  staticFacts: A.Expr[];
  /** Why the system is outside the fragment, if it is. */
  error?: { message: string; span?: A.Expr['span'] };
  /** Names needed for the initiation check of each obligation. */
  init: Counts[];
  /** Names needed for the consecution check of each action (by index) and obligation. */
  step: Counts[][];
  /** Universal quantifiers assumed in every query (invariants, facts, guards): the parameter types of their binders. */
  universals: string[][];
}

const add = (a: Counts, b: Counts): Counts => {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v);
  return out;
};


/** The parameter-type values a value of type t carries directly (in struct fields and tuple components). */
export function atomsIn(t: Ty | undefined, sorts: Set<string>, out: string[] = []): string[] {
  if (!t) return out;
  if (t.k === 'atom' && sorts.has(t.name)) out.push(t.name);
  else if (t.k === 'struct') for (const f of t.fields ?? []) atomsIn(f.ty, sorts, out);
  else if (t.k === 'tuple') for (const x of t.elems) atomsIn(x, sorts, out);
  else if (t.k === 'enum') for (const v of t.variants ?? []) for (const f of v.fields ?? []) atomsIn(f.ty, sorts, out);
  return out;
}

class Walker {
  ex: Counts = new Map();
  univ: string[][] = [];
  error?: { message: string; span?: A.Expr['span'] };
  constructor(
    private checked: Checked,
    private sorts: Set<string>,
  ) {}

  /** The parameter types a binder's value carries (one for `n: Node`, one per field for a struct). */
  private sortsOf(b: A.Binder): string[] {
    return atomsIn(this.checked.refs.get(b)?.ty as Ty | undefined, this.sorts);
  }

  /** Walk e with polarity p; `underUniversal` is true inside the body of a universal quantifier. */
  expr(e: A.Expr | undefined, p: Pol, underUniversal = false): void {
    if (!e || this.error) return;
    switch (e.k) {
      case 'unary':
        if (e.op === '!') return this.expr(e.arg, (-p) as Pol, underUniversal);
        break;
      case 'binary':
        if (e.op === '&&' || e.op === '||') {
          this.expr(e.left, p, underUniversal);
          return this.expr(e.right, p, underUniversal);
        }
        if (e.op === '==>') {
          this.expr(e.left, (-p) as Pol, underUniversal);
          return this.expr(e.right, p, underUniversal);
        }
        break;
      case 'quant': {
        const universal = p === 0 ? undefined : (e.q === 'forall') === (p === 1);
        const atomSorts = e.binders.flatMap((b) => this.sortsOf(b));
        if (atomSorts.length) {
          if (universal === true) this.univ.push(atomSorts);
          else {
            // Existential (or used both ways): each binder is a name a counterexample may need.
            if (underUniversal) {
              this.error = { message: 'A quantifier alternates: an existential quantifier (or a universal one under a negation) appears inside a universal one. The verification condition leaves the decidable fragment, and no instance size is known to suffice. Rewrite the formula without the alternation, for instance by naming the witness in a state variable.', span: e.span };
              return;
            }
            for (const s of atomSorts) this.ex.set(s, (this.ex.get(s) ?? 0) + 1);
            if (universal === undefined) this.univ.push(atomSorts);
          }
        }
        return this.expr(e.body, p, underUniversal || universal !== false);
      }
      case 'comprehension': {
        if (e.binders.some((b) => this.sortsOf(b).length)) {
          this.error = { message: 'A set comprehension over a parameter type is not supported in parameterised proofs; write the condition with forall or exists instead.', span: e.span };
          return;
        }
        break;
      }
    }
    if (e.k === 'unary' && e.op === '#') {
      const ty = this.checked.types.get(e.arg) as Ty | undefined;
      if (ty?.k === 'set' && ty.elem.k === 'atom') {
        this.error = { message: 'Counting the elements of a set of parameter values (#s) is outside first-order logic: no finite bound on the instance size follows. Say "every shard" or "some shard" with forall or exists instead.', span: e.span };
        return;
      }
    }
    // Anything else: its subexpressions may be used either way.
    for (const c of children(e)) this.expr(c, 0, underUniversal);
  }

  stmts(ss: A.Stmt[]): void {
    for (const s of ss) {
      if (this.error) return;
      for (const c of stmtParts(s)) {
        if ('stmts' in c) this.stmts((c as A.Block).stmts);
        else this.expr(c as A.Expr, 0);
      }
    }
  }
}

function isNode(x: unknown): x is { k: string } {
  return !!x && typeof x === 'object' && typeof (x as { k?: unknown }).k === 'string' && 'span' in (x as object);
}

function children(e: A.Expr): A.Expr[] {
  const out: A.Expr[] = [];
  for (const [key, v] of Object.entries(e)) {
    if (key === 'span') continue;
    if (Array.isArray(v)) {
      for (const x of v) {
        if (isNode(x)) out.push(x as A.Expr);
        else if (x && typeof x === 'object') for (const y of Object.values(x)) if (isNode(y)) out.push(y as A.Expr);
      }
    } else if (isNode(v)) out.push(v as A.Expr);
  }
  return out.filter((c) => !('stmts' in c));
}

function stmtParts(s: A.Stmt): (A.Expr | A.Block)[] {
  const out: (A.Expr | A.Block)[] = [];
  for (const [key, v] of Object.entries(s)) {
    if (key === 'span') continue;
    if (v && typeof v === 'object' && 'stmts' in v) out.push(v as A.Block);
    else if (isNode(v)) out.push(v.k === 'if' && 'then' in v && 'stmts' in (v as { then: object }).then ? ({ stmts: [v as A.Stmt], span: s.span } as A.Block) : (v as A.Expr));
    else if (Array.isArray(v)) for (const x of v) if (isNode(x)) out.push(x as A.Expr);
  }
  return out;
}

function rootName(t: A.Expr): string {
  let x = t;
  while (x.k === 'index' || x.k === 'field') x = x.k === 'index' ? x.target : x.target;
  return x.k === 'var' ? x.name : '';
}

/** The names an expression mentions. */
function mentions(e: A.Expr, out: string[] = []): string[] {
  if (e.k === 'var') out.push(e.name);
  for (const c of children(e)) mentions(c, out);
  return out;
}

/** The parameter types of a system, and the constants (state variables holding a parameter value). */
function constants(info: ContainerInfo, sorts: Set<string>): { counts: Counts; error?: string } {
  const counts: Counts = new Map();
  const visit = (t: Ty, path: string): string | undefined => {
    if (t.k === 'atom' && sorts.has(t.name)) {
      counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
      return undefined;
    }
    if (t.k === 'func') {
      const res = t.result;
      if (res.k === 'atom' && sorts.has(res.name) && t.params.some((q) => q.k === 'atom' && sorts.has(q.name))) return `${path} maps ${res.name} values to ${res.name} values: a function symbol, which takes the verification condition out of the decidable fragment. Use a relation instead (a function to bool).`;
      if (res.k === 'atom' && sorts.has(res.name)) return `${path} holds a ${res.name} value for each argument; use a relation (a function to bool) instead.`;
      return undefined;
    }
    if (t.k === 'struct') {
      for (const f of t.fields ?? []) {
        const r = visit(f.ty, `${path}.${f.name}`);
        if (r) return r;
      }
    }
    return undefined;
  };
  for (const v of info.vars) {
    const r = visit(v.ty, v.name);
    if (r) return { counts, error: r };
  }
  return { counts };
}

export function analyse(checked: Checked, info: ContainerInfo): Fragment {
  const sortTys = info.atoms.filter((t) => t.k === 'atom') as (Ty & { k: 'atom' })[];
  const sorts = new Set(sortTys.map((t) => t.name));
  const frag: Fragment = { sorts: [...sorts], obligations: [], staticFacts: [], init: [], step: [], universals: [] };
  if (!sorts.size) {
    frag.error = { message: 'The system has no parameter type: declare one with `type Node` (an instance size is not needed for the proof).' };
    return frag;
  }
  if (info.processes.length) {
    frag.error = { message: 'Parameterised proofs here handle systems of actions; write each process step as an action with the process as a parameter.' };
    return frag;
  }
  const consts = constants(info, sorts);
  if (consts.error) {
    frag.error = { message: consts.error };
    return frag;
  }
  const walk = (f: (w: Walker) => void): { ex: Counts; univ: string[][]; error?: Walker['error'] } => {
    const w = new Walker(checked, sorts);
    f(w);
    return { ex: w.ex, univ: w.univ, error: w.error };
  };
  // Facts about variables that no action assigns hold in every state once they hold initially.
  const assigned = new Set<string>();
  const collect = (ss: A.Stmt[]) => {
    for (const st of ss) {
      if (st.k === 'assign') assigned.add(rootName(st.target));
      if (st.k === 'multi') st.targets.forEach((t) => assigned.add(rootName(t)));
      for (const c of stmtParts(st)) if ('stmts' in c) collect((c as A.Block).stmts);
    }
  };
  info.actions.forEach((a) => collect(a.decl.body.stmts));
  const isStatic = (e: A.Expr) => !mentions(e).some((n) => assigned.has(n));
  frag.staticFacts = info.facts.filter((f) => isStatic(f.expr)).map((f) => f.expr);
  frag.obligations = [...info.invariants.map((i) => ({ name: i.name ?? 'invariant', expr: i.expr })), ...info.facts.filter((f) => !isStatic(f.expr)).map((f) => ({ name: `fact ${f.name ?? ''}`.trim(), expr: f.expr }))];
  const obligations = [...frag.obligations, ...frag.staticFacts.map((expr) => ({ expr }))];
  // The hypothesis of every query: all invariants and facts hold in S.
  const hyp = walk((w) => obligations.forEach((o) => w.expr(o.expr, 1)));
  // Each obligation negated (in S′ for consecution, in S for initiation).
  const neg = frag.obligations.map((o) => walk((w) => w.expr(o.expr, -1)));
  const init = walk((w) => {
    for (const v of info.vars) if (v.decl?.k === 'var' && v.decl.init) w.expr(v.decl.init, 0);
    if (info.init) w.stmts(info.init.body.stmts);
  });
  const actions = info.actions.map((a) =>
    walk((w) => {
      w.expr(a.decl.guard, 1);
      w.stmts(a.decl.body.stmts);
    }),
  );
  const err = [hyp, init, ...neg, ...actions].find((x) => x.error)?.error;
  if (err) {
    frag.error = err;
    return frag;
  }
  frag.universals = [...hyp.univ, ...actions.flatMap((a) => a.univ)];
  const base = add(hyp.ex, consts.counts);
  frag.init = neg.map((n) => add(add(base, init.ex), n.ex));
  frag.step = info.actions.map((a, i) => {
    const params: Counts = new Map();
    for (const p of a.params) for (const s of atomsIn(p.ty, sorts)) params.set(s, (params.get(s) ?? 0) + 1);
    // The constants are named in S and again in S′.
    const k = add(add(add(base, consts.counts), params), actions[i]!.ex);
    return neg.map((n) => add(k, n.ex));
  });
  return frag;
}
