import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/syntax/ast.ts';
import { formulaEq } from '../src/engine/syntax/ops.ts';
import { check, linearize } from '../src/engine/proof/nd.ts';
import { nd, ndMessage, ndText, parseND } from '../src/engine/proof/ndlang.ts';
import { addAssumption, availableAt, checkState, constructionOf, forward, goalsInOrder, plug, refine, retract, setLabel, start, suggest, type BState, type Result } from '../src/engine/proof/builder.ts';
import { ND_EXAMPLES, exampleById } from '../src/engine/proof/ndExamples.ts';
import { deriveLessZero, deriveRosserFirstHalf, qUnfolded } from '../src/engine/proof/arith.ts';
import { emptyModel, relKey, search, sentencesOf, signatureOf, stepVerdicts } from '../src/engine/proof/soundness.ts';

const ok = (r: Result): BState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe('the notation of the appendix (formula letters)', () => {
  it('parses sentence letters and formula letters, and prints them back', () => {
    for (const s of ['(A ∧ B) → A', '∃x ¬A(x) → ¬∀x A(x)', '∀x (B(x) → C(x, b))', 'A ∨ ¬A', '∀x ∀y ((A(x) ∧ A(y)) → x = y)']) {
      const p = parseND(s);
      expect(p.ok).toBe(true);
      if (p.ok) expect(formulaEq(nd(ndText(p.value)), p.value)).toBe(true);
    }
    expect(ndText(nd('A → B'))).toBe('A → B');
  });
  it('reports a letter used with two arities, and maps error positions back', () => {
    const p = parseND('A ∧ A(x)');
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toMatch(/used with 0 and with 1/);
    const q = parseND('A ∧ ∧ B');
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.pos).toBe(4);
  });
});

describe('the book’s derivations, as transcribed', () => {
  const verdict = (id: string) => {
    const e = exampleById(id)!;
    return check(e.build());
  };
  it.each(ND_EXAMPLES.filter((e) => !e.incorrect).map((e) => [e.id]))('%s is accepted by the checker', (id) => {
    const e = exampleById(id)!;
    const d = e.build();
    const r = check(d);
    expect(r.errors.map((x) => x.message)).toEqual([]);
    expect(formulaEq(d.concl, e.goal)).toBe(true);
    // every undischarged assumption is in Γ
    for (const o of r.open) expect(e.gamma.some((g) => formulaEq(g, o.formula))).toBe(true);
  });
  it('the finished tree of Example “(¬A ∨ B) → (A → B)” has an unlabelled →Intro discharging nothing, which the book’s rules allow', () => {
    const r = verdict('pro-2');
    expect(r.errors.map((e) => e.message)).toEqual([]);
    expect(r.valid).toBe(true);
  });
  it('the incorrect derivations are rejected with the eigenvariable condition', () => {
    expect(verdict('qrl-bad').errors.map((e) => ndMessage(e.message))).toEqual(['eigenvariable condition: a occurs in the undischarged assumption A(a)']);
    expect(verdict('qrl-bad-2').errors.map((e) => e.message).join(' ')).toMatch(/a occurs in the conclusion/);
  });
});

