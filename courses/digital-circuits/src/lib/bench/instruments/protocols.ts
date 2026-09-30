/**
 * Serial protocols: waveform generators and decoders for UART, SPI and I²C.
 *
 * A *signal* here is what a logic analyser records: a list of times at which a line changed and the level it changed to
 * (`v[i]` holds from `t[i]` until `t[i + 1]`). The generators produce the waveforms a transmitter would put on the wires;
 * the decoders read them back the way a protocol analyser does: find the edges, sample in the middle of each bit, and
 * assemble bytes. The decoders implement the bench's `Decoder` interface (`src/lib/bench/instruments/decoders.ts`), so
 * `registerProtocolDecoders()` makes them available to the logic analyser instrument too, and the chapter's figures use the
 * same objects.
 *
 * Levels are 0, 1, 2 (unknown) and 3 (high impedance), as in the digital engine. A decoder treats anything but 1 as low.
 */
import { registerDecoder, type Annotation, type Decoder, type DecoderInput } from '$lib/bench/instruments/decoders';

export interface Signal {
  /** Times (s) at which the level changes (the first entry is the starting level). */
  t: number[];
  /** The level from that time on. */
  v: number[];
}

/** A decoded item with the bytes and characters it carries, for terminals and tables. */
export interface Decoded extends Annotation {
  kind: 'frame' | 'byte' | 'start' | 'stop' | 'ack' | 'nack' | 'address' | 'select';
  /** The byte, for kind frame, byte and address. */
  byte?: number;
}

/** Build a signal from a start level and a list of [time, level] changes; repeated levels are dropped. */
export function makeSignal(start: number, changes: [number, number][] = [], t0 = 0): Signal {
  const s: Signal = { t: [t0], v: [start] };
  for (const [t, v] of [...changes].sort((a, b) => a[0] - b[0])) setLevel(s, t, v);
  return s;
}

export function setLevel(s: Signal, t: number, v: number): void {
  if (s.v[s.v.length - 1] === v) return;
  if (t < s.t[s.t.length - 1]! - 1e-15) throw new Error('signal changes must be in time order');
  s.t.push(t);
  s.v.push(v);
}

/** The level at time `t` (before the first entry: the first level). */
export function levelAt(s: Signal, t: number): number {
  let lo = 0;
  let hi = s.t.length - 1;
  if (t < s.t[0]!) return s.v[0]!;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (s.t[mid]! <= t) lo = mid;
    else hi = mid - 1;
  }
  return s.v[lo]!;
}

const isHigh = (v: number) => v === 1;

export interface Edge {
  t: number;
  /** True for a rising edge. */
  rising: boolean;
}

export function edgesOf(s: Signal): Edge[] {
  const out: Edge[] = [];
  for (let i = 1; i < s.t.length; i++) {
    const a = isHigh(s.v[i - 1]!);
    const b = isHigh(s.v[i]!);
    if (a !== b) out.push({ t: s.t[i]!, rising: b });
  }
  return out;
}

/** The end of a signal: the time of its last change. */
export const lastChange = (s: Signal) => s.t[s.t.length - 1]!;

/** Turn the aligned rows of a recorder (one time per row, one array per channel) into one signal per channel. */
export function signalsOf(input: DecoderInput): Signal[] {
  return Array.from(input.channels, (ch) => {
    const s: Signal = { t: [], v: [] };
    for (let i = 0; i < input.times.length && i < ch.length; i++) {
      if (s.v.length && s.v[s.v.length - 1] === ch[i]) continue;
      s.t.push(input.times[i]!);
      s.v.push(ch[i]!);
    }
    return s;
  });
}

/** Sample rows for a set of signals, one row per change of any of them (what a recorder would produce). */
export function toInput(signals: Signal[], names: string[]): DecoderInput {
  const times = [...new Set(signals.flatMap((s) => s.t))].sort((a, b) => a - b);
  return { times, channels: signals.map((s) => times.map((t) => levelAt(s, t))), names };
}

// ───────────────────────────────────────────── UART ─────────────────────────────────────────────

