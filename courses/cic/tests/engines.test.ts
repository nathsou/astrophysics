import { describe, expect, it } from 'vitest';
import * as L from '../src/kernel/untyped/lambda.ts';
import { Stepper } from '../src/kernel/core/steps.ts';
import { pp } from '../src/kernel/core/pretty.ts';
import { run } from './util.ts';
import * as ND from '../src/kernel/logic/nd.ts';

describe('untyped', () => {
  it('parses, reduces arithmetic', () => {
    const p = L.parseProgram(L.STDLIB + '\nPLUS 2 3');
    const r = L.normalize(p.main!, 'normal', p.defs);
    expect(r.normal).toBe(true);
    expect(L.churchValue(r.final)).toBe(5);
  });
  it('capture avoiding substitution', () => {
    const t = L.parseTerm('(λx y. x) y');
    const r = L.step(t, 'normal')!;
    expect(L.print(r.term)).toBe('λy₁. y');
    expect(r.info!.renames.length).toBe(1);
    const naive = L.naiveSubst((t as any).fn.body, 'x', (t as any).arg);
    expect(L.print(naive)).toBe('λy. y');
  });
  it('omega diverges, strategies differ', () => {
    const p = L.parseProgram(L.STDLIB + '\n(λx. λy. y) OMEGA');
    expect(L.normalize(p.main!, 'normal', p.defs).normal).toBe(true);
    expect(L.normalize(p.main!, 'applicative', p.defs, 50).normal).toBe(false);
  });
  it('reduction graph', () => {
    const g = L.reductionGraph(L.parseTerm('(λx. x x) ((λy. y) z)'));
    expect(g.nodes.length).toBe(6);
    const g2 = L.reductionGraph(L.parseTerm('(λx. x x) (λx. x x)'));
    expect(g2.nodes.length).toBe(1);
  });
  it('de Bruijn', () => {
    expect(L.dbToString(L.toDB(L.parseTerm('λx y. x (λz. z y)')))).toBe('λ λ 1 (λ 0 1)');
  });
});

describe('typed steps', () => {
  it('steps 2 + 1', () => {
    const r = run('#check 2 + 1');
    const o = r.results[0].output as any;
    const st = new Stepper(r.env);
    const t = st.trace(o.expr, 100);
    expect(t.normal).toBe(true);
    expect(pp(r.env, t.final)).toBe('3');
    console.log(t.steps.map((s) => `${s.kind}${s.name ? ' ' + s.name : ''}: ${pp(r.env, s.after)}`).join('\n'));
  });
});

describe('natural deduction', () => {
  it('builds a proof of A ∧ B → B ∧ A', () => {
    let root = ND.newGoal(ND.parseFormula('A ∧ B → B ∧ A'), []);
    root = ND.applyRule(root, 'impI') as ND.PNode;
    const g1 = root.children[0];
    root = ND.replaceNode(root, g1.id, (n) => ND.applyRule(n, 'andI') as ND.PNode);
    const [l, r] = root.children[0].children;
    root = ND.replaceNode(root, l.id, (n) => ND.applyRule(n, 'andE2', { aux: ND.atom('A') }) as ND.PNode);
    root = ND.replaceNode(root, r.id, (n) => ND.applyRule(n, 'andE1', { aux: ND.atom('B') }) as ND.PNode);
    for (const g of ND.openGoals(root)) root = ND.replaceNode(root, g.id, (n) => ND.applyRule(n, 'hyp') as ND.PNode);
    expect(ND.isComplete(root)).toBe(true);
    const term = ND.proofTerm(root).map((p) => p.text).join('');
    expect(term).toBe('λ (h₁ : A ∧ B) => ⟨h₁.2, h₁.1⟩');
    const k = run(`theorem t (A B : Prop) : A ∧ B → B ∧ A := ${term}`);
    expect(k.errors).toEqual([]);
  });
});
