import { describe, expect, test } from 'vitest';
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';
import { PRESETS, bitsOf, evalMux, functionCount, hexWord, lutValue, minimalTerms, nodeValues, onPath, presetBits, rowInputs, rowOf, termsText, wordOf } from './mux';

describe('the mux tree', () => {
  test('the output is the data input the select bits name, for every k', () => {
    for (const k of [1, 2, 3, 4]) {
      const data = Array.from({ length: 1 << k }, (_, i) => (i * 7 + 3) % 5 < 2 ? 1 : 0);
      for (let sel = 0; sel < 1 << k; sel++) {
        const levels = nodeValues(data, k, sel);
        expect(levels[k]![0]).toBe(evalMux(data, sel));
        expect(levels[k]![0]).toBe(data[sel]);
      }
    }
  });
  test('exactly one node per level is on the path, and its value is the output', () => {
    const k = 3;
    const data = [1, 0, 0, 1, 1, 1, 0, 0];
    for (let sel = 0; sel < 8; sel++) {
      const levels = nodeValues(data, k, sel);
      for (let j = 0; j <= k; j++) {
        const on = levels[j]!.flatMap((_, i) => (onPath(j, i, sel) ? [i] : []));
        expect(on).toHaveLength(1);
        expect(levels[j]![on[0]!]).toBe(data[sel]);
      }
    }
  });
});

describe('the digital engine’s mux block agrees', () => {
  test('mux with 3 select bits picks D(sel)', () => {
    const b = new NetlistBuilder();
    const d = b.nets(8, 'D');
    const s = b.nets(3, 'S');
    const y = b.net('Y');
    d.forEach((n, i) => b.add('toggle', `TD${i}`, { Y: n }));
    s.forEach((n, i) => b.add('toggle', `TS${i}`, { Y: n }));
    b.add('mux', 'M', { ...Object.fromEntries(d.map((n, i) => [`D${i}`, n])), ...Object.fromEntries(s.map((n, i) => [`S${i}`, n])), Y: y }, { select: 3 });
    const e = createDigitalEngine(b.build());
    const data = [1, 0, 1, 1, 0, 0, 1, 0];
    data.forEach((v, i) => e.setParam(`TD${i}`, 'on', !!v));
    for (let sel = 0; sel < 8; sel++) {
      [0, 1, 2].forEach((i) => e.setParam(`TS${i}`, 'on', !!((sel >> i) & 1)));
      e.advance(20e-9);
      expect(e.logic(y)).toBe(data[sel]);
    }
  });
});

describe('lookup tables', () => {
  test('rows and inputs are inverses, A is the most significant bit', () => {
    expect(rowInputs(5, 3)).toEqual([1, 0, 1]);
    expect(rowOf([1, 1, 0])).toBe(6);
    for (let m = 0; m < 16; m++) expect(rowOf(rowInputs(m, 4))).toBe(m);
  });
  test('the hexadecimal word of XOR, majority and AND', () => {
    const p = (id: string, k: number) => presetBits(PRESETS.find((x) => x.id === id)!, k);
    expect(hexWord(p('xor', 3))).toBe('0x96');
    expect(hexWord(p('majority', 3))).toBe('0xE8');
    expect(hexWord(p('and', 3))).toBe('0x80');
    expect(hexWord(p('xor', 2))).toBe('0x6');
    expect(hexWord(p('and', 4))).toBe('0x8000');
    expect(bitsOf(0x96, 3)).toEqual(p('xor', 3));
    expect(wordOf(p('xor', 3))).toBe(0x96);
  });
  test('the number of functions of k variables', () => {
    expect([1, 2, 3, 4].map(functionCount)).toEqual([4, 16, 256, 65536]);
  });
  test('every preset’s table gives the preset’s function', () => {
    for (const pr of PRESETS)
      for (const k of pr.ks) {
        const bits = presetBits(pr, k);
        for (let m = 0; m < 1 << k; m++) expect(lutValue(bits, rowInputs(m, k))).toBe(pr.f(rowInputs(m, k)));
      }
  });
  test('the minimal expressions', () => {
    const bits = (id: string, k: number) => presetBits(PRESETS.find((x) => x.id === id)!, k);
    expect(termsText(minimalTerms(bits('and', 2), 2))).toBe('A·B');
    expect(termsText(minimalTerms(bits('zero', 3), 3))).toBe('0');
    expect(termsText(minimalTerms(bits('xor', 2), 2))).toMatch(/^(¬A·B \+ A·¬B|A·¬B \+ ¬A·B)$/);
    const maj = minimalTerms(bits('majority', 3), 3);
    expect(maj).toHaveLength(3);
    expect(maj.every((t) => t.length === 2)).toBe(true);
    expect(minimalTerms([1, 1, 1, 1], 2)).toEqual([[]]);
    // A term list computes the table it came from.
    for (const pr of PRESETS)
      for (const k of pr.ks) {
        const t = minimalTerms(presetBits(pr, k), k);
        for (let m = 0; m < 1 << k; m++) {
          const x = rowInputs(m, k);
          const v = t.some((term) => term.every((l) => (x[l.v] === 1) !== l.neg)) ? 1 : 0;
          expect(v).toBe(pr.f(x));
        }
      }
  });
});
