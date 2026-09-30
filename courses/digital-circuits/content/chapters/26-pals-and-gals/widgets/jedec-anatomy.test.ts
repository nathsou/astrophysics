import { describe, expect, test } from 'vitest';
import { FUSE_COUNT, SIGNATURE_BASE } from '$lib/pld/devices/gal22v10';
import { readGal22v10Jedec } from '$lib/pld/devices/gal22v10-jedec';
import { DESIGNS, accepted, checksums, explain, fitDesign, flipped, lines, render } from './jedec-anatomy';

describe('the JEDEC file of the traffic light', () => {
  const fit = fitDesign('traffic-light');
  const text = fit.jedec();

  test('rendering the fitter’s own fuses gives exactly the fitter’s file', () => {
    expect(render(fit, fit.fuses)).toBe(text);
  });

  test('it is a valid 5,892-fuse, 24-pin file with both checksums right', () => {
    const f = readGal22v10Jedec(text, true);
    expect(f.fuseCount).toBe(FUSE_COUNT);
    expect(f.pinCount).toBe(24);
    expect(accepted(text)).toBe(true);
  });

  test('the checksums quoted in the chapter', () => {
    const c = checksums(text, fit.fuses);
    expect(c.writtenFuse).toBe(0x6a96);
    expect(c.fuse).toBe(0x6a96);
    expect(c.writtenTransmission).toBe(0xe725);
    expect(c.transmission).toBe(0xe725);
  });

  test('its lines: header, format fields, 21 L fields, checksums', () => {
    const ls = lines(text);
    const count = (k: string) => ls.filter((l) => l.kind === k).length;
    expect(ls[0]!.kind).toBe('stx');
    expect(count('array')).toBe(19);
    expect(count('config')).toBe(1);
    expect(count('signature')).toBe(1);
    expect(count('array') + count('config') + count('signature')).toBe(21);
    expect(ls.filter((l) => l.kind === 'QF')[0]!.text).toBe('*QF5892');
    expect(ls[ls.length - 1]!.kind).toBe('etx');
    expect(ls[ls.length - 1]!.text.slice(1)).toBe('E725');
  });

  test('an L line of the array names its row, its macrocell and the equation on that row', () => {
    const ls = lines(text).filter((l) => l.kind === 'array');
    const bodies = ls.map((l) => explain(l, fit, fit.fuses).body.join(' '));
    // Row 0 is the asynchronous reset, wired to RST.
    expect(bodies[0]).toContain('asynchronous reset');
    expect(bodies[0]).toContain('RST');
    // Somewhere is the second term of Q0: CAR · T · /Q0 (pin 15).
    expect(bodies.some((b) => b.includes('macrocell on pin 15') && b.includes('CAR · T · /Q0'))).toBe(true);
  });

  test('the configuration line lists the registered outputs Q1 and Q0', () => {
    const c = lines(text).find((l) => l.kind === 'config')!;
    const body = explain(c, fit, fit.fuses).body.join('\n');
    expect(body).toContain('pin 15 (Q0): S0 = 1, S1 = 0: registered, active high');
    expect(body).toContain('pin 14 (Q1): S0 = 1, S1 = 0: registered, active high');
    expect(body).toContain('pin 16 (MG): S0 = 1, S1 = 1: combinational, active high');
  });

  test('the signature spells the title’s first eight characters', () => {
    const s = lines(text).find((l) => l.kind === 'signature')!;
    expect(s.start).toBe(SIGNATURE_BASE);
    expect(explain(s, fit, fit.fuses).body.join(' ')).toContain('“Traffic-”');
  });

  test('flipping one fuse changes the fuse checksum by the weight of that bit, and the file is still self-consistent', () => {
    const f2 = flipped(fit.fuses, 0);
    const t2 = render(fit, f2);
    const c2 = checksums(t2, f2);
    // Fuse 0 is the least significant bit of byte 0: the checksum moves by 1.
    expect(Math.abs(c2.fuse - 0x6a96)).toBe(1);
    expect(c2.writtenFuse).toBe(c2.fuse);
    expect(c2.writtenTransmission).toBe(c2.transmission);
    expect(accepted(t2)).toBe(true);
    // A hand edit that does not update the checksums is refused.
    const bad = text.replace('*L0000 1', '*L0000 0');
    expect(bad).not.toBe(text);
    expect(accepted(bad)).toBe(false);
  });

  test('flipping rejects out-of-range fuses', () => {
    expect(() => flipped(fit.fuses, 5892)).toThrow(RangeError);
    expect(() => flipped(fit.fuses, -1)).toThrow(RangeError);
  });
});

describe('the other design', () => {
  test('the 3-to-8 decoder: eight one-term outputs, fitted and valid', () => {
    const fit = fitDesign('decoder');
    expect(fit.outputs).toHaveLength(8);
    expect(fit.outputs.every((o) => o.terms === 1)).toBe(true);
    expect(accepted(fit.jedec())).toBe(true);
    expect(DESIGNS.map((d) => d.id)).toEqual(['traffic-light', 'decoder']);
  });
});

describe('editing by hand', () => {
  const fit = fitDesign('traffic-light');
  const text = fit.jedec();
  test('a flipped fuse with the old checksums left in is a file a programmer refuses', async () => {
    const { withStaleChecksums, fuseText } = await import('./jedec-anatomy');
    const f2 = flipped(fit.fuses, 3);
    const bad = withStaleChecksums(fit, text, f2);
    expect(accepted(bad)).toBe(false);
    const c = checksums(bad, f2);
    expect(c.writtenFuse).toBe(0x6a96);
    expect(c.fuse).not.toBe(c.writtenFuse);
    expect(c.writtenTransmission).toBe(0xe725);
    expect(c.transmission).not.toBe(c.writtenTransmission);
    expect(fuseText(fit, f2, 3)).toContain('row 0, column 3');
  });
});
