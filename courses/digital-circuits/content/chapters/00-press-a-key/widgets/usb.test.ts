import { describe, expect, test } from 'vitest';
import { BIT_TIME, CRC16_RESIDUAL, KEYS, MODIFIER, bitsLsbFirst, buildPacket, crc16, crcRegister, decodeLine, hidReport, voltages } from './usb';

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('CRC-16/USB', () => {
  test('matches the published check value for "123456789" (0xB4C8) and is the inverse of CRC-16/MODBUS (0x4B37)', () => {
    const reg = crcRegister(ascii('123456789'));
    expect(reg).toBe(0x4b37);
    expect(~reg & 0xffff).toBe(0xb4c8);
    const [lo, hi] = crc16(ascii('123456789'));
    expect((hi << 8) | lo).toBe(0xb4c8);
  });
  test('a good packet leaves the register at the constant residual, for any data', () => {
    for (const data of [[0, 0, 4, 0, 0, 0, 0, 0], [2, 0, 4, 0, 0, 0, 0, 0], [0x12, 0x34, 0x56], [], [0xff, 0xff, 0xff, 0xff]]) {
      const crc = crc16(data);
      expect(crcRegister([...data, ...crc])).toBe(CRC16_RESIDUAL);
    }
  });
  test('a single flipped bit is detected', () => {
    const data = [0, 0, 4, 0, 0, 0, 0, 0];
    const crc = crc16(data);
    const bad = [...data];
    bad[2] = bad[2]! ^ 0x10;
    expect(crcRegister([...bad, ...crc])).not.toBe(CRC16_RESIDUAL);
  });
});

describe('the HID report', () => {
  test('pressing “a” sends key code 4 in the third byte', () => {
    expect(hidReport(MODIFIER.none, [KEYS.a!])).toEqual([0, 0, 4, 0, 0, 0, 0, 0]);
  });
  test('Shift is bit 1 of the first byte', () => {
    expect(hidReport(MODIFIER.shift, [KEYS.a!])[0]).toBe(0b10);
  });
  test('at most six keys', () => {
    expect(hidReport(0, [4, 5, 6, 7, 8, 9, 10, 11]).length).toBe(8);
  });
});

describe('the packet', () => {
  const report = hidReport(MODIFIER.none, [KEYS.a!]);
  const p = buildPacket(report);

  test('SYNC is KJKJKJKK, whatever the data', () => {
    const sync = p.bits.slice(0, 8).map((b) => b.line).join('');
    expect(sync).toBe('KJKJKJKK');
    expect(buildPacket(hidReport(MODIFIER.shift, [KEYS.Enter!])).bits.slice(0, 8).map((b) => b.line).join('')).toBe('KJKJKJKK');
  });

  test('the bytes are SYNC, PID, the eight report bytes and the CRC', () => {
    expect(p.bytes.length).toBe(1 + 1 + 8 + 2);
    expect(p.bytes.slice(2, 10)).toEqual(report);
    expect(p.bytes[1]).toBe(0xc3);
    expect(p.fields.map((f) => f.name)).toEqual(['SYNC', 'PID', 'modifier', 'reserved', 'key 0', 'key 1', 'key 2', 'key 3', 'key 4', 'key 5', 'CRC16', 'EOP']);
  });

  test('the fields tile the packet with no gaps', () => {
    expect(p.fields[0]!.from).toBe(0);
    for (let i = 1; i < p.fields.length; i++) expect(p.fields[i]!.from).toBe(p.fields[i - 1]!.to);
    expect(p.fields[p.fields.length - 1]!.to).toBe(p.bits.length);
  });

  test('about a hundred bit times, which is about 67 µs at 1.5 Mbit/s', () => {
    expect(p.bits.length).toBeGreaterThanOrEqual(99);
    expect(p.bits.length).toBeLessThanOrEqual(105);
    expect(p.bits.length * BIT_TIME).toBeGreaterThan(65e-6);
    expect(p.bits.length * BIT_TIME).toBeLessThan(70e-6);
  });

  test('the line never stays in one state for more than six bit times before the end of the packet (bit stuffing)', () => {
    let run = 1;
    const body = p.bits.slice(0, p.bits.length - 3);
    for (let i = 1; i < body.length; i++) {
      run = body[i]!.line === body[i - 1]!.line ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(6);
    }
  });

  test('the packet ends with two bit times of SE0 and then idle J', () => {
    expect(p.bits.slice(-3).map((b) => b.line)).toEqual(['SE0', 'SE0', 'J']);
  });

  test('decoding the line gives back the bytes, so the encoding is reversible', () => {
    expect(decodeLine(p.bits.map((b) => b.line))).toEqual(p.bytes);
    for (const [mod, k] of [[MODIFIER.shift, KEYS.Enter!], [MODIFIER.none, KEYS.z!], [MODIFIER.shift, KEYS.Space!]] as const) {
      const q = buildPacket(hidReport(mod, [k]));
      expect(decodeLine(q.bits.map((b) => b.line))).toEqual(q.bytes);
    }
  });

  test('a run of six ones gets a zero stuffed after it', () => {
    // 0xFF bytes force stuffing
    const q = buildPacket([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(q.bits.filter((b) => b.stuffed).length).toBeGreaterThan(8);
    for (const b of q.bits.filter((b) => b.stuffed)) expect(b.value).toBe(0);
    expect(decodeLine(q.bits.map((b) => b.line))).toEqual(q.bytes);
  });

  test('the data bits of the a-report, least significant first, are what the wire carries', () => {
    const third = p.fields[4]!; // key 0 = 0x04 = 00000100
    const seen = p.bits.slice(third.from, third.to).filter((b) => !b.stuffed).map((b) => b.value);
    expect(seen).toEqual(bitsLsbFirst(4));
  });
});

describe('voltages', () => {
  test('low-speed idle (J) has D− high and D+ low; K is the reverse; SE0 is both low', () => {
    expect(voltages('J')).toEqual({ dPlus: 0, dMinus: 3.3 });
    expect(voltages('K')).toEqual({ dPlus: 3.3, dMinus: 0 });
    expect(voltages('SE0')).toEqual({ dPlus: 0, dMinus: 0 });
  });
});