export interface UartConfig {
  baud: number;
  dataBits?: number;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 2;
  /** Bit times of idle line before the first frame (default 2) and between frames (default 1). */
  idleBits?: number;
  gapBits?: number;
}

export interface UartFrame {
  byte: number;
  t0: number;
  t1: number;
  /** True if the stop bit was not high. */
  framingError: boolean;
  /** True if the parity bit did not match. */
  parityError: boolean;
}

/** The line of a UART transmitter sending `bytes` (LSB first, idle high), and where each frame is. */
export function uartSignal(bytes: number[], cfg: UartConfig): { signal: Signal; frames: UartFrame[]; end: number } {
  const T = 1 / cfg.baud;
  const n = cfg.dataBits ?? 8;
  const stop = cfg.stopBits ?? 1;
  const s = makeSignal(1, [], 0);
  const frames: UartFrame[] = [];
  let t = (cfg.idleBits ?? 2) * T;
  for (const byte of bytes) {
    const t0 = t;
    setLevel(s, t, 0);
    t += T;
    let ones = 0;
    for (let i = 0; i < n; i++) {
      const bit = (byte >> i) & 1;
      ones += bit;
      setLevel(s, t, bit);
      t += T;
    }
    if (cfg.parity && cfg.parity !== 'none') {
      const p = cfg.parity === 'even' ? ones & 1 : (ones & 1) ^ 1;
      setLevel(s, t, p);
      t += T;
    }
    setLevel(s, t, 1);
    t += stop * T;
    frames.push({ byte: byte & ((1 << n) - 1), t0, t1: t, framingError: false, parityError: false });
    t += (cfg.gapBits ?? 1) * T;
  }
  return { signal: s, frames, end: t };
}

/** The smallest time between two edges: for ordinary data this is one bit time. */
export function estimateBit(s: Signal): number | undefined {
  const e = edgesOf(s);
  let best = Infinity;
  for (let i = 1; i < e.length; i++) best = Math.min(best, e[i]!.t - e[i - 1]!.t);
  return Number.isFinite(best) ? best : undefined;
}

/** Read UART frames from a line. Without `baud`, the bit time is estimated from the shortest pulse. */
export function decodeUart(s: Signal, cfg: Partial<UartConfig> = {}): UartFrame[] {
  const T = cfg.baud ? 1 / cfg.baud : estimateBit(s);
  if (!T) return [];
  const n = cfg.dataBits ?? 8;
  const stop = cfg.stopBits ?? 1;
  const parity = cfg.parity && cfg.parity !== 'none' ? cfg.parity : undefined;
  const frames: UartFrame[] = [];
  const edges = edgesOf(s);
  let next = -Infinity;
  for (const e of edges) {
    if (e.rising || e.t < next) continue;
    // A falling edge on an idle line: the start bit. Check it is still low in the middle.
    if (isHigh(levelAt(s, e.t + T / 2))) continue;
    let byte = 0;
    let ones = 0;
    for (let i = 0; i < n; i++) {
      const bit = isHigh(levelAt(s, e.t + T * (1.5 + i))) ? 1 : 0;
      byte |= bit << i;
      ones += bit;
    }
    let k = 1 + n;
    let parityError = false;
    if (parity) {
      const p = isHigh(levelAt(s, e.t + T * (k + 0.5))) ? 1 : 0;
      parityError = (parity === 'even' ? ones & 1 : (ones & 1) ^ 1) !== p;
      k++;
    }
    const framingError = !isHigh(levelAt(s, e.t + T * (k + 0.5)));
    const t1 = e.t + T * (k + stop);
    frames.push({ byte, t0: e.t, t1, framingError, parityError });
    next = t1 - T / 2;
  }
  return frames;
}

const printable = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : b === 10 ? '\\n' : b === 13 ? '\\r' : '');

export function hexByte(b: number): string {
  return '0x' + b.toString(16).toUpperCase().padStart(2, '0');
}

