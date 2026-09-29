/**
 * JEDEC fuse files (JESD3-C, "Standard Data Transfer Format Between Data Preparation System and
 * Programmable Logic Device Programmer").
 *
 * A file is one transmission:
 *
 *   STX  design specification  *  field  *  field  *  …  *  ETX  transmission checksum
 *
 * The design specification is free text up to the first '*'. Every field starts with an
 * identifier and ends at the next '*'; whitespace (including line breaks) between fields is
 * ignored. The fields used here:
 *
 *   QF<n>          number of fuses
 *   QP<n>          number of pins
 *   F<0|1>         state of every fuse not listed in an L field
 *   G<0|1>         security fuse
 *   L<addr> <bits> fuse states from decimal address addr on; '0' = intact/connected, '1' = blown
 *                  (for a GAL: the cell does not connect); whitespace inside the bits is ignored
 *   C<hhhh>        fuse checksum: the 16-bit sum of the fuse array read as 8-bit words, fuse 0 in
 *                  the least significant bit of the first word, the last word padded with zeros
 *   N<text>        note
 *
 * The transmission checksum is the 16-bit sum of every byte from STX to ETX inclusive, written as
 * four hex digits after ETX. A reader must accept 0000 as "not computed".
 */

export const STX = '\x02';
export const ETX = '\x03';

export class JedecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JedecError';
  }
}

/** The JEDEC fuse checksum of a fuse array (values 0 or 1). */
export function fuseChecksum(fuses: ArrayLike<number>): number {
  let sum = 0;
  let byte = 0;
  let bit = 0;
  for (let i = 0; i < fuses.length; i++) {
    if (fuses[i]) byte |= 1 << bit;
    if (++bit === 8) {
      sum = (sum + byte) & 0xffff;
      byte = 0;
      bit = 0;
    }
  }
  return (sum + byte) & 0xffff;
}

/** The transmission checksum: 16-bit sum of the characters from STX to ETX inclusive. */
export function transmissionChecksum(text: string): number {
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) throw new JedecError('JEDEC files are 8-bit text; found a character beyond U+00FF');
    sum = (sum + code) & 0xffff;
  }
  return sum;
}

export interface JedecBlock {
  start: number;
  length: number;
  /** Write this block even when all its fuses equal the default state. */
  always?: boolean;
}

export interface JedecWriteOptions {
  /** Lines of the design specification (the text before the first '*'). '*' is replaced. */
  header?: string[];
  /** *QP: number of pins. */
  pinCount?: number;
  /** *F: default state of unlisted fuses (default 0). */
  defaultFuse?: 0 | 1;
  /** *G: security fuse (default false, written as G0). */
  security?: boolean;
  /** How to split the fuses into L fields; blocks whose fuses all equal the default are skipped. Default: 32-fuse blocks. */
  blocks?: JedecBlock[];
  /** Notes, written as N fields after the header. */
  notes?: string[];
  /** Digits of the L-field addresses (zero-padded, default 4). */
  addressDigits?: number;
  /** Hex digit case of the checksums (default 'upper'). */
  hexCase?: 'upper' | 'lower';
  /** Line ending (default '\n'). */
  eol?: '\n' | '\r\n';
}

/** JEDEC text is ASCII: anything else becomes '?'. */
function ascii(text: string): string {
  return text.replace(/[^\x20-\x7e\t]/g, '?');
}

function hex4(x: number, hexCase: 'upper' | 'lower'): string {
  const s = x.toString(16).padStart(4, '0');
  return hexCase === 'upper' ? s.toUpperCase() : s;
}

export function writeJedec(fuses: ArrayLike<number>, opts: JedecWriteOptions = {}): string {
  const eol = opts.eol ?? '\n';
  const hexCase = opts.hexCase ?? 'upper';
  const def = opts.defaultFuse ?? 0;
  const digits = opts.addressDigits ?? 4;
  const total = fuses.length;
  let body = STX + eol;
  for (const line of opts.header ?? []) body += ascii(line).replace(/\*/g, 'x') + eol;
  for (const note of opts.notes ?? []) body += `*N ${ascii(note).replace(/\*/g, 'x')}${eol}`;
  body += `*F${def}${eol}`;
  body += `*G${opts.security ? 1 : 0}${eol}`;
  if (opts.pinCount !== undefined) body += `*QP${opts.pinCount}${eol}`;
  body += `*QF${total}${eol}`;
  const blocks: JedecBlock[] =
    opts.blocks ?? Array.from({ length: Math.ceil(total / 32) }, (_, i) => ({ start: i * 32, length: Math.min(32, total - i * 32) }));
  for (const b of blocks) {
    let bits = '';
    let differs = false;
    for (let i = b.start; i < b.start + b.length; i++) {
      const v = fuses[i] ? 1 : 0;
      if (v !== def) differs = true;
      bits += v;
    }
    if (differs || b.always) body += `*L${String(b.start).padStart(digits, '0')} ${bits}${eol}`;
  }
  body += `*C${hex4(fuseChecksum(fuses), hexCase)}${eol}`;
  body += `*${eol}${ETX}`;
  return body + hex4(transmissionChecksum(body), hexCase) + eol;
}

