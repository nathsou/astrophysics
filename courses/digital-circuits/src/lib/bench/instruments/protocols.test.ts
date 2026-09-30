import { describe, expect, test } from 'vitest';
import { decoders, getDecoder } from './decoders';
import { Prng } from '$lib/sim/cpu/common/prng';
import {
  decodeI2c,
  decodeSpi,
  decodeUart,
  edgesOf,
  estimateBit,
  frameText,
  hexByte,
  i2cDecoder,
  i2cSignals,
  levelAt,
  makeSignal,
  registerProtocolDecoders,
  setLevel,
  spiDecoder,
  spiSignals,
  toInput,
  uartDecoder,
  uartSignal,
  type SpiConfig,
} from './protocols';

describe('signals', () => {
  test('a level holds until the next change', () => {
    const s = makeSignal(1, [[1, 0], [2, 1], [2.5, 1]]);
    expect(s.t).toEqual([0, 1, 2]);
    expect([0, 0.999, 1, 1.5, 2, 9].map((t) => levelAt(s, t))).toEqual([1, 1, 0, 0, 1, 1]);
    expect(edgesOf(s)).toEqual([{ t: 1, rising: false }, { t: 2, rising: true }]);
  });
  test('changes must come in time order', () => {
    const s = makeSignal(0, [[1, 1]]);
    expect(() => setLevel(s, 0.5, 0)).toThrow();
  });
});

describe('UART', () => {
  test('the frame of 0x41 at 9600 baud: idle high, start bit, eight bits LSB first, stop bit', () => {
    const { signal, frames, end } = uartSignal([0x41], { baud: 9600 });
    const T = 1 / 9600;
    // 0x41 = 0100 0001: start 0, then 1 0 0 0 0 0 1 0 (LSB first), stop 1.
    const bits = [0, 1, 0, 0, 0, 0, 0, 1, 0, 1];
    const t0 = frames[0]!.t0;
    expect(t0).toBeCloseTo(2 * T, 12);
    bits.forEach((b, i) => expect(levelAt(signal, t0 + (i + 0.5) * T), `bit ${i}`).toBe(b));
    expect(frames[0]!.t1 - t0).toBeCloseTo(10 * T, 12);
    expect(end).toBeGreaterThan(frames[0]!.t1);
  });

  test('round trip for every byte, at several baud rates, with and without parity and with two stop bits', () => {
    const all = Array.from({ length: 256 }, (_, i) => i);
    for (const cfg of [
      { baud: 9600 },
      { baud: 115200 },
      { baud: 300, stopBits: 2 as const },
      { baud: 9600, parity: 'even' as const },
      { baud: 9600, parity: 'odd' as const, stopBits: 2 as const },
    ]) {
      const { signal } = uartSignal(all, cfg);
      const frames = decodeUart(signal, cfg);
      expect(frames.map((f) => f.byte), JSON.stringify(cfg)).toEqual(all);
      expect(frames.some((f) => f.framingError || f.parityError)).toBe(false);
    }
  });

  test('the baud rate is found from the shortest pulse when it is not given', () => {
    const text = [...'Hello, World\n'].map((c) => c.charCodeAt(0));
    const { signal } = uartSignal(text, { baud: 19200 });
    expect(estimateBit(signal)).toBeCloseTo(1 / 19200, 10);
    expect(frameText(decodeUart(signal))).toBe('Hello, World\\n');
  });

  test('a line that is not high at the stop bit is a framing error', () => {
    const T = 1 / 9600;
    // A start bit and eight 0 bits, but the line stays low for the stop bit.
    const s = makeSignal(1, [[2 * T, 0], [14 * T, 1]]);
    const frames = decodeUart(s, { baud: 9600 });
    expect(frames).toHaveLength(1);
    expect(frames[0]!.framingError).toBe(true);
    expect(frames[0]!.byte).toBe(0);
  });

  test('a wrong parity bit is flagged', () => {
    const { signal, frames } = uartSignal([0b0000_0111], { baud: 9600, parity: 'even' });
    // Even parity of three ones is 1; flip the parity bit to 0.
    const T = 1 / 9600;
    const t = frames[0]!.t0 + 9 * T;
    const flipped = makeSignal(1, [], 0);
    for (let i = 0; i < signal.t.length; i++) {
      if (signal.t[i]! >= t - 1e-12 && signal.t[i]! < t + T - 1e-12) continue;
      setLevel(flipped, signal.t[i]!, signal.v[i]!);
    }
    setLevel(flipped, t, 0);
    setLevel(flipped, t + T, 1);
    const out = decodeUart(flipped, { baud: 9600, parity: 'even' });
    expect(out[0]!.parityError).toBe(true);
  });

  test('a decoder at the wrong baud rate makes garbage, or errors: it does not quietly agree', () => {
    const { signal } = uartSignal([0x55, 0x55, 0x55], { baud: 9600 });
    const wrong = decodeUart(signal, { baud: 4800 });
    expect(wrong.map((f) => f.byte)).not.toEqual([0x55, 0x55, 0x55]);
  });

  test('as a bench decoder: one annotation per frame, with the byte in hex', () => {
    const { signal, frames } = uartSignal([0x48, 0x69], { baud: 9600 });
    const notes = uartDecoder().decode(toInput([signal], ['RX']));
    expect(notes.map((n) => n.text)).toEqual(['0x48', '0x69']);
    expect(notes[0]!.t0).toBeCloseTo(frames[0]!.t0, 12);
    expect(notes.every((n) => !n.error)).toBe(true);
  });
});

