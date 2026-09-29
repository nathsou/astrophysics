import { describe, expect, test } from 'vitest';
import {
  AR_ROW,
  ARRAY_FUSES,
  COLUMNS,
  CONFIG_BASE,
  FUSE_COUNT,
  Gal22v10,
  INPUT_PINS,
  OLMC_PINS,
  PRODUCT_TERMS,
  ROWS,
  SIGNATURE_BASE,
  SP_ROW,
  columnSignal,
  decodeGal22v10,
  describeFuse,
  fuseIndex,
  getSignature,
  olmcOeRow,
  olmcRows,
  pinColumn,
  rowInfo,
  s0Fuse,
  s1Fuse,
  toFuseMap,
} from './gal22v10';
import { GAL_TRUE, programGal22v10, type GalProgram } from './gal22v10-program';

const chip = (p: GalProgram) => new Gal22v10(programGal22v10(p));

describe('GAL22V10 fuse layout', () => {
  test('5,892 fuses: 132 rows × 44 columns, 20 configuration bits, 64 signature bits', () => {
    expect(ROWS * COLUMNS).toBe(5808);
    expect(ARRAY_FUSES).toBe(5808);
    expect(CONFIG_BASE).toBe(5808);
    expect(SIGNATURE_BASE).toBe(5828);
    expect(FUSE_COUNT).toBe(5892);
    expect(new Gal22v10().fuses.length).toBe(5892);
  });

  test('rows: AR, then for each OLMC its OE row and product terms, then SP', () => {
    // Product terms from pin 23 down to pin 14.
    expect(OLMC_PINS.map((p) => PRODUCT_TERMS[p])).toEqual([8, 10, 12, 14, 16, 16, 14, 12, 10, 8]);
    expect(OLMC_PINS.map((p) => olmcOeRow(p))).toEqual([1, 10, 21, 34, 49, 66, 83, 98, 111, 122]);
    const total = 1 + OLMC_PINS.reduce((s, p) => s + 1 + PRODUCT_TERMS[p]!, 0) + 1;
    expect(total).toBe(ROWS);
    expect(AR_ROW).toBe(0);
    expect(SP_ROW).toBe(131);
    // Each OLMC's rows are contiguous and cover every row between AR and SP exactly once.
    const seen = new Set<number>();
    for (const p of OLMC_PINS) {
      const r = olmcRows(p);
      for (let row = r.oeRow; row < r.firstTermRow + r.terms; row++) {
        expect(seen.has(row)).toBe(false);
        seen.add(row);
      }
    }
    expect(seen.size).toBe(130);
    expect(rowInfo(0)).toEqual({ kind: 'AR' });
    expect(rowInfo(131)).toEqual({ kind: 'SP' });
    expect(rowInfo(1)).toEqual({ kind: 'OE', pin: 23 });
    expect(rowInfo(2)).toEqual({ kind: 'term', pin: 23, term: 0 });
    expect(rowInfo(130)).toEqual({ kind: 'term', pin: 14, term: 7 });
  });

  test('columns: pin ↔ column, true then complement', () => {
    expect(INPUT_PINS.map(pinColumn)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 42]);
    expect(OLMC_PINS.map(pinColumn)).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 34, 38]);
    for (let c = 0; c < COLUMNS; c++) {
      const s = columnSignal(c);
      expect(pinColumn(s.pin) + (s.complement ? 1 : 0)).toBe(c);
    }
    // Every one of the 22 signals appears once, in both forms.
    expect(new Set(Array.from({ length: COLUMNS }, (_, c) => columnSignal(c).pin)).size).toBe(22);
  });

  test('S0 and S1 are interleaved from pin 23; the signature follows', () => {
    expect(s0Fuse(23)).toBe(5808);
    expect(s1Fuse(23)).toBe(5809);
    expect(s0Fuse(14)).toBe(5826);
    expect(s1Fuse(14)).toBe(5827);
    expect(describeFuse(5810)).toEqual({ kind: 'S0', fuse: 5810, pin: 22 });
    expect(describeFuse(5827)).toEqual({ kind: 'S1', fuse: 5827, pin: 14 });
    expect(describeFuse(5828)).toEqual({ kind: 'signature', fuse: 5828, byte: 0, bit: 7 });
    expect(describeFuse(5891)).toEqual({ kind: 'signature', fuse: 5891, byte: 7, bit: 0 });
    expect(describeFuse(fuseIndex(0, 0))).toMatchObject({ kind: 'array', rowKind: 'AR', inputPin: 1, complement: false });
    expect(describeFuse(fuseIndex(1, 3))).toMatchObject({ rowKind: 'OE', olmcPin: 23, inputPin: 23, complement: true });
    expect(describeFuse(fuseIndex(131, 43))).toMatchObject({ rowKind: 'SP', inputPin: 13, complement: true });
    expect(() => describeFuse(FUSE_COUNT)).toThrow();
  });

  test('signature bytes, most significant bit first', () => {
    const f = new Uint8Array(FUSE_COUNT);
    f.set(Array.from({ length: 64 }, () => 0), SIGNATURE_BASE);
    const c = programGal22v10({ outputs: [], signature: 'Ab' });
    expect([...getSignature(c)]).toEqual([0x41, 0x62, 0, 0, 0, 0, 0, 0]);
    expect([...c.slice(SIGNATURE_BASE, SIGNATURE_BASE + 8)]).toEqual([0, 1, 0, 0, 0, 0, 0, 1]);
  });
});

