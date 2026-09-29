// Pretty printer producing a tree of annotated spans.
//
// Each printed subterm remembers the expression it came from (with binders
// opened as named free variables, so every node is meaningful in its own
// local context) and its path in the original term. The UI uses this for
// hovering, highlighting redexes and colouring by "level": sorts, types,
// propositions, proofs and ordinary terms get distinct colours.

import {
  type BinderInfo,
  type Expr,
  getAppArgs,
  getAppFn,
  hasLooseBVar,
  instantiate1,
  mkFVar,
} from './expr.ts';
import { type Level, levelToString, toNat, toOffset } from './level.ts';
import { Environment, LocalContext, freshFVarId } from './env.ts';
import { TypeChecker } from './typechecker.ts';

export type TokenClass =
  | 'kw' // λ, fun, let, →, ∀ …
  | 'sort'
  | 'type' // a type or type former
  | 'prop' // a proposition or predicate
  | 'proof'
  | 'term'
  | 'ctor'
  | 'var'
  | 'bvar'
  | 'mvar'
  | 'num'
  | 'punct'
  | 'op'
  | 'level';

export interface PNode {
  text?: string;
  cls?: TokenClass;
  children?: PNode[];
  /** set on nodes that correspond to a whole subterm */
  expr?: Expr;
  lctx?: LocalContext;
  path?: number[];
}

export interface PrettyOptions {
  /** show implicit arguments with @ */
  explicit?: boolean;
  /** show universe levels on constants */
  universes?: boolean;
  /** print Nat.succ (… Nat.zero) as a numeral */
  numerals?: boolean;
  /** show binder types on λ */
  binderTypes?: boolean;
  /** compute token classes (needs type inference) */
  classify?: boolean;
  /** use notations from the environment */
  notation?: boolean;
  /** maximum depth before eliding with ⋯ */
  maxDepth?: number;
  /** names of metavariables */
  mvarName?: (id: number) => string;
  /** print a hole `?m x₁ … xₙ` applied to its context as just `?m` */
  hideMVarArgs?: boolean;
}

const defaults: Required<Omit<PrettyOptions, 'mvarName' | 'hideMVarArgs'>> & { hideMVarArgs: boolean } = {
  hideMVarArgs: false,
  explicit: false,
  universes: false,
  numerals: true,
  binderTypes: true,
  classify: true,
  notation: true,
  maxDepth: 200,
};

// precedences
const P_MAX = 1024;
const P_APP = 1000;
const P_ARROW = 25;
const P_BINDER = 0;

export class Printer {
  private opts: Required<Omit<PrettyOptions, 'mvarName'>> & Pick<PrettyOptions, 'mvarName'>;
  private tc: TypeChecker;
  private classCache = new Map<string, TokenClass>();
  private cube: boolean;

  constructor(
    readonly env: Environment,
    opts: PrettyOptions = {},
  ) {
    this.opts = { ...defaults, ...opts };
    this.tc = new TypeChecker(env, LocalContext.empty, { fuel: 20_000 });
    this.cube = env.features.cube !== undefined;
  }

  print(e: Expr, lctx: LocalContext = LocalContext.empty): PNode {
    const used = new Set(lctx.decls.map((d) => d.name));
    return this.pp(e, lctx, used, P_BINDER, [], 0);
  }

  toString(e: Expr, lctx: LocalContext = LocalContext.empty): string {
    return flatten(this.print(e, lctx));
  }

  // -------------------------------------------------------------------------

  private levelStr(l: Level): string {
    return levelToString(l, this.opts.mvarName ? (id) => this.opts.mvarName!(id) : undefined);
  }

  private sortNode(l: Level): PNode {
    if (this.cube) {
      const n = toNat(l);
      return { text: n === 0 ? '*' : n === 1 ? '□' : `Sort ${this.levelStr(l)}`, cls: 'sort' };
    }
    const n = toNat(l);
    if (n === 0) return { text: 'Prop', cls: 'sort' };
    if (n === 1) return { text: 'Type', cls: 'sort' };
    const [base, off] = toOffset(l);
    if (off >= 1) {
      const inner = n !== undefined ? String(n - 1) : this.levelStr(off === 1 ? base : offsetLevel(base, off - 1));
      const needParen = /\s/.test(inner);
      return { text: `Type ${needParen ? `(${inner})` : inner}`, cls: 'sort' };
    }
    const s = this.levelStr(l);
    return { text: `Sort ${/\s/.test(s) ? `(${s})` : s}`, cls: 'sort' };
  }

