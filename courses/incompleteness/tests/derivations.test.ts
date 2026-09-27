import { describe, expect, it } from 'vitest';
import { parseFormula } from '../src/engine/syntax/parse.ts';
import { check, D } from '../src/engine/proof/nd.ts';
import { Q } from '../src/engine/proof/q.ts';
import { godelNumber } from '../src/engine/coding/godel.ts';
import { lit, natEq, seqOf, magnitude } from '../src/engine/numbers/nat.ts';
import {
  assumptionOccurrences, codedNodes, decodeDerivation, dischargeLabel, encodeDerivation, endFmla, lastRule, pathKey, prf, recode,
  RULE_NUMBER, RULE_OF_NUMBER, sameDerivation, subtreeSeq,
} from '../src/engine/coding/derivations.ts';
import { DERIVATION_EXAMPLES } from '../src/engine/coding/derivation-examples.ts';

const P = (s: string) => parseFormula(s);
const eqNat = (a: Parameters<typeof natEq>[0], b: Parameters<typeof natEq>[1]) => natEq(a, b) === 'equal';

describe('coding derivations (the book’s definition)', () => {
  it('the rule table is the book’s', () => {
    expect(RULE_NUMBER.andI).toBe(1);
    expect(RULE_NUMBER.impI).toBe(5);
    expect(RULE_NUMBER.botC).toBe(10);
    expect(RULE_NUMBER.eqE).toBe(16);
    expect(Object.keys(RULE_OF_NUMBER)).toHaveLength(16);
  });

  it('reproduces the book’s example ⟨1, ⟨1, ⟨0, #A∧B#, 1⟩, #A#, 0, 2⟩, #(A∧B)→A#, 1, 5⟩', () => {
    const fa = P('0 = 0');
    const fb = P('0 < 1');
    const ex = DERIVATION_EXAMPLES.find((e) => e.id === 'book')!;
    const r = encodeDerivation(ex.build(fa, fb));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const gAB = godelNumber(P('0 = 0 ∧ 0 < 1'));
    const gA = godelNumber(P('0 = 0'));
    const gAll = godelNumber(P('(0 = 0 ∧ 0 < 1) → 0 = 0'));
    const d0 = seqOf([lit(0), gAB, lit(1)]);
    const d1 = seqOf([lit(1), d0, gA, lit(0), lit(2)]);
    const whole = seqOf([lit(1), d1, gAll, lit(1), lit(5)]);
    expect(eqNat(r.root.code, whole)).toBe(true);
    // The book's EndFmla, DischargeLabel, LastRule.
    expect(eqNat(endFmla(whole)!, gAll)).toBe(true);
    expect(dischargeLabel(whole)).toBe(1);
    expect(lastRule(whole)).toBe(5);
    expect(lastRule(d0)).toBe(0);
    // far too large to write down
    const m = magnitude(whole);
    expect(m && 'LL' in m).toBe(true);
  });

  it('undischarged assumptions get label 0, axioms are undischarged assumptions', () => {
    const r = encodeDerivation(D.andE(D.assume(P('0 = 0 ∧ 0 = 0')), 'left'));
    expect(r.ok && r.root.premises[0].n).toBe(0);
    const q = encodeDerivation(DERIVATION_EXAMPLES.find((e) => e.id === 'neq')!.build(P('⊥'), P('⊥')), { axioms: Q() });
    expect(q.ok).toBe(true);
    if (!q.ok) return;
    const leaf = q.root.premises[0];
    expect(leaf.kind).toBe('assumption');
    expect(leaf.n).toBe(0);
    expect(leaf.axiom).toBe('Q2');
  });

  it('refuses hypotheses and label 0 discharges', () => {
    expect(encodeDerivation(D.hyp('fact', P('0 = 0'))).ok).toBe(false);
    const bad = D.impI(D.assume(P('0 = 0'), 0), P('0 = 0'), 0);
    expect(encodeDerivation(bad).ok).toBe(false);
  });

  const A0 = P('0 = 0');
  const B0 = P('0 < 1');
  for (const ex of DERIVATION_EXAMPLES) {
    it(`round trip: ${ex.title}`, () => {
      const d = ex.build(A0, B0);
      const axioms = ex.fromQ ? Q() : undefined;
      const c0 = check(d, { axioms });
      expect(c0.errors).toEqual([]);
      const r = encodeDerivation(d, { axioms });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const back = decodeDerivation(r.root.code, { axioms: Q() });
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(sameDerivation(d, back.deriv)).toBe(true);
      const c1 = check(back.deriv, { axioms: Q() });
      expect(c1.errors).toEqual([]);
      // re-encoding the decoded derivation gives the same number
      const again = encodeDerivation(back.deriv, { axioms: Q() });
      expect(again.ok && eqNat(again.root.code, r.root.code)).toBe(true);
      // SubtreeSeq has one entry per inference / assumption
      expect(subtreeSeq(r.root.code)).toHaveLength(codedNodes(r.root).length);
      // OpenAssum on codes agrees with the checker
      const open = assumptionOccurrences(r.root.code).filter((o) => o.open);
      expect(open.length).toBe(c0.open.length);
    });
  }

  it('all sixteen rules occur in the examples', () => {
    const used = new Set<number>();
    for (const ex of DERIVATION_EXAMPLES) {
      const r = encodeDerivation(ex.build(A0, B0), { axioms: ex.fromQ ? Q() : undefined });
      if (r.ok) codedNodes(r.root).forEach((n) => n.k && used.add(n.k));
    }
    expect([...used].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it('changing the rule number or a label in the code makes the checker reject the decoded derivation', () => {
    const d = DERIVATION_EXAMPLES.find((e) => e.id === 'book')!.build(A0, B0);
    const r = encodeDerivation(d);
    if (!r.ok) throw new Error(r.error);
    // ∧Elim (2) claimed to be ∧Intro (1)
    const wrongRule = recode(r.root, new Map([[pathKey([0]), { k: 1 }]]));
    const dec = decodeDerivation(wrongRule);
    expect(dec.ok).toBe(true);
    if (dec.ok) expect(check(dec.deriv).valid).toBe(false);
    // discharge label 1 changed to 2: the assumption is no longer discharged
    const wrongLabel = recode(r.root, new Map([[pathKey([]), { n: 2 }]]));
    const dec2 = decodeDerivation(wrongLabel);
    expect(dec2.ok).toBe(true);
    if (dec2.ok) expect(check(dec2.deriv).valid).toBe(false);
    const occ = assumptionOccurrences(wrongLabel);
    expect(occ[0].open).toBe(true);
    // rule number 17 does not exist
    expect(decodeDerivation(recode(r.root, new Map([[pathKey([]), { k: 17 }]]))).ok).toBe(false);
  });

  it('Prf_Q(x, y) holds for the code of a derivation from Q and the code of its end-formula', () => {
    const d = DERIVATION_EXAMPLES.find((e) => e.id === 'neq2')!.build(A0, B0);
    const r = encodeDerivation(d, { axioms: Q() });
    if (!r.ok) throw new Error(r.error);
    const y = godelNumber(d.concl);
    const p = prf(r.root.code, y, Q());
    expect(p).toMatchObject({ deriv: true, endFormula: true, openInGamma: true, holds: true });
    expect(p.open.map((o) => o.axiom).sort()).toEqual(['Q1', 'Q2']);
    // a derivation with an undischarged non-axiom assumption is not a derivation from Q
    const e = encodeDerivation(D.andE(D.assume(P('0 = 0 ∧ 0 = 0')), 'left'));
    if (!e.ok) throw new Error(e.error);
    expect(prf(e.root.code, godelNumber(P('0 = 0')), Q())).toMatchObject({ deriv: true, openInGamma: false, holds: false });
    // wrong end-formula
    expect(prf(r.root.code, godelNumber(P('0 = 0')), Q()).endFormula).toBe(false);
  });
});