/** A UART decoder (channel 0 is the line). */
export function uartDecoder(cfg: Partial<UartConfig> = {}): Decoder & { frames(input: DecoderInput): UartFrame[] } {
  const frames = (input: DecoderInput) => (input.channels.length ? decodeUart(signalsOf(input)[0]!, cfg) : []);
  return {
    id: 'uart',
    name: 'UART',
    channels: ['RX'],
    frames,
    decode(input) {
      return frames(input).map((f) => ({
        t0: f.t0,
        t1: f.t1,
        text: f.framingError ? 'FRAMING' : f.parityError ? 'PARITY' : hexByte(f.byte),
        error: f.framingError || f.parityError,
      }));
    },
  };
}

/** The text a stream of decoded bytes spells, with unprintable bytes shown as escapes. */
export function frameText(frames: { byte: number }[]): string {
  return frames.map((f) => printable(f.byte) || `⟨${hexByte(f.byte)}⟩`).join('');
}

// ───────────────────────────────────────────── SPI ─────────────────────────────────────────────

export interface SpiConfig {
  /** Clock frequency in Hz. */
  clockHz: number;
  /** SPI mode 0–3: CPOL is bit 1 (idle level of SCK), CPHA is bit 0 (which edge samples). */
  mode: 0 | 1 | 2 | 3;
  msbFirst?: boolean;
}

export interface SpiSignals {
  sck: Signal;
  mosi: Signal;
  miso: Signal;
  cs: Signal;
  end: number;
}

/** The four wires of an SPI transfer of `mosi` bytes (and `miso` bytes coming back), chip select active low. */
export function spiSignals(mosi: number[], miso: number[], cfg: SpiConfig): SpiSignals {
  const T = 1 / cfg.clockHz;
  const cpol = cfg.mode >> 1;
  const cpha = cfg.mode & 1;
  const msb = cfg.msbFirst ?? true;
  const sck = makeSignal(cpol);
  const out = makeSignal(0);
  const inp = makeSignal(0);
  const cs = makeSignal(1);
  let t = 2 * T;
  setLevel(cs, t, 0);
  t += T;
  const bitOf = (byte: number, i: number) => (msb ? (byte >> (7 - i)) & 1 : (byte >> i) & 1);
  for (let b = 0; b < mosi.length; b++) {
    for (let i = 0; i < 8; i++) {
      const m = bitOf(mosi[b]!, i);
      const s = bitOf(miso[b] ?? 0, i);
      const first = cpol === 0 ? 1 : 0;
      if (cpha === 0) {
        // Data is valid before the first edge and sampled on it; it changes on the second edge.
        setLevel(out, t, m);
        setLevel(inp, t, s);
        setLevel(sck, t + T / 2, first);
        setLevel(sck, t + T, cpol);
      } else {
        // Data changes on the first edge and is sampled on the second.
        setLevel(sck, t, first);
        setLevel(out, t, m);
        setLevel(inp, t, s);
        setLevel(sck, t + T / 2, cpol);
      }
      t += T;
    }
  }
  t += T;
  setLevel(cs, t, 1);
  t += 2 * T;
  return { sck, mosi: out, miso: inp, cs, end: t };
}

export interface SpiByte {
  byte: number;
  t0: number;
  t1: number;
}

/** Bytes on one data line of a chip-select window, sampled on the clock edge that the mode says. */
export function decodeSpi(sck: Signal, data: Signal, cs: Signal | undefined, cfg: Pick<SpiConfig, 'mode'> & { msbFirst?: boolean }): { bytes: SpiByte[]; selects: { t0: number; t1: number }[] } {
  const cpol = cfg.mode >> 1;
  const cpha = cfg.mode & 1;
  const risingSamples = cpol === cpha;
  const msb = cfg.msbFirst ?? true;
  const clockEdges = edgesOf(sck).filter((e) => e.rising === risingSamples);
  // The chip-select windows: without a chip select the whole capture is one window.
  const windows: { t0: number; t1: number }[] = [];
  if (cs && cs.t.length > 1) {
    let start: number | undefined = isHigh(cs.v[0]!) ? undefined : cs.t[0]!;
    for (const e of edgesOf(cs)) {
      if (!e.rising) start = e.t;
      else if (start !== undefined) {
        windows.push({ t0: start, t1: e.t });
        start = undefined;
      }
    }
    if (start !== undefined) windows.push({ t0: start, t1: Infinity });
  } else windows.push({ t0: -Infinity, t1: Infinity });
  const bytes: SpiByte[] = [];
  for (const w of windows) {
    const inside = clockEdges.filter((e) => e.t >= w.t0 && e.t < w.t1);
    for (let i = 0; i + 8 <= inside.length; i += 8) {
      let byte = 0;
      for (let k = 0; k < 8; k++) {
        const bit = isHigh(levelAt(data, inside[i + k]!.t)) ? 1 : 0;
        byte = msb ? (byte << 1) | bit : byte | (bit << k);
      }
      const period = inside[i + 1] ? inside[i + 1]!.t - inside[i]!.t : 0;
      bytes.push({ byte, t0: inside[i]!.t - period / 2, t1: inside[i + 7]!.t + period / 2 });
    }
  }
  return { bytes, selects: windows.filter((w) => Number.isFinite(w.t0) || Number.isFinite(w.t1)) };
}

