/**
 * What a USB keyboard sends when a key goes down, bit by bit: the HID "boot protocol" report, wrapped in
 * a low-speed USB data packet (SYNC, PID, eight data bytes, CRC16, end of packet), bit-stuffed and NRZI
 * encoded, and turned into the voltages on the D+ and D− wires.
 *
 * The rules are from the USB 2.0 specification (chapter 8) and the HID usage tables; the CRC is
 * CRC-16/USB (polynomial 0x8005, initial value 0xFFFF, reflected, output inverted).
 */

/** Line states of a USB data pair: J and K are the two differential levels, SE0 is both wires low. */
export type LineState = 'J' | 'K' | 'SE0';

/** HID keyboard usage codes for a few keys (usage page 0x07). */
export const KEYS: Record<string, number> = {
  a: 0x04,
  b: 0x05,
  c: 0x06,
  e: 0x08,
  q: 0x14,
  z: 0x1d,
  '1': 0x1e,
  Enter: 0x28,
  Space: 0x2c,
};

export const MODIFIER = { none: 0x00, shift: 0x02 } as const;

/** The 8-byte boot-protocol keyboard report: modifier bits, reserved byte, up to six key codes. */
export function hidReport(modifier: number, keys: number[]): number[] {
  const codes = keys.slice(0, 6);
  while (codes.length < 6) codes.push(0);
  return [modifier & 0xff, 0, ...codes];
}

/** Bits of a byte, least significant first (USB sends everything that way). */
export const bitsLsbFirst = (byte: number): number[] => Array.from({ length: 8 }, (_, i) => (byte >> i) & 1);

/** The CRC-16/USB register update for one bit. */
function crcStep(reg: number, bit: number): number {
  const fb = (reg ^ bit) & 1;
  reg >>>= 1;
  return fb ? reg ^ 0xa001 : reg;
}

/** The raw CRC register (before inversion) after feeding these bytes, least significant bit first. */
export function crcRegister(bytes: readonly number[], start = 0xffff): number {
  let reg = start;
  for (const b of bytes) for (const bit of bitsLsbFirst(b)) reg = crcStep(reg, bit);
  return reg;
}

/** The two CRC bytes to append to a data packet, in transmission order (low byte first). */
export function crc16(bytes: readonly number[]): [number, number] {
  const crc = ~crcRegister(bytes) & 0xffff;
  return [crc & 0xff, crc >> 8];
}

/** The value the CRC register holds after a whole good packet (data plus CRC). */
export const CRC16_RESIDUAL = 0xb001;

export const SYNC = 0x80; // seven 0 bits then a 1, sent least significant first
export const PID_DATA0 = 0xc3; // 0b0011 and its complement 0b1100

export interface FieldSpec {
  name: string;
  /** Short plain-language meaning. */
  text: string;
}

export interface Bit {
  /** The logical bit before NRZI encoding. */
  value: number;
  /** Index into the packet's fields. */
  field: number;
  /** A 0 inserted after six 1s so that the line keeps changing (not part of the data). */
  stuffed: boolean;
  /** The line state during this bit time, after NRZI encoding. */
  line: LineState;
}

export interface Packet {
  bytes: number[];
  fields: (FieldSpec & { from: number; to: number })[];
  /** One entry per bit time, including the stuffed bits and the end of packet. */
  bits: Bit[];
}

/**
 * Build the packet a keyboard sends in reply to the host's "IN" request, carrying `report`.
 */
export function buildPacket(report: readonly number[]): Packet {
  const crc = crc16(report);
  const parts: { spec: FieldSpec; bytes: number[] }[] = [
    { spec: { name: 'SYNC', text: 'Seven changes and a pause: the receiver locks its clock to the sender.' }, bytes: [SYNC] },
    { spec: { name: 'PID', text: 'Packet type: DATA0, an unnumbered data packet (0011), and its complement (1100) as a check.' }, bytes: [PID_DATA0] },
    ...report.map((b, i) => ({
      spec: {
        name: i === 0 ? 'modifier' : i === 1 ? 'reserved' : `key ${i - 2}`,
        text: i === 0 ? 'Bit 1 is Shift, bit 0 is Left Ctrl, and so on.' : i === 1 ? 'Always zero.' : 'The HID usage code of a key that is down (0 means none). “a” is 4, “b” is 5, …',
      },
      bytes: [b],
    })),
    { spec: { name: 'CRC16', text: 'A checksum of the data bytes: the receiver recomputes it and throws the packet away if it differs.' }, bytes: [...crc] },
  ];

  const bytes: number[] = [];
  const bits: Bit[] = [];
  const fields: Packet['fields'] = [];
  let ones = 0;
  let state: LineState = 'J'; // the bus idles in J
  const push = (value: number, field: number, stuffed: boolean) => {
    if (value === 0) state = state === 'J' ? 'K' : 'J'; // NRZI: a 0 is a change, a 1 is no change
    bits.push({ value, field, stuffed, line: state });
    ones = value === 1 ? ones + 1 : 0;
  };
  parts.forEach((p, fi) => {
    const from = bits.length;
    for (const byte of p.bytes) {
      bytes.push(byte);
      for (const bit of bitsLsbFirst(byte)) {
        push(bit, fi, false);
        if (ones === 6) push(0, fi, true); // bit stuffing
      }
    }
    fields.push({ ...p.spec, from, to: bits.length });
  });
  // End of packet: two bit times of SE0 (both wires low), then one of J (idle).
  const eopField = parts.length;
  const from = bits.length;
  bits.push({ value: 0, field: eopField, stuffed: false, line: 'SE0' }, { value: 0, field: eopField, stuffed: false, line: 'SE0' }, { value: 1, field: eopField, stuffed: false, line: 'J' });
  fields.push({ name: 'EOP', text: 'End of packet: both wires held low for two bit times, then back to idle.', from, to: bits.length });
  return { bytes, fields, bits };
}

/** Decode the line states back into the packet's data bytes (NRZI decode, remove stuffed bits). Used to check the encoder. */
export function decodeLine(lines: readonly LineState[]): number[] {
  const bits: number[] = [];
  let prev: LineState = 'J';
  let ones = 0;
  for (const s of lines) {
    if (s === 'SE0') break;
    const b = s === prev ? 1 : 0;
    prev = s;
    if (ones === 6) {
      // the stuffed bit: must be a 0 and is dropped
      if (b !== 0) throw new Error('bit-stuffing violation');
      ones = 0;
      continue;
    }
    ones = b === 1 ? ones + 1 : 0;
    bits.push(b);
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((acc, bit, k) => acc | (bit << k), 0));
  return out;
}

/** Voltages of D+ and D− for a line state on a low-speed device (idle J: D− high). Nominal 3.3 V signalling. */
export function voltages(state: LineState, high = 3.3): { dPlus: number; dMinus: number } {
  if (state === 'J') return { dPlus: 0, dMinus: high };
  if (state === 'K') return { dPlus: high, dMinus: 0 };
  return { dPlus: 0, dMinus: 0 };
}

/** Low-speed USB: 1.5 Mbit/s, so one bit lasts 666.7 ns. */
export const BIT_TIME = 1 / 1.5e6;