  private classOf(head: Expr, lctx: LocalContext): TokenClass {
    if (!this.opts.classify) return head.k === 'fvar' ? 'var' : 'term';
    let key: string | undefined;
    if (head.k === 'const') {
      key = head.name;
      const c = this.classCache.get(key);
      if (c) return c;
      const d = this.env.get(head.name);
      if (d?.kind === 'ctor') {
        // constructors of Prop-valued types are proofs
      }
    }
    let cls: TokenClass = head.k === 'fvar' ? 'var' : 'term';
    try {
      this.tc.lctx = lctx;
      const t = this.tc.inferOnly(head);
      // result sort of the type (after all Π's)
      let r = this.tc.whnf(t);
      const saved = this.tc.lctx;
      let guard = 0;
      while (r.k === 'pi' && guard++ < 64) {
        const d = { id: freshFVarId(), name: r.name, type: r.type };
        this.tc.lctx = this.tc.lctx.push(d);
        r = this.tc.whnf(instantiate1(r.body, mkFVar(d.id)));
      }
      if (r.k === 'sort') {
        cls = toNat(r.level) === 0 && !this.cube ? 'prop' : 'type';
      } else {
        const s = this.tc.whnf(this.tc.inferOnly(r));
        if (s.k === 'sort' && toNat(s.level) === 0 && !this.cube) cls = 'proof';
        else if (this.env.get((head as { name?: string }).name ?? '')?.kind === 'ctor') cls = 'ctor';
        else cls = head.k === 'fvar' ? 'var' : 'term';
      }
      this.tc.lctx = saved;
    } catch {
      // ignore: fall back to the default class
    }
    if (key) this.classCache.set(key, cls);
    return cls;
  }

  /** which arguments of `fn` are implicit */
  private binderInfos(fn: Expr, lctx: LocalContext): BinderInfo[] {
    let t: Expr | undefined;
    if (fn.k === 'const') t = this.env.get(fn.name)?.type;
    else if (fn.k === 'fvar') t = lctx.get(fn.id)?.type;
    const out: BinderInfo[] = [];
    while (t && t.k === 'pi') {
      out.push(t.binfo);
      t = t.body;
    }
    return out;
  }

  private fresh(name: string, used: Set<string>): string {
    let base = name === '_' || name === '' ? 'x' : name;
    if (base.startsWith('_')) base = base.replace(/^_+/, '') || 'x';
    if (!used.has(base)) return base;
    const subs = '₀₁₂₃₄₅₆₇₈₉';
    const stem = base.replace(/[₀-₉]+$/, '');
    for (let i = 1; ; i++) {
      const cand = stem + String(i).split('').map((d) => subs[+d]).join('');
      if (!used.has(cand)) return cand;
    }
  }

  private wrap(node: PNode, prec: number, ctxPrec: number): PNode {
    if (prec >= ctxPrec) return node;
    return { children: [{ text: '(', cls: 'punct' }, node, { text: ')', cls: 'punct' }], expr: node.expr, lctx: node.lctx, path: node.path };
  }

  private pp(e: Expr, lctx: LocalContext, used: Set<string>, ctxPrec: number, path: number[], depth: number): PNode {
    if (depth > this.opts.maxDepth) return { text: '⋯', cls: 'punct' };
    const node = this.ppCore(e, lctx, used, ctxPrec, path, depth);
    node.expr ??= e;
    node.lctx ??= lctx;
    node.path ??= path;
    return node;
  }

