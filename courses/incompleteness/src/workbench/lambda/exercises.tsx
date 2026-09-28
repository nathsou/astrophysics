// Exercises for chapter 9, with answers checked by the lambda-calculus engine. Checks reduce by
// normal order with a step limit; an answer that does not reach a normal form within it is
// reported as such, not as wrong.

import type { ReactNode } from 'react';
import { alphaEq, allNames, apps, booleanValue, churchBoolean, churchNumeral, freeVars, normalize, numeralValue, parseLambda, print, tryParseLambda, variable, type Term } from '../../engine/lambda/lambda';
import { Exercise } from '../../ui/Exercise';
import { Tex } from '../../ui/Tex';

const FUEL = 4000;

type Verdict = { ok: boolean; message?: ReactNode };

function parseAnswer(a: string): { ok: true; t: Term } | { ok: false; v: Verdict } {
  const r = tryParseLambda(a.trim(), { maxNumeral: 50 });
  if (!r.ok) return { ok: false, v: { ok: false, message: `That is not a λ-term: ${r.error} (at position ${r.pos + 1}).` } };
  return { ok: true, t: r.value };
}

function nf(t: Term): Term | null {
  return normalize(t, { fuel: FUEL, maxSize: 5000 });
}

const noNF = (what: ReactNode): Verdict => ({ ok: false, message: <>No normal form was reached for {what} within {FUEL} steps, so the answer could not be confirmed.</> });

/** Checks F on a list of inputs: F applied to the numerals must reduce to the expected numeral/boolean. */
type Case = { args: Term[]; want: number | boolean; show: string };

function checkFunction(a: string, cases: Case[]): Verdict {
  const p = parseAnswer(a);
  return p.ok ? checkTerm(p.t, cases) : p.v;
}

function checkTerm(t: Term, cases: Case[]): Verdict {
  for (const c of cases) {
    const r = nf(apps(t, ...c.args));
    if (!r) return noNF(<Tex tex={c.show} />);
    const got = typeof c.want === 'number' ? numeralValue(r) : booleanValue(r);
    if (got !== c.want)
      return {
        ok: false,
        message: (
          <>
            <Tex tex={c.show} /> reduces to <code>{print(r, { numerals: true, labels: true })}</code>, not <Tex tex={typeof c.want === 'number' ? `\\overline{${c.want}}` : `\\mathrm{${c.want}}`} />.
          </>
        ),
      };
  }
  return { ok: true, message: `Correct on all ${cases.length} test inputs (checked by reduction to normal form).` };
}

const N = (n: number) => churchNumeral(n);
const B = (b: boolean) => churchBoolean(b);

// ------------------------------------------------------------------ syntax

export function ExLamFree() {
  const t = parseLambda('λx.x (λy.y z) y');
  const want = [...freeVars(t)].sort().join(',');
  return (
    <Exercise
      id="lam.syn.free"
      title="Free variables"
      placeholder="e.g. x, y"
      check={(a) => {
        const got = a
          .split(/[\s,{}]+/)
          .filter(Boolean)
          .sort()
          .join(',');
        return { ok: got === want, message: got === want ? 'Right: z is free inside λy.yz, and the last y is outside the scope of λy.' : 'Not quite. For each occurrence, look for a λ binding that variable whose scope contains it.' };
      }}
      hint="The scope of λy is only (λy.yz): it is inside parentheses."
    >
      <p>
        Which variables occur free in <Tex tex="\lambda x.\,x\,(\lambda y.\,yz)\,y" />? List them, separated by commas.
      </p>
    </Exercise>
  );
}

export function ExLamAlpha() {
  const t = parseLambda('λx.λy.x (λx.y x)');
  return (
    <Exercise
      id="lam.syn.alpha"
      title="Rename the bound variables"
      placeholder="a λ-term"
      check={(a) => {
        const p = parseAnswer(a);
        if (!p.ok) return p.v;
        const names = allNames(p.t);
        if (names.has('x') || names.has('y')) return { ok: false, message: 'Use no x or y at all.' };
        return alphaEq(p.t, t) ? { ok: true, message: 'α-equivalent, with fresh names.' } : { ok: false, message: 'That term is not α-equivalent to the given one: some occurrence now refers to a different λ.' };
      }}
      hint="The inner λx binds only the last x. Give it a name different from the outer one."
    >
      <p>
        Write a term α-equivalent to <Tex tex="\lambda x.\lambda y.\,x\,(\lambda x.\,y\,x)" /> in which neither <i>x</i> nor <i>y</i> occurs.
      </p>
    </Exercise>
  );
}

// ------------------------------------------------------------------ reduction