export interface JedecField {
  id: string;
  text: string;
}

export interface JedecFile {
  /** The design specification (text before the first '*'), without STX. */
  header: string;
  fuseCount: number;
  pinCount?: number;
  defaultFuse: 0 | 1;
  security: boolean;
  fuses: Uint8Array;
  /** Fuses that were set by an L field (the others took the default). */
  listed: Uint8Array;
  notes: string[];
  /** All fields in order, for identifiers this reader does not interpret (V, P, D, …). */
  fields: JedecField[];
  fuseChecksum?: { stated: number; computed: number };
  transmissionChecksum?: { stated: number; computed: number };
}

export interface JedecReadOptions {
  /** Throw on a checksum mismatch (default true). */
  strict?: boolean;
  /** Expected number of fuses, used when the file has no QF field. */
  fuseCount?: number;
}

export function readJedec(text: string, opts: JedecReadOptions = {}): JedecFile {
  const strict = opts.strict ?? true;
  const stx = text.indexOf(STX);
  const etx = text.indexOf(ETX, stx < 0 ? 0 : stx);
  const content = text.slice(stx < 0 ? 0 : stx + 1, etx < 0 ? text.length : etx);
  let transmission: JedecFile['transmissionChecksum'];
  if (stx >= 0 && etx >= 0) {
    const m = /^([0-9A-Fa-f]{4})/.exec(text.slice(etx + 1));
    if (m) {
      const stated = parseInt(m[1]!, 16);
      const computed = transmissionChecksum(text.slice(stx, etx + 1));
      transmission = { stated, computed };
      if (strict && stated !== 0 && stated !== computed)
        throw new JedecError(`Transmission checksum mismatch: file says ${hex4(stated, 'upper')}, computed ${hex4(computed, 'upper')}`);
    }
  }
  const pieces = content.split('*');
  const header = pieces[0]!.replace(/^[\r\n]+/, '');
  const fields: JedecField[] = [];
  let fuseCount: number | undefined;
  let pinCount: number | undefined;
  let defaultFuse: 0 | 1 | undefined;
  let security = false;
  let statedC: number | undefined;
  const notes: string[] = [];
  const lists: { addr: number; bits: string }[] = [];
  for (const raw of pieces.slice(1)) {
    const f = raw.replace(/^\s+/, '');
    if (!f) continue;
    const id = f[0]!;
    const rest = f.slice(1);
    if (id === 'Q') {
      const sub = rest[0];
      const num = parseInt(rest.slice(1).trim(), 10);
      fields.push({ id: 'Q' + sub, text: rest.slice(1).trim() });
      if (sub === 'F') fuseCount = num;
      else if (sub === 'P') pinCount = num;
      continue;
    }
    fields.push({ id, text: rest.trim() });
    switch (id) {
      case 'F': {
        const v = rest.trim();
        if (v !== '0' && v !== '1') throw new JedecError(`Bad F field '${v}'`);
        defaultFuse = v === '1' ? 1 : 0;
        break;
      }
      case 'G':
        security = rest.trim() === '1';
        break;
      case 'L': {
        const m = /^\s*(\d+)\s+([01\s]*)$/.exec(rest);
        if (!m) throw new JedecError(`Bad L field '${f.slice(0, 40)}'`);
        lists.push({ addr: parseInt(m[1]!, 10), bits: m[2]!.replace(/\s+/g, '') });
        break;
      }
      case 'C': {
        const v = rest.trim();
        if (!/^[0-9A-Fa-f]{4}$/.test(v)) throw new JedecError(`Bad C field '${v}'`);
        statedC = parseInt(v, 16);
        break;
      }
      case 'N':
        notes.push(rest.trim());
        break;
      default:
        break;
    }
  }
  if (fuseCount === undefined) fuseCount = opts.fuseCount ?? Math.max(0, ...lists.map((l) => l.addr + l.bits.length));
  if (defaultFuse === undefined) {
    // Without F, every fuse must be listed.
    defaultFuse = 0;
  }
  const fuses = new Uint8Array(fuseCount).fill(defaultFuse);
  const listed = new Uint8Array(fuseCount);
  for (const { addr, bits } of lists) {
    if (addr + bits.length > fuseCount) throw new JedecError(`L${addr} runs past the ${fuseCount} fuses of the device`);
    for (let i = 0; i < bits.length; i++) {
      fuses[addr + i] = bits.charCodeAt(i) === 49 ? 1 : 0;
      listed[addr + i] = 1;
    }
  }
  let fuseSum: JedecFile['fuseChecksum'];
  if (statedC !== undefined) {
    const computed = fuseChecksum(fuses);
    fuseSum = { stated: statedC, computed };
    if (strict && statedC !== computed)
      throw new JedecError(`Fuse checksum mismatch: file says ${hex4(statedC, 'upper')}, computed ${hex4(computed, 'upper')}`);
  }
  return {
    header,
    fuseCount,
    pinCount,
    defaultFuse,
    security,
    fuses,
    listed,
    notes,
    fields,
    fuseChecksum: fuseSum,
    transmissionChecksum: transmission,
  };
}