  private ppCore(e: Expr, lctx: LocalContext, used: Set<string>, ctxPrec: number, path: number[], depth: number): PNode {
    switch (e.k) {
      case 'bvar':
        return { text: `#${e.i}`, cls: 'bvar' };
      case 'fvar': {
        const d = lctx.get(e.id);
        return { text: d ? d.name : `?fvar${e.id}`, cls: this.classOf(e, lctx) === 'var' ? 'var' : this.classOf(e, lctx) };
      }
      case 'mvar':
        return { text: this.opts.mvarName ? this.opts.mvarName(e.id) : `?m${e.id}`, cls: 'mvar' };
      case 'sort':
        return this.sortNode(e.level);
      case 'const': {
        if (e.name === 'Nat.zero' && this.opts.numerals && !this.cube) return { text: '0', cls: 'num' };
        const n = this.constNode(e, lctx);
        return n;
      }
      case 'app':
        return this.ppApp(e, lctx, used, ctxPrec, path, depth);
      case 'lam':
        return this.wrap(this.ppLam(e, lctx, used, path, depth), P_BINDER, ctxPrec);
      case 'pi':
        return this.ppPi(e, lctx, used, ctxPrec, path, depth);
      case 'let': {
        const name = this.fresh(e.name, used);
        const d = { id: freshFVarId(), name, type: e.type, value: e.value };
        const l2 = lctx.push(d);
        const u2 = new Set(used).add(name);
        const node: PNode = {
          children: [
            { text: 'let ', cls: 'kw' },
            { text: name, cls: 'var' },
            { text: ' : ', cls: 'punct' },
            this.pp(e.type, lctx, used, P_BINDER, [...path, 0], depth + 1),
            { text: ' := ', cls: 'punct' },
            this.pp(e.value, lctx, used, P_BINDER, [...path, 1], depth + 1),
            { text: '; ', cls: 'punct' },
            this.pp(instantiate1(e.body, mkFVar(d.id)), l2, u2, P_BINDER, [...path, 2], depth + 1),
          ],
        };
        return this.wrap(node, P_BINDER, ctxPrec);
      }
    }
  }

  private constNode(e: Extract<Expr, { k: 'const' }>, lctx: LocalContext, explicitAt = false): PNode {
    let text = this.displayName(e.name);
    if (this.opts.universes && e.levels.length > 0) text += `.{${e.levels.map((l) => this.levelStr(l)).join(', ')}}`;
    const cls = this.classOf(e, lctx);
    return { text: (explicitAt ? '@' : '') + text, cls };
  }

  private displayName(name: string): string {
    for (const ns of this.env.opened) {
      if (name.startsWith(ns + '.')) {
        const short = name.slice(ns.length + 1);
        // only shorten if unambiguous
        if (!this.env.has(short)) return short;
      }
    }
    return name;
  }

  private natValue(e: Expr): number | undefined {
    let n = 0;
    let cur = e;
    for (;;) {
      if (cur.k === 'const' && cur.name === 'Nat.zero') return n;
      if (cur.k === 'app' && cur.fn.k === 'const' && cur.fn.name === 'Nat.succ') {
        n++;
        cur = cur.arg;
        continue;
      }
      return undefined;
    }
  }

  private ppApp(e: Expr, lctx: LocalContext, used: Set<string>, ctxPrec: number, path: number[], depth: number): PNode {
    if (this.opts.numerals && !this.cube) {
      const n = this.natValue(e);
      if (n !== undefined) return { text: String(n), cls: 'num' };
    }
    const fn = getAppFn(e);
    const args = getAppArgs(e);
    const argPath = (i: number) => [...path, ...Array(args.length - 1 - i).fill(0), 1];
    const fnPath = [...path, ...Array(args.length).fill(0)];
    if (fn.k === 'mvar' && this.opts.hideMVarArgs) return { ...this.ppCore(fn, lctx, used, ctxPrec, fnPath, depth), expr: e, path };
    if (this.opts.notation && !this.opts.explicit && fn.k === 'const') {
      const special = this.ppSpecial(fn.name, e, args, lctx, used, ctxPrec, path, argPath, depth);
      if (special) return special;
    }
    const infos = this.binderInfos(fn, lctx);
    const visible: number[] = [];
    args.forEach((_, i) => {
      if (this.opts.explicit || (infos[i] ?? 'default') === 'default') visible.push(i);
    });
    const hidden = visible.length < args.length;

    // notations
    if (this.opts.notation && fn.k === 'const' && !this.opts.explicit) {
      const r = this.ppNotation(fn.name, args, visible, lctx, used, ctxPrec, argPath, depth);
      if (r) return r;
    }

    let head: PNode;
    if (fn.k === 'const') {
      head = this.constNode(fn, lctx, this.opts.explicit && hidden && false);
      head.expr = fn;
      head.lctx = lctx;
      head.path = fnPath;
    } else head = this.pp(fn, lctx, used, P_MAX, fnPath, depth + 1);
    const children: PNode[] = [head];
    for (const i of visible) {
      children.push({ text: ' ' });
      const a = this.pp(args[i], lctx, used, P_MAX, argPath(i), depth + 1);
      if (this.opts.explicit && infos[i] && infos[i] !== 'default') {
        children.push({ children: [{ text: '{', cls: 'punct' }, this.pp(args[i], lctx, used, P_BINDER, argPath(i), depth + 1), { text: '}', cls: 'punct' }] });
      } else children.push(a);
    }
    if (visible.length === 0) return head.expr === e ? head : { children: [head] };
    return this.wrap({ children }, P_APP, ctxPrec);
  }

