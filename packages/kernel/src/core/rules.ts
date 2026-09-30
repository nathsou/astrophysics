// The inference rules, as displayed in the text and in derivation trees.
//
// Derivation nodes produced by the kernel refer to these ids, so the rules the
// reader sees are the rules the kernel applies.

export interface RuleDef {
  id: string;
  name: string;
  premises: string[];
  conclusion: string;
  side?: string;
  blurb: string;
}

const r = (id: string, name: string, premises: string[], conclusion: string, blurb: string, side?: string): RuleDef => ({
  id,
  name,
  premises,
  conclusion,
  blurb,
  side,
});

export const rules: Record<string, RuleDef> = Object.fromEntries(
  [
    // --- simply typed λ-calculus (textbook form) ---------------------------
    r('stlc.var', 'Var', [], '\\Gamma \\vdash x : A', 'A variable has the type the context assigns to it.', '(x : A) \\in \\Gamma'),
    r('stlc.abs', 'Abs', ['\\Gamma,\\, x : A \\vdash t : B'], '\\Gamma \\vdash \\lambda (x : A).\\, t : A \\to B', 'To type a function, type its body assuming a variable of the argument type.'),
    r('stlc.app', 'App', ['\\Gamma \\vdash f : A \\to B', '\\Gamma \\vdash a : A'], '\\Gamma \\vdash f\\ a : B', 'Applying a function to an argument of its domain gives a value of its codomain.'),
    // --- System F ------------------------------------------------------------
    r('f.tabs', 'TAbs', ['\\Gamma,\\, \\alpha \\vdash t : B'], '\\Gamma \\vdash \\Lambda \\alpha.\\, t : \\forall \\alpha.\\, B', 'Abstracting over a type variable gives a polymorphic term.'),
    r('f.tapp', 'TApp', ['\\Gamma \\vdash t : \\forall \\alpha.\\, B'], '\\Gamma \\vdash t\\ [A] : B[A/\\alpha]', 'A polymorphic term can be instantiated at any type.'),
    // --- Pure Type Systems ---------------------------------------------------
    r('pts.axiom', 'Axiom', [], '\\vdash s_1 : s_2', 'The sorts are typed by the axioms of the system.', '(s_1, s_2) \\in \\mathcal{A}'),
    r('pts.start', 'Start', ['\\Gamma \\vdash A : s'], '\\Gamma,\\, x : A \\vdash x : A', 'A freshly declared variable has its declared type.', 'x \\notin \\Gamma'),
    r('pts.weak', 'Weakening', ['\\Gamma \\vdash t : B', '\\Gamma \\vdash A : s'], '\\Gamma,\\, x : A \\vdash t : B', 'Adding an unused hypothesis preserves typing.', 'x \\notin \\Gamma'),
    r('pts.prod', 'Product', ['\\Gamma \\vdash A : s_1', '\\Gamma,\\, x : A \\vdash B : s_2'], '\\Gamma \\vdash \\Pi (x : A).\\, B : s_3', 'A Π-type may be formed when its sorts form a rule of the system.', '(s_1, s_2, s_3) \\in \\mathcal{R}'),
    r('pts.abs', 'Abstraction', ['\\Gamma,\\, x : A \\vdash t : B', '\\Gamma \\vdash \\Pi (x : A).\\, B : s'], '\\Gamma \\vdash \\lambda (x : A).\\, t : \\Pi (x : A).\\, B', 'A λ-abstraction has a Π-type, provided that Π-type is well formed.'),
    r('pts.app', 'Application', ['\\Gamma \\vdash f : \\Pi (x : A).\\, B', '\\Gamma \\vdash a : A'], '\\Gamma \\vdash f\\ a : B[a/x]', 'The type of an application may depend on the argument.'),
    r('pts.conv', 'Conversion', ['\\Gamma \\vdash t : A', '\\Gamma \\vdash B : s'], '\\Gamma \\vdash t : B', 'Types that compute to the same thing are interchangeable.', 'A \\equiv_{\\beta} B'),
    // --- the kernel's algorithmic rules (used in derivation trees) ----------
    r('var', 'Var', [], '\\Gamma \\vdash x : A', 'Look the variable up in the context.', '(x : A) \\in \\Gamma'),
    r('sort', 'Sort', [], '\\Gamma \\vdash \\mathsf{Sort}\\ u : \\mathsf{Sort}\\ (u+1)', 'Every universe lives in the next one.'),
    r('const', 'Const', [], '\\Gamma \\vdash c : A', 'Look the constant up in the global environment Σ.', '(c : A) \\in \\Sigma'),
    r('pi', 'Pi', ['\\Gamma \\vdash A : \\mathsf{Sort}\\ u', '\\Gamma,\\, x : A \\vdash B : \\mathsf{Sort}\\ v'], '\\Gamma \\vdash (x : A) \\to B : \\mathsf{Sort}\\ (\\mathrm{imax}\\ u\\ v)', 'Π-types live in the larger of the two universes — or in Prop when B is a proposition.'),
    r('lam', 'Lam', ['\\Gamma \\vdash A : \\mathsf{Sort}\\ u', '\\Gamma,\\, x : A \\vdash t : B'], '\\Gamma \\vdash \\lambda (x : A) \\Rightarrow t : (x : A) \\to B', 'Check the binder is a type, then type the body.'),
    r('app', 'App', ['\\Gamma \\vdash f : (x : A) \\to B', '\\Gamma \\vdash a : A\'', ], '\\Gamma \\vdash f\\ a : B[a/x]', 'The argument’s type must be definitionally equal to the domain.', "A \\equiv A'"),
    r('let', 'Let', ['\\Gamma \\vdash A : \\mathsf{Sort}\\ u', '\\Gamma \\vdash v : A', '\\Gamma,\\, x := v : A \\vdash t : B'], '\\Gamma \\vdash \\mathsf{let}\\ x := v;\\ t : B[v/x]', 'A local definition is available, with its value, in the body.'),
    r('conv', 'Conv', ['\\Gamma \\vdash t : A'], '\\Gamma \\vdash t : B', 'Definitionally equal types are interchangeable.', 'A \\equiv B'),
    // --- inductive types -------------------------------------------------
    r('ind.form', 'Formation', [], '\\Gamma \\vdash I : (\\vec{p} : \\vec{P}) \\to (\\vec{i} : \\vec{J}) \\to \\mathsf{Sort}\\ u', 'The inductive type itself is a constant of the environment.'),
    r('ind.intro', 'Introduction', [], '\\Gamma \\vdash c_k : (\\vec{p} : \\vec{P}) \\to (\\vec{b} : \\vec{B}) \\to I\\ \\vec{p}\\ \\vec{t}', 'Constructors build elements of the type.'),
    r('ind.elim', 'Elimination', ['\\Gamma \\vdash M : (\\vec{i}) \\to I\\ \\vec{p}\\ \\vec{i} \\to \\mathsf{Sort}\\ v', '\\Gamma \\vdash m_k : \\dots \\text{(one minor premise per constructor)}', '\\Gamma \\vdash t : I\\ \\vec{p}\\ \\vec{i}'], '\\Gamma \\vdash I.\\mathsf{rec}\\ M\\ \\vec{m}\\ t : M\\ \\vec{i}\\ t', 'To define a function out of I (or prove a property of all elements) give one case per constructor.'),
    r('ind.iota', 'ι-reduction', [], 'I.\\mathsf{rec}\\ M\\ \\vec{m}\\ (c_k\\ \\vec{b}) \\;\\rightsquigarrow\\; m_k\\ \\vec{b}\\ \\vec{\\mathit{ih}}', 'The recursor computes: applied to a constructor it selects the corresponding case.'),
  ].map((x) => [x.id, x]),
);

/** display name of a kernel derivation rule */
export function ruleName(id: string): string {
  return rules[id]?.name ?? id;
}
