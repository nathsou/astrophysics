import { describe, expect, test } from 'vitest';
import { i2cLab, parseBytes, spiLab, uartLab } from './lab';

describe('parseBytes', () => {
  test('hexadecimal by default, with or without 0x, separated by spaces or commas', () => {
    expect(parseBytes('48 69 0x21, ff;0')).toEqual([0x48, 0x69, 0x21, 0xff, 0]);
    expect(parseBytes('zz 100 -1 7')).toEqual([7]);
    expect(parseBytes('')).toEqual([]);
  });
});

describe('UART lab', () => {
  const base = { text: 'Hi!', baud: 9600, format: '8N1' as const, receiverBaud: 9600, receiverFormat: '8N1' as const };
  test('a receiver with the same settings gets the message back', () => {
    const r = uartLab(base);
    expect(r.ok).toBe(true);
    expect(r.decoded[0]!.notes.map((n) => n.text)).toEqual(['0x48', '0x69', '0x21']);
    expect(r.summary).toContain('“Hi!”');
    expect(r.end).toBeGreaterThan(30 / 9600);
  });
  test('the receiver can find the baud rate itself', () => {
    expect(uartLab({ ...base, baud: 115200, receiverBaud: 0 }).ok).toBe(true);
  });
  test('the wrong baud rate, or the wrong format, is not quietly right', () => {
    expect(uartLab({ ...base, receiverBaud: 4800 }).ok).toBe(false);
    expect(uartLab({ ...base, receiverBaud: 19200 }).ok).toBe(false);
    const parity = uartLab({ ...base, format: '8N1', receiverFormat: '8E1' });
    expect(parity.ok).toBe(false);
  });
  test('8E1 to 8E1 works and puts a parity bit in the frame', () => {
    const r = uartLab({ ...base, format: '8E1', receiverFormat: '8E1' });
    expect(r.ok).toBe(true);
    const plain = uartLab(base);
    expect(r.end).toBeGreaterThan(plain.end);
  });
});

describe('SPI lab', () => {
  const base = { mosi: 'A5 3C', miso: '00 FF', clockHz: 1e6, mode: 0 as const, receiverMode: 0 as const, msbFirst: true };
  test('same mode: exactly what was sent, on both lines', () => {
    const r = spiLab(base);
    expect(r.ok).toBe(true);
    expect(r.decoded[0]!.notes.map((n) => n.text)).toEqual(['0xA5', '0x3C']);
    expect(r.decoded[1]!.notes.map((n) => n.text)).toEqual(['0x00', '0xFF']);
    expect(r.channels.map((c) => c.name)).toEqual(['CS', 'SCK', 'MOSI', 'MISO']);
  });
  test('the wrong mode reads different bits', () => {
    expect(spiLab({ ...base, receiverMode: 1 }).ok).toBe(false);
    expect(spiLab({ ...base, mode: 3, receiverMode: 3 }).ok).toBe(true);
  });
});

describe('I²C lab', () => {
  const base = { address: 0x48, read: false, bytes: '3A 01', sclHz: 100e3, absent: false };
  test('a write to 0x48', () => {
    const r = i2cLab(base);
    expect(r.ok).toBe(true);
    expect(r.decoded[0]!.notes.map((n) => n.text)).toEqual(['START', 'Addr 0x48 W', 'ACK', '0x3A', 'ACK', '0x01', 'ACK', 'STOP']);
    expect(r.summary).toContain('Address 0x48, write');
  });
  test('an absent device: NACK on the address, flagged as an error', () => {
    const r = i2cLab({ ...base, absent: true });
    expect(r.ok).toBe(false);
    expect(r.decoded[0]!.notes.find((n) => n.text === 'NACK')!.error).toBe(true);
  });
  test('a read ends with the master’s NACK, which is not an error of the bus', () => {
    const r = i2cLab({ ...base, read: true, bytes: 'DE AD' });
    expect(r.ok).toBe(true);
    expect(r.decoded[0]!.notes.map((n) => n.text).slice(-3)).toEqual(['0xAD', 'NACK', 'STOP']);
    expect(r.decoded[0]!.notes.find((n) => n.text === 'NACK')!.error).toBe(false);
  });
});