  /** list literals, tuples and if-then-else */
  private ppSpecial(name: string, e: Expr, args: Expr[], lctx: LocalContext, used: Set<string>, ctxPrec: number, path: number[], argPath: (i: number) => number[], depth: number): PNode | undefined {
    const P = (x: Expr, p: number[], prec = P_BINDER) => this.pp(x, lctx, used, prec, p, depth + 1);
    if (name === 'List.nil' && args.length === 1) return { text: '[]', cls: 'ctor' };
    if (name === 'List.cons' && args.length === 3) {
      // [a, b, c] when the list ends in nil
      const items: { e: Expr; path: number[] }[] = [];
      let cur: Expr = e;
      let p = path;
      for (let guard = 0; guard < 500; guard++) {
        const h = getAppFn(cur);
        const as = getAppArgs(cur);
        if (h.k === 'const' && h.name === 'List.cons' && as.length === 3) {
          items.push({ e: as[1], path: [...p, 0, 1] });
          cur = as[2];
          p = [...p, 1];
          continue;
        }
        if (h.k === 'const' && h.name === 'List.nil' && as.length === 1) {
          const children: PNode[] = [{ text: '[', cls: 'punct' }];
          items.forEach((it, i) => {
            if (i) children.push({ text: ', ', cls: 'punct' });
            children.push(P(it.e, it.path));
          });
          children.push({ text: ']', cls: 'punct' });
          return { children };
        }
        return undefined;
      }
      return undefined;
    }
    if (name === 'Prod.mk' && args.length === 4) {
      return { children: [{ text: '(', cls: 'punct' }, P(args[2], argPath(2)), { text: ', ', cls: 'punct' }, P(args[3], argPath(3)), { text: ')', cls: 'punct' }] };
    }
    if (name === 'ite' && args.length === 5) {
      const node: PNode = {
        children: [
          { text: 'if ', cls: 'kw' },
          P(args[1], argPath(1)),
          { text: ' then ', cls: 'kw' },
          P(args[3], argPath(3)),
          { text: ' else ', cls: 'kw' },
          P(args[4], argPath(4)),
        ],
      };
      return this.wrap(node, P_BINDER, ctxPrec);
    }
    if (name === 'dite' && args.length === 5 && args[3].k === 'lam' && args[4].k === 'lam') {
      const t = args[3];
      const f = args[4];
      const nm = this.fresh(t.name, used);
      const dt = { id: freshFVarId(), name: nm, type: t.type };
      const df = { id: freshFVarId(), name: nm, type: f.type };
      const u2 = new Set(used).add(nm);
      const node: PNode = {
        children: [
          { text: 'if ', cls: 'kw' },
          { text: nm, cls: 'var' },
          { text: ' : ', cls: 'punct' },
          P(args[1], argPath(1)),
          { text: ' then ', cls: 'kw' },
          this.pp(instantiate1(t.body, mkFVar(dt.id)), lctx.push(dt), u2, P_BINDER, [...argPath(3), 1], depth + 1),
          { text: ' else ', cls: 'kw' },
          this.pp(instantiate1(f.body, mkFVar(df.id)), lctx.push(df), u2, P_BINDER, [...argPath(4), 1], depth + 1),
        ],
      };
      return this.wrap(node, P_BINDER, ctxPrec);
    }
    return undefined;
  }