/** An SPI decoder. Channels: SCK, MOSI, MISO, CS (CS is optional). `line` chooses which data line the boxes show. */
export function spiDecoder(cfg: { mode?: 0 | 1 | 2 | 3; msbFirst?: boolean; line?: 'mosi' | 'miso' } = {}): Decoder {
  const line = cfg.line ?? 'mosi';
  return {
    id: line === 'mosi' ? 'spi' : 'spi-miso',
    name: line === 'mosi' ? 'SPI (MOSI)' : 'SPI (MISO)',
    channels: ['SCK', 'MOSI', 'MISO', 'CS'],
    decode(input) {
      const sig = signalsOf(input);
      const sck = sig[0];
      const data = sig[line === 'mosi' ? 1 : 2];
      if (!sck || !data) return [];
      const { bytes } = decodeSpi(sck, data, sig[3], { mode: cfg.mode ?? 0, msbFirst: cfg.msbFirst });
      return bytes.map((b) => ({ t0: b.t0, t1: b.t1, text: hexByte(b.byte) }));
    },
  };
}

// ───────────────────────────────────────────── I²C ─────────────────────────────────────────────

export interface I2cTransaction {
  /** 7-bit address. */
  address: number;
  /** True for a read: the bytes come from the device. */
  read: boolean;
  bytes: number[];
  /** The device does not acknowledge the address. */
  nackAddress?: boolean;
  /** Index of a data byte that is not acknowledged (a write the device refuses part way, or the end of a read). */
  nackByte?: number;
}

export interface I2cSignals {
  scl: Signal;
  sda: Signal;
  end: number;
}

/** SCL and SDA for one transaction: START, the address byte, the data bytes with their acknowledge bits, STOP. */
export function i2cSignals(txn: I2cTransaction, cfg: { sclHz?: number } = {}): I2cSignals {
  const T = 1 / (cfg.sclHz ?? 100e3);
  const scl = makeSignal(1);
  const sda = makeSignal(1);
  let t = 2 * T;
  // START: SDA falls while SCL is high.
  setLevel(sda, t, 0);
  t += T / 2;
  setLevel(scl, t, 0);
  t += T / 4;
  const sendByte = (byte: number, ackLow: boolean) => {
    for (let i = 7; i >= 0; i--) {
      setLevel(sda, t, (byte >> i) & 1);
      t += T / 4;
      setLevel(scl, t, 1);
      t += T / 2;
      setLevel(scl, t, 0);
      t += T / 4;
    }
    // The ninth clock: the receiver pulls SDA low to acknowledge.
    setLevel(sda, t, ackLow ? 0 : 1);
    t += T / 4;
    setLevel(scl, t, 1);
    t += T / 2;
    setLevel(scl, t, 0);
    t += T / 4;
  };
  sendByte((txn.address << 1) | (txn.read ? 1 : 0), !txn.nackAddress);
  if (!txn.nackAddress) {
    txn.bytes.forEach((b, i) => {
      const acked = txn.nackByte === undefined ? !(txn.read && i === txn.bytes.length - 1) : i !== txn.nackByte;
      sendByte(b, acked);
    });
  }
  // STOP: SDA rises while SCL is high.
  setLevel(sda, t, 0);
  t += T / 4;
  setLevel(scl, t, 1);
  t += T / 2;
  setLevel(sda, t, 1);
  t += 2 * T;
  return { scl, sda, end: t };
}

