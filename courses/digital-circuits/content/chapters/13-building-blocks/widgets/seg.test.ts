import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { SEG7 } from '$lib/partsbin/refs';
import { HEX, allEquations, decoded, evalTerms, litDigits, segmentEquation, sharedCost } from './seg';

describe('seven-segment equations', () => {
  test('explore', () => {
    for (const mode of ['hex', 'bcd'] as const) {
      const eqs = allEquations(mode);
      console.log(mode, eqs.map((e) => `${e.name} = ${e.text} [${e.literals}]`).join('\n'), JSON.stringify(sharedCost(mode)));
    }
  });
  test('hex equations reproduce the part’s table for all sixteen digits', () => {
    for (let d = 0; d < 16; d++) expect(decoded(d, 'hex'), HEX[d]).toBe(SEG7[d]);
  });
  test('bcd equations reproduce it for 0–9 and give something for 10–15', () => {
    for (let d = 0; d < 10; d++) expect(decoded(d, 'bcd'), HEX[d]).toBe(SEG7[d]);
    for (let d = 10; d < 16; d++) expect(decoded(d, 'bcd')).toBeGreaterThanOrEqual(0);
  });
  test('digit 8 lights everything, 1 lights b and c only', () => {
    expect(SEG7[8]).toBe(0x7f);
    expect(SEG7[1]).toBe(0b0000110);
    expect(litDigits(0).length).toBe(12);
  });
  test('each equation evaluates to its segment', () => {
    for (let s = 0; s < 7; s++) for (let d = 0; d < 16; d++) expect(evalTerms(segmentEquation(s, 'hex').terms, d)).toBe((SEG7[d]! >> s) & 1);
  });
});