  private ppNotation(
    name: string,
    args: Expr[],
    visible: number[],
    lctx: LocalContext,
    used: Set<string>,
    ctxPrec: number,
    argPath: (i: number) => number[],
    depth: number,
  ): PNode | undefined {
    // ∃ x, p
    if (name === 'Exists' && visible.length === 1) {
      const p = args[visible[0]];
      if (p.k === 'lam') {
        const nm = this.fresh(p.name, used);
        const d = { id: freshFVarId(), name: nm, type: p.type };
        const body = this.pp(instantiate1(p.body, mkFVar(d.id)), lctx.push(d), new Set(used).add(nm), P_BINDER, [...argPath(visible[0]), 1], depth + 1);
        return this.wrap({ children: [{ text: '∃ ', cls: 'kw' }, { text: nm, cls: 'var' }, { text: ', ', cls: 'punct' }, body] }, P_BINDER, ctxPrec);
      }
    }
    // { x : α // p }
    if (name === 'Subtype' && visible.length === 1) {
      const p = args[visible[0]];
      if (p.k === 'lam') {
        const nm = this.fresh(p.name, used);
        const d = { id: freshFVarId(), name: nm, type: p.type };
        const ty = this.pp(p.type, lctx, used, 0, [...argPath(visible[0]), 0], depth + 1);
        const body = this.pp(instantiate1(p.body, mkFVar(d.id)), lctx.push(d), new Set(used).add(nm), 0, [...argPath(visible[0]), 1], depth + 1);
        return {
          children: [{ text: '{ ', cls: 'punct' }, { text: nm, cls: 'var' }, { text: ' : ', cls: 'punct' }, ty, { text: ' // ', cls: 'punct' }, body, { text: ' }', cls: 'punct' }],
        };
      }
    }
    const nt = this.env.notations.find((n) => n.target === name);
    if (!nt) return undefined;
    if ((nt.kind === 'infixl' || nt.kind === 'infixr' || nt.kind === 'infix') && visible.length === 2) {
      const [i, j] = visible;
      const lp = nt.kind === 'infixl' ? nt.prec : nt.prec + 1;
      const rp = nt.kind === 'infixr' ? nt.prec : nt.prec + 1;
      const node: PNode = {
        children: [
          this.pp(args[i], lctx, used, lp, argPath(i), depth + 1),
          { text: ` ${nt.symbol} `, cls: 'op' },
          this.pp(args[j], lctx, used, rp, argPath(j), depth + 1),
        ],
      };
      return this.wrap(node, nt.prec, ctxPrec);
    }
    if (nt.kind === 'prefix' && visible.length === 1) {
      const i = visible[0];
      const node: PNode = { children: [{ text: nt.symbol, cls: 'op' }, this.pp(args[i], lctx, used, nt.prec, argPath(i), depth + 1)] };
      return this.wrap(node, nt.prec, ctxPrec);
    }
    return undefined;
  }

  private ppLam(e: Expr, lctx: LocalContext, used: Set<string>, path: number[], depth: number): PNode {
    const groups: { names: { n: string; path: number[] }[]; type: PNode; binfo: BinderInfo; typeExpr: Expr }[] = [];
    let cur = e;
    let l = lctx;
    let u = new Set(used);
    let p = path;
    while (cur.k === 'lam') {
      const name = this.fresh(cur.name, u);
      const d = { id: freshFVarId(), name, type: cur.type };
      const tyNode = this.pp(cur.type, l, u, P_BINDER, [...p, 0], depth + 1);
      const last = groups[groups.length - 1];
      if (last && last.binfo === cur.binfo && sameText(last.type, tyNode) && !hasLooseBVar(cur.body, 0) === false) {
        last.names.push({ n: name, path: p });
      } else if (last && last.binfo === cur.binfo && sameText(last.type, tyNode)) {
        last.names.push({ n: name, path: p });
      } else {
        groups.push({ names: [{ n: name, path: p }], type: tyNode, binfo: cur.binfo, typeExpr: cur.type });
      }
      l = l.push(d);
      u = new Set(u).add(name);
      cur = instantiate1(cur.body, mkFVar(d.id));
      p = [...p, 1];
    }
    const children: PNode[] = [{ text: 'λ', cls: 'kw' }];
    for (const g of groups) {
      children.push({ text: ' ' });
      const nameNodes: PNode[] = [];
      g.names.forEach((nm, i) => {
        if (i > 0) nameNodes.push({ text: ' ' });
        nameNodes.push({ text: nm.n, cls: 'var' });
      });
      if (this.opts.binderTypes) {
        const [o, c] = g.binfo === 'implicit' ? ['{', '}'] : g.binfo === 'inst' ? ['[', ']'] : ['(', ')'];
        children.push({ children: [{ text: o, cls: 'punct' }, ...nameNodes, { text: ' : ', cls: 'punct' }, g.type, { text: c, cls: 'punct' }] });
      } else children.push(...nameNodes);
    }
    children.push({ text: ' => ', cls: 'kw' });
    children.push(this.pp(cur, l, u, P_BINDER, p, depth + 1));
    return { children };
  }