export interface I2cEvent extends Decoded {
  /** For kind address: whether it is a read. */
  read?: boolean;
}

/** Decode an I²C capture into START, address, data, ACK/NACK and STOP events. */
export function decodeI2c(scl: Signal, sda: Signal): I2cEvent[] {
  const clockRises = edgesOf(scl).filter((e) => e.rising).map((e) => e.t);
  const clockFalls = edgesOf(scl).filter((e) => !e.rising).map((e) => e.t);
  const gaps = clockRises.slice(1).map((t, i) => t - clockRises[i]!).sort((x, y) => x - y);
  const period = gaps.length ? gaps[gaps.length >> 1]! : 1e-5;
  const fallAfter = (t: number) => clockFalls.find((f) => f > t) ?? t + period / 2;
  const riseBefore = (t: number) => [...clockRises].reverse().find((r) => r <= t) ?? t;
  type Ev = { t: number; kind: 'sda-fall' | 'sda-rise' | 'scl-rise' };
  const evs: Ev[] = [];
  for (const e of edgesOf(sda)) evs.push({ t: e.t, kind: e.rising ? 'sda-rise' : 'sda-fall' });
  for (const t of clockRises) evs.push({ t, kind: 'scl-rise' });
  evs.sort((x, y) => x.t - y.t || (x.kind === 'scl-rise' ? 1 : -1));
  const out: I2cEvent[] = [];
  let inFrame = false;
  let n = 0; // bits seen in this byte, 0 to 9
  let byte = 0;
  let byteT0 = 0;
  let first = true;
  for (const ev of evs) {
    if (ev.kind !== 'scl-rise') {
      // SDA moving while SCL is high is a START or a STOP; while SCL is low it is just the next data bit.
      if (!isHigh(levelAt(scl, ev.t))) continue;
      if (ev.kind === 'sda-fall') {
        out.push({ t0: ev.t, t1: fallAfter(ev.t), text: inFrame ? 'RESTART' : 'START', kind: 'start' });
        inFrame = true;
        first = true;
        n = 0;
      } else if (inFrame) {
        out.push({ t0: riseBefore(ev.t), t1: ev.t + period / 4, text: 'STOP', kind: 'stop' });
        inFrame = false;
        n = 0;
      }
      continue;
    }
    if (!inFrame) continue;
    const bit = isHigh(levelAt(sda, ev.t)) ? 1 : 0;
    if (n < 8) {
      if (n === 0) {
        byte = 0;
        byteT0 = ev.t;
      }
      byte = (byte << 1) | bit;
      n++;
      if (n === 8) {
        const t1 = fallAfter(ev.t);
        if (first) out.push({ t0: byteT0, t1, text: `Addr ${hexByte(byte >> 1)} ${byte & 1 ? 'R' : 'W'}`, kind: 'address', byte: byte >> 1, read: (byte & 1) === 1 });
        else out.push({ t0: byteT0, t1, text: hexByte(byte), kind: 'byte', byte });
      }
    } else {
      out.push({ t0: ev.t, t1: fallAfter(ev.t), text: bit === 0 ? 'ACK' : 'NACK', kind: bit === 0 ? 'ack' : 'nack' });
      n = 0;
      first = false;
    }
  }
  return out;
}

export function i2cDecoder(): Decoder {
  return {
    id: 'i2c',
    name: 'I²C',
    channels: ['SCL', 'SDA'],
    decode(input) {
      const sig = signalsOf(input);
      if (sig.length < 2) return [];
      return decodeI2c(sig[0]!, sig[1]!).map((e) => ({ t0: e.t0, t1: e.t1, text: e.text, error: e.kind === 'nack' }));
    },
  };
}

/** Make the three decoders available to the bench's logic analyser. */
export function registerProtocolDecoders(): void {
  registerDecoder(uartDecoder());
  registerDecoder(spiDecoder());
  registerDecoder(spiDecoder({ line: 'miso' }));
  registerDecoder(i2cDecoder());
}
