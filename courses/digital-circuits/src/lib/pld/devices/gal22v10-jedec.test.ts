import { describe, expect, test } from 'vitest';
import { ETX, JedecError, fuseChecksum, transmissionChecksum } from '../twolevel/jedec';
import { FUSE_COUNT, SIGNATURE_BASE, Gal22v10, blankFuses, setSignature } from './gal22v10';
import { GAL22V10_BLOCKS, readGal22v10Jedec, writeGal22v10Jedec } from './gal22v10-jedec';
import { GALETTE_CASES } from './gal22v10-galette-cases';
import { programGal22v10 } from './gal22v10-program';
import { mulberry32 } from '../twolevel/random';

describe('GAL22V10 JEDEC files', () => {
  test('block layout: 132 array rows, then 20 configuration bits, then 64 signature bits', () => {
    expect(GAL22V10_BLOCKS.length).toBe(134);
    expect(GAL22V10_BLOCKS[131]).toEqual({ start: 131 * 44, length: 44 });
    expect(GAL22V10_BLOCKS[132]).toEqual({ start: 5808, length: 20, always: true });
    expect(GAL22V10_BLOCKS[133]).toEqual({ start: 5828, length: 64, always: true });
  });

  test('standard style: QF5892, QP24, F0, G0, L fields, fuse checksum, transmission checksum', () => {
    const fuses = programGal22v10({
      outputs: [{ pin: 23, sum: [[{ pin: 2, neg: false }, { pin: 3, neg: true }]], registered: false, activeHigh: true }],
      signature: 'TEST',
    });
    const text = writeGal22v10Jedec(fuses);
    expect(text.startsWith('\x02')).toBe(true);
    expect(text).toContain('*QF5892');
    expect(text).toContain('*QP24');
    expect(text).toContain('*F0');
    expect(text).toContain('*G0');
    expect(text).toMatch(/\*C[0-9A-F]{4}\n/);
    const etx = text.indexOf(ETX);
    expect(text.slice(etx + 1)).toMatch(/^[0-9A-F]{4}\n$/);
    // Rows that are all zeros (false terms) are not listed; the configuration and signature are.
    expect(text).toMatch(/\*L5808 [01]{20}\n/);
    expect(text).toMatch(/\*L5828 [01]{64}\n/);
    const back = readGal22v10Jedec(text);
    expect(back.fuseCount).toBe(FUSE_COUNT);
    expect([...back.fuses]).toEqual([...fuses]);
    expect(back.fuseChecksum!.stated).toBe(fuseChecksum(fuses));
    expect(back.transmissionChecksum!.stated).toBe(transmissionChecksum(text.slice(0, etx + 1)));
  });

  test('write → read → same behaviour on random fuse maps', () => {
    const rng = mulberry32(11);
    for (let t = 0; t < 10; t++) {
      const fuses = Uint8Array.from({ length: FUSE_COUNT }, () => (rng.chance(0.5) ? 1 : 0));
      const text = writeGal22v10Jedec(fuses, { eol: t % 2 ? '\r\n' : '\n' });
      const back = readGal22v10Jedec(text);
      expect([...back.fuses]).toEqual([...fuses]);
      // The device built from the file reads the same as the original.
      const a = new Gal22v10(fuses);
      const b = new Gal22v10(back.fuses);
      for (let k = 0; k < 8; k++) {
        const inputs: Record<number, 0 | 1> = {};
        for (let p = 1; p <= 23; p++) inputs[p] = rng.chance(0.5) ? 1 : 0;
        expect(b.evaluate(inputs).pins).toEqual(a.evaluate(inputs).pins);
      }
    }
  });

  test('galette style reproduces galette 0.3.0 byte for byte, from the fuses galette wrote', () => {
    for (const c of GALETTE_CASES) {
      const f = readGal22v10Jedec(c.jedec);
      expect(writeGal22v10Jedec(f.fuses, { style: 'galette' })).toBe(c.jedec);
    }
  });

  test('known vectors: checksums of a galette-generated file', () => {
    const reg = GALETTE_CASES.find((c) => c.name === 'GAL22V10_reg')!;
    const f = readGal22v10Jedec(reg.jedec);
    expect(f.fuseChecksum).toEqual({ stated: 0x865b, computed: 0x865b });
    expect(f.transmissionChecksum).toEqual({ stated: 0x12c2, computed: 0x12c2 });
    // galette's default: no security fuse, signature "RegTest".
    expect(f.security).toBe(false);
    expect(String.fromCharCode(...f.fuses.slice(SIGNATURE_BASE, SIGNATURE_BASE + 64).reduce<number[]>((acc, bit, i) => {
      if (i % 8 === 0) acc.push(0);
      acc[acc.length - 1] = acc[acc.length - 1]! * 2 + bit;
      return acc;
    }, []).filter(Boolean))).toBe('RegTest');
  });

  test('a blank device: fuse checksum and file are stable', () => {
    const blank = blankFuses();
    expect(fuseChecksum(blank)).toBe(0);
    const text = writeGal22v10Jedec(blank);
    expect(text).toContain('*C0000');
    // Only the always-written blocks.
    expect(text.match(/\*L/g)!.length).toBe(2);
  });

  test('security fuse and signature', () => {
    const f = blankFuses();
    setSignature(f, 'ABCDEFGH');
    const text = writeGal22v10Jedec(f, { security: true });
    expect(text).toContain('*G1');
    expect(readGal22v10Jedec(text).security).toBe(true);
  });

  test('wrong sizes and corrupted files are refused', () => {
    expect(() => writeGal22v10Jedec(new Uint8Array(100))).toThrow(/5892/);
    const text = writeGal22v10Jedec(blankFuses());
    expect(() => readGal22v10Jedec(text.replace('*QF5892', '*QF2194'), false)).toThrow(JedecError);
    expect(() => readGal22v10Jedec(text.replace('*QP24', '*QP20'), false)).toThrow(/24-pin/);
    const flipped = text.replace(/\*L5808 0/, '*L5808 1');
    expect(() => readGal22v10Jedec(flipped)).toThrow(/checksum/i);
    expect(readGal22v10Jedec(flipped, false).fuses[5808]).toBe(1);
  });
});
