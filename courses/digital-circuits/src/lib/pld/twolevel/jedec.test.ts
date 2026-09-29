import { describe, expect, test } from 'vitest';
import { ETX, JedecError, STX, fuseChecksum, readJedec, transmissionChecksum, writeJedec } from './jedec';
import { mulberry32 } from './random';

const bits = (s: string) => [...s].map((c) => (c === '1' ? 1 : 0));

describe('JEDEC checksums', () => {
  test('fuse checksum: 8-bit words, fuse 0 in the least significant bit, zero padded', () => {
    expect(fuseChecksum([])).toBe(0);
    expect(fuseChecksum(bits('1'))).toBe(0x01);
    expect(fuseChecksum(bits('10000000'))).toBe(0x01);
    expect(fuseChecksum(bits('00000001'))).toBe(0x80);
    expect(fuseChecksum(bits('11111111'))).toBe(0xff);
    // Two bytes: 0x01 + 0x80.
    expect(fuseChecksum(bits('10000000' + '00000001'))).toBe(0x81);
    // A partial last byte is padded with zeros: fuses 8, 9 set ⇒ 0x03.
    expect(fuseChecksum(bits('00000000' + '11'))).toBe(0x03);
    // The sum is 16 bits wide.
    expect(fuseChecksum(new Array(8 * 300).fill(1))).toBe((300 * 0xff) & 0xffff);
  });

  test('transmission checksum: sum of every character from STX to ETX', () => {
    expect(transmissionChecksum(`${STX}A*${ETX}`)).toBe(0x02 + 0x41 + 0x2a + 0x03);
    expect(transmissionChecksum(`${STX}${ETX}`)).toBe(5);
    expect(() => transmissionChecksum('€')).toThrow(JedecError);
    // 16-bit wrap-around, as in galette's own test: 0x101 bytes of 0xFF sum to 0xFFFF.
    expect(transmissionChecksum('\xff'.repeat(0x101))).toBe(0xffff);
    expect(transmissionChecksum('\xff'.repeat(0x102))).toBe(0x00fe);
  });
});

describe('JEDEC files', () => {
  const fuses = Uint8Array.from(bits('1010000011110000' + '0000000000000001' + '1'));

  test('write then read gives the same fuses and both checksums verify', () => {
    const text = writeJedec(fuses, { header: ['Test file'], pinCount: 20 });
    const f = readJedec(text);
    expect([...f.fuses]).toEqual([...fuses]);
    expect(f.fuseCount).toBe(33);
    expect(f.pinCount).toBe(20);
    expect(f.fuseChecksum!.stated).toBe(fuseChecksum(fuses));
    expect(f.transmissionChecksum!.stated).toBe(f.transmissionChecksum!.computed);
    expect(f.header.trim()).toBe('Test file');
  });

  test('the file has the JESD3 structure: STX, header, fields, ETX and a four-digit checksum', () => {
    const text = writeJedec(fuses, { header: ['Test'], pinCount: 24 });
    expect(text.startsWith(STX)).toBe(true);
    const etx = text.indexOf(ETX);
    expect(etx).toBeGreaterThan(0);
    expect(text.slice(etx + 1)).toMatch(/^[0-9A-F]{4}\n$/);
    expect(text).toContain('*QF33');
    expect(text).toContain('*QP24');
    expect(text).toContain('*F0');
    expect(text).toContain('*G0');
    expect(text).toMatch(/\*C[0-9A-F]{4}/);
    expect(parseInt(text.slice(etx + 1, etx + 5), 16)).toBe(transmissionChecksum(text.slice(0, etx + 1)));
  });

  test('L fields are skipped when every fuse equals the default, and read back as the default', () => {
    const zeros = new Uint8Array(100);
    zeros[70] = 1;
    const text = writeJedec(zeros, { header: [] });
    // 32-fuse blocks: only the block holding fuse 70 (blocks 64–95) is written.
    expect(text.match(/\*L/g)!.length).toBe(1);
    expect(text).toContain('*L0064 ');
    const f = readJedec(text);
    expect(f.fuses[70]).toBe(1);
    expect(f.fuses.reduce((a, b) => a + b, 0)).toBe(1);
  });

  test('default fuse state 1', () => {
    const ones = new Uint8Array(40).fill(1);
    ones[3] = 0;
    const text = writeJedec(ones, { defaultFuse: 1 });
    const f = readJedec(text);
    expect(f.defaultFuse).toBe(1);
    expect([...f.fuses]).toEqual([...ones]);
  });

  test('checksums are verified; a corrupted file is refused unless non-strict', () => {
    const good = writeJedec(fuses, { header: ['x'] });
    const badFuse = good.replace(/\*L0000 1/, '*L0000 0');
    expect(() => readJedec(badFuse)).toThrow(/checksum/i);
    const lenient = readJedec(badFuse, { strict: false });
    expect(lenient.fuseChecksum!.stated).not.toBe(lenient.fuseChecksum!.computed);
    // Corrupt only the header text: the fuse checksum is fine but the transmission checksum is not.
    const badHeader = good.replace('x\n', 'y\n');
    expect(() => readJedec(badHeader)).toThrow(/Transmission checksum/);
    // A transmission checksum of 0000 means "not computed".
    const noSum = good.replace(/[0-9A-F]{4}\n$/, '0000\n');
    expect(() => readJedec(noSum)).not.toThrow();
  });

  test('whitespace and line breaks inside L fields are ignored, fields may be in any layout', () => {
    const text = `${STX}hello\n*QF16\n*F0\n*L0 1010 0000\n 1111 0000*C${fuseChecksum(bits('1010000011110000')).toString(16).padStart(4, '0')}*\n${ETX}0000`;
    const f = readJedec(text);
    expect([...f.fuses]).toEqual(bits('1010000011110000'));
  });

  test('random round trips', () => {
    const rng = mulberry32(5);
    for (let t = 0; t < 30; t++) {
      const n = 1 + rng.int(500);
      const a = Uint8Array.from({ length: n }, () => (rng.chance(0.3) ? 1 : 0));
      const f = readJedec(writeJedec(a, { header: ['random'], eol: rng.chance(0.5) ? '\n' : '\r\n' }));
      expect([...f.fuses]).toEqual([...a]);
    }
  });

  test('errors: L past the end, bad fields', () => {
    expect(() => readJedec(`${STX}*QF4*F0*L2 1111*${ETX}0000`)).toThrow(/runs past/);
    expect(() => readJedec(`${STX}*QF4*F7*${ETX}0000`)).toThrow(/Bad F/);
    expect(() => readJedec(`${STX}*QF4*Lxx*${ETX}0000`)).toThrow(/Bad L/);
  });
});
