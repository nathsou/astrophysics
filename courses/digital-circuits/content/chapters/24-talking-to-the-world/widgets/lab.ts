/**
 * The serial lab: a transmitter's settings and a receiver's settings in, waveforms and decoded boxes out. The transmitter
 * writes the waveform (`uartSignal`, `spiSignals`, `i2cSignals`); the receiver is a decoder with its own settings, which may
 * disagree with the transmitter's (the wrong baud rate, the wrong SPI mode): that is what makes the decoded boxes worth
 * looking at.
 */
import type { Annotation } from '$lib/bench/instruments/decoders';
import {
  decodeI2c,
  decodeSpi,
  decodeUart,
  frameText,
  hexByte,
  i2cSignals,
  spiSignals,
  uartSignal,
  type I2cTransaction,
  type UartConfig,
  type UartFrame,
} from './protocols';
import type { DecodedRow, TraceChannel } from './trace';

export interface LabResult {
  channels: TraceChannel[];
  decoded: DecodedRow[];
  /** End of the waveform in seconds. */
  end: number;
  /** One line saying what the receiver made of it. */
  summary: string;
  /** True if the receiver got back what was sent. */
  ok: boolean;
}

/** Bytes from "48 69 0x21, 255": hexadecimal unless written with a 0d prefix or as a plain decimal above 0xFF. */
export function parseBytes(text: string): number[] {
  const out: number[] = [];
  for (const tok of text.split(/[\s,;]+/).filter(Boolean)) {
    const v = /^0x/i.test(tok) ? parseInt(tok.slice(2), 16) : parseInt(tok, 16);
    if (Number.isFinite(v) && v >= 0 && v <= 255) out.push(v);
  }
  return out;
}

export const UART_FORMATS = {
  '8N1': { dataBits: 8, parity: 'none', stopBits: 1 },
  '8E1': { dataBits: 8, parity: 'even', stopBits: 1 },
  '8N2': { dataBits: 8, parity: 'none', stopBits: 2 },
  '7E1': { dataBits: 7, parity: 'even', stopBits: 1 },
} as const satisfies Record<string, Pick<UartConfig, 'dataBits' | 'parity' | 'stopBits'>>;
export type UartFormat = keyof typeof UART_FORMATS;

export interface UartLabConfig {
  text: string;
  baud: number;
  format: UartFormat;
  /** The receiver's rate: a number, or 0 to find it from the shortest pulse. */
  receiverBaud: number;
  receiverFormat: UartFormat;
}

const asciiOf = (text: string) => [...text].map((c) => c.charCodeAt(0) & 0x7f);

export function uartLab(cfg: UartLabConfig): LabResult {
  const bytes = asciiOf(cfg.text);
  const tx = uartSignal(bytes, { baud: cfg.baud, ...UART_FORMATS[cfg.format] });
  const rxFmt = UART_FORMATS[cfg.receiverFormat];
  const frames: UartFrame[] = decodeUart(tx.signal, { ...(cfg.receiverBaud ? { baud: cfg.receiverBaud } : {}), ...rxFmt });
  const notes: Annotation[] = frames.map((f) => ({ t0: f.t0, t1: f.t1, text: f.framingError ? 'FRAMING' : f.parityError ? 'PARITY' : hexByte(f.byte), error: f.framingError || f.parityError }));
  const good = frames.filter((f) => !f.framingError && !f.parityError);
  const ok = frames.length === bytes.length && frames.every((f, i) => f.byte === bytes[i] && !f.framingError && !f.parityError);
  const errors = frames.length - good.length;
  return {
    channels: [{ name: 'TX', signal: tx.signal }],
    decoded: [{ name: 'UART', notes }],
    end: tx.end,
    ok,
    summary: `The receiver saw ${frames.length} frame${frames.length === 1 ? '' : 's'}${errors ? `, ${errors} with errors` : ''}: “${frameText(frames)}”${ok ? '. Every byte arrived.' : '.'}`,
  };
}