  private ppPi(e: Extract<Expr, { k: 'pi' }>, lctx: LocalContext, used: Set<string>, ctxPrec: number, path: number[], depth: number): PNode {
    const dependent = hasLooseBVar(e.body, 0);
    if (!dependent && e.binfo === 'default') {
      const d = { id: freshFVarId(), name: this.fresh(e.name, used), type: e.type };
      const node: PNode = {
        children: [
          this.pp(e.type, lctx, used, P_ARROW + 1, [...path, 0], depth + 1),
          { text: ' → ', cls: 'kw' },
          this.pp(instantiate1(e.body, mkFVar(d.id)), lctx.push(d), used, P_ARROW, [...path, 1], depth + 1),
        ],
      };
      return this.wrap(node, P_ARROW, ctxPrec);
    }
    // dependent: group binders with equal types
    const groups: { names: string[]; type: PNode; binfo: BinderInfo }[] = [];
    let cur: Expr = e;
    let l = lctx;
    let u = new Set(used);
    let p = path;
    const isPropValued = this.isPropValued(e, lctx);
    const style: 'forall' | 'pi' | 'arrow' = this.cube ? 'pi' : isPropValued ? 'forall' : 'arrow';
    while (cur.k === 'pi' && (hasLooseBVar(cur.body, 0) || cur.binfo !== 'default')) {
      const name = this.fresh(cur.name, u);
      const d = { id: freshFVarId(), name, type: cur.type };
      const tyNode = this.pp(cur.type, l, u, P_BINDER, [...p, 0], depth + 1);
      const last = groups[groups.length - 1];
      if (last && last.binfo === cur.binfo && sameText(last.type, tyNode)) last.names.push(name);
      else groups.push({ names: [name], type: tyNode, binfo: cur.binfo });
      l = l.push(d);
      u = new Set(u).add(name);
      cur = instantiate1(cur.body, mkFVar(d.id));
      p = [...p, 1];
      if (style === 'arrow') break;
    }
    const binderNodes: PNode[] = [];
    groups.forEach((g, gi) => {
      if (gi > 0) binderNodes.push({ text: ' ' });
      const [o, c] = g.binfo === 'implicit' ? ['{', '}'] : g.binfo === 'strictImplicit' ? ['⦃', '⦄'] : g.binfo === 'inst' ? ['[', ']'] : ['(', ')'];
      binderNodes.push({
        children: [{ text: o, cls: 'punct' }, { text: g.names.join(' '), cls: 'var' }, { text: ' : ', cls: 'punct' }, g.type, { text: c, cls: 'punct' }],
      });
    });
    const body = this.pp(cur, l, u, style === 'arrow' ? P_ARROW : P_BINDER, p, depth + 1);
    let node: PNode;
    if (style === 'arrow') {
      node = { children: [...binderNodes, { text: ' → ', cls: 'kw' }, body] };
      return this.wrap(node, P_ARROW, ctxPrec);
    }
    node = { children: [{ text: style === 'forall' ? '∀ ' : 'Π ', cls: 'kw' }, ...binderNodes, { text: ', ', cls: 'punct' }, body] };
    return this.wrap(node, P_BINDER, ctxPrec);
  }

  private isPropValued(e: Expr, lctx: LocalContext): boolean {
    if (!this.opts.classify) return false;
    try {
      this.tc.lctx = lctx;
      const s = this.tc.whnf(this.tc.inferOnly(e));
      return s.k === 'sort' && toNat(s.level) === 0;
    } catch {
      return false;
    }
  }
}

function offsetLevel(l: Level, k: number): Level {
  for (let i = 0; i < k; i++) l = { k: 'succ', l };
  return l;
}

function sameText(a: PNode, b: PNode): boolean {
  return flatten(a) === flatten(b);
}

export function flatten(n: PNode): string {
  if (n.text !== undefined) return n.text;
  let s = '';
  for (const c of n.children ?? []) s += flatten(c);
  return s;
}

/** Convenience: print an expression to a string. */
export function pp(env: Environment, e: Expr, lctx: LocalContext = LocalContext.empty, opts: PrettyOptions = {}): string {
  return new Printer(env, { classify: false, ...opts }).toString(e, lctx);
}

/** Print a local context as `x : A, y : B`. */
export function ppContext(env: Environment, lctx: LocalContext, opts: PrettyOptions = {}): string[] {
  const printer = new Printer(env, { classify: false, ...opts });
  let l = LocalContext.empty;
  const out: string[] = [];
  for (const d of lctx.decls) {
    out.push(`${d.name} : ${printer.toString(d.type, l)}`);
    l = l.push(d);
  }
  return out;
}