describe('GAL22V10 fuse map JSON', () => {
  test('rows, macrocells, columns and signature', () => {
    const fuses = programGal22v10({
      outputs: [{ pin: 22, sum: [[{ pin: 4, neg: false }]], registered: true, activeHigh: true }],
      signature: 'MAP',
    });
    const m = JSON.parse(JSON.stringify(toFuseMap(fuses)));
    expect(m.rows.length).toBe(132);
    expect(m.rows[0]).toMatchObject({ row: 0, kind: 'AR' });
    expect(m.rows[131].kind).toBe('SP');
    expect(m.rows[10]).toMatchObject({ kind: 'OE', pin: 22 });
    expect(m.rows.every((r: { bits: string }) => /^[01]{44}$/.test(r.bits))).toBe(true);
    expect(m.olmcs[1]).toMatchObject({ pin: 22, s0: 1, s1: 0, activeHigh: true, registered: true, oeRow: 10, terms: 10 });
    expect(m.columns[43]).toEqual({ column: 43, pin: 13, complement: true });
    expect(m.signature.startsWith('MAP')).toBe(true);
    expect(m.blown).toBe(fuses.reduce((a, b) => a + b, 0));
    expect(() => toFuseMap(new Uint8Array(3))).toThrow();
  });
});

describe('GAL22V10 simulation from the fuses', () => {
  test('a blank device drives nothing and every term is false', () => {
    const g = new Gal22v10();
    const s = g.evaluate({ 2: 1 });
    expect(s.driven.some(Boolean)).toBe(false);
    expect(s.ar).toBe(0);
    expect(s.sp).toBe(0);
  });

  test('combinational AND, active high and active low', () => {
    const g = chip({
      outputs: [
        { pin: 23, sum: [[{ pin: 2, neg: false }, { pin: 3, neg: false }]], registered: false, activeHigh: true },
        { pin: 22, sum: [[{ pin: 2, neg: false }, { pin: 3, neg: false }]], registered: false, activeHigh: false },
      ],
    });
    for (let x = 0; x < 4; x++) {
      const s = g.evaluate({ 2: (x & 1) as 0 | 1, 3: (x >> 1) as 0 | 1 });
      const and = x === 3 ? 1 : 0;
      expect(s.pins[23]).toBe(and);
      expect(s.pins[22]).toBe(1 - and);
      expect(s.driven[23] && s.driven[22]).toBe(true);
    }
  });

  test('a row of no connections is 1; contradictions are 0; the sum of nothing is 0', () => {
    const g = chip({
      outputs: [
        { pin: 23, sum: GAL_TRUE, registered: false, activeHigh: true },
        { pin: 22, sum: [], registered: false, activeHigh: true },
        { pin: 21, sum: [[{ pin: 2, neg: false }, { pin: 2, neg: true }]], registered: false, activeHigh: true },
      ],
    });
    const s = g.evaluate({ 2: 1 });
    expect([s.pins[23], s.pins[22], s.pins[21]]).toEqual([1, 0, 0]);
  });

  test('sum of several product terms, 16 on the biggest macrocells', () => {
    // Pin 19 (16 terms): true when the 4 inputs (pins 2–5) hold any of 16 distinct values ⇒ always true,
    // built as 16 minterm products.
    const products = Array.from({ length: 16 }, (_, m) => [2, 3, 4, 5].map((pin, i) => ({ pin, neg: ((m >> i) & 1) === 0 })));
    const g = chip({ outputs: [{ pin: 19, sum: products, registered: false, activeHigh: true }] });
    for (let m = 0; m < 16; m++) expect(g.evaluate({ 2: (m & 1) as 0 | 1, 3: ((m >> 1) & 1) as 0 | 1, 4: ((m >> 2) & 1) as 0 | 1, 5: ((m >> 3) & 1) as 0 | 1 }).pins[19]).toBe(1);
    expect(() => programGal22v10({ outputs: [{ pin: 23, sum: products, registered: false, activeHigh: true }] })).toThrow(/too many product terms/);
    const dec = decodeGal22v10(programGal22v10({ outputs: [{ pin: 19, sum: products, registered: false, activeHigh: true }] }));
    expect(dec.olmcs.find((o) => o.pin === 19)!.terms.filter((t) => t.kind === 'product').length).toBe(16);
  });

  test('output enable: a tri-state output floats when its term is false, and the pin then reads as an input', () => {
    const g = chip({
      outputs: [{ pin: 20, sum: [[{ pin: 2, neg: false }]], registered: false, activeHigh: true, oe: [[{ pin: 3, neg: false }]] }],
    });
    let s = g.evaluate({ 2: 1, 3: 1 });
    expect(s.driven[20]).toBe(true);
    expect(s.pins[20]).toBe(1);
    s = g.evaluate({ 2: 1, 3: 0, 20: 0 });
    expect(s.driven[20]).toBe(false);
    expect(s.pins[20]).toBe(0); // the externally applied level
    s = g.evaluate({ 2: 0, 3: 1 });
    expect(s.pins[20]).toBe(0);
  });

  test('a combinational macrocell fed back into another: the pin is the feedback', () => {
    const g = chip({
      outputs: [
        { pin: 23, sum: [[{ pin: 2, neg: false }, { pin: 3, neg: false }]], registered: false, activeHigh: true },
        { pin: 22, sum: [[{ pin: 23, neg: true }]], registered: false, activeHigh: true },
      ],
    });
    for (let x = 0; x < 4; x++) {
      const s = g.evaluate({ 2: (x & 1) as 0 | 1, 3: (x >> 1) as 0 | 1 });
      expect(s.pins[22]).toBe(x === 3 ? 0 : 1);
    }
  });

  test('a macrocell without an output can be an input (S1 = 1), reading the external level', () => {
    const p = programGal22v10({ outputs: [{ pin: 23, sum: [[{ pin: 14, neg: false }]], registered: false, activeHigh: true }] });
    expect(p[s1Fuse(14)]).toBe(1);
    const g = new Gal22v10(p);
    expect(g.evaluate({ 14: 1 }).pins[23]).toBe(1);
    expect(g.evaluate({ 14: 0 }).pins[23]).toBe(0);
  });

  test('registered output: loads D on the rising edge only', () => {
    const g = chip({ outputs: [{ pin: 23, sum: [[{ pin: 2, neg: false }]], registered: true, activeHigh: true }] });
    expect(g.evaluate({ 2: 1 }).pins[23]).toBe(0); // not yet clocked
    expect(g.clock({ 2: 1 }).pins[23]).toBe(1);
    expect(g.evaluate({ 2: 0 }).pins[23]).toBe(1); // holds
    expect(g.clock({ 2: 0 }).pins[23]).toBe(0);
    g.clock({ 2: 1 });
    g.powerUp();
    expect(g.evaluate({}).pins[23]).toBe(0);
  });

  test('registered active-low output: the pin is the inverted register', () => {
    const g = chip({ outputs: [{ pin: 23, sum: [[{ pin: 2, neg: false }]], registered: true, activeHigh: false }] });
    expect(g.evaluate({}).pins[23]).toBe(1); // register 0 ⇒ pin 1
    expect(g.clock({ 2: 1 }).pins[23]).toBe(0);
    expect(g.clock({ 2: 0 }).pins[23]).toBe(1);
  });

  test('feedback of a registered output means the level on the pin, whichever polarity', () => {
    // A toggle flip-flop: D = ¬Q. Active high and active low both toggle the pin each clock.
    for (const activeHigh of [true, false]) {
      const g = chip({ outputs: [{ pin: 23, sum: [[{ pin: 23, neg: !activeHigh ? false : true }]], registered: true, activeHigh }] });
      // For active high D = ¬pin; for active low the stored D = pin (the pin is inverted on the way out).
      const seq: number[] = [];
      for (let i = 0; i < 6; i++) seq.push(g.clock({}).pins[23]!);
      const first = activeHigh ? 1 : 0;
      expect(seq).toEqual([first, 1 - first, first, 1 - first, first, 1 - first]);
    }
    // The fuses show the rule: active-high registered feedback uses the complement column ... of Q̄.
    const p = programGal22v10({ outputs: [{ pin: 23, sum: [[{ pin: 23, neg: true }]], registered: true, activeHigh: true }] });
    // Literal ¬pin23, flipped for a registered active-high pin ⇒ the true column (2) is connected.
    expect(p[fuseIndex(2, pinColumn(23))]).toBe(0);
    expect(p[fuseIndex(2, pinColumn(23) + 1)]).toBe(1);
  });

  test('AR resets asynchronously; SP presets on the clock; AR beats SP', () => {
    const g = chip({
      outputs: [
        { pin: 23, sum: [[{ pin: 2, neg: false }]], registered: true, activeHigh: true },
        { pin: 22, sum: GAL_TRUE, registered: true, activeHigh: true },
      ],
      ar: [[{ pin: 3, neg: false }]],
      sp: [[{ pin: 4, neg: false }]],
    });
    g.clock({ 2: 1 });
    expect(g.evaluate({}).pins[23]).toBe(1);
    expect(g.evaluate({}).pins[22]).toBe(1);
    // AR: immediate, no clock.
    const s = g.evaluate({ 3: 1 });
    expect([s.pins[23], s.pins[22]]).toEqual([0, 0]);
    expect(g.evaluate({}).pins[22]).toBe(0); // it stays reset
    // SP: needs a clock; overrides D.
    expect(g.evaluate({ 4: 1 }).pins[23]).toBe(0);
    expect(g.clock({ 4: 1, 2: 0 }).pins[23]).toBe(1);
    // AR wins over SP.
    g.clock({ 4: 1, 3: 1 });
    expect(g.evaluate({}).pins[23]).toBe(0);
  });

  test('an oscillating combinational loop is reported as unstable', () => {
    const g = chip({ outputs: [{ pin: 23, sum: [[{ pin: 23, neg: true }]], registered: false, activeHigh: true }] });
    expect(g.evaluate({}).stable).toBe(false);
    const ok = chip({ outputs: [{ pin: 23, sum: [[{ pin: 23, neg: false }, { pin: 2, neg: false }]], registered: false, activeHigh: true }] });
    expect(ok.evaluate({ 2: 1 }).stable).toBe(true);
  });

  test('decode round trip: configuration bits and rows', () => {
    const fuses = programGal22v10({
      outputs: [{ pin: 21, sum: [[{ pin: 5, neg: true }, { pin: 6, neg: false }]], registered: true, activeHigh: false, oe: [[{ pin: 7, neg: false }]] }],
      ar: [[{ pin: 8, neg: false }]],
      signature: 'SIG',
    });
    const c = decodeGal22v10(fuses);
    const o = c.olmcs.find((x) => x.pin === 21)!;
    expect(o.registered).toBe(true);
    expect(o.activeHigh).toBe(false);
    expect(o.terms[0]).toMatchObject({ kind: 'product', literals: [{ pin: 5, complement: true }, { pin: 6, complement: false }] });
    expect(o.terms[1]!.kind).toBe('false');
    expect(o.oe.literals).toEqual([{ pin: 7, complement: false }]);
    expect(c.ar.literals).toEqual([{ pin: 8, complement: false }]);
    expect(c.sp.kind).toBe('false');
    expect(String.fromCharCode(...c.signature.slice(0, 3))).toBe('SIG');
  });
});