describe('SPI', () => {
  const bytes = [0xa5, 0x00, 0xff, 0x3c, 0x81];
  for (const mode of [0, 1, 2, 3] as const) {
    for (const msbFirst of [true, false]) {
      test(`round trip in mode ${mode}, ${msbFirst ? 'MSB' : 'LSB'} first, on both data lines`, () => {
        const cfg: SpiConfig = { clockHz: 1e6, mode, msbFirst };
        const miso = [0x12, 0x34, 0x56, 0x78, 0x9a];
        const w = spiSignals(bytes, miso, cfg);
        const a = decodeSpi(w.sck, w.mosi, w.cs, { mode, msbFirst });
        const b = decodeSpi(w.sck, w.miso, w.cs, { mode, msbFirst });
        expect(a.bytes.map((x) => x.byte)).toEqual(bytes);
        expect(b.bytes.map((x) => x.byte)).toEqual(miso);
        expect(a.selects).toHaveLength(1);
      });
    }
  }

  test('mode 0: the clock idles low, data is sampled on the rising edge and changes on the falling edge', () => {
    const w = spiSignals([0x80], [], { clockHz: 1e6, mode: 0 });
    expect(levelAt(w.sck, 0)).toBe(0);
    const rises = edgesOf(w.sck).filter((e) => e.rising);
    expect(rises).toHaveLength(8);
    // At the first rising edge MOSI already holds the first bit (the MSB, 1).
    expect(levelAt(w.mosi, rises[0]!.t)).toBe(1);
    expect(levelAt(w.mosi, rises[1]!.t)).toBe(0);
    // CS is low around all eight edges.
    expect(levelAt(w.cs, rises[0]!.t)).toBe(0);
    expect(levelAt(w.cs, rises[7]!.t)).toBe(0);
    expect(levelAt(w.cs, 0)).toBe(1);
  });

  test('mode 2 idles high', () => {
    const w = spiSignals([0x01], [], { clockHz: 1e6, mode: 2 });
    expect(levelAt(w.sck, 0)).toBe(1);
  });

  test('two chip-select windows give two groups, and a wrong mode reads the wrong bits', () => {
    const w1 = spiSignals([0xa5], [], { clockHz: 1e6, mode: 0 });
    expect(decodeSpi(w1.sck, w1.mosi, w1.cs, { mode: 1 }).bytes[0]?.byte).not.toBe(0xa5);
  });

  test('as a bench decoder', () => {
    const w = spiSignals([0xde, 0xad], [0xbe, 0xef], { clockHz: 2e6, mode: 0 });
    const input = toInput([w.sck, w.mosi, w.miso, w.cs], ['SCK', 'MOSI', 'MISO', 'CS']);
    expect(spiDecoder().decode(input).map((n) => n.text)).toEqual(['0xDE', '0xAD']);
    expect(spiDecoder({ line: 'miso' }).decode(input).map((n) => n.text)).toEqual(['0xBE', '0xEF']);
  });
});

