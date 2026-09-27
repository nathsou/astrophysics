// Propositional natural deduction, with the proof term of every derivation.
//
// Used by the Curry–Howard chapter: the reader builds a natural-deduction
// proof goal-first and watches the corresponding λ-term appear.

export type F =
  | { k: 'atom'; name: string }
  | { k: 'top' }
  | { k: 'bot' }
  | { k: 'imp'; a: F; b: F }
  | { k: 'and'; a: F; b: F }
  | { k: 'or'; a: F; b: F };

export const atom = (name: string): F => ({ k: 'atom', name });
export const imp = (a: F, b: F): F => ({ k: 'imp', a, b });

export function feq(a: F, b: F): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'atom':
      return a.name === (b as typeof a).name;
    case 'top':
    case 'bot':
      return true;
    default:
      return feq(a.a, (b as typeof a).a) && feq(a.b, (b as typeof a).b);
  }
}

const PREC = { imp: 1, or: 2, and: 3 } as const;

export function fstr(f: F, prec = 0): string {
  switch (f.k) {
    case 'atom':
      return f.name;
    case 'top':
      return '⊤';
    case 'bot':
      return '⊥';
    case 'imp': {
      if (f.b.k === 'bot') {
        const s = `¬${fstr(f.a, 4)}`;
        return s;
      }
      const s = `${fstr(f.a, PREC.imp + 1)} → ${fstr(f.b, PREC.imp)}`;
      return prec > PREC.imp ? `(${s})` : s;
    }
    case 'and': {
      const s = `${fstr(f.a, PREC.and + 1)} ∧ ${fstr(f.b, PREC.and)}`;
      return prec > PREC.and ? `(${s})` : s;
    }
    case 'or': {
      const s = `${fstr(f.a, PREC.or + 1)} ∨ ${fstr(f.b, PREC.or)}`;
      return prec > PREC.or ? `(${s})` : s;
    }
  }
}

/** Formulas as types, in the course's Lean-like syntax. */
export function fLean(f: F, prec = 0): string {
  switch (f.k) {
    case 'atom':
      return f.name;
    case 'top':
      return 'True';
    case 'bot':
      return 'False';
    case 'imp': {
      const s = `${fLean(f.a, PREC.imp + 1)} → ${fLean(f.b, PREC.imp)}`;
      return prec > PREC.imp ? `(${s})` : s;
    }
    case 'and': {
      const s = `${fLean(f.a, PREC.and + 1)} ∧ ${fLean(f.b, PREC.and)}`;
      return prec > PREC.and ? `(${s})` : s;
    }
    case 'or': {
      const s = `${fLean(f.a, PREC.or + 1)} ∨ ${fLean(f.b, PREC.or)}`;
      return prec > PREC.or ? `(${s})` : s;
    }
  }
}