describe('the builder', () => {
  it('builds (A ∧ B) → A bottom-up, with the checker judging every state', () => {
    let s = start(nd('(A ∧ B) → A'));
    expect(checkState(s).done).toBe(false);
    s = ok(refine(s, goalsInOrder(s)[0].id, 'impI', { label: 1 }));
    const g = goalsInOrder(s)[0];
    expect(ndText(g.concl)).toBe('A');
    expect(availableAt(s, g.id).map((x) => `${ndText(x.formula)}^${x.label}`)).toEqual(['A ∧ B^1']);
    s = ok(refine(s, g.id, 'andE', { formula: nd('B'), side: 0 }));
    s = ok(refine(s, goalsInOrder(s)[0].id, 'assume', { label: 1 }));
    const c = checkState(s);
    expect(c.check.errors).toEqual([]);
    expect(c.done).toBe(true);
  });

  it('goals are not assumptions: a goal A(a) above ∀Intro does not trip the eigenvariable condition', () => {
    let s = start(nd('∀x (A(x) → A(x))'));
    s = ok(refine(s, s.root.id, 'allI', { eigen: 1 }));
    const c = checkState(s);
    expect(c.check.errors).toEqual([]);
    expect(c.check.valid).toBe(false);
    expect(c.goals).toHaveLength(1);
  });

  it('shows the checker’s error when an assumption violates the eigenvariable condition', () => {
    let s = start(nd('∀x A(x)'), [nd('A(a)')]);
    s = ok(refine(s, s.root.id, 'allI', { eigen: 1 }));
    s = ok(refine(s, goalsInOrder(s)[0].id, 'assume', {}));
    const c = checkState(s);
    expect(c.check.errors.map((e) => ndMessage(e.message))).toEqual(['eigenvariable condition: a occurs in the undischarged assumption A(a)']);
  });

  it('lets the reader supply wrong premises, and the checker says what is wrong', () => {
    let s = start(nd('A ∧ B'));
    s = ok(refine(s, s.root.id, 'andI', { premises: [nd('B'), nd('A')] }));
    expect(checkState(s).check.errors.map((e) => e.message)).toEqual(['the conclusion must be the conjunction of the premises, in order']);
    expect(suggest('andI', nd('A → B'), {}).ok).toBe(false);
  });

  it('works top-down with pieces, and plugs a piece into a goal', () => {
    let s = start(nd('B ∧ A'), [nd('A ∧ B')]);
    s = ok(addAssumption(s, nd('A ∧ B')));
    const p = s.pieces[0].id;
    s = ok(addAssumption(s, nd('A ∧ B')));
    const q = s.pieces[1].id;
    s = ok(forward(s, 'andE', [p], { side: 1 }));
    s = ok(forward(s, 'andE', [q], { side: 0 }));
    s = ok(forward(s, 'andI', s.pieces.map((x) => x.id)));
    expect(ndText(s.pieces[0].concl)).toBe('B ∧ A');
    s = ok(plug(s, s.root.id, s.pieces[0].id));
    expect(checkState(s).done).toBe(true);
    expect(plug(start(nd('A')), 'nope', 'nope').ok).toBe(false);
  });

  it('retracts a step and relabels an inference', () => {
    let s = start(nd('A → A'));
    s = ok(refine(s, s.root.id, 'impI', { label: 1 }));
    s = ok(refine(s, goalsInOrder(s)[0].id, 'assume', { label: 2 }));
    expect(checkState(s).check.errors.map((e) => e.message).join()).toMatch(/never discharged/);
    s = ok(setLabel(s, s.root.id, 2));
    expect(checkState(s).done).toBe(true);
    s = ok(retract(s, s.root.id));
    expect(goalsInOrder(s)).toHaveLength(1);
    expect(linearize(s.root)).toHaveLength(1);
  });

  it('replays a finished derivation goal by goal', () => {
    for (const e of ND_EXAMPLES) {
      const d = e.build();
      const states = constructionOf(d, e.gamma);
      expect(states).toHaveLength(linearize(d).length + 1);
      expect(goalsInOrder(states[0])).toHaveLength(1);
      expect(states[states.length - 1].goals.size).toBe(0);
      expect(checkState(states[states.length - 1]).check.valid).toBe(check(d).valid);
      // every intermediate state: no error except those of the finished derivation's steps
      for (const st of states) {
        const errs = checkState(st).check.errors.filter((x) => !x.id.startsWith('goal:'));
        const final = new Set(check(d).errors.map((x) => x.id));
        for (const x of errs) if (!final.has(x.id)) expect(x.message).toMatch(/eigenvariable|never discharged/);
      }
    }
  });
});

describe('appendix A: derivations in Q', () => {
  it('Q ⊢ ∀x ¬x < 0, with Q8 written out', () => {
    const d = deriveLessZero();
    const r = check(d, { axioms: qUnfolded() });
    expect(r.errors).toEqual([]);
    expect(r.axioms).toEqual(['Q2', 'Q3', 'Q4', 'Q5', 'Q8']);
    expect(r.open.every((o) => o.kind === 'axiom')).toBe(true);
    expect(formulaEq(d.concl, A.forall(A.v(0), A.not(A.less(A.v(0), A.zero()))))).toBe(true);
  });
  it.each([1, 2, 3, 5])('Rosser, first half, n = %i: RProv(⌜R⌝) from the hypotheses', (n) => {
    const r = check(deriveRosserFirstHalf(n), { axioms: qUnfolded() });
    expect(r.errors).toEqual([]);
    expect(r.hypotheses).toHaveLength(n + 2);
    expect(r.open.every((o) => o.kind === 'hyp')).toBe(true);
  });
});

describe('soundness in finite structures', () => {
  it('no step of a checked derivation fails in any structure of size 1 or 2', () => {
    for (const id of ['pro-3', 'prq-1', 'prq-2', 'ide-2']) {
      const d = exampleById(id)!.build();
      const c = check(d);
      const sig = signatureOf(sentencesOf(d));
      for (const n of [1, 2]) {
        const s = search(d, c, sig, n);
        if (s.searched) expect(s.counterexample).toBeUndefined();
      }
    }
  });
  it('the incorrect derivation fails at its ∀Intro step in some structure of size 2', () => {
    const d = exampleById('qrl-bad')!.build();
    const c = check(d);
    const sig = signatureOf(sentencesOf(d));
    const s = search(d, c, sig, 2);
    expect(s.searched).toBe(true);
    expect(s.counterexample).toBeDefined();
    const bad = linearize(d).find((x) => x.id === s.counterexample!.stepId)!;
    expect(bad.rule).toBe('allI');
    expect(s.counterexample!.rootViolated).toBe(true);
  });
  it('sentence letters are truth values', () => {
    const d = exampleById('pro-3')!.build();
    const c = check(d);
    const sig = signatureOf(sentencesOf(d));
    const m = emptyModel(sig, 1);
    m.rels.get(relKey({ arity: 0, index: 30 }))!.add('[]');
    const v = stepVerdicts(d, c, sig, m);
    expect(v[v.length - 1]).toMatchObject({ concl: true, status: 'preserved' });
  });
});