export function ExLamCapture() {
  const want = parseLambda("λy'. y y'");
  const wrong = parseLambda('λy. y y');
  return (
    <Exercise
      id="lam.red.capture"
      title="Reduce by hand"
      placeholder="the normal form"
      check={(a) => {
        const p = parseAnswer(a);
        if (!p.ok) return p.v;
        if (alphaEq(p.t, want)) return { ok: true, message: 'Right. The bound y had to be renamed before y was substituted for x.' };
        if (alphaEq(p.t, wrong)) return { ok: false, message: 'That is naive replacement: the substituted y was captured by λy. Rename the bound y first.' };
        return { ok: false, message: 'Not the normal form. Which λ is the redex’s, what is substituted, and for what?' };
      }}
      hint={
        <>
          The redex is the whole term; its contractum is <Tex tex="(\lambda y.\,xy)[y/x]" />.
        </>
      }
    >
      <p>
        Reduce <Tex tex="(\lambda x.\lambda y.\,xy)\,y" /> to normal form. (Primes are allowed in variable names: <code>y'</code>.)
      </p>
    </Exercise>
  );
}

export function ExLamNormalForm() {
  const want = parseLambda('z z');
  return (
    <Exercise
      id="lam.cr.nf"
      title="The normal form"
      placeholder="a λ-term"
      check={(a) => {
        const p = parseAnswer(a);
        if (!p.ok) return p.v;
        return alphaEq(p.t, want) ? { ok: true, message: 'Right — and every reduction path that ends, ends there. Draw the graph in Explore mode.' } : { ok: false, message: 'Not the normal form. Contract redexes until none are left.' };
      }}
    >
      <p>
        What is the normal form of <Tex tex="(\lambda x.\,xx)((\lambda y.\,y)\,z)" />? Reduce it in two different orders and compare.
      </p>
    </Exercise>
  );
}

export function ExLamCurry() {
  const [a, b, c] = ['a', 'b', 'c'].map((x) => variable(x));
  return (
    <Exercise
      id="lam.cur.second"
      title="A curried projection"
      placeholder="a λ-term"
      check={(ans) => {
        const p = parseAnswer(ans);
        if (!p.ok) return p.v;
        const r = nf(apps(p.t, a!, b!, c!));
        if (!r) return noNF('your term applied to a, b, c');
        return alphaEq(r, variable('b')) ? { ok: true, message: 'Right: applied to M₁ M₂ M₃ it reduces to M₂.' } : { ok: false, message: <>Applied to a, b, c your term reduces to <code>{print(r)}</code>, not b.</> };
      }}
    >
      <p>Write a term that accepts three arguments, one at a time, and returns the second.</p>
    </Exercise>
  );
}

// ------------------------------------------------------------------ arithmetic

export function ExLamTwiceSucc() {
  return (
    <Exercise
      id="lam.arf.double-plus-one"
      title="λ-define 2n + 1"
      placeholder="a λ-term, e.g. λn. …"
      check={(a) => checkFunction(a, [0, 1, 2, 3, 5].map((n) => ({ args: [N(n)], want: 2 * n + 1, show: `F\\,\\overline{${n}}` })))}
      hint={
        <>
          You may use the book’s terms (Succ, Add, Mult, …). Or directly: <Tex tex="\overline{2n+1}\,f\,x = f(f^{n}(f^{n}x))" />.
        </>
      }
    >
      <p>
        Write a term <i>F</i> that λ-defines <Tex tex="f(n) = 2n + 1" />: <Tex tex="F\,\overline n \twoheadrightarrow \overline{2n+1}" />.
      </p>
    </Exercise>
  );
}

export function ExLamOr() {
  return (
    <Exercise
      id="lam.tvr.or"
      title="Or"
      placeholder="λx y. …"
      check={(a) =>
        checkFunction(
          a,
          [true, false].flatMap((x) => [true, false].map((y) => ({ args: [B(x), B(y)], want: x || y, show: `\\mathrm{Or}\\,\\mathrm{${x}}\\,\\mathrm{${y}}` }))),
        )
      }
      hint="Let x do the choosing, as in And: what should Or x y be when x is true, and what when x is false?"
    >
      <p>
        Define a term <Tex tex="\mathrm{Or}" /> representing inclusive disjunction: <Tex tex="\mathrm{Or}\,x\,y" /> must reduce to <Tex tex="\mathrm{true}" /> iff <i>x</i> or <i>y</i> is <Tex tex="\mathrm{true}" />.
      </p>
    </Exercise>
  );
}

export function ExLamXor() {
  return (
    <Exercise
      id="lam.tvr.xor"
      title="Xor"
      placeholder="λx y. …"
      check={(a) =>
        checkFunction(
          a,
          [true, false].flatMap((x) => [true, false].map((y) => ({ args: [B(x), B(y)], want: x !== y, show: `\\mathrm{Xor}\\,\\mathrm{${x}}\\,\\mathrm{${y}}` }))),
        )
      }
      hint="Again let x choose: when x is true, how does the answer depend on y? And when x is false?"
    >
      <p>
        Now exclusive disjunction: <Tex tex="\mathrm{Xor}\,x\,y" /> reduces to <Tex tex="\mathrm{true}" /> iff exactly one of <i>x</i>, <i>y</i> is <Tex tex="\mathrm{true}" />.
      </p>
    </Exercise>
  );
}

export function ExLamSwap() {
  const want = parseLambda('λf. f b a');
  return (
    <Exercise
      id="lam.pai.swap"
      title="Swap a pair"
      placeholder="λp. …"
      check={(ans) => {
        const p = parseAnswer(ans);
        if (!p.ok) return p.v;
        const r = nf(apps(p.t, parseLambda('⟨a, b⟩')));
        if (!r) return noNF('Swap ⟨a, b⟩');
        return alphaEq(r, want) ? { ok: true, message: 'Right: Swap ⟨a, b⟩ ↠ ⟨b, a⟩.' } : { ok: false, message: <>Swap ⟨a, b⟩ reduces to <code>{print(r)}</code>, which is not ⟨b, a⟩ = λf.f b a.</> };
      }}
      hint="Use Fst and Snd, and build the new pair with ⟨…, …⟩ or Pair."
    >
      <p>
        Write a term Swap with <Tex tex="\mathrm{Swap}\,\langle M, N\rangle \twoheadrightarrow \langle N, M\rangle" />. (It is checked on <Tex tex="\langle a, b\rangle" /> for variables <i>a</i>, <i>b</i>.)
      </p>
    </Exercise>
  );
}

export function ExLamEven() {
  return (
    <Exercise
      id="lam.prf.even"
      title="An even relation"
      placeholder="λn. …"
      check={(a) => checkFunction(a, [0, 1, 2, 3, 4, 7].map((n) => ({ args: [N(n)], want: n % 2 === 0, show: `\\mathrm{Even}\\,\\overline{${n}}` })))}
      hint="A numeral is an iterator. What should one step do to a truth value?"
    >
      <p>
        λ-define the relation “<i>n</i> is even”: a term Even with <Tex tex="\mathrm{Even}\,\overline n \twoheadrightarrow \mathrm{true}" /> if <i>n</i> is even and <Tex tex="\mathrm{false}" /> otherwise.
      </p>
    </Exercise>
  );
}

export function ExLamSum() {
  return (
    <Exercise
      id="lam.fp.pow2"
      title="Recursion with Y"
      placeholder="λg n. …"
      check={(a) => {
        const p = parseAnswer(a);
        if (!p.ok) return p.v;
        return checkTerm(apps(parseLambda('Y'), p.t), [0, 1, 2, 3].map((n) => ({ args: [N(n)], want: 2 ** n, show: `Y\\,P'\\,\\overline{${n}}` })));
      }}
      hint={
        <>
          Follow <Tex tex="\mathrm{Fac}'" />: test <i>n</i> with IsZero, and call <i>g</i> on <Tex tex="\mathrm{Pred}\,n" />.
        </>
      }
    >
      <p>
        Write a term <Tex tex="P'" /> such that <Tex tex="Y\,P'" /> λ-defines <Tex tex="p(n) = 2^n" />, via the recursion <Tex tex="p(0) = 1" />, <Tex tex="p(n) = 2 \cdot p(n - 1)" /> for <Tex tex="n > 0" />. You may use the book’s terms (IsZero, Pred, Mult, …).
      </p>
    </Exercise>
  );
}

export function ExLamRegular() {
  return (
    <Exercise
      id="lam.min.regular"
      title="Why regular?"
      choices={[
        { label: 'Because Y only works for regular functions.', why: 'Y g ↠ g(Y g) for every term g. Regularity is about f, not about Y.' },
        {
          label: 'So that the search reaches a y with f(x⃗, y) = 0, and the term reaches a normal form.',
          correct: true,
          why: 'Right. If f(x⃗, y) = 0 for some y, the search stops there; if not, the recursion unfolds forever and the term has no normal form — which is fine for a partial function, but the lemma is about total ones.',
        },
        { label: 'Because IsZero needs a regular argument.', why: 'IsZero works on every Church numeral.' },
      ]}
    >
      <p>The lemma on minimization assumes that f is regular. What is the assumption used for?</p>
    </Exercise>
  );
}