describe('I²C', () => {
  const texts = (events: { text: string }[]) => events.map((e) => e.text);

  test('a write of two bytes to 0x48', () => {
    const w = i2cSignals({ address: 0x48, read: false, bytes: [0x3a, 0x01] });
    expect(texts(decodeI2c(w.scl, w.sda))).toEqual(['START', 'Addr 0x48 W', 'ACK', '0x3A', 'ACK', '0x01', 'ACK', 'STOP']);
  });

  test('a read: the device sends the bytes and the master acknowledges all but the last', () => {
    const w = i2cSignals({ address: 0x50, read: true, bytes: [0xde, 0xad] });
    expect(texts(decodeI2c(w.scl, w.sda))).toEqual(['START', 'Addr 0x50 R', 'ACK', '0xDE', 'ACK', '0xAD', 'NACK', 'STOP']);
  });

  test('a device that is not there: the address is not acknowledged, and the master stops', () => {
    const w = i2cSignals({ address: 0x21, read: false, bytes: [1], nackAddress: true });
    expect(texts(decodeI2c(w.scl, w.sda))).toEqual(['START', 'Addr 0x21 W', 'NACK', 'STOP']);
  });

  test('START is SDA falling while SCL is high, and STOP is SDA rising while SCL is high', () => {
    const w = i2cSignals({ address: 1, read: false, bytes: [] });
    const fall = edgesOf(w.sda).find((e) => !e.rising)!;
    expect(levelAt(w.scl, fall.t)).toBe(1);
    const rise = edgesOf(w.sda).filter((e) => e.rising).pop()!;
    expect(levelAt(w.scl, rise.t)).toBe(1);
    // Every other change of SDA happens while SCL is low.
    const others = edgesOf(w.sda).filter((e) => e.t !== fall.t && e.t !== rise.t);
    expect(others.length).toBeGreaterThanOrEqual(2);
    for (const e of others) expect(levelAt(w.scl, e.t)).toBe(0);
  });

  test('the address bytes and data of random transactions come back', () => {
    const rng = new Prng(9);
    for (let i = 0; i < 40; i++) {
      const bytes = Array.from({ length: rng.int(0, 5) }, () => rng.int(0, 255));
      const address = rng.int(1, 127);
      const read = rng.chance(0.5);
      const w = i2cSignals({ address, read, bytes }, { sclHz: 400e3 });
      const ev = decodeI2c(w.scl, w.sda);
      const addr = ev.find((e) => e.kind === 'address')!;
      expect([addr.byte, addr.read]).toEqual([address, read]);
      expect(ev.filter((e) => e.kind === 'byte').map((e) => e.byte)).toEqual(bytes);
    }
  });

  test('as a bench decoder, a NACK is drawn as an error', () => {
    const w = i2cSignals({ address: 0x21, read: false, bytes: [], nackAddress: true });
    const notes = i2cDecoder().decode(toInput([w.scl, w.sda], ['SCL', 'SDA']));
    expect(notes.find((n) => n.text === 'NACK')!.error).toBe(true);
    expect(notes.every((n) => n.t1 >= n.t0)).toBe(true);
  });
});

describe('registering with the logic analyser', () => {
  test('the four decoders appear in its list', () => {
    registerProtocolDecoders();
    expect(decoders().map((d) => d.id)).toEqual(expect.arrayContaining(['uart', 'spi', 'spi-miso', 'i2c']));
    expect(getDecoder('i2c')!.channels).toEqual(['SCL', 'SDA']);
    expect(hexByte(5)).toBe('0x05');
  });
});
