import { describe, expect, test } from 'vitest';
import { Gal22v10, describeFuse, fuseIndex, pinColumn, s0Fuse, s1Fuse } from './gal22v10';
import { GALETTE_CASES } from './gal22v10-galette-cases';
import { GAL_FIXTURES } from './gal22v10-fixtures';
import { PldError, assemblePld, parsePld } from './gal22v10-pld';
import { readGal22v10Jedec } from './gal22v10-jedec';

const header = (pins1: string, pins2: string, sig = 'Test') => `GAL22V10\n${sig}\n\n${pins1}\n${pins2}\n\n`;
const P1 = 'Clock I0 I1 I2 I3 I4 I5 I6 I7 I8 I9 GND';
const P2 = 'NC O0 O1 O2 O3 O4 O5 O6 O7 O8 O9 VCC';

describe('.pld parsing and assembly', () => {
  test('galette’s own GAL22V10 test cases assemble byte for byte to the files galette wrote', () => {
    for (const c of GALETTE_CASES) expect(assemblePld(c.pld).jedec(), c.name).toBe(c.jedec);
  });

  test('the course fixtures assemble to the files galette wrote', () => {
    expect(GAL_FIXTURES.length).toBe(3);
    for (const f of GAL_FIXTURES) {
      const jed = assemblePld(f.pld).jedec();
      expect(jed, f.id).toBe(f.galetteJedec);
      expect(readGal22v10Jedec(jed).fuseCount).toBe(5892);
    }
  });

  test('header: device, signature, pins with / for active low', () => {
    const src = parsePld(header('Clock /A B NC NC NC NC NC NC NC NC GND', 'NC Y NC NC NC NC NC NC NC NC NC VCC', 'ABCDEFGHIJ') + 'Y = A * B');
    expect(src.device).toBe('GAL22V10');
    expect(src.signature).toBe('ABCDEFGH');
    expect(src.pins[1]).toBe('/A');
    expect(src.pins[12]).toBe('NC');
    expect(src.equations.length).toBe(1);
    // /A declared active low, so `A` in an equation is the complement of the pin level.
    expect(src.equations[0]!.rhs).toEqual([
      { pin: 2, neg: true },
      { pin: 3, neg: false },
    ]);
  });

  test('equation syntax: /, *, +, & and #, continuation lines, comments, DESCRIPTION', () => {
    const src = header(P1, P2) +
      `; a comment
O0 = I0 * /I1 + /I0 * I1 ; xor
O1 = I0 & I1
   # I2
O2 = I3 *
     I4
   + I5

DESCRIPTION
O3 = this is ignored
`;
    const a = assemblePld(src);
    expect(a.source.equations.length).toBe(3);
    const eq1 = a.source.equations[1]!;
    expect(eq1.isOr).toEqual([false, false, true]);
    const g = new Gal22v10(a.fuses);
    // Pin numbers: I0 = 2, I1 = 3, I2 = 4; O0 = 14, O1 = 15.
    for (let x = 0; x < 8; x++) {
      const i0 = x & 1, i1 = (x >> 1) & 1, i2 = (x >> 2) & 1;
      const s = g.evaluate({ 2: i0 as 0 | 1, 3: i1 as 0 | 1, 4: i2 as 0 | 1 });
      expect(s.pins[14]).toBe(i0 ^ i1);
      expect(s.pins[15]).toBe((i0 & i1) | i2);
    }
  });

  test('assembly is literal: products keep their order and nothing is simplified', () => {
    const a = assemblePld(header(P1, P2) + 'O0 = I0 * I1 + I0 * I1 + I0');
    // Three product terms are used even though the function is just I0.
    expect(a.olmcs.find((o) => o.pin === 14)!.terms).toBe(3);
    const t = (row: number, pin: number, comp = false) => a.fuses[fuseIndex(row, pinColumn(pin) + (comp ? 1 : 0))];
    // Pin 14's OE row is 122, its first product row 123.
    expect(t(123, 2)).toBe(0);
    expect(t(123, 3)).toBe(0);
    expect(t(125, 3)).toBe(1);
  });

  test('VCC and GND as constants; .T and .E; AR and SP', () => {
    const a = assemblePld(header(P1, P2) + 'O0 = VCC\nO1 = GND\nO2.T = I0\nO2.E = I1 * /I2\nAR = I3\nSP = I4');
    const g = new Gal22v10(a.fuses);
    const s = g.evaluate({ 2: 1, 3: 1, 4: 0 });
    expect(s.pins[14]).toBe(1);
    expect(s.pins[15]).toBe(0);
    expect(s.driven[16]).toBe(true);
    expect(g.evaluate({ 2: 1, 3: 0, 4: 0 }).driven[16]).toBe(false);
    expect(g.evaluate({ 2: 1, 3: 1, 4: 1 }).driven[16]).toBe(false);
    expect(describeFuse(fuseIndex(0, pinColumn(5)))).toMatchObject({ rowKind: 'AR' });
    expect(a.fuses[fuseIndex(0, pinColumn(5))]).toBe(0); // AR = I3 (pin 5)
    expect(a.fuses[fuseIndex(131, pinColumn(6))]).toBe(0); // SP = I4 (pin 6)
  });

  test('configuration bits: S0 for active high, S1 for combinational or input', () => {
    const a = assemblePld(header(P1, P2) + 'O0 = I0\n/O1 = I1\nO2.R = I2\n/O3.R = I3\nO4 = O5');
    const bit = (f: number) => a.fuses[f];
    // Pin 14 = O0: active high combinational: S0 = 1, S1 = 1.
    expect([bit(s0Fuse(14)), bit(s1Fuse(14))]).toEqual([1, 1]);
    // Pin 15 = O1: active low combinational: 0, 1.
    expect([bit(s0Fuse(15)), bit(s1Fuse(15))]).toEqual([0, 1]);
    // Pin 16 = O2.R: active high registered: 1, 0.
    expect([bit(s0Fuse(16)), bit(s1Fuse(16))]).toEqual([1, 0]);
    // Pin 17 = O3.R: active low registered: 0, 0.
    expect([bit(s0Fuse(17)), bit(s1Fuse(17))]).toEqual([0, 0]);
    // Pin 19 = O5 is used as an input, not driven: S0 = 0, S1 = 1.
    expect([bit(s0Fuse(19)), bit(s1Fuse(19))]).toEqual([0, 1]);
    // Pin 23 = O9 is unused: 0, 0.
    expect([bit(s0Fuse(23)), bit(s1Fuse(23))]).toEqual([0, 0]);
    expect(a.olmcs.find((o) => o.pin === 19)!.role).toBe('input');
    expect(a.olmcs.find((o) => o.pin === 23)!.role).toBe('unused');
  });

  test('too many product terms for the macrocell', () => {
    const h = header(P1, P2);
    // O0 is pin 14 with 8 terms.
    let msg = '';
    try {
      assemblePld(h + 'O0 = I0 + I1 + I2 + I3 + I4 + I5 + I6 + I7 + I8');
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toBe('Error in line 7: too many product terms in sum for pin (max: 8, saw: 9)');
  });

  test('other errors', () => {
    const h = header(P1, P2);
    const message = (src: string) => {
      try {
        assemblePld(src);
      } catch (e) {
        return (e as Error).message;
      }
      return 'no error';
    };
    expect(message('GAL16V8\nX\n')).toMatch(/only the GAL22V10/);
    expect(message('GAL42V13\nX\n')).toBe("Error in line 1: unexpected GAL type found: 'GAL42V13'");
    expect(message(h + 'O0 = I0\nO0 = I1')).toBe('Error in line 8: output O0 is defined multiple times');
    expect(message(h + 'O0 = X1')).toBe("Error in line 7: unknown pinname 'X1'");
    expect(message(h + 'O0 = NC')).toBe('Error in line 7: NC (Not Connected) is not allowed in logic equations');
    expect(message(h + 'I0 = I1')).toBe("Error in line 7: this pin can't be used as output");
    expect(message(h + 'O0.E = I0')).toBe('Error in line 7: the output must be defined to use .E');
    expect(message(h + 'O0 = I0\nO0.E = I1')).toBe("Error in line 8: tristate control without previous '.T'");
    expect(message(h + 'AR = I0 + I1')).toBe('Error in line 7: only one product term allowed (no OR)');
    expect(message(h + 'AR = I0\nAR = I1')).toBe('Error in line 8: AR is defined twice');
    expect(message(h + 'O0.CLK = I0')).toBe('Error in line 7: .CLK is not allowed when this type of GAL is used');
    expect(message(h + 'O0 = /VCC')).toBe('Error in line 7: VCC cannot be negated, use GND instead of /VCC');
    expect(message(h + 'O0 = I0 $ I1')).toBe("Error in line 7: unexpected character in input: '$'");
    expect(message(h + 'O0 = I0 * GND')).toBe('Error in line 7: use of VCC and GND is not allowed in equations');
    expect(message(`GAL22V10\nX\n${P1}\n`)).toMatch(/expected pin definitions, found end of file/);
    expect(message(`GAL22V10\nX\n${P1}\nNC O0 O1\n`)).toBe('Error in line 4: wrong number of pins on pin definition line - expected 12, found 3');
    expect(message(`GAL22V10\nX\nClock I0 I1 I2 I3 I4 I5 I6 I7 I8 I9 VCC\n${P2}\n`)).toBe('Error in line 3: pin 12 must be named GND');
    expect(message(`GAL22V10\nX\nClock I0 I0 I2 I3 I4 I5 I6 I7 I8 I9 GND\n${P2}\n`)).toBe('Error in line 3: pinname I0 is defined twice');
  });
});