export function parseFormula(src: string): F {
  let i = 0;
  const ws = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const peek = (s: string) => {
    ws();
    return src.startsWith(s, i);
  };
  const eat = (...ss: string[]) => {
    ws();
    for (const s of ss)
      if (src.startsWith(s, i)) {
        i += s.length;
        return true;
      }
    return false;
  };
  const impl = (): F => {
    const a = disj();
    if (eat('→', '->')) return imp(a, impl());
    if (eat('↔', '<->')) {
      const b = impl();
      return { k: 'and', a: imp(a, b), b: imp(b, a) };
    }
    return a;
  };
  const disj = (): F => {
    const a = conj();
    if (eat('∨', '\\/', '|')) return { k: 'or', a, b: disj() };
    return a;
  };
  const conj = (): F => {
    const a = unary();
    if (eat('∧', '/\\', '&')) return { k: 'and', a, b: conj() };
    return a;
  };
  const unary = (): F => {
    if (eat('¬', '~', '!')) return imp(unary(), { k: 'bot' });
    if (eat('(')) {
      const f = impl();
      if (!eat(')')) throw new Error(`expected ')' at position ${i}`);
      return f;
    }
    if (eat('⊤', 'True')) return { k: 'top' };
    if (eat('⊥', 'False')) return { k: 'bot' };
    ws();
    const m = /^[A-Za-z][A-Za-z0-9_']*/.exec(src.slice(i));
    if (!m) throw new Error(i >= src.length ? 'unexpected end of formula' : `unexpected '${src[i]}' at position ${i}`);
    i += m[0].length;
    return atom(m[0]);
  };
  const f = impl();
  ws();
  if (i < src.length) throw new Error(`unexpected '${src[i]}' at position ${i}`);
  void peek;
  return f;
}

// ---------------------------------------------------------------------------
// proof trees

export type RuleId =
  | 'hyp'
  | 'impI'
  | 'impE'
  | 'andI'
  | 'andE1'
  | 'andE2'
  | 'orI1'
  | 'orI2'
  | 'orE'
  | 'botE'
  | 'topI'
  | 'lem';

export interface Hyp {
  name: string;
  f: F;
}

export interface PNode {
  id: number;
  goal: F;
  ctx: Hyp[];
  rule?: RuleId;
  /** hypothesis used by `hyp`, or discharged by `impI` / `orE` */
  hyp?: string;
  hyps?: string[];
  children: PNode[];
}

export const ruleInfo: Record<RuleId, { label: string; name: string; term: string; classical?: boolean }> = {
  hyp: { label: 'hyp', name: 'Assumption', term: 'x' },
  impI: { label: '→I', name: 'Implication introduction', term: 'λ (x : A) => t' },
  impE: { label: '→E', name: 'Implication elimination (modus ponens)', term: 'f a' },
  andI: { label: '∧I', name: 'Conjunction introduction', term: '⟨a, b⟩' },
  andE1: { label: '∧E₁', name: 'Conjunction elimination (left)', term: 'p.1' },
  andE2: { label: '∧E₂', name: 'Conjunction elimination (right)', term: 'p.2' },
  orI1: { label: '∨I₁', name: 'Disjunction introduction (left)', term: 'Or.inl a' },
  orI2: { label: '∨I₂', name: 'Disjunction introduction (right)', term: 'Or.inr b' },
  orE: { label: '∨E', name: 'Disjunction elimination (case analysis)', term: 'Or.elim d (λ x => s) (λ y => t)' },
  botE: { label: '⊥E', name: 'Ex falso quodlibet', term: 'False.elim p' },
  topI: { label: '⊤I', name: 'Truth introduction', term: 'True.intro' },
  lem: { label: 'LEM', name: 'Excluded middle (classical!)', term: 'Classical.em A', classical: true },
};

let ids = 1;
export const newGoal = (goal: F, ctx: Hyp[]): PNode => ({ id: ids++, goal, ctx, children: [] });

function freshHyp(ctx: Hyp[], base = 'h'): string {
  const used = new Set(ctx.map((h) => h.name));
  for (let i = 1; ; i++) {
    const n = `${base}${String(i).replace(/./g, (d) => '₀₁₂₃₄₅₆₇₈₉'[+d])}`;
    if (!used.has(n)) return n;
  }
}

export interface RuleArgs {
  /** hypothesis name for `hyp` */
  hyp?: string;
  /** the auxiliary formula: premise of →E, other conjunct of ∧E, disjunction of ∨E, A for LEM */
  aux?: F;
}

/** which rules could apply to a goal (the UI then asks for arguments) */
export function applicable(n: PNode): RuleId[] {
  const out: RuleId[] = [];
  const g = n.goal;
  if (n.ctx.some((h) => feq(h.f, g))) out.push('hyp');
  if (g.k === 'imp') out.push('impI');
  out.push('impE');
  if (g.k === 'and') out.push('andI');
  out.push('andE1', 'andE2');
  if (g.k === 'or') out.push('orI1', 'orI2');
  out.push('orE', 'botE');
  if (g.k === 'top') out.push('topI');
  return out;
}

/** apply a rule to an open goal, returning the new node (or an error message) */
export function applyRule(n: PNode, rule: RuleId, args: RuleArgs = {}): PNode | string {
  const g = n.goal;
  const c = n.ctx;
  const bot: F = { k: 'bot' };
  switch (rule) {
    case 'hyp': {
      const h = c.find((h) => h.name === args.hyp) ?? c.find((h) => feq(h.f, g));
      if (!h || !feq(h.f, g)) return 'no hypothesis matches the goal';
      return { ...n, rule, hyp: h.name, children: [] };
    }
    case 'impI': {
      if (g.k !== 'imp') return 'the goal is not an implication';
      const x = freshHyp(c);
      return { ...n, rule, hyp: x, children: [newGoal(g.b, [...c, { name: x, f: g.a }])] };
    }
    case 'impE': {
      if (!args.aux) return 'which premise A should be used (from A → goal and A)?';
      return { ...n, rule, children: [newGoal(imp(args.aux, g), c), newGoal(args.aux, c)] };
    }
    case 'andI':
      if (g.k !== 'and') return 'the goal is not a conjunction';
      return { ...n, rule, children: [newGoal(g.a, c), newGoal(g.b, c)] };
    case 'andE1':
      if (!args.aux) return 'what is the other conjunct B (from goal ∧ B)?';
      return { ...n, rule, children: [newGoal({ k: 'and', a: g, b: args.aux }, c)] };
    case 'andE2':
      if (!args.aux) return 'what is the other conjunct A (from A ∧ goal)?';
      return { ...n, rule, children: [newGoal({ k: 'and', a: args.aux, b: g }, c)] };
    case 'orI1':
      if (g.k !== 'or') return 'the goal is not a disjunction';
      return { ...n, rule, children: [newGoal(g.a, c)] };
    case 'orI2':
      if (g.k !== 'or') return 'the goal is not a disjunction';
      return { ...n, rule, children: [newGoal(g.b, c)] };
    case 'orE': {
      const d = args.aux;
      if (!d || d.k !== 'or') return 'which disjunction A ∨ B should be analysed?';
      const x = freshHyp(c);
      const y = freshHyp([...c, { name: x, f: d.a }]);
      return {
        ...n,
        rule,
        hyps: [x, y],
        children: [newGoal(d, c), newGoal(g, [...c, { name: x, f: d.a }]), newGoal(g, [...c, { name: y, f: d.b }])],
      };
    }
    case 'botE':
      return { ...n, rule, children: [newGoal(bot, c)] };
    case 'topI':
      if (g.k !== 'top') return 'the goal is not ⊤';
      return { ...n, rule, children: [] };
    case 'lem': {
      if (!args.aux) return 'which proposition A?';
      return { ...n, rule, children: [] };
    }
  }
}

/** replace node `id` in the tree */
export function replaceNode(root: PNode, id: number, f: (n: PNode) => PNode): PNode {
  if (root.id === id) return f(root);
  return { ...root, children: root.children.map((c) => replaceNode(c, id, f)) };
}

export function openGoals(n: PNode): PNode[] {
  if (!n.rule) return [n];
  return n.children.flatMap(openGoals);
}

export function isComplete(n: PNode): boolean {
  return openGoals(n).length === 0;
}

export function usesClassical(n: PNode): boolean {
  return n.rule === 'lem' || n.children.some(usesClassical);
}

/** the proof term (with ?holes for open goals) — the Curry–Howard reading */
export interface TermPart {
  text: string;
  node?: number;
}

export function proofTerm(n: PNode): TermPart[] {
  const out: TermPart[] = [];
  const go = (n: PNode, prec: number) => {
    const push = (text: string) => out.push({ text, node: n.id });
    const paren = (p: boolean, f: () => void) => {
      if (p) push('(');
      f();
      if (p) push(')');
    };
    if (!n.rule) {
      push(`?${n.id}`);
      return;
    }
    const [a, b, c] = n.children;
    switch (n.rule) {
      case 'hyp':
        push(n.hyp!);
        return;
      case 'impI':
        paren(prec > 0, () => {
          push(`λ (${n.hyp} : ${fLean((n.goal as { a: F }).a)}) => `);
          go(a, 0);
        });
        return;
      case 'impE':
        paren(prec > 1, () => {
          go(a, 1);
          push(' ');
          go(b, 2);
        });
        return;
      case 'andI':
        push('⟨');
        go(a, 0);
        push(', ');
        go(b, 0);
        push('⟩');
        return;
      case 'andE1':
      case 'andE2':
        go(a, 2);
        push(n.rule === 'andE1' ? '.1' : '.2');
        return;
      case 'orI1':
      case 'orI2':
        paren(prec > 1, () => {
          push(n.rule === 'orI1' ? 'Or.inl ' : 'Or.inr ');
          go(a, 2);
        });
        return;
      case 'orE': {
        const d = a.goal as Extract<F, { k: 'or' }>;
        paren(prec > 1, () => {
          push('Or.elim ');
          go(a, 2);
          push(` (λ (${n.hyps![0]} : ${fLean(d.a)}) => `);
          go(b, 0);
          push(`) (λ (${n.hyps![1]} : ${fLean(d.b)}) => `);
          go(c, 0);
          push(')');
        });
        return;
      }
      case 'botE':
        paren(prec > 1, () => {
          push('False.elim ');
          go(a, 2);
        });
        return;
      case 'topI':
        push('True.intro');
        return;
      case 'lem':
        push('Classical.em _');
        return;
    }
  };
  go(n, 0);
  return out;
}

/** atoms occurring in a formula */
export function atoms(f: F, out = new Set<string>()): Set<string> {
  if (f.k === 'atom') out.add(f.name);
  else if (f.k === 'imp' || f.k === 'and' || f.k === 'or') {
    atoms(f.a, out);
    atoms(f.b, out);
  }
  return out;
}

/** classical validity via truth tables (to tell the reader when a goal is hopeless) */
export function isTautology(f: F): boolean {
  const as = [...atoms(f)];
  const ev = (f: F, v: Map<string, boolean>): boolean => {
    switch (f.k) {
      case 'atom':
        return v.get(f.name)!;
      case 'top':
        return true;
      case 'bot':
        return false;
      case 'imp':
        return !ev(f.a, v) || ev(f.b, v);
      case 'and':
        return ev(f.a, v) && ev(f.b, v);
      case 'or':
        return ev(f.a, v) || ev(f.b, v);
    }
  };
  for (let m = 0; m < 1 << as.length; m++) {
    const v = new Map(as.map((a, i) => [a, !!(m & (1 << i))]));
    if (!ev(f, v)) return false;
  }
  return true;
}
