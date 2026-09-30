import { describe, expect, test } from 'vitest';
import { equivalent } from '../twolevel/unate';
import { functionFromEquations, parseTruthTable } from '../twolevel/expr';
import { mulberry32 } from '../twolevel/random';
import { Pla, PlaError, describePlaTerms, fitPla, fitPlaEquations, fitPlaTruthTable, plaMatches } from './pla';

describe('vPLA', () => {
  test('a virgin device: 16 terms, every output reads 0', () => {
    const p = new Pla();
    expect(p.size).toEqual({ inputs: 8, terms: 16, outputs: 8 });
    expect(p.fuseCount).toBe(16 * 8 * 2 + 16 * 8 + 8);
    for (let x = 0; x < 256; x += 7) expect(p.evaluate(x)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(p.usedTerms()).toBe(0);
  });

  test('AND-plane semantics: connected true/complement fuses, constants', () => {
    const p = new Pla({ inputs: 3, terms: 2, outputs: 1 });
    // Term 0 = A·B̄ : keep A's true fuse, blow A's complement fuse; blow B's true fuse.
    p.blow({ plane: 'and', term: 0, input: 0, literal: 'complement' });
    p.blow({ plane: 'and', term: 0, input: 1, literal: 'true' });
    // and don't care about C.
    p.blow({ plane: 'and', term: 0, input: 2, literal: 'true' });
    p.blow({ plane: 'and', term: 0, input: 2, literal: 'complement' });
    // Term 1 is left alone: A·Ā·… = 0. Disconnect it from the output.
    p.blow({ plane: 'or', term: 1, output: 0 });
    expect(p.decodeTerm(0).pattern).toBe('10-');
    expect(p.decodeTerm(1).kind).toBe('false');
    for (let x = 0; x < 8; x++) expect(p.evaluate(x)).toEqual([(x >> 1) === 0b10 ? 1 : 0]);
    // The empty term is the constant 1.
    const q = new Pla({ inputs: 2, terms: 1, outputs: 1 });
    for (let i = 0; i < 2; i++) for (const literal of ['true', 'complement'] as const) q.blow({ plane: 'and', term: 0, input: i, literal });
    expect(q.decodeTerm(0).kind).toBe('true');
    expect(q.evaluate(0)).toEqual([1]);
    expect(q.evaluate(3)).toEqual([1]);
  });

  test('polarity fuse inverts an output', () => {
    const p = new Pla({ inputs: 1, terms: 1, outputs: 1 });
    p.blow({ plane: 'and', term: 0, input: 0, literal: 'complement' }); // term = x
    expect(p.evaluate([1])).toEqual([1]);
    p.blow({ plane: 'polarity', output: 0 });
    expect(p.evaluate([1])).toEqual([0]);
    expect(p.evaluate([0])).toEqual([1]);
    expect(p.trace([1]).sums).toEqual([1]);
  });

  test('fuses can only be blown, never restored', () => {
    const a = new Pla({ inputs: 2, terms: 2, outputs: 1 });
    const b = a.clone();
    b.blow({ plane: 'polarity', output: 0 });
    expect(a.plan(b)).toEqual([{ plane: 'polarity', output: 0 }]);
    expect(() => b.plan(a)).toThrow(PlaError);
    expect(a.blow({ plane: 'polarity', output: 0 })).toBe(true);
    expect(a.blow({ plane: 'polarity', output: 0 })).toBe(false);
    expect(() => a.blow({ plane: 'or', term: 5, output: 0 })).toThrow(/out of range/);
  });

  test('fitting equations: a 3-bit adder-like function shares terms', () => {
    const fit = fitPlaEquations('X = A&B | C&D\nY = A&B | !C&!D\nZ = C ^ D');
    const f = functionFromEquations('X = A&B | C&D\nY = A&B | !C&!D\nZ = C ^ D');
    expect(plaMatches(fit.pla, f)).toBe(true);
    // AB is shared by X and Y; CD, C̄D̄ and the two terms of C⊕D: 3 + 2 = 5 terms at most.
    expect(fit.used).toBeLessThanOrEqual(5);
    expect(fit.pla.usedTerms()).toBe(fit.used);
    expect(describePlaTerms(fit.pla).length).toBe(fit.used);
  });

  test('fitted devices agree with the truth table on all 256 inputs (8 inputs, 8 outputs)', () => {
    const rng = mulberry32(2024);
    for (let trial = 0; trial < 6; trial++) {
      // Random SOPs with a few terms each keep the fit within 16 terms.
      const lines: string[] = [];
      for (let o = 0; o < 8; o++) {
        const terms: string[] = [];
        const count = 1 + rng.int(2);
        for (let k = 0; k < count; k++) {
          const lits: string[] = [];
          const used = new Set<number>();
          while (lits.length < 3 + rng.int(3)) {
            const i = rng.int(8);
            if (used.has(i)) continue;
            used.add(i);
            lits.push(rng.chance(0.5) ? `I${i}` : `!I${i}`);
          }
          terms.push(lits.join(' & '));
        }
        lines.push(`O${o} = ${terms.join(' | ')}`);
      }
      const eq = lines.join('\n');
      const f = functionFromEquations(eq, Array.from({ length: 8 }, (_, i) => `I${i}`));
      const fit = fitPla(f, { polarity: 'auto' });
      expect(plaMatches(fit.pla, f)).toBe(true);
      // Recovering the function from the fuses gives an equivalent function.
      const back = fit.pla.toFunction();
      for (let o = 0; o < 8; o++) expect(equivalent(back.on[o]!, f.on[o]!)).toBe(true);
    }
  });

  test('polarity auto saves terms; too many terms is an error with advice', () => {
    const f = functionFromEquations('Y = !(A&B&C&D&E&F&G&H)', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const high = fitPla(f, { polarity: 'high' });
    expect(high.used).toBe(8);
    const auto = fitPla(f, { polarity: 'auto' });
    expect(auto.used).toBe(1);
    expect(auto.polarity[0]).toBe('low');
    expect(plaMatches(auto.pla, f)).toBe(true);
    // Parity of 8 inputs needs 128 terms.
    const parity = functionFromEquations('P = A^B^C^D^E^F^G^H', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(() => fitPla(parity, { polarity: 'auto' })).toThrow(/product terms/);
    expect(() => fitPla(parity)).toThrowError(PlaError);
  });

  test('fits a BCD to 7-segment decoder from a truth table', () => {
    const rows = ['A3 A2 A1 A0 | a b c d e f g'];
    const seg = [0x7e, 0x30, 0x6d, 0x79, 0x33, 0x5b, 0x5f, 0x70, 0x7f, 0x7b];
    for (let d = 0; d < 16; d++) {
      const bits = d.toString(2).padStart(4, '0').split('').join(' ');
      const out = d < 10 ? seg[d]!.toString(2).padStart(7, '0').split('').join(' ') : '- - - - - - -';
      rows.push(`${bits} | ${out}`);
    }
    const text = rows.join('\n');
    const fit = fitPlaTruthTable(text, { polarity: 'auto' });
    const f = parseTruthTable(text);
    expect(plaMatches(fit.pla, f)).toBe(true);
    expect(fit.used).toBeLessThanOrEqual(12);
    console.log(`vPLA 7-segment decoder: ${fit.used} of 16 terms, ${fit.cost.connections} OR connections, polarity ${fit.polarity.slice(0, 7).join(',')}`);
    // The pulses program a virgin device to exactly the same fuses.
    const virgin = new Pla(fit.pla.size, { inputs: fit.pla.inputNames, outputs: fit.pla.outputNames });
    virgin.apply(fit.ops);
    expect(virgin.andFuses).toEqual(fit.pla.andFuses);
    expect(virgin.orFuses).toEqual(fit.pla.orFuses);
    expect(virgin.polarityFuses).toEqual(fit.pla.polarityFuses);
    expect(virgin.blownOps().length).toBe(fit.ops.length);
  });

  test('fuse map JSON round trip', () => {
    const fit = fitPlaEquations('X = A&B | !C\nY = A&!B');
    const json = JSON.stringify(fit.pla.toFuseMap());
    const map = JSON.parse(json);
    expect(map.and.length).toBe(16);
    expect(map.and[0]).toHaveLength(16);
    expect(map.or[0]).toHaveLength(8);
    expect(map.polarity).toHaveLength(8);
    const back = Pla.fromFuseMap(map);
    expect(back.andFuses).toEqual(fit.pla.andFuses);
    expect(back.orFuses).toEqual(fit.pla.orFuses);
    expect(back.polarityFuses).toEqual(fit.pla.polarityFuses);
    expect(map.termInfo.filter((t: { kind: string; outputs: number[] }) => t.kind !== 'false' && t.outputs.length).length).toBe(fit.used);
    expect(() => Pla.fromFuseMap({ ...map, device: 'x' })).toThrow(PlaError);
  });

  test('size errors', () => {
    const f = functionFromEquations('Y = A', ['A']);
    expect(() => fitPla(f, { size: { inputs: 1, terms: 1, outputs: 1 } })).not.toThrow();
    expect(() => fitPla(functionFromEquations('Y = A\nZ = !A', ['A']), { size: { inputs: 1, terms: 1, outputs: 2 } })).toThrow(/product terms/);
    const wide = functionFromEquations('Y = A', Array.from({ length: 9 }, (_, i) => `x${i}`).map((x, i) => (i === 0 ? 'A' : x)));
    expect(() => fitPla(wide)).toThrow(/9 inputs/);
  });
});