export interface SpiLabConfig {
  mosi: string;
  miso: string;
  clockHz: number;
  mode: 0 | 1 | 2 | 3;
  receiverMode: 0 | 1 | 2 | 3;
  msbFirst: boolean;
}

export function spiLab(cfg: SpiLabConfig): LabResult {
  const out = parseBytes(cfg.mosi);
  const back = parseBytes(cfg.miso);
  const w = spiSignals(out, back, { clockHz: cfg.clockHz, mode: cfg.mode, msbFirst: cfg.msbFirst });
  const a = decodeSpi(w.sck, w.mosi, w.cs, { mode: cfg.receiverMode, msbFirst: cfg.msbFirst });
  const b = decodeSpi(w.sck, w.miso, w.cs, { mode: cfg.receiverMode, msbFirst: cfg.msbFirst });
  const note = (x: { byte: number; t0: number; t1: number }): Annotation => ({ t0: x.t0, t1: x.t1, text: hexByte(x.byte) });
  const ok = a.bytes.length === out.length && a.bytes.every((x, i) => x.byte === out[i]) && b.bytes.every((x, i) => x.byte === (back[i] ?? 0));
  return {
    channels: [
      { name: 'CS', signal: w.cs, tone: 4 },
      { name: 'SCK', signal: w.sck, tone: 1 },
      { name: 'MOSI', signal: w.mosi, tone: 5 },
      { name: 'MISO', signal: w.miso, tone: 3 },
    ],
    decoded: [
      { name: 'MOSI', notes: a.bytes.map(note) },
      { name: 'MISO', notes: b.bytes.map(note) },
    ],
    end: w.end,
    ok,
    summary: `The receiver, in mode ${cfg.receiverMode}, read ${a.bytes.map((x) => hexByte(x.byte)).join(' ') || 'nothing'} on MOSI and ${b.bytes.map((x) => hexByte(x.byte)).join(' ') || 'nothing'} on MISO${ok ? ': exactly what was sent.' : '.'}`,
  };
}

export interface I2cLabConfig {
  address: number;
  read: boolean;
  bytes: string;
  sclHz: number;
  /** The device does not answer the address. */
  absent: boolean;
}

export function i2cLab(cfg: I2cLabConfig): LabResult {
  const txn: I2cTransaction = { address: cfg.address & 0x7f, read: cfg.read, bytes: parseBytes(cfg.bytes), nackAddress: cfg.absent };
  const w = i2cSignals(txn, { sclHz: cfg.sclHz });
  const events = decodeI2c(w.scl, w.sda);
  // A NACK is an error unless it is the master ending a read: the last data byte of a read is not acknowledged, by design.
  const reading = events.find((e) => e.kind === 'address')?.read === true;
  const notes: Annotation[] = events.map((e, i) => ({ t0: e.t0, t1: e.t1, text: e.text, error: e.kind === 'nack' && !(reading && events[i - 1]?.kind === 'byte') }));
  const data = events.filter((e) => e.kind === 'byte').map((e) => hexByte(e.byte!));
  const addr = events.find((e) => e.kind === 'address');
  const acked = events.filter((e) => e.kind === 'ack').length;
  const ok = !!addr && addr.byte === txn.address && !cfg.absent && data.join(' ') === txn.bytes.map(hexByte).join(' ');
  return {
    channels: [
      { name: 'SCL', signal: w.scl, tone: 1 },
      { name: 'SDA', signal: w.sda, tone: 5 },
    ],
    decoded: [{ name: 'I²C', notes }],
    end: w.end,
    ok,
    summary: cfg.absent
      ? `Nobody pulled SDA low in the ninth clock of the address byte: the master saw a NACK and stopped.`
      : `${addr ? `Address ${hexByte(addr.byte!)}, ${addr.read ? 'read' : 'write'}` : 'No address'}; ${data.length} data byte${data.length === 1 ? '' : 's'}${data.length ? ` (${data.join(' ')})` : ''}; ${acked} acknowledge bit${acked === 1 ? '' : 's'} low.`,
  };
}
